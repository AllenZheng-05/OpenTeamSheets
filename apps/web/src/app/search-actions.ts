"use server";

import { pokemonDetails } from "@/lib/search-options";

/**
 * The moves and abilities a Pokémon can have, for the search bar's details
 * pickers. Learnsets are too large to send with the page.
 */
export async function getPokemonDetails(pokemonId: string) {
  if (typeof pokemonId !== "string" || !/^[a-z0-9]+$/.test(pokemonId)) {
    return { moves: [], abilities: [] };
  }
  return pokemonDetails(pokemonId);
}
