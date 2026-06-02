import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { sourceUrl, targetPath, conversationId, instanceId } = await req.json();
    if (!sourceUrl || !targetPath || !conversationId || !instanceId) {
      throw new Error("sourceUrl, targetPath, conversationId, instanceId required");
    }

    // Download original
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Upload to storage with explicit content-type
    const { error: upErr } = await supabase.storage
      .from("inbox-media")
      .upload(targetPath, bytes, {
        contentType: "audio/ogg",
        upsert: true,
      });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("inbox-media").getPublicUrl(targetPath);
    const mediaUrl = pub.publicUrl;

    // Invoke send-inbox-media
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-inbox-media`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        conversationId,
        instanceId,
        mediaUrl,
        mediaType: "audio",
      }),
    });
    const sendBody = await sendRes.json();

    return new Response(JSON.stringify({ ok: true, mediaUrl, send: sendBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
