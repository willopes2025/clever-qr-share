import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_SIZE = 1000;
const CONTACT_CHUNK_SIZE = 100;
const MAX_SCAN_PAGES = 20;

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { funnel_id, exclude_deal_ids } = await req.json();
    if (!funnel_id) throw new Error("funnel_id is required");

    const excludedDealIds = Array.isArray(exclude_deal_ids)
      ? exclude_deal_ids.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : [];
    const excludedDealIdSet = new Set(excludedDealIds);

    // Load funnel config with new rotation settings
    const { data: funnel, error: funnelError } = await supabase
      .from("funnels")
      .select("id, name, opportunity_prompt, opportunity_message_days, opportunity_rotation_cooldown, opportunity_batch_size, opportunity_include_no_conversation, opportunity_conversation_priority, opportunity_last_batch_number")
      .eq("id", funnel_id)
      .single();
    if (funnelError || !funnel) throw new Error("Funnel not found or access denied");

    const messageDaysLimit = funnel.opportunity_message_days || 30;
    const rotationCooldown = funnel.opportunity_rotation_cooldown ?? 3;
    const targetBatchSize = funnel.opportunity_batch_size || 30;
    const includeNoConversation = funnel.opportunity_include_no_conversation !== false;
    const conversationPriority = funnel.opportunity_conversation_priority || "balanced";
    const currentBatchNumber = (funnel.opportunity_last_batch_number || 0) + 1;
    const sinceDate = new Date(Date.now() - messageDaysLimit * 86400000).toISOString();

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
    const stagesContext = (stages || [])
      .map((s: any, i: number) => {
        const typeLabel = s.final_type === "won"
          ? " (GANHO - etapa final)"
          : s.final_type === "lost"
            ? " (PERDIDO - etapa final)"
            : "";
        return `${i + 1}. ${s.name}${typeLabel}`;
      })
      .join("\n");

    const { data: fieldDefs } = await supabase
      .from("custom_field_definitions")
      .select("field_key, field_name, field_type")
      .eq("entity_type", "deal")
      .eq("user_id", user.id);
    const fieldDefMap = Object.fromEntries((fieldDefs || []).map((f: any) => [f.field_key, f.field_name]));

    // === ROTATION MEMORY: Load recently shown deal IDs ===
    // Get deals shown in the last N batches (cooldown window)
    const cooldownMinBatch = Math.max(1, currentBatchNumber - rotationCooldown);
    const { data: recentHistory } = await supabaseAdmin
      .from("funnel_opportunity_history")
      .select("deal_id")
      .eq("funnel_id", funnel_id)
      .gte("batch_number", cooldownMinBatch);
    
    const recentlyShownDealIds = new Set((recentHistory || []).map((h: any) => h.deal_id));
    
    // Combine exclusions: explicit + cooldown
    const fullExclusionSet = new Set([...excludedDealIdSet, ...recentlyShownDealIds]);

    console.log("[analyze-funnel-opportunities] rotation state", {
      currentBatchNumber,
      cooldownMinBatch,
      recentlyShownCount: recentlyShownDealIds.size,
      explicitExcludeCount: excludedDealIds.length,
      totalExcluded: fullExclusionSet.size,
    });

    // === DEEP SCAN: Collect ALL eligible deals across all pages ===
    const prioritizedDeals: any[] = [];
    const fallbackDeals: any[] = [];
    const scannedEligibleDealIds = new Set<string>();

    for (let page = 0; page < MAX_SCAN_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: pageDeals, error: pageDealsError } = await supabaseAdmin
        .from("funnel_deals")
        .select("id, title, value, stage_id, contact_id, conversation_id, created_at, custom_fields")
        .eq("funnel_id", funnel_id)
        .in("stage_id", openStageIds)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (pageDealsError) throw pageDealsError;
      if (!pageDeals?.length) break;

      // Filter out ALL excluded deals (explicit + cooldown)
      const eligibleDeals = pageDeals.filter((deal: any) => !fullExclusionSet.has(deal.id));

      if (eligibleDeals.length) {
        const contactIds = [...new Set(eligibleDeals.map((deal: any) => deal.contact_id).filter(Boolean))];
        const contactChunks = chunkArray(contactIds, CONTACT_CHUNK_SIZE);
        const conversationResponses = await Promise.all(
          contactChunks.map((contactChunk) =>
            supabaseAdmin
              .from("conversations")
              .select("id, contact_id, last_message_at")
              .in("contact_id", contactChunk)
              .gte("last_message_at", sinceDate)
              .order("last_message_at", { ascending: false })
          )
        );

        const contactConversationMap: Record<string, string> = {};
        for (const response of conversationResponses) {
          if (response.error) throw response.error;
          for (const conversation of response.data || []) {
            if (!contactConversationMap[conversation.contact_id]) {
              contactConversationMap[conversation.contact_id] = conversation.id;
            }
          }
        }

        for (const deal of eligibleDeals) {
          if (scannedEligibleDealIds.has(deal.id)) continue;
          scannedEligibleDealIds.add(deal.id);

          const effectiveConversationId = deal.conversation_id || contactConversationMap[deal.contact_id] || null;
          const enrichedDeal = {
            ...deal,
            effective_conversation_id: effectiveConversationId,
          };

          if (effectiveConversationId) {
            prioritizedDeals.push(enrichedDeal);
          } else {
            fallbackDeals.push(enrichedDeal);
          }
        }
      }

      console.log("[analyze-funnel-opportunities] scanned page", {
        page,
        pageDeals: pageDeals.length,
        eligibleAfterExclusion: eligibleDeals.length,
        prioritizedPool: prioritizedDeals.length,
        fallbackPool: fallbackDeals.length,
      });

      // Don't stop early - scan enough to fill the batch with variety
      // Only stop if we have enough candidates (3x batch for good shuffle diversity)
      if (prioritizedDeals.length + fallbackDeals.length >= targetBatchSize * 3) {
        break;
      }

      if (pageDeals.length < PAGE_SIZE) break;
    }

    // === CHECK EXHAUSTION ===
    const totalEligible = prioritizedDeals.length + fallbackDeals.length;
    if (totalEligible === 0) {
      // Check if this is truly exhausted or just cooldown
      const { count: totalOpenDeals } = await supabaseAdmin
        .from("funnel_deals")
        .select("id", { count: "exact", head: true })
        .eq("funnel_id", funnel_id)
        .in("stage_id", openStageIds);

      const isFullyExhausted = (totalOpenDeals || 0) <= fullExclusionSet.size;
      
      console.log("[analyze-funnel-opportunities] no eligible deals found", {
        totalOpenDeals,
        totalExcluded: fullExclusionSet.size,
        isFullyExhausted,
      });

      return new Response(JSON.stringify({ 
        opportunities: [], 
        exhausted: true,
        canResetCycle: !isFullyExhausted,
        message: isFullyExhausted 
          ? "Todos os leads elegíveis já foram analisados neste ciclo."
          : "Leads em período de resfriamento. Aguarde ou reinicie o ciclo."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === LAYERED SELECTION based on conversation_priority ===
    let deals: any[];
    
    if (conversationPriority === "strong") {
      // Strong: heavily favor deals with conversations
      const withConv = shuffle(prioritizedDeals).slice(0, targetBatchSize);
      const remaining = Math.max(0, targetBatchSize - withConv.length);
      const withoutConv = includeNoConversation ? shuffle(fallbackDeals).slice(0, remaining) : [];
      deals = [...withConv, ...withoutConv].slice(0, targetBatchSize);
    } else if (conversationPriority === "off") {
      // Off: treat all equally
      const allDeals = includeNoConversation 
        ? shuffle([...prioritizedDeals, ...fallbackDeals]) 
        : shuffle(prioritizedDeals);
      deals = allDeals.slice(0, targetBatchSize);
    } else {
      // Balanced (default): 70% with conversation, 30% without
      const withConvSlots = Math.ceil(targetBatchSize * 0.7);
      const withoutConvSlots = targetBatchSize - withConvSlots;
      const withConv = shuffle(prioritizedDeals).slice(0, withConvSlots);
      const remaining = Math.max(0, targetBatchSize - withConv.length);
      const withoutConv = includeNoConversation 
        ? shuffle(fallbackDeals).slice(0, Math.max(withoutConvSlots, remaining)) 
        : [];
      deals = [...withConv, ...withoutConv].slice(0, targetBatchSize);
    }

    if (!deals.length) {
      return new Response(JSON.stringify({ opportunities: [], exhausted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactIds = [...new Set(deals.map((deal: any) => deal.contact_id).filter(Boolean))];
    const { data: contacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id, name, phone, email, contact_display_id")
      .in("id", contactIds);
    if (contactsError) throw contactsError;
    const contactMap = Object.fromEntries((contacts || []).map((contact: any) => [contact.id, contact]));

    const conversationIds = [...new Set(deals.map((deal: any) => deal.effective_conversation_id).filter(Boolean))];
    const messagesMap: Record<string, any[]> = {};

    if (conversationIds.length) {
      const messageResponses = await Promise.all(
        conversationIds.slice(0, targetBatchSize).map((conversationId) =>
          supabase
            .from("inbox_messages")
            .select("content, direction, created_at")
            .eq("conversation_id", conversationId)
            .gte("created_at", sinceDate)
            .order("created_at", { ascending: false })
            .limit(40)
        )
      );

      conversationIds.slice(0, targetBatchSize).forEach((conversationId, index) => {
        const response = messageResponses[index];
        if (response.error) throw response.error;
        if (response.data?.length) {
          messagesMap[conversationId] = response.data.reverse();
        }
      });
    }

    const dealsContext = deals.map((deal: any) => {
      const contact = contactMap[deal.contact_id] || {};
      const messages = deal.effective_conversation_id ? messagesMap[deal.effective_conversation_id] || [] : [];
      const messagesText = messages
        .map((message: any) => `[${message.direction === "outgoing" ? "Vendedor" : "Cliente"}]: ${message.content || "(mídia)"}`)
        .join("\n");

      const customFields: Record<string, any> = {};
      if (deal.custom_fields && typeof deal.custom_fields === "object") {
        for (const [key, value] of Object.entries(deal.custom_fields)) {
          const label = fieldDefMap[key] || key;
          if (value !== null && value !== undefined && value !== "") {
            customFields[label] = value;
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
        has_conversation: messages.length > 0,
        message_count: messages.length,
        conversation_summary: messagesText.slice(-5000),
      };
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const customPrompt = funnel.opportunity_prompt
      ? `\n\nINSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${funnel.opportunity_prompt}`
      : "";

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI error:", status, errorText);
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

    const scoreMap = Object.fromEntries(ranked.map((row: any) => [row.deal_id, row]));
    const results = deals.map((deal: any) => {
      const contact = contactMap[deal.contact_id] || {};
      const aiResult = scoreMap[deal.id] || { score: 0, insight: "Sem dados suficientes para análise" };
      return {
        deal_id: deal.id,
        contact_id: deal.contact_id,
        conversation_id: deal.effective_conversation_id || null,
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

    // === SAVE TO DB: Upsert opportunities ===
    const dealIds = results.map((row: any) => row.deal_id);
    const { data: existingOpps, error: existingOppsError } = await supabaseAdmin
      .from("funnel_opportunities")
      .select("deal_id, user_notes, status")
      .eq("funnel_id", funnel_id)
      .in("deal_id", dealIds);
    if (existingOppsError) throw existingOppsError;

    const existingMap = Object.fromEntries((existingOpps || []).map((row: any) => [row.deal_id, row]));
    const currentDealIds = results.map((row: any) => row.deal_id);

    if (currentDealIds.length) {
      const currentDealIdsList = `(${currentDealIds.join(",")})`;
      const { error: deleteError } = await supabaseAdmin
        .from("funnel_opportunities")
        .delete()
        .eq("funnel_id", funnel_id)
        .not("deal_id", "in", currentDealIdsList);
      if (deleteError) throw deleteError;
    } else {
      const { error: deleteError } = await supabaseAdmin
        .from("funnel_opportunities")
        .delete()
        .eq("funnel_id", funnel_id);
      if (deleteError) throw deleteError;
    }

    const analyzedAt = new Date().toISOString();
    const upsertRows = results.map((row: any) => {
      const existing = existingMap[row.deal_id];
      return {
        funnel_id,
        deal_id: row.deal_id,
        contact_id: row.contact_id,
        conversation_id: row.conversation_id,
        contact_name: row.contact_name,
        contact_phone: row.contact_phone,
        contact_email: row.contact_email,
        contact_display_id: row.contact_display_id,
        stage_name: row.stage_name,
        value: row.value,
        score: row.score,
        insight: row.insight,
        user_notes: existing?.user_notes || null,
        status: existing?.status || "open",
        user_id: user.id,
        analyzed_at: analyzedAt,
      };
    });

    if (upsertRows.length) {
      const { error: upsertError } = await supabaseAdmin
        .from("funnel_opportunities")
        .upsert(upsertRows, { onConflict: "funnel_id,deal_id" });
      if (upsertError) throw upsertError;
    }

    // === SAVE ROTATION HISTORY ===
    const historyRows = results.map((row: any) => ({
      funnel_id,
      deal_id: row.deal_id,
      user_id: user.id,
      batch_number: currentBatchNumber,
      analyzed_at: analyzedAt,
    }));

    if (historyRows.length) {
      const { error: historyError } = await supabaseAdmin
        .from("funnel_opportunity_history")
        .upsert(historyRows, { onConflict: "funnel_id,deal_id,batch_number", ignoreDuplicates: true });
      if (historyError) {
        console.error("Failed to save rotation history:", historyError);
        // Non-blocking - don't fail the whole request
      }
    }

    // Update batch number on funnel
    const { error: updateBatchError } = await supabaseAdmin
      .from("funnels")
      .update({ opportunity_last_batch_number: currentBatchNumber })
      .eq("id", funnel_id);
    if (updateBatchError) {
      console.error("Failed to update batch number:", updateBatchError);
    }

    console.log("[analyze-funnel-opportunities] analysis complete", {
      selectedDeals: deals.length,
      prioritizedDeals: deals.filter((deal: any) => deal.effective_conversation_id).length,
      batchNumber: currentBatchNumber,
      totalEligiblePool: totalEligible,
      exhausted: false,
    });

    return new Response(JSON.stringify({ 
      opportunities: results, 
      exhausted: false,
      batchNumber: currentBatchNumber,
      totalEligible,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
