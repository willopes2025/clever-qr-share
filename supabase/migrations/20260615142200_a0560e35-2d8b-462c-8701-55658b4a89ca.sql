GRANT ALL ON public.lid_resolution_queue TO service_role;
GRANT SELECT ON public.lid_resolution_queue TO authenticated;

INSERT INTO public.lid_resolution_queue (contact_id, label_id, user_id, attempts)
SELECT id, label_id, user_id, 0
FROM public.contacts
WHERE phone LIKE 'LID_%' AND label_id IS NOT NULL
ON CONFLICT (contact_id) DO NOTHING;