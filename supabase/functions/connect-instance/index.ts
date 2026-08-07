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
      console.error('Auth error:', authError);
      throw new Error('Não autenticado');
    }

    const { instanceName } = await req.json();
    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório');
    }

    console.log(`Connecting instance: ${instanceName} for user: ${user.id}`);

    // Buscar instância (RLS já restringe ao usuário/organização)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceName);
    let instance: any = null;

    if (isUuid) {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceName)
        .maybeSingle();
      if (error) {
        console.error('Instance query error (id):', error);
        throw new Error('Erro ao buscar instância');
      }
      instance = data;
    }

    if (!instance) {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .or(`instance_name.eq.${instanceName},evolution_instance_name.eq.${instanceName}`)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Instance query error (name):', error);
        throw new Error('Erro ao buscar instância');
      }
      instance = data;
    }


    if (!instance) {
      throw new Error('Instância não encontrada');
    }

    // Obter QR Code da Evolution API - use evolution_instance_name (unique API identifier)
    const evolutionInstanceName = instance.evolution_instance_name || instance.instance_name;
    console.log(`Calling Evolution API to connect instance: ${evolutionInstanceName}`);
    
    const evolutionResponse = await fetch(
      `${evolutionApiUrl}/instance/connect/${evolutionInstanceName}`,
      {
        method: 'GET',
        headers: {
          'apikey': evolutionApiKey,
        },
      }
    );

    const qrData = await evolutionResponse.json();
    console.log('Evolution API QR response:', JSON.stringify(qrData));

    if (!evolutionResponse.ok) {
      throw new Error(qrData.message || 'Erro ao obter QR Code');
    }

    // Atualizar QR Code no banco
    const { error: updateError } = await supabase
      .from('whatsapp_instances')
      .update({
        qr_code: qrData.base64 || qrData.qrcode?.base64,
        qr_code_updated_at: new Date().toISOString(),
        status: 'connecting',
      })
      .eq('id', instance.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      base64: qrData.base64 || qrData.qrcode?.base64,
      pairingCode: qrData.pairingCode,
      code: qrData.code
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in connect-instance:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
