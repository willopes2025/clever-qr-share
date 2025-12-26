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

// Plan type with leads
type PlanInfo = { 
  plan: string; 
  maxInstances: number | null; 
  maxContacts: number | null; 
  maxMessages: number | null;
  maxLeads: number;
};

// Mapping from Stripe product IDs to plan names (NEW PLANS)
const PRODUCT_TO_PLAN: Record<string, PlanInfo> = {
  // New plans
  "prod_Tg5qEVTAzaY2d1": { plan: "essencial", maxInstances: 3, maxContacts: 10000, maxMessages: 10000, maxLeads: 1000 },
  "prod_Tg5qspfPups3iN": { plan: "profissional", maxInstances: 10, maxContacts: 50000, maxMessages: null, maxLeads: 5000 },
  "prod_Tg5qcEw3OK7hU3": { plan: "agencia", maxInstances: 30, maxContacts: null, maxMessages: null, maxLeads: 25000 },
  "prod_Tg5rhArqyzOqTt": { plan: "avancado", maxInstances: 50, maxContacts: null, maxMessages: null, maxLeads: 100000 },
  // Legacy plans (backward compatibility)
  "prod_Td6oCDIlCW9tXp": { plan: "essencial", maxInstances: 3, maxContacts: 10000, maxMessages: 10000, maxLeads: 1000 },
  "prod_Td6oDKN8AXJsXf": { plan: "profissional", maxInstances: 10, maxContacts: 50000, maxMessages: null, maxLeads: 5000 },
  "prod_Td6otV5Ef9IHSt": { plan: "agencia", maxInstances: 30, maxContacts: null, maxMessages: null, maxLeads: 25000 },
};

// Free plan configuration
const FREE_PLAN: PlanInfo = { 
  plan: "free", 
  maxInstances: 1, 
  maxContacts: 500, 
  maxMessages: 300,
  maxLeads: 50,
};

// Helper to check if leads need to be reset
async function checkAndResetLeads(supabaseClient: any, userId: string) {
  const { data: sub } = await supabaseClient
    .from("subscriptions")
    .select("leads_reset_at")
    .eq("user_id", userId)
    .single();

  if (sub?.leads_reset_at) {
    const resetDate = new Date(sub.leads_reset_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 30) {
      logStep("Resetting leads for new month", { userId, lastReset: sub.leads_reset_at });
      await supabaseClient
        .from("subscriptions")
        .update({ leads_used: 0, leads_reset_at: now.toISOString() })
        .eq("user_id", userId);
    }
  }
}

