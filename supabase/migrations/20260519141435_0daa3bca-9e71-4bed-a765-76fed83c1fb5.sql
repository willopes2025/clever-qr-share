
UPDATE chatbot_flow_nodes
SET data = jsonb_set(data, '{timeoutMinutes}', '300'::jsonb)
WHERE id = '3180fccf-3060-43b8-bef4-d0aeb5cc31ab';

INSERT INTO chatbot_flow_edges (flow_id, user_id, source_node_id, target_node_id)
VALUES ('3083762d-d133-45d6-a04b-c62c518f1b81', '56244cf5-9813-4e03-bdc0-7a79d5a3a9e3', '6c33bc1f-663a-4eed-8f13-368c8519195b', '577c6c56-523b-4df3-b690-867333b35870');
