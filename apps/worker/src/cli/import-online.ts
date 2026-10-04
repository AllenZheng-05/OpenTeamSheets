/**
 * Imports online tournaments from Limitless's public API: every finished
 * Champions tournament with public teamlists and enough players.
 *
 * Usage: pnpm import:online [--format M-C]... [--min-players 64]
 *          [--since 2026-09-01] [--all] [--dry-run] [--refresh] [--prod]
 *          [--report flagged.md]
 *
 *   --format       only these regulations; default: all of them
 *   --min-players  the smallest tournament to import (default 64)
 *   --since        only tournaments on or after this date
 *   --all          scan and import every tournament again, not just new ones
 *                  (from the cache), such as after editing sheet readings
 *   --dry-run      fetch and check everything, write nothing
 *   --refresh      download tournaments again instead of using the cache
 *   --prod         import into production (asks first; --yes doesn't)
 *   --report       also write the teams skipped, or imported with errors on
 *                  their sheet, to this Markdown file
 *
 * The API allows 50 requests per 5 minutes, so requests go out one every
 * 6.5 seconds: about 13 seconds per new tournament. Finished tournaments
 * are cached in ~/.cache/openteamsheets/limitless-api and never fetched
 * again; only the lists of tournaments are.
 *
 * A run picks up where the database left off: it lists tournaments (newest
 * first) back to the newest online event already imported, and imports
 * only those it doesn't have. So a daily run makes a few requests.
 */
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { REGULATIONS } from "@ots/core";
import type { Json } from "@ots/core/db";
import {
  detailsUrl,
  prepareOnlineEvent,
  standingsUrl,
  tournamentsUrl,
  type OnlineDetails,
  type OnlineStanding,
  type OnlineTournament,
} from "../import/limitless-online";
import { createPoliteFetcher } from "../import/polite-fetch";
import { check, connect } from "./supabase";

// import_event() runs in one transaction per call; batches keep each request small.
const BATCH_SIZE = 250;
const PAGE_SIZE = 100;
// A tournament this recent may still be running; its results aren't final.
const SETTLE_DAYS = 2;

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const refresh = args.includes("--refresh");
const all = args.includes("--all");
const minPlayers = Number(option("--min-players") ?? 64);
const since = option("--since");
const reportPath = option("--report");
const formats = args.flatMap((arg, i) =>
  args[i - 1] === "--format" ? [arg] : [],
);
// Regulations that have started; a future one has no tournaments yet.
const regulations = formats.length
  ? formats
  : REGULATIONS.filter((r) => Date.parse(r.startsAt) <= Date.now()).map(
      (r) => r.id as string,
    );

if (!Number.isInteger(minPlayers) || minPlayers < 1) {
  console.error("--min-players needs a whole number");
  process.exit(1);
}
if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error("--since needs a date such as 2026-09-01");
  process.exit(1);
}

const db = dryRun ? null : await connect(args);
const fetcher = createPoliteFetcher({
  cacheDir: path.join(
    os.homedir(),
    ".cache",
    "openteamsheets",
    "limitless-api",
  ),
  delayMs: 6500,
});
const getJson = async <T>(url: string, fresh: boolean): Promise<T> =>
  JSON.parse(await fetcher.get(url, { refresh: fresh })) as T;

// Where the last run left off: the online events already imported, and the
// newest one's date. Anything new is dated on or after it, since earlier
// runs left out tournaments too recent to be final.
const imported = new Set<string>();
let resumeFrom: string | undefined;
if (db && !all) {
  const { data } = check(
    await db
      .from("events")
      .select("source_id, starts_on")
      .eq("source", "limitless"),
    "Reading imported online events",
  );
  for (const event of data ?? []) {
    imported.add(event.source_id);
    if (!resumeFrom || event.starts_on > resumeFrom)
      resumeFrom = event.starts_on;
  }
}
// --since wins; otherwise resume, or scan everything on the first run.
const from = since ?? resumeFrom;
if (from && !since)
  console.log(
    `Resuming from ${from} (${imported.size} online events imported)`,
  );

// Every tournament worth importing, newest first.
const settled = new Date(Date.now() - SETTLE_DAYS * 86_400_000).toISOString();
const tournaments: OnlineTournament[] = [];
for (const regulation of regulations) {
  for (let page = 1; ; page++) {
    const list = await getJson<OnlineTournament[]>(
      tournamentsUrl(regulation, page),
      true,
    );
    tournaments.push(
      ...list.filter(
        (t) =>
          t.players >= minPlayers &&
          t.date < settled &&
          (!from || t.date.slice(0, 10) >= from) &&
          !imported.has(t.id),
      ),
    );
    // Newest first: once a page reaches back past where we resume, stop.
    const oldest = list.at(-1)?.date.slice(0, 10);
    if (list.length < PAGE_SIZE || (from && oldest && oldest < from)) break;
  }
}
console.log(
  `${tournaments.length} ${from && !all ? "new " : ""}finished tournaments with ${minPlayers}+ players in ${regulations.join(", ")}`,
);

const report: string[] = [];
const totals = { events: 0, teams: 0, created: 0, merged: 0, failed: 0 };

for (const tournament of tournaments) {
  const label = `${tournament.name.trim()} (${tournament.date.slice(0, 10)}, ${tournament.players} players)`;
  try {
    const details = await getJson<OnlineDetails>(
      detailsUrl(tournament.id),
      refresh,
    );
    if (!details.decklists) {
      console.log(`\n${label}\n  skipped: teamlists aren't public`);
      continue;
    }
    const standings = await getJson<OnlineStanding[]>(
      standingsUrl(tournament.id),
      refresh,
    );
    const prepared = prepareOnlineEvent(details, standings);
    if (!prepared) continue;

    console.log(`\n${label}`);
    console.log(
      `  ${prepared.teams.length} teams to import (${prepared.sheetErrors.length} with errors on the sheet), ${prepared.skipped.length} skipped`,
    );
    if (prepared.sheetErrors.length > 0) {
      report.push(`## ${label}: imported with errors on the sheet\n`);
      for (const note of prepared.sheetErrors) {
        const player = note.teamlistUrl
          ? `[${note.player}](${note.teamlistUrl})`
          : note.player;
        report.push(
          `- [ ] ${note.placement ?? "-"}. ${player}: ${note.reasons.join("; ")}`,
        );
      }
      report.push("");
    }
    totals.events++;
    totals.teams += prepared.teams.length;

    if (!db) continue;
    for (let i = 0; i < prepared.teams.length; i += BATCH_SIZE) {
      const { data } = check(
        await db.rpc("import_event", {
          payload: {
            event: prepared.event,
            teams: prepared.teams.slice(i, i + BATCH_SIZE),
          } as unknown as Json,
        }),
        `Importing ${label}`,
      );
      const summary = data as { teamsCreated: number; teamsMerged: number };
      totals.created += summary.teamsCreated;
      totals.merged += summary.teamsMerged;
    }
  } catch (error) {
    // One broken tournament shouldn't stop the rest.
    totals.failed++;
    console.error(`\n${label}\n  failed: ${(error as Error).message}`);
  }
}

if (reportPath) {
  writeFileSync(reportPath, ["# Team sheets to check\n", ...report].join("\n"));
  console.log(`\nWrote the teams to check to ${reportPath}`);
}

console.log(
  `\n${totals.events} tournaments, ${totals.teams} teams` +
    (db ? ` (${totals.created} new, ${totals.merged} already known)` : "") +
    (totals.failed ? `, ${totals.failed} failed` : "") +
    `; ${fetcher.requests} requests${dryRun ? "; dry run, nothing written" : ""}.`,
);
