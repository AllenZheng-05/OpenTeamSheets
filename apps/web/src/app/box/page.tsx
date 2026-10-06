import type { Metadata } from "next";
import { REGULATIONS } from "@ots/core";
import { boxTiles, getSpecies } from "@ots/core/teams";
import { BoxEditorLoader } from "@/components/box-editor-loader";
import { boxUsageByRegulation } from "@/lib/box-server";

export const metadata: Metadata = { title: "My box" };

// The same page for everyone, served from the CDN and built at each deploy
// and after each import (/api/revalidate), with usage for every started
// regulation. The browser reads the player's box from their cookies and
// picks the current regulation by its clock, so nothing here depends on
// the date.

/** The Pokémon a player owns, for finding teams they can build. */
export default async function BoxPage() {
  const usage = await boxUsageByRegulation();
  const tiles = boxTiles().map(({ id, name, spriteId, regulations }) => {
    const species = getSpecies(id)!;
    return {
      id,
      name,
      spriteId,
      types: [species.type1, species.type2].filter(
        (t): t is string => t !== null,
      ),
      usage: 0,
      added: REGULATIONS.find((r) => regulations.includes(r.id))!.id,
    };
  });

  return (
    <div className="space-y-5">
      <BoxEditorLoader
        tiles={tiles}
        regulations={REGULATIONS.map((r) => r.id)}
        usage={usage}
      />
    </div>
  );
}
