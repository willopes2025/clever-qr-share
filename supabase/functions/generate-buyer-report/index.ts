// Generates a daily "hot buyers" PDF report for a given objective.
// Body: { objective_id: uuid, triggered_by?: uuid, assignee_user_id?: uuid }
// If assignee_user_id is provided, only that user's deals are included (per-seller PDF).

import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ObjectiveRow {
  id: string;
  organization_id: string;
  funnel_id: string;
  name: string;
  description: string | null;
  prompt: string;
  stage_ids: string[];
  min_score: number;
  max_leads: number;
  lookback_days: number;
}

interface LeadInput {
  deal_id: string;
  contact_name: string;
  phone: string | null;
  stage_name: string;
  value: number | null;
  days_in_stage: number;
  assignee_user_id: string | null;
  last_messages: { direction: string; content: string; at: string }[];
  custom_fields: Record<string, any>;
}

interface LeadAnalysis {
  deal_id: string;
  score: number;
  why_hot: string;
  last_conversation_summary: string[];
  buying_signals: string[];
  suggested_next_step: string;
}

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function analyzeBatch(prompt: string, batch: LeadInput[]): Promise<LeadAnalysis[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not set");

  const systemMsg = `Você é um analista sênior de vendas. ${prompt}

Para cada lead, atribua um score 0-100 representando a probabilidade de compra agora. 0=morto, 50=morno, 80+=quente.
Use APENAS evidências do histórico fornecido. Seja objetivo e prático.`;

  const userMsg = `Analise os ${batch.length} leads abaixo (JSON) e retorne UM objeto por lead via a ferramenta.

${JSON.stringify(batch, null, 2)}`;

  const tool = {
    type: "function",
    function: {
      name: "rank_leads",
      description: "Returns analysis per lead",
      parameters: {
        type: "object",
        properties: {
          leads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                deal_id: { type: "string" },
                score: { type: "integer", minimum: 0, maximum: 100 },
                why_hot: { type: "string", description: "1-2 frases justificando o score" },
                last_conversation_summary: {
                  type: "array", items: { type: "string" },
                  description: "3-5 bullets resumindo a última conversa"
                },
                buying_signals: {
                  type: "array", items: { type: "string" },
                  description: "Frases ou comportamentos que indicam intenção de compra"
                },
                suggested_next_step: { type: "string", description: "Próxima ação concreta para o vendedor" }
              },
              required: ["deal_id", "score", "why_hot", "last_conversation_summary", "buying_signals", "suggested_next_step"]
            }
          }
        },
        required: ["leads"]
      }
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "rank_leads" } },
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        console.error("[buyer-report] AI error", resp.status, txt);
        if (attempt === 0) continue;
        throw new Error(`AI gateway: ${resp.status}`);
      }
      const json = await resp.json();
      const argsStr = json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!argsStr) {
        if (attempt === 0) continue;
        return [];
      }
      const parsed = JSON.parse(argsStr);
      return Array.isArray(parsed.leads) ? parsed.leads : [];
    } catch (e) {
      console.error("[buyer-report] analyze attempt", attempt, e);
      if (attempt === 1) throw e;
    }
  }
  return [];
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 80) return [34, 197, 94]; // green
  if (score >= 60) return [234, 179, 8]; // yellow
  if (score >= 40) return [249, 115, 22]; // orange
  return [148, 163, 184]; // slate
}

