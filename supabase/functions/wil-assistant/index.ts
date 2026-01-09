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

# Diretrizes de Resposta
- Seja amigável e prestativo
- Responda sempre em português brasileiro
- Forneça passos claros e numerados quando orientar
- Use emojis moderadamente para tornar a conversa amigável
- Quando tiver dados do usuário, cite-os especificamente
- Se não souber algo, seja honesto e sugira alternativas
- Mantenha respostas concisas mas completas`;

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch user context data
    let userContext = "";

    try {
      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .single();

      if (profile) {
        userContext += `\n# Dados do Usuário\n- Nome: ${profile.full_name || "Não informado"}\n- Email: ${profile.email || "Não informado"}\n`;
      }

      // Get subscription info
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_id, status, leads_used, leads_limit")
        .eq("user_id", userId)
        .single();

      if (subscription) {
        userContext += `\n# Assinatura\n- Plano: ${subscription.plan_id || "Não identificado"}\n- Status: ${subscription.status}\n- Leads usados: ${subscription.leads_used || 0}/${subscription.leads_limit || 0}\n`;
      }

      // Get instances count
      const { count: instancesCount } = await supabase
        .from("whatsapp_instances")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get contacts count
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get conversations count
      const { count: conversationsCount } = await supabase
        .from("conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get campaigns count
      const { count: campaignsCount } = await supabase
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get funnels count
      const { count: funnelsCount } = await supabase
        .from("funnels")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      // Get AI agents count
      const { count: agentsCount } = await supabase
        .from("ai_agent_configs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      userContext += `\n# Estatísticas\n- Instâncias WhatsApp: ${instancesCount || 0}\n- Contatos: ${contactsCount || 0}\n- Conversas: ${conversationsCount || 0}\n- Campanhas: ${campaignsCount || 0}\n- Funis: ${funnelsCount || 0}\n- Agentes IA: ${agentsCount || 0}\n`;

      // Get recent activities
      const { data: activities } = await supabase
        .from("user_activity_sessions")
        .select("started_at, ended_at, duration_seconds")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(5);

      if (activities && activities.length > 0) {
        userContext += `\n# Últimas Sessões de Uso\n`;
        activities.forEach((activity, index) => {
          const duration = activity.duration_seconds 
            ? `${Math.round(activity.duration_seconds / 60)} minutos` 
            : "em andamento";
          userContext += `${index + 1}. ${new Date(activity.started_at).toLocaleDateString("pt-BR")} - ${duration}\n`;
        });
      }

    } catch (contextError) {
      console.error("Error fetching user context:", contextError);
      // Continue without context
    }

    const fullSystemPrompt = SYSTEM_KNOWLEDGE + userContext;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Wil assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
