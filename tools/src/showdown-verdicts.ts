/**
 * Runs Pokémon Showdown's own team validator on every team in a fixture
 * folder and prints its verdicts as JSON on stdout. data-pull.ts saves them
 * next to the fixtures, and our validator's tests must reach the same
 * verdicts.
 *
 * Usage: node --import tsx showdown-verdicts.ts <showdown dir> <format id> <fixture dir>
 */
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export interface Verdict {
  valid: boolean;
  problems: string[];
}

// The parts of Showdown's API used here (sim/teams.ts, sim/team-validator.ts).
interface ShowdownSim {
  Teams: { import(paste: string): unknown[] | null };
  TeamValidator: {
    get(format: string): {
      validateTeam(team: unknown[] | null): string[] | null;
    };
  };
}

const [showdownDir, formatId, fixtureDir] = process.argv.slice(2);
if (!showdownDir || !formatId || !fixtureDir) {
  console.error(
    "Usage: showdown-verdicts.ts <showdown dir> <format id> <fixture dir>",
  );
  process.exit(1);
}

const require = createRequire(
  path.join(path.resolve(showdownDir), "package.json"),
);
const sim = require("./dist/sim") as ShowdownSim;
const validator = sim.TeamValidator.get(formatId);

const verdicts: Record<string, Verdict> = {};
for (const file of readdirSync(fixtureDir)
  .filter((f) => f.endsWith(".txt"))
  .sort()) {
  const team = sim.Teams.import(
    readFileSync(path.join(fixtureDir, file), "utf8"),
  );
  const problems = validator.validateTeam(team) ?? [];
  verdicts[file] = { valid: problems.length === 0, problems };
}
process.stdout.write(JSON.stringify(verdicts));
