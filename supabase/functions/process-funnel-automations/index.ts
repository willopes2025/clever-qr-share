import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: AutomationPayload = await req.json();
    const { dealId, fromStageId, toStageId, triggerType, messageContent, tagName, customFieldKey, customFieldValue } = payload;

    console.log("[FUNNEL-AUTOMATIONS] Processing automation", payload);

    // Fetch deal with funnel and stage info
    const { data: deal, error: dealError } = await supabase
      .from('funnel_deals')
      .select(`
        *,
        contact:contacts(id, name, phone, email),
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
      return text
        .replace(/\{\{nome\}\}/g, deal.contact?.name || 'Cliente')
        .replace(/\{\{telefone\}\}/g, deal.contact?.phone || '')
        .replace(/\{\{email\}\}/g, deal.contact?.email || '')
        .replace(/\{\{valor\}\}/g, deal.value?.toString() || '0')
        .replace(/\{\{funil\}\}/g, deal.funnel?.name || '')
        .replace(/\{\{etapa\}\}/g, deal.stage?.name || '')
        .replace(/\{\{titulo\}\}/g, deal.title || '');
    };

    // Process each automation
    for (const automation of automations || []) {
      try {
        // Check if automation applies to this stage
        if (automation.stage_id && automation.stage_id !== toStageId && automation.stage_id !== fromStageId) {
          console.log(`[FUNNEL-AUTOMATIONS] Skipping automation ${automation.id} - stage mismatch`);
          continue;
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
            let message = replaceVariables((actionConfig.message as string) || '');
            console.log(`[FUNNEL-AUTOMATIONS] Would send message: ${message.substring(0, 50)}...`);
            // TODO: Integrate with send message function when instance is available
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'send_template': {
            const templateId = actionConfig.template_id as string;
            console.log(`[FUNNEL-AUTOMATIONS] Would send template: ${templateId}`);
            // TODO: Integrate with template sending
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'add_tag': {
            const tagToAdd = actionConfig.tag_name as string;
            if (tagToAdd && deal.contact_id) {
              // Find or create tag
              let { data: tag } = await supabase
                .from('tags')
                .select('id')
                .eq('user_id', deal.user_id)
                .eq('name', tagToAdd)
                .single();

              if (!tag) {
                const { data: newTag } = await supabase
                  .from('tags')
                  .insert({ user_id: deal.user_id, name: tagToAdd })
                  .select('id')
                  .single();
                tag = newTag;
              }

              if (tag) {
                await supabase
                  .from('contact_tags')
                  .upsert({ contact_id: deal.contact_id, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
                console.log(`[FUNNEL-AUTOMATIONS] Added tag: ${tagToAdd}`);
              }
            }
            results.push({ automationId: automation.id, success: true });
            break;
          }

          case 'remove_tag': {
            const removeTagName = actionConfig.tag_name as string;
            if (removeTagName && deal.contact_id) {
              const { data: tagToRemove } = await supabase
                .from('tags')
                .select('id')
                .eq('user_id', deal.user_id)
                .eq('name', removeTagName)
                .single();

              if (tagToRemove) {
                await supabase
                  .from('contact_tags')
                  .delete()
                  .eq('contact_id', deal.contact_id)
                  .eq('tag_id', tagToRemove.id);
                console.log(`[FUNNEL-AUTOMATIONS] Removed tag: ${removeTagName}`);
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
