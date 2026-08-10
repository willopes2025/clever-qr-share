import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, buildRawMime, EmailChannel } from '../_shared/gmail.ts';
import { ensureFreshMsToken, MsChannel } from '../_shared/microsoft.ts';
import { sendMailSmtp, buildSimpleMime } from '../_shared/smtp-native.ts';
import { loadAttachments, AttachmentMeta } from '../_shared/email-attachments.ts';
import { resolveOrgTimezone } from '../_shared/timezone.ts';

const MAX_PER_TICK = 200;

function renderVars(tpl: string, vars: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, k) => {
    const v = vars?.[k];
    return v == null ? '' : String(v);
  });
}

/** Returns true when `now` falls inside the campaign's allowed weekday + hour window. */
function isWithinSendWindow(
  now: Date,
  timezone: string,
  days: number[] | null,
  startHour: number | null,
  endHour: number | null,
): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const weekdayName = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = map[weekdayName] ?? 0;

  const allowedDays = Array.isArray(days) && days.length > 0 ? days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  if (!allowedDays.includes(weekday)) return false;

  const start = startHour ?? 0;
  const end = endHour ?? 24;
  return hour >= start && hour < end;
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

      const provider = channel.provider as string;
      let accessToken = '';
      try {
        if (provider === 'gmail') {
          accessToken = await ensureFreshGmailToken(admin, channel as EmailChannel);
        } else if (provider === 'microsoft') {
          accessToken = await ensureFreshMsToken(admin, channel as MsChannel);
        } else if (provider === 'imap') {
          if (!channel.smtp_host || !channel.smtp_port || !channel.auth_username || !channel.auth_password) {
            throw new Error('SMTP não configurado para este canal');
          }
        } else {
          throw new Error(`provider ${provider} não suportado`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('channel preparation failed for campaign', campaign.id, msg);
        await admin.from('email_campaigns').update({
          status: 'failed',
          stats: { ...(campaign.stats ?? {}), last_error: msg.slice(0, 500) },
        }).eq('id', campaign.id);
        continue;
      }

      // Load campaign attachments once per tick.
      let campaignAttachments: Awaited<ReturnType<typeof loadAttachments>> = [];
      const attMeta: AttachmentMeta[] = Array.isArray(campaign.attachments) ? campaign.attachments : [];
      if (attMeta.length > 0) {
        try {
          campaignAttachments = await loadAttachments(admin, attMeta);
        } catch (attErr) {
          console.error('campaign attachments failed', campaign.id, attErr);
          await admin.from('email_campaigns').update({
            status: 'failed',
            stats: { ...(campaign.stats ?? {}), last_error: String(attErr).slice(0, 500) },
          }).eq('id', campaign.id);
          continue;
        }
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
        let html = renderVars(campaign.body_html, vars);
        let text = campaign.body_text ? renderVars(campaign.body_text, vars) : undefined;

        const sig = (channel as { signature_html?: string | null }).signature_html;
        if (sig && sig.trim()) {
          html = `${html}<br/><br/>${sig}`;
          const sigText = sig.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
          if (sigText) text = `${text ?? ''}\n\n${sigText}`;
        }

        const markFailure = async (message: string) => {
          failed++;
          const isFinal = (rec.attempts ?? 0) + 1 >= 3;
          await admin.from('email_campaign_recipients').update({
            status: isFinal ? 'failed' : 'pending',
            scheduled_at: isFinal ? rec.scheduled_at : new Date(Date.now() + 5 * 60_000).toISOString(),
            error_message: message.slice(0, 500),
          }).eq('id', rec.id);
        };

        try {
          if (provider === 'gmail') {
            const raw = buildRawMime({
              fromName: channel.display_name, fromEmail: channel.email_address,
              to: [rec.email], subject, html, text,
              attachments: campaignAttachments,
            });
            const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ raw }),
            });
            if (!res.ok) {
              await markFailure(`[${res.status}] ${await res.text()}`);
            } else {
              const j = await res.json();
              sent++;
              await admin.from('email_campaign_recipients').update({
                status: 'sent', sent_at: new Date().toISOString(),
                provider_message_id: j.id, provider_thread_id: j.threadId, error_message: null,
              }).eq('id', rec.id);
            }
          } else if (provider === 'microsoft') {
            const msg: Record<string, unknown> = {
              subject,
              body: { contentType: html ? 'HTML' : 'Text', content: html ?? text ?? '' },
              toRecipients: [{ emailAddress: { address: rec.email } }],
              ...(campaignAttachments.length > 0
                ? {
                    attachments: campaignAttachments.map((a) => ({
                      '@odata.type': '#microsoft.graph.fileAttachment',
                      name: a.filename,
                      contentType: a.contentType,
                      contentBytes: a.base64,
                    })),
                  }
                : {}),
            };
            const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: msg, saveToSentItems: true }),
            });
            if (!res.ok) {
              await markFailure(`[${res.status}] ${await res.text()}`);
            } else {
              sent++;
              await admin.from('email_campaign_recipients').update({
                status: 'sent', sent_at: new Date().toISOString(),
                provider_message_id: crypto.randomUUID(), error_message: null,
              }).eq('id', rec.id);
            }
          } else {
            // IMAP / SMTP
            const port = Number(channel.smtp_port);
            const raw = buildSimpleMime({
              fromName: channel.display_name,
              fromEmail: channel.email_address,
              to: [rec.email], cc: [], subject, html, text, inReplyTo: null,
              attachments: campaignAttachments,
            });
            await sendMailSmtp(
              {
                host: channel.smtp_host,
                port,
                secure: port === 465,
                username: channel.auth_username,
                password: channel.auth_password,
              },
              { from: channel.email_address, to: [rec.email], raw },
            );
            sent++;
            await admin.from('email_campaign_recipients').update({
              status: 'sent', sent_at: new Date().toISOString(),
              provider_message_id: `imap-${Date.now()}-${crypto.randomUUID()}`, error_message: null,
            }).eq('id', rec.id);
          }
        } catch (e) {
          await markFailure(String(e));
        }
      }

      // Update stats + last_dispatch
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
