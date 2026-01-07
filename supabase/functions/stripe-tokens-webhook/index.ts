import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-TOKENS-WEBHOOK] ${step}${detailsStr}`);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    let event: Stripe.Event;

    // Se tiver webhook secret configurado, validar a assinatura
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err) {
        logStep("Webhook signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Sem webhook secret, parse o JSON diretamente (apenas para desenvolvimento)
      event = JSON.parse(body);
      logStep("Webhook parsed without signature verification (dev mode)");
    }

    logStep("Event received", { type: event.type });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Verificar se é uma compra de tokens AI
      if (session.metadata?.type !== "ai_tokens_purchase") {
        logStep("Not a token purchase, skipping", { metadata: session.metadata });
        return new Response(JSON.stringify({ received: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      const userId = session.metadata.user_id;
      const packageId = session.metadata.package_id;
      const tokens = parseInt(session.metadata.tokens || "0", 10);

      logStep("Processing token purchase", { userId, packageId, tokens });

      if (!userId || !tokens) {
        throw new Error("Missing user_id or tokens in metadata");
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Buscar ou criar saldo de tokens do usuário
      const { data: existingBalance, error: balanceError } = await supabaseAdmin
        .from("user_ai_tokens")
        .select("*")
        .eq("user_id", userId)
        .single();

      let newBalance: number;
      let totalPurchased: number;

      if (balanceError?.code === "PGRST116") {
        // Não existe, criar novo
        newBalance = tokens;
        totalPurchased = tokens;

        const { error: insertError } = await supabaseAdmin
          .from("user_ai_tokens")
          .insert({
            user_id: userId,
            balance: newBalance,
            total_purchased: totalPurchased,
            total_consumed: 0,
          });

        if (insertError) throw new Error(`Failed to create token balance: ${insertError.message}`);
        logStep("Created new token balance", { userId, balance: newBalance });
      } else if (balanceError) {
        throw new Error(`Failed to fetch token balance: ${balanceError.message}`);
      } else {
        // Atualizar saldo existente
        newBalance = (existingBalance.balance || 0) + tokens;
        totalPurchased = (existingBalance.total_purchased || 0) + tokens;

        const { error: updateError } = await supabaseAdmin
          .from("user_ai_tokens")
          .update({
            balance: newBalance,
            total_purchased: totalPurchased,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (updateError) throw new Error(`Failed to update token balance: ${updateError.message}`);
        logStep("Updated token balance", { userId, previousBalance: existingBalance.balance, newBalance });
      }

      // Registrar transação
      const { error: transactionError } = await supabaseAdmin
        .from("ai_token_transactions")
        .insert({
          user_id: userId,
          type: "purchase",
          amount: tokens,
          balance_after: newBalance,
          description: `Compra de pacote de ${tokens.toLocaleString("pt-BR")} tokens`,
          stripe_payment_intent_id: session.payment_intent as string,
          stripe_checkout_session_id: session.id,
          package_id: packageId,
          metadata: {
            customer_email: session.customer_email,
            amount_total: session.amount_total,
            currency: session.currency,
          },
        });

      if (transactionError) {
        logStep("Warning: Failed to record transaction", { error: transactionError.message });
      } else {
        logStep("Transaction recorded successfully");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-tokens-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
