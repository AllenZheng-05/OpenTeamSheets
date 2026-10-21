import type { Regulation } from "@ots/core";
import {
  emptySet,
  exportShowdown,
  getSpecies,
  MAX_TOTAL_STAT_POINTS,
  parseTeamText,
  validateTeam,
  type Problem,
  type StatTable,
  type TeamSet,
  type ValidationResult,
} from "@ots/core/teams";

// The builder's teams, kept in the browser until accounts (#27) move them
// into a profile. These are the pure operations on them; builder-store.ts
// keeps them in a Zustand store saved to localStorage.

/** Pokémon on a team. */
export const SLOTS = 6;

export interface Draft {
  id: string;
  name: string;
  regulation: Regulation;
  /** Always SLOTS long; an empty slot has no species. */
  sets: TeamSet[];
  /** ISO time of the last change. */
  updatedAt: string;
  /** The tournament team it was opened from, if any. */
  sourceTeamId: string | null;
}

export interface Drafts {
  drafts: Record<string, Draft>;
  /** Draft ids in the player's order, as the team list shows them. */
  order: string[];
}

export const DEFAULT_NAME = "Untitled team";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const now = () => new Date().toISOString();

/** Pads or trims sets to SLOTS, filling with empty slots. */
export function fillSlots(sets: TeamSet[]): TeamSet[] {
  return Array.from({ length: SLOTS }, (_, i) => sets[i] ?? emptySet());
}

export function createDraft(
  regulation: Regulation,
  from?: { name: string; sets: TeamSet[]; sourceTeamId: string | null },
): Draft {
  return {
    id: newId(),
    name: from?.name ?? DEFAULT_NAME,
    regulation,
    sets: fillSlots(from?.sets ?? []),
    updatedAt: now(),
    sourceTeamId: from?.sourceTeamId ?? null,
  };
}

export const noDrafts = (): Drafts => ({ drafts: {}, order: [] });

/** Adds a draft at the top of the list. */
export function addDraft(state: Drafts, draft: Draft): Drafts {
  return {
    drafts: { ...state.drafts, [draft.id]: draft },
    order: [draft.id, ...state.order],
  };
}

/** The drafts in the player's order. */
export function orderedDrafts(state: Drafts): Draft[] {
  return state.order.flatMap((id) => state.drafts[id] ?? []);
}

/** Changes one draft, marking it updated. */
export function updateDraft(
  state: Drafts,
  id: string,
  change: (draft: Draft) => Partial<Omit<Draft, "id">>,
): Drafts {
  const draft = state.drafts[id];
  if (!draft) return state;
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [id]: { ...draft, ...change(draft), updatedAt: now() },
    },
  };
}

/** Changes one slot's set. */
export function updateSet(
  state: Drafts,
  id: string,
  slot: number,
  change: Partial<TeamSet>,
): Drafts {
  return updateDraft(state, id, (draft) => ({
    sets: draft.sets.map((set, i) =>
      i === slot ? { ...set, ...change } : set,
    ),
  }));
}

/**
 * Moves a slot's set to another slot, shifting those between: dragging
 * slot 1 onto slot 4 puts it 4th and the others up one. A move of one
 * swaps neighbours.
 */
export function moveSlot(
  state: Drafts,
  id: string,
  from: number,
  to: number,
): Drafts {
  if (from === to || from < 0 || to < 0 || from >= SLOTS || to >= SLOTS) {
    return state;
  }
  return updateDraft(state, id, (draft) => {
    const sets = [...draft.sets];
    const [moved] = sets.splice(from, 1);
    sets.splice(to, 0, moved!);
    return { sets };
  });
}

export function removeDraft(state: Drafts, id: string): Drafts {
  return {
    drafts: Object.fromEntries(
      Object.entries(state.drafts).filter(([key]) => key !== id),
    ),
    order: state.order.filter((key) => key !== id),
  };
}

