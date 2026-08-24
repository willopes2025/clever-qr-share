import { requireUser, createServiceClient, corsHeaders } from "../_shared/auth.ts";
import { sha256Hex } from "../_shared/public-api.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (!auth.success) return auth.error;

  const userId = auth.userId;

  try {
    const sb = createServiceClient();

    const { data: orgData } = await sb.rpc("get_user_organization_id", {
      _user_id: userId,
    });
    const organizationId = orgData;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "Usuário não possui organização." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      return await handleCreate(req, sb, userId, organizationId);
    }
    if (req.method === "PATCH") {
      return await handlePatch(req, sb, userId);
    }
    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      return await handleDelete(body, sb, userId);
    }
    if (req.method === "GET") {
      return await handleList(req, sb, userId);
    }

    return new Response(
      JSON.stringify({ error: "Método não suportado." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[admin-create-api-key]", e);
    return new Response(
      JSON.stringify({ error: "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleCreate(
  req: Request,
  sb: ReturnType<typeof createServiceClient>,
  userId: string,
  organizationId: string
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return new Response(
      JSON.stringify({ error: "Campo 'name' obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const randomHex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const key = `wz_live_${randomHex}`;
  const prefix = key.slice(0, 12);
  const hash = await sha256Hex(key);

  const expiresAt = body.expires_at ?? null;

  const { data, error } = await sb
    .from("api_keys")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      name,
      key_hash: hash,
      key_prefix: prefix,
      expires_at: expiresAt,
    })
    .select("id, name, key_prefix, created_at, expires_at")
    .single();

  if (error) {
    console.error("[admin-create-api-key] insert error:", error.message);
    return new Response(
      JSON.stringify({ error: "Erro ao criar chave." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      key,
      prefix,
      id: data.id,
      name: data.name,
      created_at: data.created_at,
      expires_at: data.expires_at,
      _notice: "Guarde esta chave. Ela não poderá ser recuperada.",
    }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handlePatch(
  req: Request,
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const keyId = body.key_id;

  if (!keyId) {
    return new Response(
      JSON.stringify({ error: "Campo 'key_id' obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (body.name !== undefined) {
    return await handleRename(body, sb, userId);
  }
  return await handleRevoke(body, sb, userId);
}

async function handleRename(
  body: Record<string, unknown>,
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const keyId = body.key_id as string;
  const name = String(body.name ?? "").trim();

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Campo 'name' obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data, error } = await sb
    .from("api_keys")
    .update({ name })
    .eq("id", keyId)
    .eq("user_id", userId)
    .select("id, name")
    .maybeSingle();

  if (error) {
    console.error("[admin-create-api-key] rename error:", error.message);
    return new Response(
      JSON.stringify({ error: "Erro ao renomear chave." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: "Chave não encontrada." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, renamed: data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(
  body: Record<string, unknown>,
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const keyId = body.key_id as string;

  if (!keyId) {
    return new Response(
      JSON.stringify({ error: "Campo 'key_id' obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: key, error: fetchErr } = await sb
    .from("api_keys")
    .select("id, revoked_at")
    .eq("id", keyId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !key) {
    return new Response(
      JSON.stringify({ error: "Chave não encontrada." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!key.revoked_at) {
    return new Response(
      JSON.stringify({ error: "Revogue a chave antes de deletar." }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error: delErr } = await sb
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", userId);

  if (delErr) {
    console.error("[admin-create-api-key] delete error:", delErr.message);
    return new Response(
      JSON.stringify({ error: "Erro ao deletar chave." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, deleted: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRevoke(
  body: Record<string, unknown>,
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const keyId = body.key_id as string;
  if (!keyId) {
    return new Response(
      JSON.stringify({ error: "Campo 'key_id' obrigatório." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data, error } = await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id, name, key_prefix")
    .maybeSingle();

  if (error) {
    console.error("[admin-create-api-key] revoke error:", error.message);
    return new Response(
      JSON.stringify({ error: "Erro ao revogar chave." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: "Chave não encontrada ou já revogada." }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, revoked: data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleList(
  _req: Request,
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<Response> {
  const { data, error } = await sb
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, expires_at, revoked_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[admin-create-api-key] list error:", error.message);
    return new Response(
      JSON.stringify({ error: "Erro ao listar chaves." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ data: data ?? [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
