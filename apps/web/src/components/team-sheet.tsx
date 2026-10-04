import type { PokemonView, SheetMark } from "@/lib/pokemon";
import type { Described, MoveView } from "@/lib/pokemon-details";
import { BaseStats } from "./base-stats";
import { InfoTip } from "./info-tip";
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
 * types, nature, base stats (before and after Mega Evolving) and stat
 * points, with descriptions on hover.
 */
export function TeamSheet({
  pokemon,
  variant,
  owned = null,
}: {
  pokemon: PokemonView[];
  variant: "compact" | "full";
  /** The player's box, when searching by it: missing Pokémon are dimmed. */
  owned?: Set<string> | null;
}) {
  if (variant === "compact") {
    return (
      <ul className="grid min-w-0 flex-1 grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-6">
        {pokemon.map((p) => {
          const missing =
            owned !== null && !!p.boxSpecies && !owned.has(p.boxSpecies);
          return (
            <li
              key={p.slot}
              className={`min-w-0 ${missing ? "opacity-40 grayscale" : ""}`}
            >
              {missing && <span className="sr-only">Not in your box: </span>}
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
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pokemon.map((p) => (
        <li key={p.slot} className="rounded-xl border border-neutral-200 p-4">
          <PokemonCard p={p} />
        </li>
      ))}
    </ul>
  );
}

/** What an item or ability does, for its tooltip. */
function DescriptionTip({ described }: { described: Described }) {
  return (
    <>
      <span className="block font-semibold">{described.name}</span>
      {described.description ?? "Not in Pokémon Champions."}
    </>
  );
}

/** A move's type, category, power and accuracy, then what it does. */
function MoveTip({ move }: { move: MoveView }) {
  const facts = [
    move.type,
    move.category,
    move.power ? `${move.power} power` : null,
    move.accuracy === null ? "never misses" : `${move.accuracy}% accuracy`,
    move.priority
      ? `priority ${move.priority > 0 ? "+" : ""}${move.priority}`
      : null,
  ].filter(Boolean);
  return (
    <>
      <span className="block font-semibold">{move.name}</span>
      <span className="block text-neutral-300 capitalize">
        {facts.join(" · ")}
      </span>
      {move.description}
    </>
  );
}

/**
 * One Pokémon on the team page: its forms (the one listed and, holding its
 * Mega Stone, the Mega), item, abilities, nature, moves and base stats.
 */
function PokemonCard({ p }: { p: PokemonView }) {
  const d = p.details;
  const [base, mega] = d?.forms ?? [];
  const sameTypes = !!mega && base?.types.join() === mega.types.join();

  return (
    <>
      <div className="flex items-center gap-3">
        {mega ? (
          // The Mega in front, with its base form behind it, darker and
          // fainter, like a shadow.
          <div className="relative size-20 shrink-0">
            <div
              aria-hidden
              className="absolute -top-1 -left-2 opacity-40 brightness-50"
            >
              <PokemonSprite
                name={base!.name}
                spriteId={base!.spriteId}
                shiny={p.shiny}
                size={72}
              />
            </div>
            <div className="absolute right-0 bottom-0">
              <PokemonSprite
                name={mega.name}
                spriteId={mega.spriteId}
                shiny={p.shiny}
                size={72}
              />
            </div>
          </div>
        ) : (
          <PokemonSprite
            name={base?.name ?? p.name}
            spriteId={base?.spriteId ?? p.spriteId}
            shiny={p.shiny}
            size={80}
          />
        )}
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{base?.name ?? p.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {(base?.types ?? p.types).map((type) => (
              <TypePill key={type} type={type} />
            ))}
          </div>
          {mega && (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
              <span>
                <span className="sr-only">Mega Evolves into </span>
                {mega.name}
              </span>
              {!sameTypes &&
                mega.types.map((type) => <TypePill key={type} type={type} />)}
            </p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm">
        <dt className="text-neutral-500">Item</dt>
        <dd className="flex min-w-0 items-center gap-1">
          {p.itemSpriteNum !== null && <ItemIcon spriteNum={p.itemSpriteNum} />}
          {p.item && d?.item ? (
            <InfoTip tip={<DescriptionTip described={d.item} />}>
              <Listed text={p.item} mark={p.itemMark} showReading />
            </InfoTip>
          ) : (
            "—"
          )}
        </dd>
        <dt className="text-neutral-500">Ability</dt>
        <dd className="flex min-w-0 flex-wrap items-center gap-x-1">
          {p.ability && base?.ability ? (
            <InfoTip tip={<DescriptionTip described={base.ability} />}>
              <Listed text={p.ability} mark={p.abilityMark} showReading />
            </InfoTip>
          ) : (
            "—"
          )}
          {mega?.ability && (
            <>
              <span aria-hidden className="text-neutral-400">
                →
              </span>
              <span className="sr-only">, after Mega Evolving </span>
              <InfoTip tip={<DescriptionTip described={mega.ability} />}>
                {mega.ability.name}
              </InfoTip>
            </>
          )}
        </dd>
        <dt className="text-neutral-500">Nature</dt>
        <dd>
          {d?.nature ? (
            <>
              {d.nature.name}
              {d.nature.plus && d.nature.minus && (
                <span className="text-xs">
                  {" "}
                  (
                  <span className="text-red-600">
                    +{STAT_LABELS[d.nature.plus]}
                  </span>
                  ,{" "}
                  <span className="text-blue-600">
                    −{STAT_LABELS[d.nature.minus]}
                  </span>
                  )
                </span>
              )}
            </>
          ) : (
            (p.nature ?? "—")
          )}
        </dd>
      </dl>

      <ul className="mt-3 grid grid-cols-2 gap-1 text-sm">
        {p.moves.map((move, i) => {
          const info = d?.moves[i];
          const listed = (
            <Listed text={move} mark={p.moveMarks[i] ?? null} showReading />
          );
          return (
            <li
              key={move}
              className="min-w-0 rounded-md bg-neutral-50 px-2 py-1"
            >
              {info ? (
                <InfoTip tip={<MoveTip move={info} />}>{listed}</InfoTip>
              ) : (
                listed
              )}
            </li>
          );
        })}
      </ul>

      {base && (
        <div className="mt-3">
          <BaseStats
            forms={d!.forms}
            plus={d!.nature?.plus ?? null}
            minus={d!.nature?.minus ?? null}
          />
        </div>
      )}

      {p.statPoints && (
        <div className="mt-3">
          <p className="text-xs text-neutral-500">Stat points</p>
          <dl className="mt-1 grid grid-cols-6 text-center text-xs">
            {Object.entries(STAT_LABELS).map(([stat, label]) => (
              <div key={stat}>
                <dt className="text-neutral-500">{label}</dt>
                <dd className="font-medium">
                  {p.statPoints![stat as keyof typeof STAT_LABELS]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
