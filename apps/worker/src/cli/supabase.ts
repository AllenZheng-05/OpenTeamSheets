import path from "node:path";
import { createInterface } from "node:readline/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { REGULATIONS } from "@ots/core";
import type { Database } from "@ots/core/db";

export type Db = SupabaseClient<Database>;

/**
 * A Supabase client with the secret key, for maintainer CLIs. Uses
 * apps/worker/.env (the local database) by default; `--prod` uses
 * .env.production after asking for confirmation. Where SUPABASE_URL and
 * SUPABASE_SECRET_KEY are already set, such as in GitHub Actions, no file
 * is needed, and `--yes` answers the confirmation for unattended runs.
 */
export async function connect(args: string[]): Promise<Db> {
  const production = args.includes("--prod");
  const envFile = production ? ".env.production" : ".env";
  const fromEnvironment =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY;
  if (!fromEnvironment) {
    try {
      process.loadEnvFile(path.join(import.meta.dirname, "../..", envFile));
    } catch {
      throw new Error(`Missing apps/worker/${envFile}; see .env.example`);
    }
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(`Set SUPABASE_URL and SUPABASE_SECRET_KEY in ${envFile}`);
  }

  if (production && args.includes("--yes")) {
    console.log(`Writing to production (${url}).`);
  } else if (production) {
    const prompt = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const answer = await prompt.question(
      `This writes to production (${url}). Type "production" to continue: `,
    );
    prompt.close();
    if (answer.trim() !== "production") throw new Error("Cancelled");
  }

  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false },
  });
}

/** Throws on a Supabase error, so a failed write stops the CLI. */
export function check<T extends { error: { message: string } | null }>(
  result: T,
  action: string,
): T {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result;
}

/**
 * Recounts the totals searches read instead of adding up every placement:
 * box usage (box_usage_stats) and team totals (team_summaries), for every
 * regulation that has started and then team totals across them all. One
 * call per regulation, to keep each statement short. Run
 * after anything that changes placements, teams or box species.
 */
export async function refreshStoredTotals(db: Db): Promise<void> {
  const started = REGULATIONS.filter(
    (r) => Date.parse(r.startsAt) <= Date.now(),
  );
  for (const regulation of started) {
    // Team totals first: box usage is counted from them.
    check(
      await db.rpc("refresh_team_summaries", { p_scope: regulation.id }),
      `Refreshing team totals for ${regulation.id}`,
    );
    check(
      await db.rpc("refresh_box_usage", { p_regulation: regulation.id }),
      `Refreshing box usage for ${regulation.id}`,
    );
  }
  check(
    await db.rpc("refresh_team_summaries", { p_scope: "*" }),
    "Refreshing team totals for every regulation",
  );
  console.log(
    `stored totals: refreshed for ${started.map((r) => r.id).join(", ")}`,
  );
}
