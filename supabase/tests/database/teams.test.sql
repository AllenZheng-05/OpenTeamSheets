-- Tests for the teams schema, its row-level security, import_event(),
-- publish_team() and fork_team(). Run with `pnpm db:test`. Everything runs
-- in a transaction that is rolled back, so the database is left unchanged.
begin;
create extension if not exists pgtap with schema extensions;
select plan(54);

-- The game data these tests need. It may already be there from
-- `pnpm data:sync`, so existing rows are left alone.
insert into public.types (id, name) values ('fire', 'Fire'), ('flying', 'Flying'), ('normal', 'Normal')
  on conflict do nothing;
insert into public.abilities (id, num, name) values ('blaze', 66, 'Blaze'), ('drought', 70, 'Drought')
  on conflict do nothing;
insert into public.items (id, num, name) values ('charizarditey', 661, 'Charizard Y')
  on conflict do nothing;
insert into public.natures (id, name, plus_stat, minus_stat) values ('modest', 'Modest', 'spa', 'atk')
  on conflict do nothing;
insert into public.moves (id, num, name, type_id, category, power, accuracy, pp, priority, target) values
  ('heatwave', 257, 'Heat Wave', 'fire', 'special', 95, 90, 10, 0, 'allAdjacentFoes'),
  ('protect', 182, 'Protect', 'normal', 'status', 0, null, 10, 4, 'self')
  on conflict do nothing;
insert into public.species (id, num, name, type1_id, type2_id, ability_1_id, hp, atk, def, spa, spd, spe) values
  ('charizard', 6, 'Charizard', 'fire', 'flying', 'blaze', 78, 84, 78, 109, 85, 100)
  on conflict do nothing;
insert into public.species (id, num, name, base_species_id, battle_only_from_id, type1_id, type2_id, ability_1_id, hp, atk, def, spa, spd, spe, required_item_id) values
  ('charizardmegay', 6, 'Charizard-Mega-Y', 'charizard', 'charizard', 'fire', 'flying', 'drought', 78, 104, 78, 159, 115, 100, 'charizarditey')
  on conflict do nothing;
insert into public.regulations (id, starts_at, data_status) values ('M-C', '2026-09-09T02:00:00Z', 'complete')
  on conflict do nothing;

-- A one-Pokémon payload is enough here: completeness is checked by the
-- importer before it calls import_event().
create function pg_temp.payload(
  source_id text,
  fingerprint text,
  move text default 'heatwave',
  top_cut boolean default true
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'event', jsonb_build_object(
      'source', 'other', 'sourceId', source_id, 'slug', source_id,
      'name', 'Test event ' || source_id,
      'regulationId', 'M-C', 'official', true,
      'startsOn', '2026-09-19', 'endsOn', '2026-09-20', 'playerCount', 100,
      'topCutSize', 8
    ),
    'teams', jsonb_build_array(jsonb_build_object(
      'fingerprint', fingerprint, 'archetypes', jsonb_build_array('sun'),
      'playerName', 'Test Player', 'sourcePlayerId', '991', 'placement', 1,
      'wins', 15, 'losses', 2, 'madeDayTwo', true, 'madeTopCut', top_cut,
      'teamlistUrl', 'https://example.com/teamlist',
      'sets', jsonb_build_array(jsonb_build_object(
        'slot', 1, 'speciesId', 'charizard', 'itemId', 'charizarditey',
        'abilityId', 'blaze', 'natureId', 'modest',
        'moves', jsonb_build_array(move, 'protect'), 'statPoints', null,
        'shiny', true, 'ivs', jsonb_build_object('atk', 0)
      )),
      'media', jsonb_build_array(jsonb_build_object(
        'kind', 'stream_vod', 'url', 'https://example.com/vod', 'startSeconds', 3721
      ))
    ))
  );
$$;

-- Tournament teams: importing

