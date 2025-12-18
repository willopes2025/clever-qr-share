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
): { allowed: boolean; nextAllowedTime: Date | null } => {
  // Get current time in the specified timezone
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const currentHour = parseInt(formatter.format(now));
  
  const dayOptions: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    weekday: 'short',
  };
  const dayFormatter = new Intl.DateTimeFormat('en-US', dayOptions);
  const currentDay = dayFormatter.format(now).toLowerCase().substring(0, 3);
  
  console.log(`Current time check: hour=${currentHour}, day=${currentDay}, allowed hours=${startHour}-${endHour}, allowed days=${allowedDays.join(',')}`);
  
  // Check if today is an allowed day
  const isDayAllowed = allowedDays.includes(currentDay);
  
  // Check if current hour is within allowed range
  const isHourAllowed = currentHour >= startHour && currentHour < endHour;
  
  if (isDayAllowed && isHourAllowed) {
    return { allowed: true, nextAllowedTime: null };
  }
  
  // Calculate next allowed time
  const nextAllowed = new Date(now);
  
  if (isDayAllowed && currentHour < startHour) {
    // Today is allowed, but before start hour - wait until start hour
    nextAllowed.setHours(startHour, 0, 0, 0);
  } else {
    // Either today is not allowed or we're past end hour - find next allowed day
    let daysToAdd = 1;
    const maxDaysToCheck = 7;
    
    while (daysToAdd <= maxDaysToCheck) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + daysToAdd);
      const checkDay = getDayAbbreviation(checkDate);
      
      if (allowedDays.includes(checkDay)) {
        nextAllowed.setDate(now.getDate() + daysToAdd);
        nextAllowed.setHours(startHour, 0, 0, 0);
        break;
      }
      daysToAdd++;
    }
  }
  
  return { allowed: false, nextAllowedTime: nextAllowed };
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

// Function to schedule the next message execution
const scheduleNextMessage = async (
  supabaseUrl: string,
  supabaseServiceKey: string,
  campaignId: string,
  instances: Instance[],
  sendingMode: SendingMode,
  messageIndex: number,
  delaySeconds: number
) => {
  console.log(`Scheduling next message (index ${messageIndex}) in ${delaySeconds} seconds...`);
  
  // Wait for the delay before invoking the next call
  await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
  
  // Re-invoke this function for the next message
  const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
  
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
      // Calculate delay until next allowed time
      const now = new Date();
      const delayMs = timeCheck.nextAllowedTime.getTime() - now.getTime();
      const delaySeconds = Math.ceil(delayMs / 1000);
      
      console.log(`Outside allowed sending time. Scheduling next attempt at ${timeCheck.nextAllowedTime.toISOString()} (${delaySeconds} seconds from now)`);
      
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
        await supabase
          .from('campaign_messages')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', message.id);

        sentCount++;
        deliveredCount++; // Assume delivered for now

        console.log(`Message ${messageIndex + 1} sent successfully via ${instance.instance_name}`);
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
      
      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
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