import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Message {
  id: string;
  direction: string;
  content: string;
  message_type: string;
  transcription: string | null;
  created_at: string;
}

interface Conversation {
  id: string;
  contact: {
    name: string | null;
    phone: string;
  };
  messages: Message[];
}

serve(async (req) => {
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

    const { periodStart, periodEnd, transcribeAudios = true } = await req.json();

    if (!periodStart || !periodEnd) {
      throw new Error('periodStart and periodEnd are required');
    }

    // Calculate full end of day timestamp to include all messages from the end date
    const periodEndDate = new Date(periodEnd);
    periodEndDate.setHours(23, 59, 59, 999);
    const periodEndFull = periodEndDate.toISOString();

    console.log(`Starting analysis for user ${user.id} from ${periodStart} to ${periodEndFull}`);

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

    console.log(`Report ${report.id} created, fetching conversations...`);

    // Fetch conversations with messages in the period
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        contact:contacts!inner(name, phone),
        last_message_at
      `)
      .eq('user_id', user.id)
      .gte('last_message_at', periodStart)
      .lte('last_message_at', periodEndFull);

    if (convError) {
      console.error('Error fetching conversations:', convError);
      throw new Error('Failed to fetch conversations');
    }

    console.log(`Found ${conversations?.length || 0} conversations`);

    if (!conversations || conversations.length === 0) {
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

    // Fetch all messages for these conversations
    const conversationIds = conversations.map(c => c.id);
    const { data: allMessages, error: msgError } = await supabase
      .from('inbox_messages')
      .select('id, conversation_id, direction, content, message_type, transcription, created_at, media_url')
      .in('conversation_id', conversationIds)
      .gte('created_at', periodStart)
      .lte('created_at', periodEndFull)
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
    const conversationsWithMessages: Conversation[] = conversations.map(conv => {
      const contactData = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact;
      return {
        id: conv.id,
        contact: contactData as { name: string | null; phone: string },
        messages: (allMessages || []).filter(m => m.conversation_id === conv.id)
      };
    });

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

    console.log('Calling Lovable AI for analysis...');

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
            content: `Você é um especialista em análise de qualidade de atendimento ao cliente. Sua tarefa é analisar conversas de WhatsApp entre atendentes e clientes, avaliando a qualidade do atendimento.

Analise as conversas fornecidas e retorne um JSON com a seguinte estrutura EXATA (sem markdown, apenas JSON puro):
{
  "overall_score": <número de 0 a 100>,
  "textual_quality_score": <número de 0 a 100>,
  "communication_score": <número de 0 a 100>,
  "sales_score": <número de 0 a 100>,
  "efficiency_score": <número de 0 a 100>,
  "audio_analysis_score": <número de 0 a 100>,
  "executive_summary": "<resumo executivo em 3-5 parágrafos detalhando o desempenho geral>",
  "strengths": [
    {"title": "<título da força>", "description": "<descrição>", "example": "<exemplo real das conversas>"}
  ],
  "improvements": [
    {"title": "<área de melhoria>", "description": "<descrição detalhada>", "suggestion": "<sugestão específica>", "example": "<exemplo real das conversas onde ocorreu>"}
  ],
  "recommendations": [
    "<recomendação 1>",
    "<recomendação 2>",
    "<recomendação 3>"
  ],
  "highlighted_examples": [
    {"type": "positive", "context": "<contexto>", "message": "<mensagem destacada>", "reason": "<por que é bom>"},
    {"type": "negative", "context": "<contexto>", "message": "<mensagem destacada>", "reason": "<por que precisa melhorar>"}
  ],
  "conversation_details": [
    {"contact": "<nome ou telefone>", "score": <0-100>, "summary": "<resumo da conversa>", "feedback": "<feedback específico>"}
  ]
}

Critérios de avaliação:
1. QUALIDADE TEXTUAL (textual_quality_score): Gramática, ortografia, clareza, pontuação, uso de emojis apropriado
2. TÉCNICAS DE COMUNICAÇÃO (communication_score): Rapport, personalização, empatia, escuta ativa, cordialidade
3. VENDAS E PERSUASÃO (sales_score): Identificação de necessidades, apresentação de soluções, contorno de objeções, fechamento
4. EFICIÊNCIA (efficiency_score): Tempo de resposta, resolução no primeiro contato, objetividade
5. ANÁLISE DE ÁUDIO (audio_analysis_score): Qualidade das transcrições, completude das mensagens de voz, profissionalismo

Seja detalhado e específico. Use exemplos reais das conversas. O feedback deve ser construtivo e acionável.`
          },
          {
            role: 'user',
            content: `Analise as seguintes conversas do período de ${periodStart} a ${periodEnd}:\n\n${conversationTexts}\n\nTotal de mensagens: ${totalMessages}\nMensagens enviadas pelo atendente: ${sentMessages}\nMensagens recebidas de clientes: ${receivedMessages}\nÁudios analisados: ${audioMessages}`
          }
        ],
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Lovable AI error:', analysisResponse.status, errorText);
      
      // Check for rate limit or credit issues
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
            error_message: 'Erro ao processar análise com IA.'
          })
          .eq('id', report.id);
      }

      return new Response(
        JSON.stringify({ success: false, reportId: report.id, error: 'AI analysis failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await analysisResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    console.log('AI response received, parsing...');

    // Parse AI response
    let analysisResult;
    try {
      // Remove markdown code blocks if present
      let jsonContent = aiContent;
      if (jsonContent.includes('```json')) {
        jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonContent.includes('```')) {
        jsonContent = jsonContent.replace(/```\n?/g, '');
      }
      analysisResult = JSON.parse(jsonContent.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.log('Raw AI content:', aiContent);
      
      // Create a basic response if parsing fails
      analysisResult = {
        overall_score: 70,
        textual_quality_score: 70,
        communication_score: 70,
        sales_score: 70,
        efficiency_score: 70,
        audio_analysis_score: 70,
        executive_summary: 'Análise parcialmente processada. ' + (aiContent || 'Não foi possível gerar análise detalhada.'),
        strengths: [],
        improvements: [],
        recommendations: ['Tente gerar um novo relatório para análise mais detalhada.'],
        highlighted_examples: [],
        conversation_details: []
      };
    }

    // Update the report with analysis results
    const { error: updateError } = await supabase
      .from('conversation_analysis_reports')
      .update({
        overall_score: analysisResult.overall_score || 0,
        textual_quality_score: analysisResult.textual_quality_score || 0,
        communication_score: analysisResult.communication_score || 0,
        sales_score: analysisResult.sales_score || 0,
        efficiency_score: analysisResult.efficiency_score || 0,
        audio_analysis_score: analysisResult.audio_analysis_score || 0,
        executive_summary: analysisResult.executive_summary || 'Análise concluída.',
        strengths: analysisResult.strengths || [],
        improvements: analysisResult.improvements || [],
        recommendations: analysisResult.recommendations || [],
        highlighted_examples: analysisResult.highlighted_examples || [],
        conversation_details: analysisResult.conversation_details || [],
        total_conversations: conversations.length,
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
