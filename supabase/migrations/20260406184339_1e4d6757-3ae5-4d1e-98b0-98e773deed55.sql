
CREATE TABLE public.billing_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  asaas_payment_id TEXT NOT NULL,
  asaas_customer_id TEXT,
  reminder_type TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  message_content TEXT,
  due_date DATE,
  value NUMERIC,
  billing_type TEXT,
  invoice_url TEXT,
  bank_slip_url TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own billing reminders"
  ON public.billing_reminders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own billing reminders"
  ON public.billing_reminders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own billing reminders"
  ON public.billing_reminders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own billing reminders"
  ON public.billing_reminders FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_billing_reminders_status_scheduled
  ON public.billing_reminders (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX idx_billing_reminders_payment_id
  ON public.billing_reminders (asaas_payment_id);

CREATE INDEX idx_billing_reminders_user_id
  ON public.billing_reminders (user_id);

CREATE TRIGGER update_billing_reminders_updated_at
  BEFORE UPDATE ON public.billing_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
