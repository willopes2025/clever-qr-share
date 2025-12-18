import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Mapping from Stripe product IDs to plan names
const PRODUCT_TO_PLAN: Record<string, { plan: string; maxInstances: number | null; maxContacts: number | null }> = {
  "prod_Td6oCDIlCW9tXp": { plan: "starter", maxInstances: 1, maxContacts: null },
  "prod_Td6oDKN8AXJsXf": { plan: "pro", maxInstances: 10, maxContacts: null },
  "prod_Td6otV5Ef9IHSt": { plan: "business", maxInstances: null, maxContacts: null },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      
      // Update local subscription record
      await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "inactive",
          plan: "free",
          max_instances: 0,
          max_contacts: 0,
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ 
        subscribed: false,
        plan: "free",
        max_instances: 0,
        max_contacts: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let planInfo: { plan: string; maxInstances: number | null; maxContacts: number | null } = { plan: "free", maxInstances: 0, maxContacts: 0 };
    let subscriptionEnd = null;
    let stripeSubscriptionId = null;
    let stripePriceId = null;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      stripeSubscriptionId = subscription.id;
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      const productId = subscription.items.data[0].price.product as string;
      stripePriceId = subscription.items.data[0].price.id;
      
      planInfo = PRODUCT_TO_PLAN[productId as keyof typeof PRODUCT_TO_PLAN] || planInfo;
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        productId, 
        plan: planInfo.plan 
      });
    } else {
      logStep("No active subscription found");
    }

    // Update local subscription record
    await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: stripePriceId,
        status: hasActiveSub ? "active" : "inactive",
        plan: planInfo.plan,
        max_instances: planInfo.maxInstances,
        max_contacts: planInfo.maxContacts,
        current_period_end: subscriptionEnd,
      }, { onConflict: "user_id" });

    logStep("Subscription record updated in database");

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      plan: planInfo.plan,
      max_instances: planInfo.maxInstances,
      max_contacts: planInfo.maxContacts,
      subscription_end: subscriptionEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
