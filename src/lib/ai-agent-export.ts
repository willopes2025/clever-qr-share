import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";

export interface AgentExportData {
  agent: {
    id: string;
    agent_name: string;
    is_active: boolean | null;
    template_type?: string | null;
    personality_prompt?: string | null;
    behavior_rules?: string | null;
    greeting_message?: string | null;
    goodbye_message?: string | null;
    fallback_message?: string | null;
    handoff_keywords?: string[] | null;
    response_mode?: string | null;
    response_delay_min?: number | null;
    response_delay_max?: number | null;
    active_hours_start?: number | null;
    active_hours_end?: number | null;
    max_interactions?: number | null;
    pause_emoji?: string | null;
    resume_emoji?: string | null;
  };
  knowledgeItems: Array<{
    id: string;
    title: string;
    source_type: string;
    content?: string | null;
    website_url?: string | null;
    file_name?: string | null;
  }>;
  variables: Array<{
    id: string;
    variable_key: string;
    variable_value?: string | null;
    variable_description?: string | null;
  }>;
  stages: Array<{
    id: string;
    stage_name: string;
    stage_prompt?: string | null;
    order_index: number;
    condition_type: string;
    is_final?: boolean | null;
  }>;
  integrations: Array<{
    id: string;
    name: string;
    integration_type: string;
    is_active?: boolean | null;
    webhook_target_url?: string | null;
    api_base_url?: string | null;
  }>;
}

function formatExportDate(): string {
  return format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function formatExportDateISO(): string {
  return new Date().toISOString();
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9áéíóúàèìòùãõâêîôûç\s-]/gi, "").replace(/\s+/g, "_");
}

