// Business-language catalog for the "Equipe Digital de IA" (multi-agent) builder.

export interface AgentRoleOption {
  key: string;
  label: string;
  description: string;
  suggestedTools: string[];
}

export const AGENT_ROLES: AgentRoleOption[] = [
  {
    key: "atendimento",
    label: "Atendimento",
    description: "Recebe o cliente, entende o pedido e resolve dúvidas simples.",
    suggestedTools: ["consultar_cliente", "consultar_conhecimento", "transferir_atendimento"],
  },
  {
    key: "sdr",
    label: "Pré-venda (SDR)",
    description: "Qualifica o interesse do lead e agenda o próximo passo.",
    suggestedTools: ["consultar_cliente", "consultar_crm", "criar_oportunidade", "criar_tarefa", "consultar_conhecimento"],
  },
  {
    key: "vendas",
    label: "Vendas",
    description: "Apresenta a proposta, negocia e avança a oportunidade no funil.",
    suggestedTools: ["consultar_cliente", "consultar_crm", "atualizar_lead", "criar_tarefa", "consultar_conhecimento"],
  },
  {
    key: "suporte",
    label: "Suporte",
    description: "Resolve problemas de clientes já ativos e abre tarefas para a equipe.",
    suggestedTools: ["consultar_cliente", "consultar_conhecimento", "criar_tarefa", "transferir_atendimento"],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    description: "Responde sobre cobranças, boletos, vencimentos e segunda via.",
    suggestedTools: ["consultar_cliente", "consultar_financeiro", "transferir_atendimento"],
  },
  {
    key: "pos_venda",
    label: "Pós-venda",
    description: "Acompanha o cliente após a compra e gera novas oportunidades.",
    suggestedTools: ["consultar_cliente", "consultar_crm", "criar_tarefa"],
  },
  {
    key: "outro",
    label: "Outra função",
    description: "Defina livremente o papel deste colaborador digital.",
    suggestedTools: ["consultar_cliente", "consultar_conhecimento"],
  },
];

export interface AgentToolOption {
  key: string;
  label: string;
  description: string;
  writes: boolean;
}

/** Must stay in sync with supabase/functions/_shared/agents/tool-registry.ts */
export const AGENT_TOOLS: AgentToolOption[] = [
  { key: "consultar_cliente", label: "Consultar cliente", description: "Ver dados cadastrais do cliente.", writes: false },
  { key: "consultar_crm", label: "Consultar oportunidades", description: "Ver negócios, etapa e valor no funil.", writes: false },
  { key: "consultar_financeiro", label: "Consultar financeiro", description: "Ver cobranças, vencimentos e links de pagamento.", writes: false },
  { key: "consultar_conhecimento", label: "Consultar conhecimento", description: "Buscar respostas nos materiais da empresa.", writes: false },
  { key: "atualizar_lead", label: "Atualizar oportunidade", description: "Alterar observações, valor e campos do negócio.", writes: true },
  { key: "criar_oportunidade", label: "Criar oportunidade", description: "Abrir um novo negócio no funil.", writes: true },
  { key: "criar_tarefa", label: "Criar tarefa", description: "Delegar uma ação para a equipe humana.", writes: true },
  { key: "transferir_atendimento", label: "Transferir para humano", description: "Passar a conversa para um atendente.", writes: true },
];
