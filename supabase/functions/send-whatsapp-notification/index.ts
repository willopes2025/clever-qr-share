import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  type: 'new_message' | 'new_deal' | 'deal_stage_change' | 'deal_assigned' | 'task_due' | 'task_assigned' | 'calendly_event' | 'ai_handoff' | 'campaign_complete' | 'instance_disconnect';
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
      new_message: `📩 Nova mensagem de *${data.contactName || 'contato'}*${data.message ? `:\n"${data.message}"` : ''}`,
      new_deal: `🎯 Novo deal criado: *${data.dealTitle || 'Sem título'}*`,
      deal_stage_change: `📊 Deal *${data.dealTitle}* movido para *${data.stageName}*`,
      deal_assigned: `👤 Deal *${data.dealTitle}* atribuído a você`,
      task_due: `⏰ Tarefa vencida: *${data.taskTitle}*`,
      task_assigned: `📋 Nova tarefa atribuída: *${data.taskTitle}*`,
      calendly_event: `📅 Novo agendamento: *${data.contactName}*`,
      ai_handoff: `🤖 IA solicitou atendimento humano para *${data.contactName}*`,
      campaign_complete: `✅ Campanha *${data.campaignName}* finalizada`,
      instance_disconnect: `⚠️ Instância *${data.instanceName}* desconectou`,
    };

    const message = notificationMessages[type] || `Notificação: ${type}`;
    const notificationKey = `notify_${type.replace(/-/g, '_')}`;

    // Determine recipients
    let userIds: string[] = [];
    if (recipientUserId) {
      userIds = [recipientUserId];
    } else if (organizationUserIds && organizationUserIds.length > 0) {
      userIds = organizationUserIds;
    }

    if (userIds.length === 0) {
      console.log('No recipients specified');
      return new Response(
        JSON.stringify({ success: false, message: 'No recipients' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification preferences for all users
    const { data: preferences, error: prefError } = await supabase
      .from('notification_preferences')
      .select('*')
      .in('user_id', userIds);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
    }

    // Get profiles with phone numbers
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('id', userIds);

    if (profileError) {
      console.error('Error fetching profiles:', profileError);
    }

    // Also check team_members for phone
    const { data: teamMembers, error: tmError } = await supabase
      .from('team_members')
      .select('user_id, phone')
      .in('user_id', userIds);

    if (tmError) {
      console.error('Error fetching team members:', tmError);
    }

    const sentNotifications: string[] = [];
    const errors: string[] = [];

    for (const userId of userIds) {
      const pref = preferences?.find(p => p.user_id === userId);
      
      // Check if notification is enabled for this type
      if (pref && pref[notificationKey] === false) {
        console.log(`Notification ${type} disabled for user ${userId}`);
        continue;
      }

      // Get phone number (from profile or team_member)
      const profile = profiles?.find(p => p.id === userId);
      const teamMember = teamMembers?.find(tm => tm.user_id === userId);
      const phone = profile?.phone || teamMember?.phone;

      if (!phone) {
        console.log(`No phone number for user ${userId}`);
        continue;
      }

      // Get the instance to send from
      const instanceId = pref?.notification_instance_id;
      if (!instanceId) {
        console.log(`No notification instance configured for user ${userId}`);
        continue;
      }

      // Get instance name
      const { data: instance } = await supabase
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('id', instanceId)
        .single();

      if (!instance) {
        console.log(`Instance ${instanceId} not found`);
        continue;
      }

      // Format phone (remove non-digits, add country code if needed)
      let formattedPhone = phone.replace(/\D/g, '');
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Send via Evolution API
      try {
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
