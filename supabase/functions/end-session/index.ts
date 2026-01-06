import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { session_id, user_id } = body

    console.log('[end-session] Received request:', { session_id, user_id })

    if (!session_id && !user_id) {
      return new Response(
        JSON.stringify({ error: 'session_id or user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let sessionToEnd = null

    // If session_id provided, use it directly
    if (session_id) {
      const { data: session, error: fetchError } = await supabase
        .from('user_activity_sessions')
        .select('*')
        .eq('id', session_id)
        .is('ended_at', null)
        .maybeSingle()

      if (fetchError) {
        console.error('[end-session] Error fetching session by id:', fetchError)
        throw fetchError
      }
      sessionToEnd = session
    } 
    // If user_id provided, find their active session
    else if (user_id) {
      const { data: session, error: fetchError } = await supabase
        .from('user_activity_sessions')
        .select('*')
        .eq('user_id', user_id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        console.error('[end-session] Error fetching session by user_id:', fetchError)
        throw fetchError
      }
      sessionToEnd = session
    }

    if (!sessionToEnd) {
      console.log('[end-session] No active session found')
      return new Response(
        JSON.stringify({ success: true, message: 'No active session to end' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate duration
    const endedAt = new Date()
    const startedAt = new Date(sessionToEnd.started_at)
    const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Update the session
    const { error: updateError } = await supabase
      .from('user_activity_sessions')
      .update({
        ended_at: endedAt.toISOString(),
        duration_seconds: durationSeconds,
      })
      .eq('id', sessionToEnd.id)

    if (updateError) {
      console.error('[end-session] Error updating session:', updateError)
      throw updateError
    }

    console.log('[end-session] Successfully ended session:', {
      session_id: sessionToEnd.id,
      duration_seconds: durationSeconds
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        session_id: sessionToEnd.id,
        duration_seconds: durationSeconds 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[end-session] Unexpected error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
