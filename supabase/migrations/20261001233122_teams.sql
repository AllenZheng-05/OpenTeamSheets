-- Teams: tournament teams imported from events, and community teams that
-- users build, write up and publish. Tournament teams are written by
-- `pnpm import:event` through import_event(); community teams by signed-in
-- users, limited by the row-level security policies below.

-- Keeps updated_at current on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Public identity of a signed-in user. Login details (email, Discord) stay
-- in Supabase's private auth schema.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Team styles such as sun or Trick Room, used to tag teams and matchups.
-- A team can have any number of them, including none. Add new ones with a
-- new migration.
create table public.archetypes (
  id text primary key,
  name text not null
);

insert into public.archetypes (id, name) values
  ('sun', 'Sun'),
  ('rain', 'Rain'),
  ('sand', 'Sand'),
  ('snow', 'Snow'),
  ('psychic-terrain', 'Psychic Terrain'),
  ('grassy-terrain', 'Grassy Terrain'),
  ('electric-terrain', 'Electric Terrain'),
  ('misty-terrain', 'Misty Terrain'),
  ('trick-room', 'Trick Room'),
  ('tailwind', 'Tailwind'),
  ('perish-trap', 'Perish Trap'),
  ('hyper-offense', 'Hyper Offense'),
  ('balance', 'Balance'),
  ('setup', 'Setup'),
  ('gimmick', 'Gimmick');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- The platform holding the official results, and the event's id there.
  -- Unique together, so importing an event again updates it.
  source text not null check (source in ('rk9', 'limitless', 'other')),
  source_id text not null,
  name text not null,
  regulation_id text not null references public.regulations (id),
  -- An official Play! Pokémon event.
  official boolean not null default false,
  starts_on date not null,
  ends_on date not null,
  player_count integer check (player_count > 0),
  standings_url text,
  created_at timestamptz not null default now(),
  unique (source, source_id),
  check (ends_on >= starts_on)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  regulation_id text not null references public.regulations (id),
  origin text not null check (origin in ('tournament', 'community')),
  -- Community teams have an author; tournament teams never do.
  author_id uuid references public.profiles (id) on delete cascade,
  title text,
  -- The team this was forked from. A tournament team's page lists the
  -- community teams forked from it.
  forked_from_id uuid references public.teams (id) on delete set null,
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  -- When the team was last published. Comments older than this were written
  -- about an earlier version.
  published_at timestamptz,
  -- Identifies identical tournament teams, so the same six from two events
  -- become one team with two sources. Null for community teams.
  fingerprint text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((origin = 'community') = (author_id is not null)),
  check ((visibility = 'public') = (published_at is not null))
);

create index teams_author_id_idx on public.teams (author_id);
create index teams_forked_from_id_idx on public.teams (forked_from_id);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create table public.team_archetypes (
  team_id uuid not null references public.teams (id) on delete cascade,
  archetype_id text not null references public.archetypes (id),
  primary key (team_id, archetype_id)
);

-- One Pokémon per slot. Everything but the slot is nullable, so incomplete
-- teams can be saved; completeness is checked when a team is published or
-- imported. Stat points are null when they aren't public, as on official
-- team sheets.
create table public.team_sets (
  team_id uuid not null references public.teams (id) on delete cascade,
  slot smallint not null check (slot between 1 and 6),
  species_id text references public.species (id),
  item_id text references public.items (id),
  ability_id text references public.abilities (id),
  nature_id text references public.natures (id),
  move_1_id text references public.moves (id),
  move_2_id text references public.moves (id),
  move_3_id text references public.moves (id),
  move_4_id text references public.moves (id),
  sp_hp smallint check (sp_hp between 0 and 32),
  sp_atk smallint check (sp_atk between 0 and 32),
  sp_def smallint check (sp_def between 0 and 32),
  sp_spa smallint check (sp_spa between 0 and 32),
  sp_spd smallint check (sp_spd between 0 and 32),
  sp_spe smallint check (sp_spe between 0 and 32),
  -- The write-up for this Pokémon: why this set and what it does.
  note text,
  primary key (team_id, slot)
);

create index team_sets_species_id_idx on public.team_sets (species_id);

-- As in Pokémon Showdown, a slot may name a battle-only form such as
-- Charizard-Mega-Y. Validation then requires its item (or ability or move)
-- and checks the set as the form it changes from. That happens when a team
-- is imported or published, not here, so drafts can be saved before the
-- item is chosen.
comment on column public.species.battle_only_from_id is
  'For forms that only exist mid-battle (Megas, Mimikyu-Busted), the form it changes from. '
  'A team slot may name such a form, as in Pokémon Showdown, but it is validated as this form '
  'and only this form can be legal in a regulation. Null for other forms.';

