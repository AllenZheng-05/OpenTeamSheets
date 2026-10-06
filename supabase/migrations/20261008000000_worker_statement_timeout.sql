-- Production's first sync after stored totals failed: recounting box usage
-- for M-A went past the API's 8-second statement limit, just after the
-- search tag refresh had pushed the regulation's placements out of memory.

-- The importer and data:sync call the API with the secret key, as
-- service_role. Their recounts read a regulation's placements in one
-- statement, which a small database can't always do in 8 seconds. They
-- run once a day, so give them a minute; visitors keep their 3 seconds.
alter role service_role set statement_timeout = '60s';
notify pgrst, 'reload config';

-- Box usage from the stored team totals rather than every placement: a
-- team used n times counts n times for each Pokémon on it, as before. The
-- totals must be recounted first (refresh_team_summaries), which the
-- worker does.
create or replace function public.refresh_box_usage(p_regulation text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.box_usage_stats where regulation_id = p_regulation;
  insert into public.box_usage_stats (regulation_id, box_species, placements, total)
  select
    p_regulation,
    t.box_species,
    sum(s.uses),
    (select sum(uses) from private.team_summaries where scope = p_regulation)
  from private.team_summaries as s
  join private.team_set_tags as t on t.team_id = s.team_id
  where s.scope = p_regulation
    and t.box_species is not null
  group by t.box_species;
$$;
