import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create regular client to get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: callerUser }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !callerUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { targetUserId, newPassword } = await req.json();

    if (!targetUserId || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'targetUserId e newPassword são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: 'A senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${callerUser.id} attempting to reset password for user ${targetUserId}`);

    // Check if caller is admin of an organization that the target user belongs to
    const { data: callerOrg, error: callerOrgError } = await supabaseAdmin
      .from('team_members')
      .select('organization_id, role')
      .eq('user_id', callerUser.id)
      .eq('status', 'active')
      .in('role', ['admin', 'owner'])
      .maybeSingle();

    if (callerOrgError) {
      console.error('Error checking caller org:', callerOrgError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also check if caller is owner of an organization
    const { data: ownedOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('owner_id', callerUser.id)
      .maybeSingle();

    const callerOrgId = callerOrg?.organization_id || ownedOrg?.id;

    if (!callerOrgId) {
      console.log('Caller is not an admin of any organization');
      return new Response(
        JSON.stringify({ error: 'Sem permissão para redefinir senhas' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if target user belongs to the same organization
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('team_members')
      .select('id, user_id')
      .eq('organization_id', callerOrgId)
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .maybeSingle();

    if (targetError) {
      console.error('Error checking target member:', targetError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar membro' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetMember) {
      console.log('Target user is not a member of the caller organization');
      return new Response(
        JSON.stringify({ error: 'Membro não encontrado na organização' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent resetting own password through this endpoint
    if (targetUserId === callerUser.id) {
      return new Response(
        JSON.stringify({ error: 'Use a opção de alterar senha do seu perfil' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Password successfully reset for user ${targetUserId} by admin ${callerUser.id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Senha atualizada com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
