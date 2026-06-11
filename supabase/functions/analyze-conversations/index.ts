import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// ---------- Schemas ----------

const reportSchema = {
  type: "object",
  properties: {
    overall_score: { type: "number" },
    textual_quality_score: { type: "number" },
    communication_score: { type: "number" },
    sales_score: { type: "number" },
    efficiency_score: { type: "number" },
    audio_analysis_score: { type: "number" },
    executive_summary: { type: "string", description: "Resumo executivo em 3-5 parágrafos. Mencione o desempenho geral, principais oportunidades e prioridades." },
    strengths: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, example: { type: "string" } }, required: ["title", "description"] }
    },
    improvements: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, suggestion: { type: "string" }, example: { type: "string" } }, required: ["title", "description"] }
    },
    recommendations: { type: "array", items: { type: "string" } },
    highlighted_examples: {
      type: "array",
      items: { type: "object", properties: { type: { type: "string", enum: ["positive", "negative"] }, context: { type: "string" }, message: { type: "string" }, reason: { type: "string" } }, required: ["type", "context", "message", "reason"] }
    },
    conversation_details: {
      type: "array",
      items: { type: "object", properties: { contact: { type: "string" }, score: { type: "number" }, summary: { type: "string" }, feedback: { type: "string" } }, required: ["contact", "score", "summary", "feedback"] }
    }
  },
  required: ["overall_score", "textual_quality_score", "communication_score", "sales_score", "efficiency_score", "audio_analysis_score", "executive_summary", "strengths", "improvements", "recommendations", "highlighted_examples", "conversation_details"]
};

const userPerformanceSchema = {
  type: "object",
  properties: {
    users: {
      type: "array",
      items: {
        type: "object",
        properties: {
          user_id: { type: "string" },
          name: { type: "string" },
          overall_score: { type: "number", description: "0-100" },
          textual_quality_score: { type: "number" },
          communication_score: { type: "number" },
          sales_score: { type: "number" },
          efficiency_score: { type: "number" },
          audio_analysis_score: { type: "number" },
          strengths: { type: "array", items: { type: "string" }, description: "Até 3 pontos fortes" },
          improvements: { type: "array", items: { type: "string" }, description: "Até 3 áreas a melhorar" },
          coaching_tips: { type: "array", items: { type: "string" }, description: "Até 3 dicas acionáveis de coaching individual" },
          highlighted_message: { type: "string", description: "Trecho real de mensagem (positivo ou negativo) que ilustre o desempenho" }
        },
        required: ["user_id", "name", "overall_score", "strengths", "improvements", "coaching_tips"]
      }
    }
  },
  required: ["users"]
};

const funnelInsightsSchema = {
  type: "object",
  properties: {
    funnels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          funnel_id: { type: "string" },
          name: { type: "string" },
          bottleneck_stages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                stage_id: { type: "string" },
                name: { type: "string" },
                note: { type: "string", description: "Por que é um gargalo" }
              },
              required: ["stage_id", "name", "note"]
            }
          },
          suggestions: { type: "array", items: { type: "string" }, description: "3-5 sugestões acionáveis para melhorar o funil" }
        },
        required: ["funnel_id", "name", "bottleneck_stages", "suggestions"]
      }
    }
  },
  required: ["funnels"]
};

const campaignInsightsSchema = {
  type: "object",
  properties: {
    campaigns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          name: { type: "string" },
          template_performance: {
            type: "array",
            items: {
              type: "object",
              properties: {
                template_id: { type: "string" },
                name: { type: "string" },
                suggestion: { type: "string" }
              },
              required: ["name", "suggestion"]
            }
          },
          suggestions: { type: "array", items: { type: "string" }, description: "3-5 sugestões acionáveis para melhorar essa campanha (horário, copy, segmentação)" }
        },
        required: ["campaign_id", "name", "suggestions"]
      }
    }
  },
  required: ["campaigns"]
};

