import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const automationId = url.searchParams.get('automation_id');
    const token = url.searchParams.get('token');

    console.log(`[WEBHOOK] Received webhook for automation: ${automationId}`);

    if (!automationId) {
      console.error('[WEBHOOK] Missing automation_id');
      return new Response(
        JSON.stringify({ error: 'Missing automation_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the automation
    const { data: automation, error: automationError } = await supabase
      .from('funnel_automations')
      .select('*, funnels!inner(id, name, user_id)')
      .eq('id', automationId)
      .eq('trigger_type', 'on_webhook')
      .eq('is_active', true)
      .single();

    if (automationError || !automation) {
      console.error('[WEBHOOK] Automation not found or not active:', automationError);
      return new Response(
        JSON.stringify({ error: 'Automation not found, inactive, or not configured for webhooks' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate security token if configured
    const triggerConfig = automation.trigger_config || {};
    const configuredToken = triggerConfig.security_token;
    
    if (configuredToken && configuredToken !== token) {
      console.error('[WEBHOOK] Invalid security token');
      return new Response(
        JSON.stringify({ error: 'Invalid security token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload
    let payload: Record<string, unknown> = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      try {
        payload = await req.json();
      } catch {
        console.log('[WEBHOOK] No JSON body or invalid JSON');
      }
    }

    console.log('[WEBHOOK] Payload received:', JSON.stringify(payload));

    const { contact_phone, contact_id, deal_id, custom_data } = payload as {
      contact_phone?: string;
      contact_id?: string;
      deal_id?: string;
      custom_data?: Record<string, unknown>;
    };

    // Find the deal based on payload
    let deal = null;
    const userId = automation.funnels.user_id;

    if (deal_id) {
      const { data } = await supabase
        .from('funnel_deals')
        .select('*, contacts(*), funnel_stages(*)')
        .eq('id', deal_id)
        .eq('user_id', userId)
        .single();
      deal = data;
    } else if (contact_id) {
      const { data } = await supabase
        .from('funnel_deals')
        .select('*, contacts(*), funnel_stages(*)')
        .eq('contact_id', contact_id)
        .eq('funnel_id', automation.funnel_id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      deal = data;
    } else if (contact_phone) {
      // Normalize phone
      const normalizedPhone = contact_phone.replace(/\D/g, '');
      
      // Find contact by phone
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .or(`phone.eq.${normalizedPhone},phone.eq.+${normalizedPhone},phone.like.%${normalizedPhone}`)
        .limit(1)
        .maybeSingle();

      if (contact) {
        const { data } = await supabase
          .from('funnel_deals')
          .select('*, contacts(*), funnel_stages(*)')
          .eq('contact_id', contact.id)
          .eq('funnel_id', automation.funnel_id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        deal = data;
      }
    }

    if (!deal) {
      console.error('[WEBHOOK] No deal found for the provided identifiers');
      return new Response(
        JSON.stringify({ 
          error: 'No deal found', 
          message: 'Could not find a deal matching the provided contact_phone, contact_id, or deal_id' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[WEBHOOK] Found deal:', deal.id);

    // Execute the action based on action_type
    const actionConfig = automation.action_config || {};
    const actionType = automation.action_type;
    let actionResult: Record<string, unknown> = { action: actionType, success: true };

    switch (actionType) {
      case 'move_stage': {
        const targetStageId = actionConfig.target_stage_id;
        if (targetStageId) {
          const { error } = await supabase
            .from('funnel_deals')
            .update({ 
              stage_id: targetStageId, 
              entered_stage_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);
          if (error) throw error;
          actionResult.moved_to_stage = targetStageId;
        }
        break;
      }

      case 'set_deal_value': {
        const value = actionConfig.value;
        if (value !== undefined) {
          const { error } = await supabase
            .from('funnel_deals')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('id', deal.id);
          if (error) throw error;
          actionResult.new_value = value;
        }
        break;
      }

      case 'set_custom_field': {
        const fieldKey = actionConfig.field_key;
        let fieldValue = actionConfig.field_value;
        
        // Use custom_data from webhook if field_value contains placeholder
        if (custom_data && typeof fieldValue === 'string' && fieldValue.includes('{{')) {
          for (const [key, val] of Object.entries(custom_data)) {
            fieldValue = fieldValue.replace(`{{${key}}}`, String(val));
          }
        }
        
        if (fieldKey) {
          const currentFields = deal.custom_fields || {};
          const { error } = await supabase
            .from('funnel_deals')
            .update({ 
              custom_fields: { ...currentFields, [fieldKey]: fieldValue },
              updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);
          if (error) throw error;
          actionResult.field_updated = { [fieldKey]: fieldValue };
        }
        break;
      }

      case 'add_note': {
        let noteContent = actionConfig.note_content || 'Webhook recebido';
        
        // Replace variables
        noteContent = noteContent
          .replace(/\{\{nome\}\}/g, deal.contacts?.name || '')
          .replace(/\{\{valor\}\}/g, String(deal.value || 0))
          .replace(/\{\{etapa\}\}/g, deal.funnel_stages?.name || '');
        
        if (custom_data) {
          for (const [key, val] of Object.entries(custom_data)) {
            noteContent = noteContent.replace(`{{${key}}}`, String(val));
          }
        }

        const { error } = await supabase
          .from('conversation_notes')
          .insert({
            user_id: userId,
            contact_id: deal.contact_id,
            content: noteContent,
            is_pinned: false
          });
        if (error) throw error;
        actionResult.note_added = true;
        break;
      }

      case 'add_tag': {
        const tagName = actionConfig.tag_name;
        if (tagName && deal.contact_id) {
          // Get or create tag
          let { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .eq('name', tagName)
            .maybeSingle();

          if (!existingTag) {
            const { data: newTag } = await supabase
              .from('tags')
              .insert({ user_id: userId, name: tagName, color: '#3B82F6' })
              .select('id')
              .single();
            existingTag = newTag;
          }

          if (existingTag) {
            await supabase
              .from('contact_tags')
              .upsert({ contact_id: deal.contact_id, tag_id: existingTag.id });
            actionResult.tag_added = tagName;
          }
        }
        break;
      }

      case 'remove_tag': {
        const tagName = actionConfig.tag_name;
        if (tagName && deal.contact_id) {
          const { data: existingTag } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .eq('name', tagName)
            .maybeSingle();

          if (existingTag) {
            await supabase
              .from('contact_tags')
              .delete()
              .eq('contact_id', deal.contact_id)
              .eq('tag_id', existingTag.id);
            actionResult.tag_removed = tagName;
          }
        }
        break;
      }

      case 'create_task': {
        const taskTitle = actionConfig.task_title || 'Tarefa do webhook';
        const taskDescription = actionConfig.task_description || '';
        const dueDays = actionConfig.due_days || 1;

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Number(dueDays));

        const { error } = await supabase
          .from('deal_tasks')
          .insert({
            user_id: userId,
            deal_id: deal.id,
            title: taskTitle,
            description: taskDescription,
            due_date: dueDate.toISOString().split('T')[0],
            priority: 'normal'
          });
        if (error) throw error;
        actionResult.task_created = taskTitle;
        break;
      }

      case 'close_deal_won':
      case 'close_deal_lost': {
        const finalType = actionType === 'close_deal_won' ? 'won' : 'lost';
        const { data: finalStage } = await supabase
          .from('funnel_stages')
          .select('id')
          .eq('funnel_id', automation.funnel_id)
          .eq('is_final', true)
          .eq('final_type', finalType)
          .maybeSingle();

        if (finalStage) {
          const { error } = await supabase
            .from('funnel_deals')
            .update({
              stage_id: finalStage.id,
              closed_at: new Date().toISOString(),
              entered_stage_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', deal.id);
          if (error) throw error;
          actionResult.closed_as = finalType;
        }
        break;
      }

      case 'webhook_request': {
        const webhookUrl = actionConfig.webhook_url;
        const method = actionConfig.method || 'POST';
        
        if (webhookUrl) {
          const webhookPayload = {
            deal: {
              id: deal.id,
              title: deal.title,
              value: deal.value,
              stage: deal.funnel_stages?.name
            },
            contact: {
              id: deal.contacts?.id,
              name: deal.contacts?.name,
              phone: deal.contacts?.phone,
              email: deal.contacts?.email
            },
            funnel: {
              id: automation.funnel_id,
              name: automation.funnels.name
            },
            custom_data,
            triggered_at: new Date().toISOString()
          };

          await fetch(webhookUrl, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
          });
          actionResult.webhook_sent = webhookUrl;
        }
        break;
      }

      default:
        actionResult.message = `Action type '${actionType}' executed`;
    }

    console.log('[WEBHOOK] Action executed:', actionResult);

    return new Response(
      JSON.stringify({
        success: true,
        automation_id: automationId,
        deal_id: deal.id,
        action_result: actionResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