export function exportAgentAsJSON(data: AgentExportData): void {
  const exportObject = {
    exportVersion: "1.0",
    exportedAt: formatExportDateISO(),
    agent: {
      name: data.agent.agent_name,
      templateType: data.agent.template_type,
      isActive: data.agent.is_active,
      personalityPrompt: data.agent.personality_prompt,
      behaviorRules: data.agent.behavior_rules,
      greetingMessage: data.agent.greeting_message,
      goodbyeMessage: data.agent.goodbye_message,
      fallbackMessage: data.agent.fallback_message,
      handoffKeywords: data.agent.handoff_keywords,
      responseMode: data.agent.response_mode,
      responseDelayMin: data.agent.response_delay_min,
      responseDelayMax: data.agent.response_delay_max,
      activeHoursStart: data.agent.active_hours_start,
      activeHoursEnd: data.agent.active_hours_end,
      maxInteractions: data.agent.max_interactions,
      pauseEmoji: data.agent.pause_emoji,
      resumeEmoji: data.agent.resume_emoji,
    },
    knowledgeBase: data.knowledgeItems.map((item) => ({
      title: item.title,
      sourceType: item.source_type,
      content: item.content,
      websiteUrl: item.website_url,
      fileName: item.file_name,
    })),
    variables: data.variables.map((v) => ({
      key: v.variable_key,
      value: v.variable_value,
      description: v.variable_description,
    })),
    stages: data.stages.map((s) => ({
      name: s.stage_name,
      prompt: s.stage_prompt,
      orderIndex: s.order_index,
      conditionType: s.condition_type,
      isFinal: s.is_final,
    })),
    integrations: data.integrations.map((i) => ({
      name: i.name,
      type: i.integration_type,
      isActive: i.is_active,
      webhookUrl: i.webhook_target_url,
      apiBaseUrl: i.api_base_url,
    })),
  };

  const jsonString = JSON.stringify(exportObject, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const filename = `agente_${sanitizeFileName(data.agent.agent_name)}_${format(new Date(), "yyyyMMdd_HHmm")}.txt`;
  downloadFile(blob, filename);
}

export function exportAgentAsPDF(data: AgentExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  const addHeader = () => {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DO AGENTE DE IA", margin, yPos);
    yPos += 8;
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Nome: ${data.agent.agent_name}`, margin, yPos);
    yPos += 6;
    doc.setFontSize(10);
    doc.text(`Exportado em: ${formatExportDate()}`, margin, yPos);
    yPos += 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const checkPageBreak = (neededSpace: number = 20) => {
    if (yPos + neededSpace > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addSection = (title: string) => {
    checkPageBreak(25);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(59, 130, 246);
    doc.text(title, margin, yPos);
    yPos += 7;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
  };

  const addField = (label: string, value: string | null | undefined) => {
    if (!value) return;
    checkPageBreak(15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, yPos);
    doc.setFont("helvetica", "normal");
    
    const lines = doc.splitTextToSize(value, contentWidth - 5);
    doc.text(lines, margin + 5, yPos + 5);
    yPos += 5 + lines.length * 5;
  };

  const addBulletItem = (text: string) => {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.text(`• ${text}`, margin + 5, yPos);
    yPos += 5;
  };

  // Header
  addHeader();

  // Configurações Gerais
  addSection("CONFIGURAÇÕES GERAIS");
  addField("Status", data.agent.is_active ? "✓ Ativo" : "✗ Inativo");
  addField("Template", data.agent.template_type || "Personalizado");
  addField("Modo de Resposta", data.agent.response_mode || "Texto");
  if (data.agent.active_hours_start !== null && data.agent.active_hours_end !== null) {
    addField("Horário Ativo", `${String(data.agent.active_hours_start).padStart(2, "0")}:00 - ${String(data.agent.active_hours_end).padStart(2, "0")}:00`);
  }
  if (data.agent.response_delay_min !== null && data.agent.response_delay_max !== null) {
    addField("Delay de Resposta", `${data.agent.response_delay_min}s - ${data.agent.response_delay_max}s`);
  }
  if (data.agent.max_interactions) {
    addField("Máx. Interações", String(data.agent.max_interactions));
  }
  yPos += 5;

  // Personalidade
  if (data.agent.personality_prompt) {
    addSection("PERSONALIDADE");
    const lines = doc.splitTextToSize(data.agent.personality_prompt, contentWidth);
    checkPageBreak(lines.length * 5 + 10);
    doc.setFontSize(10);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 5;
  }

  // Regras de Comportamento
  if (data.agent.behavior_rules) {
    addSection("REGRAS DE COMPORTAMENTO");
    const lines = doc.splitTextToSize(data.agent.behavior_rules, contentWidth);
    checkPageBreak(lines.length * 5 + 10);
    doc.setFontSize(10);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5 + 5;
  }

  // Mensagens
  addSection("MENSAGENS");
  addField("Saudação", data.agent.greeting_message);
  addField("Despedida", data.agent.goodbye_message);
  addField("Fallback", data.agent.fallback_message);
  if (data.agent.handoff_keywords?.length) {
    addField("Keywords de Handoff", data.agent.handoff_keywords.join(", "));
  }
  yPos += 5;

  // Base de Conhecimento
  if (data.knowledgeItems.length > 0) {
    addSection(`BASE DE CONHECIMENTO (${data.knowledgeItems.length} itens)`);
    data.knowledgeItems.forEach((item, index) => {
      addBulletItem(`${index + 1}. ${item.title} (${item.source_type})`);
    });
    yPos += 5;
  }

  // Variáveis
  if (data.variables.length > 0) {
    addSection(`VARIÁVEIS (${data.variables.length} itens)`);
    data.variables.forEach((v) => {
      addBulletItem(`{{${v.variable_key}}}: ${v.variable_value || "(vazio)"}`);
    });
    yPos += 5;
  }

  // Etapas
  if (data.stages.length > 0) {
    addSection(`ETAPAS (${data.stages.length} itens)`);
    data.stages.sort((a, b) => a.order_index - b.order_index).forEach((s, index) => {
      addBulletItem(`${index + 1}. ${s.stage_name}${s.is_final ? " (Final)" : ""}`);
    });
    yPos += 5;
  }

  // Integrações
  if (data.integrations.length > 0) {
    addSection(`INTEGRAÇÕES (${data.integrations.length} itens)`);
    data.integrations.forEach((i) => {
      addBulletItem(`${i.name} (${i.integration_type}) - ${i.is_active ? "Ativo" : "Inativo"}`);
    });
  }

  // Footer
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: "center" });
  }

  const filename = `agente_${sanitizeFileName(data.agent.agent_name)}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`;
  doc.save(filename);
}

export function exportAgentAsWord(data: AgentExportData): void {
  const styles = `
    <style>
      body { font-family: Calibri, sans-serif; margin: 40px; line-height: 1.6; }
      h1 { color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
      h2 { color: #3b82f6; margin-top: 30px; }
      .meta { color: #6b7280; font-size: 14px; margin-bottom: 20px; }
      .section { margin-bottom: 25px; }
      .field { margin-bottom: 10px; }
      .field-label { font-weight: bold; color: #374151; }
      .field-value { color: #4b5563; }
      ul { list-style-type: disc; padding-left: 25px; }
      li { margin-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
      th { background-color: #f3f4f6; font-weight: bold; }
      .status-active { color: #059669; font-weight: bold; }
      .status-inactive { color: #dc2626; }
    </style>
  `;

  const formatField = (label: string, value: string | null | undefined) => {
    if (!value) return "";
    return `<div class="field"><span class="field-label">${label}:</span> <span class="field-value">${value}</span></div>`;
  };

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      ${styles}
    </head>
    <body>
      <h1>Relatório do Agente de IA</h1>
      <div class="meta">
        <strong>Nome:</strong> ${data.agent.agent_name}<br>
        <strong>Exportado em:</strong> ${formatExportDate()}
      </div>

      <div class="section">
        <h2>Configurações Gerais</h2>
        ${formatField("Status", data.agent.is_active ? '<span class="status-active">✓ Ativo</span>' : '<span class="status-inactive">✗ Inativo</span>')}
        ${formatField("Template", data.agent.template_type || "Personalizado")}
        ${formatField("Modo de Resposta", data.agent.response_mode || "Texto")}
        ${data.agent.active_hours_start !== null && data.agent.active_hours_end !== null 
          ? formatField("Horário Ativo", `${String(data.agent.active_hours_start).padStart(2, "0")}:00 - ${String(data.agent.active_hours_end).padStart(2, "0")}:00`)
          : ""
        }
        ${data.agent.response_delay_min !== null && data.agent.response_delay_max !== null 
          ? formatField("Delay de Resposta", `${data.agent.response_delay_min}s - ${data.agent.response_delay_max}s`)
          : ""
        }
        ${data.agent.max_interactions ? formatField("Máx. Interações", String(data.agent.max_interactions)) : ""}
        ${formatField("Emoji de Pausa", data.agent.pause_emoji)}
        ${formatField("Emoji de Retomada", data.agent.resume_emoji)}
      </div>

      ${data.agent.personality_prompt ? `
        <div class="section">
          <h2>Personalidade</h2>
          <p>${data.agent.personality_prompt.replace(/\n/g, "<br>")}</p>
        </div>
      ` : ""}

      ${data.agent.behavior_rules ? `
        <div class="section">
          <h2>Regras de Comportamento</h2>
          <p>${data.agent.behavior_rules.replace(/\n/g, "<br>")}</p>
        </div>
      ` : ""}

      <div class="section">
        <h2>Mensagens</h2>
        ${formatField("Saudação", data.agent.greeting_message)}
        ${formatField("Despedida", data.agent.goodbye_message)}
        ${formatField("Fallback", data.agent.fallback_message)}
        ${data.agent.handoff_keywords?.length ? formatField("Keywords de Handoff", data.agent.handoff_keywords.join(", ")) : ""}
      </div>

      ${data.knowledgeItems.length > 0 ? `
        <div class="section">
          <h2>Base de Conhecimento (${data.knowledgeItems.length} itens)</h2>
          <table>
            <tr><th>#</th><th>Título</th><th>Tipo</th></tr>
            ${data.knowledgeItems.map((item, i) => `
              <tr><td>${i + 1}</td><td>${item.title}</td><td>${item.source_type}</td></tr>
            `).join("")}
          </table>
        </div>
      ` : ""}

      ${data.variables.length > 0 ? `
        <div class="section">
          <h2>Variáveis (${data.variables.length} itens)</h2>
          <table>
            <tr><th>Chave</th><th>Valor</th><th>Descrição</th></tr>
            ${data.variables.map((v) => `
              <tr><td>{{${v.variable_key}}}</td><td>${v.variable_value || "-"}</td><td>${v.variable_description || "-"}</td></tr>
            `).join("")}
          </table>
        </div>
      ` : ""}

      ${data.stages.length > 0 ? `
        <div class="section">
          <h2>Etapas (${data.stages.length} itens)</h2>
          <table>
            <tr><th>Ordem</th><th>Nome</th><th>Tipo</th><th>Final</th></tr>
            ${data.stages.sort((a, b) => a.order_index - b.order_index).map((s) => `
              <tr><td>${s.order_index}</td><td>${s.stage_name}</td><td>${s.condition_type}</td><td>${s.is_final ? "Sim" : "Não"}</td></tr>
            `).join("")}
          </table>
        </div>
      ` : ""}

      ${data.integrations.length > 0 ? `
        <div class="section">
          <h2>Integrações (${data.integrations.length} itens)</h2>
          <table>
            <tr><th>Nome</th><th>Tipo</th><th>Status</th></tr>
            ${data.integrations.map((i) => `
              <tr><td>${i.name}</td><td>${i.integration_type}</td><td>${i.is_active ? "Ativo" : "Inativo"}</td></tr>
            `).join("")}
          </table>
        </div>
      ` : ""}

    </body>
    </html>
  `;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const filename = `agente_${sanitizeFileName(data.agent.agent_name)}_${format(new Date(), "yyyyMMdd_HHmm")}.doc`;
  downloadFile(blob, filename);
}
