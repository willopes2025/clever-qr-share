-- Adicionar novos campos na tabela whatsapp_instances
ALTER TABLE whatsapp_instances 
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_status TEXT,
  ADD COLUMN IF NOT EXISTS is_business BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_label TEXT;

-- Trigger para atualizar connected_at e limpar dados quando status muda
CREATE OR REPLACE FUNCTION update_instance_connection_data()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'connected' AND (OLD.status IS NULL OR OLD.status != 'connected') THEN
    NEW.connected_at = NOW();
  ELSIF NEW.status != 'connected' AND OLD.status = 'connected' THEN
    -- Limpar dados do perfil quando desconectar
    NEW.phone_number = NULL;
    NEW.profile_name = NULL;
    NEW.profile_picture_url = NULL;
    NEW.profile_status = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Dropar trigger se existir e recriar
DROP TRIGGER IF EXISTS trg_update_connection_data ON whatsapp_instances;

CREATE TRIGGER trg_update_connection_data
  BEFORE UPDATE ON whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_instance_connection_data();