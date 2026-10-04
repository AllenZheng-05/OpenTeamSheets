-- Box matching with bitsets. Each box species has a permanent index (its
-- place in core's data/box-order.json, set here by `pnpm data:sync`), and
-- each team a 1024-bit mask of its Pokémon. A player's box arrives in the
-- search as the same kind of mask, so "missing at most k" is one bit count
-- per team: bit_count(team & ~box) <= k. Widening past 1024 means padding
-- these with zeros; indexes never move.

alter table public.species add column box_index smallint
  check (box_index between 0 and 1023);

comment on column public.species.box_index is
  'The permanent index of this species'' box species, from core''s box-order.json. Null until data:sync sets it.';

-- Each team's box species as a mask, and how many of its Pokémon have no
-- index (so can never be in a box).
create table private.team_box_masks (
  team_id uuid primary key references public.teams (id) on delete cascade,
  mask bit(1024) not null,
  unindexed smallint not null
);

-- Recomputes the masks of these teams from their sets.
create function private.update_box_masks(p_team_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.team_box_masks (team_id, mask, unindexed)
  select
    s.team_id,
    coalesce(
      bit_or(set_bit(repeat('0', 1024)::bit(1024), sp.box_index, 1))
        filter (where sp.box_index is not null),
      repeat('0', 1024)::bit(1024)
    ),
    count(*) filter (where sp.box_index is null)
  from public.team_sets as s
  join public.species as sp on sp.id = s.species_id
  where s.team_id = any (p_team_ids)
  group by s.team_id
  on conflict (team_id) do update
    set mask = excluded.mask, unindexed = excluded.unindexed;
$$;

create or replace function private.update_set_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.team_set_tags (team_id, slot, tags, box_species)
  values (
    new.team_id,
    new.slot,
    private.set_tags(
      new.species_id, new.item_id, new.ability_id,
      array_remove(array[new.move_1_id, new.move_2_id, new.move_3_id, new.move_4_id], null)
    ),
    private.box_species(new.species_id)
  )
  on conflict (team_id, slot) do update
    set tags = excluded.tags, box_species = excluded.box_species;
  perform private.update_box_masks(array[new.team_id]);
  return null;
end;
$$;


create or replace function public.refresh_search_tags(
  p_after uuid default null,
  p_limit integer default 1500
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_team uuid;
begin
  -- The last of the next p_limit teams, in id order.
  select team_id into last_team
  from (
    select distinct team_id
    from public.team_sets
    where p_after is null or team_id > p_after
    order by team_id
    limit p_limit
  ) as batch
  order by team_id desc
  limit 1;
  if last_team is null then
    return null;
  end if;

  insert into private.team_set_tags (team_id, slot, tags, box_species)
  select
    team_id,
    slot,
    private.set_tags(
      species_id, item_id, ability_id,
      array_remove(array[move_1_id, move_2_id, move_3_id, move_4_id], null)
    ),
    private.box_species(species_id)
  from public.team_sets
  where (p_after is null or team_id > p_after) and team_id <= last_team
  on conflict (team_id, slot) do update
    set tags = excluded.tags, box_species = excluded.box_species;

  perform private.update_box_masks(array(
    select distinct team_id
    from public.team_sets
    where (p_after is null or team_id > p_after) and team_id <= last_team
  ));

  return last_team;
end;
$$;


-- search_placements() takes the box as a mask:
--   boxBits: the player's box, as bit(1024) text (index 0 first)
--   boxMissing: how many of a team's Pokémon may be missing from it
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
  order by p.starts_on desc, p.event_id, p.placement asc nulls last, p.player_name;
$$;


-- Masks for every team. data:sync sets the indexes and refreshes these.
select private.update_box_masks(array(select id from public.teams));
