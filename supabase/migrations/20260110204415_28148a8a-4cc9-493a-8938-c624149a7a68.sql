-- Adicionar campo para armazenar o nome original da instância na Evolution API
ALTER TABLE whatsapp_instances 
ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT;

-- Copiar os nomes atuais como nome da Evolution para instâncias que ainda não têm
UPDATE whatsapp_instances 
SET evolution_instance_name = instance_name 
WHERE evolution_instance_name IS NULL;

-- Corrigir a instância Centro de Saúde Visual especificamente
UPDATE whatsapp_instances 
SET evolution_instance_name = 'Csv ket' 
WHERE instance_name = 'Centro de Saúde Visual';

-- Criar índice para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_evolution_name 
ON whatsapp_instances(evolution_instance_name);