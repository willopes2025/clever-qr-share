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
    if (executionId) {
      // Resuming existing execution
      const { data } = await supabase
        .from('chatbot_executions')
        .select('*')
        .eq('id', executionId)
        .single();
      execution = data;

      if (execution && inputValue !== undefined) {
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

      switch (node.type) {
        case 'start':
        case 'trigger': {
          currentId = getNextNode(node.id);
          break;
        }

        case 'message': {
          // Check if message node has a delay before sending
          const msgDelay = node.data?.delay ? parseInt(String(node.data.delay)) : 0;
          if (msgDelay > 0) {
            // If delay exceeds safe execution time (50s), schedule for later
            if (msgDelay > 50) {
              const resumeAt = new Date(Date.now() + msgDelay * 1000).toISOString();
              await supabase
                .from('chatbot_executions')
                .update({ 
                  status: 'scheduled', 
                  current_node_id: node.id,
                  variables: { ...(execution.variables || {}), _msg_delay_done: false },
                  scheduled_resume_at: resumeAt,
                })
                .eq('id', execution.id);
              console.log(`[FLOW] Message delay ${msgDelay}s too long, scheduled resume at ${resumeAt}`);
              currentId = null;
              break;
            }
            await new Promise(r => setTimeout(r, msgDelay * 1000));
          }

          const text = substituteVars(node.data?.message || node.data?.text || '');
          if (text) {
            await sendMessage(text);
            // Small delay between consecutive messages
            await new Promise(r => setTimeout(r, 1500));
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
          
          if (actionType === 'add_tag' && node.data?.tagId) {
            await supabase.from('contact_tags').upsert({
              contact_id: contactId,
              tag_id: node.data.tagId,
            }, { onConflict: 'contact_id,tag_id' });
          } else if (actionType === 'move_funnel' && node.data?.stageId) {
            // Move deal to specified stage
            const { data: deal } = await supabase
              .from('funnel_deals')
              .select('id')
              .eq('contact_id', contactId)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (deal) {
              await supabase
                .from('funnel_deals')
                .update({ stage_id: node.data.stageId })
                .eq('id', deal.id);
            }
          } else if (actionType === 'transfer_human') {
            // Mark conversation as needing human handoff
            await supabase
              .from('conversations')
              .update({ ai_handoff_requested: true, ai_handled: false })
              .eq('id', conversationId);
          }

          currentId = getNextNode(node.id);
          break;
        }

        case 'delay': {
          // Read duration + unit from the builder (duration in the chosen unit)
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
                variables: { ...(execution.variables || {}), _delay_done: true },
                scheduled_resume_at: resumeAt,
              })
              .eq('id', execution.id);
            console.log(`[FLOW] Delay too long (${delaySeconds}s), scheduled resume at ${resumeAt}`);
            currentId = null; // Stop processing, will be resumed by cron
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
