import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { orchestrate } from "../_shared/agents/orchestrator.ts";
import { RunLogger } from "../_shared/agents/run-logger.ts";
import type { AgentContext } from "../_shared/agents/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    const body = await req.json().catch(() => ({}));
    const { message, conversation_id, contact_id, history } = body ?? {};
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'message' é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve the requesting user: either an authenticated call from the app
    // or an internal call carrying an explicit user_id (service context).
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    }
    if (!userId && body?.user_id) userId = String(body.user_id);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: organizationId } = await admin.rpc("resolve_user_organization_id", { _user_id: userId });
    if (!organizationId) throw new Error("Empresa não identificada para este usuário.");

    const { data: memberRows } = await admin.rpc("get_organization_member_ids", { _user_id: userId });
    const memberIds: string[] = Array.isArray(memberRows)
      ? memberRows.map((r: any) => (typeof r === "string" ? r : r.get_organization_member_ids ?? r))
      : [userId];

    let resolvedContactId: string | null = contact_id ?? null;
    if (!resolvedContactId && conversation_id) {
      const { data: conv } = await admin
        .from("conversations")
        .select("contact_id, user_id")
        .eq("id", conversation_id)
        .maybeSingle();
      if (conv && !memberIds.includes(conv.user_id)) throw new Error("Conversa fora da sua empresa.");
      resolvedContactId = conv?.contact_id ?? null;
    }

    const ctx: AgentContext = {
      organizationId,
      memberIds: memberIds.length ? memberIds : [userId],
      conversationId: conversation_id ?? null,
      contactId: resolvedContactId,
      userId,
    };

    const logger = new RunLogger(admin, organizationId);
    await logger.start({
      conversationId: ctx.conversationId,
      contactId: ctx.contactId,
      incomingMessage: message,
    });

    try {
      const result = await orchestrate({ supabase: admin, apiKey, ctx, message, history, logger });
      await logger.finish({
        status: "completed",
        finalAgentId: result.agentId,
        intent: result.intent,
        response: result.response,
        totalTokens: result.tokens,
      });
      return new Response(JSON.stringify({ ...result, run_id: logger.runId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      await logger.finish({ status: "failed", error: msg });
      throw err;
    }
  } catch (error) {
    console.error("ai-orchestrate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
