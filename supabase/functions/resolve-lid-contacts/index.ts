// resolve-lid-contacts
// Resolve contacts with phone LIKE 'LID_%' into their real WhatsApp phone numbers
// using the Evolution API findContacts endpoint. Merges duplicates when needed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone, isValidPhone, extractPhoneFromJid } from "../_shared/phone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')!;
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')!;

interface LidContact {
  id: string;
  user_id: string;
  phone: string;
  label_id: string | null;
  name: string | null;
  custom_fields: Record<string, unknown> | null;
}

interface ResolveStats {
  scanned: number;
  resolved: number;
  merged: number;
  unresolved: number;
  errors: number;
}

async function fetchInstanceContacts(
  instanceName: string,
): Promise<Map<string, string>> {
  // Map: labelId -> real phone (normalized)
  const map = new Map<string, string>();
  try {
    const url = `${EVOLUTION_API_URL}/chat/findContacts/${instanceName}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ where: {} }),
    });
    if (!resp.ok) {
      console.warn(`[resolve-lid] findContacts ${instanceName} -> ${resp.status}`);
      return map;
    }
    const data = await resp.json();
    const arr = Array.isArray(data) ? data : (data?.contacts ?? data?.data ?? []);
    for (const c of arr) {
      // Evolution may return either { id, remoteJid, lid } or { remoteJid, lid }
      const lidField: string | undefined = c?.lid || c?.LID || c?.labelId;
      const realJid: string | undefined =
        c?.remoteJid || c?.id || c?.jid || c?.remoteJidAlt;
      if (!lidField || !realJid) continue;
      // Skip if realJid is actually a LID
      if (String(realJid).includes('@lid')) continue;
      const labelId = extractPhoneFromJid(String(lidField));
      const realRaw = extractPhoneFromJid(String(realJid));
      if (!labelId || !realRaw) continue;
      const normalized = normalizePhone(realRaw);
      if (!isValidPhone(normalized)) continue;
      map.set(labelId, normalized);
    }
    console.log(`[resolve-lid] ${instanceName}: ${map.size} LID mappings`);
  } catch (e) {
    console.error(`[resolve-lid] error listing contacts ${instanceName}:`, e);
  }
  return map;
}

async function mergeContacts(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  targetId: string,
) {
  // Reassign all FKs from sourceId -> targetId, then delete source.
  const tables: Array<[string, string]> = [
    ['conversations', 'contact_id'],
    ['inbox_messages', 'contact_id'], // safe even if column absent
    ['funnel_deals', 'contact_id'],
    ['funnel_opportunities', 'contact_id'],
    ['conversation_tasks', 'contact_id'],
    ['deal_tasks', 'contact_id'],
    ['contact_activity_log', 'contact_id'],
    ['contact_tags', 'contact_id'],
    ['conversation_notes', 'contact_id'],
    ['broadcast_list_contacts', 'contact_id'],
    ['billing_reminders', 'contact_id'],
    ['campaign_messages', 'contact_id'],
    ['calendly_events', 'contact_id'],
    ['scheduled_task_messages', 'contact_id'],
  ];
  for (const [table, col] of tables) {
    try {
      await supabase.from(table).update({ [col]: targetId }).eq(col, sourceId);
    } catch (e) {
      console.warn(`[merge] skip ${table}.${col}:`, (e as Error).message);
    }
  }
  await supabase.from('contacts').delete().eq('id', sourceId);
}

async function processContact(
  supabase: ReturnType<typeof createClient>,
  contact: LidContact,
  realPhone: string,
  stats: ResolveStats,
) {
  // Try to find existing contact for same user with this real phone
  const variants = Array.from(new Set([
    realPhone,
    realPhone.startsWith('55') ? realPhone.slice(2) : `55${realPhone}`,
  ]));
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', contact.user_id)
    .in('phone', variants)
    .neq('id', contact.id)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await mergeContacts(supabase, contact.id, existing.id);
    // Mark queue resolved
    await supabase.from('lid_resolution_queue')
      .update({ resolved_at: new Date().toISOString() })
      .eq('contact_id', contact.id);
    stats.merged++;
    return;
  }

  // Just update phone
  const cf = { ...(contact.custom_fields || {}) } as Record<string, unknown>;
  delete cf.lid_unresolved;
  const { error } = await supabase
    .from('contacts')
    .update({ phone: realPhone, custom_fields: cf })
    .eq('id', contact.id);
  if (error) {
    console.error('[resolve-lid] update error', contact.id, error.message);
    stats.errors++;
    return;
  }
  await supabase.from('lid_resolution_queue')
    .update({ resolved_at: new Date().toISOString() })
    .eq('contact_id', contact.id);
  stats.resolved++;
}

async function markUnresolved(
  supabase: ReturnType<typeof createClient>,
  contact: LidContact,
  reason: string,
) {
  const cf = { ...(contact.custom_fields || {}) } as Record<string, unknown>;
  cf.lid_unresolved = true;
  cf.lid_last_reason = reason;
  await supabase.from('contacts').update({ custom_fields: cf }).eq('id', contact.id);
  // Upsert into queue and bump attempts
  await supabase.from('lid_resolution_queue').upsert({
    contact_id: contact.id,
    label_id: contact.label_id || contact.phone.replace(/^LID_/, ''),
    user_id: contact.user_id,
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
    last_error: reason,
  }, { onConflict: 'contact_id' });
}

async function run(mode: 'all' | 'queue'): Promise<ResolveStats> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const stats: ResolveStats = { scanned: 0, resolved: 0, merged: 0, unresolved: 0, errors: 0 };

  // Load LID contacts (chunk to avoid URL length limits)
  let list: LidContact[] = [];

  if (mode === 'queue') {
    const { data: q, error: qErr } = await supabase
      .from('lid_resolution_queue')
      .select('contact_id')
      .is('resolved_at', null)
      .lt('attempts', 10)
      .limit(1000);
    if (qErr) throw new Error(`load queue: ${qErr.message}`);
    const ids = (q || []).map((r) => r.contact_id as string);
    if (ids.length === 0) return stats;
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from('contacts')
        .select('id, user_id, phone, label_id, name, custom_fields')
        .in('id', slice);
      if (error) throw new Error(`load contacts: ${error.message} | code=${(error as any).code} | details=${(error as any).details} | hint=${(error as any).hint}`);
      if (data) list = list.concat(data as LidContact[]);
    }
  } else {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, user_id, phone, label_id, name, custom_fields')
      .like('phone', 'LID_%')
      .limit(5000);
    if (error) throw new Error(`load contacts: ${error.message}`);
    list = (data || []) as LidContact[];
  }

  stats.scanned = list.length;
  if (list.length === 0) return stats;

  // Group by user_id
  const byUser = new Map<string, LidContact[]>();
  for (const c of list) {
    const arr = byUser.get(c.user_id) || [];
    arr.push(c);
    byUser.set(c.user_id, arr);
  }

  for (const [userId, userContacts] of byUser.entries()) {
    // Fetch instances for this user (connected ones first)
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('evolution_instance_name, instance_name, status')
      .eq('user_id', userId);
    const instanceNames = Array.from(new Set(
      (instances || [])
        .map((i) => i.evolution_instance_name || i.instance_name)
        .filter(Boolean),
    )) as string[];

    // Build combined LID map across all instances
    const lidMap = new Map<string, string>();
    for (const name of instanceNames) {
      const m = await fetchInstanceContacts(name);
      for (const [k, v] of m.entries()) if (!lidMap.has(k)) lidMap.set(k, v);
    }
    console.log(`[resolve-lid] user=${userId} contacts=${userContacts.length} mappings=${lidMap.size}`);

    for (const c of userContacts) {
      try {
        const labelId = (c.label_id || c.phone.replace(/^LID_/, '')).trim();
        const real = lidMap.get(labelId);
        if (real) {
          await processContact(supabase, c, real, stats);
        } else {
          await markUnresolved(supabase, c, 'no_mapping_in_evolution');
          stats.unresolved++;
        }
      } catch (e) {
        console.error('[resolve-lid] contact error', c.id, (e as Error).message);
        stats.errors++;
      }
    }
  }

  return stats;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    let mode: 'all' | 'queue' = 'all';
    try {
      const body = await req.json();
      if (body?.mode === 'queue') mode = 'queue';
    } catch (_) { /* no body */ }

    // queue-mode is allowed for the internal cron (no auth required)
    if (mode !== 'queue') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const isServiceRole = token === SERVICE_ROLE_KEY;

      if (!isServiceRole) {
        const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user } } = await userClient.auth.getUser();
        if (!user) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
        const { data: roleRow } = await admin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        if (!roleRow) {
          return new Response(JSON.stringify({ error: 'forbidden' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }


    const stats = await run(mode);
    return new Response(JSON.stringify({ success: true, mode, stats }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[resolve-lid] fatal', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
