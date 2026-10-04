-- Tests for search_placements() and the search tags behind it. Run with
-- `pnpm db:test`. Everything runs in a transaction that is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

-- The game data these tests need. It may already be there from
-- `pnpm data:sync`, so existing rows are left alone.
insert into public.types (id, name) values
  ('fire', 'Fire'), ('flying', 'Flying'), ('normal', 'Normal'), ('dark', 'Dark'), ('dragon', 'Dragon')
  on conflict do nothing;
insert into public.abilities (id, num, name) values
  ('blaze', 66, 'Blaze'), ('drought', 70, 'Drought'), ('intimidate', 22, 'Intimidate'), ('toughclaws', 181, 'Tough Claws')
  on conflict do nothing;
insert into public.items (id, num, name) values
  ('charizarditex', 660, 'Charizardite X'), ('charizarditey', 661, 'Charizardite Y'), ('sitrusberry', 158, 'Sitrus Berry')
  on conflict do nothing;
insert into public.natures (id, name, plus_stat, minus_stat) values ('modest', 'Modest', 'spa', 'atk')
  on conflict do nothing;
insert into public.moves (id, num, name, type_id, category, power, accuracy, pp, priority, target) values
  ('heatwave', 257, 'Heat Wave', 'fire', 'special', 95, 90, 10, 0, 'allAdjacentFoes'),
  ('protect', 182, 'Protect', 'normal', 'status', 0, null, 10, 4, 'self'),
  ('fakeout', 252, 'Fake Out', 'normal', 'physical', 40, 100, 10, 3, 'normal'),
  ('knockoff', 282, 'Knock Off', 'dark', 'physical', 65, 100, 20, 0, 'normal')
  on conflict do nothing;
insert into public.species (id, num, name, type1_id, type2_id, ability_1_id, hp, atk, def, spa, spd, spe) values
  ('charizard', 6, 'Charizard', 'fire', 'flying', 'blaze', 78, 84, 78, 109, 85, 100),
  ('incineroar', 727, 'Incineroar', 'fire', 'dark', 'blaze', 95, 115, 90, 80, 90, 60)
  on conflict do nothing;
insert into public.species (id, num, name, base_species_id, battle_only_from_id, type1_id, type2_id, ability_1_id, hp, atk, def, spa, spd, spe, required_item_id) values
  ('charizardmegax', 6, 'Charizard-Mega-X', 'charizard', 'charizard', 'fire', 'dragon', 'toughclaws', 78, 130, 111, 130, 85, 100, 'charizarditex'),
  ('charizardmegay', 6, 'Charizard-Mega-Y', 'charizard', 'charizard', 'fire', 'flying', 'drought', 78, 104, 78, 159, 115, 100, 'charizarditey')
  on conflict do nothing;
insert into public.regulations (id, starts_at, data_status) values ('M-C', '2026-09-09T02:00:00Z', 'complete')
  on conflict do nothing;

-- One player's team at the test event.
create function pg_temp.import(
  player text,
  fingerprint text,
  sets jsonb,
  archetypes jsonb default '[]',
  day_two boolean default false,
  top_cut boolean default false,
  sheet_errors jsonb default '[]',
  placement integer default 1
)
returns jsonb language sql as $$
  select public.import_event(jsonb_build_object(
    'event', jsonb_build_object(
      'source', 'other', 'sourceId', 'search-test', 'slug', 'search-test',
      'name', 'Search test', 'regulationId', 'M-C', 'official', true,
      'startsOn', '2026-09-19', 'endsOn', '2026-09-20'
    ),
    'teams', jsonb_build_array(jsonb_build_object(
      'fingerprint', fingerprint, 'archetypes', archetypes,
      'playerName', player, 'placement', placement,
      'madeDayTwo', day_two, 'madeTopCut', top_cut,
      'sets', sets, 'sheetErrors', sheet_errors
    ))
  ));
$$;

create function pg_temp.set(slot int, species text, item text, ability text, moves jsonb)
returns jsonb language sql as $$
  select jsonb_build_object(
    'slot', slot, 'speciesId', species, 'itemId', item, 'abilityId', ability,
    'natureId', 'modest', 'moves', moves
  );
$$;

-- Ash: Mega Charizard X, and Incineroar with Knock Off. Sun, top cut, an
-- explained sheet error.
select pg_temp.import('Ash', 'search-test-ash', jsonb_build_array(
  pg_temp.set(1, 'charizard', 'charizarditex', 'blaze', '["heatwave", "protect"]'),
  pg_temp.set(2, 'incineroar', 'sitrusberry', 'intimidate', '["fakeout", "knockoff"]')
), '["sun"]', true, true, '[{"slot": 2, "field": "move", "value": "knockoff", "message": "a typo", "reading": "Fake Out"}]');
-- Misty: Mega Charizard Y, and Incineroar without Knock Off. Day 2, an
-- unexplained sheet error.
select pg_temp.import('Misty_Waterflower', 'search-test-misty', jsonb_build_array(
  pg_temp.set(1, 'charizard', 'charizarditey', 'drought', '["heatwave"]'),
  pg_temp.set(2, 'incineroar', null, 'intimidate', '["fakeout"]')
), day_two => true, sheet_errors => '[{"slot": 1, "message": "a mystery"}]');
-- Brock: a plain Charizard.
select pg_temp.import('Brock', 'search-test-brock', jsonb_build_array(
  pg_temp.set(1, 'charizard', null, 'blaze', '["protect"]')
), placement => 20);

