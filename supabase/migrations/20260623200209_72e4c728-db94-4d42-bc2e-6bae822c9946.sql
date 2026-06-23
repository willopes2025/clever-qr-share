
DO $$
DECLARE
  d_id uuid;
  d_cf jsonb;
  ff RECORD;
  new_cf jsonb;
  current_val jsonb;
  opt jsonb;
  label_map jsonb;
  arr_item text;
  resolved_arr jsonb;
BEGIN
  FOR d_id, d_cf IN
    SELECT id, custom_fields FROM funnel_deals WHERE custom_fields::text ~ 'option[0-9]'
  LOOP
    new_cf := d_cf;
    FOR ff IN
      SELECT DISTINCT ON (x.mapping_target) x.mapping_target, x.options
      FROM (
        SELECT ff2.mapping_target, ff2.options, fs.created_at
        FROM form_submissions fs
        JOIN form_fields ff2 ON ff2.form_id = fs.form_id
        WHERE fs.deal_id = d_id
          AND ff2.mapping_type IN ('lead_field','new_lead_field','custom_field','new_custom_field')
          AND ff2.field_type IN ('select','multi_select','radio','checkbox')
          AND ff2.options IS NOT NULL
      ) x
      ORDER BY x.mapping_target, x.created_at DESC
    LOOP
      label_map := '{}'::jsonb;
      FOR opt IN SELECT * FROM jsonb_array_elements(ff.options)
      LOOP
        IF opt ? 'value' AND opt ? 'label' THEN
          label_map := label_map || jsonb_build_object(opt->>'value', opt->>'label');
        END IF;
      END LOOP;

      current_val := new_cf -> ff.mapping_target;
      IF current_val IS NULL THEN CONTINUE; END IF;

      IF jsonb_typeof(current_val) = 'array' THEN
        resolved_arr := '[]'::jsonb;
        FOR arr_item IN SELECT jsonb_array_elements_text(current_val)
        LOOP
          resolved_arr := resolved_arr || to_jsonb(COALESCE(label_map ->> arr_item, arr_item));
        END LOOP;
        new_cf := jsonb_set(new_cf, ARRAY[ff.mapping_target], resolved_arr);
      ELSIF jsonb_typeof(current_val) = 'string' THEN
        new_cf := jsonb_set(new_cf, ARRAY[ff.mapping_target], to_jsonb(COALESCE(label_map ->> (current_val #>> '{}'), current_val #>> '{}')));
      END IF;
    END LOOP;

    IF new_cf IS DISTINCT FROM d_cf THEN
      UPDATE funnel_deals SET custom_fields = new_cf WHERE id = d_id;
    END IF;
  END LOOP;
END $$;
