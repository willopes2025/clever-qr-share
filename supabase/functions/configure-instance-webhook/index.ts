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
      throw new Error('Não autenticado');
    }

    const { instanceName, configureAll } = await req.json();

    // Webhook URL for receiving messages
    const webhookUrl = `${supabaseUrl}/functions/v1/receive-webhook`;
    console.log('Webhook URL:', webhookUrl);

    const webhookConfig = {
      enabled: true,
      url: webhookUrl,
      byEvents: false,
      base64: false,
      headers: {},
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'SEND_MESSAGE',
      ],
    };
    
    console.log('Webhook config:', JSON.stringify(webhookConfig, null, 2));

    if (configureAll) {
      // Configure webhook for all user's instances
      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('user_id', user.id);

      if (instancesError) {
        throw new Error('Erro ao buscar instâncias');
      }

      const results = [];
      for (const instance of instances || []) {
        try {
          const response = await fetch(
            `${evolutionApiUrl}/webhook/set/${instance.instance_name}`,
            {
              method: 'POST',
              headers: {
                'apikey': evolutionApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ webhook: webhookConfig }),
            }
          );

          const data = await response.json();
          results.push({
            instanceName: instance.instance_name,
            success: response.ok,
            data,
          });
          console.log(`Webhook configured for ${instance.instance_name}:`, data);
        } catch (err) {
          console.error(`Error configuring webhook for ${instance.instance_name}:`, err);
          results.push({
            instanceName: instance.instance_name,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Configure webhook for a single instance
      if (!instanceName) {
        throw new Error('Nome da instância é obrigatório');
      }

      // Verify user owns the instance
      const { data: instance, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('id')
        .eq('user_id', user.id)
        .eq('instance_name', instanceName)
        .single();

      if (instanceError || !instance) {
        throw new Error('Instância não encontrada');
      }

      console.log(`Configuring webhook for instance: ${instanceName}`);

      const response = await fetch(
        `${evolutionApiUrl}/webhook/set/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ webhook: webhookConfig }),
        }
      );

      const data = await response.json();
      console.log('Evolution API response:', JSON.stringify(data));

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao configurar webhook');
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in configure-instance-webhook:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
