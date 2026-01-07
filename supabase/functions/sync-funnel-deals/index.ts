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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting funnel deals sync...');

    // Get all instances with a default funnel configured
    const { data: instances, error: instancesError } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, default_funnel_id')
      .not('default_funnel_id', 'is', null);

    if (instancesError) {
      console.error('Error fetching instances:', instancesError);
      throw instancesError;
    }

    console.log(`Found ${instances?.length || 0} instances with default funnels`);

    let totalDealsCreated = 0;

    for (const instance of instances || []) {
      console.log(`Processing instance ${instance.id} with funnel ${instance.default_funnel_id}`);

      // Get the first stage of the funnel
      const { data: firstStage, error: stageError } = await supabase
        .from('funnel_stages')
        .select('id')
        .eq('funnel_id', instance.default_funnel_id)
        .order('order_index', { ascending: true })
        .limit(1)
        .single();

      if (stageError || !firstStage) {
        console.error(`Error fetching first stage for funnel ${instance.default_funnel_id}:`, stageError);
        continue;
      }

      // Get all conversations for this instance
      const { data: conversations, error: convsError } = await supabase
        .from('conversations')
        .select('id, contact_id, user_id')
        .eq('instance_id', instance.id);

      if (convsError) {
        console.error(`Error fetching conversations for instance ${instance.id}:`, convsError);
        continue;
      }

      console.log(`Found ${conversations?.length || 0} conversations for instance ${instance.id}`);

      for (const conversation of conversations || []) {
        // Check if contact already has a deal in this funnel
        const { data: existingDeal, error: dealCheckError } = await supabase
          .from('funnel_deals')
          .select('id')
          .eq('contact_id', conversation.contact_id)
          .eq('funnel_id', instance.default_funnel_id)
          .limit(1)
          .maybeSingle();

        if (dealCheckError) {
          console.error(`Error checking existing deal for contact ${conversation.contact_id}:`, dealCheckError);
          continue;
        }

        if (!existingDeal) {
          // Get contact name for deal title
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, phone')
            .eq('id', conversation.contact_id)
            .single();

          const dealTitle = contact?.name || contact?.phone || 'Novo Lead';

          // Create deal in first stage
          const { error: createDealError } = await supabase
            .from('funnel_deals')
            .insert({
              funnel_id: instance.default_funnel_id,
              stage_id: firstStage.id,
              contact_id: conversation.contact_id,
              user_id: conversation.user_id,
              title: dealTitle,
              value: 0,
            });

          if (createDealError) {
            console.error(`Error creating deal for contact ${conversation.contact_id}:`, createDealError);
          } else {
            totalDealsCreated++;
            console.log(`Created deal for contact ${conversation.contact_id} in funnel ${instance.default_funnel_id}`);
          }
        }
      }
    }

    console.log(`Sync completed. Total deals created: ${totalDealsCreated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sync completed. ${totalDealsCreated} deals created.`,
        dealsCreated: totalDealsCreated 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-funnel-deals:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
