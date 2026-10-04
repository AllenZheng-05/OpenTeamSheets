import { cookies } from "next/headers";
import { boxTiles } from "@ots/core/teams";
import { BOX_COOKIE, decodeBox } from "./box";

/** Every box species' id, in Pokédex order. */
export const boxIds = () => boxTiles().map((tile) => tile.id);

/** The player's box, from their cookie. */
export async function readBox(): Promise<Set<string>> {
  return decodeBox((await cookies()).get(BOX_COOKIE)?.value, boxIds());
}
