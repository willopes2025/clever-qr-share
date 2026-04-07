import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_TEMPLATES: Record<string, string> = {
  emitted: 'Olá {nome}! 😊 Sua cobrança de R${valor} foi gerada.\n\n📅 Vencimento: {data}\n🔗 Link para pagamento: {url}',
  before_5d: '⏰ Lembrete: sua cobrança de R${valor} vence em 5 dias ({data}).\n\n🔗 Link para pagamento: {url}',
  due_day: '📢 Hoje é o vencimento da sua cobrança de R${valor}. Evite juros!\n\n🔗 Pague agora: {url}',
  after_1d: '⚠️ Sua cobrança de R${valor} venceu ontem ({data}).\n\n🔗 Regularize aqui: {url}',
  after_3d: '⚠️ Cobrança de R${valor} em atraso há 3 dias (vencimento: {data}).\n\n🔗 Link para pagamento: {url}',
  after_5d: '🚨 Último lembrete: cobrança de R${valor} em atraso (vencimento: {data}).\n\nEntre em contato para regularizar.\n🔗 {url}',
};

function formatValue(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function buildMessage(type: string, name: string, value: number, dueDate: string, paymentUrl: string, customTemplates?: Record<string, string>): string {
  const templates = { ...DEFAULT_TEMPLATES, ...(customTemplates || {}) };
  const template = templates[type] || DEFAULT_TEMPLATES['emitted'];
  return template
    .replace('{nome}', name || 'Cliente')
    .replace(/\{valor\}/g, formatValue(value))
    .replace(/\{data\}/g, formatDate(dueDate))
    .replace(/\{url\}/g, paymentUrl || '');
}

async function fetchAllPayments(apiKey: string, baseUrl: string, minDate: string): Promise<any[]> {
  const allPayments: any[] = [];
  let offset = 0;
  const limit = 100;

  // Fetch PENDING and OVERDUE payments with dueDate >= minDate
  for (const status of ['PENDING', 'OVERDUE']) {
    offset = 0;
    let hasMore = true;
    while (hasMore) {
      const url = `${baseUrl}/payments?status=${status}&dueDate[ge]=${minDate}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { 'access_token': apiKey },
      });
      if (!res.ok) {
        console.error(`Error fetching payments: ${res.status}`);
        break;
      }
      const data = await res.json();
      allPayments.push(...(data.data || []));
      hasMore = data.hasMore === true;
      offset += limit;
    }
  }

  return allPayments;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    const settings = (integration.settings as Record<string, any>) || {};
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

    const billingTemplates = settings.billing_templates as Record<string, string> | undefined;
    const billingEnabledTypes = settings.billing_enabled_types as Record<string, boolean> | undefined;

    // Calculate minimum date: today - 5 days
    const now = new Date();
    const minDate = new Date(now);
    minDate.setDate(minDate.getDate() - 5);
    const minDateStr = minDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`Syncing billing reminders for user ${userId}, minDate: ${minDateStr}`);

    // Fetch all relevant payments from Asaas
    const payments = await fetchAllPayments(apiKey, baseUrl, minDateStr);
    console.log(`Found ${payments.length} payments within billing trail`);

    let totalRemindersCreated = 0;
    let paymentsProcessed = 0;
    let paymentsSkipped = 0;

    for (const payment of payments) {
      const { id: paymentId, customer: customerId, dueDate, value, billingType, invoiceUrl, bankSlipUrl } = payment;

      if (!dueDate || !value) {
        paymentsSkipped++;
        continue;
      }

      // Check if reminders already exist for this payment
      const { data: existingReminders } = await supabase
        .from('billing_reminders')
        .select('reminder_type')
        .eq('asaas_payment_id', paymentId)
        .neq('status', 'cancelled');

      const existingTypes = new Set((existingReminders || []).map(r => r.reminder_type));

      // Find contact by asaas_customer_id or phone
      let contactId: string | null = null;
      let conversationId: string | null = null;
      let contactName: string | null = null;

      // Try by asaas_customer_id first
      const { data: contactByAsaas } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('user_id', userId)
        .eq('asaas_customer_id', customerId)
        .limit(1)
        .maybeSingle();

      if (contactByAsaas) {
        contactId = contactByAsaas.id;
        contactName = contactByAsaas.name;
      } else {
        // Try to get customer phone from Asaas and find contact by phone
        try {
          const custRes = await fetch(`${baseUrl}/customers/${customerId}`, {
            headers: { 'access_token': apiKey },
          });
          if (custRes.ok) {
            const custData = await custRes.json();
            const phone = custData.mobilePhone || custData.phone;
            if (phone) {
              const normalizedPhone = phone.replace(/\D/g, '');
              const phoneVariants = [normalizedPhone];
              if (normalizedPhone.startsWith('55')) {
                phoneVariants.push(normalizedPhone.substring(2));
              } else {
                phoneVariants.push('55' + normalizedPhone);
              }

              const { data: contactByPhone } = await supabase
                .from('contacts')
                .select('id, name')
                .eq('user_id', userId)
                .in('phone', phoneVariants)
                .limit(1)
                .maybeSingle();

              if (contactByPhone) {
                contactId = contactByPhone.id;
                contactName = contactByPhone.name;
              }
            }
          }
        } catch (e) {
          console.error(`Error fetching customer ${customerId}:`, e);
        }
      }

      // Get conversation if contact found
      if (contactId) {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('user_id', userId)
          .order('last_message_at', { ascending: false })
          .limit(1);
        conversationId = convs?.[0]?.id || null;
      }

      const paymentUrl = invoiceUrl || bankSlipUrl || '';
      const due = new Date(dueDate + 'T10:00:00-03:00');

      const allReminders = [
        { type: 'emitted', date: new Date(due.getTime() - 10 * 24 * 60 * 60 * 1000) }, // approximate emission, use now for new
        { type: 'before_5d', date: new Date(due.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { type: 'due_day', date: new Date(due.getTime()) },
        { type: 'after_1d', date: new Date(due.getTime() + 1 * 24 * 60 * 60 * 1000) },
        { type: 'after_3d', date: new Date(due.getTime() + 3 * 24 * 60 * 60 * 1000) },
        { type: 'after_5d', date: new Date(due.getTime() + 5 * 24 * 60 * 60 * 1000) },
      ];

      // Filter: only future, enabled, and not already existing
      const remindersToCreate = allReminders.filter(r => {
        if (billingEnabledTypes && billingEnabledTypes[r.type] === false) return false;
        if (existingTypes.has(r.type)) return false;
        // Only schedule future reminders (skip 'emitted' for existing payments - it already happened)
        if (r.type === 'emitted') return false;
        return r.date > now;
      });

      if (remindersToCreate.length === 0) {
        paymentsSkipped++;
        continue;
      }

      const records = remindersToCreate.map(r => ({
        user_id: userId,
        contact_id: contactId,
        conversation_id: conversationId,
        asaas_payment_id: paymentId,
        asaas_customer_id: customerId,
        reminder_type: r.type,
        scheduled_for: r.date.toISOString(),
        status: 'pending',
        message_content: buildMessage(r.type, contactName || '', value, dueDate, paymentUrl, billingTemplates),
        due_date: dueDate,
        value,
        billing_type: billingType,
        invoice_url: invoiceUrl,
        bank_slip_url: bankSlipUrl,
      }));

      const { error: insertError } = await supabase
        .from('billing_reminders')
        .insert(records);

      if (insertError) {
        console.error(`Error inserting reminders for payment ${paymentId}:`, insertError);
      } else {
        totalRemindersCreated += records.length;
        paymentsProcessed++;
      }
    }

    console.log(`Sync complete: ${totalRemindersCreated} reminders created for ${paymentsProcessed} payments, ${paymentsSkipped} skipped`);

    return new Response(JSON.stringify({
      success: true,
      totalPayments: payments.length,
      paymentsProcessed,
      paymentsSkipped,
      remindersCreated: totalRemindersCreated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
