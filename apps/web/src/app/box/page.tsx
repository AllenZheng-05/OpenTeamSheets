import type { Metadata } from "next";
import { REGULATIONS } from "@ots/core";
import { boxTiles, getSpecies } from "@ots/core/teams";
import { BoxEditorLoader } from "@/components/box-editor-loader";

export const metadata: Metadata = { title: "My box" };

// The same page for everyone, built once per deploy and served from the
// CDN: the browser reads the player's box from their cookies, works out the
// current regulation from its clock and loads that regulation's usage from
// /api/box-usage. Nothing here depends on the date.

/** The Pokémon a player owns, for finding teams they can build. */
export default function BoxPage() {
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
      />
    </div>
  );
}
