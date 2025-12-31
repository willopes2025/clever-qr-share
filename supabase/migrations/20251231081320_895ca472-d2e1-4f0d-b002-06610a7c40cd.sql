-- Adicionar colunas para Contact ID sequencial
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS contact_number SERIAL,
  ADD COLUMN IF NOT EXISTS contact_display_id TEXT;

-- Criar índice para busca rápida por ID
CREATE INDEX IF NOT EXISTS idx_contacts_display_id ON contacts(contact_display_id);

-- Trigger para gerar ID formatado automaticamente
CREATE OR REPLACE FUNCTION generate_contact_display_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Formato: número com 4+ dígitos (ex: 0001, 0123, 1234)
  NEW.contact_display_id := LPAD(NEW.contact_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger se existir e recriar
DROP TRIGGER IF EXISTS trigger_generate_contact_id ON contacts;

CREATE TRIGGER trigger_generate_contact_id
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION generate_contact_display_id();

-- Preencher IDs dos contatos existentes por ordem de criação
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as num
  FROM contacts
  WHERE contact_display_id IS NULL OR contact_display_id = ''
)
UPDATE contacts SET 
  contact_number = n.num::INTEGER,
  contact_display_id = LPAD(n.num::TEXT, 4, '0')
FROM numbered n
WHERE contacts.id = n.id;