// ---------- Helpers ----------

function clampScore(score: any): number {
  const n = Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeAnalysisResult(raw: any) {
  return {
    overall_score: clampScore(raw.overall_score),
    textual_quality_score: clampScore(raw.textual_quality_score),
    communication_score: clampScore(raw.communication_score),
    sales_score: clampScore(raw.sales_score),
    efficiency_score: clampScore(raw.efficiency_score),
    audio_analysis_score: clampScore(raw.audio_analysis_score),
    executive_summary: typeof raw.executive_summary === 'string' ? raw.executive_summary : 'Análise concluída.',
    strengths: Array.isArray(raw.strengths) ? raw.strengths.slice(0, 5).map((s: any) => ({ title: s.title || '', description: s.description || '', example: s.example || '' })) : [],
    improvements: Array.isArray(raw.improvements) ? raw.improvements.slice(0, 5).map((i: any) => ({ title: i.title || '', description: i.description || '', suggestion: i.suggestion || '', example: i.example || '' })) : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations.slice(0, 5).filter((r: any) => typeof r === 'string') : [],
    highlighted_examples: Array.isArray(raw.highlighted_examples) ? raw.highlighted_examples.slice(0, 6).map((e: any) => ({ type: e.type === 'negative' ? 'negative' : 'positive', context: e.context || '', message: e.message || '', reason: e.reason || '' })) : [],
    conversation_details: Array.isArray(raw.conversation_details) ? raw.conversation_details.slice(0, 10).map((c: any) => ({ contact: c.contact || 'Contato', score: clampScore(c.score), summary: c.summary || '', feedback: c.feedback || '' })) : []
  };
}

async function callLovableAI(payload: any, lovableApiKey: string) {
  const res = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error('Lovable AI error', res.status, t);
    const err: any = new Error('AI gateway error');
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

function extractToolArgs(aiData: any): any | null {
  const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    try { return JSON.parse(toolCall.function.arguments); } catch (e) { console.error('parse tool args', e); }
  }
  const content = aiData?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) { try { return JSON.parse(match[0]); } catch (e) { console.error('parse content', e); } }
  }
  return null;
}

