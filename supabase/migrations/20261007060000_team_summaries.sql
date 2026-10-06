-- Team totals, stored. The Tournament tab's default search (the current
-- regulation, no filters) groups every placement in the regulation by
-- team on each uncached visit; after a quiet spell, reading them all back
-- into memory made the database slow to answer. The imports now add up
-- each team's results once per regulation (and once across all of them)
-- and store them here.
--
-- search_teams() and count_teams() read these totals whenever a search
-- has no filter on placements (stage, top, event, official or online,
-- player): such a search counts every result in the regulation, which is
-- what's stored. Filters on the team itself (Pokémon, archetypes, the box,
-- sheet errors) are checked against the stored teams as before. A search
-- with a placement filter counts only the matching results, so it adds
-- them up as before (search_teams_from_placements).
--
-- Between an import adding results and refreshing these, the default
-- search shows the totals from before it; the refresh moves the search
-- data version on, so cached results start fresh after it.

create table private.team_summaries (
  -- A regulation, or '*' for every regulation together.
  scope text not null,
  team_id uuid not null references public.teams (id) on delete cascade,
  uses bigint not null,
  top_cuts bigint not null,
  day_twos bigint not null,
  -- How many results reached the best placement.
  best_count bigint not null,
  best_placement integer,
  -- The largest event the best placement was at.
  best_size integer,
  latest_on date not null,
  -- The best result (tournament_placements.id), as search_teams picks it.
  best_id uuid not null,
  primary key (scope, team_id)
);

alter table private.team_summaries enable row level security;

-- Recounting moves the search data version on.
create trigger team_summaries_search_data_version
  after insert or update or delete on private.team_summaries
  for each statement execute function private.touch_search_data_version();

-- Adds up one scope's teams again: a regulation, or '*' for all of them.
-- The imports and data:sync call it once per regulation, then for '*'.
create function public.refresh_team_summaries(p_scope text)
returns void
language sql
security definer
set search_path = ''
set work_mem = '64MB'
as $$
  delete from private.team_summaries where scope = p_scope;
  insert into private.team_summaries (
    scope, team_id, uses, top_cuts, day_twos, best_count, best_placement,
    best_size, latest_on, best_id
  )
  with matched as materialized (
    select *
    from public.tournament_placements as p
    where p_scope = '*' or p.regulation_id = p_scope
  ),
  ranked as (
    select
      m.team_id, m.placement, m.made_top_cut, m.made_day_two, m.starts_on,
      m.player_count,
      min(m.placement) over (partition by m.team_id) as best_placement
    from matched as m
  ),
  grouped as (
    select
      r.team_id,
      count(*) as uses,
      count(*) filter (where r.made_top_cut) as top_cuts,
      count(*) filter (where r.made_day_two) as day_twos,
      count(*) filter (where r.placement = r.best_placement) as best_count,
      min(r.best_placement) as best_placement,
      max(r.player_count) filter (where r.placement = r.best_placement) as best_size,
      max(r.starts_on) as latest_on
    from ranked as r
    group by r.team_id
  ),
  best as (
    select distinct on (m.team_id) m.team_id, m.id
    from matched as m
    order by
      m.team_id,
      m.placement asc nulls last,
      m.player_count desc nulls last,
      m.starts_on desc,
      m.id
  )
  select
    p_scope, g.team_id, g.uses, g.top_cuts, g.day_twos, g.best_count,
    g.best_placement, g.best_size, g.latest_on, b.id
  from grouped as g
  join best as b on b.team_id = g.team_id;
$$;

revoke execute on function public.refresh_team_summaries(text)
  from public, anon, authenticated;

