import { requireUser, createServiceClient, isAdmin, corsHeaders } from "../_shared/auth.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-UPDATE-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Validate authentication using shared helper
    const authResult = await requireUser(req);
    if (!authResult.success) {
      return authResult.error;
    }

    const authenticatedUserId = authResult.userId;
    logStep("User authenticated", { userId: authenticatedUserId });

    // Check if user is admin
    const userIsAdmin = await isAdmin(authenticatedUserId);
    if (!userIsAdmin) {
      logStep("User is not admin", { userId: authenticatedUserId });
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    logStep("Admin verified");

    // Initialize Supabase client with service role for admin operations
    const supabaseClient = createServiceClient();

    // Parse request body
    const { action, subscriptionId, userId, updates, notes } = await req.json();
    logStep("Request body parsed", { action, subscriptionId, userId });

    if (action === 'list_users') {
      // Listar todos os usuários com suas assinaturas
      const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();
      if (usersError) throw usersError;

      const { data: subscriptions, error: subsError } = await supabaseClient
        .from('subscriptions')
        .select('*');
      if (subsError) throw subsError;

      // Combinar usuários com assinaturas
      const usersWithSubs = users.users.map(user => {
        const subscription = subscriptions?.find(s => s.user_id === user.id);
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          subscription: subscription || null
        };
      });

      return new Response(JSON.stringify({ users: usersWithSubs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'get_history') {
      // Buscar histórico de uma assinatura
      const { data: history, error: historyError } = await supabaseClient
        .from('subscription_history')
        .select('*')
        .eq('subscription_id', subscriptionId)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;

      // Buscar emails dos admins que fizeram alterações
      const changedByIds = [...new Set(history?.map(h => h.changed_by) || [])];
      const { data: admins } = await supabaseClient.auth.admin.listUsers();
      const adminEmails: Record<string, string> = {};
      admins?.users.forEach(admin => {
        if (changedByIds.includes(admin.id)) {
          adminEmails[admin.id] = admin.email || 'Unknown';
        }
      });

      const historyWithEmails = history?.map(h => ({
        ...h,
        changed_by_email: adminEmails[h.changed_by] || 'Unknown'
      }));

      return new Response(JSON.stringify({ history: historyWithEmails }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'update') {
      if (!subscriptionId || !updates) {
        throw new Error("Missing subscriptionId or updates");
      }

      // Buscar assinatura atual
      const { data: currentSub, error: fetchError } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('id', subscriptionId)
        .single();

      if (fetchError) throw fetchError;
      logStep("Current subscription fetched", currentSub);

      // Atualizar assinatura com manual_override = true
      const { data: updatedSub, error: updateError } = await supabaseClient
        .from('subscriptions')
        .update({
          ...updates,
          manual_override: true,  // Marcar como alteração manual
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single();

      if (updateError) throw updateError;
      logStep("Subscription updated with manual_override", updatedSub);

      // Registrar no histórico
      const { error: historyError } = await supabaseClient
        .from('subscription_history')
        .insert({
          subscription_id: subscriptionId,
          user_id: currentSub.user_id,
          changed_by: authenticatedUserId,
          old_values: currentSub,
          new_values: updatedSub,
          action: 'update',
          notes: notes || null
        });

      if (historyError) {
        logStep("History insert error", historyError);
      } else {
        logStep("History recorded");
      }

      return new Response(JSON.stringify({ subscription: updatedSub }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'create') {
      if (!userId) {
        throw new Error("Missing userId for create action");
      }

      // Verificar se já existe assinatura
      const { data: existingSub } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingSub) {
        throw new Error("User already has a subscription");
      }

      // Criar nova assinatura com manual_override = true
      const newSubscription = {
        user_id: userId,
        plan: updates?.plan || 'free',
        status: updates?.status || 'active',
        max_instances: updates?.max_instances || 1,
        max_messages: updates?.max_messages || null,
        max_contacts: updates?.max_contacts || null,
        current_period_start: new Date().toISOString(),
        current_period_end: updates?.current_period_end || null,
        manual_override: true  // Marcar como criação manual
      };

      const { data: createdSub, error: createError } = await supabaseClient
        .from('subscriptions')
        .insert(newSubscription)
        .select()
        .single();

      if (createError) throw createError;
      logStep("Subscription created with manual_override", createdSub);

      // Registrar no histórico
      await supabaseClient
        .from('subscription_history')
        .insert({
          subscription_id: createdSub.id,
          user_id: userId,
          changed_by: authenticatedUserId,
          old_values: null,
          new_values: createdSub,
          action: 'create',
          notes: notes || 'Assinatura criada manualmente pelo admin'
        });

      return new Response(JSON.stringify({ subscription: createdSub }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'delete_user') {
      if (!userId) {
        throw new Error("Missing userId for delete_user action");
      }

      logStep("Deleting user", { userId });

      // Deletar assinatura do usuário primeiro (se existir)
      const { error: subDeleteError } = await supabaseClient
        .from('subscriptions')
        .delete()
        .eq('user_id', userId);

      if (subDeleteError) {
        logStep("Subscription delete error (may not exist)", subDeleteError);
      }

      // Deletar usuário usando admin API
      const { error: userDeleteError } = await supabaseClient.auth.admin.deleteUser(userId);

      if (userDeleteError) {
        throw userDeleteError;
      }

      logStep("User deleted successfully", { userId });

      return new Response(JSON.stringify({ success: true, message: "User deleted successfully" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
