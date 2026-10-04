-- Search: filtering tournament placements by what's on the team (Pokémon,
-- moves, abilities, items, types), archetypes, players, sheet errors,
-- regulation, event and stage.

-- What's wrong with each official team sheet as published (typos made when
-- it was entered), for searching. The importer works these out with core's
-- sheetErrors() and import_event() replaces them on every import, so
-- importing again refreshes them. Team pages work out their own when they
-- load; this table only serves search.
create table public.team_sheet_errors (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  slot smallint check (slot between 1 and 6),
  -- The listed item, ability or move the error is about, if any.
  field text check (field in ('item', 'ability', 'move')),
  value text,
  message text not null,
  -- What it probably meant, from core's reviewed readings.
  reading text,
  -- The listed ability is the Mega's own.
  mega_ability boolean not null default false,
  -- The field was left blank (the sheet shows the first option).
  left_blank boolean not null default false
);

create index team_sheet_errors_team_id_idx on public.team_sheet_errors (team_id);

alter table public.team_sheet_errors enable row level security;

-- Written only by import_event(), with the secret key.
create policy "Readable with the team" on public.team_sheet_errors
  for select using (public.is_team_visible(team_id));

-- Search internals, kept out of the API: nothing here is exposed or
-- readable by site visitors. search_placements() reads it on their behalf
-- and only ever returns public teams.
create schema private;
revoke all on schema private from public, anon, authenticated;

-- Each Pokémon on a team as search tags, such as
--   {pokemon:charizard, pokemon:charizardmegay, ability:solarpower,
--    item:charizarditey, type:fire, type:flying, move:heatwave, ...}
-- A search condition is a set of tags too ("Incineroar with Knock Off" is
-- {pokemon:incineroar, move:knockoff}), so a Pokémon matches when its tags
-- contain the condition's, which the GIN index answers directly.
--
-- `pokemon` holds both the form a set lists and the form it battles as, so
-- Charizard holding Charizardite Y is found by a search for Charizard or for
-- Mega Charizard Y. Types are the battling form's.
create table private.team_set_tags (
  team_id uuid not null,
  slot smallint not null,
  tags text[] not null,
  primary key (team_id, slot),
  foreign key (team_id, slot) references public.team_sets (team_id, slot) on delete cascade
);

create index team_set_tags_tags_idx on private.team_set_tags using gin (tags);

create function private.set_tags(
  p_species_id text,
  p_item_id text,
  p_ability_id text,
  p_moves text[]
)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select array(
      select distinct tag
      from unnest(
        array[
          'pokemon:' || coalesce(listed.battle_only_from_id, listed.id),
          'pokemon:' || shown.id,
          'ability:' || p_ability_id,
          'item:' || p_item_id,
          'type:' || shown.type1_id,
          'type:' || shown.type2_id
        ] || array(select 'move:' || m from unnest(p_moves) as m)
      ) as tag
      where tag is not null
      order by tag
    )
    from public.species as listed
    left join public.species as mega
      on mega.battle_only_from_id = listed.id and mega.required_item_id = p_item_id
    join public.species as shown on shown.id = coalesce(mega.id, listed.id)
    where listed.id = p_species_id
  ), '{}');
$$;

-- Keeps each Pokémon's tags in step with its set.
create function private.update_set_tags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.team_set_tags (team_id, slot, tags)
  values (
    new.team_id,
    new.slot,
    private.set_tags(
      new.species_id, new.item_id, new.ability_id,
      array_remove(array[new.move_1_id, new.move_2_id, new.move_3_id, new.move_4_id], null)
    )
  )
  on conflict (team_id, slot) do update set tags = excluded.tags;
  return null;
end;
$$;

create trigger team_sets_search_tags
  after insert or update on public.team_sets
  for each row execute function private.update_set_tags();

-- Recomputes every Pokémon's tags, after game data changes (a Pokémon's
-- types or Mega forms). `pnpm data:sync` calls it; only the secret key can.
create function public.refresh_search_tags()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.team_set_tags (team_id, slot, tags)
  select
    team_id,
    slot,
    private.set_tags(
      species_id, item_id, ability_id,
      array_remove(array[move_1_id, move_2_id, move_3_id, move_4_id], null)
    )
  from public.team_sets
  on conflict (team_id, slot) do update set tags = excluded.tags;
