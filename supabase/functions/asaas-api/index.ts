import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Asaas credentials from integrations table
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('provider', 'asaas')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found:', integrationError);
      return new Response(JSON.stringify({ error: 'Asaas integration not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const credentials = integration.credentials as Record<string, string>;
    const accessToken = credentials?.access_token;
    const environment = credentials?.environment || 'production';

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Asaas API key not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const baseUrl = environment === 'sandbox' ? ASAAS_SANDBOX_URL : ASAAS_API_URL;

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`Asaas API action: ${action}`, { userId: user.id });

    const asaasRequest = async (method: string, endpoint: string, data?: unknown) => {
      const url = `${baseUrl}${endpoint}`;
      console.log(`Asaas request: ${method} ${url}`);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken,
        },
      };

      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        console.error('Asaas API error:', responseData);
        throw new Error(responseData.errors?.[0]?.description || 'Asaas API error');
      }

      return responseData;
    };

    let result;

    switch (action) {
      // Balance
      case 'get-balance':
        result = await asaasRequest('GET', '/finance/balance');
        break;

      // Customers
      case 'list-customers':
        result = await asaasRequest('GET', `/customers?limit=${params.limit || 100}&offset=${params.offset || 0}`);
        break;
      case 'get-customer':
        result = await asaasRequest('GET', `/customers/${params.id}`);
        break;
      case 'create-customer':
        result = await asaasRequest('POST', '/customers', params.customer);
        break;
      case 'update-customer':
        result = await asaasRequest('PUT', `/customers/${params.id}`, params.customer);
        break;
      case 'delete-customer':
        result = await asaasRequest('DELETE', `/customers/${params.id}`);
        break;

      // Payments
      case 'list-payments':
        let paymentsEndpoint = `/payments?limit=${params.limit || 100}&offset=${params.offset || 0}`;
        if (params.customer) paymentsEndpoint += `&customer=${params.customer}`;
        if (params.status) paymentsEndpoint += `&status=${params.status}`;
        result = await asaasRequest('GET', paymentsEndpoint);
        break;
      case 'get-payment':
        result = await asaasRequest('GET', `/payments/${params.id}`);
        break;
      case 'create-payment':
        result = await asaasRequest('POST', '/payments', params.payment);
        break;
      case 'delete-payment':
        result = await asaasRequest('DELETE', `/payments/${params.id}`);
        break;
      case 'refund-payment':
        result = await asaasRequest('POST', `/payments/${params.id}/refund`, {
          value: params.value,
          description: params.description
        });
        break;
      case 'get-pix-qrcode':
        result = await asaasRequest('GET', `/payments/${params.id}/pixQrCode`);
        break;
      case 'get-boleto':
        result = await asaasRequest('GET', `/payments/${params.id}/identificationField`);
        break;

      // Subscriptions
      case 'list-subscriptions':
        result = await asaasRequest('GET', `/subscriptions?limit=${params.limit || 100}&offset=${params.offset || 0}`);
        break;
      case 'get-subscription':
        result = await asaasRequest('GET', `/subscriptions/${params.id}`);
        break;
      case 'create-subscription':
        result = await asaasRequest('POST', '/subscriptions', params.subscription);
        break;
      case 'update-subscription':
        result = await asaasRequest('PUT', `/subscriptions/${params.id}`, params.subscription);
        break;
      case 'delete-subscription':
        result = await asaasRequest('DELETE', `/subscriptions/${params.id}`);
        break;
      case 'list-subscription-payments':
        result = await asaasRequest('GET', `/subscriptions/${params.id}/payments`);
        break;

      // Transfers
      case 'list-transfers':
        result = await asaasRequest('GET', `/transfers?limit=${params.limit || 100}&offset=${params.offset || 0}`);
        break;
      case 'create-transfer':
        result = await asaasRequest('POST', '/transfers', params.transfer);
        break;

      // PIX
      case 'list-pix-keys':
        result = await asaasRequest('GET', '/pix/addressKeys');
        break;
      case 'list-pix-transactions':
        result = await asaasRequest('GET', `/pix/transactions?limit=${params.limit || 100}`);
        break;
      case 'decode-pix-qrcode':
        result = await asaasRequest('POST', '/pix/qrCodes/decode', { payload: params.payload });
        break;

      // Payment Links
      case 'list-payment-links':
        result = await asaasRequest('GET', `/paymentLinks?limit=${params.limit || 100}`);
        break;
      case 'get-payment-link':
        result = await asaasRequest('GET', `/paymentLinks/${params.id}`);
        break;
      case 'create-payment-link':
        result = await asaasRequest('POST', '/paymentLinks', params.paymentLink);
        break;
      case 'delete-payment-link':
        result = await asaasRequest('DELETE', `/paymentLinks/${params.id}`);
        break;

      // Financial Statement
      case 'get-statement':
        result = await asaasRequest('GET', `/financialTransactions?limit=${params.limit || 100}`);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in asaas-api:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
