-- Restrict user_ai_tokens UPDATE so users cannot inflate their own balance
DROP POLICY IF EXISTS "Users can update their own token balance" ON public.user_ai_tokens;

-- Only service role / SECURITY DEFINER functions can modify balances.
-- Authenticated users have no direct UPDATE privilege.
-- (Existing SELECT and INSERT policies are preserved.)