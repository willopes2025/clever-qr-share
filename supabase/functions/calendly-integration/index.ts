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
          // For agent-specific integrations, check if one exists for this agent
          const { data: existingAgent } = await supabase
            .from('calendar_integrations')
            .select('id')
            .eq('agent_config_id', agentConfigId)
            .eq('provider', 'calendly')
            .single();

          if (existingAgent) {
            // Update existing agent integration
            const { data, error } = await supabase
              .from('calendar_integrations')
              .update(upsertData)
              .eq('id', existingAgent.id)
              .select()
              .single();
            savedIntegration = data;
            saveError = error;
          } else {
            // Check if user already has a calendly integration we can update
            const { data: existingUser } = await supabase
              .from('calendar_integrations')
              .select('id')
              .eq('user_id', userId)
              .eq('provider', 'calendly')
              .single();

            if (existingUser) {
              // Update existing user integration with the new agent_config_id
              const { data, error } = await supabase
                .from('calendar_integrations')
                .update(upsertData)
                .eq('id', existingUser.id)
                .select()
                .single();
              savedIntegration = data;
              saveError = error;
            } else {
              // Insert new integration
              const { data, error } = await supabase
                .from('calendar_integrations')
                .insert(upsertData)
                .select()
                .single();
              savedIntegration = data;
              saveError = error;
            }
          }
        } else {
          // For user-level integrations, use upsert
          const { data: existingUser } = await supabase
            .from('calendar_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'calendly')
            .single();

          if (existingUser) {
            const { data, error } = await supabase
              .from('calendar_integrations')
              .update(upsertData)
              .eq('id', existingUser.id)
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

      case 'select-event-type': {
        const { eventTypeUri, eventTypeName, schedulingUrl } = params;
        
        if (!integration?.id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Integration not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('calendar_integrations')
          .update({
            selected_event_type_uri: eventTypeUri,
            selected_event_type_name: eventTypeName,
            selected_scheduling_url: schedulingUrl,
          })
          .eq('id', integration.id);

        if (updateError) {
          console.error('[CALENDLY] Error updating selected event type:', updateError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao salvar seleção' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
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

        // Use selected scheduling URL if available, otherwise fallback to first event type
        let schedulingUrl = (integration as { selected_scheduling_url?: string })?.selected_scheduling_url || '';
        
        if (!schedulingUrl) {
          // Fallback: get first event type
          const eventTypesResponse = await calendlyFetch(`/event_types?user=${encodeURIComponent(userUri)}&active=true`);
          if (eventTypesResponse.ok) {
            const etData = await eventTypesResponse.json();
            if (etData.collection.length > 0) {
              schedulingUrl = etData.collection[0].scheduling_url;
            }
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

      case 'get-available-times': {
        // Get available time slots from Calendly API
        const eventTypeUri = integration?.selected_event_type_uri || params.eventTypeUri;
        const startDate = params.startDate || new Date().toISOString().split('T')[0];
        // Calendly API limits to 7 days max, default to 7 days ahead
        const endDateDefault = new Date();
        endDateDefault.setDate(endDateDefault.getDate() + 7);
        const endDate = params.endDate || endDateDefault.toISOString().split('T')[0];
        
        if (!eventTypeUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'Event type URI not found. Please select an event type first.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[CALENDLY] Fetching available times for ${eventTypeUri} from ${startDate} to ${endDate}`);

        // Format dates for Calendly API (needs full ISO format)
        const startTime = new Date(startDate + 'T00:00:00').toISOString();
        const endTime = new Date(endDate + 'T23:59:59').toISOString();

        const response = await calendlyFetch(
          `/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}&start_time=${encodeURIComponent(startTime)}&end_time=${encodeURIComponent(endTime)}`
        );
        
        if (!response.ok) {
          const error = await response.text();
          console.error('[CALENDLY] Error fetching available times:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar horários disponíveis', details: error }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const availableTimes = (data.collection || []).map((slot: { status: string; start_time: string; invitees_remaining: number }) => ({
          status: slot.status,
          start_time: slot.start_time,
          invitees_remaining: slot.invitees_remaining,
        }));

        console.log(`[CALENDLY] Found ${availableTimes.length} available slots`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            availableTimes,
            startDate,
            endDate,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-booking': {
        // Create a booking/invitee via Calendly API
        const eventTypeUri = integration?.selected_event_type_uri || params.eventTypeUri;
        const { startTime, inviteeName, inviteeEmail, inviteePhone, timezone } = params;
        
        if (!eventTypeUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'Event type URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!startTime || !inviteeName || !inviteeEmail) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields: startTime, inviteeName, inviteeEmail' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[CALENDLY] Creating booking for ${inviteeEmail} at ${startTime}`);

        // According to Calendly API docs for AI Agents
        // POST /invitees with event_type, start_time, and invitee details
        const bookingPayload: Record<string, unknown> = {
          event_type: eventTypeUri,
          start_time: startTime,
          invitee: {
            name: inviteeName,
            email: inviteeEmail,
            timezone: timezone || 'America/Sao_Paulo',
          },
        };

        // Add phone if provided
        if (inviteePhone) {
          (bookingPayload.invitee as Record<string, unknown>).phone_number = inviteePhone;
        }

        console.log('[CALENDLY] Booking payload:', JSON.stringify(bookingPayload));

        const response = await calendlyFetch('/invitees', {
          method: 'POST',
          body: JSON.stringify(bookingPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[CALENDLY] Error creating booking:', response.status, errorText);
          
          // Parse error for user-friendly message
          let userError = 'Erro ao criar agendamento';
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.message) userError = errorData.message;
            if (errorData.details) userError += ': ' + JSON.stringify(errorData.details);
          } catch {
            userError = errorText || userError;
          }

          return new Response(
            JSON.stringify({ success: false, error: userError }),
            { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const bookingData = await response.json();
        console.log('[CALENDLY] Booking created successfully:', bookingData.resource?.uri);

        // Extract useful info from response
        const booking = bookingData.resource || {};
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            booking: {
              uri: booking.uri,
              event_uri: booking.event,
              cancel_url: booking.cancel_url,
              reschedule_url: booking.reschedule_url,
              start_time: startTime,
              invitee_name: inviteeName,
              invitee_email: inviteeEmail,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-booking-link': {
        // Generate a pre-filled scheduling link with date parameter
        const { date, time } = params;
        const schedulingUrl = integration?.selected_scheduling_url;
        
        if (!schedulingUrl) {
          return new Response(
            JSON.stringify({ success: false, error: 'No scheduling URL configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calendly accepts date parameter in format YYYY-MM-DD
        let prefilledLink = schedulingUrl;
        if (date) {
          prefilledLink += `?date=${date}`;
          if (time) {
            prefilledLink += `&time=${time}`;
          }
        }

        console.log('[CALENDLY] Generated prefilled link:', prefilledLink);

        return new Response(
          JSON.stringify({ 
            success: true, 
            link: prefilledLink,
            date,
            time,
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

      case 'get-invitee-appointments': {
        // Search for appointments by invitee email
        const { inviteeEmail } = params;
        const userUri = integration?.user_uri;
        
        if (!inviteeEmail) {
          return new Response(
            JSON.stringify({ success: false, error: 'inviteeEmail is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!userUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'User URI not found' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[CALENDLY] Searching appointments for email: ${inviteeEmail}`);

        // Get scheduled events for next 60 days
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 60);

        const eventsResponse = await calendlyFetch(
          `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${now.toISOString()}&max_start_time=${futureDate.toISOString()}&status=active`
        );
        
        if (!eventsResponse.ok) {
          const error = await eventsResponse.text();
          console.error('[CALENDLY] Error fetching events:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar agendamentos' }),
            { status: eventsResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const eventsData = await eventsResponse.json();
        const appointments = [];

        // For each event, fetch invitees to find matching email
        for (const event of eventsData.collection || []) {
          const eventUuid = event.uri.split('/').pop();
          const inviteesResponse = await calendlyFetch(`/scheduled_events/${eventUuid}/invitees`);
          
          if (inviteesResponse.ok) {
            const inviteesData = await inviteesResponse.json();
            
            for (const invitee of inviteesData.collection || []) {
              if (invitee.email.toLowerCase() === inviteeEmail.toLowerCase()) {
                appointments.push({
                  event_uri: event.uri,
                  event_name: event.name,
                  start_time: event.start_time,
                  end_time: event.end_time,
                  status: event.status,
                  location: event.location,
                  invitee_uri: invitee.uri,
                  invitee_name: invitee.name,
                  invitee_email: invitee.email,
                  cancel_url: invitee.cancel_url,
                  reschedule_url: invitee.reschedule_url,
                });
              }
            }
          }
        }

        console.log(`[CALENDLY] Found ${appointments.length} appointments for ${inviteeEmail}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            appointments,
            count: appointments.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel-booking': {
        // Cancel a booking (mark invitee as canceled)
        const { inviteeUri, reason } = params;
        
        if (!inviteeUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'inviteeUri is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[CALENDLY] Canceling booking: ${inviteeUri}`);

        // Extract invitee UUID from URI
        const inviteeUuid = inviteeUri.split('/').pop();

        const cancelResponse = await calendlyFetch(`/scheduled_events/invitees/${inviteeUuid}/cancellation`, {
          method: 'POST',
          body: JSON.stringify({
            reason: reason || 'Cancelado pelo paciente via chat',
          }),
        });

        if (!cancelResponse.ok) {
          const errorText = await cancelResponse.text();
          console.error('[CALENDLY] Error canceling booking:', cancelResponse.status, errorText);
          
          // Try alternative endpoint format
          const eventUuidMatch = inviteeUri.match(/scheduled_events\/([^/]+)/);
          if (eventUuidMatch) {
            const eventUuid = eventUuidMatch[1];
            const altCancelResponse = await calendlyFetch(`/scheduled_events/${eventUuid}/cancellation`, {
              method: 'POST',
              body: JSON.stringify({
                reason: reason || 'Cancelado pelo paciente via chat',
              }),
            });
            
            if (altCancelResponse.ok) {
              console.log('[CALENDLY] Booking canceled successfully via alternative endpoint');
              return new Response(
                JSON.stringify({ success: true, message: 'Agendamento cancelado com sucesso' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
          
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao cancelar agendamento' }),
            { status: cancelResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[CALENDLY] Booking canceled successfully');

        return new Response(
          JSON.stringify({ success: true, message: 'Agendamento cancelado com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-reschedule-link': {
        // Get reschedule link for an invitee
        const { inviteeUri } = params;
        
        if (!inviteeUri) {
          return new Response(
            JSON.stringify({ success: false, error: 'inviteeUri is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[CALENDLY] Getting reschedule link for: ${inviteeUri}`);

        // Extract invitee UUID and fetch details
        const inviteeUuid = inviteeUri.split('/').pop();
        
        // Get invitee details which includes reschedule URL
        const inviteeResponse = await calendlyFetch(`/scheduled_events/invitees/${inviteeUuid}`);
        
        if (!inviteeResponse.ok) {
          const error = await inviteeResponse.text();
          console.error('[CALENDLY] Error fetching invitee:', error);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao buscar dados do agendamento' }),
            { status: inviteeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const inviteeData = await inviteeResponse.json();
        const rescheduleUrl = inviteeData.resource?.reschedule_url;

        if (!rescheduleUrl) {
          return new Response(
            JSON.stringify({ success: false, error: 'Link de reagendamento não disponível' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('[CALENDLY] Reschedule link found:', rescheduleUrl);

        return new Response(
          JSON.stringify({ 
            success: true, 
            rescheduleUrl,
            inviteeName: inviteeData.resource?.name,
            inviteeEmail: inviteeData.resource?.email,
          }),
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