// ---------- Main ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');

    const body = await req.json();
    const {
      periodStart, periodEnd,
      transcribeAudios = true,
      tzOffsetMinutes = 180,
      userIds = [],
      funnelIds = [],
      includeCampaigns = true,
      includeSla = true,
      _creatorUserId,
    } = body;

    // Allow internal service-role callers (e.g. scheduled-analysis) to act as a given user.
    let user: { id: string };
    if (token === supabaseServiceKey && _creatorUserId) {
      user = { id: _creatorUserId };
    } else {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !authUser) throw new Error('Invalid token');
      user = authUser;
    }

    if (!periodStart || !periodEnd) throw new Error('periodStart and periodEnd are required');

    const [sy, sm, sd] = periodStart.split('-').map(Number);
    const [ey, em, ed] = periodEnd.split('-').map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999));
    startDate.setUTCMinutes(startDate.getUTCMinutes() + tzOffsetMinutes);
    endDate.setUTCMinutes(endDate.getUTCMinutes() + tzOffsetMinutes);
    const periodStartISO = startDate.toISOString();
    const periodEndISO = endDate.toISOString();

    console.log(`[analyze] user=${user.id} period=${periodStart}..${periodEnd}`);

    // Create the report record
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
        status: 'processing',
        analysis_scope: { user_ids: userIds, funnel_ids: funnelIds, include_campaigns: includeCampaigns, include_sla: includeSla },
      })
      .select()
      .single();
    if (reportError || !report) throw new Error('Failed to create report');

    // Resolve org members visible to this user
    const { data: orgMembers } = await supabase.rpc('get_organization_member_ids', { _user_id: user.id });
    const memberIds: string[] = Array.isArray(orgMembers) ? orgMembers.map((x: any) => x.uid ?? x).filter(Boolean) : [user.id];

    const scopedUserIds = (userIds && userIds.length > 0) ? userIds.filter((id: string) => memberIds.includes(id)) : memberIds;

    console.log(`[analyze] scopedUsers=${scopedUserIds.length}`);

    // Run heavy processing in background so we don't block the request
    const runAnalysis = async () => {
      try {
        // 1. Fetch messages in period for scoped users
        const { data: messagesInPeriod } = await supabase
          .from('inbox_messages')
          .select('conversation_id')
          .in('user_id', scopedUserIds)
          .gte('created_at', periodStartISO)
          .lte('created_at', periodEndISO);

        const uniqueConvIds = [...new Set((messagesInPeriod || []).map((m: any) => m.conversation_id))];
        console.log(`[analyze] conversations=${uniqueConvIds.length}`);

        if (uniqueConvIds.length === 0) {
          await supabase.from('conversation_analysis_reports').update({
            status: 'completed',
            executive_summary: 'Nenhuma conversa encontrada no período selecionado.',
            overall_score: 0,
          }).eq('id', report.id);
          return;
        }

        // 2. Fetch contacts for conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, user_id, assigned_to, contact:contacts!inner(name, phone)')
          .in('id', uniqueConvIds);

        // 3. Fetch ALL messages
        const { data: allMessages } = await supabase
          .from('inbox_messages')
          .select('id, conversation_id, direction, content, message_type, transcription, created_at, media_url, sent_by_user_id, sent_at')
          .in('conversation_id', uniqueConvIds)
          .gte('created_at', periodStartISO)
          .lte('created_at', periodEndISO)
          .order('created_at', { ascending: true });

        const messages = allMessages || [];

        // 4. Transcribe audios if requested
        let transcribedCount = 0;
        if (transcribeAudios) {
          for (const msg of messages) {
            if ((msg.message_type === 'audio' || msg.message_type === 'ptt') && !msg.transcription && msg.media_url) {
              try {
                const res = await fetch(`${supabaseUrl}/functions/v1/transcribe-audio`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ messageId: msg.id, audioUrl: msg.media_url }),
                });
                if (res.ok) {
                  const r = await res.json();
                  msg.transcription = r.transcription;
                  transcribedCount++;
                }
              } catch (e) { console.error('transcribe fail', e); }
            }
          }
        }

        // 5. Build conversation texts
        const convsWithMsgs = (conversations || []).map((c: any) => {
          const contactData = Array.isArray(c.contact) ? c.contact[0] : c.contact;
          return {
            id: c.id,
            user_id: c.assigned_to || c.user_id,
            contact: contactData,
            messages: messages.filter(m => m.conversation_id === c.id),
          };
        }).filter(c => c.messages.length > 0);

        const totalMessages = messages.length;
        const sentMessages = messages.filter(m => m.direction === 'outbound').length;
        const receivedMessages = messages.filter(m => m.direction === 'inbound').length;
        const audioMessages = messages.filter(m => m.message_type === 'audio' || m.message_type === 'ptt').length;

        // 6. Profiles for user names
        const userIdsInUse = [...new Set(convsWithMsgs.map(c => c.user_id).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIdsInUse.length > 0 ? userIdsInUse : ['00000000-0000-0000-0000-000000000000']);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || 'Usuário']));

        // 7. Per-user aggregation
        const userAgg: Record<string, any> = {};
        for (const uid of userIdsInUse) {
          userAgg[uid] = {
            user_id: uid,
            name: profileMap.get(uid) || 'Usuário',
            messages_sent: 0,
            messages_received: 0,
            conversations_handled: 0,
            characters_typed: 0,
            audios_sent: 0,
            response_times: [] as number[],
            sample_messages: [] as string[],
          };
        }

        for (const conv of convsWithMsgs) {
          const uid = conv.user_id;
          if (!uid || !userAgg[uid]) continue;
          userAgg[uid].conversations_handled++;
          // First response time
          const firstInbound = conv.messages.find(m => m.direction === 'inbound');
          if (firstInbound) {
            const firstOutboundAfter = conv.messages.find(m => m.direction === 'outbound' && new Date(m.created_at) > new Date(firstInbound.created_at));
            if (firstOutboundAfter) {
              const diff = (new Date(firstOutboundAfter.created_at).getTime() - new Date(firstInbound.created_at).getTime()) / 1000;
              if (diff >= 0 && diff < 86400) userAgg[uid].response_times.push(diff);
            }
          }
          for (const m of conv.messages) {
            if (m.direction === 'outbound' && m.sent_by_user_id && userAgg[m.sent_by_user_id]) {
              userAgg[m.sent_by_user_id].messages_sent++;
              userAgg[m.sent_by_user_id].characters_typed += (m.content || '').length;
              if (m.message_type === 'audio' || m.message_type === 'ptt') userAgg[m.sent_by_user_id].audios_sent++;
              if ((m.content || '').length > 30 && userAgg[m.sent_by_user_id].sample_messages.length < 5) {
                userAgg[m.sent_by_user_id].sample_messages.push((m.content || '').slice(0, 200));
              }
            } else if (m.direction === 'inbound') {
              userAgg[uid].messages_received++;
            }
          }
        }

        for (const uid of Object.keys(userAgg)) {
          const rt = userAgg[uid].response_times;
          userAgg[uid].avg_first_response_seconds = rt.length ? Math.round(rt.reduce((a: number, b: number) => a + b, 0) / rt.length) : 0;
          delete userAgg[uid].response_times;
        }

        // 8. Funnel data
        let funnelData: any[] = [];
        if (funnelIds.length === 0) {
          const { data: allFunnels } = await supabase.from('funnels').select('id').in('user_id', scopedUserIds);
          funnelIds.push(...(allFunnels || []).map((f: any) => f.id));
        }
        if (funnelIds.length > 0) {
          const { data: funnels } = await supabase.from('funnels').select('id, name').in('id', funnelIds);
          for (const f of funnels || []) {
            const { data: stages } = await supabase.from('funnel_stages').select('id, name, display_order, final_type').eq('funnel_id', f.id).order('display_order');
            const { data: deals } = await supabase
              .from('funnel_deals')
              .select('id, stage_id, value, closed_at, created_at, entered_stage_at')
              .eq('funnel_id', f.id)
              .gte('created_at', periodStartISO)
              .lte('created_at', periodEndISO);

            const stageMap = new Map((stages || []).map((s: any) => [s.id, s]));
            const dealsByStage: Record<string, any[]> = {};
            for (const d of deals || []) {
              if (!dealsByStage[d.stage_id]) dealsByStage[d.stage_id] = [];
              dealsByStage[d.stage_id].push(d);
            }

            const wonStages = (stages || []).filter((s: any) => s.final_type === 'won').map((s: any) => s.id);
            const lostStages = (stages || []).filter((s: any) => s.final_type === 'lost').map((s: any) => s.id);

            const wonCount = (deals || []).filter((d: any) => wonStages.includes(d.stage_id)).length;
            const lostCount = (deals || []).filter((d: any) => lostStages.includes(d.stage_id)).length;
            const totalClosed = wonCount + lostCount;
            const wonRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

            const closedDeals = (deals || []).filter((d: any) => d.closed_at);
            const avgDaysToClose = closedDeals.length
              ? Math.round(closedDeals.reduce((acc: number, d: any) => acc + ((new Date(d.closed_at).getTime() - new Date(d.created_at).getTime()) / 86400000), 0) / closedDeals.length)
              : 0;

            const stageStats = (stages || []).map((s: any) => {
              const stageDeals = dealsByStage[s.id] || [];
              const avgHours = stageDeals.length
                ? Math.round(stageDeals.reduce((acc: number, d: any) => {
                    const start = d.entered_stage_at ? new Date(d.entered_stage_at) : new Date(d.created_at);
                    return acc + ((Date.now() - start.getTime()) / 3600000);
                  }, 0) / stageDeals.length)
                : 0;
              return { stage_id: s.id, name: s.name, deal_count: stageDeals.length, avg_hours: avgHours, final_type: s.final_type };
            });

            funnelData.push({
              funnel_id: f.id, name: f.name,
              total_deals: (deals || []).length,
              won_count: wonCount, lost_count: lostCount, won_rate: wonRate,
              avg_days_to_close: avgDaysToClose,
              stages: stageStats,
            });
          }
        }

        // 9. Campaigns
        let campaignData: any[] = [];
        if (includeCampaigns) {
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('id, name, total_contacts, sent, delivered, failed, allowed_start_hour, allowed_end_hour, template_id, created_at')
            .in('user_id', scopedUserIds)
            .gte('created_at', periodStartISO)
            .lte('created_at', periodEndISO)
            .order('created_at', { ascending: false })
            .limit(10);

          for (const c of campaigns || []) {
            let templateName = '';
            if (c.template_id) {
              const { data: tpl } = await supabase.from('message_templates').select('name').eq('id', c.template_id).maybeSingle();
              templateName = tpl?.name || '';
            }
            const sent = c.sent || 0;
            const delivered = c.delivered || 0;
            const failed = c.failed || 0;
            campaignData.push({
              campaign_id: c.id,
              name: c.name,
              sent, delivered, failed,
              delivery_rate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
              fail_rate: sent > 0 ? Math.round((failed / sent) * 100) : 0,
              allowed_hours: `${c.allowed_start_hour ?? 0}h - ${c.allowed_end_hour ?? 23}h`,
              template_id: c.template_id,
              template_name: templateName,
            });
          }
        }

        // 10. SLA aggregate
        let slaSummary: any = {};
        if (includeSla) {
          const overdueByUser: Record<string, number> = {};
          const { data: overdueTasks } = await supabase
            .from('tasks')
            .select('id, user_id, due_date, completed_at')
            .in('user_id', scopedUserIds)
            .lt('due_date', new Date().toISOString())
            .is('completed_at', null);
          for (const t of overdueTasks || []) {
            overdueByUser[t.user_id] = (overdueByUser[t.user_id] || 0) + 1;
          }

          const allResponseTimes: number[] = [];
          let unansweredCount = 0;
          for (const conv of convsWithMsgs) {
            const lastMsg = conv.messages[conv.messages.length - 1];
            if (lastMsg && lastMsg.direction === 'inbound') unansweredCount++;
            const firstInbound = conv.messages.find(m => m.direction === 'inbound');
            if (firstInbound) {
              const firstOut = conv.messages.find(m => m.direction === 'outbound' && new Date(m.created_at) > new Date(firstInbound.created_at));
              if (firstOut) {
                const diff = (new Date(firstOut.created_at).getTime() - new Date(firstInbound.created_at).getTime()) / 1000;
                if (diff >= 0 && diff < 86400) allResponseTimes.push(diff);
              }
            }
          }
          const avgFirst = allResponseTimes.length ? Math.round(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length) : 0;
          slaSummary = {
            avg_first_response_seconds: avgFirst,
            unanswered_count: unansweredCount,
            overdue_tasks_count: (overdueTasks || []).length,
            by_user: Object.keys(userAgg).map(uid => ({
              user_id: uid,
              name: userAgg[uid].name,
              avg_first_response_seconds: userAgg[uid].avg_first_response_seconds || 0,
              unanswered_count: 0,
              overdue_tasks_count: overdueByUser[uid] || 0,
            })),
          };
        }

        // 11. Build the main conversation text (for general analysis)
        const conversationTexts = convsWithMsgs.slice(0, 25).map((conv: any) => {
          const txt = conv.messages.slice(0, 30).map((m: any) => {
            const sender = m.direction === 'outbound' ? 'ATENDENTE' : 'CLIENTE';
            let content = m.content || '';
            if ((m.message_type === 'audio' || m.message_type === 'ptt') && m.transcription) content = `[ÁUDIO]: ${m.transcription}`;
            else if (m.message_type === 'audio' || m.message_type === 'ptt') content = '[ÁUDIO]';
            else if (m.message_type === 'image') content = '[IMAGEM]';
            else if (m.message_type === 'document') content = '[DOC]';
            return `${sender}: ${content.slice(0, 300)}`;
          }).join('\n');
          return `--- ${conv.contact?.name || conv.contact?.phone || 'Contato'} ---\n${txt}`;
        }).join('\n\n');

        // 12. Build per-user summary text
        const userSummaryText = Object.values(userAgg).map((u: any) => {
          const samples = (u.sample_messages || []).slice(0, 3).map((s: string) => `  • "${s}"`).join('\n');
          return `Usuário ${u.user_id} (${u.name}):
  - Conversas atendidas: ${u.conversations_handled}
  - Mensagens enviadas: ${u.messages_sent} (${u.audios_sent} áudios)
  - Caracteres digitados: ${u.characters_typed}
  - Tempo médio de 1ª resposta: ${u.avg_first_response_seconds}s
  - Amostras de mensagens enviadas:
${samples}`;
        }).join('\n\n');

        // 13. Build funnel summary text
        const funnelSummaryText = funnelData.map((f: any) => {
          const stagesText = f.stages.map((s: any) => `  - Etapa "${s.name}" (id=${s.stage_id}): ${s.deal_count} deals abertos, tempo médio ${s.avg_hours}h${s.final_type ? ` [final=${s.final_type}]` : ''}`).join('\n');
          return `Funil "${f.name}" (id=${f.funnel_id}):
  - Total deals no período: ${f.total_deals}
  - Ganhos: ${f.won_count} | Perdidos: ${f.lost_count} | Taxa de ganho: ${f.won_rate}%
  - Tempo médio até fechar: ${f.avg_days_to_close} dias
  - Etapas:
${stagesText}`;
        }).join('\n\n');

        const campaignSummaryText = campaignData.map((c: any) => `Campanha "${c.name}" (id=${c.campaign_id}, template="${c.template_name}", template_id=${c.template_id}): ${c.sent} enviadas, ${c.delivered} entregues (${c.delivery_rate}%), ${c.failed} falharam (${c.fail_rate}%), janela ${c.allowed_hours}`).join('\n');

        // 14. Run AI calls in parallel
        console.log('[analyze] calling AI in parallel...');

        const generalPromise = callLovableAI({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um especialista sênior em qualidade de atendimento e vendas via WhatsApp. OBRIGATÓRIO: chame a função analyze_conversations com dados estruturados. Seja específico, use exemplos reais. Critérios 0-100: qualidade textual, comunicação, vendas, eficiência, áudios.' },
            { role: 'user', content: `Período ${periodStart} a ${periodEnd}\n\n${conversationTexts}\n\nEstatísticas: ${totalMessages} msgs, ${sentMessages} enviadas, ${receivedMessages} recebidas, ${audioMessages} áudios.` },
          ],
          tools: [{ type: 'function', function: { name: 'analyze_conversations', description: 'Análise geral estruturada', parameters: reportSchema } }],
          tool_choice: { type: 'function', function: { name: 'analyze_conversations' } },
        }, lovableApiKey).catch(e => { console.error('general AI fail', e); return null; });

        const userPromise = Object.keys(userAgg).length > 0 ? callLovableAI({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um coach sênior de vendas. Avalie cada usuário individualmente com base nos dados e amostras de mensagens fornecidos. OBRIGATÓRIO chamar a função analyze_users. Dê notas 0-100 realistas (não infle), pontos fortes específicos, áreas de melhoria concretas e dicas de coaching acionáveis e personalizadas.' },
            { role: 'user', content: `Avalie a performance individual destes ${Object.keys(userAgg).length} usuários no período ${periodStart} a ${periodEnd}:\n\n${userSummaryText}\n\nContexto adicional de conversas amostradas:\n${conversationTexts.slice(0, 8000)}` },
          ],
          tools: [{ type: 'function', function: { name: 'analyze_users', description: 'Performance individual', parameters: userPerformanceSchema } }],
          tool_choice: { type: 'function', function: { name: 'analyze_users' } },
        }, lovableApiKey).catch(e => { console.error('user AI fail', e); return null; }) : Promise.resolve(null);

        const funnelPromise = funnelData.length > 0 ? callLovableAI({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um consultor de processos comerciais. Analise os funis e identifique gargalos reais com sugestões acionáveis. OBRIGATÓRIO chamar analyze_funnel. Use os IDs reais fornecidos.' },
            { role: 'user', content: `Analise estes funis:\n\n${funnelSummaryText}` },
          ],
          tools: [{ type: 'function', function: { name: 'analyze_funnel', description: 'Insights de funil', parameters: funnelInsightsSchema } }],
          tool_choice: { type: 'function', function: { name: 'analyze_funnel' } },
        }, lovableApiKey).catch(e => { console.error('funnel AI fail', e); return null; }) : Promise.resolve(null);

        const campaignPromise = (includeCampaigns && campaignData.length > 0) ? callLovableAI({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'Você é um especialista em campanhas de WhatsApp em massa. Analise cada campanha e sugira melhorias (copy do template, horário, segmentação). OBRIGATÓRIO chamar analyze_campaigns com os IDs reais.' },
            { role: 'user', content: `Campanhas do período:\n\n${campaignSummaryText}` },
          ],
          tools: [{ type: 'function', function: { name: 'analyze_campaigns', description: 'Insights de campanhas', parameters: campaignInsightsSchema } }],
          tool_choice: { type: 'function', function: { name: 'analyze_campaigns' } },
        }, lovableApiKey).catch(e => { console.error('campaign AI fail', e); return null; }) : Promise.resolve(null);

        const [generalAI, userAI, funnelAI, campaignAI] = await Promise.all([generalPromise, userPromise, funnelPromise, campaignPromise]);

        // Parse results
        let analysisResult = generalAI ? normalizeAnalysisResult(extractToolArgs(generalAI) || {}) : null;
        if (!analysisResult) {
          analysisResult = normalizeAnalysisResult({
            overall_score: 0, executive_summary: 'Não foi possível gerar análise geral. Tente novamente.',
          });
        }

        // Per-user merge
        const userInsights = extractToolArgs(userAI) || { users: [] };
        const aiUserMap = new Map((userInsights.users || []).map((u: any) => [u.user_id, u]));
        const userPerformance = Object.values(userAgg).map((u: any) => {
          const ai = aiUserMap.get(u.user_id) || {} as any;
          return {
            user_id: u.user_id,
            name: u.name,
            ranking: 0,
            overall_score: clampScore(ai.overall_score),
            textual_quality_score: clampScore(ai.textual_quality_score ?? ai.overall_score),
            communication_score: clampScore(ai.communication_score ?? ai.overall_score),
            sales_score: clampScore(ai.sales_score ?? ai.overall_score),
            efficiency_score: clampScore(ai.efficiency_score ?? ai.overall_score),
            audio_analysis_score: clampScore(ai.audio_analysis_score ?? ai.overall_score),
            messages_sent: u.messages_sent,
            messages_received: u.messages_received,
            conversations_handled: u.conversations_handled,
            avg_first_response_seconds: u.avg_first_response_seconds || 0,
            strengths: Array.isArray(ai.strengths) ? ai.strengths.slice(0, 3) : [],
            improvements: Array.isArray(ai.improvements) ? ai.improvements.slice(0, 3) : [],
            coaching_tips: Array.isArray(ai.coaching_tips) ? ai.coaching_tips.slice(0, 3) : [],
            highlighted_message: ai.highlighted_message || '',
          };
        }).sort((a, b) => b.overall_score - a.overall_score)
          .map((u, idx) => ({ ...u, ranking: idx + 1 }));

        // Funnel merge
        const funnelInsightsArr = extractToolArgs(funnelAI)?.funnels || [];
        const funnelInsightsMap = new Map(funnelInsightsArr.map((f: any) => [f.funnel_id, f]));
        const funnelPerformance = {
          funnels: funnelData.map((f: any) => {
            const ai = funnelInsightsMap.get(f.funnel_id) as any || {};
            return {
              funnel_id: f.funnel_id,
              name: f.name,
              total_deals: f.total_deals,
              won_count: f.won_count,
              lost_count: f.lost_count,
              won_rate: f.won_rate,
              avg_days_to_close: f.avg_days_to_close,
              bottleneck_stages: f.stages
                .filter((s: any) => !s.final_type)
                .sort((a: any, b: any) => b.avg_hours - a.avg_hours)
                .slice(0, 3)
                .map((s: any) => {
                  const aiStage = (ai.bottleneck_stages || []).find((x: any) => x.stage_id === s.stage_id);
                  return { stage_id: s.stage_id, name: s.name, conversion_rate: 0, avg_hours: s.avg_hours, lost_count: 0, note: aiStage?.note || '' };
                }),
              suggestions: Array.isArray(ai.suggestions) ? ai.suggestions.slice(0, 5) : [],
            };
          }),
        };

        // Campaigns merge
        const campaignInsightsArr = extractToolArgs(campaignAI)?.campaigns || [];
        const campaignInsightsMap = new Map(campaignInsightsArr.map((c: any) => [c.campaign_id, c]));
        const campaignPerformance = {
          campaigns: campaignData.map((c: any) => {
            const ai = campaignInsightsMap.get(c.campaign_id) as any || {};
            return {
              campaign_id: c.campaign_id,
              name: c.name,
              sent: c.sent,
              delivered: c.delivered,
              failed: c.failed,
              reply_rate: 0,
              best_hours: [],
              template_performance: (ai.template_performance || []).map((t: any) => ({
                template_id: t.template_id || c.template_id,
                name: t.name || c.template_name,
                reply_rate: 0,
                suggestion: t.suggestion || '',
              })),
              suggestions: Array.isArray(ai.suggestions) ? ai.suggestions.slice(0, 5) : [],
            };
          }),
        };

        // Save
        await supabase.from('conversation_analysis_reports').update({
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
          total_conversations: convsWithMsgs.length,
          total_messages_sent: sentMessages,
          total_messages_received: receivedMessages,
          total_audios_analyzed: audioMessages,
          user_performance: userPerformance,
          funnel_performance: funnelPerformance,
          campaign_performance: campaignPerformance,
          sla_performance: slaSummary,
          status: 'completed',
        }).eq('id', report.id);

        console.log(`[analyze] complete report=${report.id}`);
      } catch (e: any) {
        console.error('[analyze] background error', e);
        await supabase.from('conversation_analysis_reports').update({
          status: 'error',
          error_message: e?.status === 429 ? 'Limite de IA excedido. Tente novamente em alguns minutos.'
            : e?.status === 402 ? 'Créditos de IA insuficientes. Adicione créditos no workspace.'
            : (e?.message || 'Erro ao processar análise.'),
        }).eq('id', report.id);
      }
    };

    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    EdgeRuntime.waitUntil(runAnalysis());

    return new Response(
      JSON.stringify({ success: true, reportId: report.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    console.error('[analyze] error', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
