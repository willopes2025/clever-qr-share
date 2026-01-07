import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Resetting daily warming counters...');

    // Get all active schedules
    const { data: schedules, error: fetchError } = await supabase
      .from('warming_schedules')
      .select('*')
      .eq('status', 'active');

    if (fetchError) {
      throw new Error(`Error fetching schedules: ${fetchError.message}`);
    }

    if (!schedules || schedules.length === 0) {
      return new Response(JSON.stringify({ message: 'No active schedules to reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Reset daily counters and increment current_day
    for (const schedule of schedules) {
      const newDay = schedule.current_day + 1;
      
      // Check if warming is complete
      if (newDay > schedule.target_days) {
        await supabase
          .from('warming_schedules')
          .update({
            status: 'completed',
            messages_sent_today: 0,
            messages_received_today: 0,
          })
          .eq('id', schedule.id);
        
        console.log(`Schedule ${schedule.id} completed after ${schedule.target_days} days`);
      } else {
        await supabase
          .from('warming_schedules')
          .update({
            current_day: newDay,
            messages_sent_today: 0,
            messages_received_today: 0,
          })
          .eq('id', schedule.id);
        
        console.log(`Schedule ${schedule.id} advanced to day ${newDay}`);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Reset ${schedules.length} schedules` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in reset-warming-daily:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
