import { requireUser, createServiceClient, corsHeaders } from "../_shared/auth.ts";

function generateHmacSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireUser(req);
  if (!auth.success) return auth.error;

  const userId = auth.userId;

  try {
    const sb = createServiceClient();
    const body = await req.json().catch(() => ({}));

    if (req.method === "GET") {
      return await handleList(sb, userId);
    }
    if (req.method === "POST" && body.action === "test") {
      return await handleTest(sb, userId, body);
    }
    if (req.method === "POST" && body.action === "regenerate-secret") {
      return await handleRegenerateSecret(sb, userId, body);
    }
    if (req.method === "POST") {
      return await handleCreate(sb, userId, body);
    }
    if (req.method === "PATCH") {
      return await handleUpdate(sb, userId, body);
    }
    if (req.method === "DELETE") {
      return await handleDelete(sb, userId, body);
    }

    return new Response(
      JSON.stringify({ error: "Metodo nao suportado" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[admin-webhook-config]", e);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleList(sb: ReturnType<typeof createServiceClient>, userId: string) {
  const { data, error } = await sb
    .from("webhook_connections")
    .select("id, name, direction, target_url, is_active, events, last_sent_at, last_received_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return new Response(
    JSON.stringify({ data: data ?? [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleCreate(sb: ReturnType<typeof createServiceClient>, userId: string, body: Record<string, unknown>) {
  const name = String(body.name ?? "").trim();
  const targetUrl = body.target_url ? String(body.target_url).trim() : null;
  const events = Array.isArray(body.events) ? body.events.map(String) : [];

  if (!name) {
    return new Response(
      JSON.stringify({ error: "Campo 'name' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Campo 'target_url' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const hmacSecret = generateHmacSecret();

  const { data, error } = await sb
    .from("webhook_connections")
    .insert({
      user_id: userId,
      name,
      direction: "out",
      target_url: targetUrl,
      events,
      hmac_secret: hmacSecret,
    })
    .select("id, name, target_url, events, hmac_secret, created_at")
    .single();

  if (error) throw error;

  return new Response(
    JSON.stringify({ ...data, _notice: "Guarde o HMAC secret. Ele so sera exibido uma vez." }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleUpdate(sb: ReturnType<typeof createServiceClient>, userId: string, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "Campo 'id' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.target_url !== undefined) updates.target_url = body.target_url;
  if (body.events !== undefined) updates.events = body.events;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await sb
    .from("webhook_connections")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, name, target_url, events, is_active")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return new Response(
      JSON.stringify({ error: "Webhook nao encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, updated: data }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(sb: ReturnType<typeof createServiceClient>, userId: string, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "Campo 'id' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { error } = await sb
    .from("webhook_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true, deleted: true }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRegenerateSecret(sb: ReturnType<typeof createServiceClient>, userId: string, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "Campo 'id' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const newSecret = generateHmacSecret();

  const { data, error } = await sb
    .from("webhook_connections")
    .update({ hmac_secret: newSecret })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, hmac_secret")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return new Response(
      JSON.stringify({ error: "Webhook nao encontrado" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, hmac_secret: data.hmac_secret, _notice: "Novo secret gerado. Guarde-o." }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleTest(sb: ReturnType<typeof createServiceClient>, userId: string, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) {
    return new Response(
      JSON.stringify({ error: "Campo 'id' obrigatorio" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: conn, error: fetchErr } = await sb
    .from("webhook_connections")
    .select("id, target_url, hmac_secret")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !conn || !conn.target_url) {
    return new Response(
      JSON.stringify({ error: "Webhook nao encontrado ou sem URL de destino" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const timestamp = new Date().toISOString();
  const payload = { event: "webhook.test", timestamp, data: { message: "Teste de webhook do WideZap" } };
  const bodyStr = JSON.stringify(payload);

  let signature = "";
  if (conn.hmac_secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(conn.hmac_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(bodyStr));
    signature = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(conn.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Webhook-Event": "webhook.test",
        "X-Webhook-Signature": signature ? `sha256=${signature}` : "",
        "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
        "X-Webhook-ID": crypto.randomUUID(),
      },
      body: bodyStr,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const respBody = await resp.text().catch(() => "");

    await sb.from("webhook_logs").insert({
      connection_id: conn.id,
      user_id: userId,
      direction: "out",
      action: "webhook.test",
      event_type: "webhook.test",
      status: resp.ok ? "success" : "failed",
      request_payload: payload,
      response_payload: { status: resp.status, body: respBody.slice(0, 1000) },
      response_status: resp.status,
      signature,
      attempt: 1,
    });

    await sb.from("webhook_connections").update({ last_sent_at: new Date().toISOString() }).eq("id", conn.id);

    return new Response(
      JSON.stringify({ success: resp.ok, status: resp.status, body: respBody.slice(0, 500) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    await sb.from("webhook_logs").insert({
      connection_id: conn.id,
      user_id: userId,
      direction: "out",
      action: "webhook.test",
      event_type: "webhook.test",
      status: "failed",
      request_payload: payload,
      error_message: errMsg.slice(0, 500),
      signature,
      attempt: 1,
    });

    return new Response(
      JSON.stringify({ success: false, error: errMsg.slice(0, 200) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
