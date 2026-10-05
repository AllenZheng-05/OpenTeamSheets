import type { Condition } from "./search";
import type { OptionKind, SearchOption } from "./search-options";

// What the search box makes of typed text. Plain text suggests Pokémon,
// moves, items, abilities, types, archetypes and players; "not" in front
// excludes; "with" after a Pokémon adds details on that same Pokémon:
//
//   Incineroar                        a team with an Incineroar
//   not Sneasler                      a team without one
//   Charizard with Charizardite Y     a Charizard holding Charizardite Y
//   Incineroar with Fake Out and Intimidate
//   not Incineroar with Knock Off     no Incineroar that knows Knock Off

export type Mode = "has" | "not";

/** What picking a suggestion adds. */
export type Choice =
  | { mode: Mode; condition: Condition }
  | { mode: Mode; archetype: string }
  | { mode: Mode; player: string };

export interface Suggestion {
  key: string;
  /** As listed: "Not Charizard with Charizardite Y". */
  name: string;
  /** The text that searches for it, which Tab fills in: "not Charizard with Charizardite Y". */
  text: string;
  group: string;
  choice: Choice;
}

export interface ParsedQuery {
  exclude: boolean;
  /** The text before "with" (or all of it). */
  subject: string;
  /** The details after "with", the last one possibly half typed; null without "with". */
  details: string[] | null;
}

/** Lowercase without accents, so "flabebe" finds Flabébé. */
export const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function parseQuery(text: string): ParsedQuery {
  let rest = text.trimStart();
  // "not" alone counts, so suggestions can follow it straight away.
  const not = rest.match(/^(?:not(?:\s+|$)|-\s*)/i);
  if (not) rest = rest.slice(not[0].length);
  const withParts = rest.match(/^(.*?)\s+with(?:\s+(.*))?$/i);
  if (!withParts)
    return { exclude: !!not, subject: rest.trim(), details: null };
  return {
    exclude: !!not,
    subject: withParts[1]!.trim(),
    details: (withParts[2] ?? "").split(/\s*(?:,|&|\band\b)\s*/i),
  };
}

/**
 * Options whose names match typed text: names starting with it first, then
 * a word starting with it, then (from two letters) containing it. The
 * result keeps the options' order between groups.
 */
export function matchOptions<T extends { name: string; group?: string }>(
  options: T[],
  query: string,
  limit = 30,
): T[] {
  const q = fold(query);
  if (!q) return [];
  const ranked: { option: T; rank: number; index: number }[] = [];
  options.forEach((option, index) => {
    const name = fold(option.name);
    const rank = name.startsWith(q)
      ? 0
      : name.split(/[\s-]+/).some((word) => word.startsWith(q))
        ? 1
        : q.length > 1 && name.includes(q)
          ? 2
          : -1;
    if (rank >= 0) ranked.push({ option, rank, index });
  });
  const groups = [...new Set(options.map((o) => o.group))];
  return ranked
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .sort(
      (a, b) =>
        groups.indexOf(a.option.group) - groups.indexOf(b.option.group) ||
        a.rank - b.rank ||
        a.index - b.index,
    )
    .map((r) => r.option);
}

export const GROUPS: Record<OptionKind | "player", string> = {
  pokemon: "Pokémon",
  move: "Moves",
  ability: "Abilities",
  item: "Items",
  type: "Types",
  archetype: "Archetypes",
  player: "Players",
};

/** Looks up an option's name by kind and id. */
export type NameOf = (kind: OptionKind, id: string) => string;

/** "Charizard with Charizardite Y", "Knock Off", "Fire type". */
export function conditionLabel(condition: Condition, name: NameOf): string {
  const details = [
    ...(condition.moves ?? []).map((m) => name("move", m)),
    condition.ability && name("ability", condition.ability),
    condition.item && name("item", condition.item),
  ].filter((d): d is string => !!d);
  const type = condition.type && `${name("type", condition.type)} type`;
  if (condition.pokemon) {
    const pokemon = name("pokemon", condition.pokemon);
    return details.length
      ? `${pokemon} with ${details.join(" and ")}`
      : pokemon;
  }
  return [...details, type].filter(Boolean).join(" and ");
}

/** "not" in front of a label for an exclusion. */
export const withMode = (mode: Mode, label: string) =>
  mode === "not" ? `Not ${label}` : label;

