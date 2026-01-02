import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

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

    // Get the integration to verify it exists
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

    // Process the webhook event
    const { event, payment, subscription, transfer } = body;

    // Update last_sync_at
    await supabaseClient
      .from('integrations')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Handle different event types
    switch (event) {
      case 'PAYMENT_CREATED':
      case 'PAYMENT_AWAITING_RISK_ANALYSIS':
      case 'PAYMENT_APPROVED_BY_RISK_ANALYSIS':
      case 'PAYMENT_REPROVED_BY_RISK_ANALYSIS':
        console.log('Payment event:', event, payment?.id);
        break;

      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        console.log('Payment confirmed/received:', payment?.id, payment?.value);
        // Here you could update deals in funnels, send notifications, etc.
        if (payment?.externalReference) {
          // externalReference could contain contact_id or deal_id
          // Update the related deal stage or send a WhatsApp notification
        }
        break;

      case 'PAYMENT_OVERDUE':
        console.log('Payment overdue:', payment?.id);
        // Could trigger a reminder automation
        break;

      case 'PAYMENT_REFUNDED':
      case 'PAYMENT_REFUND_IN_PROGRESS':
        console.log('Payment refunded:', payment?.id);
        break;

      case 'PAYMENT_DELETED':
      case 'PAYMENT_RESTORED':
      case 'PAYMENT_ANTICIPATED':
        console.log('Payment event:', event, payment?.id);
        break;

      // Subscription events
      case 'SUBSCRIPTION_CREATED':
      case 'SUBSCRIPTION_UPDATED':
      case 'SUBSCRIPTION_DELETED':
      case 'SUBSCRIPTION_RENEWED':
        console.log('Subscription event:', event, subscription?.id);
        break;

      // Transfer events
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

    // Log the webhook for debugging
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
