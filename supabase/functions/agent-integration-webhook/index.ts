import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const integrationId = url.searchParams.get("integration_id");
    const token = url.searchParams.get("token");

    console.log(`[Webhook] Received request for integration: ${integrationId}`);

    if (!integrationId || !token) {
      console.error("[Webhook] Missing integration_id or token");
      return new Response(
        JSON.stringify({ error: "Missing integration_id or token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch integration and validate token
    const { data: integration, error: fetchError } = await supabase
      .from("ai_agent_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("webhook_token", token)
      .eq("integration_type", "webhook_in")
      .single();

    if (fetchError || !integration) {
      console.error("[Webhook] Invalid integration or token:", fetchError);
      return new Response(
        JSON.stringify({ error: "Invalid integration_id or token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration.is_active) {
      console.log("[Webhook] Integration is inactive");
      return new Response(
        JSON.stringify({ error: "Integration is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse payload
    let payload: Record<string, any> = {};
    let eventType = "unknown";

    try {
      if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
        const contentType = req.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          payload = await req.json();
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const formData = await req.formData();
          for (const [key, value] of formData.entries()) {
            payload[key] = value;
          }
        } else {
          payload = { raw: await req.text() };
        }
      }

      // Try to detect event type from common webhook patterns
      eventType = payload.event || payload.type || payload.action || payload.event_type || "webhook_received";
      
      console.log(`[Webhook] Event type: ${eventType}`, JSON.stringify(payload).slice(0, 500));
    } catch (parseError) {
      console.error("[Webhook] Error parsing payload:", parseError);
      payload = { parse_error: String(parseError) };
    }

    // Log the webhook call
    const { error: logError } = await supabase
      .from("ai_agent_webhook_logs")
      .insert({
        integration_id: integrationId,
        user_id: integration.user_id,
        direction: "in",
        event_type: eventType,
        payload,
      });

    if (logError) {
      console.error("[Webhook] Error logging webhook:", logError);
    }

    // Update last_used_at
    await supabase
      .from("ai_agent_integrations")
      .update({ last_used_at: new Date().toISOString(), last_error: null })
      .eq("id", integrationId);

    // TODO: Process the webhook data
    // This could trigger agent actions, update variables, etc.
    // For now, we just log and acknowledge receipt

    console.log(`[Webhook] Successfully processed webhook for integration ${integrationId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook received successfully",
        event_type: eventType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Webhook] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