const conditionFor = (kind: OptionKind, id: string): Condition | null => {
  switch (kind) {
    case "pokemon":
      return { pokemon: id };
    case "move":
      return { moves: [id] };
    case "ability":
      return { ability: id };
    case "item":
      return { item: id };
    case "type":
      return { type: id };
    default:
      return null;
  }
};

/** A Pokémon's possible moves and abilities, once loaded. */
export type PokemonDetails = { moves: Set<string>; abilities: Set<string> };

/** The Pokémon a "… with" query is about, if its name matches one. */
export function queryPokemon(
  subject: string,
  options: SearchOption[],
): SearchOption | undefined {
  const pokemon = options.filter((o) => o.kind === "pokemon");
  const q = fold(subject);
  if (!q) return undefined;
  return (
    pokemon.find((o) => fold(o.name) === q) ??
    matchOptions(pokemon, subject, 1)[0]
  );
}

/**
 * The Pokémon whose full name a query names, also while "with" after it is
 * half typed ("Incineroar w"), so its combinations stay listed.
 */
export function fullPokemon(
  text: string,
  options: SearchOption[],
): SearchOption | undefined {
  const query = parseQuery(text);
  const subject =
    query.details === null
      ? query.subject.replace(/\s+w(?:i(?:t)?)?$/i, "")
      : query.subject;
  const named = (name: string) =>
    options.find((o) => o.kind === "pokemon" && fold(o.name) === fold(name));
  return query.details === null
    ? (named(query.subject) ?? named(subject))
    : named(subject);
}

/** A condition with its label, and the text that would search for it. */
function conditionSuggestion(
  mode: Mode,
  condition: Condition,
  group: string,
  name: NameOf,
): Suggestion {
  const label = conditionLabel(condition, name);
  const text = condition.type ? name("type", condition.type) : label;
  return {
    key: `${mode}:${JSON.stringify(condition)}`,
    name: withMode(mode, label),
    text: mode === "not" ? `not ${text}` : text,
    group,
    choice: { mode, condition },
  };
}

/** A condition with one more detail, or null if it can't take it. */
function addDetail(c: Condition, o: SearchOption): Condition | null {
  if (o.kind === "move") {
    const moves = c.moves ?? [];
    if (moves.includes(o.id) || moves.length >= 4) return null;
    return { ...c, moves: [...moves, o.id] };
  }
  if (o.kind === "ability") return c.ability ? null : { ...c, ability: o.id };
  if (o.kind === "item") return c.item ? null : { ...c, item: o.id };
  return null;
}

/**
 * The moves, abilities and items a Pokémon can have, in that order and by
 * name. Until its moves and abilities are loaded, only items are known.
 */
function detailOptions(
  options: SearchOption[],
  known: PokemonDetails | undefined,
): SearchOption[] {
  const of = (kind: OptionKind, keep: (id: string) => boolean) =>
    options.filter((o) => o.kind === kind && keep(o.id));
  return [
    ...of("move", (id) => known?.moves.has(id) ?? false),
    ...of("ability", (id) => known?.abilities.has(id) ?? false),
    ...of("item", () => true),
  ];
}

