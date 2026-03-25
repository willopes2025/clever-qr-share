import { createClient } from "npm:@supabase/supabase-js@2.84.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessPayload {
  automationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: ProcessPayload = await req.json();
    const { automationId } = payload;

    console.log("[EXISTING-DEALS-AUTOMATION] Starting for automation:", automationId);

    // Fetch the automation
    const { data: automation, error: autoError } = await supabase
      .from('funnel_automations')
      .select('*')
      .eq('id', automationId)
      .eq('is_active', true)
      .single();

    if (autoError || !automation) {
      console.error("[EXISTING-DEALS-AUTOMATION] Automation not found or inactive", autoError);
      return new Response(JSON.stringify({ error: "Automation not found or inactive" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow any trigger type - this function can be used to run any automation on existing deals

    // Fetch all active deals in the funnel
    let query = supabase
      .from('funnel_deals')
      .select(`
        *,
        contact:contacts(id, name, phone, email),
        stage:funnel_stages(id, name, is_final, final_type),
        funnel:funnels(id, name)
      `)
      .eq('funnel_id', automation.funnel_id)
      .is('closed_at', null); // Only open deals

    // If automation is stage-specific, filter by stage
    if (automation.stage_id) {
      query = query.eq('stage_id', automation.stage_id);
    }

    const { data: deals, error: dealsError } = await query;

    if (dealsError) {
      console.error("[EXISTING-DEALS-AUTOMATION] Error fetching deals", dealsError);
      throw dealsError;
    }

    console.log(`[EXISTING-DEALS-AUTOMATION] Found ${deals?.length || 0} deals to process`);

    const results: { dealId: string; success: boolean; error?: string }[] = [];
    const actionConfig = automation.action_config as Record<string, unknown> || {};
    const triggerConfig = automation.trigger_config as Record<string, unknown> || {};
    const automationConditions = (triggerConfig.conditions as Array<{ field: string; operator: string; value: string }>) || [];

    // Helper function to evaluate conditions
    const evaluateConditions = (deal: any): boolean => {
      if (automationConditions.length === 0) return true;
      
      for (const condition of automationConditions) {
        let fieldValue: string | undefined;
        
        if (condition.field === 'contact_name') {
          fieldValue = deal.contact?.name || '';
        } else if (condition.field === 'contact_email') {
          fieldValue = deal.contact?.email || '';
        } else if (condition.field === 'deal_value') {
          fieldValue = deal.value?.toString() || '';
        } else if (condition.field === 'deal_title') {
          fieldValue = deal.title || '';
        } else if (condition.field.startsWith('custom:')) {
          const key = condition.field.replace('custom:', '');
          const customFields = (deal.custom_fields || {}) as Record<string, unknown>;
          fieldValue = customFields[key]?.toString() || '';
        } else if (condition.field.startsWith('contact_custom:')) {
          const key = condition.field.replace('contact_custom:', '');
          const contactCustomFields = (deal.contact?.custom_fields || {}) as Record<string, unknown>;
          fieldValue = contactCustomFields[key]?.toString() || '';
        }

        const fv = (fieldValue || '').toLowerCase();
        const cv = (condition.value || '').toLowerCase();
        let conditionMet = false;
        
        switch (condition.operator) {
          case 'equals': conditionMet = fv === cv; break;
          case 'not_equals': conditionMet = fv !== cv; break;
          case 'contains': conditionMet = fv.includes(cv); break;
          case 'not_empty': conditionMet = fv.length > 0; break;
          case 'empty': conditionMet = fv.length === 0; break;
        }

        if (!conditionMet) {
          console.log(`[EXISTING-DEALS-AUTOMATION] Condition not met for deal ${deal.id}: ${condition.field} ${condition.operator} ${condition.value} (actual: "${fieldValue}")`);
          return false;
        }
      }
      return true;
    };

    // Helper function to replace variables
    const replaceVariables = (text: string, deal: typeof deals[0]): string => {
      return text
        .replace(/\{\{nome\}\}/g, deal.contact?.name || 'Cliente')
        .replace(/\{\{telefone\}\}/g, deal.contact?.phone || '')
        .replace(/\{\{email\}\}/g, deal.contact?.email || '')
        .replace(/\{\{valor\}\}/g, deal.value?.toString() || '0')
        .replace(/\{\{funil\}\}/g, deal.funnel?.name || '')
        .replace(/\{\{etapa\}\}/g, deal.stage?.name || '')
        .replace(/\{\{titulo\}\}/g, deal.title || '');
    };

    // Filter deals by conditions
    const filteredDeals = (deals || []).filter(evaluateConditions);
    console.log(`[EXISTING-DEALS-AUTOMATION] ${filteredDeals.length} deals match conditions`);

    // Process each deal
    for (const deal of filteredDeals) {
      try {
        switch (automation.action_type) {
          case 'add_tag': {
            const tagId = actionConfig.tag_id as string;
            const tagToAdd = actionConfig.tag_name as string;
            
            if (deal.contact_id && (tagId || tagToAdd)) {
              let finalTagId = tagId;
              
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
                  results.push({ dealId: deal.id, success: false, error: upsertError.message });
                } else {
                  results.push({ dealId: deal.id, success: true });
                }
              }
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
              }
            }
            results.push({ dealId: deal.id, success: true });
            break;
          }

          case 'move_stage': {
            const targetStageId = actionConfig.target_stage_id as string;
            if (targetStageId && deal.stage_id !== targetStageId) {
              await supabase
                .from('funnel_deals')
                .update({ 
                  stage_id: targetStageId,
                  entered_stage_at: new Date().toISOString()
                })
                .eq('id', deal.id);

              await supabase.from('funnel_deal_history').insert({
                deal_id: deal.id,
                from_stage_id: deal.stage_id,
                to_stage_id: targetStageId,
                notes: `Movido automaticamente por: ${automation.name}`
              });
            }
            results.push({ dealId: deal.id, success: true });
            break;
          }

          case 'set_custom_field': {
            const fieldKey = actionConfig.field_key as string;
            const fieldValue = actionConfig.field_value as string;
            if (fieldKey) {
              const currentFields = deal.custom_fields || {};
              const updatedFields = { ...currentFields, [fieldKey]: fieldValue };
              
              await supabase
                .from('funnel_deals')
                .update({ custom_fields: updatedFields })
                .eq('id', deal.id);
            }
            results.push({ dealId: deal.id, success: true });
            break;
          }

          case 'set_deal_value': {
            const newDealValue = actionConfig.value as number;
            if (newDealValue !== undefined) {
              await supabase
                .from('funnel_deals')
                .update({ value: newDealValue })
                .eq('id', deal.id);
            }
            results.push({ dealId: deal.id, success: true });
            break;
          }

          case 'add_note': {
            const noteContent = replaceVariables((actionConfig.note_content as string) || '', deal);
            if (noteContent && deal.contact_id) {
              await supabase.from('conversation_notes').insert({
                user_id: deal.user_id,
                contact_id: deal.contact_id,
                conversation_id: deal.conversation_id || null,
                content: noteContent
              });
            }
            results.push({ dealId: deal.id, success: true });
            break;
          }

          case 'trigger_chatbot_flow': {
            const flowId = actionConfig.flow_id as string;
            if (flowId && deal.contact_id) {
              const { error: execError } = await supabase.from('chatbot_executions').insert({
                flow_id: flowId,
                contact_id: deal.contact_id,
                deal_id: deal.id,
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

              results.push({ dealId: deal.id, success: !execError, error: execError?.message });
            }
            break;
          }

          case 'move_to_funnel': {
            const targetFunnelId = actionConfig.target_funnel_id as string;
            const targetStageId = actionConfig.target_stage_id as string;

            if (!targetFunnelId) {
              results.push({ dealId: deal.id, success: false, error: 'No target funnel' });
              break;
            }

            let finalTargetStageId = targetStageId;
            if (!finalTargetStageId) {
              const { data: firstStage } = await supabase
                .from('funnel_stages')
                .select('id')
                .eq('funnel_id', targetFunnelId)
                .order('display_order', { ascending: true })
                .limit(1)
                .single();
              finalTargetStageId = firstStage?.id;
            }

            if (!finalTargetStageId) {
              results.push({ dealId: deal.id, success: false, error: 'Target funnel has no stages' });
              break;
            }

            const { error: newDealError } = await supabase
              .from('funnel_deals')
              .insert({
                funnel_id: targetFunnelId,
                stage_id: finalTargetStageId,
                contact_id: deal.contact_id,
                user_id: deal.user_id,
                title: deal.title,
                value: deal.value,
                custom_fields: deal.custom_fields,
                conversation_id: deal.conversation_id,
                entered_stage_at: new Date().toISOString()
              });

            if (newDealError) {
              results.push({ dealId: deal.id, success: false, error: newDealError.message });
            } else {
              // Close original deal
              const { data: lostStage } = await supabase
                .from('funnel_stages')
                .select('id')
                .eq('funnel_id', deal.funnel_id)
                .eq('is_final', true)
                .limit(1)
                .maybeSingle();

              if (lostStage) {
                await supabase
                  .from('funnel_deals')
                  .update({ 
                    stage_id: lostStage.id,
                    entered_stage_at: new Date().toISOString(),
                    closed_at: new Date().toISOString()
                  })
                  .eq('id', deal.id);
              }

              console.log(`[EXISTING-DEALS-AUTOMATION] Moved deal ${deal.id} to funnel ${targetFunnelId}`);
              results.push({ dealId: deal.id, success: true });
            }
            break;
          }

          default:
            results.push({ dealId: deal.id, success: true });
        }
      } catch (error) {
        console.error(`[EXISTING-DEALS-AUTOMATION] Error processing deal ${deal.id}:`, error);
        results.push({ dealId: deal.id, success: false, error: String(error) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    console.log(`[EXISTING-DEALS-AUTOMATION] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      success: true, 
      processed: filteredDeals.length,
      results: {
        success: successCount,
        errors: errorCount
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[EXISTING-DEALS-AUTOMATION] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
