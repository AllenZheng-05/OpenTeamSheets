/**
 * Finds which of Showdown's sprite styles exist for each Pokémon, so the
 * site can link an image that exists straight away instead of trying
 * styles until one loads. Writes packages/core/data/sprite-styles.json:
 * for each Pokémon missing any style, the styles it's missing ("dex",
 * "home-centered-shiny" and so on). Pokémon with every style are left out.
 *
 * Usage: pnpm --filter @ots/tools sprite-styles
 * Run it after `pnpm data:pull` adds Pokémon. It checks each sprite in
 * each style once with a HEAD request, about seven a second (eight
 * minutes or so).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { gameData, SPRITE_STYLES } from "@ots/core/game-data";

const SPRITES = "https://play.pokemonshowdown.com/sprites";
const DELAY_MS = 150;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function exists(url: string, attempt = 1): Promise<boolean> {
  await wait(DELAY_MS);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "OpenTeamSheets sprite check" },
    });
    if (response.status < 500) return response.ok;
    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    // A dropped connection or a server hiccup: wait and ask again.
    if (attempt >= 5) throw error;
    await wait(2000 * attempt);
    return exists(url, attempt + 1);
  }
}

const spriteIds = [...new Set(gameData.species.map((s) => s.spriteId))].sort();
const missing: Record<string, string[]> = {};
for (const [index, spriteId] of spriteIds.entries()) {
  for (const style of SPRITE_STYLES) {
    for (const folder of [style, `${style}-shiny`]) {
      const extension = style === "ani" ? "gif" : "png";
      if (!(await exists(`${SPRITES}/${folder}/${spriteId}.${extension}`))) {
        (missing[spriteId] ??= []).push(folder);
      }
    }
  }
  if ((index + 1) % 25 === 0) {
    console.log(`${index + 1}/${spriteIds.length}`);
  }
}

const file = path.join(
  import.meta.dirname,
  "../../packages/core/data/sprite-styles.json",
);
writeFileSync(file, `${JSON.stringify(missing, null, 2)}\n`);
console.log(
  `${spriteIds.length} sprites; ${Object.keys(missing).length} missing some style`,
);
