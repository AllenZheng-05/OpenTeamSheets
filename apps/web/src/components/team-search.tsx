"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState, useTransition } from "react";
import type { Regulation } from "@ots/core";
import { getPokemonDetails } from "@/app/search-actions";
import {
  BOX_MATCHES,
  EVENT_KINDS,
  filtersHref,
  placementLabel,
  readPlacement,
  SHEET_ERROR_FILTERS,
  TOP_CUTOFFS,
  type BoxMatch,
  type EventKind,
  type Filters,
  type SheetErrorFilter,
  type Stage,
} from "@/lib/search";
import type { EventOption, SearchOption } from "@/lib/search-options";
import {
  choiceText,
  conditionLabel,
  fold,
  fullPokemon,
  parseQuery,
  queryPokemon,
  suggest,
  withMode,
  type Choice,
  type NameOf,
  type PokemonDetails,
  type Suggestion,
} from "@/lib/search-query";
import { Combobox } from "./combobox";

/** The id of the main search box, which "/" focuses. */
export const SEARCH_INPUT_ID = "team-search";

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

type ListKey =
  "has" | "not" | "archetypes" | "notArchetypes" | "players" | "notPlayers";

/** A chosen filter, and where it sits in Filters. */
type Pill = { choice: Choice; list: ListKey; index: number };

/** The list in Filters a choice belongs in. */
const listFor = (choice: Choice): ListKey =>
  "condition" in choice
    ? choice.mode
    : "archetype" in choice
      ? choice.mode === "has"
        ? "archetypes"
        : "notArchetypes"
      : choice.mode === "has"
        ? "players"
        : "notPlayers";

/** What a choice adds to its list. */
const valueOf = (choice: Choice) =>
  "condition" in choice
    ? choice.condition
    : "archetype" in choice
      ? choice.archetype
      : choice.player;

/** Every chosen filter, in the order the pills show them. */
function pillsOf(filters: Filters): Pill[] {
  const pills = (
    list: ListKey,
    values: unknown[],
    choice: (value: never) => Choice,
  ) =>
    values.map((value, index) => ({
      choice: choice(value as never),
      list,
      index,
    }));
  return [
    ...pills("has", filters.has, (condition) => ({ mode: "has", condition })),
    ...pills("not", filters.not, (condition) => ({ mode: "not", condition })),
    ...pills("archetypes", filters.archetypes, (archetype) => ({
      mode: "has",
      archetype,
    })),
    ...pills("notArchetypes", filters.notArchetypes, (archetype) => ({
      mode: "not",
      archetype,
    })),
    ...pills("players", filters.players, (player) => ({
      mode: "has",
      player,
    })),
    ...pills("notPlayers", filters.notPlayers, (player) => ({
      mode: "not",
      player,
    })),
  ];
}

/**
 * The search bar. Typing suggests Pokémon, moves, items, abilities, types,
 * archetypes and players; "not" in front excludes, and "with" after a
 * Pokémon adds its moves, ability or item ("Charizard with Charizardite Y").
 * Each choice becomes a pill in the bar, which can be clicked to edit. The
 * Filters button opens the rest: placement, regulation, event and sheet
 * errors; its count resets them. Every change updates the URL; the page
 * renders the results, so links can be shared and the back button works.
 */
