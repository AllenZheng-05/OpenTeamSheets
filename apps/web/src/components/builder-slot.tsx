"use client";

import { useCallback, useId, useMemo } from "react";
import { gameData, type StatId } from "@ots/core/game-data";
import {
  battleStat,
  boxSpecies,
  emptySet,
  learnableAbilities,
  learnableMoves,
  MAX_STAT_POINTS,
  MAX_TOTAL_STAT_POINTS,
  nameOf,
  type Problem,
  type TeamSet,
  type ValidationResult,
} from "@ots/core/teams";
import { filled, statTotal, withStatPoints, type Draft } from "@/lib/builder";
import {
  fieldOptions,
  matchOptions,
  itemOptions,
  searchSpecies,
  speciesChoice,
  speciesOptions,
  type FieldKind,
  type FieldOption,
  type MoveBasics,
  type SpeciesRow,
} from "@/lib/builder-options";
import { useBuilder } from "@/lib/builder-store";
import { setDetails } from "@/lib/pokemon-details";
import { Combobox } from "./combobox";
import { FormSprite } from "./form-sprite";
import { NotInBox } from "./not-in-box";
import { TypePill } from "./pills";
import { PokemonSprite } from "./pokemon-sprite";

/**
 * The slot's fields in order, for Enter to move from one to the next: the
 * Pokémon, item, ability, four moves, nature, then the six stat boxes.
 */
const FIELD_ORDER = {
  species: 1,
  item: 2,
  ability: 3,
  move: 4,
  nature: 8,
  stats: 9,
};

/**
 * Focuses the slot's next field after `order`, once the page has updated
 * (picking a Pokémon for an empty slot brings the other fields in).
 */
function focusAfter(order: number) {
  requestAnimationFrame(() => {
    const next = [
      ...document.querySelectorAll<HTMLElement>("[data-field-order]"),
    ]
      .filter((el) => Number(el.dataset.fieldOrder) > order)
      .sort(
        (a, b) => Number(a.dataset.fieldOrder) - Number(b.dataset.fieldOrder),
      )[0];
    next?.focus();
  });
}

const STATS: { id: StatId; label: string }[] = [
  { id: "hp", label: "HP" },
  { id: "atk", label: "Attack" },
  { id: "def", label: "Defense" },
  { id: "spa", label: "Sp. Atk" },
  { id: "spd", label: "Sp. Def" },
  { id: "spe", label: "Speed" },
];

/**
 * One slot's set, laid out as in Showdown's teambuilder: the Pokémon, its
 * item, ability and moves on top; its nature and stat points below. A
 * Pokémon holding its Mega Stone shows the Mega's ability and stats too.
 */