// Helper to get subscription for a specific user
async function getSubscriptionForUser(
  supabaseClient: any, 
  stripe: any, 
  userId: string, 
  userEmail: string
): Promise<{
  subscribed: boolean;
  plan: string;
  max_instances: number | null;
  max_contacts: number | null;
  max_messages: number | null;
  max_leads: number;
  leads_used: number;
  leads_reset_at: string | null;
  subscription_end: string | null;
}> {
  // Check and reset leads if needed
  await checkAndResetLeads(supabaseClient, userId);

  // PRIMEIRO: Verificar se existe assinatura manual válida
  const { data: existingSub } = await supabaseClient
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  // Se existe assinatura manual ativa, usar ela
  if (existingSub?.manual_override && existingSub?.status === 'active') {
    const periodEnd = existingSub.current_period_end 
      ? new Date(existingSub.current_period_end) 
      : null;
    
    // Verificar se não expirou
    if (!periodEnd || periodEnd > new Date()) {
      logStep("Using manual subscription override", { 
        userId,
        plan: existingSub.plan, 
        periodEnd: existingSub.current_period_end 
      });
      
      return {
        subscribed: true,
        plan: existingSub.plan,
        max_instances: existingSub.max_instances,
        max_contacts: existingSub.max_contacts,
        max_messages: existingSub.max_messages,
        max_leads: existingSub.max_leads || FREE_PLAN.maxLeads,
        leads_used: existingSub.leads_used || 0,
        leads_reset_at: existingSub.leads_reset_at,
        subscription_end: existingSub.current_period_end,
      };
    } else {
      // Assinatura manual expirou
      logStep("Manual subscription expired for user", { userId });
      await supabaseClient
        .from("subscriptions")
        .update({ manual_override: false, status: 'expired' })
        .eq("user_id", userId);
    }
  }

  // Verificar no Stripe
  const customers = await stripe.customers.list({ email: userEmail, limit: 1 });

  if (customers.data.length === 0) {
    logStep("No Stripe customer found for user", { userId, email: userEmail });
    return {
      subscribed: true,
      plan: FREE_PLAN.plan,
      max_instances: FREE_PLAN.maxInstances,
      max_contacts: FREE_PLAN.maxContacts,
      max_messages: FREE_PLAN.maxMessages,
      max_leads: FREE_PLAN.maxLeads,
      leads_used: existingSub?.leads_used || 0,
      leads_reset_at: existingSub?.leads_reset_at || null,
      subscription_end: null,
    };
  }

  const customerId = customers.data[0].id;
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  const hasActiveSub = subscriptions.data.length > 0;
  let planInfo: PlanInfo = FREE_PLAN;
  let subscriptionEnd = null;

  if (hasActiveSub) {
    const subscription = subscriptions.data[0];
    subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const productId = subscription.items.data[0].price.product as string;
    planInfo = PRODUCT_TO_PLAN[productId as keyof typeof PRODUCT_TO_PLAN] || planInfo;
    logStep("Active Stripe subscription found", { userId, productId, plan: planInfo.plan });
  }

  return {
    subscribed: true,
    plan: planInfo.plan,
    max_instances: planInfo.maxInstances,
    max_contacts: planInfo.maxContacts,
    max_messages: planInfo.maxMessages,
    max_leads: planInfo.maxLeads,
    leads_used: existingSub?.leads_used || 0,
    leads_reset_at: existingSub?.leads_reset_at || null,
    subscription_end: subscriptionEnd,
  };
}

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

    // Check and reset leads if needed
    await checkAndResetLeads(supabaseClient, user.id);

    // NOVA LÓGICA: Verificar se o usuário é membro de uma organização
    const { data: member } = await supabaseClient
      .from("team_members")
      .select("organization_id, role, permissions")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (member) {
      logStep("User is a team member", { organizationId: member.organization_id });
      
      // Buscar o owner da organização
      const { data: org } = await supabaseClient
        .from("organizations")
        .select("owner_id")
        .eq("id", member.organization_id)
        .single();

      if (org && org.owner_id !== user.id) {
        logStep("Getting subscription from organization owner", { ownerId: org.owner_id });
        
        // Buscar email do owner
        const { data: ownerData } = await supabaseClient.auth.admin.getUserById(org.owner_id);
        
        if (ownerData?.user?.email) {
          // Retornar a assinatura do owner
          const ownerSubscription = await getSubscriptionForUser(
            supabaseClient, 
            stripe, 
            org.owner_id, 
            ownerData.user.email
          );
          
          logStep("Returning owner subscription for member", { 
            memberId: user.id, 
            ownerId: org.owner_id,
            plan: ownerSubscription.plan 
          });
          
          return new Response(JSON.stringify({
            ...ownerSubscription,
            is_organization_member: true,
            organization_id: member.organization_id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    // Usuário não é membro de organização ou é o próprio owner - verificar assinatura normal
    logStep("Checking direct subscription for user");

    // PRIMEIRO: Verificar se existe assinatura manual válida
    const { data: existingSub } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Se existe assinatura manual ativa, usar ela e NÃO sobrescrever com Stripe
    if (existingSub?.manual_override && existingSub?.status === 'active') {
      const periodEnd = existingSub.current_period_end 
        ? new Date(existingSub.current_period_end) 
        : null;
      
      // Verificar se não expirou
      if (!periodEnd || periodEnd > new Date()) {
        logStep("Using manual subscription override", { 
          plan: existingSub.plan, 
          periodEnd: existingSub.current_period_end 
        });
        
        return new Response(JSON.stringify({
          subscribed: true,
          plan: existingSub.plan,
          max_instances: existingSub.max_instances,
          max_contacts: existingSub.max_contacts,
          max_messages: existingSub.max_messages,
          max_leads: existingSub.max_leads || FREE_PLAN.maxLeads,
          leads_used: existingSub.leads_used || 0,
          leads_reset_at: existingSub.leads_reset_at,
          subscription_end: existingSub.current_period_end,
          is_organization_member: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Assinatura manual expirou, remover flag e continuar com verificação Stripe
        logStep("Manual subscription expired, removing override flag");
        await supabaseClient
          .from("subscriptions")
          .update({ manual_override: false, status: 'expired' })
          .eq("user_id", user.id);
      }
    }

    // Continuar com verificação do Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No customer found, returning free plan");
      
      // Update local subscription record with free plan (sem manual_override)
      await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          status: "active",
          plan: FREE_PLAN.plan,
          max_instances: FREE_PLAN.maxInstances,
          max_contacts: FREE_PLAN.maxContacts,
          max_messages: FREE_PLAN.maxMessages,
          max_leads: FREE_PLAN.maxLeads,
          leads_used: existingSub?.leads_used || 0,
          leads_reset_at: existingSub?.leads_reset_at || new Date().toISOString(),
          manual_override: false,
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({ 
        subscribed: true,
        plan: FREE_PLAN.plan,
        max_instances: FREE_PLAN.maxInstances,
        max_contacts: FREE_PLAN.maxContacts,
        max_messages: FREE_PLAN.maxMessages,
        max_leads: FREE_PLAN.maxLeads,
        leads_used: existingSub?.leads_used || 0,
        leads_reset_at: existingSub?.leads_reset_at || null,
        subscription_end: null,
        is_organization_member: false,
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

    // Update local subscription record (sem manual_override para sincronização do Stripe)
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
        max_leads: planInfo.maxLeads,
        leads_used: existingSub?.leads_used || 0,
        leads_reset_at: existingSub?.leads_reset_at || new Date().toISOString(),
        current_period_end: subscriptionEnd,
        manual_override: false,
      }, { onConflict: "user_id" });

    logStep("Subscription record updated in database");

    return new Response(JSON.stringify({
      subscribed: true,
      plan: planInfo.plan,
      max_instances: planInfo.maxInstances,
      max_contacts: planInfo.maxContacts,
      max_messages: planInfo.maxMessages,
      max_leads: planInfo.maxLeads,
      leads_used: existingSub?.leads_used || 0,
      leads_reset_at: existingSub?.leads_reset_at || null,
      subscription_end: subscriptionEnd,
      is_organization_member: false,
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
