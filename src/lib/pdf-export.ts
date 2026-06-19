import jsPDF from 'jspdf';
import { AnalysisReport } from '@/hooks/useAnalysisReports';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// Helpers de formatação (espelham os usados em send-scheduled-analysis)
// ============================================================================
const fmtBRL = (v: number): string => {
  if (!v || isNaN(v)) return 'R$ 0';
  if (v >= 1000) return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const fmtNum = (v: number): string => {
  if (v == null || isNaN(v)) return '0';
  return Number(v).toLocaleString('pt-BR');
};
const secondsToHuman = (s: number): string => {
  if (!s || s < 0) return '—';
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}min`;
  return `${(s / 3600).toFixed(1)}h`;
};
const fmtVariation = (v: number): string => `${v > 0 ? '+' : ''}${v}%`;
const brDate = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const sourceLabel = (k: string): string => {
  const map: Record<string, string> = {
    manual: 'Manual', campaign: 'Campanha', form: 'Formulário',
    import: 'Importação', whatsapp: 'WhatsApp', webhook: 'Webhook',
    api: 'API', chatbot: 'Chatbot',
  };
  return map[(k || '').toLowerCase()] || (k || 'Outro');
};

export function generateAnalysisPDF(report: AnalysisReport) {
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
    doc.setFont('helvetica', 'normal');
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
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPos + 2);
    doc.setTextColor(0, 0, 0);
    yPos += 14;
  };

  const addScoreBox = (label: string, score: number, x: number, y: number, w: number) => {
    const c = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : score >= 40 ? [249, 115, 22] : [239, 68, 68];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(x, y, w, 25, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(String(score ?? 0), x + w / 2, y + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + w / 2, y + 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  const addKpiCard = (
    x: number, y: number, w: number, h: number,
    label: string, value: string, variation: number,
    fmtVar: (v: number) => string = (v) => `${v > 0 ? '+' : ''}${v}%`,
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, w, h, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, y + 6);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 4, y + 16);
    const positive = variation >= 0;
    const c = positive ? [34, 197, 94] : [239, 68, 68];
    doc.setTextColor(c[0], c[1], c[2]);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${positive ? '^' : 'v'} ${fmtVar(variation)}`, x + 4, y + h - 3);
    doc.setTextColor(0, 0, 0);
  };

  const addBarRow = (label: string, value: number, maxValue: number, x: number, y: number, w: number, color: number[]) => {
    const labelW = 35;
    const barAreaW = w - labelW - 25;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(label, x, y + 3);
    const pct = maxValue > 0 ? value / maxValue : 0;
    doc.setFillColor(241, 245, 249);
    doc.rect(x + labelW, y, barAreaW, 4, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x + labelW, y, Math.max(1, barAreaW * pct), 4, 'F');
    doc.text(fmtNum(value), x + labelW + barAreaW + 3, y + 3);
    doc.setTextColor(0, 0, 0);
  };

  const addCallout = (text: string | undefined | null, label = 'Leitura da IA') => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const lines = doc.splitTextToSize(text.trim(), pageWidth - margin * 2 - 10);
    const boxH = lines.length * 4 + 8;
    checkBreak(boxH + 4);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, boxH, 'F');
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos, 2, boxH, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text(label.toUpperCase(), margin + 5, yPos + 4);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(40, 40, 40);
    doc.text(lines, margin + 5, yPos + 8);
    doc.setTextColor(0, 0, 0);
    yPos += boxH + 4;
  };

  const priorityColor = (p: string): number[] => {
    if (p === 'alta') return [239, 68, 68];
    if (p === 'media') return [234, 179, 8];
    return [100, 116, 139];
  };

  // ============================================================================
  const um = (report as any).usage_metrics || {};
  const kpis = um.kpis || {};
  const volume = um.volume || {};
  const leads = um.leads || {};
  const commercial = um.commercial || {};
  const narr = um.ai_narrative || {};

  // CAPA
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Painel Executivo', margin, 22);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Período: ${brDate(report.period_start)} a ${brDate(report.period_end)}`, margin, 32);
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Comparativo automático vs. período anterior de mesma duração', margin, 40);
  doc.setTextColor(0, 0, 0);
  yPos = 55;

  // KPI cards
  if (Object.keys(kpis).length > 0) {
    const cardW = (pageWidth - margin * 2 - 10) / 3;
    const cardH = 26;
    const k = kpis;
    const items: Array<{ label: string; value: string; v: number; hideVar?: boolean; fmt?: (v: number) => string }> = [
      { label: 'Leads recebidos', value: fmtNum(k.leads?.current || 0), v: k.leads?.variation || 0 },
      { label: 'Conversas atendidas', value: fmtNum(k.conversations?.current || 0), v: k.conversations?.variation || 0 },
      { label: 'Mensagens enviadas', value: fmtNum(k.messages_sent?.current || 0), v: k.messages_sent?.variation || 0 },
      { label: 'Mensagens recebidas', value: fmtNum(k.messages_received?.current || 0), v: k.messages_received?.variation || 0 },
      { label: 'Negócios ganhos', value: fmtNum(k.deals_won?.current || 0), v: k.deals_won?.variation || 0 },
      { label: 'Valor ganho', value: fmtBRL(k.won_value?.current || 0), v: k.won_value?.variation || 0 },
      { label: 'Taxa de conversão', value: `${k.conversion_rate?.current || 0}%`, v: k.conversion_rate?.variation || 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} pts` },
      { label: 'Pipeline aberto', value: fmtBRL(commercial.pipeline_value || 0), v: 0, hideVar: true },
      { label: 'Ticket médio', value: fmtBRL(commercial.avg_ticket || 0), v: 0, hideVar: true },
    ];
    items.forEach((it, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const x = margin + col * (cardW + 5);
      const y = yPos + row * (cardH + 5);
      if (it.hideVar) {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.text(it.label, x + 4, y + 6);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(it.value, x + 4, y + 18);
        doc.setTextColor(0, 0, 0);
      } else {
        addKpiCard(x, y, cardW, cardH, it.label, it.value, it.v, it.fmt);
      }
    });
    yPos += Math.ceil(items.length / 3) * (cardH + 5) + 5;
    addCallout(narr.executive_kpis_commentary);
  } else {
    // fallback: stats simples
    doc.setFontSize(10);
    doc.text(`Conversas: ${report.total_conversations} | Enviadas: ${report.total_messages_sent} | Recebidas: ${report.total_messages_received} | Áudios: ${report.total_audios_analyzed}`, margin, yPos);
    yPos += 10;
  }

  // Notas IA
  addSection('Notas de Qualidade do Atendimento (IA)');
  const bw = (pageWidth - margin * 2 - 25) / 6;
  addScoreBox('Geral', report.overall_score || 0, margin, yPos, bw);
  addScoreBox('Textual', report.textual_quality_score || 0, margin + bw + 5, yPos, bw);
  addScoreBox('Comunic.', report.communication_score || 0, margin + (bw + 5) * 2, yPos, bw);
  addScoreBox('Vendas', report.sales_score || 0, margin + (bw + 5) * 3, yPos, bw);
  addScoreBox('Eficiência', report.efficiency_score || 0, margin + (bw + 5) * 4, yPos, bw);
  addScoreBox('Áudios', report.audio_analysis_score || 0, margin + (bw + 5) * 5, yPos, bw);
  yPos += 32;
  if (report.executive_summary) addCallout(report.executive_summary, 'Resumo da IA');

  // Volume
  if (Object.keys(volume).length > 0) {
    addSection('Volume e Atividade');
    const ch = volume.by_channel || {};
    addText(
      `Mensagens totais: ${fmtNum((kpis.messages_sent?.current || 0) + (kpis.messages_received?.current || 0))}  |  ` +
        `Enviadas: ${fmtNum(kpis.messages_sent?.current || 0)}  |  Recebidas: ${fmtNum(kpis.messages_received?.current || 0)}`
    );
    addText(`Áudios: ${fmtNum(volume.audio_total || 0)} (${fmtNum(volume.audios_transcribed || 0)} transcritos)  |  Mídias enviadas: ${fmtNum(volume.media_sent || 0)}`);
    addText(`Canais — Evolution: ${fmtNum((ch.evolution?.sent || 0) + (ch.evolution?.received || 0))} msgs  |  Meta: ${fmtNum((ch.meta?.sent || 0) + (ch.meta?.received || 0))} msgs`);

    const byDay: any[] = Array.isArray(volume.by_day) ? volume.by_day.slice(-14) : [];
    if (byDay.length > 0) {
      checkBreak(byDay.length * 6 + 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Mensagens por dia', margin, yPos);
      yPos += 5;
      const maxDay = Math.max(...byDay.map((d: any) => d.sent + d.received), 1);
      for (const d of byDay) {
        addBarRow(brDate(d.date).slice(0, 5), d.sent + d.received, maxDay, margin, yPos, pageWidth - margin * 2, [59, 130, 246]);
        yPos += 6;
      }
    }

    const byHour: any[] = Array.isArray(volume.by_hour) ? volume.by_hour : [];
    const topHours = byHour.filter((h: any) => h.count > 0).sort((a: any, b: any) => b.count - a.count).slice(0, 5);
    if (topHours.length > 0) {
      yPos += 2;
      checkBreak(topHours.length * 6 + 15);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Horários de pico', margin, yPos);
      yPos += 5;
      const maxH = Math.max(...topHours.map((h: any) => h.count), 1);
      for (const h of topHours) {
        addBarRow(`${String(h.hour).padStart(2, '0')}h`, h.count, maxH, margin, yPos, pageWidth - margin * 2, [168, 85, 247]);
        yPos += 6;
      }
    }
    addCallout(narr.volume_commentary);
  }

  // Leads
  if (leads.total || leads.unanswered || (leads.by_source && Object.keys(leads.by_source).length > 0)) {
    addSection('Leads e Contatos');
    addText(`Novos leads: ${fmtNum(leads.total || 0)}`);
    addText(`Aguardando resposta: ${fmtNum(leads.unanswered || 0)}`);
    const sources = leads.by_source || {};
    const entries = Object.entries(sources).sort(([, a]: any, [, b]: any) => b - a);
    if (entries.length > 0) {
      yPos += 2;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Origem dos leads', margin, yPos);
      yPos += 5;
      const maxS = Math.max(...entries.map(([, v]: any) => v as number), 1);
      for (const [k, v] of entries.slice(0, 8)) {
        addBarRow(sourceLabel(k), v as number, maxS, margin, yPos, pageWidth - margin * 2, [16, 185, 129]);
        yPos += 6;
      }
    }
    addCallout(narr.leads_commentary);
  }

  // Comercial
  if (commercial.deals_total || commercial.pipeline_count) {
    addSection('Comercial');
    addText(`Pipeline aberto: ${fmtNum(commercial.pipeline_count || 0)} negócios — ${fmtBRL(commercial.pipeline_value || 0)}`);
    addText(`Ganhos: ${fmtNum(commercial.won_count || 0)} (${fmtBRL(commercial.won_value || 0)})  |  Perdidos: ${fmtNum(commercial.lost_count || 0)} (${fmtBRL(commercial.lost_value || 0)})`);
    addText(`Taxa de conversão: ${commercial.conversion_rate || 0}%  |  Ticket médio: ${fmtBRL(commercial.avg_ticket || 0)}`);
    addCallout(narr.commercial_commentary);
  }

  // Equipe
  const team: any[] = Array.isArray(um.team_productivity) ? um.team_productivity : [];
  if (team.length > 0) {
    addSection('Produtividade da Equipe');
    const top = team[0];
    if (top) {
      addText(`Destaque: ${top.name} — ${fmtNum(top.deals_won || 0)} ganhos (${fmtBRL(top.deals_value || 0)}), ${fmtNum(top.messages_sent || 0)} msgs, ${secondsToHuman(top.work_seconds || 0)} logado`);
    }
    checkBreak(team.length * 6 + 20);
    const colX = { rank: margin + 2, name: margin + 10, hours: margin + 65, msgs: margin + 88, conv: margin + 108, resp: margin + 124, won: margin + 142, value: margin + 154, tasks: margin + 180 };
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    ['#', 'Atendente', 'Horas', 'Msgs', 'Conv.', '1ª Resp', 'Won', 'Valor', 'Tar.'].forEach((h, i) => {
      const x = [colX.rank, colX.name, colX.hours, colX.msgs, colX.conv, colX.resp, colX.won, colX.value, colX.tasks][i];
      doc.text(h, x, yPos + 5);
    });
    yPos += 8;
    team.forEach((u: any, idx: number) => {
      checkBreak(7);
      if (idx % 2 === 1) {
        doc.setFillColor(250, 251, 253);
        doc.rect(margin, yPos - 1, pageWidth - margin * 2, 6, 'F');
      }
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(String(idx + 1), colX.rank, yPos + 3);
      doc.text((u.name || '—').slice(0, 28), colX.name, yPos + 3);
      doc.text(secondsToHuman(u.work_seconds || 0), colX.hours, yPos + 3);
      doc.text(fmtNum(u.messages_sent || 0), colX.msgs, yPos + 3);
      doc.text(fmtNum(u.conversations_handled || 0), colX.conv, yPos + 3);
      doc.text(secondsToHuman(u.avg_first_response_seconds || 0), colX.resp, yPos + 3);
      if ((u.deals_won || 0) > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 197, 94);
      }
      doc.text(fmtNum(u.deals_won || 0), colX.won, yPos + 3);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(fmtBRL(u.deals_value || 0), colX.value, yPos + 3);
      doc.text(fmtNum(u.tasks_completed || 0), colX.tasks, yPos + 3);
      yPos += 6;
    });
    yPos += 4;
    addCallout(narr.team_commentary);

    const perUser: any[] = Array.isArray(narr.team_per_user) ? narr.team_per_user : [];
    if (perUser.length > 0) {
      const userMap = new Map(team.map((u: any) => [u.user_id, u]));
      checkBreak(10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Coach individual (IA)', margin, yPos);
      yPos += 5;
      doc.setTextColor(0, 0, 0);
      for (const p of perUser) {
        if (!p?.note) continue;
        const u: any = userMap.get(p.user_id);
        const nameLabel = u?.name || 'Atendente';
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`• ${nameLabel}:`, margin + 2, yPos);
        const labelW = doc.getTextWidth(`• ${nameLabel}: `);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(p.note, pageWidth - margin * 2 - labelW - 4);
        checkBreak(lines.length * 4 + 3);
        doc.text(lines, margin + 2 + labelW, yPos);
        yPos += Math.max(4, lines.length * 4) + 2;
      }
      yPos += 3;
    }
  }

  // SLA
  const sla: any = (report as any).sla_performance && Object.keys((report as any).sla_performance).length ? (report as any).sla_performance : (um.sla || {});
  if (sla.conversations_received || sla.avg_first_response_seconds || sla.unanswered_count) {
    addSection('SLA e Qualidade do Atendimento');
    addText(`Conversas recebidas: ${fmtNum(sla.conversations_received || 0)}  |  Respondidas: ${fmtNum(sla.conversations_responded || 0)} (${sla.response_rate || 0}%)`);
    addText(`1ª resposta média: ${secondsToHuman(sla.avg_first_response_seconds || 0)}  |  SLA 15min: ${sla.sla_compliance_15min || 0}%`);
    addText(`Aguardando agora: ${fmtNum(sla.unanswered_count || 0)}  |  Tarefas vencidas: ${fmtNum(sla.overdue_tasks_count || 0)}`);
    const slaItems = [
      { label: 'Quebra 15min', value: sla.breach_15min || 0, color: [234, 179, 8] },
      { label: 'Quebra 1h', value: sla.breach_1h || 0, color: [249, 115, 22] },
      { label: 'Quebra 24h', value: sla.breach_24h || 0, color: [239, 68, 68] },
    ];
    const maxSla = Math.max(...slaItems.map((s) => s.value), 1);
    for (const s of slaItems) {
      addBarRow(s.label, s.value, maxSla, margin, yPos, pageWidth - margin * 2, s.color);
      yPos += 6;
    }
    addCallout(narr.sla_commentary);
  }

  // IA
  const ai = um.ai_usage || {};
  if (ai.ai_handled_conversations !== undefined || ai.chatbot_executions || ai.tokens_consumed) {
    addSection('IA e Automação');
    addText(`Conversas pela IA: ${fmtNum(ai.ai_handled_conversations || 0)} (${ai.ai_share_pct || 0}%)  |  Por humano: ${fmtNum(ai.human_handled_conversations || 0)}`);
    addText(`Interações IA: ${fmtNum(ai.ai_interactions_total || 0)}  |  Handoff: ${fmtNum(ai.handoff_to_human || 0)}`);
    addText(`Chatbot — Execuções: ${fmtNum(ai.chatbot_executions || 0)}  |  Concluídas: ${fmtNum(ai.chatbot_completed || 0)} (${ai.chatbot_completion_rate || 0}%)  |  Erros: ${fmtNum(ai.chatbot_errors || 0)}`);
    addText(`Tokens IA: ${fmtNum(ai.tokens_consumed || 0)}`);
    const totalAH = (ai.ai_handled_conversations || 0) + (ai.human_handled_conversations || 0);
    if (totalAH > 0) {
      const maxAH = Math.max(ai.ai_handled_conversations || 0, ai.human_handled_conversations || 0, 1);
      addBarRow('IA', ai.ai_handled_conversations || 0, maxAH, margin, yPos, pageWidth - margin * 2, [99, 102, 241]);
      yPos += 6;
      addBarRow('Humano', ai.human_handled_conversations || 0, maxAH, margin, yPos, pageWidth - margin * 2, [14, 165, 233]);
      yPos += 6;
    }
    addCallout(narr.ai_commentary);
  }

  // Campanhas
  const camp = um.campaigns || {};
  if (camp.total_campaigns && Array.isArray(camp.detail) && camp.detail.length > 0) {
    addSection('Campanhas — Performance');
    addText(`Total: ${fmtNum(camp.total_campaigns)}  |  Enviadas: ${fmtNum(camp.sent_total || 0)}  |  Entregues: ${fmtNum(camp.delivered_total || 0)} (${camp.delivery_rate || 0}%)  |  Falharam: ${fmtNum(camp.failed_total || 0)} (${camp.fail_rate || 0}%)`);
    const cX = { name: margin + 2, sent: margin + 90, delivered: margin + 112, failed: margin + 142, rate: margin + 165 };
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    ['Campanha', 'Enviadas', 'Entregues', 'Falhas', 'Entrega'].forEach((h, i) => {
      doc.text(h, [cX.name, cX.sent, cX.delivered, cX.failed, cX.rate][i], yPos + 5);
    });
    yPos += 8;
    for (const c of camp.detail as any[]) {
      checkBreak(7);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text((c.name || '—').slice(0, 40), cX.name, yPos + 3);
      doc.text(fmtNum(c.sent), cX.sent, yPos + 3);
      doc.text(fmtNum(c.delivered), cX.delivered, yPos + 3);
      doc.setTextColor((c.fail_rate || 0) > 10 ? 239 : 40, (c.fail_rate || 0) > 10 ? 68 : 40, (c.fail_rate || 0) > 10 ? 68 : 40);
      doc.text(fmtNum(c.failed), cX.failed, yPos + 3);
      const dr = c.delivery_rate || 0;
      const dc = dr >= 90 ? [34, 197, 94] : dr >= 70 ? [234, 179, 8] : [239, 68, 68];
      doc.setTextColor(dc[0], dc[1], dc[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`${dr}%`, cX.rate, yPos + 3);
      doc.setTextColor(40, 40, 40);
      yPos += 6;
    }
    addCallout(narr.campaigns_commentary);

    const campAi = report.campaign_performance?.campaigns || [];
    const withSugg = campAi.filter((c: any) => Array.isArray(c?.suggestions) && c.suggestions.length > 0);
    if (withSugg.length > 0) {
      checkBreak(10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Sugestões por campanha (IA)', margin, yPos);
      yPos += 5;
      for (const c of withSugg) {
        checkBreak(12);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(`• ${(c.name || 'Campanha').slice(0, 60)}`, margin + 2, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        for (const s of c.suggestions.slice(0, 3)) {
          const lines = doc.splitTextToSize(`   – ${s}`, pageWidth - margin * 2 - 6);
          checkBreak(lines.length * 4 + 1);
          doc.text(lines, margin + 4, yPos);
          yPos += lines.length * 4;
        }
        yPos += 2;
      }
    }
  }

  // Funis
  const funnels = report.funnel_performance?.funnels || [];
  if (funnels.length > 0) {
    addSection('Funis e Gargalos');
    for (const f of funnels as any[]) {
      checkBreak(20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(f.name || 'Funil', margin, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(`Deals: ${fmtNum(f.total_deals || 0)}  |  Ganhos: ${fmtNum(f.won_count || 0)}  |  Perdidos: ${fmtNum(f.lost_count || 0)}  |  Win-rate: ${f.won_rate || 0}%  |  Tempo médio: ${f.avg_days_to_close || 0}d`, margin, yPos);
      yPos += 5;
      const bottlenecks: any[] = Array.isArray(f.bottleneck_stages) ? f.bottleneck_stages : [];
      if (bottlenecks.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68);
        doc.text('Top etapas-gargalo:', margin + 2, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        for (const s of bottlenecks.slice(0, 3)) {
          const txt = `   – ${s.name || 'Etapa'} (tempo médio ${s.avg_hours || 0}h)${s.note ? `: ${s.note}` : ''}`;
          const lines = doc.splitTextToSize(txt, pageWidth - margin * 2 - 4);
          checkBreak(lines.length * 4 + 1);
          doc.text(lines, margin + 2, yPos);
          yPos += lines.length * 4;
        }
      }
      const sugg = Array.isArray(f.suggestions) ? f.suggestions : [];
      if (sugg.length > 0) {
        yPos += 1;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text('Sugestões da IA:', margin + 2, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        for (const s of sugg.slice(0, 4)) {
          const lines = doc.splitTextToSize(`   – ${s}`, pageWidth - margin * 2 - 4);
          checkBreak(lines.length * 4 + 1);
          doc.text(lines, margin + 2, yPos);
          yPos += lines.length * 4;
        }
      }
      yPos += 4;
    }
    addCallout(narr.funnel_commentary);
  }

  // Comparativo
  if (Object.keys(kpis).length > 0) {
    addSection('Comparativo vs. Período Anterior');
    const rows: Array<[string, string, string, number, string?]> = [
      ['Leads recebidos', fmtNum(kpis.leads?.current || 0), fmtNum(kpis.leads?.previous || 0), kpis.leads?.variation || 0],
      ['Conversas atendidas', fmtNum(kpis.conversations?.current || 0), fmtNum(kpis.conversations?.previous || 0), kpis.conversations?.variation || 0],
      ['Mensagens enviadas', fmtNum(kpis.messages_sent?.current || 0), fmtNum(kpis.messages_sent?.previous || 0), kpis.messages_sent?.variation || 0],
      ['Mensagens recebidas', fmtNum(kpis.messages_received?.current || 0), fmtNum(kpis.messages_received?.previous || 0), kpis.messages_received?.variation || 0],
      ['Negócios ganhos', fmtNum(kpis.deals_won?.current || 0), fmtNum(kpis.deals_won?.previous || 0), kpis.deals_won?.variation || 0],
      ['Valor ganho', fmtBRL(kpis.won_value?.current || 0), fmtBRL(kpis.won_value?.previous || 0), kpis.won_value?.variation || 0],
      ['Taxa conversão', `${kpis.conversion_rate?.current || 0}%`, `${kpis.conversion_rate?.previous || 0}%`, kpis.conversion_rate?.variation || 0, 'pts'],
    ];
    checkBreak(rows.length * 7 + 10);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, yPos, pageWidth - margin * 2, 7, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Indicador', margin + 3, yPos + 5);
    doc.text('Atual', margin + 85, yPos + 5);
    doc.text('Anterior', margin + 115, yPos + 5);
    doc.text('Variação', margin + 150, yPos + 5);
    yPos += 8;
    for (const r of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(r[0], margin + 3, yPos + 4);
      doc.text(r[1], margin + 85, yPos + 4);
      doc.text(r[2], margin + 115, yPos + 4);
      const v = r[3];
      const unit = r[4] || '%';
      const c = v >= 0 ? [34, 197, 94] : [239, 68, 68];
      doc.setTextColor(c[0], c[1], c[2]);
      doc.setFont('helvetica', 'bold');
      doc.text(`${v > 0 ? '+' : ''}${v}${unit === 'pts' ? ' pts' : '%'}`, margin + 150, yPos + 4);
      doc.setTextColor(40, 40, 40);
      yPos += 6;
    }
  }

  // Resumo executivo IA (caso existam strengths/improvements etc.)
  if (report.recommendations?.length) {
    addSection('Recomendações');
    report.recommendations.forEach((r, i) => addText(`${i + 1}. ${r}`));
  }
  if (report.strengths?.length) {
    addSection('Pontos Fortes');
    for (const s of report.strengths) {
      checkBreak(20);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text(`+ ${s.title}`, margin, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 6;
      addText(s.description || '');
      if (s.example) addText(`"${s.example}"`, 9);
    }
  }
  if (report.improvements?.length) {
    addSection('Áreas de Melhoria');
    for (const im of report.improvements) {
      checkBreak(25);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 88, 12);
      doc.text(`! ${im.title}`, margin, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 6;
      addText(im.description || '');
      if (im.suggestion) addText(`Sugestão: ${im.suggestion}`, 9);
    }
  }
  if (report.conversation_details?.length) {
    addSection('Detalhes por Conversa');
    for (const c of report.conversation_details) {
      checkBreak(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${c.contact} - Nota: ${c.score}`, margin, yPos);
      yPos += 6;
      addText(c.summary || '', 9);
      if (c.feedback) addText(`Feedback: ${c.feedback}`, 8);
    }
  }

  // Plano de ação
  const actions: any[] = Array.isArray(narr.action_plan) ? narr.action_plan : [];
  if (actions.length > 0) {
    addSection('Plano de Ação (IA)');
    const order: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
    const sorted = [...actions].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
    sorted.forEach((a, idx) => {
      checkBreak(28);
      const pc = priorityColor(a.priority || 'baixa');
      doc.setFillColor(pc[0], pc[1], pc[2]);
      doc.circle(margin + 3, yPos + 2, 1.8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const titleLines = doc.splitTextToSize(`${idx + 1}. ${a.title || ''}`, pageWidth - margin * 2 - 10);
      doc.text(titleLines, margin + 8, yPos + 3);
      yPos += titleLines.length * 5 + 1;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(pc[0], pc[1], pc[2]);
      doc.text(`Prioridade: ${String(a.priority || 'baixa').toUpperCase()}${a.owner_hint ? `  •  Sugerido: ${a.owner_hint}` : ''}`, margin + 8, yPos + 3);
      yPos += 5;
      doc.setTextColor(40, 40, 40);
      if (a.why) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Por quê:', margin + 8, yPos + 3);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(a.why, pageWidth - margin * 2 - 20);
        doc.text(lines, margin + 22, yPos + 3);
        yPos += Math.max(4, lines.length * 4) + 1;
      }
      if (a.how) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Como:', margin + 8, yPos + 3);
        doc.setFont('helvetica', 'normal');
        const lines = doc.splitTextToSize(a.how, pageWidth - margin * 2 - 20);
        doc.text(lines, margin + 22, yPos + 3);
        yPos += Math.max(4, lines.length * 4) + 1;
      }
      yPos += 4;
    });
  }

  // Footer
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}  |  Página ${i} de ${total}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  doc.save(`relatorio-analise-${report.period_start}-${report.period_end}.pdf`);
}
