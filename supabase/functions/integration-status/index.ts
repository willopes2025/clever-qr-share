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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[integration-status] No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // User-level client for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // Service role client for reading integrations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validate JWT using getClaims()
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('[integration-status] Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = claimsData.claims.sub as string;
    if (!userId) {
      console.error('[integration-status] No user ID in claims');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user object for compatibility
    const user = { id: userId };
    console.log('[integration-status] User:', user.id);

    // Determine integrationOwnerId
    // 1. Check if user has their own integrations
    // 2. If not, check if user is a member and use organization owner
    let integrationOwnerId = user.id;

    // First try the user's own integrations
    const { data: ownIntegration } = await supabaseAdmin
      .from('integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('provider', ['asaas', 'ssotica'])
      .limit(1);

    if (!ownIntegration || ownIntegration.length === 0) {
      // User doesn't have their own integrations, check if they're a team member
      const { data: teamMember } = await supabaseAdmin
        .from('team_members')
        .select('organization_id, permissions')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      if (teamMember?.organization_id) {
        // Get the organization owner
        const { data: org } = await supabaseAdmin
          .from('organizations')
          .select('owner_id')
          .eq('id', teamMember.organization_id)
          .single();

        if (org?.owner_id) {
          integrationOwnerId = org.owner_id;
          console.log('[integration-status] Using org owner:', integrationOwnerId);
        }
      }
    }

    // Check for active integrations using integrationOwnerId
    const { data: integrations, error: intError } = await supabaseAdmin
      .from('integrations')
      .select('provider')
      .eq('user_id', integrationOwnerId)
      .eq('is_active', true)
      .in('provider', ['asaas', 'ssotica']);

    if (intError) {
      console.error('[integration-status] Error fetching integrations:', intError);
    }

    const providers = (integrations || []).map((i: { provider: string }) => i.provider);

    const result = {
      asaas: providers.includes('asaas'),
      ssotica: providers.includes('ssotica'),
      integrationOwnerId, // For debugging only, can be removed in production
    };

    console.log('[integration-status] Result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[integration-status] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
