insert into public.tags (user_id, name, color)
select 'b3e1967e-cd4c-4835-8b3c-df65740a4fb9', 'Associação de Moradores', '#10b981'
where not exists (select 1 from public.tags where user_id='b3e1967e-cd4c-4835-8b3c-df65740a4fb9' and lower(name)=lower('Associação de Moradores'));

insert into public.contact_tags (contact_id, tag_id)
select c.id, t.id
from public.contacts c
cross join (select id from public.tags where user_id='b3e1967e-cd4c-4835-8b3c-df65740a4fb9' and lower(name)=lower('Associação de Moradores') limit 1) t
where c.user_id='b3e1967e-cd4c-4835-8b3c-df65740a4fb9'
  and c.created_at >= '2026-08-17 14:00:00+00'
on conflict do nothing;