"use client";

import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { getCurrentRegulation, type Regulation } from "@ots/core";
import type { TeamSet } from "@ots/core/teams";
import {
  addDraft,
  createDraft,
  fillSlots,
  moveDraft,
  noDrafts,
  removeDraft,
  moveSlot,
  updateDraft,
  updateSet,
  type Draft,
  type Drafts,
} from "./builder";

/**
 * localStorage, or nothing where it's blocked (some private windows) or
 * full: the builder then keeps its teams in memory for the visit.
 */
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Kept in memory only.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Nothing saved to remove.
    }
  },
};

interface BuilderState extends Drafts {
  /** Starts an empty team at the top of the list; returns its id. */
  newDraft: () => string;
  /**
   * Adds a team as a new draft, from a tournament team (its id is the
   * source) or a paste (no source); returns its id.
   */
  openTeam: (team: {
    name: string;
    regulation: Regulation;
    sets: TeamSet[];
    sourceTeamId: string | null;
  }) => string;
  /** Replaces a team's Pokémon, as Import / Export's Save does. */
  replaceSets: (id: string, sets: TeamSet[]) => void;
  deleteDraft: (id: string) => void;
  /** Moves a team to a place in the list (0 is the top). */
  moveDraft: (id: string, to: number) => void;
  renameDraft: (id: string, name: string) => void;
  setRegulation: (id: string, regulation: Regulation) => void;
  updateSet: (id: string, slot: number, change: Partial<TeamSet>) => void;
  /** Moves a slot's set to another slot, shifting those between. */
  moveSlot: (id: string, from: number, to: number) => void;
}

/** Bump with a migration when the saved shape changes. */
const VERSION = 2;

export const useBuilder = create<BuilderState>()(
  persist(
    (set) => {
      const add = (draft: Draft) => {
        set((s) => addDraft(s, draft));
        return draft.id;
      };
      return {
        ...noDrafts(),
        newDraft: () => add(createDraft(getCurrentRegulation())),
        openTeam: ({ name, regulation, sets, sourceTeamId }) =>
          add(createDraft(regulation, { name, sets, sourceTeamId })),
        replaceSets: (id, sets) =>
          set((s) => updateDraft(s, id, () => ({ sets: fillSlots(sets) }))),
        deleteDraft: (id) => set((s) => removeDraft(s, id)),
        moveDraft: (id, to) => set((s) => moveDraft(s, id, to)),
        renameDraft: (id, name) =>
          set((s) => updateDraft(s, id, () => ({ name }))),
        setRegulation: (id, regulation) =>
          set((s) => updateDraft(s, id, () => ({ regulation }))),
        updateSet: (id, slot, change) =>
          set((s) => updateSet(s, id, slot, change)),
        moveSlot: (id, from, to) => set((s) => moveSlot(s, id, from, to)),
      };
    },
    {
      name: "ots-builder",
      version: VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: ({ drafts, order }) => ({ drafts, order }),
      migrate: (saved, version) => migrate(saved, version),
      // Ids in the order without a draft, or drafts missing from it (edited
      // by hand), are put right.
      merge: (saved, current) => {
        const state = { ...current, ...(saved as Partial<Drafts>) };
        const order = state.order.filter((id) => state.drafts[id]);
        for (const id of Object.keys(state.drafts)) {
          if (!order.includes(id)) order.push(id);
        }
        return { ...state, order };
      },
    },
  ),
);

/**
 * Saved drafts from earlier versions, in today's shape. Version 1 had a
 * current draft and no order: its drafts are listed newest first.
 */
export function migrate(saved: unknown, version: number): Drafts {
  const old = (saved ?? {}) as Partial<Drafts>;
  const drafts = old.drafts ?? {};
  if (version < 2) {
    const order = Object.values(drafts)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => d.id);
    return { drafts, order };
  }
  return { drafts, order: old.order ?? Object.keys(drafts) };
}

/** A draft by id, or undefined if there's none (a stale link). */
export const useDraft = (id: string) => useBuilder((s) => s.drafts[id]);
