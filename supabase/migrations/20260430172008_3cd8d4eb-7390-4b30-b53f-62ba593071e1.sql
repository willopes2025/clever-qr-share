
CREATE UNIQUE INDEX IF NOT EXISTS conversation_tags_user_lower_name_uniq
ON public.conversation_tags (user_id, lower(name));
