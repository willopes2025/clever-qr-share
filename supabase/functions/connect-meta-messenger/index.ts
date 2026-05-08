// Conecta Páginas Facebook + contas Instagram Business via short-lived user token (Login com Facebook)
// Body: { user_access_token: string }
// Lista as páginas do usuário, gera page_access_token long-lived, descobre IG Business e salva.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { user_access_token } = await req.json().catch(() => ({}));
  if (!user_access_token) {
    return new Response(JSON.stringify({ error: 'Missing user_access_token' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // List pages with their access tokens
  const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,category,instagram_business_account{id,username,profile_picture_url}&access_token=${user_access_token}`);
  const pagesJson = await pagesRes.json();
  if (pagesJson.error) {
    return new Response(JSON.stringify({ error: pagesJson.error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const pages = pagesJson.data ?? [];
  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Org id for sharing
  const { data: orgIdData } = await supabase.rpc('get_user_organization_id', { _user_id: user.id });

  const saved: any[] = [];
  for (const page of pages) {
    const platforms = ['messenger'];
    const ig = page.instagram_business_account;
    if (ig?.id) platforms.push('instagram');

    const { data, error } = await service
      .from('meta_messenger_accounts')
      .upsert({
        user_id: user.id,
        organization_id: orgIdData ?? null,
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token, // long-lived when issued from /me/accounts with long-lived user token
        page_category: page.category ?? null,
        ig_business_account_id: ig?.id ?? null,
        ig_username: ig?.username ?? null,
        profile_picture_url: ig?.profile_picture_url ?? null,
        platforms,
        status: 'connected',
        connected_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
      }, { onConflict: 'user_id,page_id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      // Subscribe page to webhook
      try {
        const subRes = await fetch(`${GRAPH}/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_reactions,messaging_handovers&access_token=${page.access_token}`, { method: 'POST' });
        const subJson = await subRes.json();
        if (subJson?.success) {
          await service.from('meta_messenger_accounts').update({ webhook_subscribed: true }).eq('id', data.id);
        }
      } catch (_e) { /* noop */ }
      saved.push(data);
    }
  }

  return new Response(JSON.stringify({ success: true, accounts: saved }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