export function BuilderSlot({
  draft,
  slot,
  owned,
  problems,
}: {
  draft: Draft;
  slot: number;
  /** The player's box, to mark Pokémon they don't have; null if unset. */
  owned: Set<string> | null;
  /** The validator's problems with this slot. */
  problems: ValidationResult;
}) {
  // A field's problem, if it has one: a move's by its id.
  const markAt = (
    at: Problem["place"],
    value?: string | null,
  ): Mark | undefined => {
    const find = (list: Problem[]) =>
      list.find(
        (p) =>
          (p.field ?? p.place) === at && (at !== "move" || p.value === value),
      );
    const error = find(problems.errors);
    if (error)
      return {
        tone: "error",
        short: error.short ?? "not allowed",
        message: error.message,
      };
    const warning = find(problems.warnings);
    if (warning)
      return {
        tone: "warning",
        short: warning.short ?? "check",
        message: warning.message,
      };
    return undefined;
  };
  const set = draft.sets[slot]!;
  const update = useBuilder((s) => s.updateSet);
  const change = (patch: Partial<TeamSet>) => update(draft.id, slot, patch);

  // A Mega picked from the list is its base form holding its stone.
  const chooseSpecies = (id: string) =>
    change(speciesChoice(id, set.abilityId));
  // Pokémon by name, or by an ability or move they have.
  const findSpecies = (query: string) => searchSpecies(query, draft.regulation);

  if (!filled(set)) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <div className="space-y-2">
          <Field
            label="Pokémon"
            order={FIELD_ORDER.species}
            placeholder="Search Pokémon, abilities or moves"
            options={speciesOptions(draft.regulation)}
            owned={owned}
            search={findSpecies}
            kind="species"
            value={null}
            onPick={chooseSpecies}
          />
          <p className="text-xs text-neutral-500">
            Slot {slot + 1} is empty. Search by name, or by an ability or move
            to find the Pokémon that have it.
          </p>
        </div>
      </div>
    );
  }

  // The form outside battle and, holding its stone, the Mega.
  const details = setDetails(set);
  const [base, mega] = details?.forms ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
        {/* On its own row, so its list is as wide as the editor. */}
        <Field
          label="Pokémon"
          order={FIELD_ORDER.species}
          placeholder="Search Pokémon, abilities or moves"
          options={speciesOptions(draft.regulation)}
          owned={owned}
          search={findSpecies}
          kind="species"
          value={set.speciesId}
          mark={markAt("species")}
          onPick={chooseSpecies}
          onClear={() => change(emptySet())}
        />
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {base && (
              <>
                <FormSprite
                  base={base}
                  mega={mega}
                  shiny={set.shiny}
                  size={96}
                />
                <Types types={base.types} />
                {/* A Mega's types, when they differ. */}
                {mega && mega.types.join() !== base.types.join() && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-neutral-500">
                      As Mega
                    </span>
                    <Types types={mega.types} />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
            <div className="space-y-3">
              <Field
                label="Item"
                order={FIELD_ORDER.item}
                placeholder="No item"
                options={itemOptions(draft.regulation)}
                kind="item"
                value={set.itemId}
                mark={markAt("item")}
                onPick={(itemId) => change({ itemId, listedItem: null })}
                onClear={() => change({ itemId: null, listedItem: null })}
              />
              <AbilityField
                set={set}
                mark={markAt("ability")}
                onChange={change}
              />
              {mega?.ability && (
                <p className="text-xs text-neutral-600">
                  Becomes{" "}
                  <HoverInfo
                    label={mega.ability.name}
                    description={mega.ability.description}
                  />{" "}
                  as {mega.name}
                </p>
              )}
            </div>
            <MoveFields
              set={set}
              draft={draft}
              markFor={(move) => markAt("move", move)}
              onChange={change}
            />
          </div>
        </div>
      </div>

      <StatPanel
        set={set}
        base={base?.stats}
        baseName={base?.name}
        mega={mega ? { name: mega.name, stats: mega.stats } : undefined}
        onChange={change}
      />

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Note
          </span>
          <textarea
            value={set.note ?? ""}
            rows={3}
            maxLength={2000}
            placeholder="Why it's here, its spread, how to play it"
            onChange={(e) => change({ note: e.target.value || null })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500"
          />
        </label>
      </div>
    </div>
  );
}

/** The abilities this Pokémon can have outside battle. */
function AbilityField({
  set,
  mark,
  onChange,
}: {
  set: TeamSet;
  mark: Mark | undefined;
  onChange: (patch: Partial<TeamSet>) => void;
}) {
  const options = useMemo(() => {
    const legal = new Set(learnableAbilities(set.speciesId!));
    return fieldOptions("ability").filter((o) => legal.has(o.id));
  }, [set.speciesId]);
  return (
    <Field
      label="Ability"
      order={FIELD_ORDER.ability}
      placeholder="Ability"
      options={options}
      kind="ability"
      value={set.abilityId}
      mark={mark}
      onPick={(abilityId) => onChange({ abilityId })}
      onClear={() => onChange({ abilityId: null })}
    />
  );
}

/** Four moves, each from what this Pokémon learns in the regulation. */
function MoveFields({
  set,
  draft,
  markFor,
  onChange,
}: {
  set: TeamSet;
  draft: Draft;
  /** A move's problem, if it has one. */
  markFor: (move: string | null) => Mark | undefined;
  onChange: (patch: Partial<TeamSet>) => void;
}) {
  const learnable = useMemo(() => {
    const legal = new Set(learnableMoves(set.speciesId!, draft.regulation));
    return fieldOptions("move").filter((o) => legal.has(o.id));
  }, [set.speciesId, draft.regulation]);
  const moves = Array.from({ length: 4 }, (_, i) => set.moveIds[i] ?? null);

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Moves</legend>
      {moves.map((move, i) => (
        <MoveField
          key={i}
          index={i}
          move={move}
          options={learnable}
          others={set.moveIds}
          mark={markFor(move)}
          onPick={(id) => {
            const next = [...set.moveIds];
            next[Math.min(i, next.length)] = id;
            onChange({ moveIds: next });
          }}
          onClear={() =>
            onChange({ moveIds: set.moveIds.filter((_, j) => j !== i) })
          }
        />
      ))}
    </fieldset>
  );
}

function MoveField({
  index,
  move,
  options,
  others,
  mark,
  onPick,
  onClear,
}: {
  index: number;
  move: string | null;
  options: FieldOption[];
  others: string[];
  mark: Mark | undefined;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  // The learnable moves, less those in the other move slots.
  const shown = useMemo(
    () => options.filter((o) => o.id === move || !others.includes(o.id)),
    [options, others, move],
  );
  return (
    <Field
      label={`Move ${index + 1}`}
      order={FIELD_ORDER.move + index}
      placeholder="Move"
      options={shown}
      kind="move"
      value={move}
      mark={mark}
      onPick={onPick}
      onClear={onClear}
    />
  );
}

/**
 * Nature and stat points. Each stat takes two lines: its name and its stat
 * in battle (with the Mega's after an arrow, where it differs), then a
 * slider and a number box for its points. A stat stops at 32 and the total
 * at 66: past either, it doesn't go higher. Base stats are in the Pokémon
 * list, so they aren't repeated here.
 */
function StatPanel({
  set,
  base,
  baseName,
  mega,
  onChange,
}: {
  set: TeamSet;
  base: Record<StatId, number> | undefined;
  baseName: string | undefined;
  mega: { name: string; stats: Record<StatId, number> } | undefined;
  onChange: (patch: Partial<TeamSet>) => void;
}) {
  const nature = gameData.natures.find((n) => n.id === set.natureId);
  const remaining = MAX_TOTAL_STAT_POINTS - statTotal(set.statPoints);
  const setStat = (stat: StatId, value: number) =>
    onChange({
      statPoints: withStatPoints(
        set.statPoints,
        stat,
        value,
        MAX_STAT_POINTS,
        MAX_TOTAL_STAT_POINTS,
      ),
    });
  const inBattle = (stat: StatId, baseStat: number) =>
    battleStat(stat, baseStat, set.statPoints?.[stat] ?? 0, nature ?? null);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Field
            label="Nature"
            order={FIELD_ORDER.nature}
            placeholder="Nature"
            options={fieldOptions("nature")}
            kind="nature"
            value={set.natureId}
            onPick={(natureId) => onChange({ natureId })}
            onClear={() => onChange({ natureId: null })}
          />
        </div>
        <p aria-live="polite" className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900 tabular-nums">
            {remaining}
          </span>{" "}
          of {MAX_TOTAL_STAT_POINTS} stat points left
        </p>
      </div>

      {/* A key for the numbers on the right: whose stats, before and after
          Mega Evolving. */}
      {base && (
        <p
          aria-hidden
          className="mt-4 border-b border-neutral-100 pb-1.5 text-right text-xs text-neutral-500"
        >
          {mega ? (
            <>
              <span className="font-semibold text-neutral-900">{baseName}</span>
              {" → "}
              <span className="font-semibold">{mega.name}</span>
            </>
          ) : (
            "Stats in battle"
          )}
        </p>
      )}

      <div className={`${base ? "mt-2" : "mt-4"} space-y-3`}>
        {STATS.map(({ id, label }) => {
          const value = set.statPoints?.[id] ?? 0;
          const boost =
            nature?.plusStat === id
              ? "+"
              : nature?.minusStat === id
                ? "−"
                : null;
          const now = base ? inBattle(id, base[id]) : null;
          const asMega = mega ? inBattle(id, mega.stats[id]) : null;
          return (
            <div key={id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">
                  {label}
                  {boost && (
                    <span
                      className={`ml-1 ${boost === "+" ? "text-red-600" : "text-blue-600"}`}
                      title={
                        boost === "+" ? "Raised by nature" : "Lowered by nature"
                      }
                    >
                      {boost}
                    </span>
                  )}
                </span>
                <span className="tabular-nums" title="Stat in battle">
                  <span className="font-semibold">{now}</span>
                  {mega && <span className="sr-only"> as {baseName}</span>}
                  {asMega !== null && asMega !== now && (
                    <span
                      className="text-neutral-500"
                      title={`As ${mega!.name}`}
                    >
                      {" "}
                      → <span className="font-semibold">{asMega}</span>
                      <span className="sr-only"> as {mega!.name}</span>
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={MAX_STAT_POINTS}
                  value={value}
                  aria-label={`${label} stat points (slider)`}
                  onChange={(e) => setStat(id, e.target.valueAsNumber)}
                  className="min-w-0 flex-1 cursor-pointer accent-neutral-900"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAX_STAT_POINTS}
                  value={set.statPoints ? value : ""}
                  placeholder="–"
                  aria-label={`${label} stat points`}
                  data-field-order={
                    FIELD_ORDER.stats + STATS.findIndex((s) => s.id === id)
                  }
                  onChange={(e) => setStat(id, e.target.valueAsNumber)}
                  className="w-16 shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm tabular-nums outline-none focus:border-neutral-500"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A field that picks one option by searching. Its list shows what each
 * option does, and each move's type, category, power and accuracy; it
 * opens at the field's current value.
 */
function Field({
  label,
  placeholder,
  options,
  search,
  kind,
  value,
  onPick,
  onClear,
  owned = null,
  order,
  mark,
}: {
  label: string;
  placeholder: string;
  options: FieldOption[];
  /** Finds options for typed text; matching the options by name if not given. */
  search?: (query: string) => FieldOption[];
  /** For naming the value and finding its info. */
  kind: FieldKind;
  value: string | null;
  onPick: (id: string) => void;
  onClear?: () => void;
  /** For the Pokémon field: the player's box, to mark ones not in it. */
  owned?: Set<string> | null;
  /** Its place in the slot (FIELD_ORDER); Enter moves to the next. */
  order: number;
  /** What's wrong with its value, shown inside it. */
  mark?: Mark;
}) {
  const markId = useId();
  const suggestions = useCallback(
    (query: string) => (search ? search(query) : matchOptions(options, query)),
    [options, search],
  );
  return (
    <div>
      <Combobox<FieldOption>
        variant="field"
        label={label}
        placeholder={placeholder}
        value={value === null ? "" : nameOf(kind, value)}
        suggestions={suggestions}
        onSelect={(option) => onPick(option.id)}
        onClear={onClear}
        fieldOrder={order}
        onEnterPick={() => focusAfter(order)}
        invalid={mark?.tone}
        describedBy={mark ? markId : undefined}
        inputEnd={mark && <MarkView mark={mark} />}
        inputEndWidth={
          mark ? `calc(${mark.short.length * 0.6}em + 2.25rem)` : undefined
        }
        {...(kind === "species"
          ? {
              renderOption: (option: FieldOption) =>
                option.species ? (
                  <SpeciesRowView
                    name={option.name}
                    row={option.species}
                    missing={
                      owned !== null && !owned.has(boxSpecies(option.id))
                    }
                  />
                ) : (
                  option.name
                ),
              listHeader: <SpeciesRowHeader />,
              // As wide as the field; the rows fit their columns to it.
              listClassName: "@container w-full",
            }
          : {
              renderOption: (option: FieldOption) => (
                <OptionRow option={option} />
              ),
            })}
      />
      {mark && (
        <span id={markId} className="sr-only">
          {mark.message}
        </span>
      )}
    </div>
  );
}

/**
 * An item, ability, move or nature in a list: its name, a move's basics,
 * and what it does.
 */
function OptionRow({ option }: { option: FieldOption }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>{option.name}</span>
      {option.move && <MoveBasicsLine move={option.move} />}
      {option.info && (
        <span className="text-xs leading-snug text-neutral-600">
          {option.info.description ?? "Not in Pokémon Champions."}
        </span>
      )}
    </span>
  );
}

/** A move's type, category, power, accuracy and any priority. */
function MoveBasicsLine({ move }: { move: MoveBasics }) {
  const facts = [
    move.category.charAt(0).toUpperCase() + move.category.slice(1),
    move.power ? `${move.power} power` : null,
    move.accuracy === null ? "never misses" : `${move.accuracy}% accuracy`,
    move.priority
      ? `priority ${move.priority > 0 ? "+" : ""}${move.priority}`
      : null,
  ].filter(Boolean);
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-neutral-500">
      <TypePill type={move.type} />
      {facts.join(" · ")}
    </span>
  );
}

function Types({ types }: { types: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {types.map((type) => (
        <TypePill key={type} type={type} />
      ))}
    </div>
  );
}

/**
 * The Pokémon list's rows, as in Showdown's teambuilder: one line of
 * columns when the list is wide enough (it's as wide as its field), and
 * three lines (name and types, abilities, labelled stats) when it isn't.
 * Either way every detail shows.
 */
const SPECIES_COLUMNS =
  "grid-cols-[2rem_minmax(6rem,1fr)_minmax(8rem,1.3fr)_repeat(6,1.75rem)_2.25rem] items-center gap-x-2";
const STAT_HEADERS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];

/** Column names, over the one-line rows only. */
function SpeciesRowHeader() {
  return (
    <div
      className={`hidden ${SPECIES_COLUMNS} px-3 py-1 text-[10px] font-medium text-neutral-500 @xl:grid`}
    >
      <span />
      <span>Pokémon</span>
      <span>Abilities</span>
      {STAT_HEADERS.map((stat) => (
        <span key={stat} className="text-right">
          {stat}
        </span>
      ))}
      <span className="text-right">BST</span>
    </div>
  );
}

/**
 * A Pokémon in the list: sprite, name and types, abilities, base stats. A
 * Mega shows its own types, ability and stats.
 */
function SpeciesRowView({
  name,
  row,
  missing,
}: {
  name: string;
  row: SpeciesRow;
  /** Not in the player's box. */
  missing: boolean;
}) {
  const sprite = (
    <PokemonSprite
      name={name}
      spriteId={row.spriteId}
      shiny={false}
      size={32}
    />
  );
  const types = (
    <span className="flex gap-1">
      {row.types.map((type) => (
        <TypePill key={type} type={type} />
      ))}
    </span>
  );
  const hidden = row.hidden && (
    <span className="text-neutral-400">
      <span className="sr-only">Hidden ability: </span>
      {row.hidden}
    </span>
  );
  return (
    <>
      {/* Wide: one line of columns. */}
      <span className={`-mx-1 hidden ${SPECIES_COLUMNS} text-xs @xl:grid`}>
        {sprite}
        <span className="flex min-w-0 flex-col gap-1 py-0.5">
          <span className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate">{name}</span>
            {missing && <NotInBox />}
          </span>
          {types}
        </span>
        <span className="flex flex-col text-neutral-600">
          <span className="flex flex-wrap gap-x-2">
            {row.abilities.map((ability) => (
              <span key={ability}>{ability}</span>
            ))}
          </span>
          {hidden}
        </span>
        {row.stats.map((value, i) => (
          <span key={STAT_HEADERS[i]} className="text-right tabular-nums">
            {value}
          </span>
        ))}
        <span className="text-right text-neutral-500 tabular-nums">
          {row.total}
        </span>
      </span>

      {/* Narrow: three lines, the stats labelled. */}
      <span className="-mx-1 flex gap-2 text-xs @xl:hidden">
        <span className="shrink-0">{sprite}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="flex items-center gap-1 text-sm">
              {name}
              {missing && <NotInBox />}
            </span>
            {types}
          </span>
          <span className="flex flex-wrap gap-x-2 text-neutral-600">
            {row.abilities.map((ability) => (
              <span key={ability}>{ability}</span>
            ))}
            {hidden}
          </span>
          <span className="grid grid-cols-7 text-center">
            {[...row.stats, row.total].map((value, i) => (
              <span key={i} className="flex flex-col">
                <span className="text-[10px] text-neutral-400">
                  {STAT_HEADERS[i] ?? "BST"}
                </span>
                <span
                  className={`tabular-nums ${i === 6 ? "text-neutral-500" : ""}`}
                >
                  {value}
                </span>
              </span>
            ))}
          </span>
        </span>
      </span>
    </>
  );
}

/** Underlined text that shows what something does on hover or focus. */
function HoverInfo({
  label,
  description,
}: {
  label: string;
  description: string | null;
}) {
  const id = useId();
  return (
    <span className="group/info relative inline-block">
      <button
        type="button"
        aria-describedby={id}
        className="cursor-help font-medium text-neutral-900 underline decoration-neutral-300 decoration-dotted underline-offset-4"
      >
        {label}
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1.5 w-64 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-focus-within/info:visible group-focus-within/info:opacity-100 group-hover/info:visible group-hover/info:opacity-100"
      >
        <span className="block font-semibold">{label}</span>
        {description ?? "Not in Pokémon Champions."}
      </span>
    </span>
  );
}

/** A field's problem: how bad, a few words for inside it, and in full. */
interface Mark {
  tone: "error" | "warning";
  short: string;
  message: string;
}

/** "can't learn" and a "!", inside the field at its right end. */
function MarkView({ mark }: { mark: Mark }) {
  const error = mark.tone === "error";
  return (
    <span
      aria-hidden
      className={`flex items-center gap-1.5 text-[11px] ${error ? "text-red-700" : "text-amber-700"}`}
    >
      {mark.short}
      <span
        className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${error ? "bg-red-600" : "bg-amber-600"}`}
      >
        !
      </span>
    </span>
  );
}
