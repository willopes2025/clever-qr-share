
-- Fix duplicated option value in "Modelo de Lente" (Multifocal was set to option3, same as Bifocal)
UPDATE public.form_fields
SET options = '[{"label":"Monofocal","value":"option1"},{"label":"Multifocal","value":"option2"},{"label":"Bifocal","value":"option3"}]'::jsonb
WHERE id = '3b0c4a53-8087-4238-8e5e-d721e834a734';

-- Backfill existing submissions where the ambiguous value option3 was stored for this field.
-- Any past submission that stored "option3" for this field could actually be Multifocal OR Bifocal;
-- we cannot reliably distinguish them, so we only fix the schema going forward.
