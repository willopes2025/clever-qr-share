import { createClient } from "npm:@supabase/supabase-js@2";

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

    const { flowId, conversationId, contactId, userId, executionId, currentNodeId, inputValue } = await req.json();

    if (!flowId || !conversationId || !contactId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load conversation to get instance info
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id, instance_id')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get instance info for sending messages
    let instanceName = '';
    if (conversation.instance_id) {
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name, evolution_instance_name')
        .eq('id', conversation.instance_id)
        .single();
      instanceName = instance?.evolution_instance_name || instance?.instance_name || '';
    }

    // Load contact info for variable substitution
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .eq('id', contactId)
      .single();

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

    // Helper: substitute variables in text
    const substituteVars = (text: string): string => {
      if (!text) return '';
      return text
        .replace(/\{\{nome\}\}/gi, contact?.name || '')
        .replace(/\{\{name\}\}/gi, contact?.name || '')
        .replace(/\{\{telefone\}\}/gi, contact?.phone || '')
        .replace(/\{\{phone\}\}/gi, contact?.phone || '')
        .replace(/\{\{email\}\}/gi, contact?.email || '')
        .replace(/\{\{(\w+)\}\}/g, (_, key) => execution?.variables?.[key] || '');
    };

    // Helper: get next node from edges
    const getNextNode = (nodeId: string, handle?: string): string | null => {
      const edge = edges?.find((e: any) => {
        if (e.source_node_id !== nodeId) return false;
        if (handle && e.source_handle) return e.source_handle === handle;
        return true;
      });
      return edge?.target_node_id || null;
    };

    // Helper: send WhatsApp message
    const sendMessage = async (text: string) => {
      if (!instanceName || !contact?.phone) {
        console.log('[FLOW] Cannot send message - no instance or phone');
        return;
      }

      try {
        // Send via Evolution API
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

        // Save message to inbox
        await supabase.from('inbox_messages').insert({
          user_id: userId,
          conversation_id: conversationId,
          content: text,
          direction: 'outbound',
          status: 'sent',
          message_type: 'text',
          whatsapp_message_id: whatsappMessageId,
          sent_at: new Date().toISOString(),
        });

        // Update conversation preview
        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: text.substring(0, 100),
            last_message_direction: 'outbound',
          })
          .eq('id', conversationId);

        console.log('[FLOW] Message sent:', text.substring(0, 50));
      } catch (err) {
        console.error('[FLOW] Error sending message:', err);
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
      const isInputNode = node.type === 'question' || node.type === 'list_message';
      if (!isInputNode) {
        await logNodeExecution(node.id, node.type, 'processed');
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
                if (tpl.media_url && tpl.media_type && instanceName && contact?.phone) {
                  // Send media first
                  const mediaEndpoint = tpl.media_type === 'image' ? 'sendMedia' : tpl.media_type === 'video' ? 'sendMedia' : 'sendMedia';
                  await fetch(`${evolutionApiUrl}/message/sendMedia/${instanceName}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                    body: JSON.stringify({
                      number: contact.phone,
                      mediatype: tpl.media_type,
                      media: tpl.media_url,
                      caption: tplText || undefined,
                    }),
                  });
                  await supabase.from('inbox_messages').insert({
                    user_id: userId, conversation_id: conversationId,
                    content: tplText || '', direction: 'outbound', status: 'sent',
                    message_type: tpl.media_type, media_url: tpl.media_url,
                    sent_at: new Date().toISOString(),
                  });
                } else if (tplText) {
                  await sendMessage(tplText);
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
                const { data: metaCfg } = await supabase
                  .from('meta_whatsapp_config')
                  .select('credentials')
                  .eq('user_id', userId)
                  .single();

                const accessToken = (metaCfg?.credentials as any)?.access_token;
                if (accessToken) {
                  const formattedPhone = contact.phone.replace(/[^0-9]/g, '');
                  const components: any[] = [];
                  const bodyExamples = metaTemplate.body_examples || [];
                  if (bodyExamples.length > 0) {
                    const resolvedVars = bodyExamples.map((ex: string) => {
                      return ex
                        .replace(/\{\{nome\}\}/gi, contact?.name || '')
                        .replace(/\{\{telefone\}\}/gi, contact?.phone || '')
                        .replace(/\{\{email\}\}/gi, contact?.email || '');
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
                  console.log('[FLOW] Meta template sent:', result);

                  // Save to inbox
                  const previewText = metaTemplate.body_text || `[Template: ${metaTemplate.name}]`;
                  await supabase.from('inbox_messages').insert({
                    user_id: userId, conversation_id: conversationId,
                    content: previewText, direction: 'outbound', status: 'sent',
                    message_type: 'template',
                    sent_at: new Date().toISOString(),
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
            // Plain text message
            const text = substituteVars(node.data?.message || node.data?.text || '');
            if (text) {
              await sendMessage(text);
              await new Promise(r => setTimeout(r, 1500));
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
          // AI-based or simple conditions
          const variable = execution.variables?.[node.data?.variable] || execution.variables?.['_last_input'] || '';
          const conditionValue = node.data?.value || '';
          const operator = node.data?.operator || 'contains';

          let conditionMet = false;
          switch (operator) {
            case 'equals': conditionMet = variable.toLowerCase() === conditionValue.toLowerCase(); break;
            case 'contains': conditionMet = variable.toLowerCase().includes(conditionValue.toLowerCase()); break;
            case 'not_contains': conditionMet = !variable.toLowerCase().includes(conditionValue.toLowerCase()); break;
            default: conditionMet = true;
          }

          currentId = getNextNode(node.id, conditionMet ? 'true' : 'false');
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

                // Get access token from meta_whatsapp_config
                const { data: metaConfig } = await supabase
                  .from('meta_whatsapp_config')
                  .select('credentials')
                  .eq('user_id', userId)
                  .single();

                const accessToken = (metaConfig?.credentials as any)?.access_token;
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
          }

          currentId = getNextNode(node.id);
          break;
        }

        case 'list_message': {
          // Send WhatsApp interactive list message
          const header = substituteVars(node.data?.header || '');
          const body = substituteVars(node.data?.body || '');
          const buttonText = node.data?.buttonText || 'Ver opções';
          const items = (node.data?.items as Array<{ title: string; description?: string }>) || [];

          if (instanceName && contact?.phone && items.length > 0) {
            try {
              const listPayload = {
                number: contact.phone,
                title: header,
                description: body,
                buttonText: buttonText,
                footerText: '',
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

              let result: any;
              try { result = await response.json(); } catch { result = {}; }
              const whatsappMessageId = result?.key?.id || null;

              await supabase.from('inbox_messages').insert({
                user_id: userId,
                conversation_id: conversationId,
                content: `${body}\n\n📋 ${items.map(i => `• ${i.title}`).join('\n')}`,
                direction: 'outbound',
                status: 'sent',
                message_type: 'text',
                whatsapp_message_id: whatsappMessageId,
                sent_at: new Date().toISOString(),
              });

              await supabase.from('conversations').update({
                last_message_at: new Date().toISOString(),
                last_message_preview: body.substring(0, 100),
                last_message_direction: 'outbound',
              }).eq('id', conversationId);

              console.log('[FLOW] List message sent');
            } catch (err) {
              console.error('[FLOW] Error sending list message:', err);
            }
          }

          // Wait for user selection
          await supabase
            .from('chatbot_executions')
            .update({ status: 'waiting_input', current_node_id: node.id })
            .eq('id', execution.id);
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
          // Distribute conversation to team members in rotation
          const members = (node.data?.members as string[]) || [];
          if (members.length > 0) {
            // Simple round-robin based on timestamp
            const index = Math.floor(Date.now() / 1000) % members.length;
            const assignedMember = members[index];
            
            // Try to find the member's user_id from profiles
            const { data: memberProfile } = await supabase
              .from('profiles')
              .select('id')
              .ilike('full_name', `%${assignedMember}%`)
              .maybeSingle();

            if (memberProfile) {
              await supabase
                .from('conversations')
                .update({ assigned_to: memberProfile.id })
                .eq('id', conversationId);
              console.log(`[FLOW] Round robin assigned to: ${assignedMember} (${memberProfile.id})`);
            } else {
              console.log(`[FLOW] Round robin member not found: ${assignedMember}`);
            }
          }
          currentId = getNextNode(node.id);
          break;
        }

        case 'delay': {
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
