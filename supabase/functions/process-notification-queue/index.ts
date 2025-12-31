import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Group notifications by type for summary
function groupNotifications(notifications: any[]): Record<string, number> {
  const groups: Record<string, number> = {};
  
  for (const n of notifications) {
    const type = n.notification_type;
    groups[type] = (groups[type] || 0) + 1;
  }
  
  return groups;
}

// Build summary message
function buildSummaryMessage(groups: Record<string, number>): string {
  const typeLabels: Record<string, string> = {
    new_message: 'novas mensagens',
    new_deal: 'novos deals',
    deal_stage_change: 'movimentações de deal',
    deal_assigned: 'deals atribuídos',
    task_created: 'tarefas criadas',
    task_assigned: 'tarefas atribuídas',
    task_updated: 'tarefas atualizadas',
    task_deleted: 'tarefas excluídas',
    task_due: 'tarefas vencidas',
    calendly_event: 'agendamentos Calendly',
    ai_handoff: 'solicitações de atendimento humano',
    campaign_complete: 'campanhas finalizadas',
    instance_disconnect: 'desconexões de instância',
    internal_chat: 'mensagens do chat interno',
  };

  const lines: string[] = [];
  let total = 0;
  
  for (const [type, count] of Object.entries(groups)) {
    const label = typeLabels[type] || type;
    lines.push(`• ${count} ${label}`);
    total += count;
  }
  
  return `📬 *Resumo de Notificações*\n\nVocê teve ${total} notificação${total > 1 ? 's' : ''} enquanto estava fora do horário configurado:\n\n${lines.join('\n')}\n\n_Acesse o sistema para mais detalhes._`;
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

    console.log('Processing notification queue...');

    // Get all pending notifications grouped by user
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending notifications:', fetchError);
      throw fetchError;
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      console.log('No pending notifications');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${pendingNotifications.length} pending notifications`);

    // Group by user_id
    const userNotifications: Record<string, any[]> = {};
    for (const n of pendingNotifications) {
      if (!userNotifications[n.user_id]) {
        userNotifications[n.user_id] = [];
      }
      userNotifications[n.user_id].push(n);
    }

    const processedUsers: string[] = [];
    const skippedUsers: string[] = [];
    const errors: string[] = [];

    for (const [userId, notifications] of Object.entries(userNotifications)) {
      // Get user's notification preferences
      const { data: pref } = await supabase
        .from('notification_preferences')
        .select('schedule_enabled, schedule_days, schedule_start_time, schedule_end_time')
        .eq('user_id', userId)
        .maybeSingle();

      // Check if we're now within the user's schedule
      const scheduleEnabled = pref?.schedule_enabled ?? false;
      const scheduleDays = pref?.schedule_days ?? [1, 2, 3, 4, 5];
      const scheduleStartTime = pref?.schedule_start_time ?? '08:00';
      const scheduleEndTime = pref?.schedule_end_time ?? '18:00';

      if (scheduleEnabled && !isWithinSchedule(scheduleDays, scheduleStartTime, scheduleEndTime)) {
        console.log(`Still outside schedule for user ${userId}, skipping`);
        skippedUsers.push(userId);
        continue;
      }

      // We're now within schedule, send the summary
      const firstNotification = notifications[0];
      const phone = firstNotification.phone;
      const instanceName = firstNotification.instance_name;

      // Build summary message
      const groups = groupNotifications(notifications);
      const summaryMessage = buildSummaryMessage(groups);

      try {
        console.log(`Sending summary to ${phone} via ${instanceName}`);

        const response = await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            number: phone,
            text: summaryMessage,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`Summary sent to user ${userId}`);
          
          // Mark all notifications as processed
          const notificationIds = notifications.map(n => n.id);
          await supabase
            .from('notification_queue')
            .update({ 
              processed: true, 
              processed_at: new Date().toISOString() 
            })
            .in('id', notificationIds);

          // Log the summary notification
          await supabase.from('notification_log').insert({
            user_id: userId,
            notification_type: 'queue_summary',
            message: summaryMessage,
            sent_to_phone: phone,
            status: 'sent',
          });

          processedUsers.push(userId);
        } else {
          console.error(`Failed to send summary to user ${userId}:`, result);
          errors.push(`Failed for user ${userId}: ${JSON.stringify(result)}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error sending summary to ${userId}:`, error);
        errors.push(`Error for user ${userId}: ${errorMessage}`);
      }
    }

    console.log(`Processed ${processedUsers.length} users, skipped ${skippedUsers.length}, errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedUsers.length,
        skipped: skippedUsers.length,
        errors: errors.length,
        details: { processed: processedUsers, skipped: skippedUsers, errors },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in process-notification-queue:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
