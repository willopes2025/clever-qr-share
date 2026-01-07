import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tempo máximo sem atividade antes de considerar campanha travada (30 minutos)
const STUCK_THRESHOLD_MINUTES = 30;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('=== Check Stuck Campaigns - Starting ===');
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    // Calcular o threshold de tempo
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - STUCK_THRESHOLD_MINUTES);

    console.log(`Looking for campaigns stuck since before: ${thresholdTime.toISOString()}`);

    // Buscar campanhas com status 'sending' que não foram atualizadas nos últimos 30 min
    const { data: stuckCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, name, user_id, instance_ids, sending_mode, sent, total_contacts, updated_at')
      .eq('status', 'sending')
      .lt('updated_at', thresholdTime.toISOString());

    if (campaignsError) {
      console.error('Error fetching stuck campaigns:', campaignsError);
      throw new Error('Failed to fetch stuck campaigns');
    }

    console.log(`Found ${stuckCampaigns?.length || 0} potentially stuck campaigns`);

    if (!stuckCampaigns || stuckCampaigns.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No stuck campaigns found',
          checked: 0,
          resumed: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let resumedCount = 0;
    let failedCount = 0;
    let completedCount = 0;
    const results: any[] = [];

    for (const campaign of stuckCampaigns) {
      console.log(`\n--- Processing campaign: ${campaign.name} (${campaign.id}) ---`);
      console.log(`Last updated: ${campaign.updated_at}`);

      try {
        // Verificar se há mensagens queued
        const { count: queuedCount, error: queuedError } = await supabase
          .from('campaign_messages')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'queued');

        if (queuedError) {
          console.error(`Error counting queued messages for ${campaign.id}:`, queuedError);
          continue;
        }

        console.log(`Queued messages: ${queuedCount}`);

        // Se não há mensagens queued, completar a campanha
        if (!queuedCount || queuedCount === 0) {
          console.log(`No queued messages - marking campaign as completed`);
          
          const { error: completeError } = await supabase
            .from('campaigns')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', campaign.id);

          if (completeError) {
            console.error(`Error completing campaign ${campaign.id}:`, completeError);
          } else {
            completedCount++;
            results.push({ 
              campaignId: campaign.id, 
              name: campaign.name,
              action: 'completed',
              reason: 'No queued messages remaining'
            });
          }
          continue;
        }

        // Buscar instâncias configuradas para a campanha
        const instanceIds = campaign.instance_ids || [];
        
        if (instanceIds.length === 0) {
          console.log(`No instances configured for campaign ${campaign.id} - marking as failed`);
          
          await supabase
            .from('campaigns')
            .update({
              status: 'failed'
            })
            .eq('id', campaign.id);

          failedCount++;
          results.push({ 
            campaignId: campaign.id, 
            name: campaign.name,
            action: 'failed',
            reason: 'No instances configured'
          });
          continue;
        }

        // Verificar se pelo menos uma instância está conectada
        const { data: connectedInstances, error: instancesError } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_name, warming_level')
          .in('id', instanceIds)
          .eq('status', 'connected');

        if (instancesError) {
          console.error(`Error fetching instances for ${campaign.id}:`, instancesError);
          continue;
        }

        console.log(`Connected instances: ${connectedInstances?.length || 0} of ${instanceIds.length}`);

        if (!connectedInstances || connectedInstances.length === 0) {
          console.log(`No connected instances - marking campaign as failed`);
          
          await supabase
            .from('campaigns')
            .update({
              status: 'failed'
            })
            .eq('id', campaign.id);

          failedCount++;
          results.push({ 
            campaignId: campaign.id, 
            name: campaign.name,
            action: 'failed',
            reason: 'All instances disconnected'
          });
          continue;
        }

        // Resetar mensagens stuck em status 'sending' para 'queued'
        const { count: sendingCount } = await supabase
          .from('campaign_messages')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .eq('status', 'sending');

        if (sendingCount && sendingCount > 0) {
          console.log(`Resetting ${sendingCount} stuck 'sending' messages to 'queued'`);
          
          await supabase
            .from('campaign_messages')
            .update({ status: 'queued' })
            .eq('campaign_id', campaign.id)
            .eq('status', 'sending');
        }

        // Atualizar updated_at da campanha para evitar ser detectada novamente imediatamente
        await supabase
          .from('campaigns')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', campaign.id);

        // Re-invocar send-campaign-messages para retomar a campanha
        console.log(`Resuming campaign ${campaign.id} with ${connectedInstances.length} instance(s)`);
        
        const instances = connectedInstances.map((i: any) => ({
          id: i.id,
          instance_name: i.instance_name,
          warming_level: i.warming_level || 1
        }));

        const sendUrl = `${supabaseUrl}/functions/v1/send-campaign-messages`;
        
        const response = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            campaignId: campaign.id,
            instances,
            sendingMode: campaign.sending_mode || 'warming',
            messageIndex: 0
          })
        });

        if (!response.ok) {
          console.error(`Failed to resume campaign ${campaign.id}: ${response.status}`);
          results.push({ 
            campaignId: campaign.id, 
            name: campaign.name,
            action: 'resume_failed',
            reason: `HTTP ${response.status}`
          });
        } else {
          console.log(`Successfully resumed campaign ${campaign.id}`);
          resumedCount++;
          results.push({ 
            campaignId: campaign.id, 
            name: campaign.name,
            action: 'resumed',
            queuedMessages: queuedCount,
            instances: connectedInstances.length
          });
        }

      } catch (campaignError) {
        console.error(`Error processing campaign ${campaign.id}:`, campaignError);
        results.push({ 
          campaignId: campaign.id, 
          name: campaign.name,
          action: 'error',
          reason: String(campaignError)
        });
      }
    }

    console.log('\n=== Check Stuck Campaigns - Summary ===');
    console.log(`Checked: ${stuckCampaigns.length}`);
    console.log(`Resumed: ${resumedCount}`);
    console.log(`Completed: ${completedCount}`);
    console.log(`Failed: ${failedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        checked: stuckCampaigns.length,
        resumed: resumedCount,
        completed: completedCount,
        failed: failedCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-stuck-campaigns:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
