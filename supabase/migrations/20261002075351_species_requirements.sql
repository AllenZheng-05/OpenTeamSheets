-- What a battle-only form needs besides its item, as in Pokémon Showdown:
-- an ability (Stance Change for Aegislash-Blade) or a move (Relic Song for
-- Meloetta-Pirouette). The validator checks these when a team slot names
-- such a form. Filled by `pnpm data:sync`.
alter table public.species
  add column required_ability_id text references public.abilities (id),
  add column required_move_id text references public.moves (id);