/** Suggestions for typed text; see the examples at the top. */
export function suggest(
  text: string,
  options: SearchOption[],
  detailsOf: (pokemonId: string) => PokemonDetails | undefined,
): Suggestion[] {
  const query = parseQuery(text);
  const mode: Mode = query.exclude ? "not" : "has";
  const names = new Map(options.map((o) => [`${o.kind}:${o.id}`, o.name]));
  const name: NameOf = (kind, id) => names.get(`${kind}:${id}`) ?? id;
  const prefix = mode === "not" ? "not " : "";

  if (query.details === null) {
    const grouped = options.map((o) => ({ ...o, group: GROUPS[o.kind] }));
    const toSuggestion = (o: (typeof grouped)[number]): Suggestion => {
      const condition = conditionFor(o.kind, o.id);
      return condition
        ? conditionSuggestion(mode, condition, o.group, name)
        : {
            key: `${mode}:archetype:${o.id}`,
            name: withMode(mode, o.name),
            text: `${prefix}${o.name}`,
            group: o.group,
            choice: { mode, archetype: o.id },
          };
    };
    // "not" with nothing after it yet: what can be excluded, in the usual
    // order, as a start.
    if (!query.subject) {
      return query.exclude ? grouped.slice(0, 30).map(toSuggestion) : [];
    }
    const matches = matchOptions(grouped, query.subject);
    const player: Suggestion = {
      key: `${mode}:player:${query.subject}`,
      name:
        mode === "not"
          ? `Not players whose name contains “${query.subject}”`
          : `Player name contains “${query.subject}”`,
      text: `${prefix}${query.subject}`,
      group: GROUPS.player,
      choice: { mode, player: query.subject },
    };

    // A Pokémon's full name (with "with" perhaps half typed after it): it,
    // and other Pokémon matching, then the combinations it can be searched
    // with.
    const exact = fullPokemon(text, options);
    if (exact) {
      const known = detailsOf(exact.id);
      const combinations = detailOptions(options, known).flatMap((o) => {
        const condition = addDetail({ pokemon: exact.id }, o);
        return condition
          ? [conditionSuggestion(mode, condition, GROUPS[o.kind], name)]
          : [];
      });
      const pokemon = matchOptions(
        options
          .filter((o) => o.kind === "pokemon")
          .map((o) => ({ ...o, group: GROUPS.pokemon })),
        exact.name,
      );
      return [...pokemon.map(toSuggestion), ...combinations, player];
    }
    return [...matches.map(toSuggestion), player];
  }

  // "Pokémon with …": details on that one Pokémon.
  const pokemon = queryPokemon(query.subject, options);
  if (!pokemon) return [];
  const candidates = detailOptions(options, detailsOf(pokemon.id));

  // Details already typed in full; the last is still being typed.
  let base: Condition | null = { pokemon: pokemon.id };
  for (const detail of query.details.slice(0, -1)) {
    const match = candidates.find((o) => fold(o.name) === fold(detail));
    base = match && base ? addDetail(base, match) : null;
    if (!base) return [];
  }
  const grouped = candidates.map((o) => ({ ...o, group: GROUPS[o.kind] }));
  // Every detail a condition can still take, as "… and …" suggestions.
  const extensions = (c: Condition) =>
    grouped.flatMap((o) => {
      const next = addDetail(c, o);
      return next ? [conditionSuggestion(mode, next, o.group, name)] : [];
    });

  const last = query.details.at(-1) ?? "";
  // Nothing typed after "with" (or "and") yet: everything it can take.
  if (!fold(last)) return extensions(base);
  // The last detail typed in full (with "and" perhaps half typed after
  // it): the combination itself, then what can be added to it.
  const named = (text: string) =>
    candidates.find((o) => fold(o.name) === fold(text));
  const full = named(last) ?? named(last.replace(/\s+an?$/i, ""));
  const complete = full && addDetail(base, full);
  if (complete) {
    return [
      conditionSuggestion(mode, complete, `${pokemon.name} with…`, name),
      ...extensions(complete),
    ];
  }
  // Otherwise the details matching what's typed.
  return matchOptions(grouped, last).flatMap((o) => {
    const next = addDetail(base!, o);
    return next ? [conditionSuggestion(mode, next, o.group, name)] : [];
  });
}

/** The text that searches for a choice, for editing it as a pill. */
export function choiceText(choice: Choice, name: NameOf): string {
  const prefix = choice.mode === "not" ? "not " : "";
  if ("condition" in choice) {
    const c = choice.condition;
    return prefix + (c.type ? name("type", c.type) : conditionLabel(c, name));
  }
  if ("archetype" in choice)
    return prefix + name("archetype", choice.archetype);
  return prefix + choice.player;
}

/**
 * What edited pill text means: the suggestion it names exactly, or null if
 * it names none. Text names a player only if the pill was one, so a typo
 * in a Pokémon pill isn't taken as a player's name.
 */
export function readChoice(
  text: string,
  options: SearchOption[],
  detailsOf: (pokemonId: string) => PokemonDetails | undefined,
  allowPlayer: boolean,
): Choice | null {
  if (!fold(text)) return null;
  const exact = suggest(text, options, detailsOf).find(
    (s) =>
      fold(s.text) === fold(text) && (allowPlayer || !("player" in s.choice)),
  );
  return exact?.choice ?? null;
}
