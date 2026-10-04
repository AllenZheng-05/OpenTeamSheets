-- When search data last changed, so the site can cache search results and
-- start fresh after an import: the time is part of every cache key.
create table public.search_data_version (
  -- One row.
  id boolean primary key default true check (id),
  changed_at timestamptz not null default now()
);

insert into public.search_data_version default values;

alter table public.search_data_version enable row level security;

create policy "Readable by everyone" on public.search_data_version
  for select using (true);

create function private.touch_search_data_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- "where id" matches the one row; the API rejects updates without a where.
  update public.search_data_version set changed_at = clock_timestamp() where id;
  return null;
end;
$$;

-- Once per statement: imports write placements, and data:sync rewrites the
-- masks box searches use.
create trigger team_sources_search_data_version
  after insert or update or delete on public.team_sources
  for each statement execute function private.touch_search_data_version();

create trigger team_box_masks_search_data_version
  after insert or update or delete on private.team_box_masks
  for each statement execute function private.touch_search_data_version();

create trigger team_set_tags_search_data_version
  after insert or update or delete on private.team_set_tags
  for each statement execute function private.touch_search_data_version();
