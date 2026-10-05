"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { Regulation } from "@ots/core";
import { getPokemonDetails } from "@/app/search-actions";
import {
  BOX_MATCHES,
  EVENT_KINDS,
  TEAM_SORTS,
  filtersHref,
  SHEET_ERROR_FILTERS,
  type BoxMatch,
  type EventKind,
  type TeamSort,
  type Filters,
  type SheetErrorFilter,
} from "@/lib/search";
import type { SearchOption, SearchOptionsData } from "@/lib/search-options";
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
import { EditablePill } from "./editable-pill";
import { PlacementInput } from "./placement-input";
import { useSearchPending } from "./search-pending";
import { listFor, pillsOf, same, valueOf, type Pill } from "@/lib/search-pills";

let searchOptions: Promise<SearchOptionsData> | undefined;

/** The search bar's suggestions, fetched once per visit (and HTTP-cached). */
function loadSearchOptions(): Promise<SearchOptionsData> {
  searchOptions ??= fetch("/api/search-options").then((response) => {
    if (!response.ok) {
      searchOptions = undefined;
      throw new Error(`Search options: ${response.status}`);
    }
    return response.json() as Promise<SearchOptionsData>;
  });
  return searchOptions;
}

/** The id of the main search box, which "/" focuses. */
export const SEARCH_INPUT_ID = "team-search";

/**
 * The search bar. Typing suggests Pokémon, moves, items, abilities, types,
 * archetypes and players; "not" in front excludes, and "with" after a
 * Pokémon adds its moves, ability or item ("Charizard with Charizardite Y").
 * Each choice becomes a pill in the bar, which can be clicked to edit.
 * Below the bar sit sort, regulation and box; the Filters button shows
 * placement, official or online, event and sheet errors too, and its count
 * resets every filter. Searching updates the URL; the page renders the
 * results, so links can be shared and the back button works.
 */
export function TeamSearch({
  path,
  filters: applied,
  current,
  regulations,
  archetypes,
  names: serverNames,
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
  archetypes: SearchOption[];
  /** Names of what the filters already name, until the full list loads. */
  names: Record<string, string>;
  /** How many Pokémon are in the player's box. */
  boxCount: number;
  /** The player's box as URL text, put in the URL of box searches. */
  boxCode: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  // The page's shared search transition, so its results can fade while
  // the next ones load; a bar on its own keeps one of its own.
  const shared = useSearchPending();
  const [ownPending, ownStartTransition] = useTransition();
  const pending = shared?.pending ?? ownPending;
  const startTransition = shared?.startTransition ?? ownStartTransition;
  // Filters by result (placement, official or online, event, sheet errors)
  // matter less now that results are teams; they're tucked away unless set.
  const moreCount = [
    applied.stage !== "all" || applied.top !== null,
    applied.kind !== "all",
    applied.event !== null,
    applied.errors !== null,
  ].filter(Boolean).length;
  const [moreOpen, setMoreOpen] = useState(moreCount > 0);
  const moreId = useId();
  // Pokémon's moves and abilities, loaded when a query names one.
  const [details, setDetails] = useState<Record<string, PokemonDetails>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());

  // The full list of suggestions and events, loaded once from a cached
  // route rather than carried by every page.
  const [loaded, setLoaded] = useState<SearchOptionsData | null>(null);
  useEffect(() => {
    let current = true;
    void loadSearchOptions().then((data) => {
      if (current) setLoaded(data);
    });
    return () => {
      current = false;
    };
  }, []);
  const events = loaded?.events ?? [];

  const all = useMemo(
    () => [...(loaded?.options ?? []), ...archetypes],
    [loaded, archetypes],
  );
  const names = useMemo(
    () => new Map(all.map((o) => [`${o.kind}:${o.id}`, o.name])),
    [all],
  );
  const name: NameOf = (kind, id) =>
    names.get(`${kind}:${id}`) ?? serverNames[`${kind}:${id}`] ?? id;

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

  // How many filters are set, for the count on the Filters button.
  const panelCount = [
    filters.stage !== "all" || filters.top !== null,
    filters.regulation !== current,
    filters.event !== null,
    filters.errors !== null,
    filters.kind !== "all",
    filters.sort !== "used",
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
      sort: "used",
      box: null,
    });

  const select =
    "max-w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div role="search" className="space-y-2 text-left">
      <p className="text-xs text-neutral-500">
        Try “Incineroar with Fake Out and Intimidate”, “Charizard with
        Charizardite Y” or “not Sneasler”.
      </p>
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
        end={
          <button
            type="button"
            onClick={search}
            className={`m-1 shrink-0 rounded-lg px-3 text-sm font-medium ${
              changed
                ? "bg-neutral-900 text-white hover:bg-neutral-700"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            Search
          </button>
        }
      />
      {/* Sort, regulation and box are always here; Filters shows the rest. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="search-sort">
            Sort
          </label>
          <select
            id="search-sort"
            className={select}
            value={filters.sort}
            onChange={(e) =>
              go({ ...filters, sort: e.target.value as TeamSort })
            }
          >
            {TEAM_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                Sort: {s.label}
              </option>
            ))}
          </select>
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
          {/* The Filters button: shows the rest of the filters, and its count
            sits inside its right end as its own button (buttons can't nest). */}
          <div className="relative ml-auto inline-flex">
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls={moreOpen ? moreId : undefined}
              onClick={() => setMoreOpen((open) => !open)}
              className={`flex items-center py-1.5 gap-1.5 rounded-lg pl-3 text-sm font-medium text-neutral-700 hover:bg-neutral-100 aria-expanded:bg-neutral-100 ${panelCount > 0 ? "pr-9" : "pr-3"}`}
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
        </div>
        {moreOpen && (
          <div id={moreId} className="flex flex-wrap items-center gap-2">
            <PlacementInput
              stage={filters.stage}
              top={filters.top}
              onChange={(stage, top) => go({ ...filters, stage, top })}
            />
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
              className={`${select} w-full truncate sm:w-auto sm:max-w-72`}
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
                  errors: (e.target.value || null) as SheetErrorFilter | null,
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
        )}
      </div>
      <p aria-live="polite" className="text-xs text-neutral-500">
        {pending
          ? "Searching…"
          : changed
            ? "Press Enter or Search to see results for these filters."
            : ""}
      </p>
    </div>
  );
}
