import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      contactPhone, 
      contactId, 
      conversationId, 
      dealId,
      srcNumber,
      deviceId,
      useAI = false 
    } = await req.json();

    console.log('[VONO-CLICK2CALL] Request:', { contactPhone, contactId, useAI });

    // Get VoIP configuration for user
    const { data: voipConfig, error: configError } = await supabase
      .from('voip_configurations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (configError || !voipConfig) {
      console.error('[VONO-CLICK2CALL] No VoIP config found:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'VoIP não configurado. Configure nas Integrações.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { domain, api_token, api_key, default_device_id, default_src_number } = voipConfig;

    // Determine device and source number
    const callDeviceId = deviceId || default_device_id;
    const callSrcNumber = srcNumber || default_src_number;

    if (!callDeviceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID do dispositivo não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!callSrcNumber) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número de origem não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Format phone numbers (remove non-digits, ensure country code)
    const formatPhone = (phone: string): string => {
      let cleaned = phone.replace(/\D/g, '');
      // Add Brazil country code if not present
      if (cleaned.length === 11 || cleaned.length === 10) {
        cleaned = '55' + cleaned;
      }
      return cleaned;
    };

    const src = formatPhone(callSrcNumber);
    const dst = formatPhone(contactPhone);

    console.log('[VONO-CLICK2CALL] Making call:', { src, dst, deviceId: callDeviceId });

    // Call Vono Click2Call API
    // API: POST https://{domain}/api/click2Call/{API_TOKEN}/{API_KEY}
    const vonoUrl = `https://${domain}/api/click2Call/${api_token}/${api_key}`;
    
    const vonoResponse = await fetch(vonoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        device_id: callDeviceId,
        src: src,
        dst: dst,
      }),
    });

    const vonoResult = await vonoResponse.text();
    console.log('[VONO-CLICK2CALL] Vono response:', vonoResponse.status, vonoResult);

    let vonoData;
    try {
      vonoData = JSON.parse(vonoResult);
    } catch {
      vonoData = { raw: vonoResult };
    }

    // Create call record in database
    const { data: callRecord, error: insertError } = await supabase
      .from('voip_calls')
      .insert({
        user_id: user.id,
        voip_config_id: voipConfig.id,
        contact_id: contactId || null,
        conversation_id: conversationId || null,
        deal_id: dealId || null,
        device_id: callDeviceId,
        caller: src,
        called: dst,
        direction: 'outbound',
        status: vonoResponse.ok ? 'pending' : 'failed',
        ai_enabled: useAI,
        external_call_id: vonoData.call_id || vonoData.id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[VONO-CLICK2CALL] Error inserting call record:', insertError);
    }

    if (!vonoResponse.ok) {
      console.error('[VONO-CLICK2CALL] Vono API error:', vonoResult);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: vonoData.message || vonoData.error || 'Erro ao iniciar chamada',
          details: vonoData 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[VONO-CLICK2CALL] Call initiated successfully:', callRecord?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        callId: callRecord?.id,
        externalCallId: vonoData.call_id || vonoData.id,
        message: 'Chamada iniciada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[VONO-CLICK2CALL] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
