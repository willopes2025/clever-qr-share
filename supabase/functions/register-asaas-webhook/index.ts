import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get user from JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // Get Asaas integration
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('id, credentials, settings')
      .eq('user_id', userId)
      .eq('provider', 'asaas')
      .eq('is_active', true)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Integração Asaas não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = (integration.credentials as Record<string, string>) || {};
    const apiKey = creds.access_token;
    const environment = creds.environment || 'production';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API Key do Asaas não configurada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseUrl = environment === 'sandbox'
      ? 'https://api-sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const webhookUrl = `${supabaseUrl}/functions/v1/asaas-webhook?user_id=${userId}`;

    console.log(`Registering Asaas webhook for user ${userId}: ${webhookUrl}`);

    // First, check existing webhooks to avoid duplicates
    const listRes = await fetch(`${baseUrl}/webhooks`, {
      headers: { 'access_token': apiKey },
    });

    let existingWebhook = null;
    if (listRes.ok) {
      const listData = await listRes.json();
      const webhooks = listData.data || [];
      existingWebhook = webhooks.find((w: any) => w.url === webhookUrl);
    }

    const webhookPayload = {
      name: 'Lovable CRM Webhook',
      url: webhookUrl,
      email: user.email || '',
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken: '',
      sendType: 'SEQUENTIALLY',
      events: [
        'PAYMENT_CREATED',
        'PAYMENT_CONFIRMED',
        'PAYMENT_RECEIVED',
        'PAYMENT_OVERDUE',
        'PAYMENT_DELETED',
        'PAYMENT_REFUNDED',
        'PAYMENT_UPDATED',
      ],
    };

    if (existingWebhook) {
      const updateRes = await fetch(`${baseUrl}/webhooks/${existingWebhook.id}`, {
        method: 'PUT',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!updateRes.ok) {
        const errText = await updateRes.text();
        console.error('Error updating webhook:', errText);
        throw new Error(`Erro ao atualizar webhook: ${errText}`);
      }

      console.log(`Updated existing webhook ${existingWebhook.id}`);
    } else {
      // Create new webhook
      const createRes = await fetch(`${baseUrl}/webhooks`, {
        method: 'POST',
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error('Error creating webhook:', errText);
        throw new Error(`Erro ao criar webhook: ${errText}`);
      }

      const createData = await createRes.json();
      console.log(`Created webhook ${createData.id}`);
    }

    // Save the webhook URL in integration settings
    const currentSettings = (integration.settings as Record<string, any>) || {};
    await supabase
      .from('integrations')
      .update({
        settings: {
          ...currentSettings,
          webhook_url: webhookUrl,
        },
      })
      .eq('id', integration.id);

    return new Response(JSON.stringify({
      success: true,
      webhookUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Register webhook error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
