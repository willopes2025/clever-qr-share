UPDATE funnel_deals fd
SET title = c.name
FROM contacts c
WHERE fd.contact_id = c.id
  AND fd.title = 'Lead - Cliente'
  AND c.name IS NOT NULL
  AND btrim(c.name) <> ''
  AND c.name <> 'Lead - Cliente';