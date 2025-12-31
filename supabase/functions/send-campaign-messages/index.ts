import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default rate limiting configuration
const DEFAULT_INTERVAL_MIN_S = 90;
const DEFAULT_INTERVAL_MAX_S = 180;
const DEFAULT_DAILY_LIMIT = 1000;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const DEFAULT_ALLOWED_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// Generate a random delay between min and max (inclusive) in seconds
const getRandomDelay = (minS: number, maxS: number): number => {
  return Math.floor(Math.random() * (maxS - minS + 1)) + minS;
};

// Get day abbreviation from date
const getDayAbbreviation = (date: Date): string => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[date.getDay()];
};

// Check if current time is within allowed sending hours
const isWithinAllowedTime = (
  startHour: number,
  endHour: number,
  allowedDays: string[],
  timezone: string
): { allowed: boolean; nextAllowedTime: Date | null; delayMinutes: number } => {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to get current time parts in the specified timezone
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  };
  const timeFormatter = new Intl.DateTimeFormat('en-US', timeOptions);
  const timeParts = timeFormatter.formatToParts(now);
  const currentHour = parseInt(timeParts.find(p => p.type === 'hour')?.value || '0');
  const currentMinute = parseInt(timeParts.find(p => p.type === 'minute')?.value || '0');
  
  // Get day of week in the specified timezone
  const dayOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'short',
  };
  const dayFormatter = new Intl.DateTimeFormat('en-US', dayOptions);
  const currentDay = dayFormatter.format(now).toLowerCase().substring(0, 3);
  
  console.log(`Current time check: hour=${currentHour}:${currentMinute}, day=${currentDay}, allowed hours=${startHour}-${endHour}, allowed days=${allowedDays.join(',')}, timezone=${timezone}`);
  
  // Check if today is an allowed day
  const isDayAllowed = allowedDays.includes(currentDay);
  
  // Check if current hour is within allowed range
  const isHourAllowed = currentHour >= startHour && currentHour < endHour;
  
  if (isDayAllowed && isHourAllowed) {
    return { allowed: true, nextAllowedTime: null, delayMinutes: 0 };
  }
  
  // Calculate delay in minutes until next allowed time
  let delayMinutes = 0;
  
  if (isDayAllowed && currentHour < startHour) {
    // Today is allowed, but before start hour - calculate minutes until startHour
    delayMinutes = (startHour - currentHour) * 60 - currentMinute;
  } else {
    // Either today is not allowed or we're past end hour
    // Calculate minutes remaining until midnight
    const minutesUntilMidnight = (24 - currentHour) * 60 - currentMinute;
    
    // Find next allowed day
    let daysToAdd = 1;
    const maxDaysToCheck = 7;
    
    for (let i = 1; i <= maxDaysToCheck; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);
      const checkDay = dayFormatter.format(checkDate).toLowerCase().substring(0, 3);
      
      if (allowedDays.includes(checkDay)) {
        daysToAdd = i;
        break;
      }
    }
    
    // Total delay = minutes until midnight + (days - 1) * 24 hours + start hour
    delayMinutes = minutesUntilMidnight + ((daysToAdd - 1) * 24 * 60) + (startHour * 60);
  }
  
  // Ensure delay is always positive and at least 1 minute
  delayMinutes = Math.max(delayMinutes, 1);
  
  // Calculate next allowed time based on delay
  const nextAllowed = new Date(now.getTime() + delayMinutes * 60 * 1000);
  
  console.log(`Calculated delay: ${delayMinutes} minutes until ${nextAllowed.toISOString()}`);
  
  return { allowed: false, nextAllowedTime: nextAllowed, delayMinutes };
};

