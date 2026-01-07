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

    // Verificar se a instância pertence ao usuário - try by instance_name first, then by id
    let instance = null;
    let instanceError = null;
    
    // First try to find by instance_name
    const { data: byName, error: byNameError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (byName) {
      instance = byName;
    } else {
      // If not found by name, try by id (UUID format)
      const { data: byId, error: byIdError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceName)
        .eq('user_id', user.id)
        .maybeSingle();
      
      instance = byId;
      instanceError = byIdError;
    }

    if (instanceError) {
      console.error('Instance query error:', instanceError);
      throw new Error('Erro ao buscar instância');
    }

    if (!instance) {
      throw new Error('Instância não encontrada');
    }

    // Obter QR Code da Evolution API - use the actual instance_name from the database
    const evolutionInstanceName = instance.instance_name;
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
