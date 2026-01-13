import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookVerificationResult {
  success: boolean;
  webhookStatus: 'active' | 'not_configured' | 'partial' | 'error';
  details: {
    callbackUrl?: string;
    fields?: string[];
    lastVerified: string;
    appInfo?: {
      id: string;
      name: string;
    };
  };
  missingFields: string[];
  message: string;
}

const REQUIRED_FIELDS = ['messages'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-meta-webhook] Checking webhook for user:', user.id);

    // Fetch Meta integration config
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('config')
      .eq('user_id', user.id)
      .eq('name', 'meta_whatsapp')
      .maybeSingle();

    if (integrationError) {
      console.error('[verify-meta-webhook] Error fetching integration:', integrationError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          webhookStatus: 'error',
          message: 'Erro ao buscar configuração da integração',
          details: { lastVerified: new Date().toISOString() },
          missingFields: []
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration || !integration.config) {
      console.log('[verify-meta-webhook] No Meta integration found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          webhookStatus: 'not_configured',
          message: 'Integração Meta WhatsApp não configurada. Configure primeiro em Configurações → Meta WhatsApp.',
          details: { lastVerified: new Date().toISOString() },
          missingFields: REQUIRED_FIELDS
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = integration.config as Record<string, string>;
    const accessToken = config.access_token;
    const businessAccountId = config.business_account_id;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          webhookStatus: 'not_configured',
          message: 'Access Token não configurado. Adicione o token de acesso na configuração.',
          details: { lastVerified: new Date().toISOString() },
          missingFields: REQUIRED_FIELDS
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!businessAccountId) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          webhookStatus: 'not_configured',
          message: 'Business Account ID não configurado. Adicione o ID da conta business na configuração.',
          details: { lastVerified: new Date().toISOString() },
          missingFields: REQUIRED_FIELDS
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[verify-meta-webhook] Checking subscribed apps for business account:', businessAccountId);

    // Query Meta Graph API to check webhook subscriptions
    const graphApiUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/subscribed_apps`;
    
    const response = await fetch(`${graphApiUrl}?access_token=${accessToken}`);
    const data = await response.json();

    console.log('[verify-meta-webhook] Graph API response:', JSON.stringify(data));

    if (data.error) {
      console.error('[verify-meta-webhook] Graph API error:', data.error);
      
      let errorMessage = 'Erro ao verificar webhook no Meta';
      if (data.error.code === 190) {
        errorMessage = 'Token de acesso expirado ou inválido. Gere um novo token no Meta Business.';
      } else if (data.error.code === 100) {
        errorMessage = 'ID da conta business inválido. Verifique a configuração.';
      } else {
        errorMessage = data.error.message || errorMessage;
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          webhookStatus: 'error',
          message: errorMessage,
          details: { 
            lastVerified: new Date().toISOString(),
          },
          missingFields: REQUIRED_FIELDS
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there are any subscribed apps
    const subscribedApps = data.data || [];
    
    if (subscribedApps.length === 0) {
      console.log('[verify-meta-webhook] No subscribed apps found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          webhookStatus: 'not_configured',
          message: 'Nenhum app inscrito para receber webhooks. Configure o webhook no Meta Business Suite.',
          details: { 
            lastVerified: new Date().toISOString(),
            fields: []
          },
          missingFields: REQUIRED_FIELDS
        } as WebhookVerificationResult),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the first subscribed app and check its fields
    const subscribedApp = subscribedApps[0];
    const subscribedFields = subscribedApp.whatsapp_business_api_data?.fields || [];
    
    console.log('[verify-meta-webhook] Subscribed fields:', subscribedFields);

    // Check for missing required fields
    const missingFields = REQUIRED_FIELDS.filter(field => !subscribedFields.includes(field));

    let webhookStatus: 'active' | 'partial' | 'not_configured' = 'active';
    let message = '';

    if (subscribedFields.length === 0) {
      webhookStatus = 'not_configured';
      message = 'Webhook configurado, mas nenhum campo ativado. Ative o campo "messages" no Meta Business.';
    } else if (missingFields.length > 0) {
      webhookStatus = 'partial';
      message = `Webhook parcialmente configurado. Ative os campos: ${missingFields.join(', ')}`;
    } else {
      webhookStatus = 'active';
      message = `Webhook ativo e recebendo eventos: ${subscribedFields.join(', ')}`;
    }

    // Also check recent webhook events to confirm it's working
    const { count: recentEventsCount } = await supabaseClient
      .from('meta_webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (webhookStatus === 'active' && recentEventsCount === 0) {
      message += ' (Nenhum evento recebido nas últimas 24h - aguardando mensagens)';
    } else if (webhookStatus === 'active' && recentEventsCount && recentEventsCount > 0) {
      message += ` (${recentEventsCount} eventos nas últimas 24h)`;
    }

    const result: WebhookVerificationResult = {
      success: true,
      webhookStatus,
      details: {
        lastVerified: new Date().toISOString(),
        fields: subscribedFields,
        appInfo: subscribedApp.id ? {
          id: subscribedApp.id,
          name: subscribedApp.name || 'App Meta'
        } : undefined
      },
      missingFields,
      message
    };

    console.log('[verify-meta-webhook] Result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-meta-webhook] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        webhookStatus: 'error',
        message: 'Erro inesperado ao verificar webhook',
        details: { lastVerified: new Date().toISOString() },
        missingFields: []
      } as WebhookVerificationResult),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
