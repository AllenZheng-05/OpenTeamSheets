-- Box usage, stored. Counting it (box_usage) adds up every placement in a
-- regulation, which took the database most of a second warm and, after a
-- quiet spell, longer than visitors' 3-second limit. The imports now count
-- it once and store it here, so reading it takes milliseconds.
create table public.box_usage_stats (
  regulation_id text not null references public.regulations (id),
  box_species text not null,
  -- Tournament placements in the regulation whose team has it, and all of
  -- them.
  placements bigint not null,
  total bigint not null,
  primary key (regulation_id, box_species)
);

alter table public.box_usage_stats enable row level security;

-- Public figures; only refresh_box_usage() writes them.
create policy "Readable by everyone" on public.box_usage_stats
  for select using (true);

-- Recounts one regulation's usage. The imports and data:sync call it, one
-- regulation at a time to stay within the API's statement timeout.
create function public.refresh_box_usage(p_regulation text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.box_usage_stats where regulation_id = p_regulation;
  insert into public.box_usage_stats (regulation_id, box_species, placements, total)
  select p_regulation, u.box_species, u.placements, u.total
  from public.box_usage(p_regulation) as u;
$$;

revoke execute on function public.refresh_box_usage(text)
  from public, anon, authenticated;

-- The regulations that have placements, for refreshing them all.
select public.refresh_box_usage(r.id)
from public.regulations as r
where exists (select 1 from public.events where regulation_id = r.id);
