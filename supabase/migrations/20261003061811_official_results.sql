-- Official results from Limitless (standings.limitlessvgc.com): every
-- player's placement, record, and whether they made day 2 and top cut.

-- Events: the official results site as a source, and each event's top cut size.
alter table public.events drop constraint events_source_check;
alter table public.events
  add constraint events_source_check
    check (source in ('limitlessvgc', 'limitless', 'rk9', 'other')),
  add column top_cut_size smallint check (top_cut_size >= 0);

-- Placements: wins and losses replace the free-text record (official VGC
-- has no ties); day 2 and top cut flags; and the player's id on the source
-- platform, since two players at a large event can share a name.
alter table public.team_sources
  drop column record,
  add column source_player_id text,
  add column wins smallint check (wins >= 0),
  add column losses smallint check (losses >= 0),
  add column made_day_two boolean not null default false,
  add column made_top_cut boolean not null default false,
  add column dropped_round smallint check (dropped_round > 0),
  drop constraint team_sources_event_id_player_name_key,
  add constraint team_sources_player_key
    unique nulls not distinct (event_id, player_name, source_player_id);

create index team_sources_stage_idx
  on public.team_sources (made_top_cut, made_day_two);

-- Official team sheets are stored as published, typos included. An item
-- that isn't in the game (Choice Band) can't be an item_id, so it's kept as
-- written, with item_id null.
alter table public.team_sets
  add column listed_item text
    check (char_length(listed_item) between 1 and 50),
  add constraint team_sets_one_item check (item_id is null or listed_item is null);

comment on column public.team_sets.listed_item is
  'An item an official team sheet lists that isn''t in the game, as written. Only imported tournament teams have one.';

-- Only imported tournament teams can list an item that isn't in the game.
create function public.check_listed_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.listed_item is not null and not exists (
    select 1 from public.teams where id = new.team_id and origin = 'tournament'
  ) then
    raise exception 'Only official team sheets can list an item that isn''t in the game';
  end if;
  return new;
end;
$$;

create trigger team_sets_listed_item
  before insert or update of listed_item on public.team_sets
  for each row execute function public.check_listed_item();

-- import_event() now stores those fields:
--   event: { ..., topCutSize }
--   teams: [{ ..., sourcePlayerId, wins, losses, madeDayTwo, madeTopCut,
--             droppedRound, sets: [{ ..., listedItem }] }]
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

-- One row per tournament placement (a player's team at an event), with the
-- event alongside, for browsing tournament teams in event-date order. The
-- same team can place at several events, so a placement, not a team, is
-- what a browse row shows.
--
-- security_invoker makes the view apply the reader's own row-level
-- security, so it only shows placements of teams the reader can see.
create view public.tournament_placements
with (security_invoker = true)
as
select
  team_sources.id,
  team_sources.team_id,
  team_sources.player_name,
  team_sources.placement,
  team_sources.wins,
  team_sources.losses,
  team_sources.made_day_two,
  team_sources.made_top_cut,
  team_sources.teamlist_url,
  events.id as event_id,
  events.slug as event_slug,
  events.name as event_name,
  events.regulation_id,
  events.official,
  events.starts_on,
  events.ends_on,
  events.player_count,
  events.top_cut_size,
  events.standings_url
from public.team_sources
join public.events on events.id = team_sources.event_id
join public.teams on teams.id = team_sources.team_id
where teams.visibility = 'public';
