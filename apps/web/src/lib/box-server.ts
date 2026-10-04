import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Regulation } from "@ots/core";
import { boxTiles, encodeBoxBits } from "@ots/core/teams";
import { BOX_COOKIE, decodeBox } from "./box";
import { filtersHref, type Filters } from "./search";

/** Every box species' id, in Pokédex order. */
export const boxIds = () => boxTiles().map((tile) => tile.id);

/** The player's box, from their cookie. */
export async function readBox(): Promise<Set<string>> {
  return decodeBox((await cookies()).get(BOX_COOKIE)?.value, boxIds());
}

/**
 * Sends a box search without its box in the URL (an old or hand-typed
 * link, such as ?box=0) to the same search with the player's box filled
 * in, so the URL decides the results.
 */
export async function fillBoxInUrl(
  path: string,
  filters: Filters,
  current: Regulation,
  page: number,
) {
  if (filters.box === null || filters.have !== null) return;
  const have = encodeBoxBits(await readBox());
  redirect(filtersHref(path, { ...filters, have }, current, page));
}
