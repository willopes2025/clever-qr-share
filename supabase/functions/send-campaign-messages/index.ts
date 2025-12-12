import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const DELAY_BETWEEN_MESSAGES_MS = 2000; // 2 seconds between messages
const BATCH_SIZE = 10; // Process 10 messages at a time before updating counters

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const { campaignId, instanceName } = await req.json();

    if (!campaignId || !instanceName) {
      throw new Error('Campaign ID and Instance Name are required');
    }

    console.log(`Processing campaign ${campaignId} with instance ${instanceName}`);

    // Fetch all queued messages for this campaign
    const { data: messages, error: messagesError } = await supabase
      .from('campaign_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      throw new Error('Failed to fetch messages');
    }

    const typedMessages = (messages || []) as CampaignMessage[];
    console.log(`Found ${typedMessages.length} queued messages`);

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    // Process messages one by one with delay
    for (let i = 0; i < typedMessages.length; i++) {
      const message = typedMessages[i];

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

        console.log(`Sending message ${i + 1}/${typedMessages.length} to ${phone}...`);

        // Send via Evolution API
        const response = await fetch(
          `${evolutionApiUrl}/message/sendText/${instanceName}`,
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
        console.log(`Evolution API response for message ${i + 1}:`, JSON.stringify(result));

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
          deliveredCount++; // Assume delivered for now (can be updated via webhook later)

          console.log(`Message ${i + 1}/${typedMessages.length} sent successfully`);
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
          console.log(`Message ${i + 1}/${typedMessages.length} failed: ${errorMessage}`);
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

      // Update campaign counters every BATCH_SIZE messages or at the end
      if ((i + 1) % BATCH_SIZE === 0 || i === typedMessages.length - 1) {
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
      }

      // Rate limiting delay (except for the last message)
      if (i < typedMessages.length - 1) {
        await delay(DELAY_BETWEEN_MESSAGES_MS);
      }
    }

    // Mark campaign as completed
    const { error: completeError } = await supabase
      .from('campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount
      })
      .eq('id', campaignId);

    if (completeError) {
      console.error('Campaign completion error:', completeError);
    }

    console.log(`Campaign ${campaignId} completed. Sent: ${sentCount}, Delivered: ${deliveredCount}, Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        delivered: deliveredCount,
        failed: failedCount
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
