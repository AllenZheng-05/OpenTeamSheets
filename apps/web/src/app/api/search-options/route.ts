import { searchOptionsData } from "@/lib/search-options";

/**
 * The search bar's suggestions (Pokémon, moves, abilities, items, types)
 * and event list, as one cached file: browsers and the CDN keep it for an
 * hour, so pages don't each carry it.
 */
export async function GET() {
  return Response.json(await searchOptionsData(), {
    headers: {
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
