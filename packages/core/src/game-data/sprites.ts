// Which of Showdown's sprite styles to link, apart from the rest of the
// game data so pages that show sprites don't load it all
// (@ots/core/sprites).
import spriteStyles from "../../data/sprite-styles.json";

/** Showdown's sprite styles, each a folder of its sprites. */
export const SPRITE_STYLES = ["home-centered", "dex", "gen5", "ani"] as const;
export type SpriteStyle = (typeof SPRITE_STYLES)[number];

/**
 * Styles to try, best first. Small sprites (rows, the box) prefer the 3D
 * "dex" renders, a third the download of Pokémon HOME's and sharp enough
 * at that size; large ones (team pages) prefer HOME. Pixel and animated
 * sprites are the fallbacks.
 */
const PREFERENCE: Record<"small" | "large", SpriteStyle[]> = {
  small: ["dex", "home-centered", "gen5", "ani"],
  large: ["home-centered", "dex", "gen5", "ani"],
};

/**
 * The best Showdown sprite style for a Pokémon at a size, and for its shiny
 * (null if it has no shiny art anywhere), from the styles each Pokémon is
 * missing in data/sprite-styles.json (`pnpm --filter @ots/tools
 * sprite-styles`).
 */
export function spriteStyle(
  spriteId: string,
  size: "small" | "large",
): { normal: SpriteStyle; shiny: SpriteStyle | null } {
  const missing = new Set(
    (spriteStyles as Record<string, string[]>)[spriteId] ?? [],
  );
  const order = PREFERENCE[size];
  return {
    normal: order.find((style) => !missing.has(style)) ?? order[0]!,
    shiny: order.find((style) => !missing.has(`${style}-shiny`)) ?? null,
  };
}