-- The players a search finds at the test event, in name order.
create function pg_temp.found(filters jsonb default '{}')
returns text[] language sql as $$
  select coalesce(array_agg(player_name order by player_name), '{}')
  from public.search_placements(filters || '{"event": "search-test"}');
$$;

-- Visitors search; the rest of the tests run as one.
set local role anon;

select is(pg_temp.found(), '{Ash,Brock,Misty_Waterflower}', 'no filters finds every team');
select throws_ok(
  $$ select * from private.team_set_tags $$,
  '42501', null,
  'visitors cannot read the search tags directly'
);

-- Pokémon
select is(pg_temp.found('{"has": [{"pokemon": "incineroar"}]}'), '{Ash,Misty_Waterflower}', 'a Pokémon');
select is(pg_temp.found('{"not": [{"pokemon": "incineroar"}]}'), '{Brock}', 'excluding a Pokémon');
select is(pg_temp.found('{"has": [{"pokemon": "charizard"}]}'), '{Ash,Brock,Misty_Waterflower}', 'a Pokémon includes its Megas');
select is(pg_temp.found('{"has": [{"pokemon": "charizardmegay"}]}'), '{Misty_Waterflower}', 'a Mega form needs its stone');
select is(pg_temp.found('{"not": [{"pokemon": "charizardmegax"}]}'), '{Brock,Misty_Waterflower}', 'excluding a Mega form');

-- Moves, abilities, items, types
select is(pg_temp.found('{"has": [{"moves": ["knockoff"]}]}'), '{Ash}', 'a move on any Pokémon');
select is(pg_temp.found('{"not": [{"moves": ["fakeout"]}]}'), '{Brock}', 'excluding a move');
select is(pg_temp.found('{"has": [{"ability": "drought"}]}'), '{Misty_Waterflower}', 'an ability');
select is(pg_temp.found('{"not": [{"ability": "intimidate"}]}'), '{Brock}', 'excluding an ability');
select is(pg_temp.found('{"has": [{"item": "sitrusberry"}]}'), '{Ash}', 'an item');
select is(pg_temp.found('{"not": [{"item": "sitrusberry"}]}'), '{Brock,Misty_Waterflower}', 'excluding an item');
select is(pg_temp.found('{"has": [{"type": "dragon"}]}'), '{Ash}', 'types are the battling form''s');
select is(pg_temp.found('{"not": [{"type": "dark"}]}'), '{Brock}', 'excluding a type');

-- A Pokémon with details
select is(pg_temp.found('{"has": [{"pokemon": "incineroar", "moves": ["knockoff"]}]}'), '{Ash}', 'a Pokémon with a move');
select is(pg_temp.found('{"not": [{"pokemon": "incineroar", "moves": ["knockoff"]}]}'), '{Brock,Misty_Waterflower}', 'excluding a Pokémon with a move keeps it without the move');
select is(pg_temp.found('{"has": [{"pokemon": "charizard", "moves": ["fakeout"]}]}'), '{}', 'details must be on the same Pokémon');
select is(pg_temp.found('{"has": [{"pokemon": "charizard"}, {"moves": ["fakeout"]}]}'), '{Ash,Misty_Waterflower}', 'separate conditions can match different Pokémon');
select is(pg_temp.found('{"has": [{"pokemon": "incineroar", "ability": "intimidate", "item": "sitrusberry"}]}'), '{Ash}', 'a Pokémon with an ability and an item');

-- Archetypes and players
select is(pg_temp.found('{"archetypes": ["sun"]}'), '{Ash}', 'an archetype');
select is(pg_temp.found('{"notArchetypes": ["sun"]}'), '{Brock,Misty_Waterflower}', 'excluding an archetype');
select is(pg_temp.found('{"players": ["ash", "MISTY"]}'), '{Ash,Misty_Waterflower}', 'players match any, ignoring case');
select is(pg_temp.found('{"notPlayers": ["ash"]}'), '{Brock,Misty_Waterflower}', 'excluding a player');
select is(pg_temp.found('{"players": ["%"]}'), '{}', 'a player''s wildcards are literal');
select is(pg_temp.found('{"players": ["y_w"]}'), '{Misty_Waterflower}', 'an underscore matches only itself');

