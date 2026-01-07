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

    const { instanceName, forceRecreate = false, isNotificationOnly = false } = await req.json();
    if (!instanceName || typeof instanceName !== 'string') {
      throw new Error('Nome da instância é obrigatório');
    }
    
    console.log(`isNotificationOnly: ${isNotificationOnly}`);

    // Sanitize and validate name
    const sanitizedName = instanceName.trim();
    if (sanitizedName.length < 3) {
      throw new Error('O nome da instância deve ter pelo menos 3 caracteres');
    }

    console.log(`Creating instance: ${sanitizedName} for user: ${user.id}, forceRecreate: ${forceRecreate}`);

    // Check if instance already exists in local database for this user
    const { data: existingLocal } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('user_id', user.id)
      .eq('instance_name', sanitizedName)
      .maybeSingle();

    if (existingLocal) {
      throw new Error(`Você já possui uma instância chamada "${sanitizedName}"`);
    }

    // Check if instance already exists in Evolution API
    console.log('Checking if instance exists in Evolution API...');
    const fetchResponse = await fetch(
      `${evolutionApiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(sanitizedName)}`,
      {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey },
      }
    );

    let existsInEvolution = false;
    if (fetchResponse.ok) {
      const existingInstances = await fetchResponse.json();
      console.log('Evolution API fetchInstances response:', JSON.stringify(existingInstances));
      
      // Evolution returns array of instances matching the name
      if (Array.isArray(existingInstances) && existingInstances.length > 0) {
        const exactMatch = existingInstances.find(
          (inst: { name?: string; instanceName?: string }) => 
            inst.name === sanitizedName || inst.instanceName === sanitizedName
        );
        if (exactMatch) {
          existsInEvolution = true;
        }
      }
    }

    // If instance exists in Evolution API
    if (existsInEvolution) {
      if (forceRecreate) {
        // Delete existing instance from Evolution API
        console.log(`Deleting existing instance "${sanitizedName}" from Evolution API...`);
        const deleteResponse = await fetch(
          `${evolutionApiUrl}/instance/delete/${encodeURIComponent(sanitizedName)}`,
          {
            method: 'DELETE',
            headers: { 'apikey': evolutionApiKey },
          }
        );
        
        if (!deleteResponse.ok) {
          const deleteError = await deleteResponse.json().catch(() => ({}));
          console.error('Failed to delete instance from Evolution API:', deleteError);
          throw new Error('Não foi possível excluir a instância existente na Evolution API. Tente novamente.');
        }
        
        console.log(`Instance "${sanitizedName}" deleted from Evolution API`);
        
        // Small delay to ensure Evolution API has processed the deletion
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        // Return special error code to indicate instance exists and can be recreated
        return new Response(JSON.stringify({ 
          error: `Já existe uma instância chamada "${sanitizedName}" na Evolution API.`,
          code: 'INSTANCE_EXISTS_IN_EVOLUTION',
          instanceName: sanitizedName
        }), {
          status: 409, // Conflict
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

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
          instanceName: sanitizedName,
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
      // Extract the actual error message from Evolution API response
      let errorMessage = 'Erro ao criar instância na Evolution API';
      if (evolutionData.response?.message) {
        const messages = evolutionData.response.message;
        errorMessage = Array.isArray(messages) ? messages.join(', ') : messages;
      } else if (evolutionData.message) {
        errorMessage = evolutionData.message;
      }
      throw new Error(errorMessage);
    }

    // Salvar no banco de dados
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .insert({
        user_id: user.id,
        instance_name: sanitizedName,
        status: 'disconnected',
        is_notification_only: isNotificationOnly,
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
