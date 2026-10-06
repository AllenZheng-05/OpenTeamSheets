import { searchOptionsData } from "@/lib/search-options";

/**
 * The search bar's suggestions (Pokémon, moves, abilities, items, types)
 * and event list, as one cached file, so pages don't each carry it. Its
 * URL names the import it's from (?v=, searchBarProps), so browsers and
 * the CDN keep it until an import changes the URL.
 */
export async function GET() {
  return Response.json(await searchOptionsData(), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
