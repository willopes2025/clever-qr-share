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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Service-role client para limpeza de FKs (bypass RLS, mas só após validação de permissão)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Não autenticado');
    }

    const { instanceName } = await req.json();
    if (!instanceName) {
      throw new Error('Nome da instância é obrigatório');
    }

    console.log(`Deleting instance: ${instanceName} for user: ${user.id}`);

    // Buscar a instância (RLS já valida permissão de SELECT)
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (instanceError || !instance) {
      throw new Error('Instância não encontrada');
    }

    // Verificar se o usuário pode deletar (é dono ou admin da org)
    const { data: canDelete } = await supabase.rpc('is_instance_org_admin', {
      _user_id: user.id,
      _instance_user_id: instance.user_id
    });

    if (instance.user_id !== user.id && !canDelete) {
      throw new Error('Sem permissão para deletar esta instância');
    }

    const instanceId = instance.id;

    // Deletar na Evolution API (404 = já não existe lá, ok)
    try {
      const evolutionResponse = await fetch(
        `${evolutionApiUrl}/instance/delete/${instanceName}`,
        {
          method: 'DELETE',
          headers: { 'apikey': evolutionApiKey },
        }
      );

      if (evolutionResponse.status === 404) {
        console.log('Instance already deleted on Evolution API (404), continuing cleanup');
      } else {
        const evolutionData = await evolutionResponse.json().catch(() => ({}));
        console.log('Evolution API delete response:', JSON.stringify(evolutionData));
      }
    } catch (evolutionError) {
      console.error('Evolution API delete error (continuing anyway):', evolutionError);
    }

    // ========== LIMPEZA COMPLETA DE FKs ==========
    // Usar service role para garantir que todas as referências sejam limpas
    // independente das políticas RLS de cada tabela.

    // 1. inbox_messages: desvincular preservando histórico
    const { error: inboxErr, count: inboxCount } = await supabaseAdmin
      .from('inbox_messages')
      .update({ sent_via_instance_id: null }, { count: 'exact' })
      .eq('sent_via_instance_id', instanceId);
    if (inboxErr) console.error('inbox_messages cleanup error:', inboxErr);
    else console.log(`inbox_messages desvinculadas: ${inboxCount ?? 0}`);

    // 2. conversations: desvincular instance_id
    const { error: convErr } = await supabaseAdmin
      .from('conversations')
      .update({ instance_id: null })
      .eq('instance_id', instanceId);
    if (convErr) console.error('conversations cleanup error:', convErr);

    // 3. chatbot_flows: desvincular instance_id
    const { error: flowsErr } = await supabaseAdmin
      .from('chatbot_flows')
      .update({ instance_id: null })
      .eq('instance_id', instanceId);
    if (flowsErr) console.error('chatbot_flows cleanup error:', flowsErr);

    // 4. team_member_instances: deletar associações
    const { error: tmiErr } = await supabaseAdmin
      .from('team_member_instances')
      .delete()
      .eq('instance_id', instanceId);
    if (tmiErr) console.error('team_member_instances cleanup error:', tmiErr);

    // 5. warming_activities / warming_pool / warming_schedules / warming_pairs
    const { error: waErr } = await supabaseAdmin
      .from('warming_activities')
      .delete()
      .eq('instance_id', instanceId);
    if (waErr) console.error('warming_activities cleanup error:', waErr);

    const { error: wpErr } = await supabaseAdmin
      .from('warming_pool')
      .delete()
      .eq('instance_id', instanceId);
    if (wpErr) console.error('warming_pool cleanup error:', wpErr);

    const { error: wsErr } = await supabaseAdmin
      .from('warming_schedules')
      .delete()
      .eq('instance_id', instanceId);
    if (wsErr) console.error('warming_schedules cleanup error:', wsErr);

    // warming_pairs referencia em duas colunas
    const { error: wpa } = await supabaseAdmin
      .from('warming_pairs')
      .delete()
      .eq('instance_a_id', instanceId);
    if (wpa) console.error('warming_pairs (a) cleanup error:', wpa);

    const { error: wpb } = await supabaseAdmin
      .from('warming_pairs')
      .delete()
      .eq('instance_b_id', instanceId);
    if (wpb) console.error('warming_pairs (b) cleanup error:', wpb);

    // 6. notification_preferences: limpar notification_instance_id
    const { error: npErr } = await supabaseAdmin
      .from('notification_preferences')
      .update({ notification_instance_id: null })
      .eq('notification_instance_id', instanceId);
    if (npErr) console.error('notification_preferences cleanup error:', npErr);

    // 7. organizations: limpar notification_instance_id
    const { error: orgErr } = await supabaseAdmin
      .from('organizations')
      .update({ notification_instance_id: null })
      .eq('notification_instance_id', instanceId);
    if (orgErr) console.error('organizations cleanup error:', orgErr);

    // 8. campaigns.instance_id (único)
    const { error: campErr } = await supabaseAdmin
      .from('campaigns')
      .update({ instance_id: null })
      .eq('instance_id', instanceId);
    if (campErr) console.error('campaigns cleanup error:', campErr);

    // 9. campaigns.instance_ids[] (array)
    const { data: campaignsWithArray } = await supabaseAdmin
      .from('campaigns')
      .select('id, instance_ids')
      .contains('instance_ids', [instanceId]);

    if (campaignsWithArray && campaignsWithArray.length > 0) {
      for (const campaign of campaignsWithArray) {
        const updatedIds = (campaign.instance_ids || []).filter(
          (id: string) => id !== instanceId
        );
        await supabaseAdmin
          .from('campaigns')
          .update({ instance_ids: updatedIds.length > 0 ? updatedIds : [] })
          .eq('id', campaign.id);
      }
    }

    console.log('Cleared all FK references for instance:', instanceId);

    // ========== DELETE FINAL ==========
    const { error: deleteError } = await supabaseAdmin
      .from('whatsapp_instances')
      .delete()
      .eq('id', instanceId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      throw new Error(`Erro ao deletar instância: ${deleteError.message}`);
    }

    console.log('Instance deleted successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in delete-instance:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
