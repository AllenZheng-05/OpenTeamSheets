/**
 * Imports tournament events from event files (data/events/*.yaml).
 *
 * Usage: pnpm import:event <file or folder>... [--dry-run] [--prod]
 *
 * Every team is parsed, validated, fingerprinted and tagged first. If any
 * team has an error, nothing is written. --dry-run stops after checking.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Json } from "@ots/core/db";
import {
  prepareImport,
  readEventFile,
  type PreparedImport,
} from "../import/event-file";
import { check, connect } from "./supabase";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
// pnpm runs this from apps/worker; paths are relative to where it was typed.
const base = process.env.INIT_CWD ?? process.cwd();
const targets = args.filter((arg) => !arg.startsWith("--"));
if (targets.length === 0) {
  console.error(
    "Usage: pnpm import:event <file or folder>... [--dry-run] [--prod]",
  );
  process.exit(1);
}

const files = targets.flatMap((target) => {
  const full = path.resolve(base, target);
  return statSync(full).isDirectory()
    ? readdirSync(full)
        .filter((name) => /\.ya?ml$/.test(name))
        .sort()
        .map((name) => path.join(full, name))
    : [full];
});

const prepared: { file: string; result: PreparedImport }[] = [];
let failed = false;
for (const file of files) {
  const name = path.relative(base, file);
  let result: PreparedImport;
  try {
    result = await prepareImport(readEventFile(readFileSync(file, "utf8")));
  } catch (error) {
    console.error(`${name}:\n${(error as Error).message}`);
    failed = true;
    continue;
  }

  console.log(
    `${name}: ${result.payload.event.name} (${result.reports.length} teams)`,
  );
  for (const report of result.reports) {
    const place = report.placement
      ? `${report.placement}.`.padStart(4)
      : "   -";
    const tags = report.archetypes.join(", ") || "no archetypes";
    console.log(
      `${place} ${report.player.padEnd(28)} ${report.errors.length ? "ERROR" : tags}`,
    );
    const problems = [
      ...report.errors.map((problem) => ({ kind: "error", ...problem })),
      ...report.warnings.map((problem) => ({ kind: "warning", ...problem })),
    ];
    for (const { kind, slot, message } of problems) {
      console.log(`       ${kind}${slot ? ` (slot ${slot})` : ""}: ${message}`);
    }
  }
  if (!result.ok) failed = true;
  prepared.push({ file: name, result });
}

if (failed) {
  console.error("\nNothing was imported: fix the errors above first.");
  process.exit(1);
}
if (dryRun) {
  console.log("\nDry run: everything checks out, and nothing was written.");
  process.exit(0);
}

const db = await connect(args);
for (const { file, result } of prepared) {
  const { data } = check(
    await db.rpc("import_event", {
      payload: result.payload as unknown as Json,
    }),
    `Importing ${file}`,
  );
  const summary = data as { teamsCreated: number; teamsMerged: number };
  console.log(
    `${file}: ${summary.teamsCreated} new teams, ${summary.teamsMerged} already imported`,
  );
}
