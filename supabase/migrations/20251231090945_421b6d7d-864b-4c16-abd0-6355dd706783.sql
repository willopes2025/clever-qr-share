-- Tabela de pacotes de tokens AI (mapeamento com Stripe)
CREATE TABLE public.ai_token_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tokens INTEGER NOT NULL,
  price_brl NUMERIC NOT NULL,
  stripe_price_id TEXT NOT NULL UNIQUE,
  stripe_product_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de saldo de tokens por usuário
CREATE TABLE public.user_ai_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance BIGINT NOT NULL DEFAULT 0,
  total_purchased BIGINT NOT NULL DEFAULT 0,
  total_consumed BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações de tokens
CREATE TABLE public.ai_token_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'consumption', 'refund', 'bonus')),
  amount BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  description TEXT,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  package_id UUID REFERENCES public.ai_token_packages(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_token_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_token_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para ai_token_packages (leitura pública)
CREATE POLICY "Anyone can view active packages" 
ON public.ai_token_packages 
FOR SELECT 
USING (is_active = true);

-- Políticas para user_ai_tokens
CREATE POLICY "Users can view their own token balance" 
ON public.user_ai_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own token balance" 
ON public.user_ai_tokens 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own token balance" 
ON public.user_ai_tokens 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all token balances" 
ON public.user_ai_tokens 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Políticas para ai_token_transactions
CREATE POLICY "Users can view their own transactions" 
ON public.ai_token_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
ON public.ai_token_transactions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions" 
ON public.ai_token_transactions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_user_ai_tokens_updated_at
BEFORE UPDATE ON public.user_ai_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ai_token_transactions_user_id ON public.ai_token_transactions(user_id);
CREATE INDEX idx_ai_token_transactions_created_at ON public.ai_token_transactions(created_at DESC);
CREATE INDEX idx_ai_token_packages_display_order ON public.ai_token_packages(display_order);

-- Inserir os pacotes de tokens
INSERT INTO public.ai_token_packages (name, tokens, price_brl, stripe_price_id, stripe_product_id, display_order) VALUES
  ('Starter', 100000, 4.90, 'price_1SkLN5IuIJFtamjKsBA2YYvM', 'prod_Thks8sobtaJG1o', 1),
  ('Básico', 500000, 14.90, 'price_1SkLNwIuIJFtamjKG0Tp8FRk', 'prod_Thkt6AC0u9Zu3U', 2),
  ('Profissional', 2000000, 39.90, 'price_1SkLOHIuIJFtamjK6jDto94q', 'prod_ThkuBHXZZmhZA1', 3),
  ('Agência', 10000000, 149.90, 'price_1SkLOUIuIJFtamjK7HnDL4Vz', 'prod_Thkued1hl8Nta8', 4),
  ('Enterprise', 50000000, 597.00, 'price_1SkLOgIuIJFtamjKkKO5pei0', 'prod_ThkuX1HFgY9PNt', 5);