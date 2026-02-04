import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Reset stuck messages (those with 'sending' status that never completed)
    const { count: stuckCount } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'sending');

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

    // ===== APPLY EXCLUSION LOGIC =====
    const skipMode = campaign.skip_mode || 'same_template';
    const skipDaysPeriod = campaign.skip_days_period || 30;
    const skipAlreadySent = campaign.skip_already_sent !== false;
    let skippedCount = 0;

    if (skipAlreadySent) {
      console.log(`Applying exclusion rules: mode=${skipMode}, period=${skipDaysPeriod} days`);

      // Calculate period start
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - skipDaysPeriod);
      const periodStartISO = periodStart.toISOString();

      // Get campaigns to check based on skip_mode
      let campaignIdsToCheck: string[] = [];

      if (skipMode === 'same_campaign') {
        campaignIdsToCheck = [campaignId];
      } else if (skipMode === 'same_template' && campaign.template_id) {
        const { data: sameTemplateCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('template_id', campaign.template_id)
          .eq('user_id', campaign.user_id);
        campaignIdsToCheck = sameTemplateCampaigns?.map(c => c.id) || [];
        console.log(`Found ${campaignIdsToCheck.length} campaigns with same template`);
      } else if (skipMode === 'same_list' && campaign.list_id) {
        const { data: sameListCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('list_id', campaign.list_id)
          .eq('user_id', campaign.user_id);
        campaignIdsToCheck = sameListCampaigns?.map(c => c.id) || [];
        console.log(`Found ${campaignIdsToCheck.length} campaigns with same list`);
      } else if (skipMode === 'any_campaign') {
        const { data: userCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('user_id', campaign.user_id);
        campaignIdsToCheck = userCampaigns?.map(c => c.id) || [];
        console.log(`Found ${campaignIdsToCheck.length} user campaigns for any_campaign mode`);
      }

      // Fetch already sent contacts with pagination
      if (campaignIdsToCheck.length > 0) {
        let allAlreadySentIds: string[] = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: batch } = await supabase
            .from('campaign_messages')
            .select('contact_id')
            .in('campaign_id', campaignIdsToCheck)
            .in('status', ['sent', 'delivered'])
            .gte('sent_at', periodStartISO)
            .range(offset, offset + pageSize - 1);

          if (batch && batch.length > 0) {
            allAlreadySentIds.push(...batch.map(m => m.contact_id));
            offset += pageSize;
            hasMore = batch.length === pageSize;
          } else {
            hasMore = false;
          }
        }

        console.log(`Found ${allAlreadySentIds.length} already sent contact records`);

        // Remove duplicates
        const uniqueAlreadySentIds = [...new Set(allAlreadySentIds)];
        console.log(`Unique contacts already sent: ${uniqueAlreadySentIds.length}`);

        // Mark queued messages for these contacts as 'skipped'
        if (uniqueAlreadySentIds.length > 0) {
          // Process in chunks to avoid query limits
          const chunkSize = 500;
          for (let i = 0; i < uniqueAlreadySentIds.length; i += chunkSize) {
            const chunk = uniqueAlreadySentIds.slice(i, i + chunkSize);
            
            const { data: updatedRows } = await supabase
              .from('campaign_messages')
              .update({ status: 'skipped' })
              .eq('campaign_id', campaignId)
              .eq('status', 'queued')
              .in('contact_id', chunk)
              .select('id');

            skippedCount += updatedRows?.length || 0;
          }

          console.log(`Excluded ${skippedCount} contacts based on ${skipMode} rule`);
        }
      }
    }

    // Count remaining queued messages after exclusion
    const { count: queuedCount } = await supabase
      .from('campaign_messages')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'queued');

    const totalPending = queuedCount || 0;

    console.log(`Remaining queued messages: ${totalPending}`);

    if (totalPending === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No pending messages to send',
          message: skippedCount > 0 
            ? `Todas as ${skippedCount} mensagens pendentes foram excluídas pela regra de exclusão "${skipMode}"`
            : 'Todas as mensagens já foram processadas',
          skippedMessages: skippedCount
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
        message: skippedCount > 0 
          ? `Campanha retomada! ${totalPending} mensagens pendentes (${skippedCount} excluídas pela regra "${skipMode}").`
          : `Campanha retomada! ${totalPending} mensagens pendentes.`,
        pendingMessages: totalPending,
        resetMessages: stuckCount || 0,
        skippedMessages: skippedCount
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
