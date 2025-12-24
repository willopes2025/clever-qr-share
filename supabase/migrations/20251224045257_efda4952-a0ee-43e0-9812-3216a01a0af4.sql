-- Create conversation analysis reports table
CREATE TABLE public.conversation_analysis_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Overall scores (0-100)
  overall_score INTEGER NOT NULL,
  textual_quality_score INTEGER NOT NULL,
  communication_score INTEGER NOT NULL,
  sales_score INTEGER NOT NULL,
  efficiency_score INTEGER NOT NULL,
  audio_analysis_score INTEGER NOT NULL,
  
  -- Statistics
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_messages_sent INTEGER NOT NULL DEFAULT 0,
  total_messages_received INTEGER NOT NULL DEFAULT 0,
  total_audios_analyzed INTEGER NOT NULL DEFAULT 0,
  
  -- Detailed feedback (JSON)
  executive_summary TEXT NOT NULL,
  strengths JSONB NOT NULL DEFAULT '[]',
  improvements JSONB NOT NULL DEFAULT '[]',
  recommendations JSONB NOT NULL DEFAULT '[]',
  highlighted_examples JSONB NOT NULL DEFAULT '[]',
  
  -- Individual conversation analysis
  conversation_details JSONB NOT NULL DEFAULT '[]',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'processing',
  error_message TEXT
);

-- Enable RLS
ALTER TABLE public.conversation_analysis_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own reports" 
ON public.conversation_analysis_reports 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" 
ON public.conversation_analysis_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
ON public.conversation_analysis_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
ON public.conversation_analysis_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_analysis_reports_user_date ON public.conversation_analysis_reports(user_id, created_at DESC);