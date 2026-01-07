import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CUSTOMER-PORTAL] ${step}${detailsStr}`);
};

// Helper function to get the active subscription ID
async function getActiveSubscriptionId(stripe: Stripe, customerId: string): Promise<string> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });
  
  if (subscriptions.data.length === 0) {
    throw new Error("No active subscription found");
  }
  
  return subscriptions.data[0].id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Parse request body for flow parameter
    let flow: string | null = null;
    try {
      const body = await req.json();
      flow = body?.flow || null;
      logStep("Request body parsed", { flow });
    } catch {
      // No body or invalid JSON, continue without flow
      logStep("No request body or invalid JSON");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check if this is a manual override subscription
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('manual_override')
      .eq('user_id', user.id)
      .maybeSingle();

    if (subscription?.manual_override) {
      logStep("Manual subscription detected - portal not available");
      return new Response(JSON.stringify({ 
        error: "MANUAL_SUBSCRIPTION",
        message: "Sua assinatura é gerenciada manualmente. Entre em contato com o suporte para alterações."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ 
        error: "NO_CUSTOMER",
        message: "Nenhuma assinatura ativa encontrada no Stripe. Assine um plano primeiro."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const origin = req.headers.get("origin") || "https://widezap.lovable.app";
    
    // Build portal session configuration based on flow
    const portalConfig: any = {
      customer: customerId,
      return_url: `${origin}/subscription`,
    };

    // Add flow_data based on the requested flow
    if (flow === 'cancel') {
      portalConfig.flow_data = {
        type: 'subscription_cancel',
        subscription_cancel: {
          subscription: await getActiveSubscriptionId(stripe, customerId),
        },
      };
      logStep("Flow configured for subscription cancel");
    } else if (flow === 'update_plan') {
      portalConfig.flow_data = {
        type: 'subscription_update',
        subscription_update: {
          subscription: await getActiveSubscriptionId(stripe, customerId),
        },
      };
      logStep("Flow configured for subscription update");
    } else if (flow === 'payment_method') {
      portalConfig.flow_data = {
        type: 'payment_method_update',
      };
      logStep("Flow configured for payment method update");
    }

    const portalSession = await stripe.billingPortal.sessions.create(portalConfig);
    
    logStep("Customer portal session created", { sessionId: portalSession.id, url: portalSession.url });

    return new Response(JSON.stringify({ url: portalSession.url }), {
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