/** Moves a draft to a place in the list (0 is the top). */
export function moveDraft(state: Drafts, id: string, to: number): Drafts {
  const from = state.order.indexOf(id);
  if (from < 0) return state;
  const target = Math.max(0, Math.min(state.order.length - 1, to));
  if (target === from) return state;
  const order = state.order.filter((key) => key !== id);
  order.splice(target, 0, id);
  return { ...state, order };
}

/** Whether a slot has a Pokémon in it. */
export const filled = (set: TeamSet) => set.speciesId !== null;

/** Stat points spent across all stats. */
export const statTotal = (points: StatTable | null) =>
  points ? Object.values(points).reduce((sum, n) => sum + n, 0) : 0;

/**
 * Stat points with one stat set, starting unknown points at zero. The
 * stat stays within 0 and `max`, and within what's left of `totalMax`
 * after the other stats, so the total can never go over.
 */
export function withStatPoints(
  points: StatTable | null,
  stat: keyof StatTable,
  value: number,
  max: number,
  totalMax: number,
): StatTable {
  const base = points ?? { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const others = statTotal(base) - base[stat];
  const room = Math.max(0, Math.min(max, totalMax - others));
  const clamped = Math.max(0, Math.min(room, Math.round(value) || 0));
  return { ...base, [stat]: clamped };
}

/** A team read from pasted text, ready to fill a draft's slots. */
export interface PastedTeam {
  sets: TeamSet[];
  /** Lines that couldn't be read, and a seventh Pokémon or more. */
  problems: Problem[];
}

/**
 * Reads a pasted team (a Showdown paste or RK9 teamlist) for the builder.
 * A Mega listed by its own name ("Charizard-Mega-Y") becomes its base form
 * holding its stone, as picking it from the list does. Only six fit.
 */
export function readPastedTeam(text: string): PastedTeam {
  const parsed = parseTeamText(text);
  const sets = parsed.team.sets.map((set): TeamSet => {
    const species = set.speciesId ? getSpecies(set.speciesId) : undefined;
    if (!species?.battleOnlyFromId || !species.requiredItemId) return set;
    return {
      ...set,
      speciesId: species.battleOnlyFromId,
      itemId: set.itemId ?? species.requiredItemId,
    };
  });
  // The reader reports a seventh Pokémon and beyond; they're left out.
  return { sets: sets.slice(0, SLOTS), problems: parsed.errors };
}

/** A draft as a Showdown paste, leaving out empty slots. */
export const draftPaste = (draft: Draft) =>
  exportShowdown({ sets: draft.sets.filter(filled) });

/** Teams this small are legal, but not recommended. */
const SMALL_TEAM = 5;

/**
 * The team checked as finished, as Showdown's Validate does: every problem
 * the live marks show, plus what a finished team needs (at least four
 * Pokémon; an ability, nature and move each). Empty slots are left out,
 * since a team needn't fill all six, and problems keep their slot numbers.
 * Warnings, which are legal but not recommended: stat points left unspent,
 * and a team of four or five.
 */
export function checkTeam(draft: Draft): ValidationResult {
  const kept = draft.sets.flatMap((set, i) =>
    filled(set) ? [{ set, i }] : [],
  );
  const result = validateTeam(
    { sets: kept.map((k) => k.set) },
    draft.regulation,
    { complete: true },
  );
  const slotOf = (slot: number | null) =>
    slot === null ? null : kept[slot - 1]!.i + 1;
  const warnings = result.warnings.map((p) => ({ ...p, slot: slotOf(p.slot) }));
  for (const { set, i } of kept) {
    const left = MAX_TOTAL_STAT_POINTS - statTotal(set.statPoints);
    if (left > 0) {
      warnings.push({
        slot: i + 1,
        message: `${left} of ${MAX_TOTAL_STAT_POINTS} stat points are unspent`,
      });
    }
  }
  if (kept.length >= 4 && kept.length <= SMALL_TEAM) {
    warnings.push({
      slot: null,
      message: `A team of ${kept.length} Pokémon is legal in Pokémon Champions, but not recommended`,
    });
  }
  return {
    errors: result.errors.map((p) => ({ ...p, slot: slotOf(p.slot) })),
    warnings,
  };
}