export function TeamSearch({
  path,
  filters: applied,
  current,
  regulations,
  options,
  archetypes,
  events,
  boxCount,
  boxCode,
  size = "md",
}: {
  /** The page searching: "/" for everything, "/tournament" for tournament teams. */
  path: string;
  /** The filters searched for, from the URL. */
  filters: Filters;
  current: Regulation;
  regulations: Regulation[];
  options: SearchOption[];
  archetypes: SearchOption[];
  events: EventOption[];
  /** How many Pokémon are in the player's box. */
  boxCount: number;
  /** The player's box as URL text, put in the URL of box searches. */
  boxCode: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const panelId = useId();
  const [pending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  // Pokémon's moves and abilities, loaded when a query names one.
  const [details, setDetails] = useState<Record<string, PokemonDetails>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const all = useMemo(() => [...options, ...archetypes], [options, archetypes]);
  const names = useMemo(
    () => new Map(all.map((o) => [`${o.kind}:${o.id}`, o.name])),
    [all],
  );
  const name: NameOf = (kind, id) => names.get(`${kind}:${id}`) ?? id;

  const suggestions = useCallback(
    (query: string) => suggest(query, all, (id) => details[id]),
    [all, details],
  );

  /** Loads the moves and abilities of the Pokémon a query names, if any. */
  async function ensureDetails(
    query: string,
  ): Promise<Record<string, PokemonDetails>> {
    const parsed = parseQuery(query);
    const pokemon =
      fullPokemon(query, all) ??
      (parsed.details === null ? undefined : queryPokemon(parsed.subject, all));
    if (!pokemon || details[pokemon.id] || loading.has(pokemon.id)) {
      return details;
    }
    setLoading((l) => new Set(l).add(pokemon.id));
    const d = await getPokemonDetails(pokemon.id);
    const known = {
      ...details,
      [pokemon.id]: {
        moves: new Set(d.moves),
        abilities: new Set(d.abilities),
      },
    };
    setDetails((loaded) => ({ ...loaded, ...known }));
    return known;
  }

  // The filters being chosen, searched for only on Search or Enter, so
  // several can be changed at once. They follow the URL when it changes,
  // such as on Back.
  const [filters, setFilters] = useState(applied);
  const appliedHref = filtersHref(path, applied, current);
  const [shownHref, setShownHref] = useState(appliedHref);
  if (appliedHref !== shownHref) {
    setShownHref(appliedHref);
    setFilters(applied);
  }
  const go = (next: Filters) => setFilters(next);
  const changed = filtersHref(path, filters, current) !== appliedHref;
  // A box search carries the player's current box in its URL.
  const search = () =>
    startTransition(() =>
      router.push(
        filtersHref(
          path,
          { ...filters, have: filters.box !== null ? boxCode : null },
          current,
        ),
        { scroll: false },
      ),
    );
  const copy = (): Filters => structuredClone(filters);

  // A Pokémon (or a Pokémon with details) not typed in full is filled in
  // first, so what can follow it ("with …", "and …") shows; choosing it
  // again searches for it.
  const completes = (suggestion: Suggestion, typed: string) =>
    "condition" in suggestion.choice &&
    suggestion.choice.condition.pokemon !== undefined &&
    fold(suggestion.text) !== fold(typed);

  function add({ choice }: Suggestion) {
    const next = copy();
    const list = next[listFor(choice)] as unknown[];
    if (list.some((v) => same(v, valueOf(choice)))) return;
    list.push(valueOf(choice));
    go(next);
  }

  const pills = pillsOf(filters);

  const pillLabel = ({ choice }: Pill) =>
    "condition" in choice
      ? withMode(choice.mode, conditionLabel(choice.condition, name))
      : "archetype" in choice
        ? withMode(choice.mode, name("archetype", choice.archetype))
        : `${choice.mode === "not" ? "Not player" : "Player"}: “${choice.player}”`;

  const without = (pill: Pill): Filters => {
    const next = copy();
    (next[pill.list] as unknown[]).splice(pill.index, 1);
    return next;
  };

  /** Swaps a pill for another choice, keeping its place when it can. */
  function replace(pill: Pill, choice: Choice) {
    const next = without(pill);
    const target = listFor(choice);
    const list = next[target] as unknown[];
    if (!list.some((v) => same(v, valueOf(choice)))) {
      if (target === pill.list) list.splice(pill.index, 0, valueOf(choice));
      else list.push(valueOf(choice));
    }
    go(next);
  }

  // Editing a pill that isn't a player suggests everything but players, so
  // a misspelled Pokémon isn't taken as a player's name.
  const pillSuggestions = useCallback(
    (query: string) =>
      suggestions(query).filter((s) => !("player" in s.choice)),
    [suggestions],
  );

  // How many of the panel's filters are set, for the button.
  const panelCount = [
    filters.stage !== "all" || filters.top !== null,
    filters.regulation !== current,
    filters.event !== null,
    filters.errors !== null,
    filters.kind !== "all",
    filters.box !== null,
  ].filter(Boolean).length;

  const resetPanel = () =>
    go({
      ...filters,
      stage: "all",
      top: null,
      regulation: current,
      event: null,
      errors: null,
      kind: "all",
      box: null,
    });

  const select =
    "rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div role="search" className="space-y-3 text-left">
      <Combobox
        label="Search teams"
        inputId={SEARCH_INPUT_ID}
        placeholder={
          pills.length
            ? "Add a filter"
            : "Search Pokémon, moves, items, abilities, types or players"
        }
        suggestions={suggestions}
        onSelect={add}
        onQueryChange={(query) => void ensureDetails(query)}
        completes={completes}
        onSubmit={search}
        size={size}
        before={
          pills.length > 0 && (
            <ul aria-label="Search filters" className="contents">
              {pills.map((pill) => (
                <EditablePill
                  key={`${pill.list}:${pill.index}`}
                  label={pillLabel(pill)}
                  text={choiceText(pill.choice, name)}
                  include={pill.choice.mode === "has"}
                  suggestions={
                    "player" in pill.choice ? suggestions : pillSuggestions
                  }
                  completes={completes}
                  onStartEditing={() =>
                    void ensureDetails(choiceText(pill.choice, name))
                  }
                  onQueryChange={(query) => void ensureDetails(query)}
                  onReplace={(choice) => {
                    if (!same(choice, pill.choice)) replace(pill, choice);
                  }}
                  onRemove={() => go(without(pill))}
                />
              ))}
            </ul>
          )
        }
        onBackspaceEmpty={() => {
          const last = pills.at(-1);
          if (last) go(without(last));
        }}
        below={
          panelOpen && (
            <div
              id={panelId}
              className="flex flex-wrap items-center gap-2 border-t border-neutral-200 p-3"
            >
              <PlacementInput
                stage={filters.stage}
                top={filters.top}
                onChange={(stage, top) => go({ ...filters, stage, top })}
              />
              <label className="sr-only" htmlFor="search-regulation">
                Regulation
              </label>
              <select
                id="search-regulation"
                className={select}
                value={filters.regulation}
                onChange={(e) =>
                  go({
                    ...filters,
                    regulation: e.target.value as Regulation | "all",
                  })
                }
              >
                {regulations.map((r) => (
                  <option key={r} value={r}>
                    Regulation {r}
                    {r === current ? " (current)" : ""}
                  </option>
                ))}
                <option value="all">All regulations</option>
              </select>
              <label className="sr-only" htmlFor="search-box">
                Your box
              </label>
              <select
                id="search-box"
                className={select}
                value={filters.box ?? ""}
                onChange={(e) =>
                  go({
                    ...filters,
                    box:
                      e.target.value === ""
                        ? null
                        : (Number(e.target.value) as BoxMatch),
                  })
                }
              >
                <option value="">Any team</option>
                {BOX_MATCHES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              {filters.box !== null && boxCount === 0 && (
                <Link
                  href="/box"
                  className="text-sm text-neutral-600 underline underline-offset-2 hover:text-neutral-900"
                >
                  Set up your box
                </Link>
              )}
              <label className="sr-only" htmlFor="search-kind">
                Official or online
              </label>
              <select
                id="search-kind"
                className={select}
                value={filters.kind}
                onChange={(e) =>
                  go({ ...filters, kind: e.target.value as EventKind })
                }
              >
                {EVENT_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="search-event">
                Event
              </label>
              <select
                id="search-event"
                className={select}
                value={filters.event ?? ""}
                onChange={(e) =>
                  go({ ...filters, event: e.target.value || null })
                }
              >
                <option value="">All events</option>
                {[
                  { label: "Official", official: true },
                  { label: "Online", official: false },
                ].map((group) => {
                  const list = events.filter(
                    (e) => e.official === group.official,
                  );
                  return (
                    list.length > 0 && (
                      <optgroup key={group.label} label={group.label}>
                        {list.map((e) => (
                          <option key={e.slug} value={e.slug}>
                            {e.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  );
                })}
              </select>
              <div className="ml-auto">
                <label className="sr-only" htmlFor="search-errors">
                  Sheet errors
                </label>
                <select
                  id="search-errors"
                  className={select}
                  value={filters.errors ?? ""}
                  onChange={(e) =>
                    go({
                      ...filters,
                      errors: (e.target.value ||
                        null) as SheetErrorFilter | null,
                    })
                  }
                >
                  <option value="">With or without sheet errors</option>
                  {SHEET_ERROR_FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        }
        end={
          // One button to look at: the count sits inside the Filters
          // button's right end, as its own button (buttons can't nest).
          <div className="relative m-1 flex shrink-0 items-stretch gap-1">
            <button
              type="button"
              onClick={search}
              className={`rounded-lg px-3 text-sm font-medium ${
                changed
                  ? "bg-neutral-900 text-white hover:bg-neutral-700"
                  : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              Search
            </button>
            <button
              type="button"
              aria-expanded={panelOpen}
              aria-controls={panelOpen ? panelId : undefined}
              onClick={() => setPanelOpen((open) => !open)}
              className={`flex h-full items-center gap-1.5 rounded-lg pl-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 aria-expanded:bg-neutral-100 ${panelCount > 0 ? "pr-9" : "pr-3"}`}
            >
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 4h12M4.5 8h7M7 12h2" strokeLinecap="round" />
              </svg>
              Filters
            </button>
            {panelCount > 0 && (
              <button
                type="button"
                onClick={resetPanel}
                title="Reset filters"
                className="group absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-neutral-900 text-xs text-white hover:bg-rose-600 focus-visible:bg-rose-600"
              >
                <span
                  aria-hidden
                  className="group-hover:hidden group-focus-visible:hidden"
                >
                  {panelCount}
                </span>
                <span
                  aria-hidden
                  className="hidden group-hover:inline group-focus-visible:inline"
                >
                  ×
                </span>
                <span className="sr-only">
                  {panelCount} filter{panelCount === 1 ? "" : "s"} set. Reset
                  them
                </span>
              </button>
            )}
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-neutral-500">
        <p>
          Try “Incineroar with Fake Out and Intimidate”, “Charizard with
          Charizardite Y” or “not Sneasler”.
        </p>
        <p aria-live="polite">
          {pending
            ? "Searching…"
            : changed
              ? "Press Enter or Search to see results for these filters."
              : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * A chosen filter in the search bar. Clicking its text edits it as search
 * text ("not Charizard with Charizardite Y"), with the same suggestions as
 * the search box; picking one replaces the pill, and Escape, clicking away
 * or text that names nothing leaves it as it was.
 */
function EditablePill({
  label,
  text,
  include,
  suggestions,
  completes,
  onStartEditing,
  onQueryChange,
  onReplace,
  onRemove,
}: {
  label: string;
  text: string;
  include: boolean;
  suggestions: (query: string) => Suggestion[];
  completes: (suggestion: Suggestion, typed: string) => boolean;
  onStartEditing: () => void;
  onQueryChange: (query: string) => void;
  onReplace: (choice: Choice) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const colors = include
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-rose-200 bg-rose-50 text-rose-900";

  if (editing) {
    return (
      <li
        className={`flex items-center rounded-full border px-2.5 py-0.5 text-sm ${colors}`}
      >
        <Combobox
          variant="inline"
          label={`Edit ${label}`}
          placeholder=""
          initialText={text}
          autoFocus
          suggestions={suggestions}
          completes={completes}
          onQueryChange={onQueryChange}
          onSelect={(s) => {
            setEditing(false);
            onReplace(s.choice);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className={`flex items-center gap-0.5 rounded-full border py-0.5 pr-1 pl-2.5 text-sm ${colors}`}
    >
      <button
        type="button"
        onClick={() => {
          onStartEditing();
          setEditing(true);
        }}
        title="Edit"
        className="text-left"
      >
        {label}
        <span className="sr-only">. Edit</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full px-1 opacity-60 hover:opacity-100"
      >
        <span aria-hidden>×</span>
        <span className="sr-only">Remove {label}</span>
      </button>
    </li>
  );
}

/** The placements the list offers, besides any number typed in. */
const PLACEMENTS: { label: string; stage: Stage; top: number | null }[] = [
  { label: "Any", stage: "all", top: null },
  { label: "Day 2", stage: "day-2", top: null },
  { label: "Top cut", stage: "top-cut", top: null },
  ...TOP_CUTOFFS.map((n) => ({
    label: `Top ${n}`,
    stage: "all" as const,
    top: n,
  })),
];

/**
 * Placement: any, day 2, top cut, or the top so many at each event. Pick
 * from the list, or type a number ("16" or "Top 16").
 */
function PlacementInput({
  stage,
  top,
  onChange,
}: {
  stage: Stage;
  top: number | null;
  onChange: (stage: Stage, top: number | null) => void;
}) {
  const listId = useId();
  const current = placementLabel(stage, top);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current);
  // Show the URL's value when it changes, such as on Back.
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    setText(current);
  }

  function apply(value: string) {
    const placement = readPlacement(value);
    setOpen(false);
    if (!placement) {
      setText(current);
      return;
    }
    setText(placementLabel(placement.stage, placement.top));
    if (placement.stage !== stage || placement.top !== top) {
      onChange(placement.stage, placement.top);
    }
  }

  return (
    <div
      className="relative flex items-center gap-1.5 text-sm"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={`${listId}-input`} className="text-neutral-600">
        Placement
      </label>
      <div className="flex items-center rounded-lg border border-neutral-300 bg-white">
        <input
          id={`${listId}-input`}
          type="text"
          autoComplete="off"
          placeholder="Any"
          aria-describedby={`${listId}-hint`}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(text);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => apply(text)}
          className="w-20 rounded-l-lg bg-transparent px-2 py-1.5 outline-none placeholder:text-neutral-500"
        />
        <span id={`${listId}-hint`} className="sr-only">
          Type a number for the top that many at each event, or open the list
        </span>
        <button
          type="button"
          aria-label="Placement options"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="rounded-r-lg px-1.5 py-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <span aria-hidden>▾</span>
        </button>
      </div>
      {open && (
        <ul
          id={listId}
          className="absolute top-full right-0 z-20 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {PLACEMENTS.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                aria-current={p.stage === stage && p.top === top}
                onClick={() => apply(p.label)}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 aria-[current=true]:font-semibold"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
