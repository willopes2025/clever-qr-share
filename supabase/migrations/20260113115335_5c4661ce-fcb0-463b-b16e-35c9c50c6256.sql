-- ===========================================
-- FIX 1: data_deletion_requests - Remove public SELECT policy
-- Replace with verification-only access
-- ===========================================

-- Drop the overly permissive policy that exposes all deletion requests
DROP POLICY IF EXISTS "Anyone can view by confirmation code" ON public.data_deletion_requests;

-- Create a restricted policy that only allows viewing own request by ID + confirmation code
-- This will be used via Edge Function for verification
-- Note: The actual verification should happen in an Edge Function, not client-side
CREATE POLICY "Users can view their own request by confirmation code"
ON public.data_deletion_requests
FOR SELECT
USING (false); -- Block all direct SELECT - verification via Edge Function only

-- ===========================================
-- FIX 2: ai_agent_integrations - Remove public service role policy
-- Only authenticated users should access their own integrations
-- ===========================================

-- Drop the overly permissive "Service role" policy that has USING (true)
DROP POLICY IF EXISTS "Service role can manage all integrations" ON public.ai_agent_integrations;

-- ===========================================
-- FIX 3: ai_knowledge_suggestions - Remove public service role policy
-- Already has proper user-scoped policies for CRUD
-- ===========================================

-- Drop the overly permissive "Service role" policy that has USING (true)
DROP POLICY IF EXISTS "Service role can manage all suggestions" ON public.ai_knowledge_suggestions;