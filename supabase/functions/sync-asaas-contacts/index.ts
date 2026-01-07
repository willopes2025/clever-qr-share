import { createClient } from "npm:@supabase/supabase-js@2";
// Using Deno.serve to avoid extra std/http bundle time

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

// Normalize phone number for matching
function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  // If starts with 55 (Brazil) and has more than 11 digits, remove the country code
  if (digits.startsWith('55') && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
}

// Determine payment status based on Asaas payments
function determinePaymentStatus(payments: AsaasPayment[]): 'overdue' | 'pending' | 'current' {
  const hasOverdue = payments.some(p => p.status === 'OVERDUE');
  if (hasOverdue) return 'overdue';
  
  const hasPending = payments.some(p => ['PENDING', 'AWAITING_RISK_ANALYSIS'].includes(p.status));
  if (hasPending) return 'pending';
  
  return 'current';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user_id from request body or auth header
    let userId: string | null = null;
    
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    // If no user from auth, try request body (for cron jobs)
    if (!userId) {
      try {
        const body = await req.json();
        userId = body.userId;
      } catch {
        // No body provided
      }
    }

    // If still no userId, sync all users with active Asaas integration
    let usersToSync: string[] = [];
    
    if (userId) {
      usersToSync = [userId];
    } else {
      // Get all users with active Asaas integration
      const { data: integrations } = await supabase
        .from('integrations')
        .select('user_id')
        .eq('provider', 'asaas')
        .eq('is_active', true);
      
      usersToSync = integrations?.map(i => i.user_id) || [];
    }

    console.log(`Syncing Asaas contacts for ${usersToSync.length} users`);

    const results = [];

    for (const syncUserId of usersToSync) {
      try {
        // Fetch Asaas integration settings for this user
        const { data: integration, error: integrationError } = await supabase
          .from('integrations')
          .select('*')
          .eq('user_id', syncUserId)
          .eq('provider', 'asaas')
          .eq('is_active', true)
          .single();

        if (integrationError || !integration) {
          console.log(`No active Asaas integration for user ${syncUserId}`);
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_integration' });
          continue;
        }

        const settings = integration.settings as { apiKey?: string; environment?: string } || {};
        const apiKey = settings.apiKey;
        const environment = settings.environment || 'production';

        if (!apiKey) {
          console.log(`No API key configured for user ${syncUserId}`);
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_api_key' });
          continue;
        }

        const baseUrl = environment === 'sandbox' ? ASAAS_SANDBOX_URL : ASAAS_API_URL;

        // Fetch all customers from Asaas
        const customers: AsaasCustomer[] = [];
        let offset = 0;
        const limit = 100;

        while (true) {
          const response = await fetch(`${baseUrl}/customers?offset=${offset}&limit=${limit}`, {
            headers: { 'access_token': apiKey }
          });

          if (!response.ok) {
            throw new Error(`Asaas API error: ${response.status}`);
          }

          const data = await response.json();
          customers.push(...(data.data || []));

          if (!data.hasMore) break;
          offset += limit;
        }

        console.log(`Found ${customers.length} customers in Asaas for user ${syncUserId}`);

        // Fetch all contacts for this user
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, phone, asaas_customer_id')
          .eq('user_id', syncUserId);

        if (!contacts || contacts.length === 0) {
          results.push({ userId: syncUserId, status: 'skipped', reason: 'no_contacts' });
          continue;
        }

        // Create phone lookup map
        const phoneToContact = new Map<string, { id: string; asaas_customer_id: string | null }>();
        for (const contact of contacts) {
          const normalizedPhone = normalizePhone(contact.phone);
          if (normalizedPhone) {
            phoneToContact.set(normalizedPhone, { 
              id: contact.id, 
              asaas_customer_id: contact.asaas_customer_id 
            });
          }
        }

        let linkedCount = 0;
        let updatedCount = 0;

        // Process each Asaas customer
        for (const customer of customers) {
          // Try to match by phone or mobilePhone
          const phoneToCheck = normalizePhone(customer.mobilePhone) || normalizePhone(customer.phone);
          
          if (!phoneToCheck) continue;

          const matchedContact = phoneToContact.get(phoneToCheck);
          
          if (matchedContact) {
            // Fetch payments for this customer
            const paymentsResponse = await fetch(
              `${baseUrl}/payments?customer=${customer.id}&status=PENDING,OVERDUE,AWAITING_RISK_ANALYSIS&limit=50`,
              { headers: { 'access_token': apiKey } }
            );

            let paymentStatus: 'overdue' | 'pending' | 'current' = 'current';
            
            if (paymentsResponse.ok) {
              const paymentsData = await paymentsResponse.json();
              paymentStatus = determinePaymentStatus(paymentsData.data || []);
            }

            // Update contact with Asaas link and payment status
            const needsUpdate = matchedContact.asaas_customer_id !== customer.id;
            
            const { error: updateError } = await supabase
              .from('contacts')
              .update({
                asaas_customer_id: customer.id,
                asaas_payment_status: paymentStatus
              })
              .eq('id', matchedContact.id);

            if (!updateError) {
              if (needsUpdate) linkedCount++;
              updatedCount++;
            }
          }
        }

        // Update last_sync_at
        await supabase
          .from('integrations')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', integration.id);

        console.log(`User ${syncUserId}: linked ${linkedCount} new contacts, updated ${updatedCount} payment statuses`);
        results.push({ 
          userId: syncUserId, 
          status: 'success', 
          customersFound: customers.length,
          linkedCount, 
          updatedCount 
        });

      } catch (error) {
        console.error(`Error syncing user ${syncUserId}:`, error);
        results.push({ 
          userId: syncUserId, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
