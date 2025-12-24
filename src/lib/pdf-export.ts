import jsPDF from 'jspdf';
import { AnalysisReport } from '@/hooks/useAnalysisReports';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateOnly } from '@/lib/date-utils';

export function generateAnalysisPDF(report: AnalysisReport) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Helper functions
  const addTitle = (text: string, size = 16) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPos);
    yPos += size * 0.5;
  };

  const addText = (text: string, size = 10) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * size * 0.4 + 5;
  };

  const addSection = (title: string) => {
    checkPageBreak(30);
    yPos += 10;
    doc.setFillColor(59, 130, 246);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin + 5, yPos + 2);
    doc.setTextColor(0, 0, 0);
    yPos += 15;
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addScoreBox = (label: string, score: number, x: number, y: number, width: number) => {
    const color = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : score >= 40 ? [249, 115, 22] : [239, 68, 68];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x, y, width, 25, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(score.toString(), x + width / 2, y + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + width / 2, y + 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  };

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Análise de Atendimento', margin, 25);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Período: ${formatDateOnly(report.period_start)} - ${formatDateOnly(report.period_end)}`,
    margin,
    35
  );
  doc.setTextColor(0, 0, 0);
  yPos = 50;

  // Score Overview
  const boxWidth = (pageWidth - margin * 2 - 25) / 6;
  addScoreBox('Geral', report.overall_score, margin, yPos, boxWidth);
  addScoreBox('Textual', report.textual_quality_score, margin + boxWidth + 5, yPos, boxWidth);
  addScoreBox('Comunicação', report.communication_score, margin + (boxWidth + 5) * 2, yPos, boxWidth);
  addScoreBox('Vendas', report.sales_score, margin + (boxWidth + 5) * 3, yPos, boxWidth);
  addScoreBox('Eficiência', report.efficiency_score, margin + (boxWidth + 5) * 4, yPos, boxWidth);
  addScoreBox('Áudios', report.audio_analysis_score, margin + (boxWidth + 5) * 5, yPos, boxWidth);
  yPos += 35;

  // Statistics
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const stats = `Conversas: ${report.total_conversations} | Mensagens Enviadas: ${report.total_messages_sent} | Mensagens Recebidas: ${report.total_messages_received} | Áudios: ${report.total_audios_analyzed}`;
  doc.text(stats, margin, yPos);
  yPos += 15;

  // Executive Summary
  addSection('Resumo Executivo');
  addText(report.executive_summary);

  // Recommendations
  if (report.recommendations.length > 0) {
    addSection('Recomendações');
    report.recommendations.forEach((rec, i) => {
      checkPageBreak(15);
      addText(`${i + 1}. ${rec}`);
    });
  }

  // Strengths
  if (report.strengths.length > 0) {
    addSection('Pontos Fortes');
    report.strengths.forEach((strength) => {
      checkPageBreak(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`✓ ${strength.title}`, margin, yPos);
      yPos += 7;
      addText(strength.description);
      if (strength.example) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const exampleLines = doc.splitTextToSize(`"${strength.example}"`, pageWidth - margin * 2 - 10);
        doc.text(exampleLines, margin + 10, yPos);
        yPos += exampleLines.length * 4 + 5;
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  // Improvements
  if (report.improvements.length > 0) {
    addSection('Áreas de Melhoria');
    report.improvements.forEach((improvement) => {
      checkPageBreak(40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`⚠ ${improvement.title}`, margin, yPos);
      yPos += 7;
      addText(improvement.description);
      if (improvement.suggestion) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(59, 130, 246);
        doc.text(`Sugestão: ${improvement.suggestion}`, margin + 10, yPos);
        yPos += 7;
        doc.setTextColor(0, 0, 0);
      }
      if (improvement.example) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100, 100, 100);
        const exampleLines = doc.splitTextToSize(`"${improvement.example}"`, pageWidth - margin * 2 - 10);
        doc.text(exampleLines, margin + 10, yPos);
        yPos += exampleLines.length * 4 + 5;
        doc.setTextColor(0, 0, 0);
      }
    });
  }

  // Conversation Details
  if (report.conversation_details.length > 0) {
    addSection('Detalhes por Conversa');
    report.conversation_details.forEach((conv) => {
      checkPageBreak(35);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${conv.contact} - Nota: ${conv.score}`, margin, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      addText(conv.summary);
      if (conv.feedback) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const feedbackLines = doc.splitTextToSize(`Feedback: ${conv.feedback}`, pageWidth - margin * 2 - 10);
        doc.text(feedbackLines, margin + 5, yPos);
        yPos += feedbackLines.length * 3.5 + 5;
        doc.setTextColor(0, 0, 0);
      }
      yPos += 5;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${format(new Date(report.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save - use the raw period strings since they're already in yyyy-MM-dd format
  const filename = `relatorio-analise-${report.period_start}-${report.period_end}.pdf`;
  doc.save(filename);
}
