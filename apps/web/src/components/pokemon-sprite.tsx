"use client";

import Image from "next/image";
import { useState } from "react";
import { SPRITE_STYLES, spriteStyle } from "@ots/core/game-data";

const SPRITES = "https://play.pokemonshowdown.com/sprites";

// Small sprites (rows, the box) use Showdown's 3D renders, about a third
// the download of Pokémon HOME renders; large ones (team pages) use HOME.
// Core's spriteStyle() picks a style each Pokémon has, so the right image
// is linked straight away. A shiny with no shiny art shows its regular
// sprite. If a link still fails (a Pokémon added since the styles were
// checked), it falls back through the styles, never to a different form.

/** Up to this size (in px at normal scale), a sprite counts as small. */
const SMALL = 64;

const url = (folder: string, spriteId: string, shiny: boolean) =>
  `${SPRITES}/${folder}${shiny ? "-shiny" : ""}/${spriteId}.${folder === "ani" ? "gif" : "png"}`;

function sources(spriteId: string, shiny: boolean, size: number): string[] {
  const best = spriteStyle(spriteId, size <= SMALL ? "small" : "large");
  const first =
    shiny && best.shiny
      ? url(best.shiny, spriteId, true)
      : url(best.normal, spriteId, false);
  const fallbacks = (asShiny: boolean) =>
    SPRITE_STYLES.map((folder) => url(folder, spriteId, asShiny));
  return [
    ...new Set([first, ...(shiny ? fallbacks(true) : []), ...fallbacks(false)]),
  ];
}

export function PokemonSprite({
  name,
  spriteId,
  shiny,
  size,
}: {
  name: string;
  spriteId: string | null;
  shiny: boolean;
  size: number;
}) {
  const urls = spriteId ? sources(spriteId, shiny, size) : [];
  const [attempt, setAttempt] = useState(0);
  const src = urls[attempt];

  if (!src) {
    return (
      <div
        role="img"
        aria-label={name}
        className="rounded-full bg-neutral-100"
        style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      />
    );
  }
  return (
    <Image
      src={src}
      alt={shiny ? `Shiny ${name}` : name}
      width={size}
      height={size}
      unoptimized
      loading="lazy"
      onError={() => setAttempt((n) => n + 1)}
      className="object-contain"
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    />
  );
}
