// SLA do Inbox (Gestão Parts / Martins):
// devolve a conversa para "Sem dono" quando a última mensagem é do cliente
// e passam 30 MINUTOS DE HORÁRIO COMERCIAL (seg–sex, 8h–18h) sem resposta.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveOrgTimezone, getTzOffsetMinutes } from "../_shared/timezone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLA_MINUTES = 30;      // minutos comerciais sem resposta
const BUSINESS_START = 8;    // 08:00
const BUSINESS_END = 18;     // 18:00
const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // seg–sex

/** Converte um instante UTC para os componentes locais do fuso informado */
function localParts(date: Date, tz: string) {
  const offset = getTzOffsetMinutes(date, tz);
  const local = new Date(date.getTime() + offset * 60_000);
  return {
    offset,
    day: local.getUTCDay(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    dateKey: local.toISOString().slice(0, 10),
    local,
  };
}

/** Minutos comerciais (seg–sex, 8h–18h) decorridos entre dois instantes */
export function businessMinutesBetween(from: Date, to: Date, tz: string): number {
  if (to <= from) return 0;
  let total = 0;
  // Caminha dia a dia no fuso local, somando a interseção com a janela comercial
  let cursor = new Date(from.getTime());
  let guard = 0;
  while (cursor < to && guard++ < 60) {
    const p = localParts(cursor, tz);
    // Início e fim da janela comercial deste dia local, em UTC
    const dayStartLocalMs = Date.UTC(
      p.local.getUTCFullYear(), p.local.getUTCMonth(), p.local.getUTCDate(),
    );
    const winStart = new Date(dayStartLocalMs + BUSINESS_START * 3_600_000 - p.offset * 60_000);
    const winEnd = new Date(dayStartLocalMs + BUSINESS_END * 3_600_000 - p.offset * 60_000);
    const nextDay = new Date(dayStartLocalMs + 24 * 3_600_000 - p.offset * 60_000);

    if (BUSINESS_DAYS.includes(p.day)) {
      const start = Math.max(cursor.getTime(), winStart.getTime());
      const end = Math.min(to.getTime(), winEnd.getTime());
      if (end > start) total += (end - start) / 60_000;
    }
    cursor = nextDay;
  }
  return total;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // Organizações com o módulo Gestão Parts ativo
    const { data: integrations } = await admin
      .from('integrations')
      .select('user_id')
      .eq('provider', 'gestao_parts')
      .eq('is_active', true);

    if (!integrations?.length) return json({ skipped: 'nenhuma organização com Gestão Parts' });

    const scope = new Set<string>();
    for (const row of integrations as Array<{ user_id: string }>) {
      const { data: members } = await admin.rpc('get_organization_member_ids', { _user_id: row.user_id });
      if (Array.isArray(members)) for (const m of members) scope.add(String(m));
      scope.add(row.user_id);
    }
    const userIds = Array.from(scope);
    if (!userIds.length) return json({ skipped: 'nenhum usuário no escopo' });

    const now = new Date();
    // Filtro grosseiro: pelo menos 30 min corridos (o cálculo comercial refina depois)
    const roughCutoff = new Date(now.getTime() - SLA_MINUTES * 60_000).toISOString();

    const { data: conversations, error } = await admin
      .from('conversations')
      .select('id, user_id, contact_id, assigned_to, last_message_at, last_message_direction, status')
      .in('user_id', userIds)
      .not('assigned_to', 'is', null)
      .neq('status', 'archived')
      .eq('last_message_direction', 'inbound')
      .lt('last_message_at', roughCutoff)
      .order('last_message_at', { ascending: true })
      .limit(300);
    if (error) throw error;

    const tzCache = new Map<string, string>();
    const released: string[] = [];

    for (const conv of (conversations || []) as Array<Record<string, string>>) {
      if (!conv.last_message_at) continue;
      let tz = tzCache.get(conv.user_id);
      if (!tz) {
        tz = await resolveOrgTimezone(admin, { userId: conv.user_id });
        tzCache.set(conv.user_id, tz);
      }
      const minutos = businessMinutesBetween(new Date(conv.last_message_at), now, tz);
      if (minutos < SLA_MINUTES) continue;

      const { error: updErr } = await admin
        .from('conversations')
        .update({ assigned_to: null })
        .eq('id', conv.id)
        .eq('assigned_to', conv.assigned_to);
      if (updErr) { console.error('[SLA] update', conv.id, updErr.message); continue; }

      released.push(conv.id);
      if (conv.contact_id) {
        await admin.from('contact_activity_log').insert({
          contact_id: conv.contact_id,
          conversation_id: conv.id,
          user_id: conv.assigned_to,
          activity_type: 'sla_release',
          description: `Lead devolvido para "Sem dono" após ${SLA_MINUTES} minutos de horário comercial sem resposta`,
          metadata: { sla_minutes: SLA_MINUTES, business_hours: `${BUSINESS_START}-${BUSINESS_END}`, previous_assignee: conv.assigned_to },
        });
      }
    }

    console.log('[SLA]', JSON.stringify({ candidatas: conversations?.length ?? 0, liberadas: released.length }));
    return json({ candidatas: conversations?.length ?? 0, liberadas: released.length, ids: released });
  } catch (e) {
    console.error('[SLA]', (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
