/**
 * Imports official events from Limitless VGC (data/official-events.yaml).
 *
 * Usage: pnpm import:limitless [--event 0037]... [--dry-run] [--refresh] [--prod]
 *
 *   --event    only these events (by standings id); default: all of them
 *   --dry-run  fetch and check everything, write nothing
 *   --refresh  download standings and teamlists again instead of using the cache
 *   --prod     import into production (asks first)
 *
 * Pages are fetched one per second and cached in ~/.cache/openteamsheets,
 * so the first run of a large event takes about 20 minutes and later runs
 * take seconds.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Json } from "@ots/core/db";
import {
  prepareOfficialEvent,
  readOfficialEvents,
  readStandingsPage,
  readTeamlistPage,
  STANDINGS_SITE,
  teamlistUrl,
  type LimitlessSet,
} from "../import/limitless";
import { createPoliteFetcher } from "../import/polite-fetch";
import { check, connect } from "./supabase";

// import_event() runs in one transaction per call; batches keep each request small.
const BATCH_SIZE = 250;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const refresh = args.includes("--refresh");
const only = args.flatMap((arg, i) => (args[i - 1] === "--event" ? [arg] : []));

const configPath = path.join(
  import.meta.dirname,
  "../../../../data/official-events.yaml",
);
const events = readOfficialEvents(readFileSync(configPath, "utf8")).filter(
  (event) => only.length === 0 || only.includes(event.standings),
);
if (events.length === 0) {
  console.error(
    `No events match ${only.join(", ")}; see data/official-events.yaml`,
  );
  process.exit(1);
}

const db = dryRun ? null : await connect(args);
const fetcher = createPoliteFetcher();

for (const config of events) {
  console.log(`\n${config.name} (${config.standings})`);
  const standingsUrl = `${STANDINGS_SITE}/${config.standings}/standings`;
  let standings = readStandingsPage(
    await fetcher.get(standingsUrl, { refresh }),
  );
  // An event still running changes; fetch its standings fresh.
  if (!standings.tournament.completed && !refresh) {
    standings = readStandingsPage(
      await fetcher.get(standingsUrl, { refresh: true }),
    );
  }

  const withTeamlists = standings.players.filter(
    (p) => p.teamlist && p.placement !== null,
  );
  const teamlists = new Map<number, LimitlessSet[]>();
  for (const [index, player] of withTeamlists.entries()) {
    const html = await fetcher.get(
      teamlistUrl(config.standings, player.tp_id),
      { refresh },
    );
    teamlists.set(player.tp_id, readTeamlistPage(html));
    if ((index + 1) % 100 === 0) {
      console.log(`  teamlists: ${index + 1}/${withTeamlists.length}`);
    }
  }

  const prepared = prepareOfficialEvent(config, standings, teamlists);
  const invalid = prepared.skipped.filter(
    (s) => s.reasons[0] !== "No teamlist",
  );
  console.log(
    `  ${prepared.teams.length} teams to import, ${prepared.skipped.length - invalid.length} without a teamlist, ${invalid.length} skipped as invalid`,
  );
  for (const skip of invalid) {
    console.log(
      `    ${skip.placement ?? "-"}. ${skip.player}: ${skip.reasons.join("; ")}`,
    );
  }

  if (!db) continue;
  let created = 0;
  let merged = 0;
  for (let i = 0; i < prepared.teams.length; i += BATCH_SIZE) {
    const { data } = check(
      await db.rpc("import_event", {
        payload: {
          event: prepared.event,
          teams: prepared.teams.slice(i, i + BATCH_SIZE),
        } as unknown as Json,
      }),
      `Importing ${config.name}`,
    );
    const summary = data as { teamsCreated: number; teamsMerged: number };
    created += summary.teamsCreated;
    merged += summary.teamsMerged;
  }
  console.log(`  imported: ${created} new teams, ${merged} already known`);
}

console.log(
  `\n${fetcher.requests} pages downloaded${dryRun ? "; dry run, nothing written" : ""}.`,
);
