import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_SANDBOX_URL = 'https://api-sandbox.asaas.com/v3';

interface AsaasPayment {
  id: string;
  customer: string;
  status: string;
  dueDate: string;
  value: number;
}

interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
}

function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Remove country code 55
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

// Also try without the 9th digit (some contacts may have 8-digit mobile)
function phoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  const variants = [normalized];
  // If has 11 digits (DDD + 9 + 8 digits), also try without the 9
  if (normalized.length === 11 && normalized[2] === '9') {
    variants.push(normalized.slice(0, 2) + normalized.slice(3));
  }
  // If has 10 digits, also try with 9 added
  if (normalized.length === 10) {
    variants.push(normalized.slice(0, 2) + '9' + normalized.slice(2));
  }
  return variants;
}

async function fetchAllPaginated<T>(baseUrl: string, endpoint: string, apiKey: string, maxRecords = 10000): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  const limit = 100;

  while (results.length < maxRecords) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseUrl}/${endpoint}${separator}offset=${offset}&limit=${limit}`;
    const response = await fetch(url, {
      headers: { 'access_token': apiKey }
    });

    if (!response.ok) {
      console.error(`API error for ${endpoint}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const items = data.data || [];
    results.push(...items);

    console.log(`Fetched ${results.length} records from /${endpoint.split('?')[0]}...`);

    if (!data.hasMore || items.length === 0) {
      console.log(`Finished fetching ${results.length} total records from /${endpoint.split('?')[0]}`);
      break;
    }
    offset += limit;
  }

  if (results.length >= maxRecords) {
    console.log(`Reached safety limit of ${maxRecords} records for /${endpoint.split('?')[0]}`);
  }

  return results;
}

