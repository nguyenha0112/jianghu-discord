grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on table public.game_rooms to postgres, service_role;
grant select on table public.game_rooms to anon, authenticated;

grant usage, select on sequence public.game_rooms_id_seq to postgres, service_role;

alter table public.game_rooms enable row level security;

drop policy if exists "service_role_full_game_rooms" on public.game_rooms;

create policy "service_role_full_game_rooms"
on public.game_rooms
for all
to service_role
using (true)
with check (true);
