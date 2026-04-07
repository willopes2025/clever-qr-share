import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_KNOWLEDGE = `Você é o Wil, o assistente virtual interno da plataforma de automação e CRM para WhatsApp.

# Seu Papel
- Ajudar os usuários a usar o sistema de forma eficiente
- Responder perguntas sobre funcionalidades
- Orientar sobre melhores práticas
- Analisar dados e métricas do usuário quando solicitado
- **EXECUTAR AÇÕES** no sistema quando solicitado (criar automações, listas, campanhas, etc.)

# Módulos do Sistema

## 📱 Instâncias (WhatsApp)
- Conectar números de WhatsApp via QR Code
- Gerenciar múltiplas instâncias
- Monitorar status de conexão
- Aquecimento de números (warming)

## 💬 Inbox (Caixa de Entrada)
- Atendimento centralizado de WhatsApp
- Transcrição automática de áudios
- Assistente IA para sugerir respostas
- Notas e tarefas por conversa
- Atribuição para membros da equipe

## 📢 Campanhas
- Disparo de mensagens em massa
- Templates com variáveis personalizadas
- Agendamento de envios
- Controle de intervalos e limites
- Modo de envio (sequencial/rotativo)

## 👥 Contatos
- Gestão completa de contatos
- Campos personalizados
- Sistema de tags e etiquetas
- Importação em massa
- Histórico de interações

## 📋 Listas de Transmissão
- Segmentação de contatos
- Listas dinâmicas com filtros
- Listas manuais
- Gerenciamento de membros

## 📝 Templates
- Modelos de mensagem reutilizáveis
- Variáveis dinâmicas ({{nome}}, etc)
- Organização por categorias

## 🎯 Funis (CRM)
- Pipeline visual de vendas
- Stages personalizáveis
- Automações por movimento
- Valores e métricas de negócios
- Tarefas por deal

## 📅 Calendário
- Integração com Calendly
- Agendamentos automáticos
- Visualização de eventos

## 🤖 Chatbots
- Fluxos visuais de conversação
- Nós: mensagem, condição, delay, webhook
- Triggers automáticos
- Integração com IA

## 🧠 Agentes IA
- Atendentes virtuais inteligentes
- Base de conhecimento personalizada
- Stages de conversa configuráveis
- Handoff para humanos
- Webhooks e integrações

## 🔥 Warming (Aquecimento)
- Aquecimento automático de números
- Diferentes tipos de interação
- Métricas de aquecimento

## 📊 Dashboard e Análises
- Métricas de conversas
- Relatórios de desempenho
- Análise de campanhas
- SLA e tempo de resposta

## 📝 Formulários
- Criação de formulários de captura
- Campos personalizados
- Webhooks de notificação
- Link público compartilhável

## 💰 Financeiro
- Integração com Asaas
- Gestão de cobranças
- Status de pagamentos

## 👥 Equipe (Team)
- Gestão de membros
- Papéis e permissões
- Organizações

# Diretrizes de Uso de Ferramentas
- Quando o usuário pedir para CRIAR algo (automação, lista, campanha), use as ferramentas disponíveis
- SEMPRE liste as opções disponíveis ANTES de criar (ex: liste funis antes de criar automação)
- SEMPRE confirme com o usuário antes de executar ações de criação
- Para consultas, use as ferramentas de listagem livremente sem pedir permissão
- Quando criar algo, informe o que foi criado com detalhes

# Diretrizes de Resposta
- Seja amigável e prestativo
- Responda sempre em português brasileiro
- Forneça passos claros e numerados quando orientar
- Use emojis moderadamente para tornar a conversa amigável
- Quando tiver dados do usuário, cite-os especificamente
- Se não souber algo, seja honesto e sugira alternativas
- Mantenha respostas concisas mas completas`;

