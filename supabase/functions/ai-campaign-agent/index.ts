import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentConfig {
  id: string;
  agent_name: string;
  personality_prompt: string | null;
  behavior_rules: string | null;
  greeting_message: string | null;
  fallback_message: string | null;
  goodbye_message: string | null;
  max_interactions: number;
  response_delay_min: number;
  response_delay_max: number;
  active_hours_start: number;
  active_hours_end: number;
  handoff_keywords: string[];
  is_active: boolean;
}

interface KnowledgeItem {
  title: string;
  content: string | null;
  processed_content: string | null;
  source_type: string;
}

interface AgentVariable {
  variable_key: string;
  variable_value: string | null;
}

interface AgentStage {
  id: string;
  stage_name: string;
  stage_prompt: string | null;
  order_index: number;
  collected_fields: Array<{ key: string; label: string; required?: boolean }>;
  completion_condition: { type?: string; value?: string };
  condition_type: string;
  next_stage_id: string | null;
  is_final: boolean;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
}

interface StageData {
  id: string;
  current_stage_id: string | null;
  collected_data: Record<string, unknown>;
  stage_history: Array<{ stage_id: string; entered_at: string; completed_at?: string }>;
}

interface CalendarIntegration {
  id: string;
  api_token: string;
  user_uri: string | null;
  organization_uri: string | null;
  is_active: boolean;
}

interface CalendlyAvailability {
  schedulingUrl: string;
  busySlots: Array<{ start: string; end: string; name: string }>;
  hasBusySlots: boolean;
}

// Check if current time is within allowed AI hours
const isWithinActiveHours = (startHour: number, endHour: number): boolean => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(formatter.format(now));
  return currentHour >= startHour && currentHour < endHour;
};

// Check if message contains handoff keywords
const containsHandoffKeyword = (message: string, keywords: string[]): boolean => {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
};

// Get random delay for response
const getRandomDelay = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Replace variables in text
const replaceVariables = (
  text: string, 
  variables: AgentVariable[], 
  contactName: string,
  collectedData: Record<string, unknown>
): string => {
  let result = text;
  
  // System variables
  result = result.replace(/\{\{nome\}\}/gi, contactName);
  result = result.replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'));
  result = result.replace(/\{\{hora\}\}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  
  // Custom variables
  for (const v of variables) {
    const regex = new RegExp(`\\{\\{${v.variable_key}\\}\\}`, 'gi');
    result = result.replace(regex, v.variable_value || '');
  }
  
  // Collected data from stages
  for (const [key, value] of Object.entries(collectedData)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, String(value || ''));
  }
  
  return result;
};

// Build knowledge context from all sources
const buildKnowledgeContext = (items: KnowledgeItem[]): string => {
  if (!items || items.length === 0) return '';
  
  const sections: string[] = [];
  
  for (const item of items) {
    const content = item.processed_content || item.content;
    if (content) {
      sections.push(`### ${item.title}\n${content}`);
    }
  }
  
  return sections.length > 0 
    ? `\n\n## Base de Conhecimento\n${sections.join('\n\n')}`
    : '';
};

// Check if message is asking about scheduling/availability
const isAskingAboutSchedule = (message: string): boolean => {
  const scheduleKeywords = [
    'horário', 'horarios', 'hora', 'agendar', 'agenda', 'marcar', 
    'disponível', 'disponibilidade', 'reunião', 'reuniao', 'meeting',
    'quando', 'que horas', 'amanhã', 'amanha', 'próxima', 'proxima',
    'semana', 'dia', 'calendário', 'calendario', 'livre', 'vaga'
  ];
  const lowerMessage = message.toLowerCase();
  return scheduleKeywords.some(keyword => lowerMessage.includes(keyword));
};

// Fetch Calendly availability
const fetchCalendlyAvailability = async (
  supabaseUrl: string,
  agentConfigId: string
): Promise<CalendlyAvailability | null> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'get-availability',
        agentConfigId,
        date: new Date().toISOString().split('T')[0],
      }),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.success) return null;
    
    return {
      schedulingUrl: data.schedulingUrl,
      busySlots: data.busySlots || [],
      hasBusySlots: data.hasBusySlots || false,
    };
  } catch (e) {
    console.error('[AI-AGENT] Failed to fetch Calendly availability:', e);
    return null;
  }
};

