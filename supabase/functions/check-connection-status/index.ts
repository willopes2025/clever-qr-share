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

    // Se conectado, buscar dados do perfil via fetchInstances
    let phoneNumber: string | null = null;
    let profileName: string | null = null;
    let profilePictureUrl: string | null = null;
    let profileStatus: string | null = null;
    let isBusiness = false;

    if (status === 'connected') {
      try {
        const detailsResponse = await fetch(
          `${evolutionApiUrl}/instance/fetchInstances?instanceName=${instanceName}`,
          {
            method: 'GET',
            headers: {
              'apikey': evolutionApiKey,
            },
          }
        );
        const detailsData = await detailsResponse.json();
        console.log('Instance details response:', JSON.stringify(detailsData));

        // Extract profile data from response
        const instanceDetails = Array.isArray(detailsData) ? detailsData[0] : detailsData;
        if (instanceDetails?.instance) {
          phoneNumber = instanceDetails.instance.owner?.replace('@s.whatsapp.net', '') || null;
          profileName = instanceDetails.instance.profileName || null;
          profilePictureUrl = instanceDetails.instance.profilePictureUrl || null;
          profileStatus = instanceDetails.instance.profileStatus || null;
          // Check if it's a business account (usually indicated by the owner format or other fields)
          isBusiness = instanceDetails.instance.isBusiness || false;
        }
      } catch (detailsError) {
        console.error('Error fetching instance details:', detailsError);
      }
    }

    // Atualizar status e dados do perfil no banco
    const updateData: Record<string, unknown> = { status };
    
    if (status === 'connected') {
      updateData.phone_number = phoneNumber;
      updateData.profile_name = profileName;
      updateData.profile_picture_url = profilePictureUrl;
      updateData.profile_status = profileStatus;
      updateData.is_business = isBusiness;
    }

    const { error: updateError } = await supabase
      .from('whatsapp_instances')
      .update(updateData)
      .eq('id', instance.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status,
      phoneNumber,
      profileName,
      profilePictureUrl,
      isBusiness,
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
