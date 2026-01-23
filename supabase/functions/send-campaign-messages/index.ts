import { createClient } from "npm:@supabase/supabase-js@2";

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

// Maximum safe delay to avoid edge function timeout (50 seconds to have margin)
const MAX_SAFE_DELAY_SECONDS = 50;

// Maximum delay for chunking (5 minutes) - delays longer than this use persistent scheduling
const MAX_CHUNK_DELAY_SECONDS = 300;

// Maximum number of chunks to prevent infinite loops
const MAX_CHUNK_COUNT = 10;

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

// Function to schedule the next message execution with short delays only
const scheduleNextMessage = async (
  supabaseUrl: string,
  supabaseServiceKey: string,
  campaignId: string,
  instances: Instance[],
  sendingMode: SendingMode,
  messageIndex: number,
  delaySeconds: number
) => {
  const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
  
  // For delays larger than max chunk delay, use persistent scheduling instead
  if (delaySeconds > MAX_CHUNK_DELAY_SECONDS) {
    console.log(`Delay ${delaySeconds}s exceeds max chunk limit (${MAX_CHUNK_DELAY_SECONDS}s). Using persistent scheduling...`);
    
    // Update campaign with retry_at timestamp - the cron job will handle it
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const retryAt = new Date(Date.now() + delaySeconds * 1000);
    
    await supabase
      .from('campaigns')
      .update({ retry_at: retryAt.toISOString() })
      .eq('id', campaignId);
    
    console.log(`Campaign ${campaignId} scheduled for retry at ${retryAt.toISOString()}`);
    return;
  }
  
  // If delay is larger than safe limit but within chunk limit, use chunked approach
  if (delaySeconds > MAX_SAFE_DELAY_SECONDS) {
    console.log(`Delay ${delaySeconds}s exceeds safe limit but within chunk limit. Using chunked approach...`);
    
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
          remainingDelay: delaySeconds,
          chunkCount: 0,
          isIntervalDelay: true  // Flag to indicate this is an interval delay between messages
        })
      });
      
      if (!response.ok) {
        console.error(`Failed to schedule chunked delay: ${response.status}`);
      } else {
        console.log(`Scheduled chunked delay for campaign ${campaignId} (interval delay)`);
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

// Function to use persistent scheduling for long delays
const usePersistentScheduling = async (
  supabase: any,
  campaignId: string,
  retryAt: Date,
  reason: string
) => {
  console.log(`Using persistent scheduling: ${reason}. Retry at ${retryAt.toISOString()}`);
  
  await supabase
    .from('campaigns')
    .update({ retry_at: retryAt.toISOString() })
    .eq('id', campaignId);
  
  console.log(`Campaign ${campaignId} scheduled for persistent retry at ${retryAt.toISOString()}`);
};

Deno.serve(async (req: Request) => {
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
      const chunkCount = (body.chunkCount || 0) + 1;
      
      // Check chunk limit to prevent infinite loops
      if (chunkCount > MAX_CHUNK_COUNT) {
        console.log(`Chunk limit (${MAX_CHUNK_COUNT}) exceeded for campaign ${body.campaignId}. Using persistent scheduling...`);
        
        const retryAt = new Date(Date.now() + remainingDelay * 1000);
        await usePersistentScheduling(supabase, body.campaignId, retryAt, 'Chunk limit exceeded');
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Chunk limit exceeded. Scheduled for persistent retry at ${retryAt.toISOString()}`,
            persistentScheduling: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if this is an interval delay between messages (should NEVER be skipped)
      const isIntervalDelay = body.isIntervalDelay === true;
      
      if (isIntervalDelay) {
        // INTERVAL DELAY: This is the configured delay between messages (e.g., 100-300s)
        // This delay MUST be respected fully - never skip it based on allowed time
        console.log(`Processing INTERVAL delay: ${remainingDelay}s remaining (chunk ${chunkCount}/${MAX_CHUNK_COUNT})`);
        
        // Check if campaign was cancelled
        if (body.campaignId) {
          const { data: campaignCheck } = await supabase
            .from('campaigns')
            .select('status')
            .eq('id', body.campaignId)
            .single();
          
          if (campaignCheck && campaignCheck.status !== 'sending') {
            console.log(`Campaign ${body.campaignId} is no longer sending (status: ${campaignCheck.status}). Stopping interval delay.`);
            return new Response(
              JSON.stringify({ success: true, message: 'Campaign stopped', stopped: true }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Execute the safe portion of the delay
        const safeDelay = Math.min(remainingDelay, MAX_SAFE_DELAY_SECONDS);
        console.log(`Interval delay chunk: waiting ${safeDelay}s of remaining ${remainingDelay}s...`);
        
        await new Promise(resolve => setTimeout(resolve, safeDelay * 1000));
        
        if (remainingDelay > MAX_SAFE_DELAY_SECONDS) {
          const newRemainingDelay = remainingDelay - MAX_SAFE_DELAY_SECONDS;
          
          // Schedule another chunk with isIntervalDelay preserved
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
                remainingDelay: newRemainingDelay,
                chunkCount,
                isIntervalDelay: true  // Preserve the flag
              })
            }).then(r => console.log(`Scheduled next interval delay chunk: ${r.status}`))
              .catch(e => console.error('Error scheduling interval delay chunk:', e))
          );
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: `Interval delay chunk ${chunkCount} complete, ${newRemainingDelay}s remaining`,
              delayChunk: true,
              chunkCount,
              isIntervalDelay: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Interval delay complete, continue to normal execution
        console.log('Interval delay complete, proceeding to send next message...');
        
      } else {
        // SCHEDULE DELAY: This is waiting for allowed hours - can be skipped if now within allowed time
        if (body.campaignId) {
          const { data: campaignCheck } = await supabase
            .from('campaigns')
            .select('allowed_start_hour, allowed_end_hour, allowed_days, timezone, status')
            .eq('id', body.campaignId)
            .single();
          
          if (campaignCheck) {
            // Check if campaign was cancelled
            if (campaignCheck.status !== 'sending') {
              console.log(`Campaign ${body.campaignId} is no longer sending (status: ${campaignCheck.status}). Stopping chunk.`);
              return new Response(
                JSON.stringify({ success: true, message: 'Campaign stopped', stopped: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            const timeCheck = isWithinAllowedTime(
              campaignCheck.allowed_start_hour ?? DEFAULT_START_HOUR,
              campaignCheck.allowed_end_hour ?? DEFAULT_END_HOUR,
              campaignCheck.allowed_days ?? DEFAULT_ALLOWED_DAYS,
              campaignCheck.timezone ?? DEFAULT_TIMEZONE
            );
            
            if (timeCheck.allowed) {
              console.log(`Now within allowed time! Skipping remaining ${remainingDelay}s schedule delay and proceeding to send...`);
              // Clear retry_at since we're proceeding
              await supabase
                .from('campaigns')
                .update({ retry_at: null })
                .eq('id', body.campaignId);
              // Continue to normal execution below (don't return)
            } else {
              // Still outside allowed time - continue chunking or use persistent
              const safeDelay = Math.min(remainingDelay, MAX_SAFE_DELAY_SECONDS);
              
              console.log(`Schedule delay (chunk ${chunkCount}/${MAX_CHUNK_COUNT}): waiting ${safeDelay}s of remaining ${remainingDelay}s...`);
              
              // Wait for the safe portion of the delay
              await new Promise(resolve => setTimeout(resolve, safeDelay * 1000));
              
              if (remainingDelay > MAX_SAFE_DELAY_SECONDS) {
                const newRemainingDelay = remainingDelay - MAX_SAFE_DELAY_SECONDS;
                
                // If still a lot of delay remaining and we've done some chunks, switch to persistent
                if (newRemainingDelay > MAX_CHUNK_DELAY_SECONDS) {
                  const retryAt = new Date(Date.now() + newRemainingDelay * 1000);
                  await usePersistentScheduling(supabase, body.campaignId, retryAt, 'Long delay remaining after chunks');
                  
                  return new Response(
                    JSON.stringify({ 
                      success: true, 
                      message: `Switching to persistent scheduling. Retry at ${retryAt.toISOString()}`,
                      persistentScheduling: true
                    }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                  );
                }
                
                // Schedule another chunk (schedule delay, not interval)
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
                      remainingDelay: newRemainingDelay,
                      chunkCount,
                      isIntervalDelay: false  // Keep as schedule delay
                    })
                  }).then(r => console.log(`Scheduled next delay chunk: ${r.status}`))
                    .catch(e => console.error('Error scheduling delay chunk:', e))
                );
                
                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    message: `Delay chunk ${chunkCount} complete, ${newRemainingDelay}s remaining`,
                    delayChunk: true,
                    chunkCount
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              
              // Delay complete, continue to normal execution
              console.log('Schedule delay complete, proceeding to send message...');
            }
          }
        }
      }
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
        allowed_start_hour, allowed_end_hour, allowed_days, timezone, retry_at
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

    // Clear retry_at since we're now processing
    if (campaign.retry_at) {
      await supabase
        .from('campaigns')
        .update({ retry_at: null })
        .eq('id', campaignId);
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
      // Calculate delay in seconds
      const delaySeconds = Math.max(timeCheck.delayMinutes * 60, 60);
      
      console.log(`Outside allowed sending time. Next allowed: ${timeCheck.nextAllowedTime.toISOString()} (${delaySeconds} seconds / ${timeCheck.delayMinutes} minutes from now)`);
      
      // For long delays (> 5 minutes), use persistent scheduling
      if (delaySeconds > MAX_CHUNK_DELAY_SECONDS) {
        await usePersistentScheduling(
          supabase, 
          campaignId, 
          timeCheck.nextAllowedTime, 
          'Outside allowed hours - long delay'
        );

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Outside allowed sending time. Scheduled for persistent retry at ${timeCheck.nextAllowedTime.toISOString()}`,
            scheduledFor: timeCheck.nextAllowedTime.toISOString(),
            delayMinutes: timeCheck.delayMinutes,
            persistentScheduling: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // For shorter delays, use chunked approach
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
      // Daily limit reached - schedule for tomorrow using persistent scheduling
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(settings.allowed_start_hour, 0, 0, 0);
      
      console.log(`Daily limit of ${settings.daily_limit} reached (sent: ${sentTodayCount}). Scheduling for tomorrow at ${tomorrow.toISOString()}`);
      
      await usePersistentScheduling(supabase, campaignId, tomorrow, 'Daily limit reached');

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Daily limit reached. Scheduled for ${tomorrow.toISOString()}`,
          scheduledFor: tomorrow.toISOString(),
          dailyLimitReached: true,
          persistentScheduling: true
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
          completed_at: new Date().toISOString(),
          retry_at: null
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
        if (random <= cumulative) {
          return instance;
        }
      }
      
      return instances[0];
    };

    // Select instance based on sending mode
    let selectedInstance: Instance;
    
    switch (sendingMode) {
      case 'warming':
        selectedInstance = getInstanceByWarming();
        break;
      case 'random':
        selectedInstance = instances[Math.floor(Math.random() * instances.length)];
        break;
      case 'sequential':
      default:
        selectedInstance = instances[messageIndex % instances.length];
        break;
    }

    console.log(`Selected instance: ${selectedInstance.instance_name} (warming level: ${selectedInstance.warming_level})`);

    // Update message status to 'sending'
    await supabase
      .from('campaign_messages')
      .update({ status: 'sending' })
      .eq('id', message.id);

    // Format phone number (ensure it has country code)
    let formattedPhone = message.phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Send message via Evolution API
    const evolutionResponse = await fetch(`${evolutionApiUrl}/message/sendText/${selectedInstance.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message.message_content
      })
    });

    const evolutionResult = await evolutionResponse.json();

    if (evolutionResponse.ok && evolutionResult.key) {
      console.log(`Message sent successfully to ${formattedPhone}`);
      
      // Update message as sent
      await supabase
        .from('campaign_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', message.id);

      // Increment campaign sent counter
      await supabase
        .from('campaigns')
        .update({ 
          sent: (campaign.sent || 0) + 1,
          delivered: (campaign.delivered || 0) + 1
        })
        .eq('id', campaignId);

    } else {
      console.error(`Failed to send message to ${formattedPhone}:`, evolutionResult);
      
      // Update message as failed
      await supabase
        .from('campaign_messages')
        .update({
          status: 'failed',
          error_message: evolutionResult.message || 'Unknown error'
        })
        .eq('id', message.id);

      // Increment campaign failed counter
      await supabase
        .from('campaigns')
        .update({ failed: (campaign.failed || 0) + 1 })
        .eq('id', campaignId);
    }

    // Check if there are more messages to send
    const { count: remainingCount, error: countError } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued');

    if (countError) {
      console.error('Error counting remaining messages:', countError);
    }

    const remaining = remainingCount || 0;

    if (remaining > 0) {
      // Calculate random delay for next message
      const delaySeconds = getRandomDelay(settings.message_interval_min, settings.message_interval_max);
      
      console.log(`${remaining} messages remaining. Scheduling next message in ${delaySeconds} seconds...`);

      // Schedule next message
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
      console.log(`All messages sent for campaign ${campaignId}. Marking as completed.`);
      
      await supabase
        .from('campaigns')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          retry_at: null
        })
        .eq('id', campaignId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Message sent to ${formattedPhone}`,
        remaining,
        sent: (campaign.sent || 0) + 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-campaign-messages:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
