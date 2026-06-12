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

function fmtBRL(v: number): string {
  if (!v || isNaN(v)) return "R$ 0";
  if (v >= 1000) return "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtNum(v: number): string {
  if (v == null || isNaN(v)) return "0";
  return Number(v).toLocaleString("pt-BR");
}

function secondsToHuman(s: number): string {
  if (!s || s < 0) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
}

function sourceLabel(key: string): string {
  const map: Record<string, string> = {
    manual: "Manual",
    campaign: "Campanha",
    form: "Formulário",
    import: "Importação",
    whatsapp: "WhatsApp",
    webhook: "Webhook",
    api: "API",
    chatbot: "Chatbot",
  };
  return map[(key || "").toLowerCase()] || (key || "Outro");
}

function buildPdf(report: any): Uint8Array {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 20;

  const checkBreak = (need: number) => {
    if (yPos + need > pageHeight - margin) {
      doc.addPage();
      yPos = 20;
    }
  };
  const addText = (text: string, size = 10) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    checkBreak(lines.length * size * 0.45 + 5);
    doc.text(lines, margin, yPos);
    yPos += lines.length * size * 0.45 + 4;
  };
  const addSection = (title: string) => {
    checkBreak(20);
    yPos += 6;
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin + 5, yPos + 2);
    doc.setTextColor(0, 0, 0);
    yPos += 14;
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

  // KPI card with variation arrow
  const addKpiCard = (
    x: number, y: number, w: number, h: number,
    label: string, value: string, variation: number, fmtVariation: (v: number) => string = (v) => `${v > 0 ? "+" : ""}${v}%`,
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, "FD");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(label, x + 4, y + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(value, x + 4, y + 16);
    // variation badge
    const positive = variation >= 0;
    const c = positive ? [34, 197, 94] : [239, 68, 68];
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const arrow = positive ? "^" : "v";
    doc.text(`${arrow} ${fmtVariation(variation)}`, x + 4, y + h - 3);
    doc.setTextColor(0, 0, 0);
  };

  // Simple horizontal bar chart row
  const addBarRow = (label: string, value: number, maxValue: number, x: number, y: number, w: number, color: number[]) => {
    const labelW = 35;
    const barAreaW = w - labelW - 25;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x, y + 3);
    const pct = maxValue > 0 ? value / maxValue : 0;
    doc.setFillColor(241, 245, 249);
    doc.rect(x + labelW, y, barAreaW, 4, "F");
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x + labelW, y, Math.max(1, barAreaW * pct), 4, "F");
    doc.text(fmtNum(value), x + labelW + barAreaW + 3, y + 3);
    doc.setTextColor(0, 0, 0);
  };

  const um = report.usage_metrics || {};
  const kpis = um.kpis || {};
  const volume = um.volume || {};
  const leads = um.leads || {};
  const commercial = um.commercial || {};

  // ============== PAGE 1: CAPA EXECUTIVA ==============
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Painel Executivo", margin, 22);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Periodo: ${brDate(report.period_start)} a ${brDate(report.period_end)}`, margin, 32);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text("Comparativo automatico vs. periodo anterior de mesma duracao", margin, 40);
  doc.setTextColor(0, 0, 0);
  yPos = 55;

  // KPI cards grid (3 per row)
  if (kpis && Object.keys(kpis).length > 0) {
    const cardW = (pageWidth - margin * 2 - 10) / 3;
    const cardH = 26;
    const k = kpis;
    const items = [
      { label: "Leads recebidos", value: fmtNum(k.leads?.current || 0), v: k.leads?.variation || 0 },
      { label: "Conversas atendidas", value: fmtNum(k.conversations?.current || 0), v: k.conversations?.variation || 0 },
      { label: "Mensagens enviadas", value: fmtNum(k.messages_sent?.current || 0), v: k.messages_sent?.variation || 0 },
      { label: "Mensagens recebidas", value: fmtNum(k.messages_received?.current || 0), v: k.messages_received?.variation || 0 },
      { label: "Negocios ganhos", value: fmtNum(k.deals_won?.current || 0), v: k.deals_won?.variation || 0 },
      { label: "Valor ganho", value: fmtBRL(k.won_value?.current || 0), v: k.won_value?.variation || 0 },
      { label: "Taxa de conversao", value: `${k.conversion_rate?.current || 0}%`, v: k.conversion_rate?.variation || 0, fmt: (v: number) => `${v > 0 ? "+" : ""}${v} pts` },
      { label: "Pipeline aberto", value: fmtBRL(commercial.pipeline_value || 0), v: 0, hideVar: true },
      { label: "Ticket medio", value: fmtBRL(commercial.avg_ticket || 0), v: 0, hideVar: true },
    ];
    items.forEach((it, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = margin + col * (cardW + 5);
      const y = yPos + row * (cardH + 5);
      if (it.hideVar) {
        // simplified card sem variação
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(it.label, x + 4, y + 6);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(it.value, x + 4, y + 18);
        doc.setTextColor(0, 0, 0);
      } else {
        addKpiCard(x, y, cardW, cardH, it.label, it.value, it.v, it.fmt);
      }
    });
    yPos += Math.ceil(items.length / 3) * (cardH + 5) + 5;
  }

  // Notas de qualidade da IA
  addSection("Notas de Qualidade do Atendimento (IA)");
  const bw = (pageWidth - margin * 2 - 25) / 6;
  addScoreBox("Geral", report.overall_score || 0, margin, yPos, bw);
  addScoreBox("Textual", report.textual_quality_score || 0, margin + bw + 5, yPos, bw);
  addScoreBox("Comunic.", report.communication_score || 0, margin + (bw + 5) * 2, yPos, bw);
  addScoreBox("Vendas", report.sales_score || 0, margin + (bw + 5) * 3, yPos, bw);
  addScoreBox("Eficiencia", report.efficiency_score || 0, margin + (bw + 5) * 4, yPos, bw);
  addScoreBox("Audios", report.audio_analysis_score || 0, margin + (bw + 5) * 5, yPos, bw);
  yPos += 32;

  // ============== VOLUME E ATIVIDADE ==============
  if (volume && Object.keys(volume).length > 0) {
    addSection("Volume e Atividade");

    // Resumo numerico
    const ch = volume.by_channel || {};
    addText(
      `Mensagens totais: ${fmtNum((kpis.messages_sent?.current || 0) + (kpis.messages_received?.current || 0))}  |  ` +
        `Enviadas: ${fmtNum(kpis.messages_sent?.current || 0)}  |  Recebidas: ${fmtNum(kpis.messages_received?.current || 0)}`,
      10,
    );
    addText(
      `Audios: ${fmtNum(volume.audio_total || 0)} (${fmtNum(volume.audios_transcribed || 0)} transcritos)  |  ` +
        `Midias enviadas: ${fmtNum(volume.media_sent || 0)}`,
      10,
    );
    addText(
      `Canais — WhatsApp Evolution: ${fmtNum((ch.evolution?.sent || 0) + (ch.evolution?.received || 0))} msgs  |  ` +
        `WhatsApp Meta: ${fmtNum((ch.meta?.sent || 0) + (ch.meta?.received || 0))} msgs`,
      10,
    );
    yPos += 3;

    // Volume por dia (mini gráfico de barras)
    const byDay: any[] = Array.isArray(volume.by_day) ? volume.by_day.slice(-14) : [];
    if (byDay.length > 0) {
      checkBreak(byDay.length * 6 + 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Mensagens por dia (ultimos dias)", margin, yPos);
      yPos += 5;
      const maxDay = Math.max(...byDay.map((d: any) => d.sent + d.received), 1);
      for (const d of byDay) {
        const label = brDate(d.date).slice(0, 5);
        addBarRow(label, d.sent + d.received, maxDay, margin, yPos, pageWidth - margin * 2, [59, 130, 246]);
        yPos += 6;
      }
      yPos += 3;
    }

    // Pico de horário
    const byHour: any[] = Array.isArray(volume.by_hour) ? volume.by_hour : [];
    const topHours = byHour.filter((h: any) => h.count > 0).sort((a: any, b: any) => b.count - a.count).slice(0, 5);
    if (topHours.length > 0) {
      checkBreak(topHours.length * 6 + 15);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Horarios de pico (envios)", margin, yPos);
      yPos += 5;
      const maxH = Math.max(...topHours.map((h: any) => h.count), 1);
      for (const h of topHours) {
        addBarRow(`${String(h.hour).padStart(2, "0")}h`, h.count, maxH, margin, yPos, pageWidth - margin * 2, [168, 85, 247]);
        yPos += 6;
      }
      yPos += 3;
    }
  }

  // ============== LEADS E CONTATOS ==============
  if (leads && (leads.total || leads.unanswered || (leads.by_source && Object.keys(leads.by_source).length > 0))) {
    addSection("Leads e Contatos");
    addText(`Novos leads no periodo: ${fmtNum(leads.total || 0)}`, 10);
    addText(`Leads aguardando resposta: ${fmtNum(leads.unanswered || 0)}`, 10);

    const sources = leads.by_source || {};
    const sourceEntries = Object.entries(sources).sort(([, a]: any, [, b]: any) => b - a);
    if (sourceEntries.length > 0) {
      yPos += 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Origem dos leads", margin, yPos);
      yPos += 5;
      const maxS = Math.max(...sourceEntries.map(([, v]: any) => v), 1);
      for (const [k, v] of sourceEntries.slice(0, 8)) {
        addBarRow(sourceLabel(k), v as number, maxS, margin, yPos, pageWidth - margin * 2, [16, 185, 129]);
        yPos += 6;
      }
    }
  }

  // ============== COMERCIAL ==============
  if (commercial && (commercial.deals_total || commercial.pipeline_count)) {
    addSection("Comercial");
    addText(
      `Pipeline aberto: ${fmtNum(commercial.pipeline_count || 0)} negocios — ${fmtBRL(commercial.pipeline_value || 0)}`,
      10,
    );
    addText(
      `Ganhos: ${fmtNum(commercial.won_count || 0)} (${fmtBRL(commercial.won_value || 0)})  |  ` +
        `Perdidos: ${fmtNum(commercial.lost_count || 0)} (${fmtBRL(commercial.lost_value || 0)})`,
      10,
    );
    addText(
      `Taxa de conversao: ${commercial.conversion_rate || 0}%  |  Ticket medio: ${fmtBRL(commercial.avg_ticket || 0)}`,
      10,
    );
  }

  // ============== PRODUTIVIDADE DA EQUIPE ==============
  const team: any[] = Array.isArray(um.team_productivity) ? um.team_productivity : [];
  if (team.length > 0) {
    addSection("Produtividade da Equipe");

    // Top destaques
    const top = team[0];
    if (top) {
      addText(
        `Destaque: ${top.name} — ${fmtNum(top.deals_won || 0)} ganhos (${fmtBRL(top.deals_value || 0)}), ` +
          `${fmtNum(top.messages_sent || 0)} msgs, ${secondsToHuman(top.work_seconds || 0)} logado`,
        10,
      );
      yPos += 2;
    }

    // Table header
    checkBreak(team.length * 6 + 20);
    const colX = {
      rank: margin + 2,
      name: margin + 10,
      hours: margin + 65,
      msgs: margin + 88,
      conv: margin + 108,
      resp: margin + 124,
      won: margin + 142,
      value: margin + 154,
      tasks: margin + 180,
    };
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("#", colX.rank, yPos + 5);
    doc.text("Atendente", colX.name, yPos + 5);
    doc.text("Horas", colX.hours, yPos + 5);
    doc.text("Msgs", colX.msgs, yPos + 5);
    doc.text("Conv.", colX.conv, yPos + 5);
    doc.text("1a Resp", colX.resp, yPos + 5);
    doc.text("Won", colX.won, yPos + 5);
    doc.text("Valor", colX.value, yPos + 5);
    doc.text("Tar.", colX.tasks, yPos + 5);
    yPos += 8;

    team.forEach((u: any, idx: number) => {
      checkBreak(7);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(margin, yPos - 1, pageWidth - margin * 2, 6, "F");
      }
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(String(idx + 1), colX.rank, yPos + 3);
      const nm = (u.name || "—").slice(0, 28);
      doc.text(nm, colX.name, yPos + 3);
      doc.text(secondsToHuman(u.work_seconds || 0), colX.hours, yPos + 3);
      doc.text(fmtNum(u.messages_sent || 0), colX.msgs, yPos + 3);
      doc.text(fmtNum(u.conversations_handled || 0), colX.conv, yPos + 3);
      doc.text(secondsToHuman(u.avg_first_response_seconds || 0), colX.resp, yPos + 3);
      // Won (bold if > 0)
      if ((u.deals_won || 0) > 0) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(34, 197, 94);
      }
      doc.text(fmtNum(u.deals_won || 0), colX.won, yPos + 3);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(fmtBRL(u.deals_value || 0), colX.value, yPos + 3);
      doc.text(fmtNum(u.tasks_completed || 0), colX.tasks, yPos + 3);
      yPos += 6;
    });
    yPos += 4;

    // Totais de presença
    const totals = team.reduce(
      (acc: any, u: any) => {
        acc.work += u.work_seconds || 0;
        acc.brk += u.break_seconds || 0;
        acc.lunch += u.lunch_seconds || 0;
        return acc;
      },
      { work: 0, brk: 0, lunch: 0 },
    );
    if (totals.work + totals.brk + totals.lunch > 0) {
      addText(
        `Tempo total da equipe — Trabalho: ${secondsToHuman(totals.work)} | Pausa: ${secondsToHuman(totals.brk)} | Almoco: ${secondsToHuman(totals.lunch)}`,
        9,
      );
    }

  // ============== COMPARATIVO PERIODO ANTERIOR ==============
  if (kpis && Object.keys(kpis).length > 0) {
    addSection("Comparativo vs. Periodo Anterior");
    const rows: Array<[string, string, string, number, string?]> = [
      ["Leads recebidos", fmtNum(kpis.leads?.current || 0), fmtNum(kpis.leads?.previous || 0), kpis.leads?.variation || 0],
      ["Conversas atendidas", fmtNum(kpis.conversations?.current || 0), fmtNum(kpis.conversations?.previous || 0), kpis.conversations?.variation || 0],
      ["Mensagens enviadas", fmtNum(kpis.messages_sent?.current || 0), fmtNum(kpis.messages_sent?.previous || 0), kpis.messages_sent?.variation || 0],
      ["Mensagens recebidas", fmtNum(kpis.messages_received?.current || 0), fmtNum(kpis.messages_received?.previous || 0), kpis.messages_received?.variation || 0],
      ["Negocios ganhos", fmtNum(kpis.deals_won?.current || 0), fmtNum(kpis.deals_won?.previous || 0), kpis.deals_won?.variation || 0],
      ["Valor ganho", fmtBRL(kpis.won_value?.current || 0), fmtBRL(kpis.won_value?.previous || 0), kpis.won_value?.variation || 0],
      ["Taxa conversao", `${kpis.conversion_rate?.current || 0}%`, `${kpis.conversion_rate?.previous || 0}%`, kpis.conversion_rate?.variation || 0, "pts"],
    ];
    checkBreak(rows.length * 7 + 10);
    // header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text("Indicador", margin + 3, yPos + 5);
    doc.text("Atual", margin + 85, yPos + 5);
    doc.text("Anterior", margin + 115, yPos + 5);
    doc.text("Variacao", margin + 150, yPos + 5);
    yPos += 8;
    for (const r of rows) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(r[0], margin + 3, yPos + 4);
      doc.text(r[1], margin + 85, yPos + 4);
      doc.text(r[2], margin + 115, yPos + 4);
      const v = r[3];
      const unit = r[4] || "%";
      const c = v >= 0 ? [34, 197, 94] : [239, 68, 68];
      doc.setTextColor(c[0], c[1], c[2]);
      doc.setFont("helvetica", "bold");
      doc.text(`${v > 0 ? "+" : ""}${v}${unit === "pts" ? " pts" : "%"}`, margin + 150, yPos + 4);
      doc.setTextColor(40, 40, 40);
      yPos += 6;
    }
    yPos += 3;
  }

  // ============== RESUMO EXECUTIVO IA ==============
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
      doc.setTextColor(34, 197, 94);
      doc.text(`+ ${s.title || ""}`, margin, yPos);
      doc.setTextColor(0, 0, 0);
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
      doc.setTextColor(234, 88, 12);
      doc.text(`! ${im.title || ""}`, margin, yPos);
      doc.setTextColor(0, 0, 0);
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

  // Footer com paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pagina ${i} de ${total}`, pageWidth - margin, pageHeight - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
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
