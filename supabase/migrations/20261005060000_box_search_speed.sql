-- Box searches timed out in production (over the 3-second limit for site
-- visitors): they counted missing Pokémon for every team in the database.
-- They now count only teams in the regulation and event searched, joined
-- against the box rather than checked one by one.

create or replace function public.search_placements(filters jsonb default '{}')
returns setof public.tournament_placements
language sql
stable
security definer
set search_path = ''
-- Sorting every match for the page and the count fits in memory this way.
set work_mem = '64MB'
as $$
  with has as (
    select distinct private.condition_tags(c) as tags
    from jsonb_array_elements(coalesce(filters -> 'has', '[]')) as c
  ),
  nots as (
    select distinct private.condition_tags(c) as tags
    from jsonb_array_elements(coalesce(filters -> 'not', '[]')) as c
  ),
  included as materialized (
    select t.team_id
    from private.team_set_tags as t
    join has on t.tags @> has.tags
    group by t.team_id
    having count(distinct has.tags) = (select count(*) from has)
  ),
  archetypes as (
    select distinct a
    from jsonb_array_elements_text(coalesce(filters -> 'archetypes', '[]')) as a
  ),
  with_archetypes as materialized (
    select ta.team_id
    from public.team_archetypes as ta
    join archetypes on ta.archetype_id = archetypes.a
    group by ta.team_id
    having count(*) = (select count(*) from archetypes)
  ),
  without_archetypes as materialized (
    select distinct ta.team_id
    from public.team_archetypes as ta
    where ta.archetype_id in (
      select jsonb_array_elements_text(coalesce(filters -> 'notArchetypes', '[]'))
    )
  ),
  owned as materialized (
    select distinct jsonb_array_elements_text(coalesce(filters -> 'box', '[]')) as id
  ),
  -- The teams in the regulation and event searched, when matching a box;
  -- counting missing Pokémon for every team in the database was too slow.
  candidates as materialized (
    select distinct q.team_id
    from public.tournament_placements as q
    where filters ? 'box'
      and (filters ->> 'regulation' is null or q.regulation_id = filters ->> 'regulation')
      and (filters ->> 'event' is null or q.event_slug = filters ->> 'event')
  ),
  -- Those needing more of what the box lacks than allowed. Each Pokémon not
  -- in the box counts once.
  short_of_box as materialized (
    select t.team_id
    from candidates as c
    join private.team_set_tags as t on t.team_id = c.team_id
    left join owned as o on o.id = t.box_species
    where t.box_species is not null and o.id is null
    group by t.team_id
    having count(*) > coalesce((filters ->> 'boxMissing')::integer, 0)
  ),
  excluded as materialized (
    select distinct t.team_id
    from private.team_set_tags as t
    join nots on t.tags @> nots.tags
  )
  select p.*
  from public.tournament_placements as p
  where (filters ->> 'regulation' is null or p.regulation_id = filters ->> 'regulation')
    and (filters ->> 'event' is null or p.event_slug = filters ->> 'event')
    and (filters ->> 'stage' is distinct from 'top-cut' or p.made_top_cut)
    and (filters ->> 'stage' is distinct from 'day-2' or p.made_day_two)
    and (filters ->> 'top' is null or p.placement <= (filters ->> 'top')::integer)
    and (filters ->> 'kind' is null or p.official = (filters ->> 'kind' = 'official'))
    and (not exists (select 1 from has) or p.team_id in (select team_id from included))
    and p.team_id not in (select team_id from excluded)
    and p.team_id not in (select team_id from short_of_box)
    and (
      not exists (select 1 from archetypes)
      or p.team_id in (select team_id from with_archetypes)
    )
    and p.team_id not in (select team_id from without_archetypes)
    and (
      coalesce(jsonb_array_length(filters -> 'players'), 0) = 0
      or p.player_name ilike any (array(
        select private.contains_pattern(x)
        from jsonb_array_elements_text(filters -> 'players') as x
      ))
    )
    and not coalesce(p.player_name ilike any (array(
      select private.contains_pattern(x)
      from jsonb_array_elements_text(coalesce(filters -> 'notPlayers', '[]')) as x
    )), false)
    and case filters ->> 'errors'
      when 'any' then exists (
        select 1 from public.team_sheet_errors as e where e.team_id = p.team_id
      )
      when 'unexplained' then exists (
        select 1 from public.team_sheet_errors as e
        where e.team_id = p.team_id
          and e.reading is null and not e.mega_ability and not e.left_blank
      )
      when 'none' then not exists (
        select 1 from public.team_sheet_errors as e where e.team_id = p.team_id
      )
      else true
    end
  order by p.starts_on desc, p.event_id, p.placement asc nulls last, p.player_name;
$$;

-- Fresh statistics after the large imports, so the planner sizes these
-- joins well.
analyze public.team_sets;
analyze public.team_sources;
analyze public.events;
analyze public.teams;
analyze private.team_set_tags;
