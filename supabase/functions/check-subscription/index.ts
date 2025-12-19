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

// Plan type
type PlanInfo = { plan: string; maxInstances: number | null; maxContacts: number | null; maxMessages: number | null };

// Mapping from Stripe product IDs to plan names
const PRODUCT_TO_PLAN: Record<string, PlanInfo> = {
  "prod_Td6oCDIlCW9tXp": { plan: "starter", maxInstances: 1, maxContacts: null, maxMessages: null },
  "prod_Td6oDKN8AXJsXf": { plan: "pro", maxInstances: 10, maxContacts: null, maxMessages: null },
  "prod_Td6otV5Ef9IHSt": { plan: "business", maxInstances: null, maxContacts: null, maxMessages: null },
};

// Free plan configuration
const FREE_PLAN: PlanInfo = { 
  plan: "free", 
  maxInstances: 1, 
  maxContacts: null, 
  maxMessages: 300 
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
      logStep("No customer found, returning free plan");
      
      // Update local subscription record with free plan
      await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "active",
          plan: FREE_PLAN.plan,
          max_instances: FREE_PLAN.maxInstances,
          max_contacts: FREE_PLAN.maxContacts,
          max_messages: FREE_PLAN.maxMessages,
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ 
        subscribed: true,
        plan: FREE_PLAN.plan,
        max_instances: FREE_PLAN.maxInstances,
        max_contacts: FREE_PLAN.maxContacts,
        max_messages: FREE_PLAN.maxMessages,
        subscription_end: null,
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
    let planInfo: PlanInfo = FREE_PLAN;
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
      logStep("No active Stripe subscription, using free plan");
    }

    // Update local subscription record
    await supabaseClient
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_price_id: stripePriceId,
        status: "active",
        plan: planInfo.plan,
        max_instances: planInfo.maxInstances,
        max_contacts: planInfo.maxContacts,
        max_messages: planInfo.maxMessages,
        current_period_end: subscriptionEnd,
      }, { onConflict: "user_id" });

    logStep("Subscription record updated in database");

    return new Response(JSON.stringify({
      subscribed: true,
      plan: planInfo.plan,
      max_instances: planInfo.maxInstances,
      max_contacts: planInfo.maxContacts,
      max_messages: planInfo.maxMessages,
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