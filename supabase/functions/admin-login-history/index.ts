import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: isAdminData } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const days = Math.min(Number(url.searchParams.get("days") ?? "1"), 30);

    // Query auth.audit_log_entries via service role using a direct REST/SQL through pg
    // We'll use a small RPC-less SQL via postgres-meta endpoint isn't available; use SQL via PostgREST RPC instead.
    // Easiest: create a SECURITY DEFINER function. But we want to avoid migrations here.
    // Use admin.from doesn't access auth schema; fall back to PG REST via service_role with rpc to a function.
    // Workaround: use the Supabase Admin Auth list users + per-user last_sign_in. That gives recent logins.
    const { data: usersList, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) throw listErr;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const logins = (usersList?.users ?? [])
      .filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= since)
      .map((u) => ({
        id: u.id,
        email: u.email,
        full_name: (u.user_metadata as any)?.full_name ?? null,
        last_sign_in_at: u.last_sign_in_at,
        created_at: u.created_at,
        providers: (u.app_metadata as any)?.providers ?? [],
      }))
      .sort((a, b) =>
        new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime()
      );

    return new Response(JSON.stringify({ logins, since: since.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-login-history] error:", err);
    return new Response(JSON.stringify({ error: String((err as Error).message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
