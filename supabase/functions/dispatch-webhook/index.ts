import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function createSb() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

async function hmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createSb();
    const { event_type, payload, user_id } = await req.json();

    if (!event_type || !user_id) {
      return new Response(
        JSON.stringify({ error: "event_type e user_id obrigatorios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connections, error: connErr } = await sb
      .from("webhook_connections")
      .select("id, target_url, hmac_secret, events, user_id")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .not("target_url", "is", null);

    if (connErr) throw connErr;

    const matching = (connections ?? []).filter(
      (c) => c.events && c.events.includes(event_type)
    );

    if (matching.length === 0) {
      return new Response(
        JSON.stringify({ dispatched: 0, message: "Nenhum webhook ativo para este evento" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestamp = new Date().toISOString();
    const bodyStr = JSON.stringify({ event: event_type, timestamp, data: payload });

    const results = [];

    for (const conn of matching) {
      let signature = "";
      if (conn.hmac_secret) {
        signature = await hmacSha256(conn.hmac_secret, bodyStr);
      }

      const deliveryId = crypto.randomUUID();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(conn.target_url!, {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Webhook-Event": event_type,
            "X-Webhook-Signature": signature ? `sha256=${signature}` : "",
            "X-Webhook-Timestamp": Math.floor(Date.now() / 1000).toString(),
            "X-Webhook-ID": deliveryId,
          },
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const respBody = await resp.text().catch(() => "");

        await sb.from("webhook_logs").insert({
          id: deliveryId,
          connection_id: conn.id,
          user_id: conn.user_id,
          direction: "out",
          action: event_type,
          event_type,
          status: resp.ok ? "success" : "failed",
          request_payload: JSON.parse(bodyStr),
          response_payload: { status: resp.status, body: respBody.slice(0, 1000) },
          response_status: resp.status,
          signature,
          attempt: 1,
        });

        await sb
          .from("webhook_connections")
          .update({ last_sent_at: new Date().toISOString() })
          .eq("id", conn.id);

        results.push({ connection_id: conn.id, status: resp.ok ? "success" : "failed", status_code: resp.status });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        await sb.from("webhook_logs").insert({
          id: deliveryId,
          connection_id: conn.id,
          user_id: conn.user_id,
          direction: "out",
          action: event_type,
          event_type,
          status: "failed",
          request_payload: JSON.parse(bodyStr),
          error_message: errMsg.slice(0, 500),
          signature,
          attempt: 1,
        });

        results.push({ connection_id: conn.id, status: "failed", error: errMsg.slice(0, 200) });
      }
    }

    return new Response(
      JSON.stringify({ dispatched: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[dispatch-webhook]", e);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
