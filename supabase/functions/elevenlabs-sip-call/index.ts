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
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY não configurada');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    
    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { contactPhone, contactId, conversationId, agentConfigId, sipConfigId } = await req.json();

    if (!contactPhone || !sipConfigId || !agentConfigId) {
      throw new Error('Parâmetros obrigatórios: contactPhone, sipConfigId, agentConfigId');
    }

    console.log('Iniciando chamada SIP:', { contactPhone, agentConfigId, sipConfigId });

    // Get SIP config
    const { data: sipConfig, error: sipError } = await supabaseClient
      .from('elevenlabs_sip_config')
      .select('*')
      .eq('id', sipConfigId)
      .eq('user_id', user.id)
      .single();

    if (sipError || !sipConfig) {
      console.error('Erro ao buscar config SIP:', sipError);
      throw new Error('Configuração SIP não encontrada');
    }

    // Get agent config
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('ai_agent_configs')
      .select('*')
      .eq('id', agentConfigId)
      .single();

    if (agentError || !agentConfig) {
      console.error('Erro ao buscar config do agente:', agentError);
      throw new Error('Configuração do agente não encontrada');
    }

    if (!agentConfig.elevenlabs_agent_id) {
      throw new Error('Agent ID do ElevenLabs não configurado para este agente');
    }

    // Get contact info for personalization
    let contactName = 'Cliente';
    if (contactId) {
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('name, phone')
        .eq('id', contactId)
        .single();
      
      if (contact?.name) {
        contactName = contact.name;
      }
    }

    // Format phone number to E.164
    let formattedPhone = contactPhone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }
    formattedPhone = '+' + formattedPhone;

    console.log('Telefone formatado:', formattedPhone);

    // Prepare conversation context
    const conversationContext = {
      contact_name: contactName,
      agent_name: agentConfig.agent_name,
      greeting: agentConfig.greeting_message || `Olá ${contactName}, tudo bem?`,
    };

    // Call ElevenLabs SIP Trunk API for outbound call
    const elevenlabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: agentConfig.elevenlabs_agent_id,
          agent_phone_number_id: sipConfig.phone_number_id,
          to_number: formattedPhone,
          conversation_initiation_client_data: conversationContext,
        }),
      }
    );

    if (!elevenlabsResponse.ok) {
      const errorText = await elevenlabsResponse.text();
      console.error('Erro ElevenLabs:', elevenlabsResponse.status, errorText);
      throw new Error(`Erro ao iniciar chamada: ${errorText}`);
    }

    const elevenlabsData = await elevenlabsResponse.json();
    console.log('Resposta ElevenLabs:', elevenlabsData);

    // Create call record
    const { data: callRecord, error: insertError } = await supabaseClient
      .from('ai_phone_calls')
      .insert({
        user_id: user.id,
        contact_id: contactId || null,
        conversation_id: conversationId || null,
        agent_config_id: agentConfigId,
        sip_config_id: sipConfigId,
        elevenlabs_conversation_id: elevenlabsData.conversation_id || null,
        sip_call_id: elevenlabsData.call_id || elevenlabsData.sip_call_id || null,
        to_number: formattedPhone,
        status: 'initiating',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Erro ao registrar chamada:', insertError);
      // Don't throw, call was already initiated
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callRecord?.id,
        elevenlabs_conversation_id: elevenlabsData.conversation_id,
        sip_call_id: elevenlabsData.call_id || elevenlabsData.sip_call_id,
        message: 'Chamada iniciada com sucesso',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função elevenlabs-sip-call:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
