ALTER TABLE custom_field_definitions DROP CONSTRAINT custom_field_definitions_field_type_check;
ALTER TABLE custom_field_definitions ADD CONSTRAINT custom_field_definitions_field_type_check 
  CHECK (field_type = ANY (ARRAY['text','number','boolean','date','select','switch','time','datetime','multi_select','url','phone','email']));