-- Whether a search filters placements, so stored totals don't apply.
create function private.filters_placements(filters jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select filters ->> 'event' is not null
    or filters ->> 'top' is not null
    or filters ->> 'kind' is not null
    or coalesce(filters ->> 'stage' in ('top-cut', 'day-2'), false)
    or coalesce(jsonb_array_length(filters -> 'players'), 0) > 0
    or coalesce(jsonb_array_length(filters -> 'notPlayers'), 0) > 0;
$$;

-- The stored totals of the public teams a search without placement filters
-- matches. The team filters are matching_placements()'s, on teams.
create function private.matching_summaries(filters jsonb default '{}')
returns setof private.team_summaries
language sql
stable
security definer
set search_path = ''
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
  excluded as materialized (
    select distinct t.team_id
    from private.team_set_tags as t
    join nots on t.tags @> nots.tags
  )
  select s.*
  from private.team_summaries as s
  join public.teams as team on team.id = s.team_id
  where s.scope = coalesce(filters ->> 'regulation', '*')
    and team.visibility = 'public'
    and (not exists (select 1 from has) or s.team_id in (select team_id from included))
    and s.team_id not in (select team_id from excluded)
    and (
      filters ->> 'boxBits' is null
      or exists (
        select 1
        from private.team_box_masks as m
        where m.team_id = s.team_id
          and bit_count(m.mask & ~((filters ->> 'boxBits')::bit(1024)))
            + m.unindexed <= coalesce((filters ->> 'boxMissing')::integer, 0)
      )
    )
    and (
      not exists (select 1 from archetypes)
      or s.team_id in (select team_id from with_archetypes)
    )
    and s.team_id not in (select team_id from without_archetypes)
    and case filters ->> 'errors'
      when 'any' then exists (
        select 1 from public.team_sheet_errors as e where e.team_id = s.team_id
      )
      when 'unexplained' then exists (
        select 1 from public.team_sheet_errors as e
        where e.team_id = s.team_id
          and e.reading is null and not e.mega_ability and not e.left_blank
      )
      when 'none' then not exists (
        select 1 from public.team_sheet_errors as e where e.team_id = s.team_id
      )
      else true
    end
$$;

-- The searches that add up placements stay, for placement filters.
alter function public.search_teams(jsonb, text, integer, integer)
  set schema private;
alter function private.search_teams(jsonb, text, integer, integer)
  rename to search_teams_from_placements;
alter function public.count_teams(jsonb) set schema private;
alter function private.count_teams(jsonb) rename to count_teams_from_placements;

create function public.search_teams(
  filters jsonb default '{}',
  sort text default 'used',
  page_offset integer default 0,
  page_limit integer default 26
)
returns table (
  team_id uuid,
  uses bigint,
  top_cuts bigint,
  day_twos bigint,
  best_count bigint,
  latest_on date,
  best_id uuid,
  player_name text,
  placement integer,
  wins smallint,
  losses smallint,
  made_day_two boolean,
  made_top_cut boolean,
  teamlist_url text,
  event_id uuid,
  event_slug text,
  event_name text,
  regulation_id text,
  official boolean,
  starts_on date,
  ends_on date,
  player_count integer,
  top_cut_size smallint,
  standings_url text
)
language plpgsql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
#variable_conflict use_column
begin
  if private.filters_placements(filters) then
    return query
      select * from private.search_teams_from_placements(
        filters, sort, page_offset, page_limit
      );
    return;
  end if;

  -- Sorted as search_teams_from_placements() sorts.
  return query
    with page as (
      select g.*
      from private.matching_summaries(filters) as g
      order by
        case when sort = 'newest' then g.latest_on end desc nulls last,
        case when sort = 'used' then g.uses end desc nulls last,
        g.best_placement asc nulls last,
        g.best_count desc,
        g.best_size desc nulls last,
        g.latest_on desc,
        g.team_id
      offset page_offset
      limit page_limit
    )
    select
      g.team_id, g.uses, g.top_cuts, g.day_twos, g.best_count, g.latest_on,
      b.id, b.player_name, b.placement, b.wins, b.losses, b.made_day_two,
      b.made_top_cut, b.teamlist_url, b.event_id, b.event_slug, b.event_name,
      b.regulation_id, b.official, b.starts_on, b.ends_on, b.player_count,
      b.top_cut_size, b.standings_url
    from page as g
    join public.tournament_placements as b on b.id = g.best_id
    order by
      case when sort = 'newest' then g.latest_on end desc nulls last,
      case when sort = 'used' then g.uses end desc nulls last,
      g.best_placement asc nulls last,
      g.best_count desc,
      g.best_size desc nulls last,
      g.latest_on desc,
      g.team_id;
end;
$$;

-- How many teams match a search.
create function public.count_teams(filters jsonb default '{}')
returns bigint
language sql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
  select case
    when private.filters_placements(filters)
      then private.count_teams_from_placements(filters)
    else (select count(*) from private.matching_summaries(filters))
  end;
$$;

-- Every regulation with events, then all of them together.
select public.refresh_team_summaries(r.id)
from public.regulations as r
where exists (select 1 from public.events where regulation_id = r.id);
select public.refresh_team_summaries('*');
