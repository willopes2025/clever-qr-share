-- Alterar a foreign key de form_submissions para usar ON DELETE CASCADE
-- Isso permitirá excluir contatos mesmo que tenham submissões de formulário associadas

ALTER TABLE public.form_submissions
DROP CONSTRAINT IF EXISTS form_submissions_contact_id_fkey;

ALTER TABLE public.form_submissions
ADD CONSTRAINT form_submissions_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES public.contacts(id)
ON DELETE CASCADE;