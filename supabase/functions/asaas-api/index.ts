import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // User-level client for authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing backend environment variables', {
        hasUrl: Boolean(supabaseUrl),
        hasAnonKey: Boolean(supabaseAnonKey),
        hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
      });
      return new Response(JSON.stringify({ error: 'Backend not configured (missing env vars)' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    // Service role client for reading integrations (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine integrationOwnerId - who owns the Asaas integration
    let integrationOwnerId = user.id;
    let isMember = false;
    let memberPermissions: Record<string, boolean> | null = null;

    // First try the user's own integration
    const { data: ownIntegration } = await supabaseAdmin
      .from('integrations')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('provider', 'asaas')
      .eq('is_active', true)
      .single();

    if (!ownIntegration) {
      // User doesn't have their own Asaas integration, check if they're a team member
      const { data: teamMember } = await supabaseAdmin
        .from('team_members')
        .select('organization_id, permissions, role')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (teamMember?.organization_id) {
        isMember = true;
        memberPermissions = teamMember.permissions as Record<string, boolean> | null;
        const memberRole = teamMember.role as string | null;
        const isAdmin = memberRole === 'admin';

        // Check if member has permission to view finances (admins have all permissions)
        if (!isAdmin && !memberPermissions?.view_finances) {
          console.error('Member does not have view_finances permission');
          return new Response(JSON.stringify({ error: 'Permissão negada: acesso ao financeiro não autorizado' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log(`User ${user.id} access granted: isAdmin=${isAdmin}, hasViewFinances=${memberPermissions?.view_finances}`);

        // Get the organization owner
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('owner_id')
          .eq('id', teamMember.organization_id)
          .single();

        if (org?.owner_id) {
          integrationOwnerId = org.owner_id;
          console.log('Using org owner integration:', integrationOwnerId);
        }
      }
    }

    // Get Asaas credentials from integrations table using integrationOwnerId
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('credentials')
      .eq('user_id', integrationOwnerId)
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

    console.log(`Asaas API action: ${action}`, { userId: user.id, integrationOwnerId, isMember });

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
      
      // Verificar Content-Type antes de fazer parse
      const contentType = response.headers.get('content-type') || '';
      
      // Se retornar HTML, significa erro do servidor (403, 404, etc)
      if (contentType.includes('text/html') || (!contentType.includes('application/json') && !response.ok)) {
        console.error(`Asaas returned non-JSON response. Status: ${response.status}, Content-Type: ${contentType}`);
        
        // Verificar se é endpoint de negativação
        if (endpoint.includes('/negativations')) {
          throw new Error('NEGATIVATION_NOT_ENABLED: Funcionalidade de negativação não habilitada. Contate seu gerente de conta Asaas para solicitar acesso.');
        }
        
        throw new Error(`Erro do servidor Asaas (status ${response.status}). Verifique suas credenciais e permissões.`);
      }
      
      const responseData = await response.json();

      if (!response.ok) {
        console.error('Asaas API error:', responseData);
        throw new Error(responseData.errors?.[0]?.description || 'Asaas API error');
      }

      return responseData;
    };

    // Função para buscar todas as páginas de uma entidade
    const fetchAllPages = async (endpoint: string, filters: string = '') => {
      const allData: unknown[] = [];
      let offset = 0;
      let hasMore = true;
      const pageLimit = 100;
      let totalFetched = 0;
      
      console.log(`Starting full pagination for ${endpoint}${filters}`);
      
      while (hasMore) {
        const response = await asaasRequest('GET', 
          `${endpoint}?limit=${pageLimit}&offset=${offset}${filters}`);
        
        const pageData = response.data || [];
        allData.push(...pageData);
        totalFetched += pageData.length;
        hasMore = response.hasMore === true;
        offset += pageLimit;
        
        console.log(`Fetched ${totalFetched} records from ${endpoint}...`);
        
        // Safety: evitar loops infinitos (máximo 50 páginas = 5000 registros)
        if (offset >= 5000) {
          console.log(`Reached safety limit of 5000 records for ${endpoint}`);
          break;
        }
      }
      
      console.log(`Finished fetching ${allData.length} total records from ${endpoint}`);
      
      return { 
        data: allData, 
        totalCount: allData.length,
        fetchedAt: new Date().toISOString()
      };
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
      case 'list-all-customers':
        result = await fetchAllPages('/customers');
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
      case 'list-all-payments':
        let paymentFilters = '';
        if (params.status) paymentFilters += `&status=${params.status}`;
        if (params.customer) paymentFilters += `&customer=${params.customer}`;
        if (params.billingType) paymentFilters += `&billingType=${params.billingType}`;
        if (params.dueDateGe) paymentFilters += `&dueDate[ge]=${params.dueDateGe}`;
        if (params.dueDateLe) paymentFilters += `&dueDate[le]=${params.dueDateLe}`;
        result = await fetchAllPages('/payments', paymentFilters);
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
      case 'list-all-subscriptions':
        result = await fetchAllPages('/subscriptions');
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

      // Negativations (Serasa)
      case 'list-negativations':
        result = await asaasRequest('GET', `/negativations?limit=${params.limit || 100}&offset=${params.offset || 0}`);
        break;
      case 'create-negativation':
        result = await asaasRequest('POST', '/negativations', {
          payment: params.paymentId,
          description: params.description
        });
        break;
      case 'cancel-negativation':
        result = await asaasRequest('DELETE', `/negativations/${params.id}`);
        break;
      case 'get-negativation':
        result = await asaasRequest('GET', `/negativations/${params.id}`);
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
