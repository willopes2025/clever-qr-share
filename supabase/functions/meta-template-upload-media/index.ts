import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

async function getAccessToken(supabaseClient: ReturnType<typeof createClient>, userId: string) {
  const { data: integration } = await supabaseClient
    .from("integrations")
    .select("credentials")
    .eq("user_id", userId)
    .eq("provider", "meta_whatsapp")
    .eq("is_active", true)
    .maybeSingle();

  const creds = integration?.credentials as { access_token?: string } | null;
  return creds?.access_token || Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Arquivo não enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken(supabaseClient, user.id);
    const appId = Deno.env.get("META_APP_ID");

    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Token Meta não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!appId) {
      return new Response(JSON.stringify({ error: "META_APP_ID não configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileLength = fileBuffer.byteLength;
    const fileType = file.type || "application/octet-stream";
    const fileName = file.name || "upload";

    console.log("[meta-template-upload-media] Starting upload session", {
      fileName, fileType, fileLength, userId: user.id,
    });

    // 1) Create upload session
    const sessionUrl = `${GRAPH_API_BASE}/${appId}/uploads?file_length=${fileLength}&file_type=${encodeURIComponent(fileType)}&file_name=${encodeURIComponent(fileName)}&access_token=${accessToken}`;

    const sessionRes = await fetch(sessionUrl, { method: "POST" });
    const sessionJson = await sessionRes.json();

    if (!sessionRes.ok || !sessionJson.id) {
      console.error("[meta-template-upload-media] Session error", sessionJson);
      return new Response(
        JSON.stringify({ error: sessionJson.error?.message || "Falha ao iniciar upload no Meta", details: sessionJson }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionId = sessionJson.id as string; // formato "upload:XYZ"

    // 2) Upload file bytes
    const uploadRes = await fetch(`${GRAPH_API_BASE}/${sessionId}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
      },
      body: fileBuffer,
    });
    const uploadJson = await uploadRes.json();

    if (!uploadRes.ok || !uploadJson.h) {
      console.error("[meta-template-upload-media] Upload error", uploadJson);
      return new Response(
        JSON.stringify({ error: uploadJson.error?.message || "Falha ao enviar arquivo ao Meta", details: uploadJson }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[meta-template-upload-media] Success, handle obtained");

    return new Response(
      JSON.stringify({ handle: uploadJson.h, file_name: fileName, file_type: fileType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[meta-template-upload-media] Unexpected error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
