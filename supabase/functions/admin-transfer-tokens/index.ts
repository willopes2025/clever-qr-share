import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[ADMIN-TRANSFER-TOKENS] ${step}`, details ? JSON.stringify(details) : '');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting admin token transfer');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    logStep('User authenticated', { userId: user.id });

    // Admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const { data: roleData, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (roleError || !roleData) {
      logStep('User is not admin', { userId: user.id });
      throw new Error('Admin access required');
    }

    logStep('Admin verified');

    const { targetUserId, amount, description } = await req.json();

    if (!targetUserId || !amount || amount <= 0) {
      throw new Error('Invalid parameters: targetUserId and positive amount required');
    }

    logStep('Transfer request', { targetUserId, amount, description });

    // Get admin's current balance
    const { data: adminBalance, error: adminBalanceError } = await adminClient
      .from('user_ai_tokens')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (adminBalanceError && adminBalanceError.code !== 'PGRST116') {
      throw adminBalanceError;
    }

    const currentAdminBalance = adminBalance?.balance || 0;

    if (currentAdminBalance < amount) {
      throw new Error(`Saldo insuficiente. Disponível: ${currentAdminBalance}, Solicitado: ${amount}`);
    }

    logStep('Admin has sufficient balance', { currentAdminBalance, requested: amount });

    // Get target user's current balance
    const { data: targetBalance, error: targetBalanceError } = await adminClient
      .from('user_ai_tokens')
      .select('balance, total_purchased')
      .eq('user_id', targetUserId)
      .single();

    if (targetBalanceError && targetBalanceError.code !== 'PGRST116') {
      throw targetBalanceError;
    }

    const currentTargetBalance = targetBalance?.balance || 0;
    const currentTargetTotalPurchased = targetBalance?.total_purchased || 0;

    // Calculate new balances
    const newAdminBalance = currentAdminBalance - amount;
    const newTargetBalance = currentTargetBalance + amount;
    const newTargetTotalPurchased = currentTargetTotalPurchased + amount;

    logStep('Calculated new balances', { 
      newAdminBalance, 
      newTargetBalance,
      newTargetTotalPurchased 
    });

    // Update admin balance
    const { error: updateAdminError } = await adminClient
      .from('user_ai_tokens')
      .upsert({
        user_id: user.id,
        balance: newAdminBalance,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateAdminError) throw updateAdminError;

    // Update target user balance
    const { error: updateTargetError } = await adminClient
      .from('user_ai_tokens')
      .upsert({
        user_id: targetUserId,
        balance: newTargetBalance,
        total_purchased: newTargetTotalPurchased,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateTargetError) throw updateTargetError;

    // Record transaction for admin (debit)
    const { error: adminTxError } = await adminClient
      .from('ai_token_transactions')
      .insert({
        user_id: user.id,
        type: 'admin_transfer_out',
        amount: -amount,
        balance_after: newAdminBalance,
        description: description || `Transferência para usuário`,
        metadata: { target_user_id: targetUserId },
      });

    if (adminTxError) throw adminTxError;

    // Record transaction for target user (credit)
    const { error: targetTxError } = await adminClient
      .from('ai_token_transactions')
      .insert({
        user_id: targetUserId,
        type: 'admin_transfer_in',
        amount: amount,
        balance_after: newTargetBalance,
        description: description || `Tokens recebidos do administrador`,
        metadata: { from_admin_id: user.id },
      });

    if (targetTxError) throw targetTxError;

    logStep('Transfer completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        adminNewBalance: newAdminBalance,
        targetNewBalance: newTargetBalance,
        transferred: amount,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    logStep('Error', { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
