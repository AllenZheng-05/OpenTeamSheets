import type { PokemonView, SheetMark } from "@/lib/pokemon";
import { ItemIcon } from "./item-icon";
import { TypePill } from "./pills";
import { PokemonSprite } from "./pokemon-sprite";

const STAT_LABELS = {
  hp: "HP",
  atk: "Atk",
  def: "Def",
  spa: "SpA",
  spd: "SpD",
  spe: "Spe",
} as const;

/**
 * An ability or move as the sheet lists it. One with an error is underlined,
 * with the error (and our reading, if any) for hover and screen readers;
 * the full variant also shows the reading.
 */
function Listed({
  text,
  mark,
  showReading = false,
}: {
  text: string;
  mark: SheetMark | null;
  showReading?: boolean;
}) {
  if (!mark) return text;
  const reading = mark.reading ? `probably ${mark.reading}` : null;
  const explanation = reading ? `${mark.message}; ${reading}` : mark.message;
  return (
    <span title={explanation}>
      <span className="text-amber-800 underline decoration-amber-500 decoration-wavy underline-offset-2">
        {text}
      </span>
      <span className="sr-only"> (error on the sheet: {explanation})</span>
      {showReading && reading && (
        <span aria-hidden className="text-xs text-amber-700">
          {" "}
          · {reading}
        </span>
      )}
    </span>
  );
}

/**
 * A team's six Pokémon. Compact, for Browse rows: what an open team sheet
 * shows (Pokémon, item, ability, moves). Full, for the team page: also
 * types, nature and stat points, with labels.
 */
export function TeamSheet({
  pokemon,
  variant,
}: {
  pokemon: PokemonView[];
  variant: "compact" | "full";
}) {
  if (variant === "compact") {
    return (
      <ul className="grid min-w-0 flex-1 grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6">
        {pokemon.map((p) => (
          <li key={p.slot} className="min-w-0">
            <PokemonSprite
              name={p.name}
              spriteId={p.spriteId}
              shiny={p.shiny}
              size={56}
            />
            <p className="mt-1 truncate text-sm font-medium">{p.name}</p>
            {p.item && (
              <p className="flex items-center gap-0.5 text-xs text-neutral-500">
                {p.itemSpriteNum !== null && (
                  <ItemIcon spriteNum={p.itemSpriteNum} />
                )}
                <span className="truncate">
                  <span className="sr-only">Item: </span>
                  <Listed text={p.item} mark={p.itemMark} />
                </span>
              </p>
            )}
            {p.ability && (
              <p className="truncate text-xs text-neutral-500">
                <span className="sr-only">Ability: </span>
                <Listed text={p.ability} mark={p.abilityMark} />
              </p>
            )}
            <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-700">
              {p.moves.map((move, i) => (
                <li key={move} className="truncate">
                  <Listed text={move} mark={p.moveMarks[i] ?? null} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pokemon.map((p) => (
        <li key={p.slot} className="rounded-xl border border-neutral-200 p-4">
          <div className="flex items-center gap-3">
            <PokemonSprite
              name={p.name}
              spriteId={p.spriteId}
              shiny={p.shiny}
              size={80}
            />
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{p.name}</h3>
              <div className="mt-1 flex gap-1">
                {p.types.map((type) => (
                  <TypePill key={type} type={type} />
                ))}
              </div>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-sm">
            <dt className="text-neutral-500">Item</dt>
            <dd className="flex items-center gap-1">
              {p.itemSpriteNum !== null && (
                <ItemIcon spriteNum={p.itemSpriteNum} />
              )}
              {p.item ? (
                <Listed text={p.item} mark={p.itemMark} showReading />
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-neutral-500">Ability</dt>
            <dd>
              {p.ability ? (
                <Listed text={p.ability} mark={p.abilityMark} showReading />
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-neutral-500">Nature</dt>
            <dd>{p.nature ?? "—"}</dd>
          </dl>
          <ul className="mt-3 grid grid-cols-2 gap-1 text-sm">
            {p.moves.map((move, i) => (
              <li key={move} className="rounded-md bg-neutral-50 px-2 py-1">
                <Listed text={move} mark={p.moveMarks[i] ?? null} showReading />
              </li>
            ))}
          </ul>
          {p.statPoints && (
            <dl className="mt-3 grid grid-cols-6 text-center text-xs">
              {Object.entries(STAT_LABELS).map(([stat, label]) => (
                <div key={stat}>
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="font-medium">
                    {p.statPoints![stat as keyof typeof STAT_LABELS]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
