-- Chạy file này trong Supabase SQL Editor nếu project của bạn đã có schema v1
-- nhưng chưa có phần tu luyện / đột phá / linh căn / động phủ.

alter table public.players
add column if not exists cultivation_realm text not null default 'pham_nhan';

alter table public.players
add column if not exists cultivation_realm_index integer not null default 0;

alter table public.players
add column if not exists cultivation_spirit_root text not null default 'thuy';

alter table public.players
add column if not exists cultivation_dwelling_level integer not null default 1;

update public.players
set cultivation_realm = coalesce(cultivation_realm, 'pham_nhan'),
    cultivation_realm_index = coalesce(cultivation_realm_index, 0),
    cultivation_spirit_root = coalesce(cultivation_spirit_root, 'thuy'),
    cultivation_dwelling_level = coalesce(cultivation_dwelling_level, 1)
where cultivation_realm is null
   or cultivation_realm_index is null
   or cultivation_spirit_root is null
   or cultivation_dwelling_level is null;
