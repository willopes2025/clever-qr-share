import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONSUME-AI-TOKENS] ${step}${detailsStr}`);
};

Deno.serve(async (req: Request) => {
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

    const { tokens, description, metadata } = await req.json();
    
    if (!tokens || tokens <= 0) {
      throw new Error("tokens must be a positive number");
    }
    logStep("Consumption request", { tokens, description });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar saldo atual
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("user_ai_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (balanceError?.code === "PGRST116") {
      logStep("No token balance found for user");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "insufficient_balance",
        message: "Você não possui tokens. Por favor, adquira um pacote de tokens.",
        balance: 0,
        required: tokens,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      });
    }

    if (balanceError) {
      throw new Error(`Failed to fetch token balance: ${balanceError.message}`);
    }

    const currentBalance = balance.balance || 0;
    
    if (currentBalance < tokens) {
      logStep("Insufficient balance", { currentBalance, required: tokens });
      return new Response(JSON.stringify({ 
        success: false, 
        error: "insufficient_balance",
        message: `Saldo insuficiente. Você tem ${currentBalance.toLocaleString("pt-BR")} tokens, mas precisa de ${tokens.toLocaleString("pt-BR")}.`,
        balance: currentBalance,
        required: tokens,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402,
      });
    }

    // Debitar tokens
    const newBalance = currentBalance - tokens;
    const newTotalConsumed = (balance.total_consumed || 0) + tokens;

    const { error: updateError } = await supabaseAdmin
      .from("user_ai_tokens")
      .update({
        balance: newBalance,
        total_consumed: newTotalConsumed,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error(`Failed to update token balance: ${updateError.message}`);
    }

    // Registrar transação
    const { error: transactionError } = await supabaseAdmin
      .from("ai_token_transactions")
      .insert({
        user_id: user.id,
        type: "consumption",
        amount: -tokens,
        balance_after: newBalance,
        description: description || "Consumo de tokens AI",
        metadata: metadata || {},
      });

    if (transactionError) {
      logStep("Warning: Failed to record transaction", { error: transactionError.message });
    }

    logStep("Tokens consumed successfully", { 
      previousBalance: currentBalance, 
      consumed: tokens, 
      newBalance 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      consumed: tokens,
      balance: newBalance,
      message: `${tokens.toLocaleString("pt-BR")} tokens consumidos com sucesso.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in consume-ai-tokens", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
