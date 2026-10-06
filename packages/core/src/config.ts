/**
 * The numbers that decide how much work the site, the importer and their
 * hosts do: how often data is imported, how long things are cached, how
 * big each batch is. They're kept here, together, because the project runs
 * on Vercel's and Supabase's free plans, and each of these trades freshness
 * or speed for usage.
 *
 * Nothing polls for new data. The daily import is the one schedule: when
 * it finishes it tells the site (POST /api/revalidate), which drops every
 * cache tagged TOURNAMENT_DATA_TAG and rebuilds /box. The expiries below
 * are only a safety net for a missed signal.
 */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Importing

/**
 * When the online import runs (cron, UTC): daily at 09:00. GitHub can't
 * read this, so .github/workflows/import-online.yml repeats it, and a test
 * checks the two match. Keep it under a week apart: Supabase pauses a free
 * project after 7 days without activity.
 */
export const IMPORT_CRON = "0 9 * * *";

/** Online tournaments smaller than this aren't imported. */
export const ONLINE_MIN_PLAYERS = 64;

/** Tournaments that ended in the last this many days wait for final results. */
export const ONLINE_SETTLE_DAYS = 2;

/** Between requests to Limitless's API: it allows 50 every five minutes. */
export const ONLINE_REQUEST_MS = 6500;

/** Between requests to limitlessvgc.com's pages, to be gentle with it. */
export const OFFICIAL_REQUEST_MS = 1000;

/** Teams per import_event call; each call must finish within a minute. */
export const IMPORT_BATCH_TEAMS = 250;

/** Rows per data:sync upsert. */
export const SYNC_BATCH_ROWS = 1000;

/**
 * The smallest batch data:sync shrinks to when a statement times out
 * (search tags), halving from SYNC_BATCH_ROWS.
 */
export const SYNC_MIN_BATCH_ROWS = 50;

// Caching

/** The cache tag on everything an import changes. */
export const TOURNAMENT_DATA_TAG = "tournament-data";

/**
 * How long tagged data is kept without a signal from an import: a week,
 * so a missed signal heals itself, while a cached search is otherwise
 * computed once per import.
 */
export const TOURNAMENT_DATA_MAX_AGE = 7 * DAY;

/** A team's Showdown paste: its sets never change once imported. */
export const TEAM_PASTE_MAX_AGE = 365 * DAY;

/** Pages the workflows load after an import, so visitors get them cached. */
export const WARM_PATHS = ["/tournament", "/", "/box"];

// Searching

/** Teams per page of search results. */
export const SEARCH_PAGE_SIZE = 25;
