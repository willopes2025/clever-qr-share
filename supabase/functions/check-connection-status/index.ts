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
    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório');
    }

    console.log(`Checking status for instance: ${instanceName}`);

    // Verificar se a instância pertence ao usuário
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .eq('user_id', user.id)
      .maybeSingle();

    if (instanceError || !instance) {
      throw new Error('Instância não encontrada');
    }

    // Verificar status na Evolution API
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      {
        method: 'GET',
        headers: {
          'apikey': evolutionApiKey,
        },
      }
    );

    const statusData = await evolutionResponse.json();
    console.log('Evolution API status response:', JSON.stringify(statusData));

    // Mapear status da Evolution API para nosso formato
    let status: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
    const state = statusData.state || statusData.instance?.state;
    
    if (state === 'open' || state === 'connected') {
      status = 'connected';
    } else if (state === 'connecting' || state === 'qrcode') {
      status = 'connecting';
    }

    // Atualizar status no banco
    const { error: updateError } = await supabase
      .from('whatsapp_instances')
      .update({ status })
      .eq('id', instance.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status, 
      raw: statusData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in check-connection-status:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