// Fetch available time slots from Calendly
const fetchCalendlyAvailableTimes = async (
  supabaseUrl: string,
  agentConfigId: string,
  startDate: string,
  endDate: string
): Promise<Array<{ start_time: string; status: string }> | null> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'get-available-times',
        agentConfigId,
        startDate,
        endDate,
      }),
    });
    
    if (!response.ok) {
      console.error('[AI-AGENT] Failed to fetch available times:', await response.text());
      return null;
    }
    
    const data = await response.json();
    if (!data.success) return null;
    
    return data.availableTimes || [];
  } catch (e) {
    console.error('[AI-AGENT] Failed to fetch Calendly available times:', e);
    return null;
  }
};

// Create a booking via Calendly
const createCalendlyBooking = async (
  supabaseUrl: string,
  agentConfigId: string,
  startTime: string,
  inviteeName: string,
  inviteeEmail: string,
  inviteePhone?: string
): Promise<{ success: boolean; booking?: Record<string, unknown>; error?: string }> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'create-booking',
        agentConfigId,
        startTime,
        inviteeName,
        inviteeEmail,
        inviteePhone,
        timezone: 'America/Sao_Paulo',
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[AI-AGENT] Failed to create booking:', data.error);
      return { success: false, error: data.error || 'Erro ao criar agendamento' };
    }
    
    return { success: true, booking: data.booking };
  } catch (e) {
    console.error('[AI-AGENT] Failed to create Calendly booking:', e);
    return { success: false, error: 'Erro de conexão ao criar agendamento' };
  }
};

// Define tools for AI agent
const getCalendlyTools = () => [
  {
    type: 'function',
    function: {
      name: 'get_available_times',
      description: 'Busca horários disponíveis para agendamento no Calendly. Use quando o cliente perguntar sobre horários disponíveis ou quiser agendar.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { 
            type: 'string', 
            description: 'Data de início para buscar horários (formato YYYY-MM-DD). Use a data de hoje ou a data mencionada pelo cliente.' 
          },
          end_date: { 
            type: 'string', 
            description: 'Data de fim para buscar horários (formato YYYY-MM-DD). Máximo 7 dias após start_date.' 
          },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Cria um agendamento confirmado no Calendly. Use APENAS quando o cliente confirmar um horário específico E você tiver o email dele. IMPORTANTE: O start_time DEVE ser EXATAMENTE o valor ISO retornado por get_available_times (ex: 2025-12-29T12:00:00.000000Z).',
      parameters: {
        type: 'object',
        properties: {
          start_time: { 
            type: 'string', 
            description: 'OBRIGATÓRIO: Use EXATAMENTE o valor ISO retornado por get_available_times (ex: 2025-12-29T12:00:00.000000Z). NUNCA modifique ou reconstrua este valor.' 
          },
          invitee_name: { 
            type: 'string', 
            description: 'Nome completo do cliente' 
          },
          invitee_email: { 
            type: 'string', 
            description: 'Email do cliente (obrigatório para criar agendamento)' 
          },
          invitee_phone: { 
            type: 'string', 
            description: 'Telefone do cliente (opcional)' 
          },
        },
        required: ['start_time', 'invitee_name', 'invitee_email'],
      },
    },
  },
];

// Check if stage completion condition is met
const checkStageCompletion = (
  stage: AgentStage,
  collectedData: Record<string, unknown>,
  messageContent: string
): boolean => {
  switch (stage.condition_type) {
    case 'always':
      return true;
      
    case 'field_filled':
      // Check if all required fields are filled
      const requiredFields = stage.collected_fields.filter(f => f.required !== false);
      return requiredFields.every(f => collectedData[f.key] !== undefined && collectedData[f.key] !== '');
      
    case 'keyword_match':
      const keywords = stage.completion_condition.value?.split(',').map(k => k.trim().toLowerCase()) || [];
      const lowerMessage = messageContent.toLowerCase();
      return keywords.some(k => lowerMessage.includes(k));
      
    case 'intent_detected':
      // For now, just check if message seems affirmative
      const affirmativeWords = ['sim', 'ok', 'certo', 'confirmo', 'isso', 'exato', 'claro'];
      return affirmativeWords.some(w => messageContent.toLowerCase().includes(w));
      
    case 'manual':
      return false;
      
    default:
      return true;
  }
};

