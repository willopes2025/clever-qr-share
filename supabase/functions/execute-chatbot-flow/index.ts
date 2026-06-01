import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveOrgFormatConfig, formatDateSmart, DEFAULT_FORMAT_CONFIG, type OrgFormatConfig } from "../_shared/timezone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve Meta WhatsApp access token: try integrations table (per user, then org members),
    // then fall back to system env var META_WHATSAPP_ACCESS_TOKEN.
    // Note: the previous code queried a non-existent `meta_whatsapp_config` table, which always
    // returned null and caused meta_template nodes to be silently skipped.
    const resolveMetaAccessToken = async (uid: string): Promise<string | null> => {
      const { data: own } = await supabase
        .from('integrations')
        .select('credentials')
        .eq('user_id', uid)
        .eq('provider', 'meta_whatsapp')
        .eq('is_active', true)
        .maybeSingle();
      const ownToken = (own?.credentials as any)?.access_token;
      if (ownToken) return ownToken;

      const { data: orgMemberIds } = await supabase.rpc('get_organization_member_ids', { _user_id: uid });
      if (orgMemberIds && Array.isArray(orgMemberIds)) {
        for (const memberId of orgMemberIds) {
          if (memberId === uid) continue;
          const { data: memberInt } = await supabase
            .from('integrations')
            .select('credentials')
            .eq('user_id', memberId)
            .eq('provider', 'meta_whatsapp')
            .eq('is_active', true)
            .maybeSingle();
          const t = (memberInt?.credentials as any)?.access_token;
          if (t) {
            console.log(`[FLOW] Using Meta access token from org member: ${memberId}`);
            return t;
          }
        }
      }
      return Deno.env.get('META_WHATSAPP_ACCESS_TOKEN') || null;
    };

    const { flowId, conversationId: inputConversationId, contactId, userId, executionId, currentNodeId, inputValue: rawInputValue, dealId, overrideInstanceId, overrideMetaPhoneNumberId } = await req.json();
    let inputValue = rawInputValue;

    if (!flowId || !contactId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no conversationId provided, find or create one for this contact
    let conversationId = inputConversationId;
    if (!conversationId) {
      // Try to find an existing conversation for this contact
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id, instance_id, meta_phone_number_id')
        .eq('contact_id', contactId)
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
        console.log(`[FLOW] Found existing conversation ${conversationId} for contact ${contactId}`);
      } else {
        // Create a new conversation
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            user_id: userId,
            status: 'open',
            provider: 'meta',
          })
          .select('id')
          .single();

        if (convErr || !newConv) {
          console.error('[FLOW] Error creating conversation:', convErr);
          return new Response(JSON.stringify({ error: 'Failed to create conversation' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        conversationId = newConv.id;
        console.log(`[FLOW] Created new conversation ${conversationId} for contact ${contactId}`);
      }

      // Update the execution record with the conversationId
      if (executionId) {
        await supabase.from('chatbot_executions').update({ conversation_id: conversationId }).eq('id', executionId);
      }
    }

    // Load conversation to get instance info + status for condition variables
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, instance_id, meta_phone_number_id, status, assigned_to, unread_count, provider')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get instance info for sending messages
    let instanceName = '';
    let resolvedInstanceId = conversation.instance_id;
    let metaPhoneNumberId = conversation.meta_phone_number_id || null;
    let metaAccessToken: string | null = null;
    const usingOverride = !!(overrideInstanceId || overrideMetaPhoneNumberId);

    // Precedence (most specific wins):
    // 1) Automation override (sender chosen on the funnel automation card)
    // 2) Chatbot flow default (chatbot_flows.instance_id)
    // 3) Conversation's instance_id / meta_phone_number_id
    // 4) Auto fallback (user's connected instance / Meta number)
    if (overrideInstanceId) {
      resolvedInstanceId = overrideInstanceId;
      metaPhoneNumberId = null;
      console.log(`[FLOW] Using override Evolution instance (automation): ${overrideInstanceId}`);
    } else if (overrideMetaPhoneNumberId) {
      metaPhoneNumberId = overrideMetaPhoneNumberId;
      resolvedInstanceId = null;
      console.log(`[FLOW] Using override Meta phone_number_id (automation): ${overrideMetaPhoneNumberId}`);
    } else {
      // No automation override: try the chatbot flow's own default instance_id
      const { data: flowDefaults } = await supabase
        .from('chatbot_flows')
        .select('instance_id')
        .eq('id', flowId)
        .maybeSingle();
      if (flowDefaults?.instance_id) {
        resolvedInstanceId = flowDefaults.instance_id;
        metaPhoneNumberId = null;
        console.log(`[FLOW] Using chatbot flow default Evolution instance: ${flowDefaults.instance_id}`);
      }
    }

    if (resolvedInstanceId) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, evolution_instance_name')
        .eq('id', resolvedInstanceId)
        .single();
      instanceName = instance?.evolution_instance_name || instance?.instance_name || '';
    }
    
    // Fallback: if conversation has no instance AND no override, find a connected instance for this user
    if (!instanceName && !usingOverride && !metaPhoneNumberId) {
      const { data: defaultInstance } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, evolution_instance_name')
        .eq('user_id', userId)
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();
      
      if (defaultInstance) {
        resolvedInstanceId = defaultInstance.id;
        instanceName = defaultInstance.evolution_instance_name || defaultInstance.instance_name || '';
        console.log(`[FLOW] Using fallback instance: ${instanceName} (${resolvedInstanceId})`);
        
        // Update conversation with the resolved instance
        await supabase.from('conversations').update({ instance_id: resolvedInstanceId }).eq('id', conversationId);
      } else {
        console.log('[FLOW] No connected WhatsApp instance found for user');
      }
    }

    // If no Evolution instance but we have a Meta phone number, prepare Meta sending
    if (!instanceName && metaPhoneNumberId) {
      console.log(`[FLOW] No Evolution instance, will use Meta phone_number_id: ${metaPhoneNumberId}`);
      metaAccessToken = await resolveMetaAccessToken(userId);
      if (metaAccessToken) {
        console.log('[FLOW] Meta access token found, ready to send via Meta Cloud API');
      } else {
        console.log('[FLOW] No Meta access token found');
      }
    }

    // If no Meta phone number from conversation, try to find one for this user
    if (!instanceName && !metaPhoneNumberId) {
      const { data: metaNumber } = await supabase
        .from('meta_whatsapp_numbers')
        .select('phone_number_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (metaNumber) {
        metaPhoneNumberId = metaNumber.phone_number_id;
        console.log(`[FLOW] Found Meta number for user: ${metaPhoneNumberId}`);
        metaAccessToken = await resolveMetaAccessToken(userId);
      }
    }

    // Load contact info for variable substitution (includes custom_fields)
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, email, custom_fields')
      .eq('id', contactId)
      .single();

    // Load most recent deal for this contact (for {{valor}}, {{etapa}}, {{funil}}, lead custom fields)
    let activeDeal: any = null;
    let activeStage: any = null;
    let activeFunnel: any = null;
    try {
      const { data: dealRow } = await supabase
        .from('funnel_deals')
        .select('id, title, value, stage_id, funnel_id, custom_fields')
        .eq('contact_id', contactId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      activeDeal = dealRow || null;
      if (activeDeal?.stage_id) {
        const { data: s } = await supabase.from('funnel_stages').select('name').eq('id', activeDeal.stage_id).maybeSingle();
        activeStage = s;
      }
      if (activeDeal?.funnel_id) {
        const { data: f } = await supabase.from('funnels').select('name').eq('id', activeDeal.funnel_id).maybeSingle();
        activeFunnel = f;
      }
    } catch (e) {
      console.log('[FLOW] Failed to load deal context:', e);
    }

    // Load flow nodes and edges
    const [{ data: nodes }, { data: edges }] = await Promise.all([
      supabase.from('chatbot_flow_nodes').select('*').eq('flow_id', flowId).order('created_at'),
      supabase.from('chatbot_flow_edges').select('*').eq('flow_id', flowId),
    ]);

    if (!nodes || nodes.length === 0) {
      return new Response(JSON.stringify({ error: 'Flow has no nodes' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create or update execution record
    let execution: any;
    let resumingFromSchedule = false;
    if (executionId) {
      // Resuming existing execution
      const { data } = await supabase
        .from('chatbot_executions')
        .select('*')
        .eq('id', executionId)
        .single();
      execution = data;

      if (execution?.status === 'scheduled') {
        // Resuming from a scheduled delay - mark to skip the delay node
        resumingFromSchedule = true;
        const variables = execution.variables || {};
        delete variables._delay_done;
        delete variables._msg_delay_done;
        await supabase
          .from('chatbot_executions')
          .update({ variables, status: 'running', scheduled_resume_at: null })
          .eq('id', executionId);
        execution.variables = variables;
        execution.status = 'running';
      } else if (execution && inputValue !== undefined) {
        // Save the input value in variables
        const variables = execution.variables || {};
        const currentNode = nodes.find((n: any) => n.id === execution.current_node_id);
        if (currentNode?.data?.variableName) {
          variables[currentNode.data.variableName] = inputValue;
        }
        variables['_last_input'] = inputValue;
        
        await supabase
          .from('chatbot_executions')
          .update({ variables, status: 'running' })
          .eq('id', executionId);
        
        // Mark the node as responded in analytics
        if (execution.current_node_id) {
          await supabase
            .from('chatbot_node_executions')
            .update({ status: 'responded', responded_at: new Date().toISOString() })
            .eq('execution_id', executionId)
            .eq('node_id', execution.current_node_id)
            .eq('status', 'waiting_input');
        }

        execution.variables = variables;
      }
    } else {
      // New execution
      const { data, error } = await supabase
        .from('chatbot_executions')
        .insert({
          flow_id: flowId,
          conversation_id: conversationId,
          contact_id: contactId,
          user_id: userId,
          status: 'running',
          started_at: new Date().toISOString(),
          trigger_source: 'inbox_manual',
          variables: {},
        })
        .select()
        .single();

      if (error) throw error;
      execution = data;
    }

    // Determine starting node
    let startNodeId = currentNodeId || execution?.current_node_id;
    if (!startNodeId) {
      // Find the start/trigger node
      const startNode = nodes.find((n: any) => n.type === 'start' || n.type === 'trigger');
      if (startNode) {
        // Get the first connected node from start
        const startEdge = edges?.find((e: any) => e.source_node_id === startNode.id);
        startNodeId = startEdge?.target_node_id || startNode.id;
      } else {
        startNodeId = nodes[0].id;
      }
    }

    // Resolve org format config (timezone + date/time format) — single source of truth.
    let orgFormatConfig: OrgFormatConfig = DEFAULT_FORMAT_CONFIG;
    try {
      orgFormatConfig = await resolveOrgFormatConfig(supabase, { userId });
    } catch (e) {
      console.warn('[FLOW] could not resolve org format config, using defaults', e);
    }

    // Helper: substitute variables in text — date-like values formatted via org config.
    const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
    const ISO_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
    const looksLikeDate = (s: string) => DATE_ONLY_RE.test(s) || ISO_DATETIME_RE.test(s);
    const formatVarValue = (v: any): string => {
      if (v === null || v === undefined) return '';
      if (v instanceof Date) return formatDateSmart(v, orgFormatConfig);
      if (Array.isArray(v)) return v.map((x) => formatVarValue(x)).join(', ');
      if (typeof v === 'object') { try { return JSON.stringify(v); } catch { return ''; } }
      const s = String(v);
      if (looksLikeDate(s.trim())) {
        const out = formatDateSmart(s.trim(), orgFormatConfig);
        if (out) return out;
      }
      return s;
    };
    const contactCustom = (contact?.custom_fields as Record<string, any>) || {};
    const dealCustom = (activeDeal?.custom_fields as Record<string, any>) || {};
    const substituteVars = (text: string): string => {
      if (!text) return '';
      const fullName = (contact?.name || '').trim();
      const firstName = fullName.split(/\s+/)[0] || '';
      return text
        .replace(/\{\{primeiro_nome\}\}/gi, firstName)
        .replace(/\{\{primeiroNome\}\}/gi, firstName)
        .replace(/\{\{first_name\}\}/gi, firstName)
        .replace(/\{\{firstName\}\}/gi, firstName)
        .replace(/\{\{nome\}\}/gi, fullName)
        .replace(/\{\{name\}\}/gi, fullName)
        .replace(/\{\{telefone\}\}/gi, contact?.phone || '')
        .replace(/\{\{phone\}\}/gi, contact?.phone || '')
        .replace(/\{\{email\}\}/gi, contact?.email || '')
        .replace(/\{\{valor\}\}/gi, activeDeal?.value != null ? String(activeDeal.value) : '')
        .replace(/\{\{titulo\}\}/gi, activeDeal?.title || '')
        .replace(/\{\{etapa\}\}/gi, activeStage?.name || '')
        .replace(/\{\{stage\}\}/gi, activeStage?.name || '')
        .replace(/\{\{funil\}\}/gi, activeFunnel?.name || '')
        .replace(/\{\{funnel\}\}/gi, activeFunnel?.name || '')
        .replace(/\{\{(\w+)\}\}/g, (_, key) => {
          if (execution?.variables?.[key] !== undefined) return formatVarValue(execution.variables[key]);
          if (dealCustom[key] !== undefined) return formatVarValue(dealCustom[key]);
          if (contactCustom[key] !== undefined) return formatVarValue(contactCustom[key]);
          return '';
        });
    };

    // Helper: compute live system variables for conditions (canal, instância, status etc.)
    const getSystemConditionVars = (): Record<string, any> => {
      const tz = orgFormatConfig?.timezone || 'America/Sao_Paulo';
      const now = new Date();
      const localeOpts: Intl.DateTimeFormatOptions = { timeZone: tz };
      let nowDate = '';
      let nowTime = '';
      let weekday = '';
      try {
        nowDate = new Intl.DateTimeFormat('en-CA', { ...localeOpts, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
        nowTime = new Intl.DateTimeFormat('en-GB', { ...localeOpts, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
        weekday = new Intl.DateTimeFormat('en-US', { ...localeOpts, weekday: 'long' }).format(now).toLowerCase();
      } catch { /* ignore */ }
      const provider = (conversation as any)?.provider || (metaPhoneNumberId ? 'meta' : 'evolution');
      const channel = provider === 'meta' ? 'whatsapp_meta' : 'whatsapp_evolution';
      return {
        _conversation_id: conversation?.id || '',
        _conversation_status: (conversation as any)?.status || '',
        _conversation_channel: channel,
        _conversation_instance_name: instanceName || metaPhoneNumberId || '',
        _conversation_phone_number: metaPhoneNumberId || instanceName || '',
        _conversation_assigned_to: (conversation as any)?.assigned_to || '',
        _conversation_unread_count: (conversation as any)?.unread_count ?? 0,
        _lead_source: activeFunnel?.name || '',
        _lead_source_phone: contact?.phone || '',
        _now_date: nowDate,
        _now_time: nowTime,
        _now_weekday: weekday,
      };
    };

    // Per-node send context (so helpers can tag inbox_messages with template / meta-template origin)
    let currentTemplateId: string | null = null;
    let currentMetaTemplateId: string | null = null;

    // Helper: get next node from edges
    const getNextNode = (nodeId: string, handle?: string): string | null => {
      const edge = edges?.find((e: any) => {
        if (e.source_node_id !== nodeId) return false;
        if (handle && e.source_handle) return e.source_handle === handle;
        return true;
      });
      return edge?.target_node_id || null;
    };

    // Helper: send WhatsApp message (supports both Evolution API and Meta Cloud API)
    const META_API_URL = 'https://graph.facebook.com/v21.0';
    const sendMessage = async (text: string) => {
      if (!contact?.phone) {
        console.log('[FLOW] Cannot send message - no phone');
        return;
      }

      // Prefer Evolution API if available, otherwise use Meta Cloud API
      if (instanceName) {
        try {
          const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: contact.phone,
              text: text,
            }),
          });

          const result = await response.json();
          const whatsappMessageId = result?.key?.id || null;

          await supabase.from('inbox_messages').insert({
            user_id: userId, conversation_id: conversationId,
            content: text, direction: 'outbound', status: 'sent',
            message_type: 'text', whatsapp_message_id: whatsappMessageId,
            sent_at: new Date().toISOString(),
            sent_via_instance_id: resolvedInstanceId,
            sent_via_chatbot_flow_id: flowId,
            sent_via_template_id: currentTemplateId,
            sent_via_meta_template_id: currentMetaTemplateId,
          });

          await supabase.from('conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text.substring(0, 100),
            last_message_direction: 'outbound',
          }).eq('id', conversationId);

          console.log('[FLOW] Message sent via Evolution:', text.substring(0, 50));
        } catch (err) {
          console.error('[FLOW] Error sending message via Evolution:', err);
        }
      } else if (metaPhoneNumberId && metaAccessToken) {
        try {
          const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
          const response = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: formattedPhone,
              type: 'text',
              text: { body: text },
            }),
          });

          const result = await response.json();
          const whatsappMessageId = result?.messages?.[0]?.id || null;
          console.log('[FLOW] Meta API response:', JSON.stringify(result));

          await supabase.from('inbox_messages').insert({
            user_id: userId, conversation_id: conversationId,
            content: text, direction: 'outbound', status: 'sent',
            message_type: 'text', whatsapp_message_id: whatsappMessageId,
            sent_at: new Date().toISOString(),
            sent_via_meta_number_id: metaPhoneNumberId,
            sent_via_chatbot_flow_id: flowId,
            sent_via_template_id: currentTemplateId,
            sent_via_meta_template_id: currentMetaTemplateId,
          });

          await supabase.from('conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text.substring(0, 100),
            last_message_direction: 'outbound',
            meta_phone_number_id: metaPhoneNumberId,
          }).eq('id', conversationId);

          console.log('[FLOW] Message sent via Meta Cloud API:', text.substring(0, 50));
        } catch (err) {
          console.error('[FLOW] Error sending message via Meta:', err);
        }
      } else {
        console.log('[FLOW] Cannot send message - no instance and no Meta phone configured');
      }
    };

    // Helper: send media (image/video/audio/document) via Evolution or Meta
    const sendMediaMessage = async (
      mediaType: 'image' | 'video' | 'audio' | 'document',
      mediaUrl: string,
      caption?: string,
      filename?: string,
    ) => {
      if (!contact?.phone || !mediaUrl) return;
      if (instanceName) {
        try {
          const isAudio = mediaType === 'audio';
          const endpoint = isAudio ? 'sendWhatsAppAudio' : 'sendMedia';
          const body: any = isAudio
            ? { number: contact.phone, audio: mediaUrl }
            : { number: contact.phone, mediatype: mediaType, media: mediaUrl };
          if (!isAudio && caption) body.caption = caption;
          if (!isAudio && filename && mediaType === 'document') body.fileName = filename;
          const resp = await fetch(`${evolutionApiUrl}/message/${endpoint}/${instanceName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            body: JSON.stringify(body),
          });
          const result = await resp.json();
          await supabase.from('inbox_messages').insert({
            user_id: userId, conversation_id: conversationId,
            content: caption || `[${mediaType}]`, direction: 'outbound', status: 'sent',
            message_type: mediaType, media_url: mediaUrl,
            whatsapp_message_id: result?.key?.id || null,
            sent_at: new Date().toISOString(),
            sent_via_instance_id: resolvedInstanceId,
            sent_via_chatbot_flow_id: flowId,
          });
          await supabase.from('conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: (caption || `[${mediaType}]`).substring(0, 100),
            last_message_direction: 'outbound',
          }).eq('id', conversationId);
        } catch (err) {
          console.error('[FLOW] Error sending media via Evolution:', err);
        }
      } else if (metaPhoneNumberId && metaAccessToken) {
        try {
          const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
          const payload: any = {
            messaging_product: 'whatsapp', recipient_type: 'individual',
            to: formattedPhone, type: mediaType,
          };
          if (mediaType === 'audio') payload.audio = { link: mediaUrl };
          else if (mediaType === 'image') payload.image = { link: mediaUrl, ...(caption ? { caption } : {}) };
          else if (mediaType === 'video') payload.video = { link: mediaUrl, ...(caption ? { caption } : {}) };
          else payload.document = { link: mediaUrl, ...(caption ? { caption } : {}), ...(filename ? { filename } : {}) };
          const resp = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${metaAccessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const result = await resp.json();
          await supabase.from('inbox_messages').insert({
            user_id: userId, conversation_id: conversationId,
            content: caption || `[${mediaType}]`, direction: 'outbound',
            status: resp.ok ? 'sent' : 'failed',
            message_type: mediaType, media_url: mediaUrl,
            whatsapp_message_id: result?.messages?.[0]?.id || null,
            sent_at: new Date().toISOString(),
            sent_via_meta_number_id: metaPhoneNumberId,
            error_message: result?.error ? (result.error?.message || JSON.stringify(result.error)) : null,
            sent_via_chatbot_flow_id: flowId,
          });
          await supabase.from('conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: (caption || `[${mediaType}]`).substring(0, 100),
            last_message_direction: 'outbound',
            meta_phone_number_id: metaPhoneNumberId,
          }).eq('id', conversationId);
        } catch (err) {
          console.error('[FLOW] Error sending media via Meta:', err);
        }
      }
    };

    // Helper: send Evolution interactive buttons (real WhatsApp buttons, no numbered text in body)
    const sendEvolutionButtons = async (text: string, btns: Array<{ label: string }>): Promise<boolean> => {
      if (!instanceName || !contact?.phone) return false;
      const buttonsPayload = btns.slice(0, 3).map((b, i) => ({
        buttonId: `btn_${i}`,
        buttonText: { displayText: (b.label || `Opção ${i + 1}`).slice(0, 20) },
        type: 1,
      }));
      try {
        const resp = await fetch(`${evolutionApiUrl}/message/sendButtons/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evolutionApiKey },
          body: JSON.stringify({
            number: contact.phone,
            title: '',
            description: text,
            footer: '',
            buttons: buttonsPayload,
          }),
        });
        const result = await resp.json().catch(() => ({}));
        if (!resp.ok || result?.error) {
          console.error('[FLOW] Evolution sendButtons failed:', resp.status, JSON.stringify(result));
          return false;
        }
        const wid = result?.key?.id || null;
        await supabase.from('inbox_messages').insert({
          user_id: userId, conversation_id: conversationId,
          content: text, direction: 'outbound', status: 'sent',
          message_type: 'interactive', whatsapp_message_id: wid,
          sent_at: new Date().toISOString(),
          sent_via_instance_id: resolvedInstanceId,
          sent_via_chatbot_flow_id: flowId,
        });
        await supabase.from('conversations').update({
          last_message_at: new Date().toISOString(),
          last_message_preview: text.substring(0, 100),
          last_message_direction: 'outbound',
        }).eq('id', conversationId);
        return true;
      } catch (err) {
        console.error('[FLOW] Evolution sendButtons exception:', err);
        return false;
      }
    };

    // Helper: log node execution for analytics
    const logNodeExecution = async (nodeId: string, nodeType: string, status: string = 'processed') => {
      try {
        await supabase.from('chatbot_node_executions').insert({
          execution_id: execution.id,
          flow_id: flowId,
          node_id: nodeId,
          node_type: nodeType,
          user_id: userId,
          status,
        });
      } catch (err) {
        console.error('[FLOW] Error logging node execution:', err);
      }
    };

    // Process nodes sequentially
    let currentId: string | null = startNodeId;
    let processedCount = 0;
    const maxNodes = 50; // Safety limit

    while (currentId && processedCount < maxNodes) {
      processedCount++;
      const node = nodes.find((n: any) => n.id === currentId);
      if (!node) {
        console.log('[FLOW] Node not found:', currentId);
        break;
      }

      console.log(`[FLOW] Processing node: ${node.type} (${node.id})`);

      // Update current node in execution
      await supabase
        .from('chatbot_executions')
        .update({ current_node_id: currentId })
        .eq('id', execution.id);

      // Log node execution for analytics tracking
      const messageHasButtons = node.type === 'message' && (
        ((((node.data?.messageMode as string) || 'text') === 'text' &&
          (((node.data?.buttons as Array<{ label: string }>) || []).filter(b => b?.label?.trim()).length > 0))) ||
        ((((node.data?.messageMode as string) || 'text') === 'meta_template' &&
          ((((node.data?.config as any)?.metaTemplateButtons as Array<{ type: string }>) || []).some(b => b?.type === 'QUICK_REPLY'))))
      );
      const isInputNode = node.type === 'question' || node.type === 'list_message' || node.type === 'buttons' || messageHasButtons;
      if (!isInputNode) {
        await logNodeExecution(node.id, node.type, 'processed');
      }

      // Resume routing for choice nodes (buttons / list_message / message-with-buttons)
      const messageEffectiveButtons = (() => {
        if (node.type !== 'message') return [];
        const mode = (node.data?.messageMode as string) || 'text';
        if (mode === 'text') {
          return ((node.data?.buttons as Array<{ label: string }>) || []).filter(b => b?.label?.trim());
        }
        if (mode === 'meta_template') {
          const tplBtns = ((node.data?.config as any)?.metaTemplateButtons as Array<{ type: string; text: string }>) || [];
          return tplBtns.filter(b => b?.type === 'QUICK_REPLY').map(b => ({ label: b.text }));
        }
        return [];
      })();
      const isMessageWithButtons = node.type === 'message' && messageEffectiveButtons.length > 0;

      if (
        (node.type === 'buttons' || node.type === 'list_message' || isMessageWithButtons) &&
        execution.current_node_id === node.id &&
        (inputValue !== undefined || resumingFromSchedule)
      ) {
        let handle: string | null = null;

        if (resumingFromSchedule && inputValue === undefined) {
          handle = 'timeout';
        } else if (typeof inputValue === 'string') {
          const txt = inputValue.trim().toLowerCase();
          const options: Array<{ handle: string; label: string }> =
            node.type === 'buttons'
              ? ((node.data?.buttons as Array<{ label: string }>) || []).map((b, i) => ({
                  handle: `btn_${i}`,
                  label: (b?.label || '').toLowerCase(),
                }))
              : node.type === 'list_message'
                ? ((node.data?.items as Array<{ title: string }>) || []).map((it, i) => ({
                    handle: `option_${i}`,
                    label: (it?.title || '').toLowerCase(),
                  }))
                : messageEffectiveButtons.map((b, i) => ({
                    handle: `btn_${i}`,
                    label: (b.label || '').toLowerCase(),
                  }));

          // 1) numeric (1, 2, 3...)
          const numMatch = txt.match(/^\s*(\d+)\s*$/);
          if (numMatch) {
            const idx = parseInt(numMatch[1], 10) - 1;
            if (idx >= 0 && idx < options.length) handle = options[idx].handle;
          }
          // 2) exact label
          if (!handle) {
            const found = options.find((o) => o.label && o.label === txt);
            if (found) handle = found.handle;
          }
          // 3) starts with / contains label
          if (!handle) {
            const found = options.find(
              (o) => o.label && (txt.startsWith(o.label) || txt.includes(o.label)),
            );
            if (found) handle = found.handle;
          }
          if (!handle) handle = 'other';
        }

        const branchId = handle ? getNextNode(node.id, handle) : null;
        const fallbackId = getNextNode(node.id);
        currentId = branchId || fallbackId;
        // Clear inputValue / resume flags so we don't re-route on the next iteration
        inputValue = undefined;
        resumingFromSchedule = false;
        continue;
      }

      switch (node.type) {
        case 'start':
        case 'trigger': {
          currentId = getNextNode(node.id);
          break;
        }

        case 'message': {
          // If resuming from a scheduled delay on this node, skip the delay
          const msgDelay = node.data?.delay ? parseInt(String(node.data.delay)) : 0;
          if (msgDelay > 0 && !resumingFromSchedule) {
            if (msgDelay > 50) {
              const resumeAt = new Date(Date.now() + msgDelay * 1000).toISOString();
              await supabase
                .from('chatbot_executions')
                .update({ 
                  status: 'scheduled', 
                  current_node_id: node.id,
                  scheduled_resume_at: resumeAt,
                })
                .eq('id', execution.id);
              console.log(`[FLOW] Message delay ${msgDelay}s too long, scheduled resume at ${resumeAt}`);
              currentId = null;
              break;
            }
            await new Promise(r => setTimeout(r, msgDelay * 1000));
          }
          // Reset resume flag after handling this node
          resumingFromSchedule = false;

          const msgMode = (node.data?.messageMode as string) || 'text';
          currentTemplateId = msgMode === 'template' ? (node.data?.templateId ?? null) : null;
          currentMetaTemplateId = msgMode === 'meta_template' ? (node.data?.config?.metaTemplateId ?? null) : null;

          if (msgMode === 'template' && node.data?.templateId) {
            // Send Evolution/Lite template
            try {
              const { data: tpl } = await supabase
                .from('message_templates')
                .select('content, media_url, media_type')
                .eq('id', node.data.templateId)
                .single();

              if (tpl) {
                const tplText = substituteVars(tpl.content || '');
                const hasMedia = !!(tpl.media_url && tpl.media_type);

                // Send caption text first (separate from media), like in campaigns
                if (tplText) {
                  await sendMessage(tplText);
                  await new Promise(r => setTimeout(r, 2000));
                }

                if (hasMedia && contact?.phone) {
                  const mediaType = tpl.media_type as string;
                  let mediaSent = false;
                  let mediaError: string | null = null;
                  let mediaMessageId: string | null = null;

                  // Try Evolution API first
                  if (instanceName) {
                    try {
                      const isAudio = mediaType === 'audio';
                      const endpoint = isAudio ? 'sendWhatsAppAudio' : 'sendMedia';
                      const payload: any = isAudio
                        ? { number: contact.phone, audio: tpl.media_url }
                        : { number: contact.phone, mediatype: mediaType, media: tpl.media_url };

                      const mediaResp = await fetch(`${evolutionApiUrl}/message/${endpoint}/${instanceName}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                        body: JSON.stringify(payload),
                      });
                      const mediaResult = await mediaResp.json();
                      if (!mediaResp.ok) {
                        mediaError = mediaResult?.message || mediaResult?.error || `Evolution ${endpoint} HTTP ${mediaResp.status}`;
                        console.error(`[FLOW] Evolution ${endpoint} failed:`, JSON.stringify(mediaResult));
                      } else {
                        mediaSent = true;
                        mediaMessageId = mediaResult?.key?.id || null;
                        console.log(`[FLOW] Media sent via Evolution (${endpoint})`);
                      }
                    } catch (err: any) {
                      mediaError = err?.message || 'Evolution media exception';
                      console.error('[FLOW] Evolution media exception:', err);
                    }
                  } else if (metaPhoneNumberId && metaAccessToken) {
                    // Fallback: Meta Cloud API media
                    try {
                      const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
                      const metaPayload: any = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: formattedPhone,
                        type: mediaType,
                      };
                      if (mediaType === 'audio') {
                        metaPayload.audio = { link: tpl.media_url };
                      } else if (mediaType === 'image') {
                        metaPayload.image = { link: tpl.media_url };
                      } else if (mediaType === 'video') {
                        metaPayload.video = { link: tpl.media_url };
                      } else {
                        metaPayload.document = { link: tpl.media_url };
                      }
                      const metaResp = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${metaAccessToken}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(metaPayload),
                      });
                      const metaResult = await metaResp.json();
                      if (!metaResp.ok) {
                        mediaError = metaResult?.error?.message || `Meta media HTTP ${metaResp.status}`;
                        console.error('[FLOW] Meta media failed:', JSON.stringify(metaResult));
                      } else {
                        mediaSent = true;
                        mediaMessageId = metaResult?.messages?.[0]?.id || null;
                        console.log('[FLOW] Media sent via Meta Cloud API');
                      }
                    } catch (err: any) {
                      mediaError = err?.message || 'Meta media exception';
                      console.error('[FLOW] Meta media exception:', err);
                    }
                  } else {
                    mediaError = 'Nenhum canal disponível para envio de mídia';
                  }

                  await supabase.from('inbox_messages').insert({
                    user_id: userId,
                    conversation_id: conversationId,
                    content: '',
                    direction: 'outbound',
                    status: mediaSent ? 'sent' : 'failed',
                    message_type: mediaType,
                    media_url: tpl.media_url,
                    whatsapp_message_id: mediaMessageId,
                    error_message: mediaError,
                    sent_at: new Date().toISOString(),
                    sent_via_instance_id: instanceName ? resolvedInstanceId : null,
                    sent_via_meta_number_id: !instanceName && metaPhoneNumberId ? metaPhoneNumberId : null,
                    sent_via_chatbot_flow_id: flowId,
                    sent_via_template_id: node.data.templateId,
                  });
                }
              }
            } catch (err) {
              console.error('[FLOW] Error sending template:', err);
            }
            await new Promise(r => setTimeout(r, 1500));

          } else if (msgMode === 'meta_template' && node.data?.config?.metaTemplateId) {
            // Send Meta WhatsApp template
            try {
              const metaConfig = node.data.config;
              const META_API_URL = 'https://graph.facebook.com/v21.0';

              const { data: metaTemplate } = await supabase
                .from('meta_templates')
                .select('*')
                .eq('id', metaConfig.metaTemplateId)
                .single();

              if (metaTemplate && contact?.phone) {
                const accessToken = await resolveMetaAccessToken(userId);
                if (accessToken) {
                  const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
                  const components: any[] = [];

                  // Resolve body variables using node-level mappings (preferred),
                  // template-level mappings, or sensible defaults.
                  const bodyText: string = metaTemplate.body_text || '';
                  const detected = [...new Set((bodyText.match(/\{\{(\d+)\}\}/g) || [])
                    .map((m: string) => parseInt(m.replace(/[{}]/g, ''))))]
                    .sort((a, b) => a - b);

                  const nodeMappings = Array.isArray(metaConfig.metaVariableMappings)
                    ? metaConfig.metaVariableMappings
                    : null;
                  const tplMappings = Array.isArray(metaTemplate.variable_mappings)
                    ? metaTemplate.variable_mappings
                    : null;
                  const mappings: any[] | null = nodeMappings && nodeMappings.length > 0
                    ? nodeMappings
                    : (tplMappings && tplMappings.length > 0 ? tplMappings : null);

                  const fullName = (contact?.name || '').trim();
                  const isValidName = fullName && !/^\+?\d+$/.test(fullName);

                  const resolveMapping = (idx: number): string => {
                    const m = mappings?.find((mm: any) => mm.variable_index === idx);
                    if (m) {
                      switch (m.source) {
                        case 'contact_name': return isValidName ? fullName : ' ';
                        case 'contact_phone': return contact?.phone || '';
                        case 'contact_email': return contact?.email || '';
                        case 'contact_custom_field':
                          return formatVarValue(contactCustom?.[m.field_key]);
                        case 'lead_custom_field':
                          return formatVarValue(dealCustom?.[m.field_key]);
                        case 'deal_value':
                          return activeDeal?.value != null ? String(activeDeal.value) : '';
                        case 'deal_name':
                          return activeDeal?.title || '';
                        case 'fixed_text':
                          return m.fixed_value || '';
                      }
                    }
                    // Default fallback: {{1}}=name, {{2}}=phone, rest empty
                    if (idx === 1) return isValidName ? fullName : ' ';
                    if (idx === 2) return contact?.phone || '';
                    return '';
                  };

                  const resolvedBodyVars: string[] = detected.map((i) => resolveMapping(i) || ' ');

                  if (resolvedBodyVars.length > 0) {
                    components.push({
                      type: 'body',
                      parameters: resolvedBodyVars.map((v) => ({ type: 'text', text: String(v) || ' ' })),
                    });
                  }

                  const messagePayload: any = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedPhone,
                    type: 'template',
                    template: {
                      name: metaTemplate.name,
                      language: { code: metaTemplate.language || 'pt_BR' },
                    },
                  };
                  if (components.length > 0) {
                    messagePayload.template.components = components;
                  }

                  const phoneNumberId = metaConfig.metaPhoneNumberId;
                  const resp = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messagePayload),
                  });
                  const result = await resp.json();
                  if (!resp.ok || result?.error) {
                    console.error('[FLOW] Meta template send FAILED:', resp.status, JSON.stringify(result));
                  } else {
                    console.log('[FLOW] Meta template sent OK:', result?.messages?.[0]?.id);
                  }

                  // Save resolved preview to inbox so UI shows actual values (not {{1}})
                  let previewText = bodyText || `[Template: ${metaTemplate.name}]`;
                  detected.forEach((i, idx) => {
                    previewText = previewText.replaceAll(`{{${i}}}`, resolvedBodyVars[idx] ?? '');
                  });
                  await supabase.from('inbox_messages').insert({
                    user_id: userId, conversation_id: conversationId,
                    content: previewText, direction: 'outbound',
                    status: resp.ok && !result?.error ? 'sent' : 'failed',
                    message_type: 'template',
                    sent_at: new Date().toISOString(),
                    sent_via_meta_number_id: phoneNumberId,
                    whatsapp_message_id: result?.messages?.[0]?.id || null,
                    error_message: result?.error ? (result.error?.message || JSON.stringify(result.error)) : null,
                    sent_via_chatbot_flow_id: flowId,
                    sent_via_meta_template_id: metaConfig.metaTemplateId,
                  });
                  await supabase.from('conversations').update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: previewText.substring(0, 100),
                    last_message_direction: 'outbound',
                  }).eq('id', conversationId);
                } else {
                  console.error('[FLOW] No Meta access token found');
                }
              }
            } catch (err) {
              console.error('[FLOW] Error sending Meta template:', err);
            }
            await new Promise(r => setTimeout(r, 1500));

          } else {
            // Plain text message - check for interactive buttons (Kommo style)
            const text = substituteVars(node.data?.message || node.data?.text || '');
            const txtButtons = ((node.data?.buttons as Array<{ label: string }>) || []).filter(b => b?.label?.trim());

            if (text && txtButtons.length > 0 && contact?.phone) {
              // Send as interactive buttons
              let sendError: string | null = null;
              if (metaPhoneNumberId && metaAccessToken) {
                try {
                  const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
                  const payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedPhone,
                    type: 'interactive',
                    interactive: {
                      type: 'button',
                      body: { text },
                      action: {
                        buttons: txtButtons.slice(0, 3).map((b, i) => ({
                          type: 'reply',
                          reply: { id: `btn_${i}`, title: (b.label || `Opção ${i + 1}`).slice(0, 20) },
                        })),
                      },
                    },
                  };
                  const resp = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${metaAccessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  });
                  const result = await resp.json();
                  if (!resp.ok) {
                    sendError = result?.error?.message || `Meta buttons HTTP ${resp.status}`;
                  } else {
                    await supabase.from('inbox_messages').insert({
                      user_id: userId, conversation_id: conversationId,
                      content: `${text}\n\n${txtButtons.map((b, i) => `[${i + 1}] ${b.label}`).join('\n')}`,
                      direction: 'outbound', status: 'sent', message_type: 'interactive',
                      whatsapp_message_id: result?.messages?.[0]?.id || null,
                      sent_at: new Date().toISOString(),
                      sent_via_meta_number_id: metaPhoneNumberId,
                      sent_via_chatbot_flow_id: flowId,
                    });
                  }
                } catch (err: any) {
                  sendError = err?.message || 'Meta buttons exception';
                }
              } else {
                // Evolution: try real interactive buttons; fallback to plain text WITHOUT numbered list
                const ok = await sendEvolutionButtons(text, txtButtons);
                if (!ok) {
                  try {
                    await sendMessage(text);
                  } catch (err: any) {
                    sendError = err?.message || 'Evolution send exception';
                  }
                }
              }

              if (sendError) {
                console.error('[FLOW] Message buttons send error:', sendError);
                const failedNext = getNextNode(node.id, 'failed');
                currentId = failedNext || getNextNode(node.id);
                break;
              }

              // Schedule timeout resume and pause
              const timeoutMin = Math.max(1, parseInt(String(node.data?.timeoutMinutes ?? 60)) || 60);
              await supabase
                .from('chatbot_executions')
                .update({
                  status: 'waiting_input',
                  current_node_id: node.id,
                  scheduled_resume_at: new Date(Date.now() + timeoutMin * 60 * 1000).toISOString(),
                })
                .eq('id', execution.id);
              await logNodeExecution(node.id, node.type, 'waiting_input');
              currentId = null;
              break;
            }

            const mediaUrl = node.data?.mediaUrl as string | undefined;
            const mediaType = node.data?.mediaType as 'image' | 'video' | 'audio' | 'document' | undefined;
            const mediaFilename = node.data?.mediaFilename as string | undefined;

            if (mediaUrl && mediaType) {
              // Send text first (if any), then media (matches campaign media convention)
              if (text) {
                await sendMessage(text);
                await new Promise(r => setTimeout(r, 2000));
              }
              await sendMediaMessage(mediaType, mediaUrl, undefined, mediaFilename);
              await new Promise(r => setTimeout(r, 1500));
            } else if (text) {
              await sendMessage(text);
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          // If meta_template has QUICK_REPLY buttons, pause and wait for response
          if ((node.data?.messageMode as string) === 'meta_template') {
            const tplBtns = (((node.data?.config as any)?.metaTemplateButtons as Array<{ type: string }>) || [])
              .filter(b => b?.type === 'QUICK_REPLY');
            if (tplBtns.length > 0) {
              const timeoutMin = Math.max(1, parseInt(String(node.data?.timeoutMinutes ?? 60)) || 60);
              await supabase
                .from('chatbot_executions')
                .update({
                  status: 'waiting_input',
                  current_node_id: node.id,
                  scheduled_resume_at: new Date(Date.now() + timeoutMin * 60 * 1000).toISOString(),
                })
                .eq('id', execution.id);
              await logNodeExecution(node.id, node.type, 'waiting_input');
              currentId = null;
              break;
            }
          }

          currentId = getNextNode(node.id);
          break;
        }

        case 'question': {
          const questionText = substituteVars(node.data?.question || node.data?.message || '');
          if (questionText) {
            await sendMessage(questionText);
          }

          // If we already have input (resuming after response), continue
          if (inputValue !== undefined && execution.current_node_id === node.id) {
            // Check if there are conditional outputs based on response
            const matchingEdge = edges?.find((e: any) => {
              if (e.source_node_id !== node.id) return false;
              if (!e.label) return false;
              return inputValue.toLowerCase().includes(e.label.toLowerCase());
            });

            currentId = matchingEdge?.target_node_id || getNextNode(node.id);
            break;
          }

          // Wait for user input - pause execution
          await logNodeExecution(node.id, node.type, 'waiting_input');
          await supabase
            .from('chatbot_executions')
            .update({ status: 'waiting_input', current_node_id: node.id })
            .eq('id', execution.id);

          console.log('[FLOW] Waiting for user input at node:', node.id);
          currentId = null; // Stop processing
          break;
        }

        case 'condition': {
          // Resolve a variable key against: live system vars > execution vars > deal custom > contact custom > flat lookups
          const systemVars = getSystemConditionVars();
          const contactCustomNow = (contact?.custom_fields as Record<string, any>) || {};
          const dealCustomNow = (activeDeal?.custom_fields as Record<string, any>) || {};
          const flatLookup: Record<string, any> = {
            nome: contact?.name || '',
            primeiro_nome: (contact?.name || '').split(/\s+/)[0] || '',
            telefone: contact?.phone || '',
            email: contact?.email || '',
            valor: activeDeal?.value ?? '',
            titulo: activeDeal?.title || '',
            etapa: activeStage?.name || '',
            funil: activeFunnel?.name || '',
          };
          const resolveVar = (key: string): any => {
            if (!key) return execution.variables?.['_last_input'] ?? '';
            if (systemVars[key] !== undefined) return systemVars[key];
            if (execution.variables?.[key] !== undefined) return execution.variables[key];
            if (flatLookup[key] !== undefined) return flatLookup[key];
            if (dealCustomNow[key] !== undefined) return dealCustomNow[key];
            if (contactCustomNow[key] !== undefined) return contactCustomNow[key];
            return '';
          };

          const evalSingle = (variable: string, operator: string, expected: string): boolean => {
            const raw = resolveVar(variable);
            const left = (raw === null || raw === undefined) ? '' : String(raw);
            const right = expected ?? '';
            const l = left.toLowerCase();
            const r = String(right).toLowerCase();
            switch (operator) {
              case 'equals': return l === r;
              case 'not_equals': return l !== r;
              case 'contains': return l.includes(r);
              case 'not_contains': return !l.includes(r);
              case 'starts_with': return l.startsWith(r);
              case 'ends_with': return l.endsWith(r);
              case 'greater_than': return Number(left) > Number(right);
              case 'less_than': return Number(left) < Number(right);
              case 'is_empty': return left.trim() === '';
              case 'is_not_empty': return left.trim() !== '';
              default: return false;
            }
          };

          // Support both legacy single-condition shape and new conditions[] array
          const list: Array<{ variable: string; operator: string; value: string }> =
            Array.isArray(node.data?.conditions) && node.data.conditions.length > 0
              ? node.data.conditions
              : [{ variable: node.data?.variable || '_last_input', operator: node.data?.operator || 'contains', value: node.data?.value || '' }];
          const logic = (node.data?.logicOperator || 'and').toLowerCase();

          let conditionMet: boolean;
          if (logic === 'or') {
            conditionMet = list.some((c) => evalSingle(c.variable, c.operator, c.value));
          } else {
            conditionMet = list.every((c) => evalSingle(c.variable, c.operator, c.value));
          }

          console.log(`[FLOW] condition node ${node.id} -> met=${conditionMet} (${list.length} cond, logic=${logic})`);

          // Try both handle naming conventions (true/false and yes/no)
          currentId =
            getNextNode(node.id, conditionMet ? 'true' : 'false') ||
            getNextNode(node.id, conditionMet ? 'yes' : 'no');
          break;
        }

        case 'action': {
          const actionType = node.data?.actionType || node.data?.action;
          const config = node.data?.config || {};
          
          if (actionType === 'add_tag' && (node.data?.tagId || config.tagName)) {
            if (config.tagName) {
              // Find or create tag by name
              const { data: existingTag } = await supabase
                .from('tags')
                .select('id')
                .eq('user_id', userId)
                .eq('name', config.tagName)
                .maybeSingle();
              
              let tagId = existingTag?.id;
              if (!tagId) {
                const { data: newTag } = await supabase
                  .from('tags')
                  .insert({ name: config.tagName, user_id: userId })
                  .select('id')
                  .single();
                tagId = newTag?.id;
              }
              if (tagId) {
                await supabase.from('contact_tags').upsert({
                  contact_id: contactId,
                  tag_id: tagId,
                }, { onConflict: 'contact_id,tag_id' });
              }
            } else {
              await supabase.from('contact_tags').upsert({
                contact_id: contactId,
                tag_id: node.data.tagId,
              }, { onConflict: 'contact_id,tag_id' });
            }
          } else if (actionType === 'remove_tag' && config.tagName) {
            const { data: tag } = await supabase
              .from('tags')
              .select('id')
              .eq('user_id', userId)
              .eq('name', config.tagName)
              .maybeSingle();
            if (tag) {
              await supabase
                .from('contact_tags')
                .delete()
                .eq('contact_id', contactId)
                .eq('tag_id', tag.id);
            }
          } else if ((actionType === 'move_funnel' || actionType === 'change_lead_status') && config.stageId) {
            const { data: deal } = await supabase
              .from('funnel_deals')
              .select('id')
              .eq('contact_id', contactId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (deal) {
              await supabase
                .from('funnel_deals')
                .update({ stage_id: config.stageId })
                .eq('id', deal.id);
            }
          } else if (actionType === 'set_variable' && config.varName) {
            const variables = execution.variables || {};
            variables[config.varName] = substituteVars(config.varValue || '');
            execution.variables = variables;
            await supabase
              .from('chatbot_executions')
              .update({ variables })
              .eq('id', execution.id);
          } else if (actionType === 'transfer' || actionType === 'transfer_human') {
            await supabase
              .from('conversations')
              .update({ ai_handoff_requested: true, ai_handled: false })
              .eq('id', conversationId);
          } else if (actionType === 'http_request' && config.httpUrl) {
            try {
              const url = substituteVars(config.httpUrl);
              const method = config.httpMethod || 'POST';
              const body = config.httpBody ? substituteVars(config.httpBody) : undefined;
              const fetchOpts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
              if (method !== 'GET' && body) fetchOpts.body = body;
              const resp = await fetch(url, fetchOpts);
              const respText = await resp.text();
              console.log(`[FLOW] HTTP ${method} ${url} => ${resp.status}`);
              // Store response in variables
              const variables = execution.variables || {};
              variables['_http_status'] = String(resp.status);
              variables['_http_response'] = respText.substring(0, 2000);
              execution.variables = variables;
              await supabase
                .from('chatbot_executions')
                .update({ variables })
                .eq('id', execution.id);
            } catch (err) {
              console.error('[FLOW] HTTP request error:', err);
            }
          } else if (actionType === 'set_field' && config.fieldKey) {
            // Update custom field on contact
            const { data: contactData } = await supabase
              .from('contacts')
              .select('custom_fields')
              .eq('id', contactId)
              .single();
            const customFields = (contactData?.custom_fields as Record<string, any>) || {};
            customFields[config.fieldKey] = substituteVars(config.fieldValue || '');
            await supabase
              .from('contacts')
              .update({ custom_fields: customFields })
              .eq('id', contactId);
            console.log(`[FLOW] Set field ${config.fieldKey} on contact`);
          } else if (actionType === 'create_lead' && config.funnelId && config.stageId) {
            // Create a new deal/lead
            await supabase.from('funnel_deals').insert({
              funnel_id: config.funnelId,
              stage_id: config.stageId,
              contact_id: contactId,
              user_id: userId,
              title: contact?.name || 'Lead do Chatbot',
              value: 0,
            });
            console.log('[FLOW] Created new lead in funnel');
          } else if (actionType === 'add_note' && config.noteContent) {
            const noteText = substituteVars(config.noteContent);
            await supabase.from('conversation_notes').insert({
              conversation_id: conversationId,
              contact_id: contactId,
              user_id: userId,
              content: noteText,
            });
            console.log('[FLOW] Added note to conversation');
          } else if (actionType === 'add_task' && config.taskTitle) {
            const daysOffset = parseInt(config.taskDueDate || '1') || 1;
            const dueDate = new Date(Date.now() + daysOffset * 86400000).toISOString().split('T')[0];
            await supabase.from('conversation_tasks').insert({
              conversation_id: conversationId,
              contact_id: contactId,
              user_id: userId,
              title: substituteVars(config.taskTitle),
              description: substituteVars(config.taskDescription || ''),
              due_date: dueDate,
              priority: 'medium',
            });
            console.log('[FLOW] Added task');
          } else if (actionType === 'change_conversation_status' && config.conversationStatus) {
            await supabase
              .from('conversations')
              .update({ status: config.conversationStatus })
              .eq('id', conversationId);
            console.log(`[FLOW] Changed conversation status to ${config.conversationStatus}`);
          } else if (actionType === 'complete_tasks') {
            await supabase
              .from('conversation_tasks')
              .update({ completed_at: new Date().toISOString() })
              .eq('contact_id', contactId)
              .is('completed_at', null);
            console.log('[FLOW] Completed all pending tasks');
          } else if (actionType === 'change_responsible' && config.responsibleId) {
            await supabase
              .from('conversations')
              .update({ assigned_to: config.responsibleId })
              .eq('id', conversationId);
            console.log(`[FLOW] Changed responsible to ${config.responsibleId}`);
          } else if (actionType === 'send_meta_template' && config.metaPhoneNumberId && config.metaTemplateId) {
            // Send Meta WhatsApp template
            try {
              const META_API_URL = 'https://graph.facebook.com/v21.0';
              
              // Load the template
              const { data: metaTemplate } = await supabase
                .from('meta_templates')
                .select('*')
                .eq('id', config.metaTemplateId)
                .single();

              if (metaTemplate && contact?.phone) {
                // Get access token from meta_whatsapp_numbers
                const { data: metaNumber } = await supabase
                  .from('meta_whatsapp_numbers')
                  .select('phone_number_id, waba_id')
                  .eq('phone_number_id', config.metaPhoneNumberId)
                  .single();

                // Get access token (integrations table, with org-member + env fallback)
                const accessToken = await resolveMetaAccessToken(userId);
                if (!accessToken) {
                  console.error('[FLOW] No Meta access token found');
                } else {
                  const formattedPhone = contact.phone.replace(/[^0-9]/g, '');

                  // Build components from body examples
                  const components: any[] = [];
                  const bodyExamples = metaTemplate.body_examples || [];
                  if (bodyExamples.length > 0) {
                    // Replace variables with contact data
                    const resolvedVars = bodyExamples.map((example: string) => {
                      let resolved = example;
                      resolved = resolved.replace(/\{\{nome\}\}/gi, contact?.name || '');
                      resolved = resolved.replace(/\{\{telefone\}\}/gi, contact?.phone || '');
                      resolved = resolved.replace(/\{\{email\}\}/gi, contact?.email || '');
                      return resolved;
                    });
                    components.push({
                      type: 'body',
                      parameters: resolvedVars.map((v: string) => ({ type: 'text', text: v })),
                    });
                  }

                  const messagePayload: any = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedPhone,
                    type: 'template',
                    template: {
                      name: metaTemplate.name,
                      language: { code: metaTemplate.language || 'pt_BR' },
                    },
                  };
                  if (components.length > 0) {
                    messagePayload.template.components = components;
                  }

                  const phoneNumberId = config.metaPhoneNumberId;
                  const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messagePayload),
                  });

                  const result = await response.json();
                  console.log('[FLOW] Meta template send result:', JSON.stringify(result));

                  if (response.ok) {
                    const whatsappMessageId = result.messages?.[0]?.id;
                    const displayContent = metaTemplate.body_text || `[Template: ${metaTemplate.name}]`;
                    
                    await supabase.from('inbox_messages').insert({
                      user_id: userId,
                      conversation_id: conversationId,
                      content: displayContent,
                      direction: 'outbound',
                      status: 'sent',
                      message_type: 'text',
                      whatsapp_message_id: whatsappMessageId,
                      sent_at: new Date().toISOString(),
                      sent_via_meta_number_id: phoneNumberId,
                      sent_via_chatbot_flow_id: flowId,
                    });

                    await supabase.from('conversations').update({
                      last_message_at: new Date().toISOString(),
                      last_message_preview: displayContent.substring(0, 100),
                      last_message_direction: 'outbound',
                      provider: 'meta',
                      meta_phone_number_id: phoneNumberId,
                    }).eq('id', conversationId);

                    console.log(`[FLOW] Meta template "${metaTemplate.name}" sent successfully`);
                  } else {
                    console.error('[FLOW] Meta template send failed:', result.error?.message);
                  }
                }
              }
            } catch (err) {
              console.error('[FLOW] Error sending Meta template:', err);
            }
          } else if (actionType === 'notify_user') {
            const notifyUserIds = (config.notifyUserIds as string[]) || [];
            if (notifyUserIds.length === 0) {
              console.log('[FLOW] notify_user: no users configured');
            } else {
              const contactName = contact?.name || 'Sem nome';
              const contactPhone = contact?.phone || '';
              const contactEmail = contact?.email || '';
              const defaultMsg = `🔔 *Notificação do Chatbot*\n\nContato: *{{nome}}*\nTelefone: {{telefone}}`;
              let notifyMessage = (config.notifyMessage as string) || defaultMsg;
              notifyMessage = notifyMessage
                .replace(/\{\{nome\}\}/g, contactName)
                .replace(/\{\{telefone\}\}/g, contactPhone)
                .replace(/\{\{email\}\}/g, contactEmail);

              for (const notifyUserId of notifyUserIds) {
                try {
                  const notifResp = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      type: 'chatbot_notify',
                      data: {
                        contactName,
                        contactPhone,
                        message: notifyMessage,
                      },
                      recipientUserId: notifyUserId,
                    }),
                  });
                  console.log(`[FLOW] notify_user sent to ${notifyUserId}: ${notifResp.status}`);
                } catch (notifErr) {
                  console.error(`[FLOW] notify_user error for ${notifyUserId}:`, notifErr);
                }
              }
            }
          }

          currentId = getNextNode(node.id);
          break;
        }

        case 'list_message': {
          const header = substituteVars(node.data?.header || '');
          const body = substituteVars(node.data?.body || '');
          const buttonText = node.data?.buttonText || 'Ver opções';
          const items = (node.data?.items as Array<{ title: string; description?: string }>) || [];
          const timeoutMin = parseInt(String(node.data?.timeoutMinutes ?? 60)) || 60;
          let sendFailed = false;

          if (instanceName && contact?.phone && items.length > 0) {
            try {
              const listPayload = {
                number: contact.phone, title: header, description: body,
                buttonText, footerText: '',
                sections: [{
                  title: header || 'Opções',
                  rows: items.map((item, i) => ({
                    title: substituteVars(item.title),
                    description: substituteVars(item.description || ''),
                    rowId: `option_${i}`,
                  })),
                }],
              };
              const response = await fetch(`${evolutionApiUrl}/message/sendList/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                body: JSON.stringify(listPayload),
              });
              if (!response.ok) sendFailed = true;
              let result: any;
              try { result = await response.json(); } catch { result = {}; }
              const whatsappMessageId = result?.key?.id || null;
              await supabase.from('inbox_messages').insert({
                user_id: userId, conversation_id: conversationId,
                content: `${body}\n\n📋 ${items.map((it, i) => `${i + 1}. ${it.title}`).join('\n')}`,
                direction: 'outbound', status: sendFailed ? 'failed' : 'sent',
                message_type: 'text', whatsapp_message_id: whatsappMessageId,
                sent_at: new Date().toISOString(),
                sent_via_instance_id: resolvedInstanceId,
                sent_via_chatbot_flow_id: flowId,
              });
              await supabase.from('conversations').update({
                last_message_at: new Date().toISOString(),
                last_message_preview: body.substring(0, 100),
                last_message_direction: 'outbound',
              }).eq('id', conversationId);
            } catch (err) {
              console.error('[FLOW] Error sending list message:', err);
              sendFailed = true;
            }
          } else {
            sendFailed = true;
          }

          if (sendFailed) {
            const failedNext = getNextNode(node.id, 'failed');
            currentId = failedNext || getNextNode(node.id);
            break;
          }

          await logNodeExecution(node.id, node.type, 'waiting_input');
          await supabase.from('chatbot_executions').update({
            status: 'waiting_input',
            current_node_id: node.id,
            scheduled_resume_at: new Date(Date.now() + timeoutMin * 60 * 1000).toISOString(),
          }).eq('id', execution.id);
          currentId = null;
          break;
        }

        case 'buttons': {
          const text = substituteVars(node.data?.message || '');
          const buttons = ((node.data?.buttons as Array<{ label: string }>) || [])
            .filter((b) => b?.label?.trim())
            .slice(0, 3);
          const timeoutMin = parseInt(String(node.data?.timeoutMinutes ?? 60)) || 60;
          let sendFailed = false;

          if (!contact?.phone || buttons.length === 0) {
            sendFailed = true;
          } else if (metaPhoneNumberId && metaAccessToken) {
            // Meta interactive buttons
            try {
              const payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: contact.phone,
                type: 'interactive',
                interactive: {
                  type: 'button',
                  body: { text: text || ' ' },
                  action: {
                    buttons: buttons.map((b, i) => ({
                      type: 'reply',
                      reply: { id: `btn_${i}`, title: b.label.slice(0, 20) },
                    })),
                  },
                },
              };
              const res = await fetch(`${META_API_URL}/${metaPhoneNumberId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${metaAccessToken}` },
                body: JSON.stringify(payload),
              });
              if (!res.ok) sendFailed = true;
              const result: any = await res.json().catch(() => ({}));
              const wid = result?.messages?.[0]?.id || null;
              await supabase.from('inbox_messages').insert({
                user_id: userId, conversation_id: conversationId,
                content: `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.label}`).join('\n')}`,
                direction: 'outbound', status: sendFailed ? 'failed' : 'sent',
                message_type: 'text', whatsapp_message_id: wid,
                sent_at: new Date().toISOString(),
                sent_via_meta_number_id: metaPhoneNumberId,
                sent_via_chatbot_flow_id: flowId,
              });
            } catch (err) {
              console.error('[FLOW] Error sending Meta buttons:', err);
              sendFailed = true;
            }
          } else if (instanceName) {
            // Evolution: try real interactive buttons; fallback to plain text WITHOUT numbered list
            const ok = await sendEvolutionButtons(text, buttons);
            if (!ok) {
              try {
                await sendMessage(text || ' ');
              } catch (err) {
                console.error('[FLOW] Error sending Evolution buttons fallback:', err);
                sendFailed = true;
              }
            }
          } else {
            sendFailed = true;
          }

          if (sendFailed) {
            const failedNext = getNextNode(node.id, 'failed');
            currentId = failedNext || getNextNode(node.id);
            break;
          }

          await supabase.from('conversations').update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text.substring(0, 100),
            last_message_direction: 'outbound',
          }).eq('id', conversationId);

          await logNodeExecution(node.id, node.type, 'waiting_input');
          await supabase.from('chatbot_executions').update({
            status: 'waiting_input',
            current_node_id: node.id,
            scheduled_resume_at: new Date(Date.now() + timeoutMin * 60 * 1000).toISOString(),
          }).eq('id', execution.id);
          currentId = null;
          break;
        }


        case 'validation': {
          const varToValidate = execution.variables?.[node.data?.variable || '_last_input'] || '';
          const validationType = node.data?.validationType || 'not_empty';
          let isValid = false;

          switch (validationType) {
            case 'not_empty':
              isValid = varToValidate.trim().length > 0;
              break;
            case 'email':
              isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(varToValidate);
              break;
            case 'phone':
              isValid = /^\+?\d{10,15}$/.test(varToValidate.replace(/[\s\-()]/g, ''));
              break;
            case 'cpf':
              isValid = /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(varToValidate);
              break;
            case 'number':
              isValid = !isNaN(Number(varToValidate)) && varToValidate.trim().length > 0;
              break;
            case 'regex':
              try {
                isValid = new RegExp(node.data?.regexPattern || '.*').test(varToValidate);
              } catch { isValid = false; }
              break;
          }

          console.log(`[FLOW] Validation ${validationType}: "${varToValidate}" => ${isValid}`);

          if (!isValid && node.data?.errorMessage) {
            await sendMessage(substituteVars(node.data.errorMessage));
          }

          currentId = getNextNode(node.id, isValid ? 'valid' : 'invalid');
          break;
        }

        case 'sub_flow': {
          // Trigger another flow
          const targetFlowId = node.data?.targetFlowId;
          if (targetFlowId) {
            console.log(`[FLOW] Starting sub-flow: ${targetFlowId}`);
            try {
              await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/execute-chatbot-flow`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  flowId: targetFlowId,
                  conversationId,
                  contactId,
                  userId,
                }),
              });
            } catch (err) {
              console.error('[FLOW] Error starting sub-flow:', err);
            }
          }
          currentId = getNextNode(node.id);
          break;
        }

        case 'round_robin': {
          // Route ANY outgoing branch in rotation (not only team members).
          const outgoing = (edges || []).filter((e: any) => e.source_node_id === node.id);

          if (outgoing.length === 0) {
            console.log('[FLOW] Round robin has no outgoing edges, ending branch');
            currentId = null;
            break;
          }

          // Preserve configured output order when available
          const configuredOutputs = (node.data?.outputs as Array<{ id: string; label?: string }>) || [];
          let ordered: any[] = [];
          if (configuredOutputs.length > 0) {
            for (const out of configuredOutputs) {
              const edge = outgoing.find((e: any) => e.source_handle === out.id);
              if (edge) ordered.push(edge);
            }
            // Append any edges not matched (defensive)
            for (const e of outgoing) {
              if (!ordered.includes(e)) ordered.push(e);
            }
          } else {
            ordered = outgoing;
          }

          const lastIndex = typeof node.data?.lastIndex === 'number' ? node.data.lastIndex : -1;
          const nextIndex = (lastIndex + 1) % ordered.length;
          const chosen = ordered[nextIndex];

          // Persist counter on the node so rotation survives across executions
          const newData = { ...(node.data || {}), lastIndex: nextIndex };
          await supabase
            .from('chatbot_flow_nodes')
            .update({ data: newData })
            .eq('id', node.id);
          node.data = newData;

          console.log(`[FLOW] Round robin → output ${nextIndex + 1}/${ordered.length} (handle: ${chosen.source_handle || 'default'})`);
          currentId = chosen.target_node_id || null;
          break;
        }

        case 'delay': {
          const waitMode = (node.data?.waitMode as string) || 'time';

          // ----- Mode: wait until contact sends a message -----
          if (waitMode === 'message') {
            const isResumingHere = execution.current_node_id === node.id &&
              (resumingFromSchedule || inputValue !== undefined);
            // If we're already resuming because a message arrived (or timeout fired), continue
            if (isResumingHere) {
              console.log('[FLOW] Delay(message): resume signal received, continuing');
              resumingFromSchedule = false;
              currentId = getNextNode(node.id);
              break;
            }

            // Optional timeout in minutes - schedule auto-resume
            const timeoutMin = node.data?.messageTimeoutMinutes
              ? parseInt(String(node.data.messageTimeoutMinutes))
              : 0;

            const update: Record<string, unknown> = {
              status: 'waiting_input',
              current_node_id: node.id,
            };
            if (timeoutMin > 0) {
              update.scheduled_resume_at = new Date(Date.now() + timeoutMin * 60 * 1000).toISOString();
            }

            await logNodeExecution(node.id, node.type, 'waiting_input');
            await supabase
              .from('chatbot_executions')
              .update(update)
              .eq('id', execution.id);

            console.log(`[FLOW] Delay(message): waiting for user message at node ${node.id}${timeoutMin ? ` (timeout ${timeoutMin}min)` : ''}`);
            currentId = null;
            break;
          }

          // ----- Mode: wait fixed time -----
          // If resuming from a scheduled delay on this node, skip straight to next
          if (resumingFromSchedule) {
            console.log('[FLOW] Resuming from scheduled delay, skipping to next node');
            resumingFromSchedule = false;
            currentId = getNextNode(node.id);
            break;
          }

          // Read duration + unit from the builder
          const duration = node.data?.duration ? parseInt(String(node.data.duration)) : (node.data?.delay || node.data?.seconds || 5);
          const unit = (node.data?.unit as string) || 'seconds';
          
          let delaySeconds = duration;
          if (unit === 'minutes') delaySeconds = duration * 60;
          else if (unit === 'hours') delaySeconds = duration * 3600;

          console.log(`[FLOW] Delay node: ${duration} ${unit} = ${delaySeconds}s`);

          // If delay exceeds safe execution time (50s), schedule for later
          if (delaySeconds > 50) {
            const resumeAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
            await supabase
              .from('chatbot_executions')
              .update({ 
                status: 'scheduled', 
                current_node_id: node.id,
                scheduled_resume_at: resumeAt,
              })
              .eq('id', execution.id);
            console.log(`[FLOW] Delay too long (${delaySeconds}s), scheduled resume at ${resumeAt}`);
            currentId = null;
            break;
          }

          await new Promise(r => setTimeout(r, delaySeconds * 1000));
          currentId = getNextNode(node.id);
          break;
        }

        case 'end': {
          currentId = null;
          break;
        }

        default: {
          console.log('[FLOW] Unknown node type:', node.type);
          currentId = getNextNode(node.id);
          break;
        }
      }
    }

    // Mark execution as completed if we finished all nodes
    if (!currentId) {
      const { data: execCheck } = await supabase
        .from('chatbot_executions')
        .select('status')
        .eq('id', execution.id)
        .single();

      if (execCheck?.status === 'running') {
        await supabase
          .from('chatbot_executions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', execution.id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      executionId: execution.id,
      status: currentId ? 'waiting_input' : 'completed',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[FLOW] Error executing flow:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
