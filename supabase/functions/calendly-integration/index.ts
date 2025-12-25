import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALENDLY_API_BASE = 'https://api.calendly.com';

interface CalendlyUser {
  resource: {
    uri: string;
    name: string;
    email: string;
    current_organization: string;
    scheduling_url: string;
  };
}

interface CalendlyEventType {
  uri: string;
  name: string;
  active: boolean;
  duration: number;
  scheduling_url: string;
  description_html: string | null;
}

interface CalendlyScheduledEvent {
  uri: string;
  name: string;
  status: string;
  start_time: string;
  end_time: string;
  event_type: string;
  location: { type: string; location?: string; join_url?: string } | null;
  invitees_counter: { total: number; active: number; limit: number };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, apiToken, agentConfigId, ...params } = await req.json();

    console.log(`[CALENDLY] Action: ${action}, userId: ${userId}, agentConfigId: ${agentConfigId}`);

    // For setup action, use the provided token. For others, fetch from DB
    let token = apiToken;
    let integration = null;

    // First try to fetch by agentConfigId if provided
    if (!token && agentConfigId) {
      const { data: integrationData } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('agent_config_id', agentConfigId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      if (integrationData) {
        token = integrationData.api_token;
        integration = integrationData;
      }
    }

    // Fallback to userId lookup
    if (!token && userId) {
      const { data: integrationData } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();

      if (integrationData) {
        token = integrationData.api_token;
        integration = integrationData;
      }
    }

    if (!token && action !== 'validate') {
      return new Response(
        JSON.stringify({ success: false, error: 'No Calendly token configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const calendlyFetch = async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(`${CALENDLY_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      return response;
    };

    switch (action) {
      case 'setup': {
        // Validate token and get user info
        const userResponse = await calendlyFetch('/users/me');
        
        if (!userResponse.ok) {
          const error = await userResponse.text();
          console.error('[CALENDLY] Token validation failed:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Token inválido' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userData: CalendlyUser = await userResponse.json();
        console.log('[CALENDLY] User validated:', userData.resource.name);

        // Build upsert data
        const upsertData: Record<string, unknown> = {
          user_id: userId,
          provider: 'calendly',
          api_token: token,
          user_uri: userData.resource.uri,
          organization_uri: userData.resource.current_organization,
          is_active: true,
          last_sync_at: new Date().toISOString(),
        };

        // If agentConfigId is provided, link to agent
        if (agentConfigId) {
          upsertData.agent_config_id = agentConfigId;
        }

        // Save integration to database
        let savedIntegration;
        let saveError;

        if (agentConfigId) {
          // For agent-specific integrations, check if one exists first
          const { data: existing } = await supabase
            .from('calendar_integrations')
            .select('id')
            .eq('agent_config_id', agentConfigId)
            .eq('provider', 'calendly')
            .single();

          if (existing) {
            const { data, error } = await supabase
              .from('calendar_integrations')
              .update(upsertData)
              .eq('id', existing.id)
              .select()
              .single();
            savedIntegration = data;
            saveError = error;
          } else {
            const { data, error } = await supabase
              .from('calendar_integrations')
              .insert(upsertData)
              .select()
              .single();
            savedIntegration = data;
            saveError = error;
          }
        } else {
          // For user-level integrations, use upsert
          const { data, error } = await supabase
            .from('calendar_integrations')
            .upsert(upsertData, { 
              onConflict: 'user_id,provider' 
            })
            .select()
            .single();
          savedIntegration = data;
          saveError = error;
        }

        if (saveError) {
          console.error('[CALENDLY] Error saving integration:', saveError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar integração' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: {
              name: userData.resource.name,
              email: userData.resource.email,
              scheduling_url: userData.resource.scheduling_url,
            },
            integration: savedIntegration,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list-event-types': {
        const userUri = integration?.user_uri || params.userUri;
        
        if (!userUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'User URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await calendlyFetch(`/event_types?user=${encodeURIComponent(userUri)}&active=true`);
        
        if (!response.ok) {
          const error = await response.text();
          console.error('[CALENDLY] Error fetching event types:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar tipos de eventos' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const eventTypes = data.collection.map((et: CalendlyEventType) => ({
          uri: et.uri,
          name: et.name,
          duration: et.duration,
          scheduling_url: et.scheduling_url,
          active: et.active,
        }));

        return new Response(
          JSON.stringify({ success: true, eventTypes }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-scheduled-events': {
        const userUri = integration?.user_uri || params.userUri;
        const minTime = params.minTime || new Date().toISOString();
        const maxTime = params.maxTime || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        if (!userUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'User URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await calendlyFetch(
          `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${minTime}&max_start_time=${maxTime}&status=active`
        );
        
        if (!response.ok) {
          const error = await response.text();
          console.error('[CALENDLY] Error fetching scheduled events:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar eventos agendados' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const events = data.collection.map((event: CalendlyScheduledEvent) => ({
          uri: event.uri,
          name: event.name,
          status: event.status,
          start_time: event.start_time,
          end_time: event.end_time,
          location: event.location,
        }));

        return new Response(
          JSON.stringify({ success: true, events }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-availability': {
        // Get scheduled events and return available slots
        const userUri = integration?.user_uri || params.userUri;
        const date = params.date || new Date().toISOString().split('T')[0];
        
        if (!userUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'User URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get events for the specified date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendlyFetch(
          `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${startOfDay.toISOString()}&max_start_time=${endOfDay.toISOString()}&status=active`
        );
        
        if (!response.ok) {
          const error = await response.text();
          console.error('[CALENDLY] Error fetching availability:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao verificar disponibilidade' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const busySlots = data.collection.map((event: CalendlyScheduledEvent) => ({
          start: event.start_time,
          end: event.end_time,
          name: event.name,
        }));

        // Get event types for scheduling URL
        const eventTypesResponse = await calendlyFetch(`/event_types?user=${encodeURIComponent(userUri)}&active=true`);
        let schedulingUrl = '';
        
        if (eventTypesResponse.ok) {
          const etData = await eventTypesResponse.json();
          if (etData.collection.length > 0) {
            schedulingUrl = etData.collection[0].scheduling_url;
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            date,
            busySlots,
            hasBusySlots: busySlots.length > 0,
            schedulingUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'register-webhook': {
        const organizationUri = integration?.organization_uri || params.organizationUri;
        const webhookUrl = `${supabaseUrl}/functions/v1/receive-webhook`;
        
        if (!organizationUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'Organization URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create webhook subscription
        const response = await calendlyFetch('/webhook_subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            url: webhookUrl,
            events: ['invitee.created', 'invitee.canceled'],
            organization: organizationUri,
            scope: 'organization',
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error('[CALENDLY] Error creating webhook:', error);
          
          // Check if webhook already exists
          if (response.status === 409) {
            return new Response(
              JSON.stringify({ success: true, message: 'Webhook já registrado' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao registrar webhook' }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const webhookData = await response.json();
        
        // Update integration with webhook info
        if (integration?.id) {
          await supabase
            .from('calendar_integrations')
            .update({
              webhook_subscription_id: webhookData.resource.uri,
              webhook_signing_key: webhookData.resource.signing_key,
            })
            .eq('id', integration.id);
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            webhook: {
              uri: webhookData.resource.uri,
              state: webhookData.resource.state,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        // Delete webhook subscription if exists
        if (integration?.webhook_subscription_id) {
          try {
            await calendlyFetch(`/webhook_subscriptions/${integration.webhook_subscription_id.split('/').pop()}`, {
              method: 'DELETE',
            });
          } catch (e) {
            console.error('[CALENDLY] Error deleting webhook:', e);
          }
        }

        // Deactivate integration
        if (integration?.id) {
          await supabase
            .from('calendar_integrations')
            .update({ is_active: false })
            .eq('id', integration.id);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[CALENDLY] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
