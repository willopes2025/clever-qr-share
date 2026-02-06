import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationPayload {
  dealId: string;
  fromStageId?: string;
  toStageId?: string;
  triggerType?: string;
  messageContent?: string;
  tagName?: string;
  customFieldKey?: string;
  customFieldValue?: string;
  oldValue?: number;
  newValue?: number;
  isNewDeal?: boolean; // Flag to indicate if this is a newly created deal
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: AutomationPayload = await req.json();
    const { dealId, fromStageId, toStageId, triggerType, messageContent, tagName, customFieldKey, customFieldValue, isNewDeal } = payload;

    console.log("[FUNNEL-AUTOMATIONS] Processing automation", payload);

    // Fetch deal with funnel, stage and contact info (including label_id for LID contacts)
    const { data: deal, error: dealError } = await supabase
      .from('funnel_deals')
      .select(`
        *,
        contact:contacts(id, name, phone, email, label_id),
        stage:funnel_stages(id, name, is_final, final_type),
        funnel:funnels(id, name)
      `)
      .eq('id', dealId)
      .single();

    if (dealError || !deal) {
      console.error("[FUNNEL-AUTOMATIONS] Deal not found", dealError);
      return new Response(JSON.stringify({ error: "Deal not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine trigger types to check
    const triggersToCheck: string[] = [];

    // Check for funnel enter trigger (when deal is newly created)
    if (isNewDeal) {
      triggersToCheck.push('on_funnel_enter');
    }

    if (toStageId) {
      triggersToCheck.push('on_stage_enter');
      
      // Check if new stage is final
      const { data: toStage } = await supabase
        .from('funnel_stages')
        .select('is_final, final_type')
        .eq('id', toStageId)
        .single();
      
      if (toStage?.is_final) {
        if (toStage.final_type === 'won') {
          triggersToCheck.push('on_deal_won');
        } else if (toStage.final_type === 'lost') {
          triggersToCheck.push('on_deal_lost');
        }
      }
    }

    if (fromStageId) {
      triggersToCheck.push('on_stage_exit');
    }

    if (triggerType) {
      triggersToCheck.push(triggerType);
    }

    console.log("[FUNNEL-AUTOMATIONS] Triggers to check:", triggersToCheck);

    // Fetch applicable automations
    const { data: automations, error: autoError } = await supabase
      .from('funnel_automations')
      .select('*')
      .eq('funnel_id', deal.funnel_id)
      .eq('is_active', true)
      .in('trigger_type', triggersToCheck);

    if (autoError) {
      console.error("[FUNNEL-AUTOMATIONS] Error fetching automations", autoError);
      throw autoError;
    }

    console.log(`[FUNNEL-AUTOMATIONS] Found ${automations?.length || 0} automations to process`);

    const results: { automationId: string; success: boolean; error?: string }[] = [];

    // Helper function to replace variables
    const replaceVariables = (text: string): string => {
      const now = new Date();
      const formattedDate = now.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      return text
        .replace(/\{\{nome\}\}/g, deal.contact?.name || 'Cliente')
        .replace(/\{\{telefone\}\}/g, deal.contact?.phone || '')
        .replace(/\{\{email\}\}/g, deal.contact?.email || '')
        .replace(/\{\{valor\}\}/g, deal.value?.toString() || '0')
        .replace(/\{\{funil\}\}/g, deal.funnel?.name || '')
        .replace(/\{\{etapa\}\}/g, deal.stage?.name || '')
        .replace(/\{\{titulo\}\}/g, deal.title || '')
        .replace(/\{\{data\}\}/g, formattedDate)
        .replace(/\{\{deal_id\}\}/g, deal.id || '');
    };

    // Process each automation
    for (const automation of automations || []) {
      try {
        // Check if automation applies to this stage
        // on_funnel_enter: applies to any stage when deal is first created
        // message-based triggers: compare against deal's current stage
        // stage-based triggers: compare against toStageId/fromStageId
        const isMessageTrigger = automation.trigger_type === 'on_message_received' || automation.trigger_type === 'on_keyword_received';
        const isFunnelEnterTrigger = automation.trigger_type === 'on_funnel_enter';
        
        if (automation.stage_id && !isFunnelEnterTrigger) {
          if (isMessageTrigger) {
            // For message triggers, check if deal is currently in the specified stage
            if (automation.stage_id !== deal.stage_id) {
              console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - deal not in stage ${automation.stage_id} (current: ${deal.stage_id})`);
              continue;
            }
          } else {
            // For stage-change triggers, check against toStageId/fromStageId
            if (automation.stage_id !== toStageId && automation.stage_id !== fromStageId) {
              console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - stage mismatch (expected: ${automation.stage_id}, got to: ${toStageId}, from: ${fromStageId})`);
              continue;
            }
          }
        }

        // Check trigger-specific conditions
        const triggerConfig = automation.trigger_config as Record<string, unknown> || {};
        
        // Check keyword trigger
        if (automation.trigger_type === 'on_keyword_received' && messageContent) {
          const keywords = (triggerConfig.keywords as string || '').split(',').map(k => k.trim().toLowerCase());
          const messageLower = messageContent.toLowerCase();
          const hasKeyword = keywords.some(keyword => keyword && messageLower.includes(keyword));
          if (!hasKeyword) {
            console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - no keyword match`);
            continue;
          }
        }

        // Check tag trigger
        if ((automation.trigger_type === 'on_tag_added' || automation.trigger_type === 'on_tag_removed') && tagName) {
          const expectedTag = (triggerConfig.tag_name as string || '').toLowerCase();
          if (tagName.toLowerCase() !== expectedTag) {
            console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - tag mismatch`);
            continue;
          }
        }

        // Check custom field trigger
        if (automation.trigger_type === 'on_custom_field_changed' && customFieldKey) {
          const expectedField = triggerConfig.field_key as string;
          if (customFieldKey !== expectedField) {
            console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - field mismatch`);
            continue;
          }
        }

        console.log(`[FUNNEL-AUTOMATIONS] Executing automation: ${automation.name} (${automation.action_type})`);

        const actionConfig = automation.action_config as Record<string, unknown> || {};

        switch (automation.action_type) {
          case 'send_message': {
            const message = replaceVariables((actionConfig.message as string) || '');
            
            // Verificar se temos contato com telefone
            if (!deal.contact?.phone) {
              console.log(`[FUNNEL-AUTOMATIONS] Cannot send message - no contact phone`);
              results.push({ automationId: automation.id, success: false, error: 'Contact has no phone' });
              break;
            }

            // Tentar encontrar a conversa e instância
            let conversationId = deal.conversation_id;
            let instanceId: string | null = null;
            
            // Buscar conversa mais recente do contato
            if (!conversationId) {
              const { data: conv } = await supabase
                .from('conversations')
                .select('id, instance_id')
                .eq('contact_id', deal.contact_id)
                .eq('user_id', deal.user_id)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (conv) {
                conversationId = conv.id;
                instanceId = conv.instance_id;
              }
            } else {
              // Buscar instance_id da conversa existente
              const { data: existingConv } = await supabase
                .from('conversations')
                .select('instance_id')
                .eq('id', conversationId)
                .single();
              
              instanceId = existingConv?.instance_id || null;
            }
            
            // Se ainda não tem instância, usar a instância padrão conectada do usuário
            if (!instanceId) {
              const { data: defaultInstance } = await supabase
                .from('whatsapp_instances')
                .select('id')
                .eq('user_id', deal.user_id)
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle();
              
              instanceId = defaultInstance?.id || null;
            }
            
            if (!instanceId) {
              console.log(`[FUNNEL-AUTOMATIONS] Cannot send message - no connected WhatsApp instance`);
              results.push({ automationId: automation.id, success: false, error: 'No connected WhatsApp instance' });
              break;
            }

            // Buscar dados da instância
            const { data: instance, error: instanceError } = await supabase
              .from('whatsapp_instances')
              .select('instance_name, evolution_instance_name, status')
              .eq('id', instanceId)
              .single();
            
            if (instanceError || !instance || instance.status !== 'connected') {
              console.log(`[FUNNEL-AUTOMATIONS] Instance not connected or not found`);
              results.push({ automationId: automation.id, success: false, error: 'Instance not connected' });
              break;
            }

            // Formatar telefone
            let phone = deal.contact.phone.replace(/\D/g, '');
            const isLabelIdContact = deal.contact.phone.startsWith('LID_') || deal.contact.label_id;
            
            let remoteJid: string;
            if (isLabelIdContact) {
              remoteJid = `${deal.contact.label_id || phone}@lid`;
            } else {
              if (!phone.startsWith('55')) phone = '55' + phone;
              remoteJid = `${phone}@s.whatsapp.net`;
            }

            // Enviar via Evolution API
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            
            if (!evolutionApiUrl || !evolutionApiKey) {
              console.error(`[FUNNEL-AUTOMATIONS] Evolution API not configured`);
              results.push({ automationId: automation.id, success: false, error: 'Evolution API not configured' });
              break;
            }
            
            const evolutionName = instance.evolution_instance_name || instance.instance_name;
            
            const sendPayload = remoteJid.endsWith('@lid')
              ? { number: remoteJid.replace('@lid', ''), options: { presence: 'composing' }, text: message }
              : { number: phone, text: message };
            
            console.log(`[FUNNEL-AUTOMATIONS] Sending message to ${phone} via ${evolutionName}`);
            
            try {
              const response = await fetch(
                `${evolutionApiUrl}/message/sendText/${encodeURIComponent(evolutionName)}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey
                  },
                  body: JSON.stringify(sendPayload)
                }
              );

              const result = await response.json();
              
              if (response.ok && result.key) {
                // Criar registro da mensagem se tiver conversa
                if (conversationId) {
                  await supabase.from('inbox_messages').insert({
                    conversation_id: conversationId,
                    user_id: deal.user_id,
                    direction: 'outbound',
                    content: message,
                    message_type: 'text',
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    whatsapp_message_id: result.key.id
                  });
                  
                  await supabase.from('conversations').update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: message.substring(0, 100),
                    last_message_direction: 'outbound'
                  }).eq('id', conversationId);
                }
                
                console.log(`[FUNNEL-AUTOMATIONS] Message sent successfully: ${result.key.id}`);
                results.push({ automationId: automation.id, success: true });
              } else {
                console.error(`[FUNNEL-AUTOMATIONS] Failed to send message:`, result);
                results.push({ automationId: automation.id, success: false, error: result.message || 'Send failed' });
              }
            } catch (sendError) {
              console.error(`[FUNNEL-AUTOMATIONS] Error sending message:`, sendError);
              results.push({ automationId: automation.id, success: false, error: sendError instanceof Error ? sendError.message : 'Send error' });
            }
            break;
          }

          case 'send_template': {
            const templateId = actionConfig.template_id as string;
            console.log(`[FUNNEL-AUTOMATIONS] Would send template: ${templateId}`);
            // TODO: Integrate with template sending
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'send_form_link': {
            const formId = actionConfig.form_id as string;
            const messageTemplate = (actionConfig.message as string) || 'Olá {{nome}}! Por favor, preencha o formulário: {{link}}';
            const dynamicParams = (actionConfig.params as { key: string; value: string }[]) || [];

            if (!formId) {
              console.log(`[FUNNEL-AUTOMATIONS] Cannot send form link - no form selected`);
              results.push({ automationId: automation.id, success: false, error: 'No form selected' });
              break;
            }

            // Fetch form slug
            const { data: form, error: formError } = await supabase
              .from('forms')
              .select('slug, name')
              .eq('id', formId)
              .eq('status', 'published')
              .single();

            if (formError || !form) {
              console.log(`[FUNNEL-AUTOMATIONS] Form not found or not published: ${formId}`);
              results.push({ automationId: automation.id, success: false, error: 'Form not found or not published' });
              break;
            }

            // Verificar se temos contato com telefone
            if (!deal.contact?.phone) {
              console.log(`[FUNNEL-AUTOMATIONS] Cannot send form link - no contact phone`);
              results.push({ automationId: automation.id, success: false, error: 'Contact has no phone' });
              break;
            }

            // Resolve variables in params
            const resolvedParams = dynamicParams
              .filter(p => p.key && p.key.trim())
              .map(p => ({
                key: p.key.trim(),
                value: replaceVariables(p.value || '')
              }))
              .filter(p => p.value);

            // Build URL with path-based params
            const publicUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://clever-qr-share.lovable.app';
            const baseUrl = `${publicUrl}/form/${form.slug}`;
            const paramsPath = resolvedParams
              .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
              .join('/');
            
            const formUrl = paramsPath ? `${baseUrl}/${paramsPath}` : baseUrl;

            // Replace variables in message and insert link
            const message = replaceVariables(messageTemplate).replace(/\{\{link\}\}/g, formUrl);

            console.log(`[FUNNEL-AUTOMATIONS] Generated form link: ${formUrl}`);

            // Now send the message via WhatsApp (reuse send_message logic)
            let conversationId = deal.conversation_id;
            let instanceId: string | null = null;
            
            // Buscar conversa mais recente do contato
            if (!conversationId) {
              const { data: conv } = await supabase
                .from('conversations')
                .select('id, instance_id')
                .eq('contact_id', deal.contact_id)
                .eq('user_id', deal.user_id)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (conv) {
                conversationId = conv.id;
                instanceId = conv.instance_id;
              }
            } else {
              const { data: existingConv } = await supabase
                .from('conversations')
                .select('instance_id')
                .eq('id', conversationId)
                .single();
              
              instanceId = existingConv?.instance_id || null;
            }
            
            // Se ainda não tem instância, usar a instância padrão conectada do usuário
            if (!instanceId) {
              const { data: defaultInstance } = await supabase
                .from('whatsapp_instances')
                .select('id')
                .eq('user_id', deal.user_id)
                .eq('status', 'connected')
                .limit(1)
                .maybeSingle();
              
              instanceId = defaultInstance?.id || null;
            }
            
            if (!instanceId) {
              console.log(`[FUNNEL-AUTOMATIONS] Cannot send form link - no connected WhatsApp instance`);
              results.push({ automationId: automation.id, success: false, error: 'No connected WhatsApp instance' });
              break;
            }

            // Buscar dados da instância
            const { data: instance, error: instanceError } = await supabase
              .from('whatsapp_instances')
              .select('instance_name, evolution_instance_name, status')
              .eq('id', instanceId)
              .single();
            
            if (instanceError || !instance || instance.status !== 'connected') {
              console.log(`[FUNNEL-AUTOMATIONS] Instance not connected or not found for form link`);
              results.push({ automationId: automation.id, success: false, error: 'Instance not connected' });
              break;
            }

            // Formatar telefone
            let phone = deal.contact.phone.replace(/\D/g, '');
            const isLabelIdContact = deal.contact.phone.startsWith('LID_') || deal.contact.label_id;
            
            let remoteJid: string;
            if (isLabelIdContact) {
              remoteJid = `${deal.contact.label_id || phone}@lid`;
            } else {
              if (!phone.startsWith('55')) phone = '55' + phone;
              remoteJid = `${phone}@s.whatsapp.net`;
            }

            // Enviar via Evolution API
            const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
            const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
            
            if (!evolutionApiUrl || !evolutionApiKey) {
              console.error(`[FUNNEL-AUTOMATIONS] Evolution API not configured for form link`);
              results.push({ automationId: automation.id, success: false, error: 'Evolution API not configured' });
              break;
            }
            
            const evolutionName = instance.evolution_instance_name || instance.instance_name;
            
            const sendPayload = remoteJid.endsWith('@lid')
              ? { number: remoteJid.replace('@lid', ''), options: { presence: 'composing' }, text: message }
              : { number: phone, text: message };
            
            console.log(`[FUNNEL-AUTOMATIONS] Sending form link to ${phone} via ${evolutionName}`);
            
            try {
              const response = await fetch(
                `${evolutionApiUrl}/message/sendText/${encodeURIComponent(evolutionName)}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey
                  },
                  body: JSON.stringify(sendPayload)
                }
              );

              const result = await response.json();
              
              if (response.ok && result.key) {
                // Criar registro da mensagem se tiver conversa
                if (conversationId) {
                  await supabase.from('inbox_messages').insert({
                    conversation_id: conversationId,
                    user_id: deal.user_id,
                    direction: 'outbound',
                    content: message,
                    message_type: 'text',
                    status: 'sent',
                    sent_at: new Date().toISOString(),
                    whatsapp_message_id: result.key.id
                  });
                  
                  await supabase.from('conversations').update({
                    last_message_at: new Date().toISOString(),
                    last_message_preview: message.substring(0, 100),
                    last_message_direction: 'outbound'
                  }).eq('id', conversationId);
                }
                
                console.log(`[FUNNEL-AUTOMATIONS] Form link sent successfully: ${result.key.id}`);
                results.push({ automationId: automation.id, success: true });
              } else {
                console.error(`[FUNNEL-AUTOMATIONS] Failed to send form link:`, result);
                results.push({ automationId: automation.id, success: false, error: result.message || 'Send failed' });
              }
            } catch (sendError) {
              console.error(`[FUNNEL-AUTOMATIONS] Error sending form link:`, sendError);
              results.push({ automationId: automation.id, success: false, error: sendError instanceof Error ? sendError.message : 'Send error' });
            }
            break;
          }

          case 'add_tag': {
            const tagId = actionConfig.tag_id as string;
            const tagToAdd = actionConfig.tag_name as string;
            
            if (deal.contact_id && (tagId || tagToAdd)) {
              let finalTagId = tagId;
              
              // If we have tag_id, use it directly; otherwise find/create by name
              if (!finalTagId && tagToAdd) {
                const { data: existingTag } = await supabase
                  .from('tags')
                  .select('id')
                  .eq('user_id', deal.user_id)
                  .eq('name', tagToAdd)
                  .maybeSingle();

                if (existingTag) {
                  finalTagId = existingTag.id;
                } else {
                  const { data: newTag } = await supabase
                    .from('tags')
                    .insert({ user_id: deal.user_id, name: tagToAdd, color: '#3B82F6' })
                    .select('id')
                    .single();
                  finalTagId = newTag?.id;
                }
              }

              if (finalTagId) {
                const { error: upsertError } = await supabase
                  .from('contact_tags')
                  .upsert({ contact_id: deal.contact_id, tag_id: finalTagId }, { onConflict: 'contact_id,tag_id' });
                
                if (upsertError) {
                  console.error(`[FUNNEL-AUTOMATIONS] Error adding tag:`, upsertError);
                  results.push({ automationId: automation.id, success: false, error: upsertError.message });
                } else {
                  console.log(`[FUNNEL-AUTOMATIONS] Added tag: ${tagToAdd || tagId}`);
                  results.push({ automationId: automation.id, success: true });
                }
              } else {
                console.error(`[FUNNEL-AUTOMATIONS] Could not find or create tag`);
                results.push({ automationId: automation.id, success: false, error: 'Tag not found' });
              }
            } else {
              results.push({ automationId: automation.id, success: true });
            }
            break;
          }

          case 'remove_tag': {
            const removeTagId = actionConfig.tag_id as string;
            const removeTagName = actionConfig.tag_name as string;
            
            if (deal.contact_id && (removeTagId || removeTagName)) {
              let finalTagId = removeTagId;
              
              if (!finalTagId && removeTagName) {
                const { data: tagToRemove } = await supabase
                  .from('tags')
                  .select('id')
                  .eq('user_id', deal.user_id)
                  .eq('name', removeTagName)
                  .maybeSingle();
                
                finalTagId = tagToRemove?.id;
              }

              if (finalTagId) {
                await supabase
                  .from('contact_tags')
                  .delete()
                  .eq('contact_id', deal.contact_id)
                  .eq('tag_id', finalTagId);
                console.log(`[FUNNEL-AUTOMATIONS] Removed tag: ${removeTagName || removeTagId}`);
              }
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'move_stage': {
            const targetStageId = actionConfig.target_stage_id as string;
            if (targetStageId) {
              await supabase
                .from('funnel_deals')
                .update({ 
                  stage_id: targetStageId,
                  entered_stage_at: new Date().toISOString()
                })
                .eq('id', dealId);

              await supabase.from('funnel_deal_history').insert({
                deal_id: dealId,
                from_stage_id: deal.stage_id,
                to_stage_id: targetStageId,
                notes: `Movido automaticamente por: ${automation.name}`
              });

              console.log(`[FUNNEL-AUTOMATIONS] Moved deal to stage: ${targetStageId}`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'notify_user': {
            console.log(`[FUNNEL-AUTOMATIONS] User notification triggered for deal ${dealId}`);
            // TODO: Implement notification system
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'trigger_chatbot_flow': {
            const flowId = actionConfig.flow_id as string;
            if (flowId && deal.contact_id) {
              const { data: chatbotFlow, error: flowError } = await supabase
                .from('chatbot_flows')
                .select('id, name, is_active')
                .eq('id', flowId)
                .eq('is_active', true)
                .single();

              if (flowError || !chatbotFlow) {
                console.log(`[FUNNEL-AUTOMATIONS] Chatbot flow not found or inactive: ${flowId}`);
                results.push({ automationId: automation.id, success: false, error: 'Chatbot flow not found or inactive' });
                break;
              }

              const { error: execError } = await supabase.from('chatbot_executions').insert({
                flow_id: flowId,
                contact_id: deal.contact_id,
                deal_id: dealId,
                conversation_id: deal.conversation_id || null,
                user_id: deal.user_id,
                status: 'pending',
                trigger_source: 'funnel_automation',
                trigger_automation_id: automation.id,
                variables: {
                  deal_title: deal.title,
                  deal_value: deal.value,
                  contact_name: deal.contact?.name,
                  contact_phone: deal.contact?.phone,
                  funnel_name: deal.funnel?.name,
                  stage_name: deal.stage?.name
                }
              });

              if (execError) {
                console.error(`[FUNNEL-AUTOMATIONS] Error creating chatbot execution:`, execError);
                results.push({ automationId: automation.id, success: false, error: execError.message });
              } else {
                console.log(`[FUNNEL-AUTOMATIONS] Triggered chatbot flow: ${chatbotFlow.name} for contact ${deal.contact_id}`);
                results.push({ automationId: automation.id, success: true });
              }
            } else {
              results.push({ automationId: automation.id, success: false, error: 'Missing flow_id or contact_id' });
            }
            break;
          }

          case 'set_custom_field': {
            const fieldKey = actionConfig.field_key as string;
            const fieldValue = actionConfig.field_value as string;
            if (fieldKey && deal.contact_id) {
              const currentFields = deal.custom_fields || {};
              const updatedFields = { ...currentFields, [fieldKey]: fieldValue };
              
              await supabase
                .from('funnel_deals')
                .update({ custom_fields: updatedFields })
                .eq('id', dealId);
              
              console.log(`[FUNNEL-AUTOMATIONS] Set custom field ${fieldKey} = ${fieldValue}`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'set_deal_value': {
            const newDealValue = actionConfig.value as number;
            if (newDealValue !== undefined) {
              await supabase
                .from('funnel_deals')
                .update({ value: newDealValue })
                .eq('id', dealId);
              
              console.log(`[FUNNEL-AUTOMATIONS] Set deal value to ${newDealValue}`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'change_responsible': {
            const responsibleId = actionConfig.responsible_id as string;
            if (responsibleId) {
              // For now, log the change - in a full implementation, you'd update the deal's assigned user
              console.log(`[FUNNEL-AUTOMATIONS] Would change responsible to ${responsibleId}`);
              // TODO: Add assigned_to field to funnel_deals if needed
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'add_note': {
            const noteContent = replaceVariables((actionConfig.note_content as string) || '');
            if (noteContent && deal.contact_id) {
              await supabase.from('conversation_notes').insert({
                user_id: deal.user_id,
                contact_id: deal.contact_id,
                conversation_id: deal.conversation_id || null,
                content: noteContent
              });
              console.log(`[FUNNEL-AUTOMATIONS] Added note: ${noteContent.substring(0, 50)}...`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'webhook_request': {
            const webhookUrl = actionConfig.webhook_url as string;
            const method = (actionConfig.method as string) || 'POST';
            
            if (webhookUrl) {
              try {
                const webhookPayload = {
                  event: automation.trigger_type,
                  automation_name: automation.name,
                  deal: {
                    id: deal.id,
                    title: deal.title,
                    value: deal.value,
                    stage: deal.stage?.name,
                    funnel: deal.funnel?.name
                  },
                  contact: {
                    id: deal.contact_id,
                    name: deal.contact?.name,
                    phone: deal.contact?.phone,
                    email: deal.contact?.email
                  },
                  timestamp: new Date().toISOString()
                };

                const webhookResponse = await fetch(webhookUrl, {
                  method,
                  headers: { 'Content-Type': 'application/json' },
                  body: method !== 'GET' ? JSON.stringify(webhookPayload) : undefined
                });

                console.log(`[FUNNEL-AUTOMATIONS] Webhook response: ${webhookResponse.status}`);
                results.push({ automationId: automation.id, success: webhookResponse.ok });
              } catch (webhookError) {
                console.error(`[FUNNEL-AUTOMATIONS] Webhook error:`, webhookError);
                results.push({ automationId: automation.id, success: false, error: 'Webhook request failed' });
              }
            } else {
              results.push({ automationId: automation.id, success: false, error: 'Missing webhook_url' });
            }
            break;
          }

          case 'create_task': {
            const taskTitle = replaceVariables((actionConfig.task_title as string) || '');
            const taskDescription = replaceVariables((actionConfig.task_description as string) || '');
            const dueDays = (actionConfig.due_days as number) || 1;
            
            if (taskTitle) {
              const dueDate = new Date();
              dueDate.setDate(dueDate.getDate() + dueDays);
              
              await supabase.from('deal_tasks').insert({
                user_id: deal.user_id,
                deal_id: dealId,
                title: taskTitle,
                description: taskDescription,
                due_date: dueDate.toISOString().split('T')[0],
                priority: 'normal'
              });
              
              console.log(`[FUNNEL-AUTOMATIONS] Created task: ${taskTitle}`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'close_deal_won':
          case 'close_deal_lost': {
            const finalType = automation.action_type === 'close_deal_won' ? 'won' : 'lost';
            
            // Find the final stage of this type
            const { data: finalStage } = await supabase
              .from('funnel_stages')
              .select('id')
              .eq('funnel_id', deal.funnel_id)
              .eq('is_final', true)
              .eq('final_type', finalType)
              .single();
            
            if (finalStage) {
              await supabase
                .from('funnel_deals')
                .update({ 
                  stage_id: finalStage.id,
                  entered_stage_at: new Date().toISOString(),
                  closed_at: new Date().toISOString()
                })
                .eq('id', dealId);
              
              await supabase.from('funnel_deal_history').insert({
                deal_id: dealId,
                from_stage_id: deal.stage_id,
                to_stage_id: finalStage.id,
                notes: `Fechado automaticamente como ${finalType === 'won' ? 'ganho' : 'perdido'} por: ${automation.name}`
              });
              
              console.log(`[FUNNEL-AUTOMATIONS] Closed deal as ${finalType}`);
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'ai_analyze_and_move': {
            // Get intent mappings from config
            const intentMappings = (actionConfig.intent_mappings as Array<{ intent: string; target_stage_id: string }>) || [];
            const defaultStageId = actionConfig.default_stage_id as string || null;
            
            if (!messageContent) {
              console.log(`[FUNNEL-AUTOMATIONS] Skipping AI analysis - no message content`);
              results.push({ automationId: automation.id, success: false, error: 'No message content for AI analysis' });
              break;
            }

            if (intentMappings.length === 0 && !defaultStageId) {
              console.log(`[FUNNEL-AUTOMATIONS] Skipping AI analysis - no intent mappings configured`);
              results.push({ automationId: automation.id, success: false, error: 'No intent mappings configured' });
              break;
            }

            try {
              console.log(`[FUNNEL-AUTOMATIONS] Analyzing message with AI: "${messageContent.substring(0, 100)}..."`);
              
              // Build intents list for AI
              const intentsDescription = intentMappings.map(m => m.intent).join(', ');
              
              // Call Lovable AI to analyze intent
              const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
              
              if (!LOVABLE_API_KEY) {
                console.error(`[FUNNEL-AUTOMATIONS] LOVABLE_API_KEY not configured`);
                results.push({ automationId: automation.id, success: false, error: 'AI not configured' });
                break;
              }

              const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "system",
                      content: `Você é um analisador de intenções de mensagens de WhatsApp para um sistema de vendas/CRM.
                      
Analise a mensagem do cliente e identifique qual das seguintes intenções melhor descreve o que o cliente quer:
${intentMappings.map((m, i) => `${i + 1}. ${m.intent}`).join('\n')}

Responda APENAS com o número da intenção identificada (1, 2, 3, etc.) ou "0" se nenhuma intenção se aplicar.
Não adicione explicações, apenas o número.`
                    },
                    {
                      role: "user",
                      content: `Mensagem do cliente: "${messageContent}"`
                    }
                  ],
                }),
              });

              if (!aiResponse.ok) {
                const errorText = await aiResponse.text();
                console.error(`[FUNNEL-AUTOMATIONS] AI API error: ${aiResponse.status} - ${errorText}`);
                results.push({ automationId: automation.id, success: false, error: `AI error: ${aiResponse.status}` });
                break;
              }

              const aiData = await aiResponse.json();
              const aiResult = aiData.choices?.[0]?.message?.content?.trim() || "0";
              const intentIndex = parseInt(aiResult, 10);

              console.log(`[FUNNEL-AUTOMATIONS] AI detected intent index: ${intentIndex}`);

              let targetStageId: string | null = null;
              let intentMatched = "";

              if (intentIndex > 0 && intentIndex <= intentMappings.length) {
                targetStageId = intentMappings[intentIndex - 1].target_stage_id;
                intentMatched = intentMappings[intentIndex - 1].intent;
                console.log(`[FUNNEL-AUTOMATIONS] Matched intent: "${intentMatched}" -> stage ${targetStageId}`);
              } else if (defaultStageId) {
                targetStageId = defaultStageId;
                console.log(`[FUNNEL-AUTOMATIONS] No intent matched, using default stage: ${defaultStageId}`);
              }

              if (targetStageId && targetStageId !== deal.stage_id) {
                await supabase
                  .from('funnel_deals')
                  .update({ 
                    stage_id: targetStageId,
                    entered_stage_at: new Date().toISOString()
                  })
                  .eq('id', dealId);

                await supabase.from('funnel_deal_history').insert({
                  deal_id: dealId,
                  from_stage_id: deal.stage_id,
                  to_stage_id: targetStageId,
                  notes: intentMatched 
                    ? `Movido por IA (intenção detectada: "${intentMatched}"): ${automation.name}`
                    : `Movido por IA (etapa padrão): ${automation.name}`
                });

                console.log(`[FUNNEL-AUTOMATIONS] AI moved deal from ${deal.stage_id} to ${targetStageId}`);
                results.push({ automationId: automation.id, success: true });
              } else if (!targetStageId) {
                console.log(`[FUNNEL-AUTOMATIONS] AI analysis complete but no stage change needed`);
                results.push({ automationId: automation.id, success: true });
              } else {
                console.log(`[FUNNEL-AUTOMATIONS] Deal already in target stage, no action needed`);
                results.push({ automationId: automation.id, success: true });
              }
            } catch (aiError) {
              console.error(`[FUNNEL-AUTOMATIONS] AI analysis error:`, aiError);
              results.push({ automationId: automation.id, success: false, error: 'AI analysis failed' });
            }
            break;
          }

          default:
            console.log(`[FUNNEL-AUTOMATIONS] Unknown action type: ${automation.action_type}`);
            results.push({ automationId: automation.id, success: false, error: 'Unknown action type' });
        }
      } catch (actionError) {
        console.error(`[FUNNEL-AUTOMATIONS] Error executing automation ${automation.id}:`, actionError);
        results.push({ 
          automationId: automation.id, 
          success: false, 
          error: actionError instanceof Error ? actionError.message : 'Unknown error' 
        });
      }
    }

    console.log("[FUNNEL-AUTOMATIONS] Completed processing", results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[FUNNEL-AUTOMATIONS] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
