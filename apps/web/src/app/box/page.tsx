import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCurrentRegulation, REGULATIONS } from "@ots/core";
import { boxTiles, getSpecies } from "@ots/core/teams";
import { BoxEditor } from "@/components/box-editor";
import { BOX_GROUP_COOKIE, BOX_SORT_COOKIE, readBoxSort } from "@/lib/box";
import { boxUsage, readBox } from "@/lib/box-server";

export const metadata: Metadata = { title: "My box" };

/** The Pokémon a player owns, for finding teams they can build. */
export default async function BoxPage() {
  const regulation = getCurrentRegulation();
  const jar = await cookies();
  const [owned, usage] = await Promise.all([readBox(), boxUsage(regulation)]);
  const tiles = boxTiles().map(({ id, name, spriteId, regulations }) => {
    const species = getSpecies(id)!;
    return {
      id,
      name,
      spriteId,
      types: [species.type1, species.type2].filter(
        (t): t is string => t !== null,
      ),
      usage: usage[id] ?? 0,
      added: REGULATIONS.find((r) => regulations.includes(r.id))!.id,
    };
  });

  return (
    <div className="space-y-5">
      <BoxEditor
        tiles={tiles}
        initial={[...owned]}
        initialSort={readBoxSort(jar.get(BOX_SORT_COOKIE)?.value)}
        initialGrouped={jar.get(BOX_GROUP_COOKIE)?.value === "1"}
        regulations={REGULATIONS.map((r) => r.id)}
        regulation={regulation}
      />
    </div>
  );
}