function buildPdf(opts: {
  objective: ObjectiveRow;
  orgName: string;
  generatedAt: Date;
  leads: (LeadAnalysis & LeadInput)[];
  forAssignee?: string | null;
}): Uint8Array {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  const ensure = (need: number) => {
    if (y + need > pageH - margin) { doc.addPage(); y = 20; }
  };
  const text = (txt: string, size = 10, bold = false, color: [number, number, number] = [40, 40, 40]) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(txt, pageW - margin * 2);
    ensure(lines.length * size * 0.45 + 2);
    doc.text(lines, margin, y);
    y += lines.length * size * 0.45 + 2;
  };

  // Cover
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20); doc.setFont("helvetica", "bold");
  doc.text("Leads quentes do dia", margin, 22);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text(opts.objective.name, margin, 32);
  doc.setFontSize(9);
  doc.text(`${opts.orgName} • ${opts.generatedAt.toLocaleString("pt-BR")}`, margin, 42);
  y = 60;

  text(`Janela analisada: últimos ${opts.objective.lookback_days} dias`, 10);
  text(`Score mínimo: ${opts.objective.min_score} • Limite: ${opts.objective.max_leads} leads`, 10);
  text(`Total de leads quentes encontrados: ${opts.leads.length}`, 11, true);
  if (opts.forAssignee) text(`Filtrado para vendedor: ${opts.forAssignee}`, 9, false, [100, 100, 100]);
  y += 4;

  // Group by stage
  const byStage = new Map<string, (LeadAnalysis & LeadInput)[]>();
  for (const l of opts.leads) {
    const arr = byStage.get(l.stage_name) || [];
    arr.push(l); byStage.set(l.stage_name, arr);
  }

  for (const [stageName, group] of byStage) {
    ensure(20);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4, pageW - margin * 2, 10, "F");
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text(`${stageName} (${group.length})`, margin + 2, y + 3);
    y += 12;

    for (const l of group) {
      ensure(70);
      // Card box
      const startY = y;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);

      // Header line: name + score badge
      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text(l.contact_name || "Sem nome", margin + 3, y + 2);

      const [r, g, b] = scoreColor(l.score);
      doc.setFillColor(r, g, b);
      doc.roundedRect(pageW - margin - 28, y - 3, 25, 8, 2, 2, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text(`${l.score}/100`, pageW - margin - 15.5, y + 2.5, { align: "center" });

      y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
      const meta = [
        l.phone ? `📱 ${l.phone}` : null,
        l.value ? `💰 R$ ${Number(l.value).toLocaleString("pt-BR")}` : null,
        `⏱ ${l.days_in_stage}d na etapa`,
      ].filter(Boolean).join("  •  ");
      doc.text(meta, margin + 3, y);
      y += 5;

      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Por que é quente:", margin + 3, y); y += 3.5;
      doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
      const why = doc.splitTextToSize(l.why_hot || "—", pageW - margin * 2 - 6);
      ensure(why.length * 4 + 5);
      doc.text(why, margin + 3, y); y += why.length * 4 + 2;

      doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Resumo da última conversa:", margin + 3, y); y += 3.5;
      doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
      for (const bullet of (l.last_conversation_summary || []).slice(0, 6)) {
        const lines = doc.splitTextToSize(`• ${bullet}`, pageW - margin * 2 - 6);
        ensure(lines.length * 4);
        doc.text(lines, margin + 3, y); y += lines.length * 4;
      }
      y += 1;

      if (l.buying_signals?.length) {
        doc.setFont("helvetica", "bold"); doc.setTextColor(34, 197, 94);
        doc.text("Sinais de compra:", margin + 3, y); y += 3.5;
        doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
        for (const s of l.buying_signals.slice(0, 5)) {
          const lines = doc.splitTextToSize(`✓ ${s}`, pageW - margin * 2 - 6);
          ensure(lines.length * 4);
          doc.text(lines, margin + 3, y); y += lines.length * 4;
        }
        y += 1;
      }

      doc.setFont("helvetica", "bold"); doc.setTextColor(59, 130, 246);
      doc.text("Próxima ação:", margin + 3, y); y += 3.5;
      doc.setFont("helvetica", "normal"); doc.setTextColor(51, 65, 85);
      const next = doc.splitTextToSize(l.suggested_next_step || "—", pageW - margin * 2 - 6);
      ensure(next.length * 4 + 3);
      doc.text(next, margin + 3, y); y += next.length * 4 + 2;

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 1, pageW - margin, y + 1);
      y += 6;
    }
  }

  if (opts.leads.length === 0) {
    text("Nenhum lead atingiu o score mínimo neste período.", 11, false, [100, 116, 139]);
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

async function gatherLeadInputs(
  supabase: ReturnType<typeof createClient>,
  obj: ObjectiveRow,
  assigneeFilter?: string | null,
  candidateLimit = 60,
): Promise<LeadInput[]> {
  const since = new Date(Date.now() - obj.lookback_days * 86400000).toISOString();

  let q = supabase
    .from("funnel_deals")
    .select("id, title, value, custom_fields, contact_id, conversation_id, stage_id, responsible_id, entered_stage_at, updated_at")
    .eq("funnel_id", obj.funnel_id)
    .in("stage_id", obj.stage_ids)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (assigneeFilter) q = q.eq("responsible_id", assigneeFilter);

  const { data: rawDeals, error } = await q;
  if (error) throw error;

  const conversationIds = Array.from(new Set((rawDeals || []).map((d: any) => d.conversation_id).filter(Boolean)));
  const conversationActivity = new Map<string, string>();
  for (let i = 0; i < conversationIds.length; i += 200) {
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, last_message_at, updated_at, created_at")
      .in("id", conversationIds.slice(i, i + 200));
    for (const c of conversations || []) {
      conversationActivity.set((c as any).id, (c as any).last_message_at || (c as any).updated_at || (c as any).created_at);
    }
  }

  // Keep deals updated in window OR with conversation active in window, ordered by latest activity.
  const deals = (rawDeals || [])
    .map((d: any) => ({
      ...d,
      activity_at: [d.updated_at, d.conversation_id ? conversationActivity.get(d.conversation_id) : null]
        .filter(Boolean)
        .sort()
        .at(-1) || d.updated_at,
    }))
    .filter((d: any) =>
      (d.updated_at && d.updated_at >= since) ||
      (d.conversation_id && conversationActivity.get(d.conversation_id) && conversationActivity.get(d.conversation_id)! >= since)
    )
    .sort((a: any, b: any) => String(b.activity_at || "").localeCompare(String(a.activity_at || "")))
    .slice(0, candidateLimit);
  console.log(`[buyer-report] selected ${deals.length} candidates from ${(rawDeals || []).length} deals in stages`);
  if (!deals.length) return [];


  const stageMap = new Map<string, string>();
  const { data: stages } = await supabase
    .from("funnel_stages")
    .select("id, name")
    .in("id", obj.stage_ids);
  for (const s of stages || []) stageMap.set((s as any).id, (s as any).name);

  const contactIds = Array.from(new Set(deals.map((d: any) => d.contact_id).filter(Boolean)));
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .in("id", contactIds);
  const contactMap = new Map<string, any>();
  for (const c of contacts || []) contactMap.set((c as any).id, c);

  // Fetch messages in parallel (concurrency 8) to avoid sequential latency
  const CONC = 8;
  const inputs: LeadInput[] = new Array(deals.length);
  const fetchOne = async (d: any, idx: number) => {
    let msgs: any[] = [];
    if (d.conversation_id) {
      const { data: rows } = await supabase
        .from("inbox_messages")
        .select("direction, content, created_at, sent_at, message_type")
        .eq("conversation_id", d.conversation_id)
        .order("created_at", { ascending: false })
        .limit(30);
      msgs = (rows || []).reverse().map((m: any) => ({
        direction: m.direction,
        content: (m.content || `[${m.message_type || "media"}]`).slice(0, 500),
        at: m.sent_at || m.created_at,
      }));
    }
    const enteredAt = d.entered_stage_at ? new Date(d.entered_stage_at) : new Date(d.updated_at);
    const days = Math.max(0, Math.floor((Date.now() - enteredAt.getTime()) / 86400000));
    const c = contactMap.get(d.contact_id);
    inputs[idx] = {
      deal_id: d.id,
      contact_name: c?.name || d.title || "Sem nome",
      phone: c?.phone || null,
      stage_name: stageMap.get(d.stage_id) || "—",
      value: d.value,
      days_in_stage: days,
      assignee_user_id: d.responsible_id,
      last_messages: msgs,
      custom_fields: d.custom_fields || {},
    };
  };
  for (let i = 0; i < deals.length; i += CONC) {
    await Promise.all((deals as any[]).slice(i, i + CONC).map((d, k) => fetchOne(d, i + k)));
  }
  return inputs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const objectiveId = body.objective_id;
    const triggeredBy = body.triggered_by || null;
    const assigneeUserId = body.assignee_user_id || null;

    if (!objectiveId) {
      return new Response(JSON.stringify({ error: "objective_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: obj, error: objErr } = await supabase
      .from("buyer_report_objectives")
      .select("*")
      .eq("id", objectiveId)
      .maybeSingle();
    if (objErr || !obj) throw new Error("Objective not found");

    const { data: org } = await supabase
      .from("organizations").select("name").eq("id", (obj as any).organization_id).maybeSingle();

    // 1. Gather candidate leads (cap to avoid timeout: max 3x max_leads, hard ceiling 60)
    const allInputs = await gatherLeadInputs(supabase, obj as any, assigneeUserId);
    const cap = Math.min(60, Math.max(20, (obj as any).max_leads * 3));
    // Prioritize leads with recent activity (already ordered by updated_at desc) and trim
    const inputs = allInputs.slice(0, cap);
    console.log(`[buyer-report] ${allInputs.length} candidates, analyzing top ${inputs.length}`);

    // 2. Analyze in parallel batches of 8 (concurrency limited to 4)
    const BATCH_SIZE = 8;
    const CONCURRENCY = 4;
    const batches: LeadInput[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
      batches.push(inputs.slice(i, i + BATCH_SIZE));
    }
    const slimify = (b: LeadInput) => ({
      deal_id: b.deal_id,
      contact_name: b.contact_name,
      stage_name: b.stage_name,
      value: b.value,
      days_in_stage: b.days_in_stage,
      last_messages: b.last_messages.slice(-10),
      custom_fields: b.custom_fields,
    });
    const all: LeadAnalysis[] = [];
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const slice = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        slice.map(b => analyzeBatch((obj as any).prompt, b.map(slimify) as any).catch(err => {
          console.error("[buyer-report] batch failed", err);
          return [] as LeadAnalysis[];
        }))
      );
      for (const r of results) all.push(...r);
    }

    // 3. Merge + filter + sort
    const inputMap = new Map(inputs.map(i => [i.deal_id, i]));
    const merged = all
      .filter(a => inputMap.has(a.deal_id) && a.score >= (obj as any).min_score)
      .sort((a, b) => b.score - a.score)
      .slice(0, (obj as any).max_leads)
      .map(a => ({ ...inputMap.get(a.deal_id)!, ...a }));

    // 4. Build PDF
    let assigneeName: string | null = null;
    if (assigneeUserId) {
      const { data: p } = await supabase
        .from("profiles").select("full_name").eq("id", assigneeUserId).maybeSingle();
      assigneeName = (p as any)?.full_name || null;
    }

    const pdf = buildPdf({
      objective: obj as any,
      orgName: (org as any)?.name || "",
      generatedAt: new Date(),
      leads: merged,
      forAssignee: assigneeName,
    });

    // 5. Upload
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = assigneeUserId ? `-u${assigneeUserId.slice(0, 8)}` : "";
    const path = `${(obj as any).organization_id}/${(obj as any).id}/${ts}${suffix}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("buyer-reports")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);

    const { data: signed } = await supabase.storage
      .from("buyer-reports").createSignedUrl(path, 60 * 60 * 24 * 7);

    // 6. Log run (skip when assignee filter — runs are logged per objective in dispatcher)
    let runId: string | null = null;
    if (!assigneeUserId) {
      const { data: run } = await supabase.from("buyer_report_runs").insert({
        objective_id: (obj as any).id,
        organization_id: (obj as any).organization_id,
        triggered_by: triggeredBy,
        leads_count: merged.length,
        pdf_storage_path: path,
        payload: { leads: merged.map(l => ({ deal_id: l.deal_id, score: l.score, stage: l.stage_name })) },
      }).select("id").maybeSingle();
      runId = (run as any)?.id || null;
    }

    return new Response(JSON.stringify({
      success: true, run_id: runId, pdf_path: path, pdf_url: signed?.signedUrl,
      leads_count: merged.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[buyer-report] fatal", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
