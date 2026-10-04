/**
 * Appends box species that don't have an index yet to
 * packages/core/data/box-order.json. Indexes are permanent (masks in links
 * and the database depend on them), so existing entries never move and
 * none are removed. Run by `pnpm data:pull` after the data is generated.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BOX_BITS, boxTiles } from "@ots/core/teams";

const file = path.join(
  import.meta.dirname,
  "../../packages/core/data/box-order.json",
);
const order = JSON.parse(readFileSync(file, "utf8")) as string[];
const known = new Set(order);
const added = boxTiles()
  .map((tile) => tile.id)
  .filter((id) => !known.has(id));

if (order.length + added.length > BOX_BITS) {
  throw new Error(
    `Box species need ${order.length + added.length} indexes but masks hold ${BOX_BITS}; widen BOX_BITS (see packages/core/src/teams/box.ts)`,
  );
}
if (added.length > 0) {
  writeFileSync(file, `${JSON.stringify([...order, ...added], null, 2)}\n`);
}
console.log(
  `Box order: ${added.length} new (${order.length + added.length} of ${BOX_BITS})`,
);
