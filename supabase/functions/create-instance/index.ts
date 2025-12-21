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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Não autenticado');
    }

    const { instanceName } = await req.json();
    if (!instanceName || typeof instanceName !== 'string') {
      throw new Error('Nome da instância é obrigatório');
    }

    console.log(`Creating instance: ${instanceName} for user: ${user.id}`);

    // Webhook URL for receiving messages
    const webhookUrl = `${supabaseUrl}/functions/v1/receive-webhook`;
    console.log('Webhook URL:', webhookUrl);

    // Chamar Evolution API para criar instância
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/instance/create`,
      {
        method: 'POST',
        headers: {
          'apikey': evolutionApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceName: instanceName,
          integration: 'WHATSAPP-BAILEYS',
          token: crypto.randomUUID(),
          qrcode: true,
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: false,
            base64: false,
            headers: {},
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
            ],
          },
        }),
      }
    );

    const evolutionData = await evolutionResponse.json();
    console.log('Evolution API response:', JSON.stringify(evolutionData));

    if (!evolutionResponse.ok) {
      throw new Error(evolutionData.message || 'Erro ao criar instância na Evolution API');
    }

    // Salvar no banco de dados
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .insert({
        user_id: user.id,
        instance_name: instanceName,
        status: 'disconnected',
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error('Erro ao salvar instância no banco de dados');
    }

    console.log('Instance created successfully:', data);

    return new Response(JSON.stringify({ success: true, instance: data, evolution: evolutionData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-instance:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
