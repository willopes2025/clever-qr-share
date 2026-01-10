import { createClient } from "npm:@supabase/supabase-js@2";

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
  response_mode: 'text' | 'audio' | 'both' | 'adaptive';
  voice_id: string | null;
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
  return currentHour >= startHour && currentHour <= endHour;
};

// Check if message contains handoff keywords
const containsHandoffKeyword = (message: string, keywords: string[]): boolean => {
  const lowerMessage = message.toLowerCase();
  return keywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
};

// Detect explicit format preference from message
const detectFormatPreference = (message: string): 'text' | 'audio' | null => {
  const lower = message.toLowerCase();
  
  const audioKeywords = [
    'responde por áudio', 'responda por áudio', 'manda áudio', 
    'envia áudio', 'quero áudio', 'prefiro áudio', 'me manda audio',
    'responde em audio', 'fala comigo', 'manda audio', 'envia audio',
    'quero audio', 'prefiro audio', 'responde por audio', 'responda por audio',
    'manda um áudio', 'manda um audio', 'me envia audio', 'me envia áudio'
  ];
  
  const textKeywords = [
    'responde por texto', 'responda por texto', 'manda texto',
    'prefiro texto', 'quero texto', 'escreve', 'digita',
    'responde escrito', 'não manda áudio', 'sem áudio', 'sem audio',
    'não manda audio', 'só texto', 'so texto', 'apenas texto'
  ];
  
  if (audioKeywords.some(k => lower.includes(k))) return 'audio';
  if (textKeywords.some(k => lower.includes(k))) return 'text';
  return null;
};

// Determine response format based on adaptive logic
const determineResponseFormat = (
  incomingType: string,
  preferredFormat: string | null,
  requestedFormat: 'text' | 'audio' | null,
  configMode: string
): 'text' | 'audio' => {
  // If config is set to a specific mode (not adaptive), use it
  if (configMode === 'text') return 'text';
  if (configMode === 'audio') return 'audio';
  if (configMode === 'both') return 'text'; // For 'both' mode, we handle sending both separately
  
  // 1. Priority: client explicitly requested NOW
  if (requestedFormat) {
    return requestedFormat;
  }
  
  // 2. Second priority: saved preference from previous request
  if (preferredFormat === 'text' || preferredFormat === 'audio') {
    return preferredFormat;
  }
  
  // 3. Third priority: mirror incoming message format
  if (incomingType === 'audio' || incomingType === 'voice' || incomingType === 'ptt') {
    return 'audio';
  }
  
  // 4. Default: text
  return 'text';
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

// Format slot to Brazilian Portuguese
const formatSlotBR = (isoTime: string): string => {
  const date = new Date(isoTime);
  const dia = date.toLocaleDateString('pt-BR', { 
    weekday: 'long',
    day: '2-digit', 
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  const hora = date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
  return `${dia} às ${hora}`;
};

// Replace slot placeholders in text
const replaceSlotPlaceholders = (text: string, slot1: string, slot2: string, slot1Iso: string, slot2Iso: string): string => {
  if (!text) return text;
  return text
    .replace(/\{\{slot1\}\}/gi, slot1)
    .replace(/\{\{slot2\}\}/gi, slot2)
    .replace(/\{\{p_slot1\}\}/gi, slot1)
    .replace(/\{\{p_slot2\}\}/gi, slot2)
    .replace(/\{\{slot1_iso\}\}/gi, slot1Iso)
    .replace(/\{\{slot2_iso\}\}/gi, slot2Iso);
};

// Check if text contains slot placeholders
const hasSlotPlaceholders = (text: string): boolean => {
  if (!text) return false;
  return /\{\{(slot1|slot2|p_slot1|p_slot2)\}\}/i.test(text);
};

// Check if user is requesting a specific time slot (needs mandatory verification)
const isRequestingSpecificTime = (message: string): boolean => {
  const lower = message.toLowerCase();
  const timePatterns = [
    /\d{1,2}\s*h/i,                    // "16h", "14 h"
    /\d{1,2}:\d{2}/,                    // "16:00", "14:30"
    /às?\s+\d{1,2}/i,                   // "às 16", "as 14"
    /pode\s+ser\s+.*\d{1,2}/i,          // "pode ser às 16"
    /quero\s+.*\d{1,2}/i,               // "quero às 16"
    /prefiro\s+.*\d{1,2}/i,             // "prefiro 14h"
    /confirma\s+.*\d{1,2}/i,            // "confirma 16h"
    /fecha\s+.*\d{1,2}/i,               // "fecha às 10"
    /marco\s+.*\d{1,2}/i,               // "marco 14h"
    /agendo\s+.*\d{1,2}/i,              // "agendo 15h"
  ];
  return timePatterns.some(p => p.test(lower));
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

// Fetch patient appointments from Calendly
const fetchPatientAppointments = async (
  supabaseUrl: string,
  agentConfigId: string,
  inviteeEmail: string
): Promise<{ success: boolean; appointments?: Array<Record<string, unknown>>; error?: string }> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'get-invitee-appointments',
        agentConfigId,
        inviteeEmail,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[AI-AGENT] Failed to fetch appointments:', data.error);
      return { success: false, error: data.error || 'Erro ao buscar agendamentos' };
    }
    
    return { success: true, appointments: data.appointments };
  } catch (e) {
    console.error('[AI-AGENT] Failed to fetch patient appointments:', e);
    return { success: false, error: 'Erro de conexão ao buscar agendamentos' };
  }
};

// Cancel a Calendly booking
const cancelCalendlyBooking = async (
  supabaseUrl: string,
  agentConfigId: string,
  inviteeUri: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'cancel-booking',
        agentConfigId,
        inviteeUri,
        reason,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[AI-AGENT] Failed to cancel booking:', data.error);
      return { success: false, error: data.error || 'Erro ao cancelar agendamento' };
    }
    
    return { success: true };
  } catch (e) {
    console.error('[AI-AGENT] Failed to cancel Calendly booking:', e);
    return { success: false, error: 'Erro de conexão ao cancelar agendamento' };
  }
};

