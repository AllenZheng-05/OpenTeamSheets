-- Search by team rather than by placement: identical teams are stored once
-- (one row in teams, a team_sources row per player who used it), and now
-- appear once in results too.
--
-- search_teams() applies every filter as search_placements() does, so a
-- placement filter (stage, top, event, official or online, player) means
-- "has at least one result matching", then groups the matching placements
-- by team, one page at a time. Each row is a team with its best matching
-- result (placement, then the larger event, then the most recent; official
-- and online alike), how many matching results it has, how many reached
-- that placement, and how many made day 2 and top cut.
--
-- Sorts: 'used' (most matching results; the default), 'newest' (most
-- recent matching result) or 'best' (best placement, then the most results
-- at that placement, so the team with the most 1st places leads).

-- The placements a search matches, unsorted: search_placements() sorts
-- them for a list, and grouping and counting don't need the order.
create function private.matching_placements(filters jsonb default '{}')
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
    -- The box: missing at most boxMissing of the team's Pokémon.
    and (
      filters ->> 'boxBits' is null
      or exists (
        select 1
        from private.team_box_masks as m
        where m.team_id = p.team_id
          and bit_count(m.mask & ~((filters ->> 'boxBits')::bit(1024)))
            + m.unindexed <= coalesce((filters ->> 'boxMissing')::integer, 0)
      )
    )
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
$$;


create or replace function public.search_placements(filters jsonb default '{}')
returns setof public.tournament_placements
language sql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
  select * from private.matching_placements(filters) as p
  order by p.starts_on desc, p.event_id, p.placement asc nulls last, p.player_name;
$$;

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
  -- How many matching results reached the best placement.
  best_count bigint,
  latest_on date,
  -- The best matching result, as in tournament_placements.
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
language sql
stable
security definer
set search_path = ''
set work_mem = '64MB'
as $$
  with matched as materialized (
    select * from private.matching_placements(filters)
  ),
  ranked as (
    select
      m.team_id, m.placement, m.made_top_cut, m.made_day_two, m.starts_on,
      m.player_count,
      min(m.placement) over (partition by m.team_id) as best_placement
    from matched as m
  ),
  -- Every matching team, in one pass.
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
  -- The page asked for. Paging here, not after, means only these teams
  -- need their best result looked up.
  page as (
    select g.*
    from grouped as g
    order by
      case when sort = 'newest' then g.latest_on end desc nulls last,
      case when sort = 'used' then g.uses end desc nulls last,
      g.best_placement asc nulls last,
      -- Ties at a placement: whoever reached it most often.
      g.best_count desc,
      g.best_size desc nulls last,
      g.latest_on desc,
      g.team_id
    offset page_offset
    limit page_limit
  ),
  best as (
    select distinct on (m.team_id) m.*
    from matched as m
    join page on page.team_id = m.team_id
    order by
      m.team_id,
      m.placement asc nulls last,
      m.player_count desc nulls last,
      m.starts_on desc
  )
  select
    g.team_id, g.uses, g.top_cuts, g.day_twos, g.best_count, g.latest_on,
    b.id, b.player_name, b.placement, b.wins, b.losses, b.made_day_two,
    b.made_top_cut, b.teamlist_url, b.event_id, b.event_slug, b.event_name,
    b.regulation_id, b.official, b.starts_on, b.ends_on, b.player_count,
    b.top_cut_size, b.standings_url
  from page as g
  join best as b on b.team_id = g.team_id
  order by
    case when sort = 'newest' then g.latest_on end desc nulls last,
    case when sort = 'used' then g.uses end desc nulls last,
    g.best_placement asc nulls last,
    g.best_count desc,
    g.best_size desc nulls last,
    g.latest_on desc,
    g.team_id;
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
  select count(distinct team_id) from private.matching_placements(filters);
$$;
