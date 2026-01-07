import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  conversation_id: string;
  direction: string;
  content: string;
  message_type: string;
  transcription: string | null;
  created_at: string;
  media_url: string | null;
}

interface Conversation {
  id: string;
  contact: {
    name: string | null;
    phone: string;
  };
  messages: Message[];
}

// Standard report structure schema for tool calling
const reportSchema = {
  type: "object",
  properties: {
    overall_score: { type: "number", description: "Nota geral de 0 a 100" },
    textual_quality_score: { type: "number", description: "Nota de qualidade textual de 0 a 100" },
    communication_score: { type: "number", description: "Nota de comunicação de 0 a 100" },
    sales_score: { type: "number", description: "Nota de vendas de 0 a 100" },
    efficiency_score: { type: "number", description: "Nota de eficiência de 0 a 100" },
    audio_analysis_score: { type: "number", description: "Nota de análise de áudios de 0 a 100" },
    executive_summary: { type: "string", description: "Resumo executivo em 3-5 parágrafos" },
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          example: { type: "string" }
        },
        required: ["title", "description"]
      },
      description: "Até 5 pontos fortes identificados"
    },
    improvements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          suggestion: { type: "string" },
          example: { type: "string" }
        },
        required: ["title", "description"]
      },
      description: "Até 5 áreas de melhoria"
    },
    recommendations: {
      type: "array",
      items: { type: "string" },
      description: "3-5 recomendações acionáveis"
    },
    highlighted_examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["positive", "negative"] },
          context: { type: "string" },
          message: { type: "string" },
          reason: { type: "string" }
        },
        required: ["type", "context", "message", "reason"]
      },
      description: "Até 6 exemplos destacados (3 positivos, 3 negativos)"
    },
    conversation_details: {
      type: "array",
      items: {
        type: "object",
        properties: {
          contact: { type: "string" },
          score: { type: "number" },
          summary: { type: "string" },
          feedback: { type: "string" }
        },
        required: ["contact", "score", "summary", "feedback"]
      },
      description: "Detalhes de até 10 conversas analisadas"
    }
  },
  required: [
    "overall_score",
    "textual_quality_score",
    "communication_score",
    "sales_score",
    "efficiency_score",
    "audio_analysis_score",
    "executive_summary",
    "strengths",
    "improvements",
    "recommendations",
    "highlighted_examples",
    "conversation_details"
  ]
};

