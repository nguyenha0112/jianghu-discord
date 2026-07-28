alter table public.players
add column if not exists cultivation_realm text not null default 'pham_nhan';

alter table public.players
add column if not exists cultivation_realm_index integer not null default 0;

update public.players
set cultivation_realm = coalesce(cultivation_realm, 'pham_nhan'),
    cultivation_realm_index = coalesce(cultivation_realm_index, 0)
where cultivation_realm is null
   or cultivation_realm_index is null;