-- Sheet errors
select is(pg_temp.found('{"errors": "any"}'), '{Ash,Misty_Waterflower}', 'teams with sheet errors');
select is(pg_temp.found('{"errors": "unexplained"}'), '{Misty_Waterflower}', 'teams with unexplained sheet errors');
select is(pg_temp.found('{"errors": "none"}'), '{Brock}', 'teams without sheet errors');

-- Regulation and stage
select is(pg_temp.found('{"regulation": "M-B"}'), '{}', 'another regulation');
select is(pg_temp.found('{"regulation": "M-C"}'), '{Ash,Brock,Misty_Waterflower}', 'the event''s regulation');
select is(pg_temp.found('{"stage": "top-cut"}'), '{Ash}', 'top cut');
select is(pg_temp.found('{"stage": "day-2"}'), '{Ash,Misty_Waterflower}', 'day 2 includes top cut');
select is(pg_temp.found('{"top": 8}'), '{Ash,Misty_Waterflower}', 'the top 8');
select is(pg_temp.found('{"top": 32}'), '{Ash,Brock,Misty_Waterflower}', 'the top 32');

-- Combined
select is(
  pg_temp.found('{"has": [{"pokemon": "charizard"}], "not": [{"moves": ["knockoff"]}], "stage": "day-2"}'),
  '{Misty_Waterflower}',
  'filters combine'
);

-- Box matching: Megas count as the Pokémon they Mega Evolve from
select is(pg_temp.found('{"box": ["charizard", "incineroar"]}'), '{Ash,Brock,Misty_Waterflower}', 'a box with everything builds every team');
select is(pg_temp.found('{"box": ["charizard"]}'), '{Brock}', 'a Mega counts as its base form; a missing Pokémon rules a team out');
select is(pg_temp.found('{"box": ["charizard"], "boxMissing": 1}'), '{Ash,Brock,Misty_Waterflower}', 'missing at most one');
select is(pg_temp.found('{"box": []}'), '{}', 'an empty box builds nothing');
select is(pg_temp.found('{"box": [], "boxMissing": 1}'), '{Brock}', 'an empty box, missing at most one');

-- Box usage, checked against the team sheets directly (other data may be
-- loaded too). Megas count as their base form.
create function pg_temp.placements_with(species text)
returns bigint language sql as $$
  select count(*) from public.tournament_placements as p
  where p.regulation_id = 'M-C' and exists (
    select 1 from public.team_sets as s
    join public.species as sp on sp.id = s.species_id
    where s.team_id = p.team_id and coalesce(sp.battle_only_from_id, sp.id) = species
  );
$$;
select is(
  (select placements from public.box_usage('M-C') where box_species = 'charizard'),
  pg_temp.placements_with('charizard'),
  'usage counts placements whose team has the Pokémon, Megas as their base'
);
select is(
  (select total from public.box_usage('M-C') limit 1),
  (select count(*) from public.tournament_placements where regulation_id = 'M-C'),
  'usage is out of every placement in the regulation'
);

-- Refreshing search tags in batches of teams, as data:sync does
reset role;
create function pg_temp.refresh_all(batch integer)
returns integer language plpgsql as $$
declare
  after uuid;
  batches integer := 0;
begin
  loop
    after := public.refresh_search_tags(after, batch);
    exit when after is null;
    batches := batches + 1;
  end loop;
  return batches;
end;
$$;
select is(
  pg_temp.refresh_all(1),
  (select count(distinct team_id)::integer from public.team_sets),
  'a batch of one team at a time covers every team, then stops'
);
select is(pg_temp.found('{"box": ["charizard"]}'), '{Brock}', 'search still works after a refresh');
set local role anon;

-- Official or online
select is(pg_temp.found('{"kind": "official"}'), '{Ash,Brock,Misty_Waterflower}', 'official events only');
select is(pg_temp.found('{"kind": "online"}'), '{}', 'online events only, none here');
reset role;
update public.events set official = false where slug = 'search-test';
set local role anon;
select is(pg_temp.found('{"kind": "online"}'), '{Ash,Brock,Misty_Waterflower}', 'an online event');
reset role;
update public.events set official = true where slug = 'search-test';
set local role anon;

-- Changes to the data
reset role;
update public.team_sets set move_2_id = 'knockoff'
  from public.teams
  where teams.id = team_sets.team_id and teams.fingerprint = 'search-test-brock';
select pg_temp.import('Misty_Waterflower', 'search-test-misty', '[]', day_two => true);
update public.teams set visibility = 'private', published_at = null where fingerprint = 'search-test-ash';
set local role anon;

select is(pg_temp.found('{"has": [{"moves": ["knockoff"]}]}'), '{Brock}', 'editing a set updates its tags');
select is(pg_temp.found('{"errors": "unexplained"}'), '{}', 'importing again replaces sheet errors');
select is(pg_temp.found(), '{Brock,Misty_Waterflower}', 'private teams never appear');

select * from finish();
rollback;
