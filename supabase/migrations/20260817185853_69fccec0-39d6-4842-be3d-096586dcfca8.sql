UPDATE public.email_campaigns c SET stats = jsonb_build_object(
  'total', s.total, 'sent', s.sent, 'pending', s.pending, 'failed', s.failed, 'sending', s.sending
) || COALESCE(c.stats,'{}'::jsonb) - 'total' - 'sent' - 'pending' - 'failed' - 'sending'
|| jsonb_build_object('total', s.total, 'sent', s.sent, 'pending', s.pending, 'failed', s.failed, 'sending', s.sending)
FROM (
  SELECT campaign_id,
    count(*) total,
    count(*) FILTER (WHERE status='sent') sent,
    count(*) FILTER (WHERE status='pending') pending,
    count(*) FILTER (WHERE status='failed') failed,
    count(*) FILTER (WHERE status='sending') sending
  FROM public.email_campaign_recipients GROUP BY campaign_id
) s WHERE s.campaign_id = c.id;