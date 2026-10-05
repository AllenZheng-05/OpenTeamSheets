/**
 * Finds which of Showdown's sprite styles exist for each Pokémon, so the
 * site can link the right image straight away instead of trying styles
 * until one loads. Writes packages/core/data/sprite-styles.json with only
 * the exceptions: Pokémon with no Pokémon HOME render, or no shiny one.
 *
 * Usage: pnpm --filter @ots/tools sprite-styles
 * Run it after `pnpm data:pull` adds Pokémon. It checks each sprite once
 * with a HEAD request, about seven a second.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { gameData } from "@ots/core/game-data";

const SPRITES = "https://play.pokemonshowdown.com/sprites";
/** Styles in order of preference, as the site tries them. */
const STYLES = [
  { folder: "home-centered", extension: "png" },
  { folder: "dex", extension: "png" },
  { folder: "gen5", extension: "png" },
  { folder: "ani", extension: "gif" },
] as const;
type Style = (typeof STYLES)[number]["folder"];
const DELAY_MS = 150;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function exists(url: string): Promise<boolean> {
  await wait(DELAY_MS);
  const response = await fetch(url, {
    method: "HEAD",
    headers: { "User-Agent": "OpenTeamSheets sprite check" },
  });
  return response.ok;
}

/** The first style with this sprite, or null if none has it. */
async function firstStyle(
  spriteId: string,
  shiny: boolean,
): Promise<Style | null> {
  for (const { folder, extension } of STYLES) {
    const url = `${SPRITES}/${folder}${shiny ? "-shiny" : ""}/${spriteId}.${extension}`;
    if (await exists(url)) return folder;
  }
  return null;
}

const spriteIds = [...new Set(gameData.species.map((s) => s.spriteId))].sort();
const exceptions: Record<
  string,
  { normal: Style | null; shiny: Style | null }
> = {};
for (const [index, spriteId] of spriteIds.entries()) {
  const normal = await firstStyle(spriteId, false);
  const shiny = await firstStyle(spriteId, true);
  if (normal !== "home-centered" || shiny !== "home-centered") {
    exceptions[spriteId] = { normal, shiny };
  }
  if ((index + 1) % 50 === 0) {
    console.log(`${index + 1}/${spriteIds.length}`);
  }
}

const file = path.join(
  import.meta.dirname,
  "../../packages/core/data/sprite-styles.json",
);
writeFileSync(file, `${JSON.stringify(exceptions, null, 2)}\n`);
console.log(
  `${spriteIds.length} sprites; ${Object.keys(exceptions).length} without a HOME render or shiny one`,
);
