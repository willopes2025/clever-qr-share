-- Drop existing constraint and add new one with admin transfer types
ALTER TABLE public.ai_token_transactions 
DROP CONSTRAINT ai_token_transactions_type_check;

ALTER TABLE public.ai_token_transactions 
ADD CONSTRAINT ai_token_transactions_type_check 
CHECK (type = ANY (ARRAY['purchase', 'consumption', 'refund', 'bonus', 'admin_transfer_in', 'admin_transfer_out']));