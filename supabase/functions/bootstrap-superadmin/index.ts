import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TARGET_EMAIL = 'contato@wideic.com';
const TARGET_PASSWORD = '160521';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Try to find existing user by listing (filter by email)
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = list.users.find(u => u.email?.toLowerCase() === TARGET_EMAIL);

    if (existing) {
      userId = existing.id;
      // Reset password & confirm email
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password: TARGET_PASSWORD,
        email_confirm: true,
      });
      if (updErr) throw updErr;
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: TARGET_EMAIL,
        password: TARGET_PASSWORD,
        email_confirm: true,
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // Ensure admin role
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'admin' }, { onConflict: 'user_id,role' });
    if (roleErr) throw roleErr;

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      email: TARGET_EMAIL,
      role: 'admin',
      created: !existing,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('bootstrap-superadmin error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
