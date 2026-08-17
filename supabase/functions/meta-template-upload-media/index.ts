import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/** Descobre o app_id ao qual o token pertence (evita usar META_APP_ID de outro app). */
async function resolveAppIdForToken(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`,
    );
    const json = await res.json();
    const appId = json?.data?.app_id;
    return appId ? String(appId) : null;
  } catch (err) {
    console.error("[meta-template-upload-media] debug_token failed", err);
    return null;
  }
}

async function getOrgUserIds(client: ReturnType<typeof createClient>, userId: string): Promise<string[]> {
  const ids = new Set<string>([userId]);
  try {
    const { data } = await client.rpc("get_organization_member_ids", { _user_id: userId });
    (data as Array<string | { get_organization_member_ids: string }> | null)?.forEach((row) => {
      const id = typeof row === "string" ? row : row?.get_organization_member_ids;
      if (id) ids.add(id);
    });
  } catch (_) { /* ignore */ }
  return Array.from(ids);
}

/** Todos os tokens Meta que a organização possui (por número + integração + env). */
async function collectTokens(
  userClient: ReturnType<typeof createClient>,
  admin: ReturnType<typeof createClient>,
  userIds: string[],
): Promise<string[]> {
  const tokens: string[] = [];

  const { data: numberTokens } = await admin
    .from("meta_number_tokens")
    .select("access_token")
    .in("user_id", userIds);
  (numberTokens ?? []).forEach((r: { access_token?: string }) => {
    if (r?.access_token) tokens.push(r.access_token);
  });

  const { data: integrations } = await userClient
    .from("integrations")
    .select("credentials")
    .in("user_id", userIds)
    .eq("provider", "meta_whatsapp")
    .eq("is_active", true);
  (integrations ?? []).forEach((i: { credentials?: { access_token?: string } }) => {
    const t = i?.credentials?.access_token;
    if (t) tokens.push(t);
  });

  const envToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  if (envToken) tokens.push(envToken);

  return Array.from(new Set(tokens.filter(Boolean)));
}

async function tryUpload(
  appId: string,
  token: string,
  file: { buffer: ArrayBuffer; name: string; type: string },
): Promise<{ handle?: string; error?: string }> {
  const sessionUrl = `${GRAPH_API_BASE}/${appId}/uploads?file_length=${file.buffer.byteLength}&file_type=${encodeURIComponent(file.type)}&file_name=${encodeURIComponent(file.name)}&access_token=${encodeURIComponent(token)}`;
  const sessionRes = await fetch(sessionUrl, { method: "POST" });
  const sessionJson = await sessionRes.json();
  if (!sessionRes.ok || !sessionJson?.id) {
    return { error: sessionJson?.error?.message || "Falha ao iniciar sessão de upload no Meta" };
  }

  const uploadRes = await fetch(`${GRAPH_API_BASE}/${sessionJson.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    body: file.buffer,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadRes.ok || !uploadJson?.h) {
    return { error: uploadJson?.error?.message || "Falha ao enviar o arquivo ao Meta" };
  }
  return { handle: uploadJson.h as string };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return json({ error: "Arquivo não enviado" }, 400);

    const buffer = await file.arrayBuffer();
    const payload = {
      buffer,
      name: file.name || "upload",
      type: file.type || "application/octet-stream",
    };

    const userIds = await getOrgUserIds(supabaseClient, user.id);
    const tokens = await collectTokens(supabaseClient, admin, userIds);
    if (tokens.length === 0) return json({ error: "Nenhum token Meta configurado para esta organização" }, 400);

    const envAppId = Deno.env.get("META_APP_ID");
    const errors: string[] = [];

    for (const token of tokens) {
      // O app_id precisa ser o dono do token — senão o Meta responde
      // "Object with ID ... does not exist ... missing permissions".
      const appId = (await resolveAppIdForToken(token)) || envAppId;
      if (!appId) {
        errors.push("Não foi possível identificar o App ID do token Meta");
        continue;
      }
      const result = await tryUpload(appId, token, payload);
      if (result.handle) {
        console.log("[meta-template-upload-media] upload ok", { appId, fileName: payload.name });
        return json({ handle: result.handle, file_name: payload.name, file_type: payload.type });
      }
      errors.push(`${appId}: ${result.error}`);
    }

    console.error("[meta-template-upload-media] all attempts failed", errors);
    return json(
      {
        error: `Falha no upload ao Meta. ${errors[0] ?? ""} Verifique se o token Meta tem a permissão do app correto.`,
        details: errors,
      },
      400,
    );
  } catch (err) {
    console.error("[meta-template-upload-media] Unexpected error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
