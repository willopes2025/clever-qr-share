
DO $$
DECLARE
  v_from uuid := '45286d2f-8a91-4935-b07d-c6a6a2650424';
  v_to   uuid := 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9';
  v_max_lead int;
  r record;
BEGIN
  -- Merge duplicate contacts by phone
  FOR r IN
    SELECT c1.id AS joao_id, c2.id AS wil_id
    FROM public.contacts c1
    JOIN public.contacts c2 ON c1.phone = c2.phone AND c2.user_id = v_to
    WHERE c1.user_id = v_from
  LOOP
    UPDATE public.conversations        SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    UPDATE public.funnel_deals         SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    UPDATE public.conversation_notes   SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    UPDATE public.conversation_tasks   SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    UPDATE public.contact_activity_log SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    UPDATE public.contact_tags         SET contact_id = r.wil_id WHERE contact_id = r.joao_id;
    DELETE FROM public.contacts WHERE id = r.joao_id;
  END LOOP;

  -- Merge duplicate conversations: Joao conv (contact already has William conv) -> move messages and delete Joao conv
  FOR r IN
    SELECT cj.id AS joao_conv, cw.id AS wil_conv
    FROM public.conversations cj
    JOIN public.conversations cw ON cj.contact_id = cw.contact_id AND cw.user_id = v_to
    WHERE cj.user_id = v_from
  LOOP
    UPDATE public.inbox_messages      SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.conversation_notes  SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.conversation_tasks  SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.contact_activity_log SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.conversation_tag_assignments SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.conversation_stage_data SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.funnel_deals        SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    UPDATE public.chatbot_executions  SET conversation_id = r.wil_conv WHERE conversation_id = r.joao_conv;
    DELETE FROM public.conversations WHERE id = r.joao_conv;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.contacts WHERE user_id = v_from
  )
  UPDATE public.contacts c
  SET user_id = v_to,
      contact_display_id = 'JP-' || ranked.rn::text
  FROM ranked WHERE ranked.id = c.id;

  SELECT COALESCE(MAX(lead_number),0) INTO v_max_lead FROM public.funnel_deals WHERE user_id = v_to;
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
    FROM public.funnel_deals WHERE user_id = v_from
  )
  UPDATE public.funnel_deals d
  SET user_id = v_to,
      lead_number = v_max_lead + ranked.rn
  FROM ranked WHERE ranked.id = d.id;

  UPDATE public.chatbot_flows         SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.chatbot_flow_nodes    SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.chatbot_flow_edges    SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.chatbot_executions    SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.conversations         SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.inbox_messages        SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.message_templates     SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.broadcast_lists       SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.conversation_notes    SET user_id = v_to WHERE user_id = v_from;
  UPDATE public.conversation_tasks    SET user_id = v_to WHERE user_id = v_from;
END $$;
