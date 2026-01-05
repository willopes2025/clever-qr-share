import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-STRIPE-METRICS] ${step}${detailsStr}`);
};

interface StripeSubscription {
  id: string;
  customer_email: string;
  customer_name: string | null;
  product_name: string;
  price: number;
  status: string;
  current_period_end: string;
  created: string;
}

interface StripeInvoice {
  id: string;
  customer_email: string;
  amount_paid: number;
  status: string;
  created: string;
  invoice_pdf: string | null;
}

interface MRRHistoryItem {
  month: string;
  value: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    logStep("Role check result", { roleData, roleError: roleError?.message });

    if (!roleData || !["admin", "owner"].includes(roleData.role)) {
      throw new Error("Unauthorized: Admin access required");
    }
    logStep("Admin access verified", { role: roleData.role });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all data in parallel
    const [balanceResult, subscriptionsResult, invoicesResult, customersResult] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer", "data.items.data.price.product"] }),
      stripe.invoices.list({ limit: 50, expand: ["data.customer"] }),
      stripe.customers.list({ limit: 100 }),
    ]);

    logStep("Stripe data fetched", {
      subscriptions: subscriptionsResult.data.length,
      invoices: invoicesResult.data.length,
      customers: customersResult.data.length,
    });

    // Calculate balance
    const availableBalance = balanceResult.available.reduce((sum: number, b: Stripe.Balance.Available) => sum + b.amount, 0) / 100;
    const pendingBalance = balanceResult.pending.reduce((sum: number, b: Stripe.Balance.Pending) => sum + b.amount, 0) / 100;

    // Process active subscriptions for MRR calculation
    const activeSubscriptions = subscriptionsResult.data.filter((s: Stripe.Subscription) => s.status === "active");
    
    let mrr = 0;
    const subscriptionDetails: StripeSubscription[] = [];

    for (const sub of subscriptionsResult.data) {
      const customer = sub.customer as Stripe.Customer;
      const priceItem = sub.items.data[0];
      const price = priceItem?.price;
      const product = price?.product as Stripe.Product;
      
      // Calculate monthly amount
      let monthlyAmount = 0;
      if (price?.unit_amount) {
        monthlyAmount = price.unit_amount / 100;
        // Adjust for interval
        if (price.recurring?.interval === "year") {
          monthlyAmount = monthlyAmount / 12;
        } else if (price.recurring?.interval === "week") {
          monthlyAmount = monthlyAmount * 4.33;
        }
      }

      if (sub.status === "active") {
        mrr += monthlyAmount;
      }

      subscriptionDetails.push({
        id: sub.id,
        customer_email: customer?.email || "N/A",
        customer_name: customer?.name || null,
        product_name: product?.name || "Unknown",
        price: monthlyAmount,
        status: sub.status,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        created: new Date(sub.created * 1000).toISOString(),
      });
    }

    // Process invoices
    const invoiceDetails: StripeInvoice[] = invoicesResult.data.map((inv: Stripe.Invoice) => {
      const customer = inv.customer as Stripe.Customer;
      return {
        id: inv.id,
        customer_email: customer?.email || inv.customer_email || "N/A",
        amount_paid: (inv.amount_paid || 0) / 100,
        status: inv.status || "unknown",
        created: new Date(inv.created * 1000).toISOString(),
        invoice_pdf: inv.invoice_pdf,
      };
    });

    // Calculate total revenue from paid invoices
    const totalRevenue = invoicesResult.data
      .filter((inv: Stripe.Invoice) => inv.status === "paid")
      .reduce((sum: number, inv: Stripe.Invoice) => sum + (inv.amount_paid || 0), 0) / 100;

    // Calculate MRR history from invoices (last 12 months)
    const mrrHistoryMap: Record<string, number> = {};
    const now = new Date();
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toISOString().substring(0, 7); // YYYY-MM
      mrrHistoryMap[monthKey] = 0;
    }

    // Sum paid invoices by month
    for (const inv of invoicesResult.data) {
      if (inv.status === "paid" && inv.amount_paid) {
        const invDate = new Date(inv.created * 1000);
        const monthKey = invDate.toISOString().substring(0, 7);
        if (mrrHistoryMap.hasOwnProperty(monthKey)) {
          mrrHistoryMap[monthKey] += inv.amount_paid / 100;
        }
      }
    }

    const mrrHistory: MRRHistoryItem[] = Object.entries(mrrHistoryMap)
      .map(([month, value]) => ({ month, value }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const response = {
      mrr,
      arr: mrr * 12,
      totalRevenue,
      activeSubscriptions: activeSubscriptions.length,
      totalSubscriptions: subscriptionsResult.data.length,
      totalCustomers: customersResult.data.length,
      balance: {
        available: availableBalance,
        pending: pendingBalance,
      },
      subscriptions: subscriptionDetails.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      ),
      invoices: invoiceDetails,
      mrrHistory,
    };

    logStep("Response prepared", { mrr, arr: mrr * 12, totalRevenue });

    return new Response(JSON.stringify(response), {
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
