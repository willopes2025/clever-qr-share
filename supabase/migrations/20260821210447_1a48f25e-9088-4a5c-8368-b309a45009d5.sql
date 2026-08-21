WITH parts AS (
  SELECT s.id AS sub_id,
         left(k, length(k) - length(suffix)) AS base,
         suffix,
         s.data->>k AS val
  FROM form_submissions s
  CROSS JOIN LATERAL jsonb_object_keys(s.data) AS k
  CROSS JOIN LATERAL (
    SELECT CASE
      WHEN k LIKE '%\_street' THEN '_street'
      WHEN k LIKE '%\_number' THEN '_number'
      WHEN k LIKE '%\_complement' THEN '_complement'
      WHEN k LIKE '%\_zip' THEN '_zip'
      WHEN k LIKE '%\_city' THEN '_city'
      WHEN k LIKE '%\_state' THEN '_state'
    END AS suffix
  ) sfx
  WHERE sfx.suffix IS NOT NULL
), agg AS (
  SELECT sub_id, base,
    concat_ws(', ',
      nullif(concat_ws(', ',
        nullif(max(val) FILTER (WHERE suffix='_street'), ''),
        nullif(max(val) FILTER (WHERE suffix='_number'), '')
      ), ''),
      nullif(max(val) FILTER (WHERE suffix='_complement'), ''),
      nullif(concat_ws(' - ',
        nullif(max(val) FILTER (WHERE suffix='_city'), ''),
        nullif(max(val) FILTER (WHERE suffix='_state'), '')
      ), ''),
      nullif(max(val) FILTER (WHERE suffix='_zip'), '')
    ) AS full_address
  FROM parts
  GROUP BY sub_id, base
)
UPDATE form_submissions s
SET data = s.data || jsonb_build_object(a.base, a.full_address)
FROM agg a
WHERE s.id = a.sub_id
  AND a.full_address <> ''
  AND coalesce(s.data->>a.base, '') = '';