async function fetchCustomerById(baseUrl: string, customerId: string, apiKey: string): Promise<AsaasCustomer | null> {
  try {
    const response = await fetch(`${baseUrl}/customers/${customerId}`, {
      headers: { 'access_token': apiKey }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | null = null;
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    if (!userId) {
      try {
        const body = await req.json();
        userId = body.userId;
      } catch {
        // No body
      }
    }

    // Determine which user's integration to use
    let syncUserId: string | null = null;
    
    if (userId) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (teamMember?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', teamMember.organization_id)
          .single();
        syncUserId = org?.owner_id || userId;
      } else {
        syncUserId = userId;
      }
    }

    if (!syncUserId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', syncUserId)
      .eq('provider', 'asaas')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active Asaas integration' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials = (integration.credentials ?? {}) as { access_token?: string; environment?: string };
    const settings = (integration.settings ?? {}) as { apiKey?: string; environment?: string };
    const apiKey = credentials.access_token ?? settings.apiKey;
    const environment = credentials.environment ?? settings.environment ?? 'production';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'No API key configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = environment === 'sandbox' ? ASAAS_SANDBOX_URL : ASAAS_API_URL;

    // STEP 1: Fetch only OVERDUE and PENDING payments (much fewer than all customers)
    console.log(`[sync-asaas] Fetching overdue and pending payments...`);
    
    const [overduePayments, pendingPayments] = await Promise.all([
      fetchAllPaginated<AsaasPayment>(baseUrl, 'payments?status=OVERDUE', apiKey),
      fetchAllPaginated<AsaasPayment>(baseUrl, 'payments?status=PENDING', apiKey),
    ]);

    console.log(`[sync-asaas] Found ${overduePayments.length} overdue, ${pendingPayments.length} pending payments`);

    // STEP 2: Build customer status map (overdue takes priority)
    const customerStatusMap = new Map<string, 'overdue' | 'pending'>();
    
    for (const payment of overduePayments) {
      customerStatusMap.set(payment.customer, 'overdue');
    }
    for (const payment of pendingPayments) {
      if (!customerStatusMap.has(payment.customer)) {
        customerStatusMap.set(payment.customer, 'pending');
      }
    }

    const uniqueCustomerIds = Array.from(customerStatusMap.keys());
    console.log(`[sync-asaas] ${uniqueCustomerIds.length} unique customers with overdue/pending payments`);

    // STEP 3: Get all contacts for this org
    const { data: orgMembers } = await supabase.rpc('get_organization_member_ids', { _user_id: syncUserId });
    const memberIds = orgMembers || [syncUserId];

    // Fetch ALL contacts (no limit - use service role)
    let allContacts: any[] = [];
    let contactOffset = 0;
    const contactBatchSize = 1000;
    
    while (true) {
      const { data: batch } = await supabase
        .from('contacts')
        .select('id, phone, asaas_customer_id')
        .in('user_id', memberIds)
        .range(contactOffset, contactOffset + contactBatchSize - 1);
      
      if (!batch || batch.length === 0) break;
      allContacts.push(...batch);
      if (batch.length < contactBatchSize) break;
      contactOffset += contactBatchSize;
    }

    console.log(`[sync-asaas] Loaded ${allContacts.length} contacts from database`);

    if (allContacts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No contacts found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 4: Build phone lookup maps for contacts
    const phoneToContactId = new Map<string, string>();
    const asaasIdToContactId = new Map<string, string>();
    
    for (const contact of allContacts) {
      if (contact.asaas_customer_id) {
        asaasIdToContactId.set(contact.asaas_customer_id, contact.id);
      }
      const variants = phoneVariants(contact.phone);
      for (const v of variants) {
        phoneToContactId.set(v, contact.id);
      }
    }

    // STEP 5: Match customers to contacts
    // First, try matching by asaas_customer_id (fast, no API call needed)
    const matchedUpdates: { id: string; asaas_customer_id: string; asaas_payment_status: 'overdue' | 'pending' }[] = [];
    const unmatchedCustomerIds: string[] = [];

    for (const customerId of uniqueCustomerIds) {
      const contactId = asaasIdToContactId.get(customerId);
      if (contactId) {
        matchedUpdates.push({
          id: contactId,
          asaas_customer_id: customerId,
          asaas_payment_status: customerStatusMap.get(customerId)!,
        });
      } else {
        unmatchedCustomerIds.push(customerId);
      }
    }

    console.log(`[sync-asaas] Matched ${matchedUpdates.length} by asaas_customer_id, ${unmatchedCustomerIds.length} need phone lookup`);

    // STEP 6: For unmatched, fetch customers in bulk and match by phone
    const asaasCustomers = await fetchAllPaginated<AsaasCustomer>(baseUrl, 'customers', apiKey, 10000);
    const unmatchedCustomerIdSet = new Set(unmatchedCustomerIds);

    for (const customer of asaasCustomers) {
      if (!unmatchedCustomerIdSet.has(customer.id)) continue;

      const phonesToTry = [
        ...phoneVariants(customer.mobilePhone),
        ...phoneVariants(customer.phone),
      ];

      let contactId: string | undefined;
      for (const phone of phonesToTry) {
        contactId = phoneToContactId.get(phone);
        if (contactId) break;
      }

      if (contactId) {
        matchedUpdates.push({
          id: contactId,
          asaas_customer_id: customer.id,
          asaas_payment_status: customerStatusMap.get(customer.id)!,
        });
      }
    }

    console.log(`[sync-asaas] Total matched: ${matchedUpdates.length}`);

    // STEP 7: First, reset all contacts to 'current' that were previously marked
    // This ensures contacts that are no longer overdue get cleared
    await supabase
      .from('contacts')
      .update({ asaas_payment_status: null })
      .in('user_id', memberIds)
      .not('asaas_payment_status', 'is', null);

    // STEP 8: Apply updates in batches
    let updatedCount = 0;
    const updateBatchSize = 50;
    
    for (let i = 0; i < matchedUpdates.length; i += updateBatchSize) {
      const batch = matchedUpdates.slice(i, i + updateBatchSize);
      const promises = batch.map(update =>
        supabase
          .from('contacts')
          .update({
            asaas_customer_id: update.asaas_customer_id,
            asaas_payment_status: update.asaas_payment_status,
          })
          .eq('id', update.id)
      );
      
      const results = await Promise.all(promises);
      updatedCount += results.filter(r => !r.error).length;
    }

    // Update last_sync_at
    await supabase
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    console.log(`[sync-asaas] Completed: updated ${updatedCount}/${matchedUpdates.length} contacts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        overduePayments: overduePayments.length,
        pendingPayments: pendingPayments.length,
        uniqueCustomers: uniqueCustomerIds.length,
        totalContacts: allContacts.length,
        matchedByAsaasId: matchedUpdates.length - unmatchedCustomerIds.length + (unmatchedCustomerIds.length - unmatchedCustomerIds.length),
        totalMatched: matchedUpdates.length,
        updatedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-asaas] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
