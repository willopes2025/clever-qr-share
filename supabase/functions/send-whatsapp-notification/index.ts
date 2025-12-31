import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'test' | 'new_message' | 'new_deal' | 'deal_stage_change' | 'deal_assigned' | 'task_due' | 'task_assigned' | 'task_created' | 'task_updated' | 'task_deleted' | 'calendly_event' | 'ai_handoff' | 'campaign_complete' | 'instance_disconnect' | 'internal_chat';
  data: {
    dealId?: string;
    conversationId?: string;
    taskId?: string;
    campaignId?: string;
    instanceId?: string;
    contactName?: string;
    dealTitle?: string;
    stageName?: string;
    taskTitle?: string;
    campaignName?: string;
    instanceName?: string;
    message?: string;
    senderName?: string;
    internalMessageId?: string;
  };
  recipientUserId?: string;
  organizationUserIds?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Evolution API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { type, data, recipientUserId, organizationUserIds }: NotificationRequest = await req.json();

    console.log('Processing notification:', { type, data, recipientUserId });

    // Build notification message based on type
    const notificationMessages: Record<string, string> = {
      test: `✅ *Teste de notificação*\n\nSe você recebeu esta mensagem, suas notificações estão funcionando corretamente!`,
      new_message: `📩 Nova mensagem de *${data.contactName || 'contato'}*${data.message ? `:\n"${data.message}"` : ''}`,
      new_deal: `🎯 Novo deal criado: *${data.dealTitle || 'Sem título'}*`,
      deal_stage_change: `📊 Deal *${data.dealTitle}* movido para *${data.stageName}*`,
      deal_assigned: `👤 Deal *${data.dealTitle}* atribuído a você`,
      task_created: `📋 Nova tarefa criada: *${data.taskTitle}*`,
      task_assigned: `📋 Tarefa atribuída a você: *${data.taskTitle}*`,
      task_updated: `✏️ Tarefa atualizada: *${data.taskTitle}*`,
      task_deleted: `🗑️ Tarefa excluída: *${data.taskTitle}*`,
      task_due: `⏰ Tarefa vencida: *${data.taskTitle}*`,
      calendly_event: `📅 Novo agendamento: *${data.contactName}*`,
      ai_handoff: `🤖 IA solicitou atendimento humano para *${data.contactName}*`,
      campaign_complete: `✅ Campanha *${data.campaignName}* finalizada`,
      instance_disconnect: `⚠️ Instância *${data.instanceName}* desconectou`,
      internal_chat: `💬 *[Chat Interno - ${data.contactName || 'Conversa'}]*\nDe: *${data.senderName}*\n\n${data.message}\n\n_Responda esta mensagem para enviar ao chat interno._`,
    };

    const message = notificationMessages[type] || `Notificação: ${type}`;
    const notificationKey = `notify_${type.replace(/-/g, '_')}`;

    // Determine recipients - automatically fetch responsible based on type
    let userIds: string[] = [];
    
    // If type is task-related and no recipientUserId is provided, fetch from task
    if (type.startsWith('task_') && data.taskId && !recipientUserId) {
      console.log('Fetching task responsible for task:', data.taskId);
      
      // Check both conversation_tasks and deal_tasks
      const { data: convTask } = await supabase
        .from('conversation_tasks')
        .select('assigned_to, user_id')
        .eq('id', data.taskId)
        .maybeSingle();
      
      if (convTask) {
        // Use assigned_to if available, otherwise use user_id (creator)
        userIds = [convTask.assigned_to || convTask.user_id].filter(Boolean);
        console.log('Found conversation task responsible:', userIds);
      } else {
        // Try deal_tasks
        const { data: dealTask } = await supabase
          .from('deal_tasks')
          .select('assigned_to, user_id')
          .eq('id', data.taskId)
          .maybeSingle();
        
        if (dealTask) {
          userIds = [dealTask.assigned_to || dealTask.user_id].filter(Boolean);
          console.log('Found deal task responsible:', userIds);
        }
      }
    }
    
    // If type is deal-related and no recipientUserId is provided, fetch responsible_id
    if (type.startsWith('deal_') && data.dealId && !recipientUserId && userIds.length === 0) {
      console.log('Fetching deal responsible for deal:', data.dealId);
      
      const { data: deal } = await supabase
        .from('funnel_deals')
        .select('responsible_id, user_id')
        .eq('id', data.dealId)
        .maybeSingle();
      
      if (deal) {
        // Use responsible_id if available, otherwise use user_id (creator)
        userIds = [deal.responsible_id || deal.user_id].filter(Boolean);
        console.log('Found deal responsible:', userIds);
      }
    }
    
    // If type is inbox-related (new_message or ai_handoff), fetch assigned_to + organization admins
    if ((type === 'new_message' || type === 'ai_handoff') && data.conversationId && !recipientUserId && userIds.length === 0) {
      console.log('Fetching conversation recipients:', data.conversationId);
      
      const { data: conv } = await supabase
        .from('conversations')
        .select('user_id, assigned_to, instance_id')
        .eq('id', data.conversationId)
        .maybeSingle();
      
      if (conv) {
        console.log('Conversation data:', conv);
        
        // 1. Add assigned_to (responsible for the lead) if exists
        if (conv.assigned_to) {
          userIds.push(conv.assigned_to);
          console.log('Added assigned_to:', conv.assigned_to);
        }
        
        // If still no recipients, fallback to conversation owner
        if (userIds.length === 0) {
          userIds = [conv.user_id];
          console.log('Fallback to conversation owner:', conv.user_id);
        }
        
        // Remove duplicates
        userIds = [...new Set(userIds)];
        console.log('Final unique recipients:', userIds);
      }
    }
    
    // Fallback to provided recipientUserId or organizationUserIds
    if (userIds.length === 0) {
      if (recipientUserId) {
        userIds = [recipientUserId];
      } else if (organizationUserIds && organizationUserIds.length > 0) {
        userIds = organizationUserIds;
      }
    }

    if (userIds.length === 0) {
      console.log('No recipients determined');
      return new Response(
        JSON.stringify({ success: false, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Final recipients:', userIds);

    // Get notification preferences for all users
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', userIds);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
    }

    // Get team members with phone for all users - this is the source of phone numbers
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('user_id, phone, organization_id')
      .in('user_id', userIds)
      .eq('status', 'active');

    if (tmError) {
      console.error('Error fetching team members:', tmError);
    }

    console.log('Team members found:', teamMembers);

    const sentNotifications: string[] = [];
    const errors: string[] = [];

    for (const userId of userIds) {
      const pref = preferences?.find(p => p.user_id === userId);
      
      // Check if notification is enabled for this type
      if (pref && pref[notificationKey] === false) {
        console.log(`Notification ${type} disabled for user ${userId}`);
        continue;
      }

      // Get team member for this user (for phone and organization)
      const teamMember = teamMembers?.find(tm => tm.user_id === userId);
      
      if (!teamMember) {
        console.log(`No team member found for user ${userId}`);
        continue;
      }

      const phone = teamMember.phone;
      if (!phone) {
        console.log(`No phone number for user ${userId}`);
        continue;
      }

      // Get the organization's notification instance
      if (!teamMember.organization_id) {
        console.log(`No organization for user ${userId}`);
        continue;
      }

      const { data: organization } = await supabase
        .from('organizations')
        .select('notification_instance_id')
        .eq('id', teamMember.organization_id)
        .maybeSingle();

      if (!organization?.notification_instance_id) {
        console.log(`No notification instance configured for organization ${teamMember.organization_id}`);
        continue;
      }

      // Get instance name
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('id', organization.notification_instance_id)
        .maybeSingle();

      if (!instance) {
        console.log(`Instance ${organization.notification_instance_id} not found`);
        continue;
      }

      // Format phone (remove non-digits, add country code if needed)
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Send via Evolution API
      try {
        console.log(`Sending notification to ${formattedPhone} via instance ${instance.instance_name}`);
        
        const response = await fetch(`${evolutionApiUrl}/message/sendText/${instance.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: formattedPhone,
            text: message,
          }),
        });

        const result = await response.json();

        // Log the notification
        await supabase.from('notification_log').insert({
          user_id: userId,
          notification_type: type,
          message,
          sent_to_phone: formattedPhone,
          related_id: data.dealId || data.conversationId || data.taskId || data.campaignId || data.instanceId,
          status: response.ok ? 'sent' : 'failed',
          error_message: response.ok ? null : JSON.stringify(result),
        });

        if (response.ok) {
          sentNotifications.push(userId);
          console.log(`Notification sent to ${formattedPhone}`);
        } else {
          errors.push(`Failed for user ${userId}: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error sending to ${userId}:`, error);
        errors.push(`Error for user ${userId}: ${errorMessage}`);

        await supabase.from('notification_log').insert({
          user_id: userId,
          notification_type: type,
          message,
          sent_to_phone: formattedPhone,
          status: 'error',
          error_message: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentNotifications.length,
        errors: errors.length,
        details: { sent: sentNotifications, errors },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-whatsapp-notification:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
