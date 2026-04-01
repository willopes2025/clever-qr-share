import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for scheduled and retry campaigns...');

    const now = new Date().toISOString();
    
    // Find campaigns that are scheduled and due to start
    const { data: scheduledCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        instance_id,
        instance_ids,
        scheduled_at,
        user_id,
        sending_mode,
        meta_template_id,
        meta_phone_number_id
      `)
      .eq('status', 'scheduled')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled campaigns:', fetchError);
      throw fetchError;
    }

    // Find campaigns that are in 'sending' status but waiting for retry (retry_at)
    const { data: retryCampaigns, error: retryError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        instance_id,
        instance_ids,
        retry_at,
        user_id,
        sending_mode,
        meta_template_id,
        meta_phone_number_id
      `)
      .eq('status', 'sending')
      .not('retry_at', 'is', null)
      .lte('retry_at', now);

    if (retryError) {
      console.error('Error fetching retry campaigns:', retryError);
      throw retryError;
    }

    const totalScheduled = scheduledCampaigns?.length || 0;
    const totalRetry = retryCampaigns?.length || 0;
    
    console.log(`Found ${totalScheduled} scheduled campaigns and ${totalRetry} retry campaigns to process`);

    if (totalScheduled === 0 && totalRetry === 0) {
      return new Response(
        JSON.stringify({ message: 'No campaigns to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];
    const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;

    // Helper: resolve instances for a campaign, returns null for Meta-only campaigns
    const resolveInstances = async (campaign: any) => {
      const isMetaCampaign = !!campaign.meta_template_id && !!campaign.meta_phone_number_id;
      const instanceIds = campaign.instance_ids || (campaign.instance_id ? [campaign.instance_id] : []);

      // Meta template campaigns don't need Evolution instances
      if (instanceIds.length === 0) {
        if (isMetaCampaign) {
          console.log(`Campaign ${campaign.id} is a Meta template campaign - no Evolution instances needed`);
          return { isMetaCampaign: true, connectedInstances: [] };
        }
        return { error: 'No instances configured' };
      }

      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, instance_name, status, warming_level')
        .in('id', instanceIds);

      if (instancesError || !instances || instances.length === 0) {
        if (isMetaCampaign) {
          console.log(`Campaign ${campaign.id} is a Meta template campaign - proceeding without instances`);
          return { isMetaCampaign: true, connectedInstances: [] };
        }
        return { error: 'Instances not found' };
      }

      const connectedInstances = instances.filter(i => i.status === 'connected');
      if (connectedInstances.length === 0 && !isMetaCampaign) {
        return { error: 'No connected instances' };
      }

      return { isMetaCampaign, connectedInstances };
    };

    // Helper: build the body for send-campaign-messages
    const buildSendBody = (campaign: any, connectedInstances: any[]) => {
      const body: any = { campaignId: campaign.id };
      if (connectedInstances.length > 0) {
        body.instances = connectedInstances.map((i: any) => ({
          id: i.id,
          instance_name: i.instance_name,
          warming_level: i.warming_level || 1
        }));
      }
      body.sendingMode = campaign.sending_mode || 'warming';
      return body;
    };

    // Process scheduled campaigns (new campaigns)
    for (const campaign of (scheduledCampaigns || [])) {
      console.log(`Starting scheduled campaign: ${campaign.name} (${campaign.id})`);

      try {
        const result = await resolveInstances(campaign);

        if ('error' in result) {
          console.error(`${result.error} for campaign ${campaign.id}`);
          await supabase
            .from('campaigns')
            .update({ status: 'failed', completed_at: new Date().toISOString() })
            .eq('id', campaign.id);
          results.push({ campaignId: campaign.id, status: 'failed', reason: result.error });
          continue;
        }

        // Update campaign status to sending
        await supabase
          .from('campaigns')
          .update({ status: 'sending', started_at: new Date().toISOString() })
          .eq('id', campaign.id);

        // Call send-campaign-messages in background
        fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(buildSendBody(campaign, result.connectedInstances)),
        }).catch(err => {
          console.error(`Error triggering send for campaign ${campaign.id}:`, err);
        });

        console.log(`Campaign ${campaign.id} started successfully`);
        results.push({ campaignId: campaign.id, status: 'started', type: 'scheduled' });

      } catch (campaignError) {
        console.error(`Error processing scheduled campaign ${campaign.id}:`, campaignError);
        results.push({ campaignId: campaign.id, status: 'error', reason: String(campaignError) });
      }
    }

    // Process retry campaigns (campaigns waiting for allowed time window or batch pause)
    for (const campaign of (retryCampaigns || [])) {
      console.log(`Resuming retry campaign: ${campaign.name} (${campaign.id})`);

      try {
        const result = await resolveInstances(campaign);

        if ('error' in result) {
          console.error(`${result.error} for retry campaign ${campaign.id}`);
          await supabase
            .from('campaigns')
            .update({ status: 'failed', completed_at: new Date().toISOString(), retry_at: null })
            .eq('id', campaign.id);
          results.push({ campaignId: campaign.id, status: 'failed', reason: result.error, type: 'retry' });
          continue;
        }

        // Clear retry_at before resuming
        await supabase
          .from('campaigns')
          .update({ retry_at: null })
          .eq('id', campaign.id);

        // Call send-campaign-messages to resume
        fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(buildSendBody(campaign, result.connectedInstances)),
        }).catch(err => {
          console.error(`Error resuming retry campaign ${campaign.id}:`, err);
        });

        console.log(`Retry campaign ${campaign.id} resumed successfully`);
        results.push({ campaignId: campaign.id, status: 'resumed', type: 'retry' });

      } catch (campaignError) {
        console.error(`Error processing retry campaign ${campaign.id}:`, campaignError);
        results.push({ campaignId: campaign.id, status: 'error', reason: String(campaignError), type: 'retry' });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Campaigns processed',
        processedScheduled: totalScheduled,
        processedRetry: totalRetry,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-scheduled-campaigns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
