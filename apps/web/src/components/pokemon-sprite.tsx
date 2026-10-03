"use client";

import Image from "next/image";
import { useState } from "react";

const SPRITES = "https://play.pokemonshowdown.com/sprites";

// Pokémon HOME renders first. Some newer forms (most Champions Megas)
// don't have one yet, so it falls back to the same Pokémon in Showdown's
// other styles, never to a different form: 3D "dex" sprites, then pixel
// sprites, then animated ones. A shiny with no shiny art anywhere shows
// its regular sprite.
const STYLES = [
  { folder: "home-centered", extension: "png" },
  { folder: "dex", extension: "png" },
  { folder: "gen5", extension: "png" },
  { folder: "ani", extension: "gif" },
];

function sources(spriteId: string, shiny: boolean): string[] {
  const urls = (suffix: string) =>
    STYLES.map(
      ({ folder, extension }) =>
        `${SPRITES}/${folder}${suffix}/${spriteId}.${extension}`,
    );
  return shiny ? [...urls("-shiny"), ...urls("")] : urls("");
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
        style={{ width: size, height: size }}
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
      style={{ width: size, height: size }}
    />
  );
}
