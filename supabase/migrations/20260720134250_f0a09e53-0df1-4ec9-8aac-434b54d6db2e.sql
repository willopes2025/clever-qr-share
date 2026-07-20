
UPDATE public.funnel_automations
SET action_type = 'send_meta_template'::funnel_action_type,
    action_config = jsonb_build_object(
      'meta_template_id', '7fc81f54-0191-468b-ad51-341c7508043d',
      'meta_phone_number_id', '1094594580394816',
      'variable_mappings', jsonb_build_array(
        jsonb_build_object('variable_index', 1, 'source', 'contact_name'),
        jsonb_build_object('variable_index', 2, 'source', 'lead_custom_field', 'field_key', 'valor_da_venda'),
        jsonb_build_object('variable_index', 3, 'source', 'lead_custom_field', 'field_key', 'valor_da_entrada'),
        jsonb_build_object('variable_index', 4, 'source', 'lead_custom_field', 'field_key', 'data_da_entrada'),
        jsonb_build_object('variable_index', 5, 'source', 'lead_custom_field', 'field_key', 'forma_de_pagamento')
      )
    )
WHERE id = '29c9399f-1736-456d-bec5-09f0c13f4e21';

UPDATE public.funnel_automations
SET action_type = 'send_meta_template'::funnel_action_type,
    action_config = (action_config - 'message') || jsonb_build_object(
      'meta_template_id', 'f1df3564-e4ac-4b20-a4f2-e492c9d652f9',
      'meta_phone_number_id', '1094594580394816',
      'variable_mappings', jsonb_build_array(
        jsonb_build_object('variable_index', 1, 'source', 'lead_custom_field', 'field_key', 'data_da_entrada'),
        jsonb_build_object('variable_index', 2, 'source', 'lead_custom_field', 'field_key', 'valor_da_entrada')
      )
    )
WHERE id = '3a565660-7748-4b39-b10a-d91e13f00708';

UPDATE public.funnel_automations
SET action_type = 'send_meta_template'::funnel_action_type,
    action_config = jsonb_build_object(
      'meta_template_id', 'f1df3564-e4ac-4b20-a4f2-e492c9d652f9',
      'meta_phone_number_id', '1094594580394816',
      'variable_mappings', jsonb_build_array(
        jsonb_build_object('variable_index', 1, 'source', 'lead_custom_field', 'field_key', 'data_da_entrada'),
        jsonb_build_object('variable_index', 2, 'source', 'lead_custom_field', 'field_key', 'valor_da_entrada')
      )
    )
WHERE id = 'dcabe62c-f979-468b-ab5c-72245232480c';

UPDATE public.funnel_automations
SET action_type = 'send_meta_template'::funnel_action_type,
    action_config = jsonb_build_object(
      'meta_template_id', '9a8585ea-50d2-433e-896a-def724cb429e',
      'meta_phone_number_id', '1094594580394816',
      'variable_mappings', jsonb_build_array(
        jsonb_build_object('variable_index', 1, 'source', 'contact_name')
      )
    )
WHERE id = '855a9a3b-6d5c-4987-87f6-d3744ab2de76';

UPDATE public.funnel_automations
SET action_type = 'send_meta_template'::funnel_action_type,
    action_config = jsonb_build_object(
      'meta_template_id', '62cb4705-6cda-423e-87ae-112c0e1665ea',
      'meta_phone_number_id', '1094594580394816',
      'variable_mappings', jsonb_build_array(
        jsonb_build_object('variable_index', 1, 'source', 'contact_name')
      )
    )
WHERE id = '37f3b455-e627-48f9-a823-7aa11ced04e9';
