import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, buildRawMime, EmailChannel } from '../_shared/gmail.ts';

const MAX_PER_TICK = 200;

function renderVars(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, k) => {
    const v = vars?.[k];
    return v == null ? '' : String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const now = new Date();
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const { data: campaigns } = await admin.from('email_campaigns').select('*')
      .eq('status', 'running').limit(20);

    for (const campaign of (campaigns ?? [])) {
      // Rate-limit per campaign
      if (campaign.last_dispatch_at) {
        const nextAt = new Date(new Date(campaign.last_dispatch_at).getTime() + (campaign.batch_interval_seconds ?? 60) * 1000);
        if (nextAt > now) continue;
      }

      const { data: channel } = await admin.from('email_channels').select('*').eq('id', campaign.channel_id).maybeSingle();
      if (!channel) {
        await admin.from('email_campaigns').update({ status: 'failed' }).eq('id', campaign.id);
        continue;
      }

      let accessToken: string;
      try {
        accessToken = await ensureFreshGmailToken(admin, channel as EmailChannel);
      } catch (e) {
        console.error('token refresh failed for campaign', campaign.id, e);
        continue;
      }

      const { data: batch } = await admin.from('email_campaign_recipients').select('*')
        .eq('campaign_id', campaign.id).eq('status', 'pending')
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(Math.min(campaign.batch_size ?? 20, MAX_PER_TICK));

      if (!batch || batch.length === 0) {
        const { count } = await admin.from('email_campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id).eq('status', 'pending');
        if ((count ?? 0) === 0) {
          await admin.from('email_campaigns').update({
            status: 'completed', completed_at: new Date().toISOString(),
          }).eq('id', campaign.id);
        }
        continue;
      }

      for (const rec of batch) {
        processed++;
        await admin.from('email_campaign_recipients').update({ status: 'sending', attempts: (rec.attempts ?? 0) + 1 }).eq('id', rec.id);

        const vars = { name: rec.name ?? '', email: rec.email, ...(rec.variables as Record<string, unknown> ?? {}) };
        const subject = renderVars(campaign.subject, vars);
        const html = renderVars(campaign.body_html, vars);
        const text = campaign.body_text ? renderVars(campaign.body_text, vars) : undefined;

        try {
          const raw = buildRawMime({
            fromName: channel.display_name, fromEmail: channel.email_address,
            to: [rec.email], subject, html, text,
          });
          const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw }),
          });
          if (!res.ok) {
            const body = await res.text();
            failed++;
            const isFinal = (rec.attempts ?? 0) + 1 >= 3;
            await admin.from('email_campaign_recipients').update({
              status: isFinal ? 'failed' : 'pending',
              scheduled_at: isFinal ? rec.scheduled_at : new Date(Date.now() + 5 * 60_000).toISOString(),
              error_message: `[${res.status}] ${body.slice(0, 500)}`,
            }).eq('id', rec.id);
          } else {
            const j = await res.json();
            sent++;
            await admin.from('email_campaign_recipients').update({
              status: 'sent', sent_at: new Date().toISOString(),
              provider_message_id: j.id, provider_thread_id: j.threadId, error_message: null,
            }).eq('id', rec.id);
          }
        } catch (e) {
          failed++;
          const isFinal = (rec.attempts ?? 0) + 1 >= 3;
          await admin.from('email_campaign_recipients').update({
            status: isFinal ? 'failed' : 'pending',
            scheduled_at: isFinal ? rec.scheduled_at : new Date(Date.now() + 5 * 60_000).toISOString(),
            error_message: String(e).slice(0, 500),
          }).eq('id', rec.id);
        }
      }

      // Update stats + last_dispatch
      const { data: agg } = await admin.rpc('exec_sql' as never, {}).then(() => ({ data: null })).catch(() => ({ data: null }));
      const { data: counts } = await admin.from('email_campaign_recipients')
        .select('status').eq('campaign_id', campaign.id);
      const stats = { pending: 0, sent: 0, failed: 0, sending: 0, total: counts?.length ?? 0 };
      for (const r of (counts ?? [])) stats[(r as { status: keyof typeof stats }).status] = (stats[(r as { status: keyof typeof stats }).status] ?? 0) + 1;

      await admin.from('email_campaigns').update({
        last_dispatch_at: new Date().toISOString(),
        stats,
        ...(stats.pending === 0 && stats.sending === 0
          ? { status: 'completed', completed_at: new Date().toISOString() }
          : {}),
      }).eq('id', campaign.id);
    }

    return new Response(JSON.stringify({ ok: true, processed, sent, failed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-campaign-dispatch error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
