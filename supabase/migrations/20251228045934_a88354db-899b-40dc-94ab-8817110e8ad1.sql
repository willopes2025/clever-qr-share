-- Adicionar campo para controle de correção automática por membro
ALTER TABLE public.team_members
ADD COLUMN auto_correct_enabled boolean DEFAULT false;

-- Comentário para documentação
COMMENT ON COLUMN public.team_members.auto_correct_enabled IS 'Quando ativado, corrige automaticamente gramática e ortografia das mensagens do inbox antes de enviar';