select is(
  public.import_event(pg_temp.payload('test-a', 'test-fingerprint')) -> 'teamsCreated',
  '1'::jsonb,
  'importing a new team creates it'
);
select is(
  public.import_event(pg_temp.payload('test-a', 'test-fingerprint')) -> 'teamsMerged',
  '1'::jsonb,
  'importing the same event again merges into the existing team'
);
select is(
  (select count(*)::integer from public.events where source = 'other' and source_id = 'test-a'),
  1,
  're-importing does not duplicate the event'
);
select is(
  (select count(*)::integer from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.fingerprint = 'test-fingerprint'),
  1,
  're-importing does not duplicate sets'
);
select is(
  (select count(*)::integer from public.team_archetypes
    join public.teams on teams.id = team_archetypes.team_id
    where teams.fingerprint = 'test-fingerprint'),
  1,
  're-importing does not duplicate archetypes'
);
select is(
  (select count(*)::integer from public.media_links
    join public.teams on teams.id = media_links.team_id
    where teams.fingerprint = 'test-fingerprint'),
  1,
  're-importing does not duplicate media links'
);
select public.import_event(pg_temp.payload('test-b', 'test-fingerprint'));
select is(
  (select count(*)::integer from public.team_sources
    join public.teams on teams.id = team_sources.team_id
    where teams.fingerprint = 'test-fingerprint'),
  2,
  'the same team at a second event gains a second source'
);
select is(
  (select slug from public.events where source = 'other' and source_id = 'test-a'),
  'test-a',
  'an imported event keeps its slug'
);
select throws_ok(
  $$ insert into public.events (source, source_id, slug, name, regulation_id, starts_on, ends_on)
     values ('rk9', 'another-event', 'test-a', 'Another event', 'M-C', '2026-10-01', '2026-10-01') $$,
  '23505',
  null,
  'two events cannot share a slug'
);

-- Tournament teams: integrity

select throws_ok(
  $$ select public.import_event(pg_temp.payload('test-c', 'test-unknown-move', 'notamove')) $$,
  '23503',
  null,
  'an unknown move is rejected'
);
select lives_ok(
  $$ insert into public.team_sets (team_id, slot, species_id, item_id)
     select id, 2, 'charizardmegay', 'charizarditey' from public.teams where fingerprint = 'test-fingerprint' $$,
  'a Mega can fill a team slot, as in Showdown'
);
select throws_ok(
  $$ insert into public.team_sets (team_id, slot, sp_hp)
     select id, 3, 33 from public.teams where fingerprint = 'test-fingerprint' $$,
  '23514',
  null,
  'more than 32 stat points in one stat is rejected'
);

-- Level, IVs and shiny

select is(
  (select level || '/' || iv_hp || '/' || iv_atk || '/' || shiny from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.fingerprint = 'test-fingerprint' and slot = 1),
  '50/31/0/true',
  'imports store shiny and IVs, with level 50 and IV 31 where the payload has none'
);
select is(
  (select level || '/' || iv_spe || '/' || shiny from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.fingerprint = 'test-fingerprint' and slot = 2),
  '50/31/false',
  'a set added without them gets level 50, IVs of 31 and not shiny'
);
select throws_ok(
  $$ insert into public.team_sets (team_id, slot, level, iv_atk)
     select id, 3, 101, 32 from public.teams where fingerprint = 'test-fingerprint' $$,
  '23514',
  null,
  'a level over 100 or an IV over 31 is rejected'
);

-- Official results: record, day 2 and top cut

select is(
  (select wins || '-' || losses || '/' || made_day_two || '/' || made_top_cut
    from public.team_sources
    join public.events on events.id = team_sources.event_id
    where events.source_id = 'test-a'),
  '15-2/true/true',
  'a placement stores the record and whether it made day 2 and top cut'
);
select is(
  (select top_cut_size from public.events where source_id = 'test-a'),
  8::smallint,
  'an event stores its top cut size'
);
select public.import_event(pg_temp.payload('test-a', 'test-fingerprint', 'heatwave', false));
select is(
  (select made_top_cut from public.team_sources
    join public.events on events.id = team_sources.event_id
    where events.source_id = 'test-a'),
  false,
  're-importing updates a placement''s flags'
);
select lives_ok(
  $$ insert into public.team_sources (team_id, event_id, player_name, source_player_id)
     select team_id, event_id, player_name, '992' from public.team_sources
     join public.events on events.id = team_sources.event_id
     where events.source_id = 'test-a' $$,
  'two players with the same name can both place at an event'
);
delete from public.team_sources where source_player_id = '992';

