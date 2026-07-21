import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { ensureFreshGmailToken, buildRawMime, EmailChannel } from '../_shared/gmail.ts';
import { ensureFreshMsToken, MsChannel } from '../_shared/microsoft.ts';
import { sendMailSmtp, buildSimpleMime } from '../_shared/smtp-native.ts';
import { loadAttachments, AttachmentMeta } from '../_shared/email-attachments.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { channel_id, to, cc, bcc, subject, html, text, contact_id, thread_id, in_reply_to, attachments } = body ?? {};
    if (!channel_id || !Array.isArray(to) || to.length === 0 || !subject) {
      return new Response(JSON.stringify({ error: 'channel_id, to[], subject required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const attachmentsMeta: AttachmentMeta[] = Array.isArray(attachments) ? attachments : [];

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: channel, error: chErr } = await admin
      .from('email_channels').select('*').eq('id', channel_id).maybeSingle();
    if (chErr || !channel) throw new Error('channel not found');

    const { data: orgId } = await admin.rpc('resolve_user_organization_id', { _user_id: user.id });
    if (orgId !== channel.organization_id) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let providerMessageId = '';
    let providerThreadId: string | undefined;

    if (thread_id) {
      const { data: th } = await admin
        .from('email_threads').select('provider_thread_id').eq('id', thread_id).maybeSingle();
      providerThreadId = th?.provider_thread_id ?? undefined;
    }

    // Load attachments once (used across providers).
    let preparedAttachments;
    try {
      preparedAttachments = await loadAttachments(admin, attachmentsMeta);
    } catch (attErr) {
      const msg = attErr instanceof Error ? attErr.message : String(attErr);
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Append channel signature (if set) to both HTML and text bodies.
    const sig = (channel as { signature_html?: string | null }).signature_html;
    let outHtml = html as string | undefined;
    let outText = text as string | undefined;
    if (sig && sig.trim()) {
      outHtml = `${outHtml ?? ''}<br/><br/>${sig}`;
      const sigText = sig.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
      if (sigText) outText = `${outText ?? ''}\n\n${sigText}`;
    }

    if (channel.provider === 'gmail') {
      const accessToken = await ensureFreshGmailToken(admin, channel as EmailChannel);
      const raw = buildRawMime({
        fromName: channel.display_name, fromEmail: channel.email_address,
        to, cc, bcc, subject, html, text, inReplyTo: in_reply_to ?? null,
        attachments: preparedAttachments,
      });
      const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw, ...(providerThreadId ? { threadId: providerThreadId } : {}) }),
      });
      if (!sendRes.ok) {
        const errBody = await sendRes.text();
        return new Response(JSON.stringify({ error: 'gmail send failed', status: sendRes.status, details: errBody }), {
          status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const sent = await sendRes.json();
      providerThreadId = sent.threadId;
      providerMessageId = sent.id;
    } else if (channel.provider === 'microsoft') {
      const accessToken = await ensureFreshMsToken(admin, channel as MsChannel);
      const msg: any = {
        subject,
        body: { contentType: html ? 'HTML' : 'Text', content: html ?? text ?? '' },
        toRecipients: (to as string[]).map(a => ({ emailAddress: { address: a } })),
        ccRecipients: (cc ?? []).map((a: string) => ({ emailAddress: { address: a } })),
        bccRecipients: (bcc ?? []).map((a: string) => ({ emailAddress: { address: a } })),
      };
      if (preparedAttachments.length > 0) {
        msg.attachments = preparedAttachments.map(a => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.filename,
          contentType: a.contentType,
          contentBytes: a.base64,
        }));
      }
      const sendRes = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, saveToSentItems: true }),
      });
      if (!sendRes.ok) {
        const errBody = await sendRes.text();
        return new Response(JSON.stringify({ error: 'microsoft send failed', status: sendRes.status, details: errBody }), {
          status: sendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      providerMessageId = crypto.randomUUID(); // Graph sendMail returns no id
    } else if (channel.provider === 'imap') {
      if (!channel.smtp_host || !channel.smtp_port || !channel.auth_username || !channel.auth_password) {
        throw new Error('SMTP não configurado');
      }
      const port = Number(channel.smtp_port);
      const raw = buildSimpleMime({
        fromName: channel.display_name,
        fromEmail: channel.email_address,
        to, cc: cc ?? [], subject, html, text, inReplyTo: in_reply_to ?? null,
        attachments: preparedAttachments,
      });
      const recipients = [
        ...(to as string[]),
        ...((cc as string[] | undefined) ?? []),
        ...((bcc as string[] | undefined) ?? []),
      ];
      try {
        await sendMailSmtp(
          {
            host: channel.smtp_host,
            port,
            // Implicit TLS only on 465. 587/25 use STARTTLS.
            secure: port === 465,
            username: channel.auth_username,
            password: channel.auth_password,
          },
          { from: channel.email_address, to: recipients, raw },
        );
      } catch (smtpErr) {
        const msg = smtpErr instanceof Error ? smtpErr.message : String(smtpErr);
        return new Response(JSON.stringify({ error: `SMTP falhou: ${msg}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      providerMessageId = `imap-${Date.now()}-${crypto.randomUUID()}`;
    } else {
      return new Response(JSON.stringify({ error: `provider ${channel.provider} not supported` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert thread
    let localThreadId = thread_id as string | undefined;
    if (!localThreadId) {
      if (providerThreadId) {
        const { data: existing } = await admin
          .from('email_threads').select('id')
          .eq('channel_id', channel.id).eq('provider_thread_id', providerThreadId).maybeSingle();
        if (existing) localThreadId = existing.id;
      }
      if (!localThreadId) {
        const { data: created, error: thErr } = await admin
          .from('email_threads').insert({
            organization_id: channel.organization_id,
            channel_id: channel.id,
            contact_id: contact_id ?? null,
            subject, provider_thread_id: providerThreadId ?? null,
            last_message_at: new Date().toISOString(),
          }).select('id').single();
        if (thErr) throw thErr;
        localThreadId = created.id;
      }
    }

    await admin.from('email_threads').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', localThreadId!);

    const { data: msg, error: msgErr } = await admin.from('email_messages').insert({
      organization_id: channel.organization_id,
      channel_id: channel.id,
      thread_id: localThreadId!,
      contact_id: contact_id ?? null,
      direction: 'outbound',
      provider_message_id: providerMessageId,
      in_reply_to: in_reply_to ?? null,
      from_address: channel.email_address,
      from_name: channel.display_name,
      to_addresses: to, cc_addresses: cc ?? [], bcc_addresses: bcc ?? [],
      subject, body_html: html ?? null, body_text: text ?? null,
      snippet: (text ?? html ?? '').replace(/<[^>]+>/g, '').slice(0, 200),
      attachments: attachmentsMeta,
      is_read: true, sent_at: new Date().toISOString(),
      sent_by: user.id, status: 'delivered',
    }).select().single();
    if (msgErr) throw msgErr;

    return new Response(JSON.stringify({ ok: true, message_id: msg.id, thread_id: localThreadId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('email-send error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