interface CampaignMessage {
  id: string;
  campaign_id: string;
  contact_id: string;
  phone: string;
  contact_name: string | null;
  message_content: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

interface Instance {
  id: string;
  instance_name: string;
  warming_level: number;
}

interface CampaignSettings {
  message_interval_min: number;
  message_interval_max: number;
  daily_limit: number;
  allowed_start_hour: number;
  allowed_end_hour: number;
  allowed_days: string[];
  timezone: string;
}

type SendingMode = 'sequential' | 'random' | 'warming';

// Maximum safe delay to avoid edge function timeout (50 seconds to have margin)
const MAX_SAFE_DELAY_SECONDS = 50;

// Function to schedule the next message execution with chunked delays
const scheduleNextMessage = async (
  supabaseUrl: string,
  supabaseServiceKey: string,
  campaignId: string,
  instances: Instance[],
  sendingMode: SendingMode,
  messageIndex: number,
  delaySeconds: number,
  remainingDelay: number = 0
) => {
  const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
  
  // If delay is larger than safe limit, use chunked approach
  if (delaySeconds > MAX_SAFE_DELAY_SECONDS) {
    console.log(`Delay ${delaySeconds}s exceeds safe limit. Using chunked approach...`);
    
    // Invoke immediately with remainingDelay to continue waiting
    try {
      const response = await fetch(sendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({
          campaignId,
          instances,
          sendingMode,
          messageIndex,
          remainingDelay: delaySeconds // Pass full delay as remaining
        })
      });
      
      if (!response.ok) {
        console.error(`Failed to schedule chunked delay: ${response.status}`);
      } else {
        console.log(`Scheduled chunked delay for campaign ${campaignId}`);
      }
    } catch (error) {
      console.error('Error scheduling chunked delay:', error);
    }
    return;
  }
  
  console.log(`Scheduling next message (index ${messageIndex}) in ${delaySeconds} seconds...`);
  
