import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const ACTIVE_META_APP_ID = "25248752291487782";

type TokenInspection = { appId: string | null; error?: string; code?: number };

/** Descobre o app_id usando uma credencial de aplicativo, como exigido pelo debug_token. */
async function resolveAppIdForToken(token: string): Promise<TokenInspection> {
  try {
    const appSecret = Deno.env.get("META_WHATSAPP_APP_SECRET") ?? "";
    const appAccessToken = appSecret ? `${ACTIVE_META_APP_ID}|${appSecret}` : token;
    const res = await fetch(
      `${GRAPH_API_BASE}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccessToken)}`,
    );
    const json = await res.json();
    const appId = json?.data?.app_id;
    if (res.ok && appId) return { appId: String(appId) };
    return {
      appId: null,
      error: json?.error?.message || "A Meta não retornou o aplicativo do token",
      code: json?.error?.code,
    };
  } catch (err) {
    console.error("[meta-template-upload-media] debug_token failed", err);
    return { appId: null, error: err instanceof Error ? err.message : "Falha ao validar token" };
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

/** Resolve apenas o token da conta escolhida, evitando credenciais de outra WABA. */
async function getTokenForWaba(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
  wabaId: string,
): Promise<{ token: string | null; label: string; phoneNumberId: string | null }> {
  const { data: numbers, error: numbersError } = await admin
    .from("meta_whatsapp_numbers")
    .select("phone_number_id, phone_number, display_name")
    .in("user_id", userIds)
    .eq("waba_id", wabaId)
    .eq("is_active", true);
  if (numbersError || !numbers?.length) {
    return { token: null, label: `WABA ...${wabaId.slice(-6)}`, phoneNumberId: null };
  }

  const phoneNumberIds = numbers.map((row: { phone_number_id: string }) => row.phone_number_id);
  const { data: numberTokens } = await admin
    .from("meta_number_tokens")
    .select("access_token, phone_number_id")
    .in("user_id", userIds)
    .in("phone_number_id", phoneNumberIds)
    .limit(1)
    .maybeSingle();
  const first = numbers[0] as { phone_number?: string; display_name?: string };
  return {
    token: numberTokens?.access_token ?? null,
    label: first.display_name || first.phone_number || `WABA ...${wabaId.slice(-6)}`,
    phoneNumberId: numberTokens?.phone_number_id ?? phoneNumberIds[0] ?? null,
  };
}

async function validateTokenForNumber(token: string, phoneNumberId: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/${phoneNumberId}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (res.ok && body?.id) return null;
    return body?.error?.message || "O token não possui acesso ao número selecionado";
  } catch (err) {
    return err instanceof Error ? err.message : "Falha ao validar acesso ao número";
  }
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
    const wabaId = String(formData.get("wabaId") ?? "").trim();
    if (!file) return json({ error: "Arquivo não enviado" }, 400);
    if (!/^\d{5,30}$/.test(wabaId)) return json({ error: "Selecione uma conta Meta válida antes do upload" }, 400);

    const buffer = await file.arrayBuffer();
    const payload = {
      buffer,
      name: file.name || "upload",
      type: file.type || "application/octet-stream",
    };

    const userIds = await getOrgUserIds(supabaseClient, user.id);
    const { token, label, phoneNumberId } = await getTokenForWaba(admin, userIds, wabaId);
    if (!token) {
      return json({ error: `A conta Meta “${label}” não possui um token exclusivo configurado. Atualize o token desse número nas configurações Meta.` }, 400);
    }

    if (!phoneNumberId) {
      return json({ error: `Nenhum número ativo foi encontrado para a conta Meta “${label}”.` }, 400);
    }

    const tokenError = await validateTokenForNumber(token, phoneNumberId);
    if (tokenError) {
      console.error("[meta-template-upload-media] number token rejected", { wabaId, phoneNumberId, error: tokenError });
      return json({ error: `O token da conta Meta “${label}” expirou, foi revogado ou não tem acesso ao número selecionado. Atualize o token nas configurações Meta. Detalhe: ${tokenError}` }, 400);
    }

    const inspection = await resolveAppIdForToken(token);
    if (!inspection.appId) {
      console.error("[meta-template-upload-media] app inspection failed", { wabaId, phoneNumberId, code: inspection.code, error: inspection.error });
      const deletedApp = /application has been deleted|aplicativo.*exclu[ií]do/i.test(inspection.error ?? "");
      return json({
        error: deletedApp
          ? `O token da conta Meta “${label}” pertence a um aplicativo excluído. Reconecte esse número por um aplicativo Meta ativo.`
          : `A Meta não permitiu identificar o aplicativo da conta “${label}”. Atualize o token permanente com as permissões whatsapp_business_management e whatsapp_business_messaging. Detalhe: ${inspection.error ?? "erro desconhecido"}`,
      }, 400);
    }
    const appId = inspection.appId;
    const result = await tryUpload(appId, token, payload);
    if (result.handle) {
      console.log("[meta-template-upload-media] upload ok", { appId, wabaId, fileName: payload.name });
      return json({ handle: result.handle, file_name: payload.name, file_type: payload.type });
    }

    const metaError = result.error ?? "Falha desconhecida no Meta";
    console.error("[meta-template-upload-media] upload failed", { appId, wabaId, error: metaError });
    if (/application has been deleted|aplicativo.*exclu[ií]do/i.test(metaError)) {
      return json({
        error: `O token da conta Meta “${label}” foi emitido por um aplicativo excluído. Gere um novo token permanente em um App Meta ativo e atualize o token desse número nas configurações Meta.`,
      }, 400);
    }
    return json(
      {
        error: `A Meta recusou o upload para a conta “${label}”: ${metaError}`,
      },
      400,
    );
  } catch (err) {
    console.error("[meta-template-upload-media] Unexpected error", err);
    return json({ error: (err as Error).message }, 500);
  }
});