// ---- Tool definitions for OpenAI ----
const tools = [
  {
    type: "function",
    function: {
      name: "list_funnels",
      description: "Lista todos os funis do usuário com suas etapas (stages). Use para obter IDs antes de criar automações.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_automations",
      description: "Lista automações existentes de um funil específico.",
      parameters: {
        type: "object",
        properties: { funnel_id: { type: "string", description: "ID do funil" } },
        required: ["funnel_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_automation",
      description: "Cria uma automação em um funil. Trigger types: on_stage_enter, on_funnel_enter, on_message_received, on_contact_created, on_existing_deals, on_scheduled_before_date_field. Action types: move_stage, send_message, add_tag, move_to_funnel, notify_user, activate_ai, trigger_chatbot_flow, change_responsible, ai_analyze_and_move.",
      parameters: {
        type: "object",
        properties: {
          funnel_id: { type: "string", description: "ID do funil" },
          stage_id: { type: "string", description: "ID do stage onde o trigger se aplica (se aplicável)" },
          name: { type: "string", description: "Nome da automação" },
          trigger_type: { type: "string", description: "Tipo de trigger" },
          trigger_config: { type: "object", description: "Configuração do trigger (JSON)" },
          action_type: { type: "string", description: "Tipo de ação" },
          action_config: { type: "object", description: "Configuração da ação (JSON). Para move_stage: {target_stage_id}. Para send_message: {message, instance_id}. Para add_tag: {tag_id}. Para move_to_funnel: {target_funnel_id, target_stage_id}. Para activate_ai: {agent_config_id}." },
        },
        required: ["funnel_id", "name", "trigger_type", "action_type", "action_config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_broadcast_lists",
      description: "Lista todas as listas de transmissão do usuário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_broadcast_list",
      description: "Cria uma nova lista de transmissão.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da lista" },
          description: { type: "string", description: "Descrição da lista" },
          type: { type: "string", enum: ["manual", "dynamic"], description: "Tipo: manual ou dynamic" },
          filter_criteria: { type: "object", description: "Critérios de filtro para listas dinâmicas (JSON)" },
        },
        required: ["name", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_contacts",
      description: "Busca contatos do usuário com filtros opcionais. Retorna até 20 resultados.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Busca por nome ou telefone" },
          tag_id: { type: "string", description: "Filtrar por tag ID" },
          limit: { type: "number", description: "Limite de resultados (máx 50, padrão 20)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_templates",
      description: "Lista os templates de mensagem disponíveis do usuário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_instances",
      description: "Lista as instâncias de WhatsApp conectadas do usuário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tags",
      description: "Lista todas as tags disponíveis do usuário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria uma nova campanha de disparo de mensagens. Requer list_id, template_id e instance_id.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da campanha" },
          list_id: { type: "string", description: "ID da lista de transmissão" },
          template_id: { type: "string", description: "ID do template de mensagem" },
          instance_id: { type: "string", description: "ID da instância WhatsApp para envio" },
          scheduled_at: { type: "string", description: "Data/hora de agendamento ISO 8601 (opcional)" },
          message_interval_min: { type: "number", description: "Intervalo mínimo entre mensagens em segundos (padrão 5)" },
          message_interval_max: { type: "number", description: "Intervalo máximo entre mensagens em segundos (padrão 15)" },
        },
        required: ["name", "list_id", "template_id", "instance_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_ai_agents",
      description: "Lista os agentes de IA configurados pelo usuário.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ---- Tool execution functions ----
async function executeTool(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case "list_funnels": {
        const { data: funnels } = await supabase
          .from("funnels")
          .select("id, name, description, color")
          .eq("user_id", userId)
          .order("display_order");
        
        if (!funnels?.length) return JSON.stringify({ message: "Nenhum funil encontrado." });
        
        const result = [];
        for (const funnel of funnels) {
          const { data: stages } = await supabase
            .from("funnel_stages")
            .select("id, name, display_order, is_final, final_type")
            .eq("funnel_id", funnel.id)
            .order("display_order");
          result.push({ ...funnel, stages: stages || [] });
        }
        return JSON.stringify(result);
      }

      case "list_automations": {
        const { data } = await supabase
          .from("funnel_automations")
          .select("id, name, trigger_type, action_type, is_active, stage_id")
          .eq("funnel_id", args.funnel_id)
          .eq("user_id", userId);
        return JSON.stringify(data || []);
      }

      case "create_automation": {
        const { data, error } = await supabase
          .from("funnel_automations")
          .insert({
            user_id: userId,
            funnel_id: args.funnel_id,
            stage_id: args.stage_id || null,
            name: args.name,
            trigger_type: args.trigger_type,
            trigger_config: args.trigger_config || {},
            action_type: args.action_type,
            action_config: args.action_config || {},
            is_active: true,
          })
          .select("id, name")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, automation: data });
      }

      case "list_broadcast_lists": {
        const { data } = await supabase
          .from("broadcast_lists")
          .select("id, name, description, type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        return JSON.stringify(data || []);
      }

      case "create_broadcast_list": {
        const { data, error } = await supabase
          .from("broadcast_lists")
          .insert({
            user_id: userId,
            name: args.name,
            description: args.description || null,
            type: args.type || "manual",
            filter_criteria: args.filter_criteria || null,
          })
          .select("id, name, type")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, list: data });
      }

      case "list_contacts": {
        const limit = Math.min(Number(args.limit) || 20, 50);
        let query = supabase
          .from("contacts")
          .select("id, name, phone, email, status, created_at")
          .eq("user_id", userId)
          .limit(limit);

        if (args.search) {
          query = query.or(`name.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
        }

        if (args.tag_id) {
          const { data: taggedIds } = await supabase
            .from("contact_tags")
            .select("contact_id")
            .eq("tag_id", args.tag_id);
          if (taggedIds?.length) {
            query = query.in("id", taggedIds.map((t: { contact_id: string }) => t.contact_id));
          } else {
            return JSON.stringify([]);
          }
        }

        const { data } = await query.order("created_at", { ascending: false });
        return JSON.stringify(data || []);
      }

      case "list_templates": {
        const { data } = await supabase
          .from("message_templates")
          .select("id, name, content, category, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        return JSON.stringify(data || []);
      }

      case "list_instances": {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("id, name, phone_number, status, connection_status")
          .eq("user_id", userId);
        return JSON.stringify(data || []);
      }

      case "list_tags": {
        const { data } = await supabase
          .from("tags")
          .select("id, name, color")
          .eq("user_id", userId)
          .order("name");
        return JSON.stringify(data || []);
      }

      case "create_campaign": {
        // Count contacts in list
        const { count } = await supabase
          .from("broadcast_list_contacts")
          .select("*", { count: "exact", head: true })
          .eq("list_id", args.list_id);

        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            user_id: userId,
            name: args.name,
            list_id: args.list_id,
            template_id: args.template_id,
            instance_id: args.instance_id,
            scheduled_at: args.scheduled_at || null,
            message_interval_min: args.message_interval_min || 5,
            message_interval_max: args.message_interval_max || 15,
            total_contacts: count || 0,
            status: args.scheduled_at ? "scheduled" : "draft",
          })
          .select("id, name, status")
          .single();
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ success: true, campaign: data, total_contacts: count || 0 });
      }

      case "list_ai_agents": {
        const { data } = await supabase
          .from("ai_agent_configs")
          .select("id, agent_name, is_active, template_type, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        return JSON.stringify(data || []);
      }

      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
    }
  } catch (err) {
    console.error(`Tool execution error (${toolName}):`, err);
    return JSON.stringify({ error: `Erro ao executar ${toolName}: ${err instanceof Error ? err.message : String(err)}` });
  }
}

// ---- Fetch user context ----
async function fetchUserContext(supabase: ReturnType<typeof createClient>, userId: string): Promise<string> {
  let ctx = "";
  try {
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", userId).single();
    if (profile) ctx += `\n# Dados do Usuário\n- Nome: ${profile.full_name || "Não informado"}\n- Email: ${profile.email || "Não informado"}\n`;

    const { data: sub } = await supabase.from("subscriptions").select("plan_id, status, leads_used, leads_limit").eq("user_id", userId).single();
    if (sub) ctx += `\n# Assinatura\n- Plano: ${sub.plan_id || "?"}\n- Status: ${sub.status}\n- Leads: ${sub.leads_used || 0}/${sub.leads_limit || 0}\n`;

    const counts = await Promise.all([
      supabase.from("whatsapp_instances").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("conversations").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("funnels").select("*", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("ai_agent_configs").select("*", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    ctx += `\n# Estatísticas\n- Instâncias: ${counts[0].count || 0}\n- Contatos: ${counts[1].count || 0}\n- Conversas: ${counts[2].count || 0}\n- Campanhas: ${counts[3].count || 0}\n- Funis: ${counts[4].count || 0}\n- Agentes IA: ${counts[5].count || 0}\n`;
  } catch (e) {
    console.error("Error fetching user context:", e);
  }
  return ctx;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId } = await req.json();

    if (!messages || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userContext = await fetchUserContext(supabase, userId);
    const fullSystemPrompt = SYSTEM_KNOWLEDGE + userContext;

    const allMessages = [
      { role: "system", content: fullSystemPrompt },
      ...messages,
    ];

    // Tool calling loop: non-streaming until final text response
    const MAX_TOOL_ROUNDS = 5;
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          messages: allMessages,
          tools,
          stream: false,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI error:", response.status, errorText);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        return new Response(JSON.stringify({ error: "No response from AI" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If there are tool calls, execute them and loop
      if (assistantMessage.tool_calls?.length) {
        allMessages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, unknown> = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch { /* empty args */ }

          console.log(`[Wil] Executing tool: ${fnName}`, fnArgs);
          const result = await executeTool(supabase, userId, fnName, fnArgs);
          console.log(`[Wil] Tool result (${fnName}):`, result.slice(0, 200));

          allMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }
        // Continue loop for next AI response
        continue;
      }

      // No tool calls — stream the final response
      // Make a streaming request with the full conversation (including tool results)
      const streamResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-nano",
          messages: allMessages,
          stream: true,
        }),
      });

      if (!streamResponse.ok) {
        const errorText = await streamResponse.text();
        console.error("Stream error:", streamResponse.status, errorText);
        return new Response(JSON.stringify({ error: "AI streaming error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // If we exhausted tool rounds, return a fallback
    return new Response(
      JSON.stringify({ error: "Too many tool rounds" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Wil assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
