-- Adicionar campo notification_instance_id na tabela organizations
ALTER TABLE public.organizations 
ADD COLUMN notification_instance_id uuid REFERENCES whatsapp_instances(id);

COMMENT ON COLUMN public.organizations.notification_instance_id 
IS 'Instância WhatsApp usada para enviar notificações para membros da equipe';