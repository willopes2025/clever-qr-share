import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { funnel_id } = await req.json();
    if (!funnel_id) throw new Error("funnel_id is required");

    // Verify user owns/belongs to the funnel's org
    const { data: funnel, error: funnelError } = await supabase
      .from("funnels")
      .select("id, name")
      .eq("id", funnel_id)
      .single();
    if (funnelError || !funnel) throw new Error("Funnel not found or access denied");

    // Get open deals (exclude won/lost stages)
    const { data: stages } = await supabase
      .from("funnel_stages")
      .select("id, name, final_type")
      .eq("funnel_id", funnel_id);

    const openStageIds = (stages || [])
      .filter((s: any) => !s.final_type || (s.final_type !== "won" && s.final_type !== "lost"))
      .map((s: any) => s.id);

    if (!openStageIds.length) {
      return new Response(JSON.stringify({ opportunities: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stageMap = Object.fromEntries((stages || []).map((s: any) => [s.id, s.name]));

    const { data: deals } = await supabase
      .from("funnel_deals")
      .select("id, title, value, stage_id, contact_id, conversation_id, created_at")
      .eq("funnel_id", funnel_id)
      .in("stage_id", openStageIds)
      .limit(50);

    if (!deals?.length) {
      return new Response(JSON.stringify({ opportunities: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get contacts
    const contactIds = [...new Set(deals.map((d: any) => d.contact_id).filter(Boolean))];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, phone, email")
      .in("id", contactIds);
    const contactMap = Object.fromEntries((contacts || []).map((c: any) => [c.id, c]));

    // Get messages for deals with conversation_id (last 30 per conversation)
    const conversationIds = [...new Set(deals.map((d: any) => d.conversation_id).filter(Boolean))];
    const messagesMap: Record<string, any[]> = {};

    if (conversationIds.length) {
      for (const convId of conversationIds.slice(0, 30)) {
        const { data: msgs } = await supabase
          .from("inbox_messages")
          .select("content, direction, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(30);
        if (msgs?.length) messagesMap[convId] = msgs.reverse();
      }
    }

    // Build context for AI
    const dealsContext = deals.map((deal: any) => {
      const contact = contactMap[deal.contact_id] || {};
      const messages = deal.conversation_id ? messagesMap[deal.conversation_id] || [] : [];
      const messagesText = messages
        .map((m: any) => `[${m.direction === "outgoing" ? "Vendedor" : "Cliente"}]: ${m.content || "(mídia)"}`)
        .join("\n");

      return {
        deal_id: deal.id,
        contact_name: contact.name || "Sem nome",
        contact_phone: contact.phone || "",
        contact_email: contact.email || "",
        stage: stageMap[deal.stage_id] || "Desconhecida",
        value: deal.value || 0,
        days_open: Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86400000),
        has_conversation: !!messages.length,
        conversation_summary: messagesText.slice(-3000),
      };
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista de vendas especialista. Analise os deals de um funil e retorne um ranking de oportunidades de fechamento.
Para cada deal, avalie:
- Sinais de compra nas mensagens (perguntas sobre preço, prazos, formas de pagamento)
- Engajamento do cliente (frequência e qualidade das respostas)
- Estágio no funil e tempo em aberto
- Valor do deal

Retorne APENAS o JSON usando a tool fornecida.`,
          },
          {
            role: "user",
            content: `Analise estes ${dealsContext.length} deals e ranqueie por probabilidade de fechamento:\n\n${JSON.stringify(dealsContext, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rank_opportunities",
              description: "Retorna o ranking de oportunidades de fechamento.",
              parameters: {
                type: "object",
                properties: {
                  opportunities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        deal_id: { type: "string" },
                        score: { type: "number", description: "Score de 1-100" },
                        insight: { type: "string", description: "Breve justificativa em português (max 150 chars)" },
                      },
                      required: ["deal_id", "score", "insight"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["opportunities"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rank_opportunities" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("Erro ao analisar oportunidades");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let ranked: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        ranked = parsed.opportunities || [];
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    // Merge AI scores with deal/contact data
    const scoreMap = Object.fromEntries(ranked.map((r: any) => [r.deal_id, r]));
    const results = deals.map((deal: any) => {
      const contact = contactMap[deal.contact_id] || {};
      const aiResult = scoreMap[deal.id] || { score: 0, insight: "Sem dados suficientes para análise" };
      return {
        deal_id: deal.id,
        contact_name: contact.name || "Sem nome",
        contact_phone: contact.phone || "",
        contact_email: contact.email || "",
        stage_name: stageMap[deal.stage_id] || "Desconhecida",
        value: deal.value || 0,
        score: aiResult.score,
        insight: aiResult.insight,
      };
    });

    results.sort((a: any, b: any) => b.score - a.score);

    return new Response(JSON.stringify({ opportunities: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
