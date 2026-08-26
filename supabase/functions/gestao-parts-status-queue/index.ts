import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const MAX_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const now = new Date().toISOString();

    // Processa poucos itens por ciclo — o espaçamento real vem do scheduled_at.
    const { data: due, error } = await admin
      .from('gestao_parts_status_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(5);

    if (error) throw error;

    const results: Array<Record<string, unknown>> = [];

    for (const item of (due || [])) {
      // Lock otimista: só processa se ainda estiver pendente.
      const { data: locked } = await admin
        .from('gestao_parts_status_queue')
        .update({ status: 'processing', attempts: (item.attempts ?? 0) + 1 })
        .eq('id', item.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (!locked) continue;

      // Só envia se o lead ainda estiver na etapa que originou a mensagem.
      const { data: deal } = await admin
        .from('funnel_deals').select('id, stage_id').eq('id', item.deal_id).maybeSingle();

      if (!deal || deal.stage_id !== item.stage_id) {
        await admin.from('gestao_parts_status_queue')
          .update({ status: 'skipped', processed_at: new Date().toISOString(), last_error: 'etapa alterada' })
          .eq('id', item.id);
        results.push({ id: item.id, skipped: true });
        continue;
      }

      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/process-funnel-automations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({
            dealId: item.deal_id,
            fromStageId: item.from_stage_id,
            toStageId: item.stage_id,
            triggerType: 'on_stage_enter',
          }),
        });

        if (!resp.ok) throw new Error(`automations ${resp.status}: ${(await resp.text()).slice(0, 200)}`);

        await admin.from('gestao_parts_status_queue')
          .update({ status: 'sent', processed_at: new Date().toISOString(), last_error: null })
          .eq('id', item.id);
        results.push({ id: item.id, sent: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const attempts = (item.attempts ?? 0) + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await admin.from('gestao_parts_status_queue')
          .update({
            status: giveUp ? 'failed' : 'pending',
            last_error: message,
            // Reagenda com novo intervalo aleatório de 3 a 6 minutos.
            scheduled_at: giveUp
              ? item.scheduled_at
              : new Date(Date.now() + (180 + Math.random() * 180) * 1000).toISOString(),
            ...(giveUp ? { processed_at: new Date().toISOString() } : {}),
          })
          .eq('id', item.id);
        results.push({ id: item.id, error: message, retry: !giveUp });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
