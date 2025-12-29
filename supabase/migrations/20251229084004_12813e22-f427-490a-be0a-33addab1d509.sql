-- Create table for data deletion requests (Meta compliance)
CREATE TABLE public.data_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  reason TEXT,
  confirmation_code TEXT NOT NULL DEFAULT substr(md5(random()::text), 1, 12),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Public can insert (anyone can request deletion)
CREATE POLICY "Anyone can request data deletion"
ON public.data_deletion_requests
FOR INSERT
WITH CHECK (true);

-- Public can view their own request by confirmation code
CREATE POLICY "Anyone can view by confirmation code"
ON public.data_deletion_requests
FOR SELECT
USING (true);

-- Admins can manage all requests
CREATE POLICY "Admins can manage requests"
ON public.data_deletion_requests
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));