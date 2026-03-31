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

    // Fetch stages with order for context
    const { data: stages } = await supabase
      .from("funnel_stages")
      .select("id, name, final_type, order_index")
      .eq("funnel_id", funnel_id)
      .order("order_index", { ascending: true });

    const openStageIds = (stages || [])
      .filter((s: any) => !s.final_type || (s.final_type !== "won" && s.final_type !== "lost"))
      .map((s: any) => s.id);

    if (!openStageIds.length) {
      return new Response(JSON.stringify({ opportunities: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stageMap = Object.fromEntries((stages || []).map((s: any) => [s.id, s.name]));

    // Build stages context for AI prompt
    const stagesContext = (stages || [])
      .map((s: any, i: number) => {
        const typeLabel = s.final_type === "won" ? " (GANHO - etapa final)" 
          : s.final_type === "lost" ? " (PERDIDO - etapa final)" 
          : "";
        return `${i + 1}. ${s.name}${typeLabel}`;
      })
      .join("\n");

    // Fetch custom field definitions for this user
    const { data: fieldDefs } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_name, field_type")
      .eq("entity_type", "deal")
      .eq("user_id", user.id);
    const fieldDefMap = Object.fromEntries(
      (fieldDefs || []).map((f: any) => [f.field_key, f.field_name])
    );

    // Fetch deals - include custom_fields, reduced to 30
    let dealsQuery = supabase
      .from("funnel_deals")
      .select("id, title, value, stage_id, contact_id, conversation_id, created_at, custom_fields")
      .eq("funnel_id", funnel_id)
      .in("stage_id", openStageIds)
      .order("created_at", { ascending: true });

    if (excludedDealIds.length) {
      const excludedList = `(${excludedDealIds.map((id) => `"${id}"`).join(",")})`;
      dealsQuery = dealsQuery.not("id", "in", excludedList);
    }

    const { data: deals } = await dealsQuery.limit(30);

    if (!deals?.length) {
      return new Response(JSON.stringify({ opportunities: [], exhausted: excludedDealIds.length > 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contacts
    const contactIds = [...new Set(deals.map((d: any) => d.contact_id).filter(Boolean))];
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, phone, email, contact_display_id")
      .in("id", contactIds);
    const contactMap = Object.fromEntries((contacts || []).map((c: any) => [c.id, c]));

    // Fetch conversation messages
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
          .limit(40);
        if (msgs?.length) messagesMap[convId] = msgs.reverse();
      }
    }

    // Build deal contexts with custom fields
    const dealsContext = deals.map((deal: any) => {
      const contact = contactMap[deal.contact_id] || {};
      const messages = deal.conversation_id ? messagesMap[deal.conversation_id] || [] : [];
      const messagesText = messages
        .map((m: any) => `[${m.direction === "outgoing" ? "Vendedor" : "Cliente"}]: ${m.content || "(mídia)"}`)
        .join("\n");

      // Format custom fields with readable names
      const customFields: Record<string, any> = {};
      if (deal.custom_fields && typeof deal.custom_fields === "object") {
        for (const [key, val] of Object.entries(deal.custom_fields)) {
          const label = fieldDefMap[key] || key;
          if (val !== null && val !== undefined && val !== "") {
            customFields[label] = val;
          }
        }
      }

      return {
        deal_id: deal.id,
        contact_name: contact.name || "Sem nome",
        contact_phone: contact.phone || "",
        contact_email: contact.email || "",
        stage: stageMap[deal.stage_id] || "Desconhecida",
        value: deal.value || 0,
        custom_fields: Object.keys(customFields).length ? customFields : undefined,
        days_open: Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86400000),
        has_conversation: !!messages.length,
        message_count: messages.length,
        conversation_summary: messagesText.slice(-5000),
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
            content: `Você é um analista de vendas especialista que avalia oportunidades de fechamento com base em EVIDÊNCIAS CONCRETAS.

ETAPAS DO FUNIL (da primeira à última):
${stagesContext}

Para cada deal, avalie criteriosamente:

1. SINAIS DE COMPRA nas mensagens:
   - Perguntas sobre preço, prazos, formas de pagamento → score alto
   - Pedido de proposta ou orçamento → score alto
   - Respostas curtas ou genéricas → score médio-baixo
   - Sem conversa → score baixo (máximo 25)

2. CAMPOS PERSONALIZADOS do negócio:
   - Dados preenchidos (local, data, valor, etc.) indicam lead qualificado
   - Quanto mais informações preenchidas, maior a maturidade

3. ENGAJAMENTO do cliente:
   - Frequência e qualidade das respostas
   - Cliente que responde rápido e faz perguntas = alta probabilidade
   - Cliente que não responde há dias = baixa probabilidade

4. POSIÇÃO NO FUNIL:
   - Leads em etapas mais avançadas devem ter score maior
   - Leads parados na mesma etapa há muitos dias sem interação = score reduzido

5. VALOR DO DEAL:
   - Considere o valor como indicador de prioridade (deals maiores merecem atenção)

REGRAS DE SCORING:
- Score 80-100: Sinais claros de compra, engajamento ativo, dados completos
- Score 50-79: Interesse demonstrado mas sem confirmação, algum engajamento
- Score 25-49: Pouco engajamento, dados incompletos, conversa fria
- Score 1-24: Sem conversa, sem dados, lead frio ou abandonado
- NUNCA dê score alto sem evidência concreta nas mensagens ou dados

Gere insights EM PORTUGUÊS que citem evidências específicas (ex: "Cliente perguntou sobre pagamento dia 25/03").
${customPrompt}

Retorne APENAS o JSON usando a tool fornecida.`,
          },
          {
            role: "user",
            content: `Analise estes ${dealsContext.length} deals do funil "${funnel.name}" e ranqueie por probabilidade de fechamento (mensagens dos últimos ${messageDaysLimit} dias):\n\n${JSON.stringify(dealsContext, null, 2)}`,
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
                        score: { type: "number", description: "Score de 1-100 baseado em evidências" },
                        insight: { type: "string", description: "Breve justificativa com evidências em português (max 200 chars)" },
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
