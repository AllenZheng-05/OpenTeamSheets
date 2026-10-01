-- Champions game data. These tables mirror packages/core/data, which is the
-- source of truth: `pnpm data:sync` writes them, and nothing else should.
-- Ids follow Pokémon Showdown's convention ("charizardmegay", "heatwave").

create table public.types (
  id text primary key,
  name text not null
);

create table public.type_effectiveness (
  attacking_type_id text not null references public.types (id),
  defending_type_id text not null references public.types (id),
  multiplier numeric(2, 1) not null check (multiplier in (0, 0.5, 1, 2)),
  primary key (attacking_type_id, defending_type_id)
);

create table public.abilities (
  id text primary key,
  num integer not null,
  name text not null,
  description text not null default ''
);

create table public.items (
  id text primary key,
  num integer not null,
  name text not null,
  description text not null default ''
);

create table public.moves (
  id text primary key,
  num integer not null,
  name text not null,
  type_id text not null references public.types (id),
  category text not null check (category in ('physical', 'special', 'status')),
  power smallint not null,
  -- Null for moves that never miss.
  accuracy smallint,
  pp smallint not null,
  priority smallint not null,
  target text not null,
  description text not null default ''
);

create table public.natures (
  id text primary key,
  name text not null,
  plus_stat text check (plus_stat in ('atk', 'def', 'spa', 'spd', 'spe')),
  minus_stat text check (minus_stat in ('atk', 'def', 'spa', 'spd', 'spe')),
  -- Neutral natures have neither.
  check ((plus_stat is null) = (minus_stat is null))
);

create table public.species (
  id text primary key,
  -- National Pokédex number, shared by every form of a species.
  num integer not null,
  name text not null,
  -- The base form this is a form of (Charizard for Mega Charizard Y).
  base_species_id text references public.species (id),
  -- For forms that only exist mid-battle (Megas, Mimikyu-Busted), the form
  -- it changes from. These can't be put on a team or be legal in a
  -- regulation. Null for forms that can be on a team.
  battle_only_from_id text references public.species (id),
  type1_id text not null references public.types (id),
  type2_id text references public.types (id),
  ability_1_id text references public.abilities (id),
  ability_2_id text references public.abilities (id),
  ability_hidden_id text references public.abilities (id),
  hp smallint not null check (hp > 0),
  atk smallint not null check (atk > 0),
  def smallint not null check (def > 0),
  spa smallint not null check (spa > 0),
  spd smallint not null check (spd > 0),
  spe smallint not null check (spe > 0),
  -- The item needed to be in this form, such as a mega stone.
  required_item_id text references public.items (id),
  check (type2_id is distinct from type1_id),
  check (battle_only_from_id is distinct from id)
);

create index species_base_species_id_idx on public.species (base_species_id);

create table public.regulations (
  id text primary key,
  starts_at timestamptz not null,
  data_status text not null check (data_status in ('pending', 'partial', 'complete')),
  -- The Pokémon Showdown commit the regulation's data was pulled from.
  showdown_commit text
);

create table public.regulation_species (
  regulation_id text not null references public.regulations (id) on delete cascade,
  species_id text not null references public.species (id),
  primary key (regulation_id, species_id)
);

-- Forms that only exist mid-battle can't be put on a team, so they can't be
-- legal in a regulation.
create function public.reject_battle_only_species()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.species
    where id = new.species_id and battle_only_from_id is not null
  ) then
    raise exception 'Species "%" only exists mid-battle and cannot be legal in a regulation',
      new.species_id;
  end if;
  return new;
end;
$$;

create trigger regulation_species_not_battle_only
  before insert or update on public.regulation_species
  for each row execute function public.reject_battle_only_species();

create table public.regulation_items (
  regulation_id text not null references public.regulations (id) on delete cascade,
  item_id text not null references public.items (id),
  primary key (regulation_id, item_id)
);

-- Only legal species have learnsets, enforced by the composite foreign key.
create table public.regulation_learnsets (
  regulation_id text not null,
  species_id text not null,
  move_id text not null references public.moves (id),
  primary key (regulation_id, species_id, move_id),
  foreign key (regulation_id, species_id)
    references public.regulation_species (regulation_id, species_id) on delete cascade
);

-- Game data is public. There are no write policies, so only the secret key
-- (used by `pnpm data:sync`) can change it.
alter table public.types enable row level security;
alter table public.type_effectiveness enable row level security;
alter table public.abilities enable row level security;
alter table public.items enable row level security;
alter table public.moves enable row level security;
alter table public.natures enable row level security;
alter table public.species enable row level security;
alter table public.regulations enable row level security;
alter table public.regulation_species enable row level security;
alter table public.regulation_items enable row level security;
alter table public.regulation_learnsets enable row level security;

create policy "Game data is public" on public.types for select using (true);
create policy "Game data is public" on public.type_effectiveness for select using (true);
create policy "Game data is public" on public.abilities for select using (true);
create policy "Game data is public" on public.items for select using (true);
create policy "Game data is public" on public.moves for select using (true);
create policy "Game data is public" on public.natures for select using (true);
create policy "Game data is public" on public.species for select using (true);
create policy "Game data is public" on public.regulations for select using (true);
create policy "Game data is public" on public.regulation_species for select using (true);
create policy "Game data is public" on public.regulation_items for select using (true);
create policy "Game data is public" on public.regulation_learnsets for select using (true);
