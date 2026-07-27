import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json(401, { success: false, error: 'Não autenticado' });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json(401, { success: false, error: 'Não autenticado' });

    const body = await req.json().catch(() => ({}));
    const phoneNumberId = String(body?.phoneNumberId || '').trim();
    const accessToken = String(body?.accessToken || '').trim();

    if (!phoneNumberId || !accessToken) {
      return json(400, { success: false, error: 'Informe o número e o token de acesso.' });
    }

    // Ownership check via RLS: o usuário precisa enxergar o número
    const { data: numberRow, error: numberError } = await userClient
      .from('meta_whatsapp_numbers')
      .select('id, phone_number_id, waba_id, phone_number')
      .eq('phone_number_id', phoneNumberId)
      .maybeSingle();

    if (numberError || !numberRow) {
      return json(403, { success: false, error: 'Número Meta não encontrado ou sem permissão.' });
    }

    // Valida o token direto na Meta antes de salvar
    const checkRes = await fetch(
      `${GRAPH_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,status,quality_rating`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const checkData = await checkRes.json();

    if (!checkRes.ok || checkData?.error) {
      return json(400, {
        success: false,
        error: `A Meta rejeitou este token para o número informado: ${checkData?.error?.message || checkRes.status}`,
      });
    }

    // Descobre a WABA do número (opcional, melhora a resolução para templates)
    let wabaId: string | null = numberRow.waba_id ?? null;
    try {
      const wabaRes = await fetch(`${GRAPH_BASE}/${phoneNumberId}?fields=whatsapp_business_account`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const wabaData = await wabaRes.json();
      if (wabaData?.whatsapp_business_account?.id) {
        wabaId = wabaData.whatsapp_business_account.id;
      }
    } catch (_) { /* opcional */ }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: saveError } = await adminClient
      .from('meta_number_tokens')
      .upsert({
        phone_number_id: phoneNumberId,
        user_id: user.id,
        waba_id: wabaId,
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone_number_id' });

    if (saveError) {
      console.error('[META-SAVE-TOKEN] save error:', saveError.message);
      return json(500, { success: false, error: 'Erro ao salvar o token.' });
    }

    // Mantém metadados do número em dia
    if (wabaId && wabaId !== numberRow.waba_id) {
      await adminClient
        .from('meta_whatsapp_numbers')
        .update({ waba_id: wabaId, updated_at: new Date().toISOString() })
        .eq('id', numberRow.id);
    }

    console.log(`[META-SAVE-TOKEN] token salvo para ${phoneNumberId} (waba ${wabaId})`);

    return json(200, {
      success: true,
      phoneNumberId,
      wabaId,
      displayPhoneNumber: checkData.display_phone_number || null,
      verifiedName: checkData.verified_name || null,
      status: checkData.status || null,
    });
  } catch (error) {
    console.error('[META-SAVE-TOKEN] error:', error);
    return json(500, { success: false, error: error instanceof Error ? error.message : 'Erro inesperado' });
  }
});
