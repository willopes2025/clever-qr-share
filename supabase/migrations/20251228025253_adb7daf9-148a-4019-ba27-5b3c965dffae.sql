-- Adicionar on_webhook ao enum de trigger
ALTER TYPE funnel_trigger_type ADD VALUE IF NOT EXISTS 'on_webhook';