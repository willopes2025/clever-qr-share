import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autorizado' }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: authError } = await caller.auth.getUser();
    if (authError || !callerUser) return json({ error: 'Não autorizado' }, 401);

    // Only system owners (global admins) may impersonate
    const { data: isOwner, error: roleError } = await admin.rpc('is_system_owner', {
      _user_id: callerUser.id,
    });
    if (roleError) {
      console.error('role check error', roleError);
      return json({ error: 'Erro ao verificar permissões' }, 500);
    }
    if (!isOwner) return json({ error: 'Sem permissão para acessar contas de usuários' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'end' ? 'end' : 'start';

    if (action === 'end') {
      const logId = typeof body?.logId === 'string' ? body.logId : null;
      if (logId) {
        await admin
          .from('impersonation_log')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', logId)
          .is('ended_at', null);
      }
      return json({ success: true });
    }

    const targetUserId = body?.targetUserId;
    if (typeof targetUserId !== 'string' || targetUserId.length < 10) {
      return json({ error: 'targetUserId é obrigatório' }, 400);
    }
    if (targetUserId === callerUser.id) {
      return json({ error: 'Você já está nesta conta' }, 400);
    }

    const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetUserId);
    if (targetError || !targetData?.user?.email) {
      console.error('target lookup error', targetError);
      return json({ error: 'Usuário não encontrado ou sem e-mail' }, 404);
    }
    const targetEmail = targetData.user.email;

    // Block impersonating another system owner
    const { data: targetIsOwner } = await admin.rpc('is_system_owner', { _user_id: targetUserId });
    if (targetIsOwner) {
      return json({ error: 'Não é permitido acessar a conta de outro administrador do sistema' }, 403);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error('generateLink error', linkError);
      return json({ error: 'Não foi possível gerar o acesso: ' + (linkError?.message || 'sem token') }, 500);
    }

    const { data: logRow } = await admin
      .from('impersonation_log')
      .insert({
        actor_user_id: callerUser.id,
        target_user_id: targetUserId,
        target_email: targetEmail,
      })
      .select('id')
      .single();

    console.log(`Impersonation started: ${callerUser.id} -> ${targetUserId}`);

    return json({
      success: true,
      token_hash: linkData.properties.hashed_token,
      email: targetEmail,
      logId: logRow?.id ?? null,
    });
  } catch (error) {
    console.error('admin-impersonate-user error', error);
    return json({ error: (error as Error).message }, 500);
  }
});