  // Wait for the delay before invoking the next call
  await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  
  // Re-invoke this function for the next message
  try {
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        campaignId,
        instances,
        sendingMode,
        messageIndex
      })
    });
    
    if (!response.ok) {
      console.error(`Failed to schedule next message: ${response.status} ${response.statusText}`);
    } else {
      console.log(`Successfully scheduled next message for campaign ${campaignId}`);
    }
  } catch (error) {
    console.error('Error scheduling next message:', error);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    
    // Handle chunked delay - if we're waiting for remaining delay
    if (body.remainingDelay && body.remainingDelay > 0) {
      const remainingDelay = body.remainingDelay;
      const safeDelay = Math.min(remainingDelay, MAX_SAFE_DELAY_SECONDS);
      
      console.log(`Chunked delay: waiting ${safeDelay}s of remaining ${remainingDelay}s...`);
      
      // Wait for the safe portion of the delay
      await new Promise(resolve => setTimeout(resolve, safeDelay * 1000));
      
      if (remainingDelay > MAX_SAFE_DELAY_SECONDS) {
        // Still more delay needed - schedule another chunk
        const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
        
        EdgeRuntime.waitUntil(
          fetch(sendUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              ...body,
              remainingDelay: remainingDelay - MAX_SAFE_DELAY_SECONDS
            })
          }).then(r => console.log(`Scheduled next delay chunk: ${r.status}`))
            .catch(e => console.error('Error scheduling delay chunk:', e))
        );
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Delay chunk complete, ${remainingDelay - MAX_SAFE_DELAY_SECONDS}s remaining`,
            delayChunk: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Delay complete, continue to normal execution
      console.log('Chunked delay complete, proceeding to send message...');
    }
    
    // Support both old format (single instanceName) and new format (instances array)
    let instances: Instance[] = [];
    let sendingMode: SendingMode = 'sequential';
    let campaignId: string;
    let messageIndex: number = body.messageIndex || 0;

    if (body.instances && Array.isArray(body.instances)) {
      // New format with multiple instances
      campaignId = body.campaignId;
      instances = body.instances.map((i: any) => ({
        id: i.id,
        instance_name: i.instance_name,
        warming_level: i.warming_level || 1
      }));
      sendingMode = body.sendingMode || 'warming';
    } else if (body.instanceName) {
      // Old format for backwards compatibility
      campaignId = body.campaignId;
      instances = [{ id: 'legacy', instance_name: body.instanceName, warming_level: 1 }];
    } else {
      throw new Error('Campaign ID and instances are required');
    }

    if (!campaignId || instances.length === 0) {
      throw new Error('Campaign ID and at least one instance are required');
    }

    console.log(`Processing campaign ${campaignId}, message index ${messageIndex}, with ${instances.length} instance(s) in ${sendingMode} mode`);

    // Fetch campaign to check status and get campaign-specific settings
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        user_id, status, sent, delivered, failed, total_contacts,
        message_interval_min, message_interval_max, daily_limit,
        allowed_start_hour, allowed_end_hour, allowed_days, timezone
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign fetch error:', campaignError);
      throw new Error('Failed to fetch campaign');
    }

    // Check if campaign was cancelled or already completed
    if (campaign.status !== 'sending') {
      console.log(`Campaign ${campaignId} is no longer in 'sending' status (current: ${campaign.status}). Stopping.`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Campaign stopped - status is ${campaign.status}`,
          stopped: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get campaign-specific settings (with defaults)
    const settings: CampaignSettings = {
      message_interval_min: campaign.message_interval_min ?? DEFAULT_INTERVAL_MIN_S,
      message_interval_max: campaign.message_interval_max ?? DEFAULT_INTERVAL_MAX_S,
      daily_limit: campaign.daily_limit ?? DEFAULT_DAILY_LIMIT,
      allowed_start_hour: campaign.allowed_start_hour ?? DEFAULT_START_HOUR,
      allowed_end_hour: campaign.allowed_end_hour ?? DEFAULT_END_HOUR,
      allowed_days: campaign.allowed_days ?? DEFAULT_ALLOWED_DAYS,
      timezone: campaign.timezone ?? DEFAULT_TIMEZONE,
    };

    console.log(`Campaign settings: interval=${settings.message_interval_min}-${settings.message_interval_max}s, limit=${settings.daily_limit}, hours=${settings.allowed_start_hour}-${settings.allowed_end_hour}, days=${settings.allowed_days.join(',')}, tz=${settings.timezone}`);

    // Check if we're within allowed sending time
    const timeCheck = isWithinAllowedTime(
      settings.allowed_start_hour,
      settings.allowed_end_hour,
      settings.allowed_days,
      settings.timezone
    );

    if (!timeCheck.allowed && timeCheck.nextAllowedTime) {
      // Use the pre-calculated delay from isWithinAllowedTime (already in minutes)
      // Convert to seconds and ensure it's always positive (minimum 60 seconds)
      const delaySeconds = Math.max(timeCheck.delayMinutes * 60, 60);
      
      console.log(`Outside allowed sending time. Scheduling next attempt at ${timeCheck.nextAllowedTime.toISOString()} (${delaySeconds} seconds / ${timeCheck.delayMinutes} minutes from now)`);
      
      // Schedule for next allowed time
      EdgeRuntime.waitUntil(
        scheduleNextMessage(
          supabaseUrl,
          supabaseServiceKey,
          campaignId,
          instances,
          sendingMode,
          messageIndex,
          delaySeconds
        )
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Outside allowed sending time. Scheduled for ${timeCheck.nextAllowedTime.toISOString()}`,
          scheduledFor: timeCheck.nextAllowedTime.toISOString(),
          delayMinutes: timeCheck.delayMinutes,
          delayed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily limit - count messages sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: sentToday, error: countTodayError } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sent')
      .gte('sent_at', todayStart.toISOString());

    if (countTodayError) {
      console.error('Error counting today messages:', countTodayError);
    }

    const sentTodayCount = sentToday || 0;
    
    if (sentTodayCount >= settings.daily_limit) {
      // Daily limit reached - schedule for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(settings.allowed_start_hour, 0, 0, 0);
      
      const delaySeconds = Math.ceil((tomorrow.getTime() - Date.now()) / 1000);
      
      console.log(`Daily limit of ${settings.daily_limit} reached (sent: ${sentTodayCount}). Scheduling for tomorrow at ${tomorrow.toISOString()}`);
      
      EdgeRuntime.waitUntil(
        scheduleNextMessage(
          supabaseUrl,
          supabaseServiceKey,
          campaignId,
          instances,
          sendingMode,
          messageIndex,
          delaySeconds
        )
      );

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Daily limit reached. Scheduled for ${tomorrow.toISOString()}`,
          scheduledFor: tomorrow.toISOString(),
          dailyLimitReached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ONLY ONE queued message for this campaign (LIMIT 1)
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      throw new Error('Failed to fetch messages');
    }

    const typedMessages = (messages || []) as CampaignMessage[];
    
    // If no more queued messages, campaign is complete
    if (typedMessages.length === 0) {
      console.log(`No more queued messages for campaign ${campaignId}. Marking as completed.`);
      
      // Mark campaign as completed
      const { error: completeError } = await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (completeError) {
        console.error('Campaign completion error:', completeError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Campaign completed',
          completed: true,
          sent: campaign.sent,
          delivered: campaign.delivered,
          failed: campaign.failed
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const message = typedMessages[0];
    
    // Calculate total weight for warming mode
    const totalWeight = instances.reduce((sum, i) => sum + i.warming_level, 0);

    // Function to get instance based on warming level (weighted random selection)
    const getInstanceByWarming = (): Instance => {
      const random = Math.random() * totalWeight;
      let cumulative = 0;
      
      for (const instance of instances) {
        cumulative += instance.warming_level;
        if (random < cumulative) {
          return instance;
        }
      }
      return instances[instances.length - 1];
    };

    // Function to get instance for a message based on sending mode
    const getInstanceForMessage = (msgIndex: number): Instance => {
      if (instances.length === 1) {
        return instances[0];
      }

      switch (sendingMode) {
        case 'warming':
          return getInstanceByWarming();
        case 'sequential':
          return instances[msgIndex % instances.length];
        case 'random':
        default:
          const randomIndex = Math.floor(Math.random() * instances.length);
          return instances[randomIndex];
      }
    };

    const instance = getInstanceForMessage(messageIndex);
    let sentCount = campaign.sent;
    let deliveredCount = campaign.delivered;
    let failedCount = campaign.failed;

    try {
      // Update status to 'sending'
      await supabase
        .from('campaign_messages')
        .update({ status: 'sending' })
        .eq('id', message.id);

      // Format phone number (remove non-digits and ensure country code)
      let phone = message.phone.replace(/\D/g, '');
      if (!phone.startsWith('55')) {
        phone = '55' + phone;
      }

      console.log(`Sending message ${messageIndex + 1} to ${phone} via ${instance.instance_name}...`);

      // Send via Evolution API
      const response = await fetch(
        `${evolutionApiUrl}/message/sendText/${instance.instance_name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey
          },
          body: JSON.stringify({
            number: phone,
            text: message.message_content
          })
        }
      );

      const result = await response.json();
      console.log(`Evolution API response for message ${messageIndex + 1}:`, JSON.stringify(result));

      if (response.ok && result.key) {
        // Message sent successfully
        const sentAt = new Date().toISOString();
        
        await supabase
          .from('campaign_messages')
          .update({ 
            status: 'sent',
            sent_at: sentAt
          })
          .eq('id', message.id);

        sentCount++;
        deliveredCount++; // Assume delivered for now

        console.log(`Message ${messageIndex + 1} sent successfully via ${instance.instance_name}`);

        // Link conversation to campaign for AI agent and insert into inbox_messages
        try {
          // Find or create conversation for this contact
          const { data: existingConversation } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', message.contact_id)
            .eq('user_id', campaign.user_id)
            .single();

          let conversationId: string | null = null;

          if (existingConversation) {
            conversationId = existingConversation.id;
            
            // Update existing conversation with campaign_id and AI settings
            await supabase
              .from('conversations')
              .update({
                campaign_id: campaignId,
                ai_handled: true,
                ai_paused: false,
                ai_interactions_count: 0,
                instance_id: instance.id === 'legacy' ? null : instance.id,
                last_message_at: sentAt,
                last_message_preview: message.message_content.substring(0, 100)
              })
              .eq('id', existingConversation.id);
            
            console.log(`Linked existing conversation ${existingConversation.id} to campaign ${campaignId}`);
          } else {
            // Create new conversation linked to campaign
            const { data: newConv, error: convError } = await supabase
              .from('conversations')
              .insert({
                user_id: campaign.user_id,
                contact_id: message.contact_id,
                campaign_id: campaignId,
                instance_id: instance.id === 'legacy' ? null : instance.id,
                ai_handled: true,
                ai_paused: false,
                ai_interactions_count: 0,
                last_message_at: sentAt,
                last_message_preview: message.message_content.substring(0, 100)
              })
              .select('id')
              .single();
            
            if (!convError && newConv) {
              conversationId = newConv.id;
              console.log(`Created new conversation ${newConv.id} linked to campaign ${campaignId}`);
            }
          }

          // Insert message into inbox_messages so it appears in the chat
          if (conversationId) {
            const { error: inboxError } = await supabase
              .from('inbox_messages')
              .insert({
                conversation_id: conversationId,
                user_id: campaign.user_id,
                direction: 'outbound',
                content: message.message_content,
                message_type: 'text',
                status: 'sent',
                sent_at: sentAt,
                whatsapp_message_id: result.key.id || null
                // sent_by_user_id is null to indicate it was sent by the system/campaign
              });

            if (inboxError) {
              console.error('Error inserting message into inbox_messages:', inboxError);
            } else {
              console.log(`Inserted campaign message into inbox_messages for conversation ${conversationId}`);
            }
          }
        } catch (convLinkError) {
          console.error('Error linking conversation to campaign:', convLinkError);
          // Don't fail the message send if conversation linking fails
        }
      } else {
        // Message failed
        const errorMessage = result.message || result.error || 'Unknown error';
        await supabase
          .from('campaign_messages')
          .update({ 
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', message.id);

        failedCount++;
        console.log(`Message ${messageIndex + 1} failed via ${instance.instance_name}: ${errorMessage}`);
      }

    } catch (sendError) {
      console.error(`Error sending message ${message.id}:`, sendError);
      
      const errorMessage = sendError instanceof Error ? sendError.message : 'Network error';
      await supabase
        .from('campaign_messages')
        .update({ 
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', message.id);

      failedCount++;
    }

    // Update campaign counters
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount
      })
      .eq('id', campaignId);

    if (updateError) {
      console.error('Campaign counter update error:', updateError);
    }

    // Check if there are more messages to send
    const { count: remainingCount, error: countError } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued');

    if (countError) {
      console.error('Count error:', countError);
    }

    const hasMoreMessages = (remainingCount || 0) > 0;

    if (hasMoreMessages) {
      // Calculate random delay for next message using campaign settings
      const delaySeconds = getRandomDelay(settings.message_interval_min, settings.message_interval_max);
      
      console.log(`${remainingCount} messages remaining. Scheduling next in ${delaySeconds}s...`);
      
      // Use EdgeRuntime.waitUntil to schedule next message in background
      EdgeRuntime.waitUntil(
        scheduleNextMessage(
          supabaseUrl,
          supabaseServiceKey,
          campaignId,
          instances,
          sendingMode,
          messageIndex + 1,
          delaySeconds
        )
      );
    } else {
      // No more messages - mark campaign as completed
      console.log(`All messages processed for campaign ${campaignId}. Marking as completed.`);
      
      // Get campaign name for notification
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('name, user_id')
        .eq('id', campaignId)
        .single();
      
      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      // Send campaign_complete notification
      if (campaignData) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              type: 'campaign_complete',
              data: { campaignId, campaignName: campaignData.name },
              recipientUserId: campaignData.user_id,
            }),
          });
          console.log(`Sent campaign_complete notification for campaign ${campaignId}`);
        } catch (e) {
          console.error('Failed to send campaign_complete notification:', e);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageIndex,
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount,
        hasMoreMessages,
        instanceUsed: instance.instance_name
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send campaign messages error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
