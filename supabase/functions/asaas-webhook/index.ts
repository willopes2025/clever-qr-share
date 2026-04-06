import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

// Default message templates (fallback)
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id');

    if (!userId) {
      console.error('Missing user_id in webhook URL');
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    console.log('Asaas webhook received:', { userId, event: body.event, paymentId: body.payment?.id });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the integration to verify it exists and read settings
    const { data: integration, error: integrationError } = await supabaseClient
      .from('integrations')
      .select('id, settings')
      .eq('user_id', userId)
      .eq('provider', 'asaas')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('Integration not found for user:', userId);
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Read billing reminder settings
    const settings = (integration.settings as Record<string, any>) || {};
    const billingEnabled = settings.billing_reminders_enabled === true;
    const billingTemplates = settings.billing_templates as Record<string, string> | undefined;
    const billingEnabledTypes = settings.billing_enabled_types as Record<string, boolean> | undefined;
    const billingMetaPhoneNumberId = settings.billing_meta_phone_number_id as string | undefined;

    // Process the webhook event
    const { event, payment, subscription, transfer } = body;

    // Update last_sync_at
    await supabaseClient
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Helper function to update contact payment status
    const updateContactPaymentStatus = async (customerId: string, status: 'overdue' | 'pending' | 'current' | null) => {
      if (!customerId) return;
      
      const { data: contacts, error: contactError } = await supabaseClient
        .from('contacts')
        .select('id, asaas_customer_id')
        .eq('asaas_customer_id', customerId);
      
      if (contactError) {
        console.error('Error finding contact:', contactError);
        return;
      }

      if (contacts && contacts.length > 0) {
        for (const contact of contacts) {
          await supabaseClient
            .from('contacts')
            .update({ asaas_payment_status: status })
            .eq('id', contact.id);
          console.log(`Updated contact ${contact.id} payment status to ${status}`);
        }
      } else {
        console.log('No contact found for Asaas customer:', customerId);
      }
    };

    // Helper to find contact and conversation for a customer
    const findContactAndConversation = async (customerId: string): Promise<{ contactId: string | null; conversationId: string | null; contactName: string | null }> => {
      if (!customerId) return { contactId: null, conversationId: null, contactName: null };

      const { data: contacts } = await supabaseClient
        .from('contacts')
        .select('id, name')
        .eq('asaas_customer_id', customerId)
        .eq('user_id', userId);

      if (!contacts || contacts.length === 0) return { contactId: null, conversationId: null, contactName: null };

      const contact = contacts[0];

      const { data: conversations } = await supabaseClient
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(1);

      return {
        contactId: contact.id,
        conversationId: conversations?.[0]?.id || null,
        contactName: contact.name,
      };
    };

    // Helper to schedule billing reminders
    const scheduleBillingReminders = async (paymentData: any) => {
      if (!billingEnabled) {
        console.log('Billing reminders disabled for user, skipping');
        return;
      }

      if (!paymentData) return;

      const { id: paymentId, customer: customerId, dueDate, value, billingType, invoiceUrl, bankSlipUrl } = paymentData;
      
      if (!dueDate || !value) {
        console.log('Missing dueDate or value in payment, skipping reminders');
        return;
      }

      const { contactId, conversationId, contactName } = await findContactAndConversation(customerId);

      const paymentUrl = invoiceUrl || bankSlipUrl || '';

      const due = new Date(dueDate + 'T10:00:00-03:00');
      const now = new Date();

      const allReminders = [
        { type: 'emitted', date: now },
        { type: 'before_5d', date: new Date(due.getTime() - 5 * 24 * 60 * 60 * 1000) },
        { type: 'due_day', date: new Date(due.getTime()) },
        { type: 'after_1d', date: new Date(due.getTime() + 1 * 24 * 60 * 60 * 1000) },
        { type: 'after_3d', date: new Date(due.getTime() + 3 * 24 * 60 * 60 * 1000) },
        { type: 'after_5d', date: new Date(due.getTime() + 5 * 24 * 60 * 60 * 1000) },
      ];

      // Filter by enabled types
      const reminders = allReminders
        .filter(r => {
          if (billingEnabledTypes && billingEnabledTypes[r.type] === false) return false;
          return r.date >= now || r.type === 'emitted';
        });

      const reminderRecords = reminders.map(r => ({
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

      if (reminderRecords.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('billing_reminders')
          .insert(reminderRecords);

        if (insertError) {
          console.error('Error inserting billing reminders:', insertError);
        } else {
          console.log(`Scheduled ${reminderRecords.length} billing reminders for payment ${paymentId}`);
        }
      }
    };

    // Helper to cancel pending reminders
    const cancelPendingReminders = async (paymentId: string) => {
      const { error, count } = await supabaseClient
        .from('billing_reminders')
        .update({ status: 'cancelled' })
        .eq('asaas_payment_id', paymentId)
        .eq('status', 'pending');

      if (error) {
        console.error('Error cancelling reminders:', error);
      } else {
        console.log(`Cancelled pending reminders for payment ${paymentId}, count: ${count}`);
      }
    };

    // Handle different event types
    switch (event) {
      case 'PAYMENT_CREATED':
        console.log('Payment created:', payment?.id);
        if (payment?.customer) {
          await updateContactPaymentStatus(payment.customer, 'pending');
        }
        await scheduleBillingReminders(payment);
        break;

      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
      case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
        console.log('Payment event:', event, payment?.id);
        break;

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_RECEIVED_IN_CASH':
        console.log('Payment confirmed/received:', payment?.id, payment?.value);
        if (payment?.customer) {
          await updateContactPaymentStatus(payment.customer, 'current');
        }
        if (payment?.id) {
          await cancelPendingReminders(payment.id);
        }
        break;

      case 'PAYMENT_OVERDUE':
        console.log('Payment overdue:', payment?.id);
        if (payment?.customer) {
          await updateContactPaymentStatus(payment.customer, 'overdue');
        }
        break;

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_IN_PROGRESS':
        console.log('Payment refunded:', payment?.id);
        if (payment?.id) {
          await cancelPendingReminders(payment.id);
        }
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_RESTORED':
      case 'PAYMENT_ANTICIPATED':
        console.log('Payment event:', event, payment?.id);
        if (event === 'PAYMENT_DELETED' && payment?.id) {
          await cancelPendingReminders(payment.id);
        }
        break;

      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_DELETED':
      case 'SUBSCRIPTION_RENEWED':
        console.log('Subscription event:', event, subscription?.id);
        break;

      case 'TRANSFER_CREATED':
      case 'TRANSFER_PENDING':
      case 'TRANSFER_IN_BANK_PROCESSING':
      case 'TRANSFER_DONE':
      case 'TRANSFER_CANCELLED':
      case 'TRANSFER_FAILED':
        console.log('Transfer event:', event, transfer?.id);
        break;

      default:
        console.log('Unhandled Asaas event:', event);
    }

    console.log('Webhook processed successfully:', { event, userId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing Asaas webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
