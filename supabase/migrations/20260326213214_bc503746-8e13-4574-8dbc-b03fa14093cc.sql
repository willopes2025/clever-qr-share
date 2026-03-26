
-- Move 38 deals with loja='Programa Seven' from James & Jesse's to Programa Seven funnel, Pré-venda stage
-- First log the stage history, then update the deals

-- Update funnel_id and stage_id for matching deals
UPDATE funnel_deals 
SET 
  funnel_id = '55cc4a09-3f29-4fc0-a3c6-538c85b9de02',
  stage_id = 'f7a9299b-b65f-44d1-8304-c194b1de7159',
  entered_stage_at = now(),
  updated_at = now()
WHERE custom_fields->>'loja' ILIKE '%programa seven%'
  AND funnel_id != '55cc4a09-3f29-4fc0-a3c6-538c85b9de02';