// Extract field values from message using AI
const extractFieldsFromMessage = async (
  lovableApiKey: string,
  message: string,
  fields: Array<{ key: string; label: string }>,
  existingData: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  if (fields.length === 0) return existingData;
  
  const fieldDescriptions = fields.map(f => `- ${f.key}: ${f.label}`).join('\n');
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Extraia informações da mensagem do usuário. Retorne APENAS um JSON válido com os campos encontrados.
          
Campos a extrair:
${fieldDescriptions}

Dados já coletados:
${JSON.stringify(existingData)}

Se um campo não for encontrado na mensagem, não inclua no JSON.
Exemplo de resposta: {"nome": "João", "email": "joao@email.com"}`
        },
        { role: 'user', content: message }
      ],
      max_tokens: 200,
    }),
  });
  
  if (!response.ok) return existingData;
  
  try {
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    // Extract JSON from response
    const jsonMatch = content.match(/\{[^{}]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return { ...existingData, ...extracted };
    }
  } catch (e) {
    console.error('[AI-AGENT] Failed to extract fields:', e);
  }
  
  return existingData;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversationId, messageContent, instanceName, instanceId } = await req.json();

    if (!conversationId || !messageContent) {
      throw new Error('conversationId and messageContent are required');
    }

    console.log(`[AI-AGENT] Processing message for conversation ${conversationId}, instanceId: ${instanceId}`);

    // Fetch conversation with campaign info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, user_id, contact_id, campaign_id, ai_handled, ai_interactions_count, ai_paused, ai_handoff_requested, instance_id,
        contacts!inner(id, phone, name),
        campaigns(id, name, ai_enabled)
      `)
      .eq('id', conversationId)
      .single();

    if (convError || !conversation) {
      console.error('[AI-AGENT] Conversation not found:', convError);
      return new Response(
        JSON.stringify({ success: false, error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get campaign and check for AI config
    // deno-lint-ignore no-explicit-any
    const campaigns = conversation.campaigns as any;
    const campaign = Array.isArray(campaigns) ? campaigns[0] : campaigns;
    
    // First try: get agent config from campaign
    let agentConfig = null;
    let funnelId: string | null = null;
    let configSource = '';
    
    if (campaign?.id && campaign.ai_enabled) {
      console.log('[AI-AGENT] Looking for agent config by campaign_id:', campaign.id);
      const { data: campaignConfig } = await supabase
        .from('ai_agent_configs')
        .select('*')
        .eq('campaign_id', campaign.id)
        .eq('is_active', true)
        .single();
      
      if (campaignConfig) {
        agentConfig = campaignConfig;
        configSource = 'campaign';
        console.log('[AI-AGENT] ✓ Found agent config via campaign:', campaignConfig.id);
      }
    }
    
    // Second try: get agent config from instance's default funnel
    if (!agentConfig) {
      const effectiveInstanceId = instanceId || conversation.instance_id;
      if (effectiveInstanceId) {
        console.log('[AI-AGENT] No campaign config, checking instance funnel:', effectiveInstanceId);
        
        const { data: instance } = await supabase
          .from('whatsapp_instances')
          .select('default_funnel_id')
          .eq('id', effectiveInstanceId)
          .single();
        
        if (instance?.default_funnel_id) {
          funnelId = instance.default_funnel_id;
          console.log('[AI-AGENT] Found default funnel on instance:', funnelId);
          
          const { data: funnelConfig } = await supabase
            .from('ai_agent_configs')
            .select('*')
            .eq('funnel_id', funnelId)
            .eq('is_active', true)
            .single();
          
          if (funnelConfig) {
            agentConfig = funnelConfig;
            configSource = 'instance_funnel';
            console.log('[AI-AGENT] ✓ Found agent config via instance funnel:', funnelConfig.id);
          } else {
            console.log('[AI-AGENT] ✗ Instance has funnel but no active AI config for it');
          }
        } else {
          console.log('[AI-AGENT] ✗ Instance has no default funnel set');
        }
      } else {
        console.log('[AI-AGENT] ✗ No instanceId available');
      }
    }
    
    // Third try: get funnel from existing deal for this conversation
    if (!agentConfig) {
      console.log('[AI-AGENT] Trying fallback: look for deal linked to conversation');
      
      const { data: deal } = await supabase
        .from('funnel_deals')
        .select('funnel_id')
        .eq('conversation_id', conversationId)
        .limit(1)
        .single();
      
      if (deal?.funnel_id) {
        funnelId = deal.funnel_id;
        console.log('[AI-AGENT] Found deal with funnel:', funnelId);
        
        const { data: dealFunnelConfig } = await supabase
          .from('ai_agent_configs')
          .select('*')
          .eq('funnel_id', funnelId)
          .eq('is_active', true)
          .single();
        
        if (dealFunnelConfig) {
          agentConfig = dealFunnelConfig;
          configSource = 'deal_funnel';
          console.log('[AI-AGENT] ✓ Found agent config via deal funnel:', dealFunnelConfig.id);
        } else {
          console.log('[AI-AGENT] ✗ Deal funnel has no active AI config');
        }
      } else {
        console.log('[AI-AGENT] ✗ No deal linked to this conversation');
      }
    }
    
    // If no agent config found, AI is not enabled - log detailed reason
    if (!agentConfig) {
      console.log('[AI-AGENT] === AI NOT RESPONDING ===');
      console.log('[AI-AGENT] Reason: No active AI agent configuration found');
      console.log('[AI-AGENT] Checked: campaign_id, instance default_funnel_id, conversation deal');
      console.log('[AI-AGENT] To fix: Link a funnel with active AI config to the instance, or create a deal with AI-enabled funnel');
      return new Response(
        JSON.stringify({ success: false, reason: 'AI not enabled - no config found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[AI-AGENT] Using config from: ${configSource}, agent: ${agentConfig.agent_name}`);

    // Use the agent config we found
    const config: AgentConfig = {
      id: agentConfig.id,
      agent_name: agentConfig.agent_name || 'Assistente',
      personality_prompt: agentConfig.personality_prompt,
      behavior_rules: agentConfig.behavior_rules,
      greeting_message: agentConfig.greeting_message,
      fallback_message: agentConfig.fallback_message || 'Desculpe, não entendi. Pode reformular?',
      goodbye_message: agentConfig.goodbye_message,
      max_interactions: agentConfig.max_interactions || 10,
      response_delay_min: agentConfig.response_delay_min || 3,
      response_delay_max: agentConfig.response_delay_max || 8,
      active_hours_start: agentConfig.active_hours_start || 8,
      active_hours_end: agentConfig.active_hours_end || 20,
      handoff_keywords: agentConfig.handoff_keywords || ['atendente', 'humano', 'pessoa', 'falar com alguém'],
      is_active: agentConfig.is_active ?? true,
    };

    if (conversation.ai_paused) {
      console.log('[AI-AGENT] AI is paused for this conversation');
      return new Response(
        JSON.stringify({ success: false, reason: 'AI paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (conversation.ai_handoff_requested) {
      console.log('[AI-AGENT] Handoff already requested');
      return new Response(
        JSON.stringify({ success: false, reason: 'Handoff requested' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if within active hours
    if (!isWithinActiveHours(config.active_hours_start, config.active_hours_end)) {
      console.log('[AI-AGENT] Outside active hours');
      return new Response(
        JSON.stringify({ success: false, reason: 'Outside active hours' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max interactions
    const interactionCount = conversation.ai_interactions_count || 0;
    if (interactionCount >= config.max_interactions) {
      console.log('[AI-AGENT] Max interactions reached, triggering handoff');
      
      await supabase
        .from('conversations')
        .update({
          ai_handoff_requested: true,
          ai_handoff_reason: 'Limite de interações atingido',
        })
        .eq('id', conversationId);

      return new Response(
        JSON.stringify({ success: false, reason: 'Max interactions reached', handoff: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for handoff keywords
    const handoffKeywords = config.handoff_keywords || ['atendente', 'humano', 'pessoa', 'falar com alguém'];
    if (containsHandoffKeyword(messageContent, handoffKeywords)) {
      console.log('[AI-AGENT] Handoff keyword detected');
      
      await supabase
        .from('conversations')
        .update({
          ai_handoff_requested: true,
          ai_handoff_reason: `Cliente solicitou atendimento humano`,
        })
        .eq('id', conversationId);

      // Send handoff message
      const handoffMessage = 'Entendi! Vou transferir você para um de nossos atendentes. Aguarde um momento, por favor.';
      
      // deno-lint-ignore no-explicit-any
      const contactsHandoff = conversation.contacts as any;
      const contactHandoff = Array.isArray(contactsHandoff) ? contactsHandoff[0] : contactsHandoff;
      let phone = (contactHandoff?.phone || '').replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phone, text: handoffMessage }),
      });

      return new Response(
        JSON.stringify({ success: true, handoff: true, message: handoffMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch knowledge base, variables, stages, and calendar integration if agent config exists
    let knowledgeItems: KnowledgeItem[] = [];
    let variables: AgentVariable[] = [];
    let stages: AgentStage[] = [];
    let calendarIntegration: CalendarIntegration | null = null;
    
    if (agentConfig?.id) {
      // Fetch knowledge items
      const { data: knowledge } = await supabase
        .from('ai_agent_knowledge_items')
        .select('title, content, processed_content, source_type')
        .eq('agent_config_id', agentConfig.id)
        .eq('status', 'completed');
      
      knowledgeItems = knowledge || [];
      
      // Fetch variables
      const { data: vars } = await supabase
        .from('ai_agent_variables')
        .select('variable_key, variable_value')
        .eq('agent_config_id', agentConfig.id);
      
      variables = vars || [];
      
      // Fetch stages ordered
      const { data: stagesData } = await supabase
        .from('ai_agent_stages')
        .select('*')
        .eq('agent_config_id', agentConfig.id)
        .order('order_index', { ascending: true });
      
      stages = (stagesData || []) as AgentStage[];
      
      // Fetch calendar integration
      const { data: calendarData } = await supabase
        .from('calendar_integrations')
        .select('id, api_token, user_uri, organization_uri, is_active')
        .eq('agent_config_id', agentConfig.id)
        .eq('provider', 'calendly')
        .eq('is_active', true)
        .single();
      
      if (calendarData) {
        calendarIntegration = calendarData as CalendarIntegration;
      }
    }

    // Fetch or create conversation stage data
    let stageData: StageData | null = null;
    let currentStage: AgentStage | null = null;
    
    if (stages.length > 0) {
      const { data: existingStageData } = await supabase
        .from('conversation_stage_data')
        .select('*')
        .eq('conversation_id', conversationId)
        .single();
      
      if (existingStageData) {
        stageData = existingStageData as StageData;
        currentStage = stages.find(s => s.id === stageData!.current_stage_id) || stages[0];
      } else {
        // Create initial stage data
        const initialStage = stages[0];
        const { data: newStageData } = await supabase
          .from('conversation_stage_data')
          .insert({
            conversation_id: conversationId,
            current_stage_id: initialStage.id,
            collected_data: {},
            stage_history: [{ stage_id: initialStage.id, entered_at: new Date().toISOString() }],
          })
          .select()
          .single();
        
        stageData = newStageData as StageData;
        currentStage = initialStage;
      }
    }

    // Extract fields from message if we have a current stage
    let collectedData: Record<string, unknown> = stageData?.collected_data || {};
    
    if (currentStage && currentStage.collected_fields.length > 0) {
      collectedData = await extractFieldsFromMessage(
        lovableApiKey,
        messageContent,
        currentStage.collected_fields,
        collectedData
      );
      
      // Update collected data
      if (stageData) {
        await supabase
          .from('conversation_stage_data')
          .update({ collected_data: collectedData })
          .eq('id', stageData.id);
      }
    }

    // Check if we should advance to next stage
    if (currentStage && !currentStage.is_final && checkStageCompletion(currentStage, collectedData, messageContent)) {
      const nextStage = currentStage.next_stage_id 
        ? stages.find(s => s.id === currentStage!.next_stage_id)
        : stages[stages.findIndex(s => s.id === currentStage!.id) + 1];
      
      if (nextStage && stageData) {
        const newHistory = [
          ...stageData.stage_history,
          { stage_id: nextStage.id, entered_at: new Date().toISOString() }
        ];
        
        await supabase
          .from('conversation_stage_data')
          .update({
            current_stage_id: nextStage.id,
            stage_history: newHistory,
          })
          .eq('id', stageData.id);
        
        currentStage = nextStage;
        console.log(`[AI-AGENT] Advanced to stage: ${nextStage.stage_name}`);
      }
    }

    // Fetch conversation history for context
    const { data: messages } = await supabase
      .from('inbox_messages')
      .select('content, direction, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(20);

    // Build conversation history for AI
    const conversationHistory: ConversationMessage[] = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Add current message
    conversationHistory.push({ role: 'user', content: messageContent });

    // Build system prompt
    // deno-lint-ignore no-explicit-any
    const contacts = conversation.contacts as any;
    const contact = Array.isArray(contacts) ? contacts[0] : contacts;
    const contactName = contact?.name || 'Cliente';
    
    // Get current date/time info for the AI
    const agora = new Date();
    const dataAtualFormatada = agora.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    });
    const horaAtual = agora.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
    const anoAtual = agora.getFullYear();
    
    // Start with personality prompt
    let systemPrompt = config.personality_prompt || 
      `Você é ${config.agent_name}, um assistente virtual amigável e profissional.`;
    
    // Add mandatory current date/time context at the very beginning
    systemPrompt = `## DATA E HORA ATUAIS (OBRIGATÓRIO - USE SEMPRE)
- Hoje é ${dataAtualFormatada}
- Agora são ${horaAtual} (horário de Brasília)
- O ano atual é ${anoAtual}
- NUNCA mencione o ano 2024. Estamos em ${anoAtual}.
- Quando mencionar qualquer data, use SEMPRE o ano ${anoAtual}.
- "Amanhã" significa o dia seguinte a hoje (${dataAtualFormatada}).

` + systemPrompt;
    
    // Add behavior rules
    if (config.behavior_rules) {
      systemPrompt += `\n\n## Regras de Comportamento\n${config.behavior_rules}`;
    }
    
    // Add current stage prompt if exists
    if (currentStage?.stage_prompt) {
      systemPrompt += `\n\n## Instrução do Estágio Atual (${currentStage.stage_name})\n${currentStage.stage_prompt}`;
      
      // Add fields to collect
      if (currentStage.collected_fields.length > 0) {
        const fieldsToCollect = currentStage.collected_fields
          .filter(f => !collectedData[f.key])
          .map(f => `- ${f.label}`)
          .join('\n');
        
        if (fieldsToCollect) {
          systemPrompt += `\n\nInformações que ainda precisam ser coletadas:\n${fieldsToCollect}`;
        }
      }
    }
    
    // Add knowledge base
    const knowledgeContext = buildKnowledgeContext(knowledgeItems);
    if (knowledgeContext) {
      systemPrompt += knowledgeContext;
    }
    
    // Add collected data context
    if (Object.keys(collectedData).length > 0) {
      systemPrompt += `\n\n## Dados já coletados\n${JSON.stringify(collectedData, null, 2)}`;
    }
    
    // Check if user is asking about scheduling and we have calendar integration
    let calendarContext = '';
    const hasCalendarIntegration = !!calendarIntegration && !!agentConfig?.id;
    
    if (hasCalendarIntegration && isAskingAboutSchedule(messageContent)) {
      console.log('[AI-AGENT] User asking about schedule, fetching Calendly availability...');
      const availability = await fetchCalendlyAvailability(supabaseUrl, agentConfig.id);
      
      if (availability) {
        calendarContext = `\n\n## REGRAS DE AGENDAMENTO (SIGA EXATAMENTE)
1. SEMPRE use get_available_times ANTES de oferecer horários ao cliente
2. Quando receber os horários, apresente-os NO FORMATO BRASÍLIA (ex: "09:00", "14:30")
3. Quando o cliente escolher um horário, pergunte o EMAIL dele se ainda não tiver
4. Para criar o agendamento, use EXATAMENTE o valor ISO retornado (depois de "→ ISO:")
5. NUNCA reconstrua ou modifique o horário ISO - copie exatamente como veio
6. Link alternativo para agendamento manual: ${availability.schedulingUrl}

EXEMPLO CORRETO:
- Cliente pergunta: "Tem horário segunda?"
- Você: [chama get_available_times]
- Ferramenta retorna: "1) seg, 30/12 às 09:00 (Brasília) → ISO: 2025-12-30T12:00:00.000000Z"
- Você responde: "Tenho horário às 09:00 de segunda. Quer agendar?"
- Cliente: "Sim"
- Você: "Perfeito! Qual seu email para confirmar?"
- Cliente: "email@teste.com"  
- Você: [chama create_booking com start_time="2025-12-30T12:00:00.000000Z"]`;
        
        if (availability.hasBusySlots && availability.busySlots.length > 0) {
          const busyTimes = availability.busySlots.map(slot => {
            const start = new Date(slot.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            const end = new Date(slot.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            return `${start} - ${end} (${slot.name})`;
          }).join('\n  - ');
          calendarContext += `\n\nHorários já ocupados hoje (Brasília):\n  - ${busyTimes}`;
        }
      }
    } else if (hasCalendarIntegration) {
      calendarContext = `\n\n## Agendamento Disponível
Quando o cliente quiser agendar, use get_available_times para buscar horários. SEMPRE exiba horários em Brasília e use o ISO exato para booking.`;
    }
    
    if (calendarContext) {
      systemPrompt += calendarContext;
    }
    
    // Add context
    systemPrompt += `\n\n## Contexto da Conversa
- Nome do cliente: ${contactName}
- Esta é uma conversa via WhatsApp
- Seja educado, amigável e objetivo
- Use linguagem informal mas profissional
- Se não souber responder algo específico, sugira falar com um atendente
- Não invente informações que não estão na base de conhecimento`;

    // Replace variables in system prompt
    systemPrompt = replaceVariables(systemPrompt, variables, contactName, collectedData);

    console.log('[AI-AGENT] Calling Lovable AI...');
    console.log('[AI-AGENT] Current stage:', currentStage?.stage_name || 'none');
    console.log('[AI-AGENT] Calendar integration:', hasCalendarIntegration ? 'enabled' : 'disabled');

    // Build AI request
    // deno-lint-ignore no-explicit-any
    const aiRequestBody: Record<string, any> = {
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
      max_tokens: 500,
    };

    // Add tools if calendar integration is active
    if (hasCalendarIntegration) {
      aiRequestBody.tools = getCalendlyTools();
      aiRequestBody.tool_choice = 'auto';
    }

    // Call Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(aiRequestBody),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[AI-AGENT] AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    let aiData = await aiResponse.json();
    let aiMessage = aiData.choices?.[0]?.message?.content || '';
    
    // Process tool calls if present
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0 && agentConfig?.id) {
      console.log('[AI-AGENT] Processing tool calls:', toolCalls.length);
      
      // deno-lint-ignore no-explicit-any
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function?.name;
        const args = JSON.parse(toolCall.function?.arguments || '{}');
        
        console.log(`[AI-AGENT] Executing tool: ${functionName}`, args);
        
        if (functionName === 'get_available_times') {
          const availableTimes = await fetchCalendlyAvailableTimes(
            supabaseUrl,
            agentConfig.id,
            args.start_date,
            args.end_date
          );
          
          if (availableTimes && availableTimes.length > 0) {
            console.log(`[AI-AGENT] Found ${availableTimes.length} available times from Calendly`);
            
            // Format times for readability - ALWAYS convert from UTC to America/Sao_Paulo
            const formattedTimes = availableTimes.slice(0, 10).map((slot, index) => {
              const utcDate = new Date(slot.start_time);
              
              // Format date and time in Brasília timezone
              const dataBRT = utcDate.toLocaleDateString('pt-BR', { 
                weekday: 'short',
                day: '2-digit', 
                month: '2-digit',
                timeZone: 'America/Sao_Paulo'
              });
              const horaBRT = utcDate.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
              });
              
              // Return numbered option with BRT display and exact ISO UTC for booking
              return `${index + 1}) ${dataBRT} às ${horaBRT} (Brasília) → ISO: ${slot.start_time}`;
            }).join('\n');
            
            console.log(`[AI-AGENT] Formatted times for agent:\n${formattedTimes}`);
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Horários disponíveis (horário de Brasília):\n${formattedTimes}\n\n⚠️ IMPORTANTE: Para criar agendamento, você DEVE usar EXATAMENTE o valor ISO mostrado após "→ ISO:" (exemplo: 2025-12-29T12:00:00.000000Z). NUNCA invente ou modifique o horário ISO.`,
            });
          } else {
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: 'Não foram encontrados horários disponíveis neste período. Sugira outro período ao cliente ou ofereça o link de agendamento manual.',
            });
          }
        } else if (functionName === 'create_booking') {
          const startTimeArg = args.start_time || '';
          
          console.log(`[AI-AGENT] create_booking called with start_time: "${startTimeArg}"`);
          
          // Validate start_time format - MUST be ISO UTC with Z or timezone offset
          const hasTimezone = startTimeArg.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(startTimeArg);
          
          if (!hasTimezone) {
            console.log(`[AI-AGENT] REJECTED: start_time missing timezone: "${startTimeArg}"`);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `❌ ERRO: O horário "${startTimeArg}" está em formato inválido. Você DEVE usar EXATAMENTE o valor ISO retornado pela ferramenta get_available_times (exemplo: 2025-12-29T12:00:00.000000Z). Chame get_available_times novamente e use o horário ISO exato.`,
            });
          } else {
            const bookingResult = await createCalendlyBooking(
              supabaseUrl,
              agentConfig.id,
              startTimeArg,
              args.invitee_name,
              args.invitee_email,
              args.invitee_phone
            );
            
            if (bookingResult.success && bookingResult.booking) {
              const booking = bookingResult.booking;
              
              // Convert booking time to BRT for display
              const bookingDate = new Date(String(booking.start_time));
              const dataBRT = bookingDate.toLocaleDateString('pt-BR', { 
                weekday: 'long',
                day: '2-digit', 
                month: '2-digit',
                year: 'numeric',
                timeZone: 'America/Sao_Paulo'
              });
              const horaBRT = bookingDate.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo'
              });
              
              console.log(`[AI-AGENT] Booking created successfully: ${dataBRT} às ${horaBRT}`);
              
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `✅ Agendamento criado com sucesso!\n- Data: ${dataBRT}\n- Horário: ${horaBRT} (Brasília)\n- Nome: ${booking.invitee_name}\n- Email: ${booking.invitee_email}\n- Link para cancelar: ${booking.cancel_url}\n- Link para reagendar: ${booking.reschedule_url}\n\nInforme o cliente sobre a confirmação!`,
              });
            } else {
              console.log(`[AI-AGENT] Booking failed: ${bookingResult.error}`);
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `❌ Erro ao criar agendamento: ${bookingResult.error}. Verifique se o horário ainda está disponível ou ofereça o link de agendamento manual.`,
              });
            }
          }
        }
      }
      
      // Call AI again with tool results to get final response
      if (toolResults.length > 0) {
        console.log('[AI-AGENT] Calling AI with tool results...');
        
        const followUpResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory,
              aiData.choices[0].message, // Include the assistant message with tool_calls
              ...toolResults,
            ],
            max_tokens: 500,
          }),
        });
        
        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          aiMessage = followUpData.choices?.[0]?.message?.content || aiMessage;
        }
      }
    }

    if (!aiMessage) {
      console.error('[AI-AGENT] No AI response content');
      aiMessage = config.fallback_message || 'Desculpe, não consegui processar sua mensagem.';
    }

    // Replace variables in response
    aiMessage = replaceVariables(aiMessage, variables, contactName, collectedData);

    console.log('[AI-AGENT] AI response:', aiMessage.substring(0, 100));

    // Apply response delay
    const delay = getRandomDelay(config.response_delay_min, config.response_delay_max);
    console.log(`[AI-AGENT] Waiting ${delay}s before sending...`);
    await new Promise(resolve => setTimeout(resolve, delay * 1000));

    // Send response via Evolution API
    // deno-lint-ignore no-explicit-any
    const contactsForPhone = conversation.contacts as any;
    const contactData = Array.isArray(contactsForPhone) ? contactsForPhone[0] : contactsForPhone;
    let phone = (contactData?.phone || '').replace(/\D/g, '');
    if (!phone.startsWith('55')) phone = '55' + phone;

    const sendResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({ number: phone, text: aiMessage }),
    });

    const sendResult = await sendResponse.json();
    console.log('[AI-AGENT] Evolution API response:', sendResult);

    if (!sendResponse.ok || !sendResult.key) {
      console.error('[AI-AGENT] Failed to send message');
      throw new Error('Failed to send message via Evolution API');
    }

    // Update conversation AI counters
    await supabase
      .from('conversations')
      .update({
        ai_handled: true,
        ai_interactions_count: interactionCount + 1,
      })
      .eq('id', conversationId);

    // Save AI message to inbox
    await supabase
      .from('inbox_messages')
      .insert({
        user_id: conversation.user_id,
        conversation_id: conversationId,
        content: aiMessage,
        direction: 'outbound',
        status: 'sent',
        message_type: 'text',
        whatsapp_message_id: sendResult.key?.id || null,
        sent_at: new Date().toISOString(),
      });

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: aiMessage.substring(0, 100),
      })
      .eq('id', conversationId);

    console.log('[AI-AGENT] Message sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: aiMessage,
        interactionCount: interactionCount + 1,
        currentStage: currentStage?.stage_name || null,
        collectedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-AGENT] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
