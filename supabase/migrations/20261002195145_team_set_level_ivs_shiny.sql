-- Level, IVs and shiny for each Pokémon. Champions sets every Pokémon to
-- level 50 with perfect IVs, so those only matter when a team is exported
-- to a format that uses them, such as Showdown. Shiny picks the sprite.
alter table public.team_sets
  add column level smallint not null default 50 check (level between 1 and 100),
  add column iv_hp smallint not null default 31 check (iv_hp between 0 and 31),
  add column iv_atk smallint not null default 31 check (iv_atk between 0 and 31),
  add column iv_def smallint not null default 31 check (iv_def between 0 and 31),
  add column iv_spa smallint not null default 31 check (iv_spa between 0 and 31),
  add column iv_spd smallint not null default 31 check (iv_spd between 0 and 31),
  add column iv_spe smallint not null default 31 check (iv_spe between 0 and 31),
  add column shiny boolean not null default false;

-- fork_team() and import_event() now carry the new columns. Both keep
-- their existing permissions when replaced.

create or replace function public.fork_team(p_team_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  source public.teams;
  new_id uuid;
begin
  select * into source from public.teams where id = p_team_id;
  if not found then
    raise exception 'Team not found';
  end if;

  insert into public.teams (regulation_id, origin, author_id, title, forked_from_id)
  values (source.regulation_id, 'community', (select auth.uid()), source.title, source.id)
  returning id into new_id;

  insert into public.team_sets (
    team_id, slot, species_id, item_id, ability_id, nature_id,
    move_1_id, move_2_id, move_3_id, move_4_id,
    sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe, note,
    level, iv_hp, iv_atk, iv_def, iv_spa, iv_spd, iv_spe, shiny
  )
  select
    new_id, slot, species_id, item_id, ability_id, nature_id,
    move_1_id, move_2_id, move_3_id, move_4_id,
    sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe, note,
    level, iv_hp, iv_atk, iv_def, iv_spa, iv_spd, iv_spe, shiny
  from public.team_sets where team_id = p_team_id;

  insert into public.team_archetypes (team_id, archetype_id)
  select new_id, archetype_id from public.team_archetypes where team_id = p_team_id;

  return new_id;
end;
$$;

-- As before, plus each set's optional level (default 50), ivs (default 31
-- each) and shiny (default false):
--   sets: [{ ..., level, ivs: { hp, atk, ... } | null, shiny }]
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
    source, source_id, name, regulation_id, official, starts_on, ends_on,
    player_count, standings_url
  )
  values (
    event_row ->> 'source',
    event_row ->> 'sourceId',
    event_row ->> 'name',
    event_row ->> 'regulationId',
    coalesce((event_row ->> 'official')::boolean, false),
    (event_row ->> 'startsOn')::date,
    (event_row ->> 'endsOn')::date,
    (event_row ->> 'playerCount')::integer,
    event_row ->> 'standingsUrl'
  )
  on conflict (source, source_id) do update set
    name = excluded.name,
    regulation_id = excluded.regulation_id,
    official = excluded.official,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on,
    player_count = excluded.player_count,
    standings_url = excluded.standings_url
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
        level, iv_hp, iv_atk, iv_def, iv_spa, iv_spd, iv_spe, shiny
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
        coalesce((s ->> 'shiny')::boolean, false)
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
      team_id, event_id, player_name, placement, record, teamlist_url
    )
    values (
      v_team_id,
      v_event_id,
      team ->> 'playerName',
      (team ->> 'placement')::integer,
      team ->> 'record',
      team ->> 'teamlistUrl'
    )
    on conflict (event_id, player_name) do update set
      team_id = excluded.team_id,
      placement = excluded.placement,
      record = excluded.record,
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