// Helper to clamp scores between 0-100
function clampScore(score: number | undefined | null): number {
  if (score === undefined || score === null || isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// Normalize and validate the analysis result
function normalizeAnalysisResult(raw: any): any {
  return {
    overall_score: clampScore(raw.overall_score),
    textual_quality_score: clampScore(raw.textual_quality_score),
    communication_score: clampScore(raw.communication_score),
    sales_score: clampScore(raw.sales_score),
    efficiency_score: clampScore(raw.efficiency_score),
    audio_analysis_score: clampScore(raw.audio_analysis_score),
    executive_summary: typeof raw.executive_summary === 'string' ? raw.executive_summary : 'Análise concluída.',
    strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 5).map((s: any) => ({
      title: s.title || 'Ponto forte',
      description: s.description || '',
      example: s.example || ''
    })) : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 5).map((i: any) => ({
      title: i.title || 'Área de melhoria',
      description: i.description || '',
      suggestion: i.suggestion || '',
      example: i.example || ''
    })) : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations.slice(0, 5).filter((r: any) => typeof r === 'string') : [],
    highlighted_examples: Array.isArray(raw.highlighted_examples) ? raw.highlighted_examples.slice(0, 6).map((e: any) => ({
      type: e.type === 'negative' ? 'negative' : 'positive',
      context: e.context || '',
      message: e.message || '',
      reason: e.reason || ''
    })) : [],
    conversation_details: Array.isArray(raw.conversation_details) ? raw.conversation_details.slice(0, 10).map((c: any) => ({
      contact: c.contact || 'Contato',
      score: clampScore(c.score),
      summary: c.summary || '',
      feedback: c.feedback || ''
    })) : []
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid token');
    }

    const { periodStart, periodEnd, transcribeAudios = true, tzOffsetMinutes = 180 } = await req.json();

    if (!periodStart || !periodEnd) {
      throw new Error('periodStart and periodEnd are required');
    }

    // Calculate UTC timestamps for the full day in user's timezone
    // tzOffsetMinutes: positive = behind UTC (e.g., Brazil is +180 = UTC-3)
    // For Brazil (UTC-3): tzOffsetMinutes = 180
    // To get start of day in user's TZ: we need 00:00 local = 00:00 + offset in UTC
    const [startYear, startMonth, startDay] = periodStart.split('-').map(Number);
    const [endYear, endMonth, endDay] = periodEnd.split('-').map(Number);
    
    // Create dates at midnight UTC, then adjust for timezone
    const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));
    
    // Adjust for timezone: add offset minutes to get UTC equivalent of local time
    startDate.setUTCMinutes(startDate.getUTCMinutes() + tzOffsetMinutes);
    endDate.setUTCMinutes(endDate.getUTCMinutes() + tzOffsetMinutes);
    
    const periodStartISO = startDate.toISOString();
    const periodEndISO = endDate.toISOString();

    console.log(`Starting analysis for user ${user.id}`);
    console.log(`Period: ${periodStart} to ${periodEnd} (local)`);
    console.log(`UTC range: ${periodStartISO} to ${periodEndISO}`);

    // Create the report record first
    const { data: report, error: reportError } = await supabase
      .from('conversation_analysis_reports')
      .insert({
        user_id: user.id,
        period_start: periodStart,
        period_end: periodEnd,
        overall_score: 0,
        textual_quality_score: 0,
        communication_score: 0,
        sales_score: 0,
        efficiency_score: 0,
        audio_analysis_score: 0,
        executive_summary: 'Processando análise...',
        status: 'processing'
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error creating report:', reportError);
      throw new Error('Failed to create report');
    }

    console.log(`Report ${report.id} created, fetching messages in period...`);

    // IMPROVED: First fetch messages in the period to find all relevant conversations
    // This ensures we get conversations even if their last_message_at is outside the period
    const { data: messagesInPeriod, error: msgPeriodError } = await supabase
      .from('inbox_messages')
      .select('conversation_id')
      .eq('user_id', user.id)
      .gte('created_at', periodStartISO)
      .lte('created_at', periodEndISO);

    if (msgPeriodError) {
      console.error('Error fetching messages in period:', msgPeriodError);
      throw new Error('Failed to fetch messages');
    }

    // Get unique conversation IDs
    const uniqueConversationIds = [...new Set((messagesInPeriod || []).map(m => m.conversation_id))];
    console.log(`Found ${uniqueConversationIds.length} conversations with messages in period`);

    if (uniqueConversationIds.length === 0) {
      await supabase
        .from('conversation_analysis_reports')
        .update({
          status: 'completed',
          executive_summary: 'Nenhuma conversa encontrada no período selecionado.',
          overall_score: 0
        })
        .eq('id', report.id);

      return new Response(
        JSON.stringify({ success: true, reportId: report.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch conversation details with contacts
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact:contacts!inner(name, phone)
      `)
      .in('id', uniqueConversationIds);

    if (convError) {
      console.error('Error fetching conversations:', convError);
      throw new Error('Failed to fetch conversations');
    }

    console.log(`Fetched ${conversations?.length || 0} conversation details`);

    // Fetch all messages for these conversations in the period
    const { data: allMessages, error: msgError } = await supabase
      .from('inbox_messages')
      .select('id, conversation_id, direction, content, message_type, transcription, created_at, media_url')
      .in('conversation_id', uniqueConversationIds)
      .gte('created_at', periodStartISO)
      .lte('created_at', periodEndISO)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Error fetching messages:', msgError);
      throw new Error('Failed to fetch messages');
    }

    console.log(`Found ${allMessages?.length || 0} messages`);

    // Transcribe audio messages if requested
    let transcribedCount = 0;
    if (transcribeAudios && allMessages) {
      for (const msg of allMessages) {
        if ((msg.message_type === 'audio' || msg.message_type === 'ptt') && !msg.transcription && msg.media_url) {
          try {
            console.log(`Transcribing audio message ${msg.id}...`);
            const transcribeResponse = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messageId: msg.id,
                audioUrl: msg.media_url
              })
            });

            if (transcribeResponse.ok) {
              const transcribeResult = await transcribeResponse.json();
              msg.transcription = transcribeResult.transcription;
              transcribedCount++;
            }
          } catch (e) {
            console.error(`Failed to transcribe message ${msg.id}:`, e);
          }
        }
      }
    }

    console.log(`Transcribed ${transcribedCount} audio messages`);

    // Group messages by conversation
    const conversationsWithMessages: Conversation[] = (conversations || []).map(conv => {
      const contactData = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact;
      return {
        id: conv.id,
        contact: contactData as { name: string | null; phone: string },
        messages: (allMessages || []).filter(m => m.conversation_id === conv.id)
      };
    }).filter(c => c.messages.length > 0); // Only include conversations with messages

    // Count statistics
    const totalMessages = allMessages?.length || 0;
    const sentMessages = allMessages?.filter(m => m.direction === 'outbound').length || 0;
    const receivedMessages = allMessages?.filter(m => m.direction === 'inbound').length || 0;
    const audioMessages = allMessages?.filter(m => m.message_type === 'audio' || m.message_type === 'ptt').length || 0;

    // Build the analysis prompt
    const conversationTexts = conversationsWithMessages.slice(0, 30).map(conv => {
      const messagesText = conv.messages.map(m => {
        const sender = m.direction === 'outbound' ? 'ATENDENTE' : 'CLIENTE';
        let content = m.content;
        if ((m.message_type === 'audio' || m.message_type === 'ptt') && m.transcription) {
          content = `[ÁUDIO TRANSCRITO]: ${m.transcription}`;
        } else if (m.message_type === 'audio' || m.message_type === 'ptt') {
          content = '[ÁUDIO NÃO TRANSCRITO]';
        } else if (m.message_type === 'image') {
          content = '[IMAGEM ENVIADA]';
        } else if (m.message_type === 'document') {
          content = '[DOCUMENTO ENVIADO]';
        }
        return `${sender}: ${content}`;
      }).join('\n');

      return `--- Conversa com ${conv.contact.name || conv.contact.phone} ---\n${messagesText}`;
    }).join('\n\n');

    console.log('Calling Lovable AI for analysis with tool calling...');

    // Call AI with tool calling for structured output
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um especialista em análise de qualidade de atendimento ao cliente via WhatsApp. Analise as conversas e gere um relatório detalhado usando a função analyze_conversations.

Critérios de avaliação (0-100):
1. QUALIDADE TEXTUAL: Gramática, ortografia, clareza, pontuação, uso apropriado de emojis
2. COMUNICAÇÃO: Rapport, personalização, empatia, escuta ativa, cordialidade
3. VENDAS/PERSUASÃO: Identificação de necessidades, apresentação de soluções, contorno de objeções
4. EFICIÊNCIA: Tempo de resposta, resolução no primeiro contato, objetividade
5. ANÁLISE DE ÁUDIO: Qualidade das transcrições, completude das mensagens de voz

Seja específico, use exemplos reais das conversas. Forneça feedback construtivo e acionável.
Limite: 5 pontos fortes, 5 melhorias, 5 recomendações, 6 exemplos destacados, 10 conversas.`
          },
          {
            role: 'user',
            content: `Analise as conversas do período ${periodStart} a ${periodEnd}:

${conversationTexts}

Estatísticas:
- Total de mensagens: ${totalMessages}
- Enviadas pelo atendente: ${sentMessages}
- Recebidas de clientes: ${receivedMessages}
- Áudios: ${audioMessages}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_conversations",
              description: "Gera um relatório estruturado de análise de atendimento",
              parameters: reportSchema
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_conversations" } }
      }),
    });

    let analysisResult;

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Lovable AI error:', analysisResponse.status, errorText);
      
      if (analysisResponse.status === 429) {
        await supabase
          .from('conversation_analysis_reports')
          .update({
            status: 'error',
            error_message: 'Limite de requisições excedido. Tente novamente em alguns minutos.'
          })
          .eq('id', report.id);
      } else if (analysisResponse.status === 402) {
        await supabase
          .from('conversation_analysis_reports')
          .update({
            status: 'error',
            error_message: 'Créditos de IA insuficientes. Por favor, adicione créditos.'
          })
          .eq('id', report.id);
      } else {
        await supabase
          .from('conversation_analysis_reports')
          .update({
            status: 'error',
            error_message: 'Erro ao processar análise com IA. Tente novamente.'
          })
          .eq('id', report.id);
      }

      return new Response(
        JSON.stringify({ success: false, reportId: report.id, error: 'AI analysis failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await analysisResponse.json();
    console.log('AI response received, parsing...');

    // Try to get tool call result first (structured output)
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const rawResult = JSON.parse(toolCall.function.arguments);
        analysisResult = normalizeAnalysisResult(rawResult);
        console.log('Successfully parsed tool call response');
      } catch (e) {
        console.error('Failed to parse tool call arguments:', e);
        analysisResult = null;
      }
    }

    // Fallback: try to parse regular content if tool call failed
    if (!analysisResult) {
      const aiContent = aiData.choices?.[0]?.message?.content;
      if (aiContent) {
        try {
          let jsonContent = aiContent;
          if (jsonContent.includes('```json')) {
            jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          } else if (jsonContent.includes('```')) {
            jsonContent = jsonContent.replace(/```\n?/g, '');
          }
          const rawResult = JSON.parse(jsonContent.trim());
          analysisResult = normalizeAnalysisResult(rawResult);
          console.log('Successfully parsed content response');
        } catch (e) {
          console.error('Failed to parse content:', e);
        }
      }
    }

    // If all parsing failed, create a basic error response
    if (!analysisResult) {
      console.error('All parsing attempts failed');
      await supabase
        .from('conversation_analysis_reports')
        .update({
          status: 'error',
          error_message: 'Não foi possível gerar a análise padrão. Tente novamente.'
        })
        .eq('id', report.id);

      return new Response(
        JSON.stringify({ success: false, reportId: report.id, error: 'Failed to parse AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the report with normalized analysis results
    const { error: updateError } = await supabase
      .from('conversation_analysis_reports')
      .update({
        overall_score: analysisResult.overall_score,
        textual_quality_score: analysisResult.textual_quality_score,
        communication_score: analysisResult.communication_score,
        sales_score: analysisResult.sales_score,
        efficiency_score: analysisResult.efficiency_score,
        audio_analysis_score: analysisResult.audio_analysis_score,
        executive_summary: analysisResult.executive_summary,
        strengths: analysisResult.strengths,
        improvements: analysisResult.improvements,
        recommendations: analysisResult.recommendations,
        highlighted_examples: analysisResult.highlighted_examples,
        conversation_details: analysisResult.conversation_details,
        total_conversations: conversationsWithMessages.length,
        total_messages_sent: sentMessages,
        total_messages_received: receivedMessages,
        total_audios_analyzed: audioMessages,
        status: 'completed'
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('Error updating report:', updateError);
      throw new Error('Failed to update report');
    }

    console.log(`Analysis complete for report ${report.id}`);

    return new Response(
      JSON.stringify({ success: true, reportId: report.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in analyze-conversations:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
