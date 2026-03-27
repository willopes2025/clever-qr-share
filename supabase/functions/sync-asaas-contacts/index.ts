import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_SANDBOX_URL = 'https://sandbox.asaas.com/api/v3';

interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj?: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  status: string;
  dueDate: string;
  value: number;
}

function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
}

async function fetchAllPaginated<T>(baseUrl: string, endpoint: string, apiKey: string, maxRecords = 5000): Promise<T[]> {
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
    results.push(...(data.data || []));

    if (!data.hasMore || (data.data || []).length === 0) break;
    offset += limit;
  }

  return results;
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

    // Determine which users to sync
    let usersToSync: string[] = [];
    
    if (userId) {
      // Check if user is part of an org - use the org owner's integration
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
        if (org?.owner_id) {
          usersToSync = [org.owner_id];
        }
      } else {
        usersToSync = [userId];
      }
    } else {
      const { data: integrations } = await supabase
        .from('integrations')
        .select('user_id')
        .eq('provider', 'asaas')
        .eq('is_active', true);
      usersToSync = integrations?.map(i => i.user_id) || [];
    }

    console.log(`[sync-asaas] Syncing for ${usersToSync.length} users`);

    const results = [];

    for (const syncUserId of usersToSync) {
      try {
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', syncUserId)
          .eq('provider', 'asaas')
          .eq('is_active', true)
          .single();

        if (integrationError || !integration) {
          console.log(`[sync-asaas] No active Asaas integration for user ${syncUserId}`);
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_integration' });
          continue;
        }

        const settings = integration.settings as { apiKey?: string; environment?: string } || {};
        const apiKey = settings.apiKey;
        const environment = settings.environment || 'production';

        if (!apiKey) {
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_api_key' });
          continue;
        }

        const baseUrl = environment === 'sandbox' ? ASAAS_SANDBOX_URL : ASAAS_API_URL;

        // Fetch customers and overdue/pending payments in parallel (batch approach)
        console.log(`[sync-asaas] Fetching customers and payments for user ${syncUserId}...`);
        
        const [customers, overduePayments, pendingPayments] = await Promise.all([
          fetchAllPaginated<AsaasCustomer>(baseUrl, 'customers', apiKey),
          fetchAllPaginated<AsaasPayment>(baseUrl, 'payments?status=OVERDUE', apiKey),
          fetchAllPaginated<AsaasPayment>(baseUrl, 'payments?status=PENDING', apiKey),
        ]);

        console.log(`[sync-asaas] Found ${customers.length} customers, ${overduePayments.length} overdue, ${pendingPayments.length} pending`);

        // Build customer payment status map
        const customerStatusMap = new Map<string, 'overdue' | 'pending' | 'current'>();
        
        // Mark overdue customers first (highest priority)
        for (const payment of overduePayments) {
          customerStatusMap.set(payment.customer, 'overdue');
        }
        
        // Mark pending customers (only if not already overdue)
        for (const payment of pendingPayments) {
          if (!customerStatusMap.has(payment.customer)) {
            customerStatusMap.set(payment.customer, 'pending');
          }
        }

        // Get all org member user IDs to match contacts
        const { data: orgMembers } = await supabase.rpc('get_organization_member_ids', { _user_id: syncUserId });
        const memberIds = orgMembers || [syncUserId];

        // Fetch contacts for this user/org
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, phone, asaas_customer_id')
          .in('user_id', memberIds);

        if (!contacts || contacts.length === 0) {
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_contacts' });
          continue;
        }

        // Create phone lookup map for contacts
        const phoneToContact = new Map<string, { id: string; asaas_customer_id: string | null }>();
        const asaasIdToContact = new Map<string, string>();
        
        for (const contact of contacts) {
          const normalizedPhone = normalizePhone(contact.phone);
          if (normalizedPhone) {
            phoneToContact.set(normalizedPhone, { id: contact.id, asaas_customer_id: contact.asaas_customer_id });
          }
          if (contact.asaas_customer_id) {
            asaasIdToContact.set(contact.asaas_customer_id, contact.id);
          }
        }

        // Batch updates
        const updates: { id: string; asaas_customer_id: string; asaas_payment_status: string }[] = [];

        for (const customer of customers) {
          // Try matching by existing asaas_customer_id first, then by phone
          let contactId = asaasIdToContact.get(customer.id);
          
          if (!contactId) {
            const phoneToCheck = normalizePhone(customer.mobilePhone) || normalizePhone(customer.phone);
            if (phoneToCheck) {
              const matched = phoneToContact.get(phoneToCheck);
              if (matched) {
                contactId = matched.id;
              }
            }
          }

          if (contactId) {
            const paymentStatus = customerStatusMap.get(customer.id) || 'current';
            updates.push({
              id: contactId,
              asaas_customer_id: customer.id,
              asaas_payment_status: paymentStatus,
            });
          }
        }

        // Execute updates in batches of 50
        let updatedCount = 0;
        const batchSize = 50;
        
        for (let i = 0; i < updates.length; i += batchSize) {
          const batch = updates.slice(i, i + batchSize);
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

        console.log(`[sync-asaas] User ${syncUserId}: updated ${updatedCount}/${updates.length} contacts`);
        results.push({
          userId: syncUserId,
          status: 'success',
          customersFound: customers.length,
          updatedCount,
        });

      } catch (error) {
        console.error(`[sync-asaas] Error syncing user ${syncUserId}:`, error);
        results.push({
          userId: syncUserId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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
