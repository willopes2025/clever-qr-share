// Sends scheduled analysis PDF reports via WhatsApp.
// Triggered by pg_cron dispatcher with { schedule_id } OR with no body
// (scans all due schedules and processes them).
import { createClient } from "npm:@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREQ_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
};

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function brDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function normalizePhone(raw: string): string {
  let p = (raw || "").replace(/\D/g, "");
  if (!p) return "";
  // Remove DDI 55 inicial p/ trabalhar com nacional
  if (p.startsWith("55") && (p.length === 12 || p.length === 13)) p = p.slice(2);
  // Se for nacional de 10 dígitos (DDD + 8) e DDD válido, adiciona "9" do celular
  if (p.length === 10) {
    const ddd = parseInt(p.slice(0, 2), 10);
    if (ddd >= 11 && ddd <= 99) p = p.slice(0, 2) + "9" + p.slice(2);
  }
  return "55" + p;
}

function nextRunAtFor(frequency: string, baseFromUtcIso: string, sendTime: string): Date {
  const days = FREQ_DAYS[frequency] ?? 7;
  const base = new Date(baseFromUtcIso);
  const next = new Date(base.getTime() + days * 86400000);
  // align to send_time in Sao Paulo (UTC-3, no DST in Brazil since 2019)
  const [hh, mm] = (sendTime || "08:00").split(":").map((n) => parseInt(n, 10));
  // Compute the date components in BRT
  const brt = new Date(next.getTime() - 3 * 3600000);
  const y = brt.getUTCFullYear();
  const mo = brt.getUTCMonth();
  const d = brt.getUTCDate();
  // BRT hh:mm == UTC hh+3:mm
  return new Date(Date.UTC(y, mo, d, hh + 3, mm, 0, 0));
}

