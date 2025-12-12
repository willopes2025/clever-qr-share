-- Add warming_level column to whatsapp_instances
ALTER TABLE public.whatsapp_instances
ADD COLUMN warming_level INTEGER NOT NULL DEFAULT 1;

-- Add constraint to ensure valid range (1-5)
ALTER TABLE public.whatsapp_instances
ADD CONSTRAINT warming_level_range CHECK (warming_level >= 1 AND warming_level <= 5);

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_instances.warming_level IS 'Nível de aquecimento: 1=Frio, 2=Morno, 3=Aquecendo, 4=Quente, 5=Muito Quente';