import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, ...params } = await req.json();
    console.log('[VONO-API] Action:', action, 'Params:', params);

    // Get VoIP configuration from integrations table
    const { data: integration, error: configError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'vono_voip')
      .eq('is_active', true)
      .maybeSingle();

    if (configError || !integration) {
      console.error('[VONO-API] No VoIP config found:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'VoIP não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const credentials = integration.credentials as Record<string, string>;
    const domain = credentials?.domain || 'vono.me';
    const api_token = credentials?.api_token;
    const api_key = credentials?.api_key;
    const baseUrl = `https://${domain}/api`;

    let result;

    switch (action) {
      case 'list-lines': {
        // Try different endpoints that might list lines/devices
        console.log('[VONO-API] Fetching lines from:', `${baseUrl}/lines/${api_token}/${api_key}`);
        
        try {
          const response = await fetch(`${baseUrl}/lines/${api_token}/${api_key}`);
          const responseText = await response.text();
          console.log('[VONO-API] Lines response:', response.status, responseText);
          
          try {
            result = JSON.parse(responseText);
          } catch {
            result = { raw: responseText };
          }

          // Check if Vono returned an error
          if (result.error === 1 || result.error === true) {
            console.error('[VONO-API] Vono API error listing lines:', result);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: result.message || result.reason || 'Erro ao listar linhas',
                details: result 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            );
          }
        } catch (fetchError) {
          console.error('[VONO-API] Error fetching lines:', fetchError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao conectar com Vono API' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        break;
      }

      case 'create-line': {
        const response = await fetch(`${baseUrl}/lines/${api_token}/${api_key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.lineData),
        });
        result = await response.json();
        break;
      }

      case 'update-line': {
        const response = await fetch(`${baseUrl}/lines/${api_token}/${api_key}/${params.lineId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params.lineData),
        });
        result = await response.json();
        break;
      }

      case 'delete-line': {
        const response = await fetch(`${baseUrl}/lines/${api_token}/${api_key}/${params.lineId}`, {
          method: 'DELETE',
        });
        result = await response.json();
        break;
      }

      case 'get-cdr': {
        const queryParams = new URLSearchParams();
        if (params.startDate) queryParams.set('start_date', params.startDate);
        if (params.endDate) queryParams.set('end_date', params.endDate);
        if (params.page) queryParams.set('page', params.page);
        if (params.limit) queryParams.set('limit', params.limit);

        const url = `${baseUrl}/cdr/${api_token}/${api_key}?${queryParams.toString()}`;
        const response = await fetch(url);
        result = await response.json();
        break;
      }

      case 'list-recordings': {
        const response = await fetch(`${baseUrl}/recordings/${api_token}/${api_key}`);
        result = await response.json();
        break;
      }

      case 'download-recording': {
        const response = await fetch(`${baseUrl}/recordings/${api_token}/${api_key}/${params.recordingId}`);
        if (response.headers.get('content-type')?.includes('audio')) {
          result = { 
            success: true, 
            url: `${baseUrl}/recordings/${api_token}/${api_key}/${params.recordingId}` 
          };
        } else {
          result = await response.json();
        }
        break;
      }

      case 'list-online-calls': {
        const response = await fetch(`${baseUrl}/online-calls/${api_token}/${api_key}`);
        result = await response.json();
        break;
      }

      case 'end-call': {
        const { callId } = params;
        
        // First update our database
        await supabase
          .from('voip_calls')
          .update({ 
            status: 'completed', 
            ended_at: new Date().toISOString() 
          })
          .eq('id', callId);

        // Try to end via Vono API if we have external call ID
        const { data: call } = await supabase
          .from('voip_calls')
          .select('external_call_id')
          .eq('id', callId)
          .single();

        if (call?.external_call_id) {
          try {
            await fetch(`${baseUrl}/online-calls/${api_token}/${api_key}/${call.external_call_id}`, {
              method: 'DELETE',
            });
          } catch (e) {
            console.log('[VONO-API] Could not end call via Vono API:', e);
          }
        }

        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    console.log('[VONO-API] Result:', result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[VONO-API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
