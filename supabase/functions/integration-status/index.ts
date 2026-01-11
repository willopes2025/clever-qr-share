import { requireUser, createServiceClient, corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication using shared helper
    const authResult = await requireUser(req);
    if (!authResult.success) {
      return authResult.error;
    }

    const { userId } = authResult;
    console.log('[integration-status] User:', userId);

    // Service role client for reading integrations (bypasses RLS)
    const supabaseAdmin = createServiceClient();

    // Determine integrationOwnerId
    // 1. Check if user has their own integrations
    // 2. If not, check if user is a member and use organization owner
    let integrationOwnerId = userId;

    // First try the user's own integrations
    const { data: ownIntegration } = await supabaseAdmin
      .from('integrations')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('provider', ['asaas', 'ssotica'])
      .limit(1);

    if (!ownIntegration || ownIntegration.length === 0) {
      // User doesn't have their own integrations, check if they're a team member
      const { data: teamMember } = await supabaseAdmin
        .from('team_members')
        .select('organization_id, permissions')
        .eq('user_id', userId)
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
