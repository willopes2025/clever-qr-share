CREATE OR REPLACE FUNCTION public.funnel_deals_autofill_tracking_from_ad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad jsonb;
BEGIN
  IF (NEW.tracking IS NULL OR NEW.tracking = '{}'::jsonb)
     AND NEW.conversation_id IS NOT NULL THEN
    SELECT im.ad_reply
      INTO v_ad
      FROM public.inbox_messages im
     WHERE im.conversation_id = NEW.conversation_id
       AND im.ad_reply IS NOT NULL
       AND jsonb_typeof(im.ad_reply) = 'object'
     ORDER BY im.created_at ASC
     LIMIT 1;

    IF v_ad IS NOT NULL THEN
      NEW.tracking := jsonb_strip_nulls(jsonb_build_object(
        'ad_source',     v_ad->>'source',
        'ad_headline',   v_ad->>'headline',
        'ad_body',       v_ad->>'body',
        'ad_source_url', v_ad->>'source_url',
        'ad_source_id',  v_ad->>'source_id',
        'ad_source_type',v_ad->>'source_type',
        'ad_media_type', v_ad->>'media_type',
        'ad_thumbnail_url', v_ad->>'thumbnail_url',
        'ad_ctwa_clid',  v_ad->>'CTWA_clid',
        'origin_channel','click_to_whatsapp'
      ));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;