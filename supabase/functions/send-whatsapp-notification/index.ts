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

// Check if current time is within the user's notification schedule
function isWithinSchedule(
  scheduleDays: number[],
  startTime: string,
  endTime: string,
  timezone: string = 'America/Sao_Paulo'
): boolean {
  try {
    const now = new Date();
    
    // Get current day and time in user's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const dayName = parts.find(p => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
    
    // Map day name to number (0 = Sunday, 6 = Saturday)
    const dayMap: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const currentDay = dayMap[dayName || 'Mon'] ?? 1;
    
    // Check if today is in scheduled days
    if (!scheduleDays.includes(currentDay)) {
      return false;
    }
    
    // Parse start and end times
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const currentMinutes = hour * 60 + minute;
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch (error) {
    console.error('Error checking schedule:', error);
    return true; // Default to allowing if there's an error
  }
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

    // ============================================
    // UNIFIED FUNCTION TO RESOLVE RESPONSIBLE USER
    // ============================================
    const resolveResponsibleUserId = async (notificationType: string, notificationData: any): Promise<string | null> => {
      // For tasks: check assigned_to, then fallback to deal/conversation responsible, then creator
      if (notificationType.startsWith('task_') && notificationData.taskId) {
        // Try conversation_tasks first
        const { data: convTask } = await supabase
          .from('conversation_tasks')
          .select('assigned_to, user_id, conversation_id')
          .eq('id', notificationData.taskId)
          .maybeSingle();
        
        if (convTask) {
          // 1. If task has an assignee, use it
          if (convTask.assigned_to) {
            console.log('Task responsible from assigned_to:', convTask.assigned_to);
            return convTask.assigned_to;
          }
          // 2. If task is linked to a conversation, try conversation's assigned_to
          if (convTask.conversation_id) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('assigned_to')
              .eq('id', convTask.conversation_id)
              .maybeSingle();
            if (conv?.assigned_to) {
              console.log('Task responsible from conversation.assigned_to:', conv.assigned_to);
              return conv.assigned_to;
            }
          }
          // 3. Fallback to task creator
          console.log('Task responsible from user_id (creator):', convTask.user_id);
          return convTask.user_id;
        }
        
        // Try deal_tasks
        const { data: dealTask } = await supabase
          .from('deal_tasks')
          .select('assigned_to, user_id, deal_id')
          .eq('id', notificationData.taskId)
          .maybeSingle();
        
        if (dealTask) {
          // 1. If task has an assignee, use it
          if (dealTask.assigned_to) {
            console.log('Deal task responsible from assigned_to:', dealTask.assigned_to);
            return dealTask.assigned_to;
          }
          // 2. If task is linked to a deal, try deal's responsible or conversation's assigned_to
          if (dealTask.deal_id) {
            const { data: deal } = await supabase
              .from('funnel_deals')
              .select('responsible_id, user_id, conversation_id')
              .eq('id', dealTask.deal_id)
              .maybeSingle();
            if (deal) {
              if (deal.responsible_id) {
                console.log('Deal task responsible from deal.responsible_id:', deal.responsible_id);
                return deal.responsible_id;
              }
              // Try conversation's assigned_to
              if (deal.conversation_id) {
                const { data: conv } = await supabase
                  .from('conversations')
                  .select('assigned_to')
                  .eq('id', deal.conversation_id)
                  .maybeSingle();
                if (conv?.assigned_to) {
                  console.log('Deal task responsible from conversation.assigned_to:', conv.assigned_to);
                  return conv.assigned_to;
                }
              }
              // Fallback to deal creator
              console.log('Deal task responsible from deal.user_id:', deal.user_id);
              return deal.user_id;
            }
          }
          // 3. Fallback to task creator
          console.log('Deal task responsible from user_id (creator):', dealTask.user_id);
          return dealTask.user_id;
        }
        
        return null;
      }
      
      // For deals: check responsible_id, then conversation's assigned_to, then creator
      if ((notificationType.startsWith('deal_') || notificationType === 'new_deal') && notificationData.dealId) {
        const { data: deal } = await supabase
          .from('funnel_deals')
          .select('responsible_id, user_id, conversation_id')
          .eq('id', notificationData.dealId)
          .maybeSingle();
        
        if (deal) {
          // 1. If deal has a responsible, use it
          if (deal.responsible_id) {
            console.log('Deal responsible from responsible_id:', deal.responsible_id);
            return deal.responsible_id;
          }
          // 2. If deal is linked to a conversation, try conversation's assigned_to
          if (deal.conversation_id) {
            const { data: conv } = await supabase
              .from('conversations')
              .select('assigned_to')
              .eq('id', deal.conversation_id)
              .maybeSingle();
            if (conv?.assigned_to) {
              console.log('Deal responsible from conversation.assigned_to:', conv.assigned_to);
              return conv.assigned_to;
            }
          }
          // 3. Fallback to deal creator
          console.log('Deal responsible from user_id (creator):', deal.user_id);
          return deal.user_id;
        }
        return null;
      }
      
      // For conversations/messages: use assigned_to or fallback to owner
      if ((notificationType === 'new_message' || notificationType === 'ai_handoff') && notificationData.conversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('assigned_to, user_id')
          .eq('id', notificationData.conversationId)
          .maybeSingle();
        
        if (conv) {
          if (conv.assigned_to) {
            console.log('Conversation responsible from assigned_to:', conv.assigned_to);
            return conv.assigned_to;
          }
          console.log('Conversation responsible from user_id (owner):', conv.user_id);
          return conv.user_id;
        }
        return null;
      }
      
      return null;
    };

    // Determine recipients using unified function
    let userIds: string[] = [];
    
    // If type is task-related and no recipientUserId is provided, fetch from task
    if (type.startsWith('task_') && data.taskId && !recipientUserId) {
      console.log('Resolving responsible for task:', data.taskId);
      const responsibleId = await resolveResponsibleUserId(type, data);
      if (responsibleId) {
        userIds = [responsibleId];
        console.log('Task responsible resolved to:', responsibleId);
      }
    }
    
    // If type is deal-related and no recipientUserId is provided, fetch responsible_id
    if ((type.startsWith('deal_') || type === 'new_deal') && data.dealId && !recipientUserId && userIds.length === 0) {
      console.log('Resolving responsible for deal:', data.dealId);
      const responsibleId = await resolveResponsibleUserId(type, data);
      if (responsibleId) {
        userIds = [responsibleId];
        console.log('Deal responsible resolved to:', responsibleId);
      }
    }
    
    // If type is inbox-related (new_message or ai_handoff), fetch assigned_to
    if ((type === 'new_message' || type === 'ai_handoff') && data.conversationId && !recipientUserId && userIds.length === 0) {
      console.log('Resolving responsible for conversation:', data.conversationId);
      const responsibleId = await resolveResponsibleUserId(type, data);
      if (responsibleId) {
        userIds = [responsibleId];
        console.log('Conversation responsible resolved to:', responsibleId);
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
        JSON.stringify({ success: false, message: 'No recipients', skipped: { no_recipients: 1 } }),
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

    // Get profiles as fallback for phone numbers
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    console.log('Profiles found:', profiles);

    // Default preferences for users without explicit configuration
    const defaultPrefs = {
      notify_new_message: true,
      notify_new_deal: true,
      notify_deal_stage_change: true,
      notify_deal_assigned: true,
      notify_task_due: true,
      notify_task_assigned: true,
      notify_task_created: true,
      notify_task_updated: true,
      notify_task_deleted: true,
      notify_calendly_event: true,
      notify_ai_handoff: true,
      notify_campaign_complete: true,
      notify_instance_disconnect: true,
      notify_internal_chat: true,
      only_if_responsible: true, // Default: receive notifications when responsible
      schedule_enabled: false,
      schedule_days: [1, 2, 3, 4, 5],
      schedule_start_time: '08:00',
      schedule_end_time: '18:00',
    };

    // Helper function to check if user is responsible for the resource (using unified logic)
    const checkIfUserIsResponsible = async (userId: string, notificationType: string, notificationData: any): Promise<boolean> => {
      const responsibleId = await resolveResponsibleUserId(notificationType, notificationData);
      
      // If we couldn't determine responsible, allow (for types like campaign, instance, etc.)
      if (responsibleId === null) {
        console.log(`Could not determine responsible for ${notificationType}, allowing notification`);
        return true;
      }
      
      const isResponsible = responsibleId === userId;
      console.log(`checkIfUserIsResponsible: userId=${userId}, responsibleId=${responsibleId}, isResponsible=${isResponsible}`);
      return isResponsible;
    };

    const sentNotifications: string[] = [];
    const queuedNotifications: string[] = [];
    const errors: string[] = [];
    const skipped: { 
      pref_disabled: string[]; 
      opted_out: string[]; 
      not_responsible: string[]; 
      missing_phone: string[];
      no_team_member: string[];
      no_organization: string[];
      no_instance: string[];
    } = {
      pref_disabled: [],
      opted_out: [],
      not_responsible: [],
      missing_phone: [],
      no_team_member: [],
      no_organization: [],
      no_instance: [],
    };

    for (const userId of userIds) {
      const pref = preferences?.find(p => p.user_id === userId);
      
      // Use default preferences if user has no explicit preferences
      const effectivePrefs = pref || defaultPrefs;
      
      // Check if notification is enabled for this type
      const prefKey = notificationKey as keyof typeof defaultPrefs;
      if (effectivePrefs[prefKey] === false) {
        console.log(`Notification ${type} disabled for user ${userId}`);
        skipped.pref_disabled.push(userId);
        continue;
      }

      // Check only_if_responsible filter
      // If only_if_responsible = true (default): receive notification when responsible
      // If only_if_responsible = false: user opted out, do NOT send notification
      const onlyIfResponsible = effectivePrefs.only_if_responsible ?? true;
      
      if (!onlyIfResponsible) {
        console.log(`User ${userId} has only_if_responsible=false, opted out of responsibility-based notifications, skipping`);
        skipped.opted_out.push(userId);
        continue;
      }
      
      // User wants notifications when responsible, check if they are
      const isResponsible = await checkIfUserIsResponsible(userId, type, data);
      if (!isResponsible) {
        console.log(`User ${userId} is not responsible for ${type}, skipping`);
        skipped.not_responsible.push(userId);
        continue;
      }
      console.log(`User ${userId} is responsible for ${type}, proceeding with notification`);

      // Get team member for this user (for phone and organization)
      const teamMember = teamMembers?.find(tm => tm.user_id === userId);
      
      if (!teamMember) {
        console.log(`No team member found for user ${userId}`);
        skipped.no_team_member.push(userId);
        continue;
      }

      // Try to get phone from team_members, fallback to profiles
      let phone = teamMember.phone;
      if (!phone) {
        const profile = profiles?.find(p => p.id === userId);
        phone = profile?.phone || null;
        if (phone) {
          console.log(`Using phone from profiles for user ${userId}: ${phone}`);
        }
      }

      if (!phone) {
        console.log(`No phone number for user ${userId} (checked team_members and profiles)`);
        skipped.missing_phone.push(userId);
        
        // Log to notification_log as failed with missing_phone error
        await supabase.from('notification_log').insert({
          user_id: userId,
          notification_type: type,
          message,
          sent_to_phone: null,
          related_id: data.dealId || data.conversationId || data.taskId || data.campaignId || data.instanceId,
          status: 'failed',
          error_message: 'missing_phone: Telefone não cadastrado em team_members nem profiles',
        });
        
        continue;
      }

      // Get the organization's notification instance
      if (!teamMember.organization_id) {
        console.log(`No organization for user ${userId}`);
        skipped.no_organization.push(userId);
        continue;
      }

      const { data: organization } = await supabase
        .from('organizations')
        .select('notification_instance_id')
        .eq('id', teamMember.organization_id)
        .maybeSingle();

      if (!organization?.notification_instance_id) {
        console.log(`No notification instance configured for organization ${teamMember.organization_id}`);
        skipped.no_instance.push(userId);
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
        skipped.no_instance.push(userId);
        continue;
      }

      // Format phone (remove non-digits, add country code if needed)
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Check if schedule is enabled and if we're within the schedule
      // Use effective preferences (defaults if no explicit prefs)
      const scheduleEnabled = effectivePrefs.schedule_enabled ?? false;
      const scheduleDays = (pref?.schedule_days as number[] | null) ?? [1, 2, 3, 4, 5];
      const scheduleStartTime = (pref?.schedule_start_time as string | null) ?? '08:00';
      const scheduleEndTime = (pref?.schedule_end_time as string | null) ?? '18:00';

      if (scheduleEnabled && !isWithinSchedule(scheduleDays, scheduleStartTime, scheduleEndTime)) {
        console.log(`Outside schedule for user ${userId}, queueing notification`);
        
        // Queue the notification for later
        const { error: queueError } = await supabase
          .from('notification_queue')
          .insert({
            user_id: userId,
            organization_id: teamMember.organization_id,
            notification_type: type,
            notification_data: data,
            message,
            phone: formattedPhone,
            instance_name: instance.instance_name,
          });

        if (queueError) {
          console.error('Error queueing notification:', queueError);
          errors.push(`Failed to queue for user ${userId}: ${queueError.message}`);
        } else {
          queuedNotifications.push(userId);
          console.log(`Notification queued for user ${userId}`);
        }
        
        continue;
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

    // Build skipped summary
    const skippedSummary = {
      pref_disabled: skipped.pref_disabled.length,
      opted_out: skipped.opted_out.length,
      not_responsible: skipped.not_responsible.length,
      missing_phone: skipped.missing_phone.length,
      no_team_member: skipped.no_team_member.length,
      no_organization: skipped.no_organization.length,
      no_instance: skipped.no_instance.length,
    };

    console.log('Notification processing complete:', {
      sent: sentNotifications.length,
      queued: queuedNotifications.length,
      errors: errors.length,
      skipped: skippedSummary,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentNotifications.length,
        queued: queuedNotifications.length,
        errors: errors.length,
        skipped: skippedSummary,
        details: { 
          sent: sentNotifications, 
          queued: queuedNotifications, 
          errors,
          skipped,
        },
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
