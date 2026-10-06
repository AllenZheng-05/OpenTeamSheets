/**
 * Visits the site's busiest pages after an import, so the first visitor
 * after it gets cached results instead of waiting on the database.
 *
 * Usage: pnpm --filter @ots/tools warm-cache
 * SITE_URL changes the site (default https://openteamsheets.com). It
 * never fails: a page that doesn't load is reported and skipped.
 */
import { getCurrentRegulation } from "@ots/core";

const SITE = process.env.SITE_URL ?? "https://openteamsheets.com";
// The site checks for new data at most once a minute (dataVersion), so
// pages visited sooner would cache the results from before the import.
const SETTLE_MS = 70_000;

const PATHS = [
  "/tournament",
  "/",
  "/box",
  `/api/box-usage?regulation=${getCurrentRegulation()}`,
  "/api/search-options",
];

await new Promise((r) => setTimeout(r, SETTLE_MS));
for (const path of PATHS) {
  const started = Date.now();
  try {
    const response = await fetch(`${SITE}${path}`, {
      headers: { "User-Agent": "OpenTeamSheets cache warmer" },
    });
    await response.arrayBuffer();
    console.log(`${response.status} ${path} (${Date.now() - started} ms)`);
  } catch (error) {
    console.log(`failed ${path}: ${(error as Error).message}`);
  }
}
