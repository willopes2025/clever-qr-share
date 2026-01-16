-- Fix PUBLIC_USER_DATA vulnerability on ai_token_transactions
-- The "Service role can manage all transactions" policy with USING(true) makes ALL transactions publicly readable
-- Service role bypasses RLS entirely, so this policy is not needed for service role access

-- Drop the overly permissive "service role" policies that actually allow public access
DROP POLICY IF EXISTS "Service role can manage all transactions" ON public.ai_token_transactions;
DROP POLICY IF EXISTS "Service role can manage all token balances" ON public.user_ai_tokens;

-- The existing user-specific policies are correct:
-- "Users can view their own transactions" with USING (auth.uid() = user_id)
-- "Users can insert their own transactions" with WITH CHECK (auth.uid() = user_id)
-- These ensure users can only access their own data

-- Note: Service role connections bypass RLS entirely, so no explicit policy is needed for service role access