-- The team's write-up overview: what it is built to do and how to play it.
-- Notes on individual Pokémon live on team_sets.
create table public.team_writeups (
  team_id uuid primary key references public.teams (id) on delete cascade,
  overview text not null default '',
  updated_at timestamptz not null default now()
);

create trigger team_writeups_set_updated_at
  before update on public.team_writeups
  for each row execute function public.set_updated_at();

-- How the team plays into an archetype or a Pokémon. The outlook is the
-- author's verdict; "good against X" search only matches favorable ones.
create table public.team_matchups (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  archetype_id text references public.archetypes (id),
  species_id text references public.species (id),
  outlook text not null check (outlook in ('favorable', 'even', 'unfavorable')),
  -- The slots to lead with, such as {1,4}.
  lead_slots smallint[] not null default '{}'
    check (lead_slots <@ '{1,2,3,4,5,6}'::smallint[] and cardinality(lead_slots) <= 2),
  notes text not null default '',
  -- Exactly one target: an archetype or a Pokémon.
  check (num_nonnulls(archetype_id, species_id) = 1),
  unique nulls not distinct (team_id, archetype_id, species_id)
);

create index team_matchups_species_id_idx on public.team_matchups (species_id);
create index team_matchups_archetype_id_idx on public.team_matchups (archetype_id);

-- Where a tournament team placed. The same team can place at several events.
create table public.team_sources (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  player_name text not null,
  placement integer check (placement > 0),
  -- Wins and losses, such as "14-2", when known.
  record text,
  teamlist_url text,
  unique (event_id, player_name)
);

create index team_sources_team_id_idx on public.team_sources (team_id);

create table public.media_links (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  kind text not null check (kind in ('stream_vod', 'youtube', 'replay')),
  url text not null,
  start_seconds integer check (start_seconds >= 0),
  title text,
  unique (team_id, url)
);

-- Discussion on published community teams.
create table public.team_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_comments_team_id_idx on public.team_comments (team_id);

create trigger team_comments_set_updated_at
  before update on public.team_comments
  for each row execute function public.set_updated_at();

-- Upvotes. A row is one user's upvote of one team.
create table public.team_votes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create index team_votes_team_id_idx on public.team_votes (team_id);

-- Row-level security
--
-- Anyone can read public teams and everything on them. Signed-in users
-- write their own community teams while they're private; publishing goes
-- through publish_team(). Tournament teams and events are written only by
-- the import, with the secret key.

-- A team you can see: public, or your own.
create function public.is_team_visible(p_team_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id
      and (visibility = 'public' or author_id = (select auth.uid()))
  );
$$;

-- A team you can change: your own community team, while it's private.
create function public.is_team_editable(p_team_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id
      and author_id = (select auth.uid())
      and visibility = 'private'
  );
$$;

-- A public team of the given origin, for comments.
create function public.is_team_public(p_team_id uuid, p_origin text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.teams
    where id = p_team_id and visibility = 'public' and origin = p_origin
  );
$$;

alter table public.profiles enable row level security;
alter table public.archetypes enable row level security;
alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.team_archetypes enable row level security;
alter table public.team_sets enable row level security;
alter table public.team_writeups enable row level security;
alter table public.team_matchups enable row level security;
alter table public.team_sources enable row level security;
alter table public.media_links enable row level security;
alter table public.team_comments enable row level security;
alter table public.team_votes enable row level security;

create policy "Profiles are public" on public.profiles for select using (true);
create policy "Users create their own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "Users edit their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "Archetypes are public" on public.archetypes for select using (true);
create policy "Events are public" on public.events for select using (true);

create policy "Public and own teams are readable" on public.teams
  for select using (visibility = 'public' or author_id = (select auth.uid()));
create policy "Users create private community teams" on public.teams
  for insert to authenticated with check (
    origin = 'community'
    and author_id = (select auth.uid())
    and visibility = 'private'
    and fingerprint is null
  );
-- Covers editing a private team and unpublishing a public one: either way
-- the result must be private. Publishing goes through publish_team().
create policy "Users edit and unpublish their own teams" on public.teams
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    origin = 'community'
    and author_id = (select auth.uid())
    and visibility = 'private'
    and fingerprint is null
  );
create policy "Users delete their own teams" on public.teams
  for delete to authenticated using (author_id = (select auth.uid()));

-- Everything inside a team: readable with the team, editable with it.
create policy "Readable with the team" on public.team_archetypes
  for select using (public.is_team_visible(team_id));
create policy "Editable with the team" on public.team_archetypes
  for all to authenticated
  using (public.is_team_editable(team_id)) with check (public.is_team_editable(team_id));

create policy "Readable with the team" on public.team_sets
  for select using (public.is_team_visible(team_id));
create policy "Editable with the team" on public.team_sets
  for all to authenticated
  using (public.is_team_editable(team_id)) with check (public.is_team_editable(team_id));

create policy "Readable with the team" on public.team_writeups
  for select using (public.is_team_visible(team_id));