-- Anonymous visitors

set local role anon;
select is(
  (select count(*)::integer from public.teams where fingerprint = 'test-fingerprint'),
  1,
  'anyone can read public teams'
);
select is(
  (select count(*)::integer from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.fingerprint = 'test-fingerprint'),
  2, -- the imported set, plus the Mega added above
  'anyone can read the sets of public teams'
);
select is(
  (select count(*)::integer from public.tournament_placements where event_slug in ('test-a', 'test-b')),
  2,
  'anyone can browse tournament placements, with their event'
);
select is(
  (select made_top_cut::text || '/' || top_cut_size from public.tournament_placements
    where event_slug = 'test-a'),
  'false/8',
  'browsing shows whether a placement made top cut'
);
select throws_ok(
  $$ insert into public.teams (regulation_id, origin) values ('M-C', 'community') $$,
  '42501',
  null,
  'anonymous visitors cannot write teams'
);
select throws_ok(
  $$ select public.import_event('{}'::jsonb) $$,
  '42501',
  null,
  'anonymous visitors cannot import events'
);
reset role;

-- Community teams. Two users: Ash (…01) and Misty (…02).

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ash@example.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'misty@example.com');
insert into public.profiles (id, username) values ('aaaaaaaa-0000-0000-0000-000000000002', 'misty');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.profiles (id, username) values ('aaaaaaaa-0000-0000-0000-000000000001', 'ash') $$,
  'users create their own profile'
);
select is_empty(
  $$ update public.profiles set username = 'notmisty' where id = 'aaaaaaaa-0000-0000-0000-000000000002' returning 1 $$,
  'users cannot edit someone else''s profile'
);
select lives_ok(
  $$ insert into public.teams (id, regulation_id, origin, author_id)
     values ('cccccccc-0000-0000-0000-000000000001', 'M-C', 'community', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'users create private community teams'
);
select throws_ok(
  $$ insert into public.teams (regulation_id, origin, author_id)
     values ('M-C', 'community', 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  '42501',
  null,
  'users cannot create a team as someone else'
);
select throws_ok(
  $$ insert into public.teams (regulation_id, origin, visibility, published_at)
     values ('M-C', 'tournament', 'public', now()) $$,
  '42501',
  null,
  'users cannot create tournament teams'
);

-- Ash fills in one Pokémon and tries to publish too early.
insert into public.team_sets (team_id, slot, species_id, ability_id, nature_id, move_1_id, note)
  values ('cccccccc-0000-0000-0000-000000000001', 1, 'charizard', 'blaze', 'modest', 'heatwave', 'Sets sun');
select throws_ok(
  $$ select public.publish_team('cccccccc-0000-0000-0000-000000000001') $$,
  'P0001',
  null,
  'an incomplete team cannot be published'
);

-- Misty can't see Ash's draft.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.teams where id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'other users cannot see a private team'
);

-- Ash completes the team and publishes it.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
update public.teams set title = 'Sun' where id = 'cccccccc-0000-0000-0000-000000000001';
insert into public.team_writeups (team_id, overview) values ('cccccccc-0000-0000-0000-000000000001', 'Set sun, then sweep.');
insert into public.team_sets (team_id, slot, species_id, ability_id, nature_id, move_1_id)
  select 'cccccccc-0000-0000-0000-000000000001', slot, 'charizard', 'blaze', 'modest', 'protect'
  from generate_series(2, 6) as slot;
select lives_ok(
  $$ select public.publish_team('cccccccc-0000-0000-0000-000000000001') $$,
  'a complete team can be published, with no archetypes'
);
select is_empty(
  $$ update public.team_sets set note = 'changed' where team_id = 'cccccccc-0000-0000-0000-000000000001' returning 1 $$,
  'a published team''s sets cannot be changed'
);

-- Matchups: the table's own rules, checked without RLS.
reset role;
select throws_ok(
  $$ insert into public.team_matchups (team_id, archetype_id, species_id, outlook)
     values ('cccccccc-0000-0000-0000-000000000001', 'sun', 'charizard', 'favorable') $$,
  '23514',
  null,
  'a matchup has exactly one target'
);
select throws_ok(
  $$ insert into public.team_matchups (team_id, species_id)
     values ('cccccccc-0000-0000-0000-000000000001', 'charizard') $$,
  '23502',
  null,
  'a matchup needs an outlook'
);

set local role anon;
select is(
  (select count(*)::integer from public.teams where id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'anyone can see a published team'
);
reset role;

-- Misty comments and votes.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.team_comments (team_id, author_id, body)
     values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'Nice team!') $$,
  'users comment on published community teams'
);
select throws_ok(
  $$ insert into public.team_comments (team_id, author_id, body)
     select id, 'aaaaaaaa-0000-0000-0000-000000000002', 'Hi' from public.teams where fingerprint = 'test-fingerprint' $$,
  '42501',
  null,
  'users cannot comment on tournament teams'
);
select lives_ok(
  $$ insert into public.team_votes (user_id, team_id)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001') $$,
  'users upvote a published team'
);
select throws_ok(
  $$ insert into public.team_votes (user_id, team_id)
     values ('aaaaaaaa-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000001') $$,
  '23505',
  null,
  'users cannot upvote the same team twice'
);
select throws_ok(
  $$ insert into public.team_votes (user_id, team_id)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'users cannot vote as someone else'
);

