-- Fix existing contacts with LID_ names
UPDATE contacts 
SET name = 'Cliente'
WHERE name LIKE 'LID_%';