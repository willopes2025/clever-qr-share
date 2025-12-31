-- Fix function search path for security
CREATE OR REPLACE FUNCTION generate_contact_display_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Formato: número com 4+ dígitos (ex: 0001, 0123, 1234)
  NEW.contact_display_id := LPAD(NEW.contact_number::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;