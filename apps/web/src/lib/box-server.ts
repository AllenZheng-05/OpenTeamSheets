import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REGULATIONS, type Regulation } from "@ots/core";
import { boxTiles, encodeBoxBits } from "@ots/core/teams";
import { BOX_COOKIE, decodeBox } from "./box";
import { filtersHref, type Filters } from "./search";
import { supabase } from "./supabase";

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

/**
 * How often each box species is used in each started regulation's
 * tournament teams, as shares (0 to 1, to four places), for /box: read
 * once when the page is built (each deploy, and after each import). CI
 * builds without a database, so without one the page builds without usage.
 */
export async function boxUsageByRegulation(): Promise<
  Record<string, Record<string, number>>
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return {};
  const started = REGULATIONS.filter(
    (r) => Date.parse(r.startsAt) <= Date.now(),
  );
  // One request per regulation: each is a few hundred rows, under the
  // API's 1,000-row limit.
  const results = await Promise.all(
    started.map(async ({ id }) => {
      const { data, error } = await supabase()
        .from("box_usage_stats")
        .select("box_species, placements, total")
        .eq("regulation_id", id);
      if (error) throw new Error(error.message);
      const shares = data.map((u) => [
        u.box_species,
        u.total ? Math.round((u.placements / u.total) * 1e4) / 1e4 : 0,
      ]);
      return [id, Object.fromEntries(shares)] as const;
    }),
  );
  return Object.fromEntries(results);
}
