"use client";

import Image from "next/image";
import { useState } from "react";
import { spriteStyle } from "@ots/core/game-data";

const SPRITES = "https://play.pokemonshowdown.com/sprites";

// Pokémon HOME renders, except for the newest forms (most Champions Megas)
// that don't have one yet: for those, core's spriteStyle() names the style
// Showdown does have (3D "dex", pixel or animated), so the right image is
// linked straight away. A shiny with no shiny art shows its regular sprite.
// If a link still fails (a Pokémon added since the styles were checked),
// it falls back through the styles in turn, never to a different form.
const STYLES = ["home-centered", "dex", "gen5", "ani"];

const url = (folder: string, spriteId: string, shiny: boolean) =>
  `${SPRITES}/${folder}${shiny ? "-shiny" : ""}/${spriteId}.${folder === "ani" ? "gif" : "png"}`;

function sources(spriteId: string, shiny: boolean): string[] {
  const best = spriteStyle(spriteId);
  const first =
    shiny && best.shiny
      ? url(best.shiny, spriteId, true)
      : url(best.normal, spriteId, false);
  const fallbacks = (asShiny: boolean) =>
    STYLES.map((folder) => url(folder, spriteId, asShiny));
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
  const urls = spriteId ? sources(spriteId, shiny) : [];
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
