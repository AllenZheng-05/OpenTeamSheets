-- Recomputing every team's search tags in one call outgrew the API's
-- statement timeout (about 260,000 Pokémon in production). It now works in
-- batches of teams: each call refreshes the next `p_limit` teams after
-- `p_after` and returns the last one done, or null when there are none
-- left. `pnpm data:sync` calls it until it returns null.
drop function public.refresh_search_tags();

create function public.refresh_search_tags(
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

  return last_team;
end;
$$;

revoke execute on function public.refresh_search_tags(uuid, integer)
  from public, anon, authenticated;
