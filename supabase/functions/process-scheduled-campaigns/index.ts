import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log('Checking for scheduled campaigns...');

    // Find campaigns that are scheduled and due to start
    const now = new Date().toISOString();
    
    const { data: scheduledCampaigns, error: fetchError } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        instance_id,
        scheduled_at,
        user_id
      `)
      .eq('status', 'scheduled')
      .not('scheduled_at', 'is', null)
      .not('instance_id', 'is', null)
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching scheduled campaigns:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${scheduledCampaigns?.length || 0} campaigns to process`);

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scheduled campaigns to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const campaign of scheduledCampaigns) {
      console.log(`Starting scheduled campaign: ${campaign.name} (${campaign.id})`);

      try {
        // Get the instance name
        const { data: instance, error: instanceError } = await supabase
          .from('whatsapp_instances')
          .select('instance_name, status')
          .eq('id', campaign.instance_id)
          .single();

        if (instanceError || !instance) {
          console.error(`Instance not found for campaign ${campaign.id}`);
          
          // Mark campaign as failed
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'Instance not found' });
          continue;
        }

        if (instance.status !== 'connected') {
          console.error(`Instance ${instance.instance_name} not connected for campaign ${campaign.id}`);
          
          // Mark campaign as failed
          await supabase
            .from('campaigns')
            .update({ 
              status: 'failed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);
          
          results.push({ campaignId: campaign.id, status: 'failed', reason: 'Instance not connected' });
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
            instanceName: instance.instance_name,
          }),
        }).catch(err => {
          console.error(`Error triggering send for campaign ${campaign.id}:`, err);
        });

        console.log(`Campaign ${campaign.id} started successfully`);
        results.push({ campaignId: campaign.id, status: 'started' });

      } catch (campaignError) {
        console.error(`Error processing campaign ${campaign.id}:`, campaignError);
        results.push({ campaignId: campaign.id, status: 'error', reason: String(campaignError) });
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Scheduled campaigns processed',
        processed: results.length,
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
