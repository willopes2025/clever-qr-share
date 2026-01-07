import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      callId, 
      targetExtension, 
      transferType = 'blind' // 'blind' ou 'attended'
    } = await req.json();

    if (!callId || !targetExtension) {
      throw new Error('Call ID and target extension are required');
    }

    console.log('[FUSIONPBX-TRANSFER] Initiating transfer:', { callId, targetExtension, transferType });

    // Buscar a chamada
    const { data: call, error: callError } = await supabase
      .from('voip_calls')
      .select(`
        *,
        extensions!voip_calls_extension_id_fkey (
          *,
          fusionpbx_configs (*)
        )
      `)
      .eq('id', callId)
      .eq('user_id', user.id)
      .single();

    if (callError || !call) {
      throw new Error('Call not found or unauthorized');
    }

    if (call.status !== 'in_progress') {
      throw new Error('Call is not in progress');
    }

    const fusionConfig = call.extensions?.fusionpbx_configs;

    if (!fusionConfig || !fusionConfig.api_url) {
      // Sem API configurada, apenas registrar o evento (transferência será via WebRTC)
      console.log('[FUSIONPBX-TRANSFER] No API configured, transfer will be handled by WebRTC client');
      
      await supabase
        .from('call_events')
        .insert({
          call_id: callId,
          event_type: 'transfer_requested',
          event_data: {
            target_extension: targetExtension,
            transfer_type: transferType,
            method: 'webrtc'
          }
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Transfer request registered',
          method: 'webrtc',
          targetExtension
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamar API do FusionPBX para transferência
    const transferUrl = `${fusionConfig.api_url}/app/calls/calls_exec.php`;
    
    const transferCommand = transferType === 'attended'
      ? `att_xfer ${targetExtension}@${fusionConfig.domain}`
      : `transfer ${targetExtension} XML default`;

    const transferParams = new URLSearchParams({
      key: fusionConfig.api_key,
      uuid: call.provider_call_id,
      cmd: transferCommand
    });

    console.log('[FUSIONPBX-TRANSFER] Calling FusionPBX API');

    const transferResponse = await fetch(`${transferUrl}?${transferParams}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const transferResult = await transferResponse.text();
    console.log('[FUSIONPBX-TRANSFER] Response:', transferResult);

    // Registrar evento
    await supabase
      .from('call_events')
      .insert({
        call_id: callId,
        event_type: 'transfer_initiated',
        event_data: {
          target_extension: targetExtension,
          transfer_type: transferType,
          api_response: transferResult
        }
      });

    // Atualizar status da chamada
    await supabase
      .from('voip_calls')
      .update({ 
        status: 'transferring',
        notes: `Transferring to ${targetExtension}`
      })
      .eq('id', callId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${transferType} transfer initiated to ${targetExtension}`,
        method: 'api'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FUSIONPBX-TRANSFER] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
