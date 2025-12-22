import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { campaignId, instanceIds, sendingMode } = await req.json();

    if (!campaignId || !instanceIds || instanceIds.length === 0) {
      throw new Error('Campaign ID and instance IDs are required');
    }

    console.log(`Resuming campaign ${campaignId} with ${instanceIds.length} instances in ${sendingMode} mode`);

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Check if campaign can be resumed
    const resumableStatuses = ['cancelled', 'failed', 'sending', 'completed'];
    if (!resumableStatuses.includes(campaign.status)) {
      throw new Error(`Campaign cannot be resumed. Current status: ${campaign.status}`);
    }

    // Count messages by status
    const { count: queuedCount } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued');

    const { count: stuckCount } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sending');

    console.log(`Found ${queuedCount || 0} queued and ${stuckCount || 0} stuck messages`);

    // Reset stuck messages (those with 'sending' status that never completed)
    if (stuckCount && stuckCount > 0) {
      const { error: resetError } = await supabase
        .from('campaign_messages')
        .update({ status: 'queued' })
        .eq('campaign_id', campaignId)
        .eq('status', 'sending');

      if (resetError) {
        console.error('Error resetting stuck messages:', resetError);
      } else {
        console.log(`Reset ${stuckCount} stuck messages to queued`);
      }
    }

    const totalPending = (queuedCount || 0) + (stuckCount || 0);

    if (totalPending === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No pending messages to send',
          message: 'Todas as mensagens já foram processadas'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch instances
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, instance_name, warming_level')
      .in('id', instanceIds);

    if (instancesError || !instances || instances.length === 0) {
      throw new Error('No valid instances found');
    }

    // Update campaign status to sending
    const { error: updateError } = await supabase
      .from('campaigns')
      .update({
        status: 'sending',
        started_at: campaign.started_at || new Date().toISOString(),
        completed_at: null,
        instance_ids: instanceIds,
        sending_mode: sendingMode
      })
      .eq('id', campaignId);

    if (updateError) {
      throw new Error('Failed to update campaign status');
    }

    console.log(`Campaign ${campaignId} status updated to sending`);

    // Invoke send-campaign-messages to continue
    const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
    
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        campaignId,
        instances: instances.map(i => ({
          id: i.id,
          instance_name: i.instance_name,
          warming_level: i.warming_level
        })),
        sendingMode,
        messageIndex: campaign.sent || 0
      })
    });

    if (!response.ok) {
      console.error('Failed to invoke send-campaign-messages');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Campanha retomada! ${totalPending} mensagens pendentes.`,
        pendingMessages: totalPending,
        resetMessages: stuckCount || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Resume campaign error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
