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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { funnel_id, exclude_deal_ids } = await req.json();
    if (!funnel_id) throw new Error("funnel_id is required");
    const excludedDealIds = Array.isArray(exclude_deal_ids)
      ? exclude_deal_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];

    const { data: funnel, error: funnelError } = await supabase
      .from("funnels")
      .select("id, name, opportunity_prompt, opportunity_message_days")
      .eq("id", funnel_id)
      .single();
    if (funnelError || !funnel) throw new Error("Funnel not found or access denied");

    const messageDaysLimit = funnel.opportunity_message_days || 30;

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

    let dealsQuery = supabase
      .from("funnel_deals")
      .select("id, title, value, stage_id, contact_id, conversation_id, created_at")
      .eq("funnel_id", funnel_id)
      .in("stage_id", openStageIds)
      .order("created_at", { ascending: true });

    if (excludedDealIds.length) {
      const excludedList = `(${excludedDealIds.map((id) => `"${id}"`).join(",")})`;
      dealsQuery = dealsQuery.not("id", "in", excludedList);
    }

    const { data: deals } = await dealsQuery.limit(50);

    if (!deals?.length) {
      return new Response(JSON.stringify({ opportunities: [], exhausted: excludedDealIds.length > 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactIds = [...new Set(deals.map((d: any) => d.contact_id).filter(Boolean))];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, phone, email, contact_display_id")
      .in("id", contactIds);
    const contactMap = Object.fromEntries((contacts || []).map((c: any) => [c.id, c]));

    const conversationIds = [...new Set(deals.map((d: any) => d.conversation_id).filter(Boolean))];
    const messagesMap: Record<string, any[]> = {};

    if (conversationIds.length) {
      const sinceDate = new Date(Date.now() - messageDaysLimit * 86400000).toISOString();
      for (const convId of conversationIds.slice(0, 30)) {
        const { data: msgs } = await supabase
          .from("inbox_messages")
          .select("content, direction, created_at")
          .eq("conversation_id", convId)
          .gte("created_at", sinceDate)
          .order("created_at", { ascending: false })
          .limit(30);
        if (msgs?.length) messagesMap[convId] = msgs.reverse();
      }
    }

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

    const customPrompt = funnel.opportunity_prompt 
      ? `\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${funnel.opportunity_prompt}` 
      : '';

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
${customPrompt}

Retorne APENAS o JSON usando a tool fornecida.`,
          },
          {
            role: "user",
            content: `Analise estes ${dealsContext.length} deals e ranqueie por probabilidade de fechamento (considerando mensagens dos últimos ${messageDaysLimit} dias):\n\n${JSON.stringify(dealsContext, null, 2)}`,
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
        contact_id: deal.contact_id,
        conversation_id: deal.conversation_id || null,
        contact_name: contact.name || "Sem nome",
        contact_phone: contact.phone || "",
        contact_email: contact.email || "",
        contact_display_id: contact.contact_display_id || null,
        stage_name: stageMap[deal.stage_id] || "Desconhecida",
        value: deal.value || 0,
        score: aiResult.score,
        insight: aiResult.insight,
      };
    });

    results.sort((a: any, b: any) => b.score - a.score);

    // Load existing user_notes and status to preserve them
    const dealIds = results.map((r: any) => r.deal_id);
    const { data: existingOpps } = await supabaseAdmin
      .from("funnel_opportunities")
      .select("deal_id, user_notes, status")
      .eq("funnel_id", funnel_id)
      .in("deal_id", dealIds);
    const existingMap = Object.fromEntries(
      (existingOpps || []).map((o: any) => [o.deal_id, o])
    );

    // Remove stale opportunities not in current analysis
    const currentDealIds = results.map((r: any) => r.deal_id);
    const staleDeleteQuery = supabaseAdmin
      .from("funnel_opportunities")
      .delete()
      .eq("funnel_id", funnel_id);

    if (currentDealIds.length) {
      const currentDealIdsList = `(${currentDealIds.map((id) => `"${id}"`).join(",")})`;
      await staleDeleteQuery.not("deal_id", "in", currentDealIdsList);
    } else {
      await staleDeleteQuery;
    }

    // Upsert results into funnel_opportunities using service role
    const upsertRows = results.map((r: any) => {
      const existing = existingMap[r.deal_id];
      return {
        funnel_id,
        deal_id: r.deal_id,
        contact_id: r.contact_id,
        conversation_id: r.conversation_id,
        contact_name: r.contact_name,
        contact_phone: r.contact_phone,
        contact_email: r.contact_email,
        contact_display_id: r.contact_display_id,
        stage_name: r.stage_name,
        value: r.value,
        score: r.score,
        insight: r.insight,
        user_notes: existing?.user_notes || null,
        status: existing?.status || 'open',
        user_id: user.id,
        analyzed_at: new Date().toISOString(),
      };
    });

    if (upsertRows.length) {
      const { error: upsertError } = await supabaseAdmin
        .from("funnel_opportunities")
        .upsert(upsertRows, { onConflict: "funnel_id,deal_id" });

      if (upsertError) throw upsertError;
    }

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
