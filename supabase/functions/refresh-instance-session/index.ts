import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Recarrega a sessão Signal/Baileys de uma instância Evolution e
 * sincroniza os metadados (phone_number / profile_name / profile_picture).
 *
 * Útil quando o destinatário recebe "Aguardando mensagem. Essa ação pode levar
 * alguns instantes" — sintoma clássico de pré-chaves Signal dessincronizadas.
 */
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
    if (!authHeader) throw new Error('Não autorizado');

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Não autenticado');

    const { instanceName } = await req.json();
    if (!instanceName) throw new Error('Nome da instância é obrigatório');

    console.log(`[refresh-session] Recarregando sessão da instância: ${instanceName}`);

    // Permissão: garantir que o usuário pode acessar essa instância
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id, user_id, instance_name')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!instance) throw new Error('Instância não encontrada');

    const { data: canManage } = await supabase.rpc('is_instance_org_admin', {
      _user_id: user.id,
      _instance_user_id: instance.user_id,
    });
    if (instance.user_id !== user.id && !canManage) {
      throw new Error('Sem permissão para recarregar esta instância');
    }

    const refreshResults: Record<string, unknown> = {};

    // 1. Regenerar pré-chaves Signal via Evolution
    try {
      const updateRes = await fetch(
        `${evolutionApiUrl}/chat/updateSessions/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      const updateBody = await updateRes.text();
      console.log(`[refresh-session] updateSessions status=${updateRes.status} body=${updateBody.slice(0, 300)}`);
      refreshResults.updateSessions = {
        status: updateRes.status,
        ok: updateRes.ok,
      };
    } catch (e) {
      console.error('[refresh-session] updateSessions error:', e);
      refreshResults.updateSessions = { error: String(e) };
    }

    // 2. Buscar metadados atualizados e sincronizar phone_number / profile_name
    try {
      const fetchRes = await fetch(
        `${evolutionApiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
        { headers: { 'apikey': evolutionApiKey } }
      );

      if (fetchRes.ok) {
        const data = await fetchRes.json();
        const arr = Array.isArray(data) ? data : [data];
        const found = arr.find((i: any) =>
          (i?.instance?.instanceName || i?.name || i?.instanceName) === instanceName
        ) || arr[0];

        const ownerJid: string | undefined =
          found?.instance?.owner ||
          found?.owner ||
          found?.ownerJid ||
          found?.instance?.wuid;

        const profileName: string | undefined =
          found?.instance?.profileName ||
          found?.profileName ||
          found?.instance?.pushName;

        const profilePicture: string | undefined =
          found?.instance?.profilePictureUrl ||
          found?.profilePicUrl ||
          found?.profilePictureUrl;

        const status: string | undefined =
          found?.instance?.state ||
          found?.connectionStatus ||
          found?.state;

        let phoneNumber: string | null = null;
        if (ownerJid && typeof ownerJid === 'string') {
          phoneNumber = ownerJid.split('@')[0].split(':')[0];
        }

        const updates: Record<string, unknown> = {};
        if (phoneNumber) updates.phone_number = phoneNumber;
        if (profileName) updates.profile_name = profileName;
        if (profilePicture) updates.profile_picture_url = profilePicture;
        if (status === 'open' || status === 'connected') updates.status = 'connected';

        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from('whatsapp_instances')
            .update(updates)
            .eq('id', instance.id);
          console.log('[refresh-session] metadados atualizados:', updates);
          refreshResults.metadataUpdated = updates;
        } else {
          refreshResults.metadataUpdated = false;
        }
      } else {
        refreshResults.fetchInstances = { status: fetchRes.status };
      }
    } catch (e) {
      console.error('[refresh-session] fetchInstances error:', e);
      refreshResults.fetchInstances = { error: String(e) };
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sessão recarregada. Se o problema persistir, desconecte o WhatsApp do aparelho (Aparelhos conectados → Sair) e leia o QR novamente.',
        results: refreshResults,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in refresh-instance-session:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
