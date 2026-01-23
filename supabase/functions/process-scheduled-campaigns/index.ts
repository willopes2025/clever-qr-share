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
        sending_mode
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
        sending_mode
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

    // Process scheduled campaigns (new campaigns)
    for (const campaign of (scheduledCampaigns || [])) {
      console.log(`Starting scheduled campaign: ${campaign.name} (${campaign.id})`);

      try {
        // Get instance(s) - support both single and multiple instances
        const instanceIds = campaign.instance_ids || (campaign.instance_id ? [campaign.instance_id] : []);
        
        if (instanceIds.length === 0) {
          console.error(`No instances configured for campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'No instances configured' });
          continue;
        }

        // Fetch all instances
        const { data: instances, error: instancesError } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, status, warming_level')
          .in('id', instanceIds);

        if (instancesError || !instances || instances.length === 0) {
          console.error(`Instances not found for campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'Instances not found' });
          continue;
        }

        // Check if at least one instance is connected
        const connectedInstances = instances.filter(i => i.status === 'connected');
        
        if (connectedInstances.length === 0) {
          console.error(`No connected instances for campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'No connected instances' });
          continue;
        }

        // Update campaign status to sending
        await supabase
          .from('campaigns')
          .update({ 
            status: 'sending',
            started_at: new Date().toISOString()
          })
          .eq('id', campaign.id);

        // Call send-campaign-messages in background
        const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
        
        fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            instances: connectedInstances.map(i => ({
              id: i.id,
              instance_name: i.instance_name,
              warming_level: i.warming_level || 1
            })),
            sendingMode: campaign.sending_mode || 'warming'
          }),
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

    // Process retry campaigns (campaigns waiting for allowed time window)
    for (const campaign of (retryCampaigns || [])) {
      console.log(`Resuming retry campaign: ${campaign.name} (${campaign.id})`);

      try {
        // Get instance(s)
        const instanceIds = campaign.instance_ids || (campaign.instance_id ? [campaign.instance_id] : []);
        
        if (instanceIds.length === 0) {
          console.error(`No instances configured for retry campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
              retry_at: null
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'No instances configured', type: 'retry' });
          continue;
        }

        // Fetch all instances
        const { data: instances, error: instancesError } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, status, warming_level')
          .in('id', instanceIds);

        if (instancesError || !instances || instances.length === 0) {
          console.error(`Instances not found for retry campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
              retry_at: null
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'Instances not found', type: 'retry' });
          continue;
        }

        // Check if at least one instance is connected
        const connectedInstances = instances.filter(i => i.status === 'connected');
        
        if (connectedInstances.length === 0) {
          console.error(`No connected instances for retry campaign ${campaign.id}`);
          
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString(),
              retry_at: null
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'No connected instances', type: 'retry' });
          continue;
        }

        // Clear retry_at before resuming
        await supabase
          .from('campaigns')
          .update({ retry_at: null })
          .eq('id', campaign.id);

        // Call send-campaign-messages to resume
        const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
        
        fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            instances: connectedInstances.map(i => ({
              id: i.id,
              instance_name: i.instance_name,
              warming_level: i.warming_level || 1
            })),
            sendingMode: campaign.sending_mode || 'warming'
          }),
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