$$;

revoke execute on function public.refresh_search_tags() from public, anon, authenticated;

select public.refresh_search_tags();

-- import_event() now also stores each team's sheet errors:
--   teams: [{ ..., sheetErrors: [{ slot, field, value, message, reading,
--                                  megaAbility, leftBlank }] }]
create or replace function public.import_event(payload jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  event_row jsonb := payload -> 'event';
  v_event_id uuid;
  team jsonb;
  v_team_id uuid;
  inserted boolean;
  created integer := 0;
  merged integer := 0;
begin
  insert into public.events (
    source, source_id, slug, name, regulation_id, official, starts_on, ends_on,
    player_count, standings_url, top_cut_size
  )
  values (
    event_row ->> 'source',
    event_row ->> 'sourceId',
    event_row ->> 'slug',
    event_row ->> 'name',
    event_row ->> 'regulationId',
    coalesce((event_row ->> 'official')::boolean, false),
    (event_row ->> 'startsOn')::date,
    (event_row ->> 'endsOn')::date,
    (event_row ->> 'playerCount')::integer,
    event_row ->> 'standingsUrl',
    (event_row ->> 'topCutSize')::smallint
  )
  on conflict (source, source_id) do update set
    slug = excluded.slug,
    name = excluded.name,
    regulation_id = excluded.regulation_id,
    official = excluded.official,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    player_count = excluded.player_count,
    standings_url = excluded.standings_url,
    top_cut_size = excluded.top_cut_size
  returning id into v_event_id;

  for team in select * from jsonb_array_elements(payload -> 'teams') loop
    insert into public.teams (regulation_id, origin, visibility, published_at, fingerprint)
    values (event_row ->> 'regulationId', 'tournament', 'public', now(), team ->> 'fingerprint')
    on conflict (fingerprint) do update set updated_at = now()
    -- xmax is 0 only for a freshly inserted row.
    returning id, (xmax = 0) into v_team_id, inserted;

    if inserted then
      created := created + 1;
      insert into public.team_sets (
        team_id, slot, species_id, item_id, ability_id, nature_id,
        move_1_id, move_2_id, move_3_id, move_4_id,
        sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe,
        level, iv_hp, iv_atk, iv_def, iv_spa, iv_spd, iv_spe, shiny,
        listed_item
      )
      select
        v_team_id,
        (s ->> 'slot')::smallint,
        s ->> 'speciesId',
        s ->> 'itemId',
        s ->> 'abilityId',
        s ->> 'natureId',
        s -> 'moves' ->> 0,
        s -> 'moves' ->> 1,
        s -> 'moves' ->> 2,
        s -> 'moves' ->> 3,
        (s -> 'statPoints' ->> 'hp')::smallint,
        (s -> 'statPoints' ->> 'atk')::smallint,
        (s -> 'statPoints' ->> 'def')::smallint,
        (s -> 'statPoints' ->> 'spa')::smallint,
        (s -> 'statPoints' ->> 'spd')::smallint,
        (s -> 'statPoints' ->> 'spe')::smallint,
        coalesce((s ->> 'level')::smallint, 50),
        coalesce((s -> 'ivs' ->> 'hp')::smallint, 31),
        coalesce((s -> 'ivs' ->> 'atk')::smallint, 31),
        coalesce((s -> 'ivs' ->> 'def')::smallint, 31),
        coalesce((s -> 'ivs' ->> 'spa')::smallint, 31),
        coalesce((s -> 'ivs' ->> 'spd')::smallint, 31),
        coalesce((s -> 'ivs' ->> 'spe')::smallint, 31),
        coalesce((s ->> 'shiny')::boolean, false),
        s ->> 'listedItem'
      from jsonb_array_elements(team -> 'sets') as s;
    else
      merged := merged + 1;
    end if;

    -- Archetypes are derived from the sets, so they're replaced each time.
    delete from public.team_archetypes where team_id = v_team_id;
    insert into public.team_archetypes (team_id, archetype_id)
    select v_team_id, a
    from jsonb_array_elements_text(coalesce(team -> 'archetypes', '[]')) as a;

    -- Sheet errors are worked out by the importer; replaced each time too.
    delete from public.team_sheet_errors where team_id = v_team_id;
    insert into public.team_sheet_errors (
      team_id, slot, field, value, message, reading, mega_ability, left_blank
    )
    select
      v_team_id,
      (e ->> 'slot')::smallint,
      e ->> 'field',
      e ->> 'value',
      e ->> 'message',
      e ->> 'reading',
      coalesce((e ->> 'megaAbility')::boolean, false),
      coalesce((e ->> 'leftBlank')::boolean, false)
    from jsonb_array_elements(coalesce(team -> 'sheetErrors', '[]')) as e;

    insert into public.team_sources (
      team_id, event_id, player_name, source_player_id, placement, wins,
      losses, made_day_two, made_top_cut, dropped_round, teamlist_url
    )
    values (
      v_team_id,
      v_event_id,
      team ->> 'playerName',
      team ->> 'sourcePlayerId',
      (team ->> 'placement')::integer,
      (team ->> 'wins')::smallint,
      (team ->> 'losses')::smallint,
      coalesce((team ->> 'madeDayTwo')::boolean, false),
      coalesce((team ->> 'madeTopCut')::boolean, false),
      (team ->> 'droppedRound')::smallint,
      team ->> 'teamlistUrl'
    )
    on conflict (event_id, player_name, source_player_id) do update set
      team_id = excluded.team_id,
      placement = excluded.placement,
      wins = excluded.wins,
      losses = excluded.losses,
      made_day_two = excluded.made_day_two,
      made_top_cut = excluded.made_top_cut,
      dropped_round = excluded.dropped_round,
      teamlist_url = excluded.teamlist_url;

    insert into public.media_links (team_id, kind, url, start_seconds, title)
    select
      v_team_id,
      m ->> 'kind',
      m ->> 'url',
      (m ->> 'startSeconds')::integer,
      m ->> 'title'
    from jsonb_array_elements(coalesce(team -> 'media', '[]')) as m
    on conflict (team_id, url) do update set
      kind = excluded.kind,
      start_seconds = excluded.start_seconds,
      title = excluded.title;
  end loop;

  return jsonb_build_object(
    'eventId', v_event_id,
    'teamsCreated', created,
    'teamsMerged', merged
  );
end;
$$;

-- A search condition as tags (see private.team_set_tags): any of
-- { pokemon, moves: [...], ability, item, type }.
create function private.condition_tags(condition jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(
    array[
      'pokemon:' || (condition ->> 'pokemon'),
      'ability:' || (condition ->> 'ability'),
      'item:' || (condition ->> 'item'),
      'type:' || (condition ->> 'type')
    ],
    null
  ) || array(
    select 'move:' || m
    from jsonb_array_elements_text(coalesce(condition -> 'moves', '[]')) as m
  );
$$;

-- "%text%" for ilike, with the text's own wildcards escaped.
create function private.contains_pattern(text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(text, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

-- Tournament placements matching a search, in the Tournament tab's order.
-- Every filter is optional:
--   has / not: Pokémon conditions ({ pokemon, moves, ability, item, type },
--     all on the same Pokémon). The team must match every `has`, each on
--     any Pokémon, and no `not`.
--   archetypes / notArchetypes: archetype ids, all of / none of
--   players / notPlayers: text a player's name contains, any of / none of
--   errors: 'any', 'unexplained' (no reading, not a Mega's ability, not
--     left blank) or 'none'
--   regulation, event (a slug), stage ('day-2' or 'top-cut')
--   top: a placement cutoff, such as 8 for the top 8 at each event
--
-- It runs as its owner to read private.team_set_tags, which is why it's
-- fast. tournament_placements only ever includes public teams, so it can
-- return nothing a visitor couldn't read themselves.
create function public.search_placements(filters jsonb default '{}')
returns setof public.tournament_placements
language sql
stable
security definer
set search_path = ''
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
    and (not exists (select 1 from has) or p.team_id in (select team_id from included))
    and p.team_id not in (select team_id from excluded)
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(filters -> 'archetypes', '[]')) as a
      where not exists (
        select 1 from public.team_archetypes as ta
        where ta.team_id = p.team_id and ta.archetype_id = a
      )
    )
    and not exists (
      select 1 from public.team_archetypes as ta
      where ta.team_id = p.team_id
        and ta.archetype_id in (
          select jsonb_array_elements_text(coalesce(filters -> 'notArchetypes', '[]'))
        )
    )
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
