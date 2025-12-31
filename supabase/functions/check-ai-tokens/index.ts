import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-AI-TOKENS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { requiredTokens } = await req.json();
    logStep("Check request", { requiredTokens });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar saldo atual
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("user_ai_tokens")
      .select("balance, total_purchased, total_consumed")
      .eq("user_id", user.id)
      .single();

    if (balanceError?.code === "PGRST116") {
      // Usuário não tem registro de tokens
      return new Response(JSON.stringify({ 
        hasBalance: false,
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        sufficient: false,
        required: requiredTokens || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (balanceError) {
      throw new Error(`Failed to fetch token balance: ${balanceError.message}`);
    }

    const currentBalance = balance.balance || 0;
    const sufficient = requiredTokens ? currentBalance >= requiredTokens : true;

    logStep("Balance checked", { 
      balance: currentBalance, 
      required: requiredTokens, 
      sufficient 
    });

    return new Response(JSON.stringify({ 
      hasBalance: true,
      balance: currentBalance,
      totalPurchased: balance.total_purchased || 0,
      totalConsumed: balance.total_consumed || 0,
      sufficient,
      required: requiredTokens || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-ai-tokens", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
