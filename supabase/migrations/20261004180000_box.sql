-- Box matching: finding teams a player can build from the Pokémon they own.

-- The "box species" each species counts as, from core's boxSpecies():
-- regional forms, gender forms and Rotom's appliances are owned separately;
-- switchable and cosmetic forms share their base form's; a Mega counts as
-- the Pokémon it Mega Evolves from. Set by `pnpm data:sync`.
alter table public.species add column box_species_id text;

comment on column public.species.box_species_id is
  'The species a player owns to have this one, from core''s boxSpecies(). Null until data:sync sets it.';

-- Each Pokémon on a team, as its box species, for counting what a team
-- needs that a box doesn't have.
alter table private.team_set_tags add column box_species text;

create index team_set_tags_box_species_idx
  on private.team_set_tags (box_species);

-- A species' box species; before data:sync sets it, the form a Mega
-- Evolves from, or itself.
create function private.box_species(p_species_id text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(box_species_id, battle_only_from_id, id)
  from public.species
  where id = p_species_id;
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
  return null;
end;
$$;

create or replace function public.refresh_search_tags()
returns void
language sql
security definer
set search_path = ''
as $$
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
  on conflict (team_id, slot) do update
    set tags = excluded.tags, box_species = excluded.box_species;
$$;

select public.refresh_search_tags();

-- search_placements() can now match a box:
--   box: the box species a player owns
--   boxMissing: how many of a team's Pokémon may be missing from it (0 for
--     teams they can build)

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
  -- Teams needing more of what the box lacks than allowed. Each Pokémon
  -- not in the box counts once.
  short_of_box as materialized (
    select t.team_id
    from private.team_set_tags as t
    where filters ? 'box'
      and t.box_species is not null
      and t.box_species not in (
        select jsonb_array_elements_text(filters -> 'box')
      )
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

-- How often each box species is used: of the tournament placements in a
-- regulation, how many teams have it, for sorting and showing the box.
-- Runs as its owner to read the search tags; it only counts public teams.
create function public.box_usage(p_regulation text)
returns table (box_species text, placements bigint, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with placements as (
    select team_id
    from public.tournament_placements
    where regulation_id = p_regulation
  )
  select t.box_species, count(*), (select count(*) from placements)
  from placements as p
  join private.team_set_tags as t on t.team_id = p.team_id
  where t.box_species is not null
  group by t.box_species;
$$;
