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

    // Find scheduled executions whose resume time has passed
    const { data: scheduledExecs, error } = await supabase
      .from('chatbot_executions')
      .select('id, flow_id, conversation_id, contact_id, user_id, current_node_id')
      .eq('status', 'scheduled')
      .lte('scheduled_resume_at', new Date().toISOString())
      .limit(10);

    if (error) {
      console.error('[RESUME] Error fetching scheduled executions:', error);
      throw error;
    }

    if (!scheduledExecs || scheduledExecs.length === 0) {
      return new Response(JSON.stringify({ resumed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[RESUME] Found ${scheduledExecs.length} scheduled flows to resume`);

    // Resume each execution by calling execute-chatbot-flow
    const results = await Promise.allSettled(
      scheduledExecs.map(async (exec) => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/execute-chatbot-flow`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              flowId: exec.flow_id,
              conversationId: exec.conversation_id,
              contactId: exec.contact_id,
              userId: exec.user_id,
              executionId: exec.id,
              currentNodeId: exec.current_node_id,
            }),
          });

          const result = await response.json();
          console.log(`[RESUME] Flow ${exec.id} resumed:`, result);
          return result;
        } catch (err) {
          console.error(`[RESUME] Error resuming flow ${exec.id}:`, err);
          // Mark as error to avoid infinite retries
          await supabase
            .from('chatbot_executions')
            .update({ status: 'error', error_message: `Resume failed: ${err.message}` })
            .eq('id', exec.id);
          throw err;
        }
      })
    );

    return new Response(JSON.stringify({ 
      resumed: scheduledExecs.length,
      results: results.map(r => r.status),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[RESUME] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