function buildPdf(report: any): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  const checkBreak = (need: number) => {
    if (yPos + need > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = 20;
    }
  };
  const addText = (text: string, size = 10) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    checkBreak(lines.length * size * 0.4 + 5);
    doc.text(lines, margin, yPos);
    yPos += lines.length * size * 0.4 + 5;
  };
  const addSection = (title: string) => {
    checkBreak(30);
    yPos += 8;
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 5, yPos + 2);
    doc.setTextColor(0, 0, 0);
    yPos += 15;
  };
  const addScoreBox = (label: string, score: number, x: number, y: number, w: number) => {
    const c = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : score >= 40 ? [249, 115, 22] : [239, 68, 68];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(x, y, w, 25, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(score ?? 0), x + w / 2, y + 10, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, x + w / 2, y + 20, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  // header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatorio de Analise de Atendimento", margin, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periodo: ${brDate(report.period_start)} - ${brDate(report.period_end)}`, margin, 35);
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  const bw = (pageWidth - margin * 2 - 25) / 6;
  addScoreBox("Geral", report.overall_score || 0, margin, yPos, bw);
  addScoreBox("Textual", report.textual_quality_score || 0, margin + bw + 5, yPos, bw);
  addScoreBox("Comunic.", report.communication_score || 0, margin + (bw + 5) * 2, yPos, bw);
  addScoreBox("Vendas", report.sales_score || 0, margin + (bw + 5) * 3, yPos, bw);
  addScoreBox("Eficiencia", report.efficiency_score || 0, margin + (bw + 5) * 4, yPos, bw);
  addScoreBox("Audios", report.audio_analysis_score || 0, margin + (bw + 5) * 5, yPos, bw);
  yPos += 35;

  doc.setFontSize(10);
  doc.text(
    `Conversas: ${report.total_conversations || 0} | Enviadas: ${report.total_messages_sent || 0} | Recebidas: ${report.total_messages_received || 0} | Audios: ${report.total_audios_analyzed || 0}`,
    margin,
    yPos,
  );
  yPos += 12;

  if (report.executive_summary) {
    addSection("Resumo Executivo");
    addText(report.executive_summary);
  }
  if (Array.isArray(report.recommendations) && report.recommendations.length) {
    addSection("Recomendacoes");
    report.recommendations.forEach((r: string, i: number) => addText(`${i + 1}. ${r}`));
  }
  if (Array.isArray(report.strengths) && report.strengths.length) {
    addSection("Pontos Fortes");
    for (const s of report.strengths) {
      checkBreak(20);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`+ ${s.title || ""}`, margin, yPos);
      yPos += 6;
      addText(s.description || "");
    }
  }
  if (Array.isArray(report.improvements) && report.improvements.length) {
    addSection("Areas de Melhoria");
    for (const im of report.improvements) {
      checkBreak(25);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`! ${im.title || ""}`, margin, yPos);
      yPos += 6;
      addText(im.description || "");
      if (im.suggestion) addText(`Sugestao: ${im.suggestion}`, 9);
    }
  }
  if (Array.isArray(report.conversation_details) && report.conversation_details.length) {
    addSection("Detalhes por Conversa");
    for (const c of report.conversation_details) {
      checkBreak(20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${c.contact} - Nota: ${c.score}`, margin, yPos);
      yPos += 6;
      addText(c.summary || "", 9);
      if (c.feedback) addText(`Feedback: ${c.feedback}`, 8);
    }
  }

  const out = doc.output("arraybuffer");
  return new Uint8Array(out);
}

async function waitForReport(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  timeoutMs = 10 * 60 * 1000,
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase
      .from("conversation_analysis_reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();
    if (error) throw error;
    if (data && (data as any).status === "completed") return data;
    if (data && (data as any).status === "error") {
      throw new Error((data as any).error_message || "Report generation failed");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Timeout waiting for report generation");
}

async function processSchedule(
  supabase: ReturnType<typeof createClient>,
  schedule: any,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ ok: boolean; sent: number; error?: string }> {
  console.log("[scheduled-analysis] processing", schedule.id, schedule.name);

  const days = FREQ_DAYS[schedule.frequency] ?? 7;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const periodStart = fmtDate(startDate);
  const periodEnd = fmtDate(endDate);

  // Mark next_run_at first (avoid duplicate runs if work takes a while)
  const newNext = nextRunAtFor(schedule.frequency, new Date().toISOString(), schedule.send_time);
  await supabase
    .from("scheduled_analysis_reports")
    .update({ next_run_at: newNext.toISOString(), last_run_at: new Date().toISOString() })
    .eq("id", schedule.id);

  // Trigger analysis as the creator user (service role can pass any user via Authorization-less invoke if function uses service)
  // analyze-conversations expects the creator's session. We call it with service role key as Authorization (function uses service role acceptable).
  const analyzeResp = await fetch(`${supabaseUrl}/functions/v1/analyze-conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      "x-user-id": schedule.user_id,
    },
    body: JSON.stringify({
      periodStart,
      periodEnd,
      transcribeAudios: schedule.transcribe_audios,
      includeCampaigns: schedule.include_campaigns,
      includeSla: schedule.include_sla,
      userIds: [],
      funnelIds: [],
      tzOffsetMinutes: 180,
      _creatorUserId: schedule.user_id,
    }),
  });

  const analyzeData = await analyzeResp.json().catch(() => ({}));
  const reportId = (analyzeData as any)?.reportId;
  if (!reportId) {
    throw new Error(`analyze-conversations did not return reportId: ${JSON.stringify(analyzeData)}`);
  }

  const report = await waitForReport(supabase, reportId);

  // Generate PDF
  const pdfBytes = buildPdf(report);
  const filePath = `scheduled-analysis/${schedule.organization_id}/${reportId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("inbox-media")
    .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { data: pub } = supabase.storage.from("inbox-media").getPublicUrl(filePath);
  const pdfUrl = pub.publicUrl;

  // Resolve notification instance
  const { data: org } = await supabase
    .from("organizations")
    .select("notification_instance_id, name")
    .eq("id", schedule.organization_id)
    .maybeSingle();

  if (!org?.notification_instance_id) {
    throw new Error("Organização sem instância de notificação configurada");
  }

  const { data: inst } = await supabase
    .from("whatsapp_instances")
    .select("instance_name, evolution_instance_name")
    .eq("id", org.notification_instance_id)
    .maybeSingle();

  if (!inst) throw new Error("Instância de notificação não encontrada");

  const instanceName = ((inst as any).evolution_instance_name || (inst as any).instance_name || "").trim();
  const encodedInstance = encodeURIComponent(instanceName);

  // Recipients: team_members phones for recipient_user_ids
  const recipientIds: string[] = schedule.recipient_user_ids || [];
  if (recipientIds.length === 0) {
    return { ok: true, sent: 0, error: "Sem destinatários" };
  }

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, phone")
    .eq("organization_id", schedule.organization_id)
    .in("user_id", recipientIds)
    .eq("status", "active");

  const fileName = `analise-${periodStart}-${periodEnd}.pdf`;
  const caption =
    `📊 *Relatório de Análise* - ${(org as any).name || ""}\n` +
    `Período: ${brDate(periodStart)} a ${brDate(periodEnd)}\n` +
    `Nota geral: *${report.overall_score || 0}*`;

  let sent = 0;
  for (const m of members || []) {
    const phone = normalizePhone((m as any).phone || "");
    if (!phone) continue;
    try {
      const resp = await fetch(`${evolutionApiUrl}/message/sendMedia/${encodedInstance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({
          number: phone,
          mediatype: "document",
          media: pdfUrl,
          mimetype: "application/pdf",
          fileName,
          caption,
        }),
      });
      const result = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error("[scheduled-analysis] send failed", phone, result);
        continue;
      }
      sent++;
    } catch (e) {
      console.error("[scheduled-analysis] send error", phone, e);
    }
  }

  return { ok: true, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!evolutionApiUrl || !evolutionApiKey) {
    return new Response(JSON.stringify({ error: "Evolution API not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch (_) {
    body = {};
  }

  // Fetch schedules to process
  let schedules: any[] = [];
  if (body?.schedule_id) {
    const { data } = await supabase
      .from("scheduled_analysis_reports")
      .select("*")
      .eq("id", body.schedule_id)
      .maybeSingle();
    if (data) schedules = [data];
  } else {
    const { data } = await supabase
      .from("scheduled_analysis_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString())
      .limit(20);
    schedules = data || [];
  }

  if (schedules.length === 0) {
    return new Response(JSON.stringify({ success: true, processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Run in background to avoid HTTP timeouts
  const task = (async () => {
    for (const s of schedules) {
      try {
        const r = await processSchedule(supabase, s, evolutionApiUrl, evolutionApiKey, supabaseUrl, serviceKey);
        console.log("[scheduled-analysis] result", s.id, r);
      } catch (e) {
        console.error("[scheduled-analysis] failed", s.id, e);
      }
    }
  })();

  // @ts-ignore EdgeRuntime is available in Deno Deploy
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
  else await task;

  return new Response(JSON.stringify({ success: true, processed: schedules.length }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