// Get reschedule link from Calendly
const getRescheduleLink = async (
  supabaseUrl: string,
  agentConfigId: string,
  inviteeUri: string
): Promise<{ success: boolean; rescheduleUrl?: string; error?: string }> => {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/calendly-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        action: 'get-reschedule-link',
        agentConfigId,
        inviteeUri,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      console.error('[AI-AGENT] Failed to get reschedule link:', data.error);
      return { success: false, error: data.error || 'Erro ao obter link de reagendamento' };
    }
    
    return { success: true, rescheduleUrl: data.rescheduleUrl };
  } catch (e) {
    console.error('[AI-AGENT] Failed to get reschedule link:', e);
    return { success: false, error: 'Erro de conexão ao obter link de reagendamento' };
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
  {
    type: 'function',
    function: {
      name: 'get_patient_appointments',
      description: 'Busca agendamentos existentes de um paciente pelo email ou telefone. Use quando o cliente perguntar sobre sua consulta, quiser remarcar ou cancelar.',
      parameters: {
        type: 'object',
        properties: {
          invitee_email: { 
            type: 'string', 
            description: 'Email do paciente para buscar agendamentos' 
          },
        },
        required: ['invitee_email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_booking',
      description: 'Cancela um agendamento existente. Use APENAS quando o cliente confirmar que deseja cancelar sua consulta.',
      parameters: {
        type: 'object',
        properties: {
          event_uri: { 
            type: 'string', 
            description: 'URI do evento retornado por get_patient_appointments' 
          },
          reason: { 
            type: 'string', 
            description: 'Motivo do cancelamento informado pelo cliente' 
          },
        },
        required: ['event_uri'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reschedule_link',
      description: 'Obtém o link para o paciente remarcar sua consulta. Use quando o cliente quiser remarcar.',
      parameters: {
        type: 'object',
        properties: {
          invitee_uri: { 
            type: 'string', 
            description: 'URI do invitee retornado por get_patient_appointments' 
          },
        },
        required: ['invitee_uri'],
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

Deno.serve(async (req: Request) => {
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

    const { conversationId, messageContent, instanceName: providedInstanceName, instanceId, manualTrigger, incomingMessageType = 'text' } = await req.json();
    
    console.log(`[AI-AGENT] Incoming message type: ${incomingMessageType}`);

    // For manual trigger, we need to fetch the last inbound message
    let effectiveMessageContent = messageContent;
    let instanceName = providedInstanceName;
    
    if (!conversationId) {
      throw new Error('conversationId is required');
    }
    
    // If manualTrigger, we need to fetch the instance name from the database
    if (manualTrigger && instanceId && !instanceName) {
      console.log('[AI-AGENT] Manual trigger: fetching instance name from database');
      const { data: instanceData } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('id', instanceId)
        .single();
      
      if (instanceData?.instance_name) {
        instanceName = instanceData.instance_name;
        console.log('[AI-AGENT] Found instance name:', instanceName);
      } else {
        console.error('[AI-AGENT] Instance not found for id:', instanceId);
        return new Response(
          JSON.stringify({ success: false, reason: 'Instance not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // If manualTrigger but no messageContent, log it
    if (manualTrigger && !messageContent) {
      console.log('[AI-AGENT] Manual trigger: will fetch last inbound message');
    }

    console.log(`[AI-AGENT] Processing message for conversation ${conversationId}, instanceId: ${instanceId}`);

    // === DEBOUNCE CHECK: Prevent multiple rapid responses ===
    // Check if agent sent a message very recently (within 15 seconds)
    if (!manualTrigger) {
      const { data: recentAgentMessage } = await supabase
        .from('inbox_messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .eq('direction', 'outbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentAgentMessage?.created_at) {
        const lastAgentMessageTime = new Date(recentAgentMessage.created_at).getTime();
        const now = Date.now();
        const timeSinceLastAgentMessage = (now - lastAgentMessageTime) / 1000; // in seconds
        
        if (timeSinceLastAgentMessage < 15) {
          console.log(`[AI-AGENT] DEBOUNCE: Agent sent message ${timeSinceLastAgentMessage.toFixed(1)}s ago - skipping to avoid duplicate`);
          return new Response(
            JSON.stringify({ success: false, reason: 'Debounce - recent agent message', timeSinceLastAgentMessage }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Fetch conversation with campaign info and preferred format
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id, user_id, contact_id, campaign_id, ai_handled, ai_interactions_count, ai_paused, ai_handoff_requested, instance_id, preferred_response_format,
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
      max_interactions: agentConfig.max_interactions || 50,
      response_delay_min: agentConfig.response_delay_min || 3,
      response_delay_max: agentConfig.response_delay_max || 8,
      active_hours_start: agentConfig.active_hours_start || 8,
      active_hours_end: agentConfig.active_hours_end || 20,
      handoff_keywords: agentConfig.handoff_keywords || ['atendente', 'humano', 'pessoa', 'falar com alguém'],
      is_active: agentConfig.is_active ?? true,
      response_mode: agentConfig.response_mode || 'text',
      voice_id: agentConfig.voice_id || 'EXAVITQu4vr4xnSDxMaL',
    };

    // Skip pause and handoff checks for manual trigger
    if (!manualTrigger) {
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

      // Check if within active hours (only for automatic trigger)
      if (!isWithinActiveHours(config.active_hours_start, config.active_hours_end)) {
        console.log('[AI-AGENT] Outside active hours');
        return new Response(
          JSON.stringify({ success: false, reason: 'Outside active hours' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('[AI-AGENT] Manual trigger - skipping pause/handoff/hours checks');
      
      // For manual trigger, reset handoff and pause status
      await supabase
        .from('conversations')
        .update({
          ai_paused: false,
          ai_handoff_requested: false,
          ai_handoff_reason: null,
          ai_handled: true,
        })
        .eq('id', conversationId);
    }
    
    // Fetch message content for manual trigger if not provided
    if (manualTrigger && !effectiveMessageContent) {
      const { data: lastMessages } = await supabase
        .from('inbox_messages')
        .select('content')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (lastMessages?.[0]) {
        effectiveMessageContent = lastMessages[0].content;
        console.log('[AI-AGENT] Using last inbound message:', effectiveMessageContent.substring(0, 50) + '...');
      } else {
        // If no inbound messages, use a generic greeting request
        effectiveMessageContent = 'Olá, gostaria de mais informações';
        console.log('[AI-AGENT] No inbound messages found, using default message');
      }
    }

    // Check max interactions (0 = unlimited)
    const interactionCount = conversation.ai_interactions_count || 0;
    if (config.max_interactions > 0 && interactionCount >= config.max_interactions) {
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
    if (containsHandoffKeyword(effectiveMessageContent, handoffKeywords)) {
      console.log('[AI-AGENT] Handoff keyword detected');
      
      await supabase
        .from('conversations')
        .update({
          ai_handoff_requested: true,
          ai_handoff_reason: `Cliente solicitou atendimento humano`,
        })
        .eq('id', conversationId);

      // Send ai_handoff notification
      try {
        // Get contact name for notification
        const contactsData = conversation.contacts as { name?: string }[] | { name?: string };
        const contactData = Array.isArray(contactsData) ? contactsData[0] : contactsData;
        const contactNameForNotif = contactData?.name || 'Cliente';
        
        await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            type: 'ai_handoff',
            data: { conversationId, contactName: contactNameForNotif },
          }),
        });
        console.log('[AI-AGENT] Sent ai_handoff notification');
      } catch (e) {
        console.error('[AI-AGENT] Failed to send ai_handoff notification:', e);
      }

      // Send handoff message
      const handoffMessage = 'Entendi! Vou transferir você para um de nossos atendentes. Aguarde um momento, por favor.';
      
      // deno-lint-ignore no-explicit-any
      const contactsHandoff = conversation.contacts as any;
      const contactHandoff = Array.isArray(contactsHandoff) ? contactsHandoff[0] : contactsHandoff;
      const rawPhoneHandoff = contactHandoff?.phone || '';
      
      // Handle LID (Click-to-WhatsApp Ads) contacts
      let phoneHandoff: string;
      if (rawPhoneHandoff.startsWith('LID_')) {
        const labelId = rawPhoneHandoff.replace('LID_', '');
        phoneHandoff = `${labelId}@lid`;
        console.log(`[AI-AGENT] Handoff for LID contact, using jid format: ${phoneHandoff}`);
      } else {
        phoneHandoff = rawPhoneHandoff.replace(/\D/g, '');
        if (!phoneHandoff.startsWith('55')) phoneHandoff = '55' + phoneHandoff;
      }

      await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phoneHandoff, text: handoffMessage }),
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
        effectiveMessageContent,
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
    if (currentStage && !currentStage.is_final && checkStageCompletion(currentStage, collectedData, effectiveMessageContent)) {
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
    const conversationHistoryForSlots: ConversationMessage[] = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // === DETECT REPETITIVE QUESTIONS IN HISTORY ===
    // Analyze agent messages to avoid repeating the same questions
    const agentMessages = (messages || []).filter(m => m.direction === 'outbound').map(m => m.content.toLowerCase());
    
    // Track what has already been asked/mentioned
    const alreadyAsked = {
      oticaIndicada: agentMessages.some(m => 
        m.includes('ótica indicada') || m.includes('otica indicada') || 
        m.includes('qual ótica') || m.includes('qual otica') ||
        m.includes('indicação de ótica') || m.includes('indicacao de otica')
      ),
      nome: agentMessages.some(m => 
        m.includes('qual seu nome') || m.includes('qual o seu nome') ||
        m.includes('seu nome por favor') || m.includes('como posso chamar')
      ),
      horarioPreferido: agentMessages.some(m => 
        m.includes('qual horário') || m.includes('qual horario') ||
        m.includes('melhor horário') || m.includes('melhor horario') ||
        m.includes('horário te atende') || m.includes('horario te atende')
      ),
      slotsOferecidos: agentMessages.some(m => 
        m.includes('tenho às') || m.includes('tenho as') ||
        m.includes('disponível às') || m.includes('disponivel as') ||
        m.match(/\d{1,2}:\d{2}/) !== null
      ),
    };
    
    console.log('[AI-AGENT] Already asked in conversation:', JSON.stringify(alreadyAsked));

    // === PRE-FETCH CALENDLY SLOTS ===
    // Check if first response or agent uses slot placeholders
    const assistantMessagesCount = conversationHistoryForSlots.filter(m => m.role === 'assistant').length;
    const isFirstResponse = assistantMessagesCount === 0;
    const needsSlots = hasSlotPlaceholders(config.greeting_message || '') || 
                       hasSlotPlaceholders(config.behavior_rules || '') ||
                       hasSlotPlaceholders(config.personality_prompt || '');

    const hasCalendarIntegration = !!calendarIntegration && !!agentConfig?.id;
    let slot1Formatted = '';
    let slot2Formatted = '';
    let slot1Iso = '';
    let slot2Iso = '';
    let prefetchedSlots: Array<{ start_time: string; status: string }> = [];

    if (hasCalendarIntegration && (isFirstResponse || needsSlots)) {
      console.log('[AI-AGENT] Pre-fetching Calendly slots (first response or needs slots)...');
      
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      console.log(`[AI-AGENT] Fetching slots from ${startDate} to ${endDate}`);
      
      const availableTimes = await fetchCalendlyAvailableTimes(supabaseUrl, agentConfig.id, startDate, endDate);
      
      if (availableTimes && availableTimes.length > 0) {
        prefetchedSlots = availableTimes;
        
        if (availableTimes[0]) {
          slot1Formatted = formatSlotBR(availableTimes[0].start_time);
          slot1Iso = availableTimes[0].start_time;
        }
        if (availableTimes[1]) {
          slot2Formatted = formatSlotBR(availableTimes[1].start_time);
          slot2Iso = availableTimes[1].start_time;
        }
        
        console.log(`[AI-AGENT] Pre-fetched ${availableTimes.length} slots. slot1: ${slot1Formatted}, slot2: ${slot2Formatted}`);
      } else {
        console.log('[AI-AGENT] No slots available from Calendly');
        slot1Formatted = 'sem horários disponíveis no momento';
        slot2Formatted = 'sem horários disponíveis no momento';
      }
    }

    // Apply slot placeholder substitution
    let effectiveGreeting = config.greeting_message || '';
    let effectiveBehaviorRules = config.behavior_rules || '';
    let effectivePersonality = config.personality_prompt || '';

    if (slot1Formatted && slot2Formatted) {
      effectiveGreeting = replaceSlotPlaceholders(effectiveGreeting, slot1Formatted, slot2Formatted, slot1Iso, slot2Iso);
      effectiveBehaviorRules = replaceSlotPlaceholders(effectiveBehaviorRules, slot1Formatted, slot2Formatted, slot1Iso, slot2Iso);
      effectivePersonality = replaceSlotPlaceholders(effectivePersonality, slot1Formatted, slot2Formatted, slot1Iso, slot2Iso);
    }

    // Re-build conversation history (use previously fetched data)

    // Build conversation history for AI
    const conversationHistory: ConversationMessage[] = (messages || []).map(msg => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // Add current message (only if not already in history)
    const lastHistoryMessage = conversationHistory[conversationHistory.length - 1];
    if (!lastHistoryMessage || lastHistoryMessage.content !== effectiveMessageContent) {
      conversationHistory.push({ role: 'user', content: effectiveMessageContent });
    }

    // Build system prompt
    // deno-lint-ignore no-explicit-any
    const contacts = conversation.contacts as any;
    const contact = Array.isArray(contacts) ? contacts[0] : contacts;
    
    // Helper function to validate contact names
    const isValidContactName = (name: string | undefined | null): boolean => {
      if (!name || name.trim().length < 2) return false;
      if (name.startsWith('LID_')) return false;
      if (/^\d+$/.test(name)) return false; // Only numbers
      if (/^55\d{10,11}$/.test(name)) return false; // BR phone number
      return true;
    };
    
    const contactName = isValidContactName(contact?.name) ? contact.name : 'Cliente';
    
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
    
    // Start with personality prompt (use effective version with slot placeholders replaced)
    let systemPrompt = effectivePersonality || 
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
    
    // Add behavior rules (use effective version with slot placeholders replaced)
    if (effectiveBehaviorRules) {
      systemPrompt += `\n\n## Regras de Comportamento\n${effectiveBehaviorRules}`;
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
    
    // === ADD REPETITIVE QUESTIONS GUARD ===
    // Prevent agent from asking the same things multiple times
    const repetitiveQuestionsGuard: string[] = [];
    
    if (alreadyAsked.oticaIndicada) {
      repetitiveQuestionsGuard.push('- ❌ NÃO pergunte sobre "ótica indicada" - você já perguntou isso antes');
    }
    if (alreadyAsked.nome) {
      repetitiveQuestionsGuard.push('- ❌ NÃO pergunte o nome do cliente - você já tem ou já perguntou');
    }
    if (alreadyAsked.horarioPreferido) {
      repetitiveQuestionsGuard.push('- ❌ NÃO pergunte novamente qual horário prefere - foque em confirmar um horário específico');
    }
    if (alreadyAsked.slotsOferecidos) {
      repetitiveQuestionsGuard.push('- ⚠️ Você já ofereceu horários antes - se o cliente não escolheu, pergunte diretamente qual ele prefere ou ofereça NOVOS horários');
    }
    
    if (repetitiveQuestionsGuard.length > 0) {
      systemPrompt += `\n\n## 🚫 PERGUNTAS QUE VOCÊ JÁ FEZ (NÃO REPITA!)
${repetitiveQuestionsGuard.join('\n')}

**REGRA OBRIGATÓRIA**: Revise o histórico antes de perguntar qualquer coisa. Se você já perguntou algo, não repita. Avance a conversa.`;
    }
    
    // Check if user is asking about scheduling and we have calendar integration
    let calendarContext = '';
    // hasCalendarIntegration is already defined above in the pre-fetch section
    
    // Check if user is requesting a specific time (needs MANDATORY verification before confirming)
    const userRequestingSpecificTime = isRequestingSpecificTime(effectiveMessageContent);
    
    if (hasCalendarIntegration && (isAskingAboutSchedule(effectiveMessageContent) || userRequestingSpecificTime)) {
      console.log('[AI-AGENT] User asking about schedule or specific time, fetching Calendly availability...');
      if (userRequestingSpecificTime) {
        console.log('[AI-AGENT] ⚠️ User requesting SPECIFIC TIME - mandatory verification required');
      }
      const availability = await fetchCalendlyAvailability(supabaseUrl, agentConfig.id);
      
      // Add specific time warning if user requested a specific time
      const specificTimeWarning = userRequestingSpecificTime ? `
### 🚨🚨🚨 ATENÇÃO MÁXIMA - CLIENTE PEDIU HORÁRIO ESPECÍFICO 🚨🚨🚨
O cliente está pedindo um HORÁRIO ESPECÍFICO na mensagem atual.
**VOCÊ DEVE OBRIGATORIAMENTE:**
1. Chamar get_available_times AGORA MESMO antes de responder
2. Verificar se o horário pedido está na lista de disponíveis
3. Se NÃO estiver disponível: informar que está ocupado e oferecer alternativas
4. Se estiver disponível: confirmar e prosseguir com o agendamento
5. NUNCA diga "vou verificar" - verifique AGORA usando a ferramenta!

` : '';
      
      if (availability) {
        calendarContext = `\n\n## ⚠️ REGRAS CRÍTICAS E OBRIGATÓRIAS DE AGENDAMENTO ⚠️
${specificTimeWarning}

### 🚨 REGRA NÚMERO 1 - VERIFICAÇÃO OBRIGATÓRIA 🚨
**ANTES de mencionar, confirmar ou sugerir QUALQUER horário ao cliente:**
1. SEMPRE chame get_available_times PRIMEIRO
2. NUNCA diga "temos às X horas" sem ter verificado NA HORA
3. NUNCA pergunte "pode ser às X horas?" sem ter consultado a agenda
4. Horários mudam a cada MINUTO - verificação é OBRIGATÓRIA antes de cada resposta sobre disponibilidade

### ❌ EXEMPLOS DO QUE NÃO FAZER (ERRADO):
- Cliente: "Quero às 16h"
- Você: "Para confirmar às 16h, preciso do seu email" ← ERRADO! Você não verificou se 16h está livre!

- Cliente: "Tem horário?"
- Você: "Sim, temos às 14h, 15h, 16h" ← ERRADO! Você inventou horários sem verificar!

### ✅ EXEMPLOS DO QUE FAZER (CORRETO):
- Cliente: "Quero às 16h"
- Você: [PRIMEIRO chama get_available_times] 
- Se 16h aparece na lista: "16h está disponível sim! Para confirmar, preciso do seu email"
- Se 16h NÃO aparece: "Infelizmente 16h já está ocupado. Tenho às 14:00, 14:30, 15:00... qual prefere?"

### Formato dos horários (get_available_times):
A ferramenta retorna horários assim:
  [A] sex, 26/12 às 09:00
  [B] sex, 26/12 às 09:23
  ...
  
E um MAPEAMENTO INTERNO:
  A = 2025-12-26T12:00:00.000000Z
  B = 2025-12-26T12:23:00.000000Z
  ...

### O QUE FAZER:
1. SEMPRE chame get_available_times ANTES de falar qualquer horário
2. Liste CADA horário individualmente: "Tenho às 09:00, 09:23, 09:46..."
3. Quando o cliente escolher (ex: "09:00"), VERIFIQUE se ainda está na lista
4. Para create_booking, use o valor ISO do MAPEAMENTO dessa letra (ex: "2025-12-26T12:00:00.000000Z")

### O QUE NÃO FAZER:
❌ NÃO confirme horário sem verificar get_available_times PRIMEIRO
❌ NÃO agrupe horários (errado: "9h às 11h")
❌ NÃO invente ISOs baseado no horário (errado: usar "2025-12-26T09:00:00Z" se o cliente disse 09:00)
❌ NÃO mostre o mapeamento ou códigos técnicos ao cliente
❌ NÃO assuma que um horário está livre só porque estava livre antes

Link alternativo: ${availability.schedulingUrl}`;
        
        if (availability.hasBusySlots && availability.busySlots.length > 0) {
          const busyTimes = availability.busySlots.map(slot => {
            const start = new Date(slot.start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            const end = new Date(slot.end).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
            return `${start} - ${end} (${slot.name})`;
          }).join('\n  - ');
          calendarContext += `\n\nHorários já ocupados hoje:\n  - ${busyTimes}`;
        }
      }
    } else if (hasCalendarIntegration) {
      calendarContext = `\n\n## Agendamento Disponível

### 🚨 REGRA OBRIGATÓRIA 🚨
Quando o cliente quiser agendar ou mencionar qualquer horário:
1. SEMPRE chame get_available_times PRIMEIRO
2. NUNCA confirme ou sugira horários sem verificar disponibilidade em tempo real
3. Horários mudam constantemente - verifique SEMPRE antes de responder

A ferramenta retorna horários com códigos [A], [B], etc. Liste CADA horário individualmente para o cliente e use o mapeamento interno para o create_booking.`;
    }
    
    if (calendarContext) {
      systemPrompt += calendarContext;
    }

    // Add pre-fetched slots context for first response
    if (isFirstResponse && prefetchedSlots.length > 0) {
      systemPrompt += `\n\n## 📌 HORÁRIOS PRÉ-CARREGADOS (PRIMEIRA RESPOSTA)
Os seguintes horários JÁ FORAM verificados no Calendly e estão DISPONÍVEIS:
- SLOT1 = ${slot1Formatted} (ISO: ${slot1Iso})
- SLOT2 = ${slot2Formatted} (ISO: ${slot2Iso})

🚨 IMPORTANTE PARA PRIMEIRA MENSAGEM:
- OFEREÇA estes horários DIRETAMENTE ao cliente na sua primeira resposta
- NÃO precisa chamar get_available_times agora - já verificamos para você
- Use exatamente o texto do greeting message configurado abaixo
- Se o cliente escolher um desses horários posteriormente, use o valor ISO correspondente`;

      // Add effective greeting as model for first response
      if (effectiveGreeting) {
        systemPrompt += `\n\n## MODELO PARA PRIMEIRA RESPOSTA (USE ESTE FORMATO):
"${effectiveGreeting}"

SIGA este formato na sua primeira mensagem, oferecendo os horários pré-carregados.`;
      }
    }
    // Analyze conversation history to detect what has already been said
    const historicoJaSaudou = conversationHistory.some(msg => 
      msg.role === 'assistant' && 
      (msg.content.toLowerCase().includes('olá') || 
       msg.content.toLowerCase().includes('oi') ||
       msg.content.toLowerCase().includes('bom dia') ||
       msg.content.toLowerCase().includes('boa tarde') ||
       msg.content.toLowerCase().includes('boa noite') ||
       msg.content.toLowerCase().includes('sou a') ||
       msg.content.toLowerCase().includes('sou o') ||
       msg.content.toLowerCase().includes('assistente virtual') ||
       msg.content.toLowerCase().includes('bem-vind'))
    );

    const historicoJaPerguntouNome = conversationHistory.some(msg =>
      msg.role === 'assistant' && 
      (msg.content.toLowerCase().includes('qual') || msg.content.toLowerCase().includes('como')) &&
      msg.content.toLowerCase().includes('nome')
    );

    const historicoClienteDisseNome = conversationHistory.some(msg =>
      msg.role === 'user' && 
      // Short message (1-3 words) is usually a name
      msg.content.split(' ').length <= 3 && 
      msg.content.length < 30 &&
      msg.content.length > 1
    );

    const totalMensagensAssistant = conversationHistory.filter(m => m.role === 'assistant').length;
    
    // Add critical continuity rules
    systemPrompt += `\n\n## ⚠️ REGRAS CRÍTICAS DE CONTINUIDADE DA CONVERSA ⚠️

ATENÇÃO: Você está em uma CONVERSA CONTÍNUA. O histórico acima mostra todas as mensagens trocadas.

### Estado Atual da Conversa:
- Já me apresentei/saudei? ${historicoJaSaudou ? '✅ SIM - NÃO REPETIR saudação' : '❌ NÃO - pode saudar'}
- Já perguntei o nome? ${historicoJaPerguntouNome ? '✅ SIM - NÃO PERGUNTAR de novo' : '❌ NÃO'}
- Cliente já disse o nome? ${historicoClienteDisseNome ? '✅ PROVAVELMENTE SIM' : '❌ NÃO'}
- Total de respostas minhas no histórico: ${totalMensagensAssistant}

### REGRAS OBRIGATÓRIAS:
1. **NUNCA REPITA SAUDAÇÕES** - Se já disse "Olá", "Oi", "Sou a Bia" (ou similar) no histórico, NÃO diga novamente
2. **NUNCA REPITA PERGUNTAS** - Se já perguntou o nome, interesse, etc., NÃO pergunte de novo
3. **ANALISE O HISTÓRICO** - Leia as mensagens anteriores e continue de onde parou
4. **SEJA CONTEXTUAL** - Responda baseado na última mensagem do cliente
5. **PROGRIDA NA CONVERSA** - Avance para o próximo passo, não reinicie

### O que NÃO fazer:
❌ Dizer "Olá" se já saudou antes
❌ Perguntar "Qual seu nome?" se já sabe ou já perguntou
❌ Repetir sua apresentação a cada mensagem
❌ Ignorar o que o cliente disse e recomeçar do zero

### O que FAZER:
✅ Responder diretamente ao que o cliente disse
✅ Continuar de onde a conversa parou
✅ Usar o nome do cliente se já souber
✅ Avançar para o próximo assunto`;

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
            
            // NOVO FORMATO: Usar letras como código para forçar uso exato
            const timesSlice = availableTimes.slice(0, 10);
            
            // Lista para mostrar ao cliente (só horários em BRT)
            const listaParaCliente = timesSlice.map((slot, index) => {
              const utcDate = new Date(slot.start_time);
              const codigo = String.fromCharCode(65 + index); // A, B, C, D...
              
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
              
              return `[${codigo}] ${dataBRT} às ${horaBRT}`;
            }).join('\n');
            
            // Mapeamento interno de códigos para ISO UTC
            const mapeamento = timesSlice.map((slot, index) => {
              const codigo = String.fromCharCode(65 + index);
              return `${codigo} = ${slot.start_time}`;
            }).join('\n');
            
            console.log(`[AI-AGENT] Formatted times for client:\n${listaParaCliente}`);
            console.log(`[AI-AGENT] Code mapping:\n${mapeamento}`);
            
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `## HORÁRIOS DISPONÍVEIS

DIGA AO CLIENTE EXATAMENTE ASSIM (liste cada um individualmente):
${listaParaCliente}

---
⚠️ MAPEAMENTO INTERNO (NÃO MOSTRE ISSO AO CLIENTE):
${mapeamento}

---
📋 REGRAS OBRIGATÓRIAS:
1. Liste CADA horário individualmente para o cliente (ex: "Tenho às 09:00, 09:23, 09:46...")
2. NÃO agrupe em intervalos (ERRADO: "9h às 11h", CERTO: "09:00, 09:23, 09:46...")
3. Quando o cliente escolher um horário, encontre a LETRA correspondente acima
4. Para agendar, use o valor ISO do mapeamento EXATAMENTE como está (com o Z no final)
5. NUNCA construa um ISO baseado no horário que o cliente disse - use APENAS o mapeamento`,
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
          let inviteeEmailArg = args.invitee_email || '';
          const inviteeNameArg = args.invitee_name || '';
          const inviteePhoneArg = args.invitee_phone || '';
          
          console.log(`[AI-AGENT] create_booking called with start_time: "${startTimeArg}", email: "${inviteeEmailArg}"`);
          
          // AUTO-GENERATE EMAIL IF NOT PROVIDED
          // Use phone number as fallback to create unique email
          if (!inviteeEmailArg || inviteeEmailArg.trim() === '') {
            const contactPhoneForEmail = contact?.phone?.replace(/\D/g, '') || '';
            if (contactPhoneForEmail) {
              inviteeEmailArg = `${contactPhoneForEmail}@paciente.csv.com`;
              console.log(`[AI-AGENT] Auto-generated email from phone: ${inviteeEmailArg}`);
            } else {
              console.log(`[AI-AGENT] No email or phone available for booking`);
              toolResults.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: `❌ ERRO: Não foi possível criar o agendamento. Precisamos do telefone ou email do cliente. Pergunte gentilmente como podemos entrar em contato para confirmar a consulta.`,
              });
              continue;
            }
          }
          
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
              inviteeNameArg,
              inviteeEmailArg,
              inviteePhoneArg
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
    const rawPhone = contactData?.phone || '';
    
    // Check if this is a LID (Click-to-WhatsApp Ads) contact
    // LID contacts have phone stored as "LID_<labelId>" and need to use @lid jid format
    let phone: string;
    let isLidContact = false;
    
    if (rawPhone.startsWith('LID_')) {
      isLidContact = true;
      // Extract the label ID and format for Evolution API
      const labelId = rawPhone.replace('LID_', '');
      // Evolution API expects the jid format for LID contacts
      phone = `${labelId}@lid`;
      console.log(`[AI-AGENT] LID contact detected, using jid format: ${phone}`);
    } else {
      // Regular phone number
      phone = rawPhone.replace(/\D/g, '');
      if (!phone.startsWith('55')) phone = '55' + phone;
    }

    let textMessageId: string | null = null;
    let audioMessageId: string | null = null;
    let audioUrl: string | null = null;

    // Detect if client explicitly requested a format change
    const requestedFormat = detectFormatPreference(effectiveMessageContent);
    const preferredFormat = conversation.preferred_response_format;
    
    // Determine response format using adaptive logic
    // For 'both' mode, we send both regardless
    const adaptiveFormat = determineResponseFormat(
      incomingMessageType,
      preferredFormat,
      requestedFormat,
      config.response_mode
    );
    
    console.log(`[AI-AGENT] Response format decision: incoming=${incomingMessageType}, preferred=${preferredFormat}, requested=${requestedFormat}, config=${config.response_mode}, final=${adaptiveFormat}`);

    // Save preference if client explicitly requested a format change
    if (requestedFormat && requestedFormat !== preferredFormat) {
      console.log(`[AI-AGENT] Saving client format preference: ${requestedFormat}`);
      await supabase
        .from('conversations')
        .update({ preferred_response_format: requestedFormat })
        .eq('id', conversationId);
    }

    // Determine what to send based on config mode and adaptive format
    const shouldSendText = config.response_mode === 'both' || 
                           config.response_mode === 'text' || 
                           (config.response_mode !== 'audio' && adaptiveFormat === 'text');
    const shouldSendAudio = config.response_mode === 'both' || 
                            config.response_mode === 'audio' || 
                            adaptiveFormat === 'audio';

    // Send text message if needed
    if (shouldSendText && adaptiveFormat === 'text') {
      console.log('[AI-AGENT] Sending text message...');
      const sendResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phone, text: aiMessage }),
      });

      const sendResult = await sendResponse.json();
      console.log('[AI-AGENT] Evolution API text response:', sendResult);

      if (!sendResponse.ok || !sendResult.key) {
        console.error('[AI-AGENT] Failed to send text message');
        throw new Error('Failed to send text message via Evolution API');
      }
      
      textMessageId = sendResult.key?.id || null;
    }

    // Send audio message if adaptive format says audio OR config is 'both' or 'audio'
    if (shouldSendAudio && (adaptiveFormat === 'audio' || config.response_mode === 'both')) {
      console.log('[AI-AGENT] Converting text to speech via ElevenLabs...');
      
      try {
        // Call TTS edge function
        const ttsResponse = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            text: aiMessage,
            voiceId: config.voice_id || 'EXAVITQu4vr4xnSDxMaL',
          }),
        });

        const ttsResult = await ttsResponse.json();
        console.log('[AI-AGENT] TTS response:', ttsResult);

        if (ttsResult.success && ttsResult.audioUrl) {
          audioUrl = ttsResult.audioUrl;
          
          // Send audio via Evolution API
          console.log('[AI-AGENT] Sending audio message...');
          const sendAudioResponse = await fetch(`${evolutionApiUrl}/message/sendWhatsAppAudio/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: phone,
              audio: audioUrl,
            }),
          });

          const sendAudioResult = await sendAudioResponse.json();
          console.log('[AI-AGENT] Evolution API audio response:', sendAudioResult);

          if (sendAudioResponse.ok && sendAudioResult.key) {
            audioMessageId = sendAudioResult.key?.id || null;
          } else {
            console.error('[AI-AGENT] Failed to send audio, but continuing...');
          }
        } else {
          console.error('[AI-AGENT] TTS conversion failed:', ttsResult.error);
        }
      } catch (ttsError) {
        console.error('[AI-AGENT] TTS error:', ttsError);
        // Don't fail the whole request if TTS fails
      }
    }

    // If config is 'both', also send text message
    if (config.response_mode === 'both' && !textMessageId) {
      console.log('[AI-AGENT] Config is "both", also sending text message...');
      const sendResponse = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: phone, text: aiMessage }),
      });

      const sendResult = await sendResponse.json();
      if (sendResponse.ok && sendResult.key) {
        textMessageId = sendResult.key?.id || null;
      }
    }

    // Verify at least one message was sent
    if (!textMessageId && !audioMessageId) {
      throw new Error('Failed to send any message via Evolution API');
    }

    // Update conversation AI counters
    await supabase
      .from('conversations')
      .update({
        ai_handled: true,
        ai_interactions_count: interactionCount + 1,
      })
      .eq('id', conversationId);

    // Save text message to inbox if sent
    if (textMessageId || config.response_mode === 'text') {
      await supabase
        .from('inbox_messages')
        .insert({
          user_id: conversation.user_id,
          conversation_id: conversationId,
          content: aiMessage,
          direction: 'outbound',
          status: 'sent',
          message_type: 'text',
          whatsapp_message_id: textMessageId,
          sent_at: new Date().toISOString(),
          is_ai_generated: true,
          sent_by_ai_agent_id: config.id,
        });
    }

    // Save audio message to inbox if sent
    if (audioMessageId && audioUrl) {
      await supabase
        .from('inbox_messages')
        .insert({
          user_id: conversation.user_id,
          conversation_id: conversationId,
          content: aiMessage, // Store transcription as content
          direction: 'outbound',
          status: 'sent',
          message_type: 'audio',
          media_url: audioUrl,
          whatsapp_message_id: audioMessageId,
          sent_at: new Date().toISOString(),
          is_ai_generated: true,
          sent_by_ai_agent_id: config.id,
        });
    }

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
