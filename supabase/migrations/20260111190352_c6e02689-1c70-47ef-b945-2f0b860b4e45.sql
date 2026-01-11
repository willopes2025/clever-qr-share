-- Insert the existing Meta WhatsApp number
INSERT INTO public.meta_whatsapp_numbers (user_id, phone_number_id, display_name, phone_number)
VALUES (
  'b3e1967e-cd4c-4835-8b3c-df65740a4fb9',
  '873808799139009',
  'Meta WhatsApp API',
  '+552720181290'
)
ON CONFLICT (user_id, phone_number_id) DO NOTHING;