-- Misty forks the tournament team.
select isnt(
  public.fork_team((select id from public.teams where fingerprint = 'test-fingerprint')),
  null,
  'users can fork a public team'
);
select is(
  (select count(*)::integer from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.forked_from_id = (select id from public.teams where fingerprint = 'test-fingerprint')),
  2,
  'a fork copies every set'
);
select is(
  (select count(*)::integer from public.team_archetypes
    join public.teams on teams.id = team_archetypes.team_id
    where teams.forked_from_id = (select id from public.teams where fingerprint = 'test-fingerprint')),
  1,
  'a fork copies the archetypes'
);
select is(
  (select team_sets.shiny::text || '/' || team_sets.iv_atk from public.team_sets
    join public.teams on teams.id = team_sets.team_id
    where teams.forked_from_id = (select id from public.teams where fingerprint = 'test-fingerprint')
      and team_sets.slot = 1),
  'true/0',
  'a fork copies shiny and IVs'
);
select is(
  (select visibility || '/' || origin from public.teams
    where forked_from_id = (select id from public.teams where fingerprint = 'test-fingerprint')),
  'private/community',
  'a fork starts as the forker''s private community team'
);

-- Ash unpublishes to edit. Comments are hidden, not deleted.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
select isnt_empty(
  $$ update public.teams set visibility = 'private', published_at = null where id = 'cccccccc-0000-0000-0000-000000000001' returning 1 $$,
  'authors can unpublish their team'
);
select isnt_empty(
  $$ update public.team_sets set note = 'Sets sun turn 1' where team_id = 'cccccccc-0000-0000-0000-000000000001' and slot = 1 returning 1 $$,
  'an unpublished team can be edited again'
);
select lives_ok(
  $$ insert into public.team_archetypes (team_id, archetype_id) values
     ('cccccccc-0000-0000-0000-000000000001', 'sun'),
     ('cccccccc-0000-0000-0000-000000000001', 'hyper-offense') $$,
  'a team can have several archetypes'
);
reset role;

set local role anon;
select is(
  (select count(*)::integer from public.team_comments where team_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'comments on an unpublished team are hidden'
);
reset role;
select is(
  (select count(*)::integer from public.team_comments where team_id = 'cccccccc-0000-0000-0000-000000000001'),
  1,
  'comments on an unpublished team are kept'
);

-- Ash deletes the team: its comments and votes go with it.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);
delete from public.teams where id = 'cccccccc-0000-0000-0000-000000000001';
reset role;
select is(
  (select count(*)::integer from public.team_comments where team_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'deleting a team deletes its comments'
);
select is(
  (select count(*)::integer from public.team_votes where team_id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'deleting a team deletes its votes'
);

select * from finish();
rollback;
