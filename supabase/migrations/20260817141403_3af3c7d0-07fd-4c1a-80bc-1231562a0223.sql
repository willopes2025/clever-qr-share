ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS unique_phone_per_user;
DROP INDEX IF EXISTS public.unique_phone_per_user;
CREATE UNIQUE INDEX unique_phone_per_user ON public.contacts USING btree (user_id, phone) WHERE phone <> '';