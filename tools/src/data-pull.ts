/**
 * Regenerates packages/core/data/generated from Pokémon Showdown.
 *
 * For each regulation in packages/core/data/showdown-sources.json, this
 * builds Showdown at the pinned commit (cached in ~/.cache/openteamsheets)
 * and lets
 * Showdown's own Dex and TeamValidator resolve the Champions data, then
 * applies packages/core/data/overrides.json and writes the result.
 *
 * Usage: pnpm data:pull
 */
import { execFileSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { stringifyByLine } from "./json-lines";
import {
  applyOverrides,
  type Overrides,
  type RegulationData,
} from "./overrides";
import type { ShowdownExport } from "./showdown-export";

interface Sources {
  repository: string;
  current: string;
  regulations: Record<string, { commit: string; format: string }>;
}

const toolsDir = path.resolve(import.meta.dirname, "..");
const rootDir = path.resolve(toolsDir, "..");
const dataDir = path.join(rootDir, "packages/core/data");
const outDir = path.join(dataDir, "generated");
// Outside the repo on purpose: inside it, Node's module lookup from the
// Showdown checkout would find this repo's packages instead of Showdown's.
// Teams our validator is tested on, with Showdown's verdicts saved beside them.
const verdictsDir = path.join(
  rootDir,
  "packages/core/src/teams/__fixtures__/validator",
);

const cacheDir =
  process.env.OTS_SHOWDOWN_CACHE ??
  path.join(os.homedir(), ".cache", "openteamsheets", "showdown");

const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(dataDir, file), "utf8")) as T;

/** Clones and builds Showdown at `commit`, unless a finished build is cached. */
function buildShowdown(repository: string, commit: string): string {
  const dir = path.join(cacheDir, commit);
  const marker = path.join(dir, ".ots-built");
  if (existsSync(marker)) return dir;

  console.log(`Building Showdown ${commit.slice(0, 7)}...`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // pnpm gives scripts its npm_config_* settings and puts this repo's
  // node_modules/.bin on PATH; neither may leak into Showdown's build, or its
  // install picks up our tools (such as our esbuild) instead of its own.
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toLowerCase().startsWith("npm_")) continue;
    env[key] =
      key.toLowerCase() === "path" && value
        ? value
            .split(path.delimiter)
            .filter((entry) => !/node_modules[\\/]\.bin/.test(entry))
            .join(path.delimiter)
        : value;
  }
  const run = (command: string) =>
    execSync(command, {
      cwd: dir,
      env,
      stdio: ["ignore", "ignore", "inherit"],
    });
  run("git init --quiet");
  run(`git fetch --quiet --depth 1 ${repository} ${commit}`);
  run("git checkout --quiet FETCH_HEAD");
  // Optional dependencies stay included: esbuild's platform binary is one.
  run("npm install --omit=dev --no-audit --no-fund");
  run("node build");
  writeFileSync(marker, commit);
  return dir;
}

function exportRegulation(showdownDir: string, format: string): ShowdownExport {
  const output = execFileSync(
    process.execPath,
    ["--import", "tsx", "src/showdown-export.ts", showdownDir, format],
    { cwd: toolsDir, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
  );
  return JSON.parse(output) as ShowdownExport;
}

/** Records by id, taking each from the first export that has it. */
function mergeRecords<T extends { id: string }>(lists: T[][]): T[] {
  const byId = new Map<string, T>();
  for (const list of lists) {
    for (const record of list) {
      if (!byId.has(record.id)) byId.set(record.id, record);
    }
  }
  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

function write(file: string, value: unknown[] | object) {
  const target = path.join(outDir, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, stringifyByLine(value));
}

const sources = readJson<Sources>("showdown-sources.json");
const exports = new Map<string, ShowdownExport>();
for (const [id, source] of Object.entries(sources.regulations)) {
  const dir = buildShowdown(sources.repository, source.commit);
  console.log(`Exporting ${id} (${source.format})...`);
  exports.set(id, exportRegulation(dir, source.format));
}

// Shared records come from the current regulation first, so they carry
// today's values; older regulations only fill in records it lacks.
const current = exports.get(sources.current);
if (!current)
  throw new Error(`No source for current regulation ${sources.current}`);
const ordered = [
  current,
  ...[...exports.values()].filter((e) => e !== current),
];

const regulations: Record<string, RegulationData> = {};
for (const [id, data] of exports) {
  regulations[id] = {
    species: data.legalSpecies,
    items: data.legalItems,
    learnsets: data.learnsets,
  };
}

const data = applyOverrides(
  {
    species: mergeRecords(ordered.map((e) => e.species)),
    moves: mergeRecords(ordered.map((e) => e.moves)),
    abilities: mergeRecords(ordered.map((e) => e.abilities)),
    items: mergeRecords(ordered.map((e) => e.items)),
    regulations,
  },
  readJson<Overrides>("overrides.json"),
);

rmSync(outDir, { recursive: true, force: true });
write("types.json", current.types);
write("type-chart.json", current.typeChart);
write("natures.json", current.natures);
write("species.json", data.species);
write("moves.json", data.moves);
write("abilities.json", data.abilities);
write("items.json", data.items);
for (const [id, regulation] of Object.entries(data.regulations)) {
  const folder = `regulations/${id.toLowerCase()}`;
  write(`${folder}/legality.json`, {
    showdownCommit: sources.regulations[id]!.commit,
    species: regulation.species,
    items: regulation.items,
  });
  write(`${folder}/learnsets.json`, regulation.learnsets);
}

for (const [id, regulation] of Object.entries(data.regulations)) {
  console.log(
    `${id}: ${regulation.species.length} species, ${regulation.items.length} items`,
  );
}
console.log(`Wrote ${path.relative(rootDir, outDir)}`);

// Showdown's verdicts on the validator fixtures, for the current regulation.
const currentSource = sources.regulations[sources.current]!;
const verdicts = execFileSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "src/showdown-verdicts.ts",
    buildShowdown(sources.repository, currentSource.commit),
    currentSource.format,
    verdictsDir,
  ],
  { cwd: toolsDir, encoding: "utf8" },
);
writeFileSync(
  path.join(verdictsDir, "showdown-verdicts.json"),
  stringifyByLine(JSON.parse(verdicts) as object),
);
console.log(`Wrote Showdown's validator verdicts for ${sources.current}`);
