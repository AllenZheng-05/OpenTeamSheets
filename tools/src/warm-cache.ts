/**
 * Visits the site's busiest pages after an import, so the first visitor
 * after it gets cached results instead of waiting on the database. The
 * import has already told the site its data changed (/api/revalidate), so
 * these visits refill the caches with the new data.
 *
 * Usage: pnpm --filter @ots/tools warm-cache
 * SITE_URL changes the site (default https://www.openteamsheets.com); the
 * pages are core's WARM_PATHS. It never fails: a page that doesn't load
 * is reported and skipped.
 */
import { WARM_PATHS } from "@ots/core/config";

const SITE = process.env.SITE_URL || "https://www.openteamsheets.com";

for (const path of WARM_PATHS) {
  const started = Date.now();
  try {
    const response = await fetch(new URL(path, SITE), {
      headers: { "User-Agent": "OpenTeamSheets cache warmer" },
    });
    await response.arrayBuffer();
    console.log(`${response.status} ${path} (${Date.now() - started} ms)`);
  } catch (error) {
    console.log(`failed ${path}: ${(error as Error).message}`);
  }
}
