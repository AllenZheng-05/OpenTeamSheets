import { PokemonSprite } from "./pokemon-sprite";

interface Form {
  name: string;
  spriteId: string | null;
}

/**
 * A Pokémon's sprite; holding its Mega Stone, the Mega in front with its
 * base form behind it, darker and fainter, like a shadow.
 */
export function FormSprite({
  base,
  mega,
  shiny,
  size,
}: {
  base: Form;
  mega?: Form;
  shiny: boolean;
  /** The whole sprite's width and height. */
  size: number;
}) {
  if (!mega) {
    return (
      <PokemonSprite
        name={base.name}
        spriteId={base.spriteId}
        shiny={shiny}
        size={size}
      />
    );
  }
  const each = Math.round(size * 0.9);
  return (
    <div
      className="relative shrink-0"
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
    >
      <div
        aria-hidden
        className="absolute -top-1 -left-2 opacity-40 brightness-50"
      >
        <PokemonSprite
          key={base.spriteId}
          name={base.name}
          spriteId={base.spriteId}
          shiny={shiny}
          size={each}
        />
      </div>
      <div className="absolute right-0 bottom-0">
        <PokemonSprite
          key={mega.spriteId}
          name={mega.name}
          spriteId={mega.spriteId}
          shiny={shiny}
          size={each}
        />
      </div>
    </div>
  );
}
