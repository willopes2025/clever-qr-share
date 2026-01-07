import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    const { extensionId } = await req.json();

    console.log('[FUSIONPBX-WEBRTC] Fetching WebRTC config for user:', user.id, 'extension:', extensionId);

    // Buscar extensão do usuário
    let query = supabase
      .from('extensions')
      .select(`
        *,
        fusionpbx_configs (
          id,
          domain,
          wss_url,
          stun_server,
          turn_server,
          turn_username,
          turn_password
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (extensionId) {
      query = query.eq('id', extensionId);
    }

    const { data: extensions, error: extError } = await query;

    if (extError) {
      console.error('[FUSIONPBX-WEBRTC] Error fetching extensions:', extError);
      throw new Error('Failed to fetch extensions');
    }

    if (!extensions || extensions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active extensions found',
          config: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extension = extensions[0];
    const fusionConfig = extension.fusionpbx_configs;

    if (!fusionConfig) {
      throw new Error('FusionPBX configuration not found');
    }

    // Construir configuração WebRTC
    const webrtcConfig = {
      extension: extension.extension_number,
      sipPassword: extension.sip_password,
      domain: fusionConfig.domain,
      wssUrl: fusionConfig.wss_url || `wss://${fusionConfig.domain}:7443`,
      displayName: extension.display_name || extension.extension_number,
      callerId: extension.caller_id_number || extension.extension_number,
      callerIdName: extension.caller_id_name || extension.display_name,
      stunServer: fusionConfig.stun_server || 'stun:stun.l.google.com:19302',
      turnServer: fusionConfig.turn_server,
      turnUsername: fusionConfig.turn_username,
      turnPassword: fusionConfig.turn_password,
      iceServers: [
        { urls: fusionConfig.stun_server || 'stun:stun.l.google.com:19302' }
      ]
    };

    // Adicionar TURN se configurado
    if (fusionConfig.turn_server) {
      (webrtcConfig.iceServers as any[]).push({
        urls: fusionConfig.turn_server,
        username: fusionConfig.turn_username,
        credential: fusionConfig.turn_password
      });
    }

    console.log('[FUSIONPBX-WEBRTC] Config generated for extension:', extension.extension_number);

    return new Response(
      JSON.stringify({ 
        success: true, 
        config: webrtcConfig,
        extensionId: extension.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[FUSIONPBX-WEBRTC] Error:', error);
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
