-- Adicionar foreign key de internal_messages.user_id para profiles.id
ALTER TABLE public.internal_messages
ADD CONSTRAINT internal_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;