create policy "Editable with the team" on public.team_writeups
  for all to authenticated
  using (public.is_team_editable(team_id)) with check (public.is_team_editable(team_id));

create policy "Readable with the team" on public.team_matchups
  for select using (public.is_team_visible(team_id));
create policy "Editable with the team" on public.team_matchups
  for all to authenticated
  using (public.is_team_editable(team_id)) with check (public.is_team_editable(team_id));

-- Tournament data: readable with the team, written only by the import.
create policy "Readable with the team" on public.team_sources
  for select using (public.is_team_visible(team_id));
create policy "Readable with the team" on public.media_links
  for select using (public.is_team_visible(team_id));

-- Comments are visible while their team is public; hidden, not deleted,
-- when it's unpublished.
create policy "Comments on public teams are readable" on public.team_comments
  for select using (public.is_team_public(team_id, 'community'));
create policy "Users comment as themselves on public community teams" on public.team_comments
  for insert to authenticated with check (
    author_id = (select auth.uid()) and public.is_team_public(team_id, 'community')
  );
create policy "Users edit their own comments" on public.team_comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and public.is_team_public(team_id, 'community'));
create policy "Users delete their own comments" on public.team_comments
  for delete to authenticated using (author_id = (select auth.uid()));

create policy "Votes are public" on public.team_votes for select using (true);
create policy "Users upvote public teams as themselves" on public.team_votes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (public.is_team_public(team_id, 'community') or public.is_team_public(team_id, 'tournament'))
  );
create policy "Users remove their own votes" on public.team_votes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Publishes your own private community team once it's complete: a title,
-- a write-up overview, and six Pokémon that each have a species, ability,
-- nature and a move. Archetypes are optional. Legality (learnsets, items,
-- stat points) is checked by the site's validator before calling this.
create function public.publish_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  team public.teams;
begin
  select * into team from public.teams
  where id = p_team_id and author_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Team not found, or it isn''t yours';
  end if;
  if team.visibility = 'public' then
    raise exception 'Team is already published';
  end if;
  if coalesce(trim(team.title), '') = '' then
    raise exception 'Give the team a title before publishing';
  end if;
  if not exists (
    select 1 from public.team_writeups
    where team_id = p_team_id and trim(overview) <> ''
  ) then
    raise exception 'Write an overview before publishing';
  end if;
  if (
    select count(*) from public.team_sets
    where team_id = p_team_id
      and species_id is not null
      and ability_id is not null
      and nature_id is not null
      and num_nonnulls(move_1_id, move_2_id, move_3_id, move_4_id) > 0
  ) <> 6 or (select count(*) from public.team_sets where team_id = p_team_id) <> 6 then
    raise exception 'Every slot needs a species, ability, nature and at least one move';
  end if;

  update public.teams
  set visibility = 'public', published_at = now()
  where id = p_team_id;
end;
$$;

-- Copies a team you can see into a new private team of your own, with its
-- sets (and their notes) and archetypes. Returns the new team's id. Runs
-- with your permissions, so the policies above apply to every step.
create function public.fork_team(p_team_id uuid)
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
    sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe, note
  )
  select
    new_id, slot, species_id, item_id, ability_id, nature_id,
    move_1_id, move_2_id, move_3_id, move_4_id,
    sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe, note
  from public.team_sets where team_id = p_team_id;

  insert into public.team_archetypes (team_id, archetype_id)
  select new_id, archetype_id from public.team_archetypes where team_id = p_team_id;

  return new_id;
end;
$$;

revoke execute on function public.publish_team(uuid) from public, anon;
revoke execute on function public.fork_team(uuid) from public, anon;
grant execute on function public.publish_team(uuid) to authenticated;
grant execute on function public.fork_team(uuid) to authenticated;

-- Imports one event and its teams in a single transaction. Teams are
-- matched by fingerprint, so a team already imported from another event
-- gains a source instead of a duplicate. Running the same import twice
-- changes nothing.
--
-- payload: {
--   event: { source, sourceId, name, regulationId, official, startsOn,
--            endsOn, playerCount, standingsUrl },
--   teams: [{ fingerprint, archetypes: [archetype ids], playerName,
--             placement, record, teamlistUrl,
--             sets: [{ slot, speciesId, itemId, abilityId, natureId,
--                      moves: [...], statPoints: { hp, atk, ... } | null }],
--             media: [{ kind, url, startSeconds, title }] }]
-- }
create function public.import_event(payload jsonb)
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
        sp_hp, sp_atk, sp_def, sp_spa, sp_spd, sp_spe
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
        (s -> 'statPoints' ->> 'spe')::smallint
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

-- Only maintainer tools, using the secret key, may import.
revoke execute on function public.import_event(jsonb) from public, anon, authenticated;
grant execute on function public.import_event(jsonb) to service_role;
