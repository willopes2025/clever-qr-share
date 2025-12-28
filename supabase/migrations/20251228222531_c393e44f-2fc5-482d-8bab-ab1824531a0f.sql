-- Adicionar coluna company_context para organizações
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS company_context TEXT;

-- Adicionar coluna template_type para ai_agent_configs
ALTER TABLE public.ai_agent_configs 
ADD COLUMN IF NOT EXISTS template_type TEXT;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.organizations.company_context IS 'Descrição da empresa para personalização de agentes de IA';
COMMENT ON COLUMN public.ai_agent_configs.template_type IS 'Tipo de template usado para criar o agente (sdr, receptionist, sales, support, scheduler, followup, faq)';