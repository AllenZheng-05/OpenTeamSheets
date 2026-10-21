import { describe, expect, it } from "vitest";
import { emptySet } from "@ots/core/teams";
import {
  addDraft,
  checkTeam,
  createDraft,
  DEFAULT_NAME,
  draftPaste,
  fillSlots,
  moveDraft,
  noDrafts,
  orderedDrafts,
  readPastedTeam,
  removeDraft,
  SLOTS,
  statTotal,
  moveSlot,
  updateSet,
  withStatPoints,
  type Drafts,
} from "./builder";

const incineroar = { ...emptySet(), speciesId: "incineroar" };

/** Three drafts, listed a, b, c. */
function three(): { state: Drafts; ids: string[] } {
  let state = noDrafts();
  const ids: string[] = [];
  for (const name of ["c", "b", "a"]) {
    const draft = { ...createDraft("M-C"), name };
    state = addDraft(state, draft);
    ids.unshift(draft.id);
  }
  return { state, ids };
}

describe("drafts", () => {
  it("start empty, six slots each", () => {
    const draft = createDraft("M-C");
    expect(draft.name).toBe(DEFAULT_NAME);
    expect(draft.sets).toHaveLength(SLOTS);
    expect(draft.sets.every((s) => s.speciesId === null)).toBe(true);
  });

  it("add new ones at the top", () => {
    const { state } = three();
    expect(orderedDrafts(state).map((d) => d.name)).toEqual(["a", "b", "c"]);
  });

  it("open a team as a draft with its sets", () => {
    const draft = createDraft("M-B", {
      name: "Wolfe · 1st",
      sets: [incineroar],
      sourceTeamId: "team-1",
    });
    expect(draft).toMatchObject({
      name: "Wolfe · 1st",
      regulation: "M-B",
      sourceTeamId: "team-1",
    });
    expect(draft.sets[0]!.speciesId).toBe("incineroar");
    expect(draft.sets).toHaveLength(SLOTS);
  });

  it("move within the list", () => {
    const { state, ids } = three();
    const names = (s: Drafts) => orderedDrafts(s).map((d) => d.name);
    expect(names(moveDraft(state, ids[0]!, 2))).toEqual(["b", "c", "a"]);
    expect(names(moveDraft(state, ids[2]!, 0))).toEqual(["c", "a", "b"]);
    expect(names(moveDraft(state, ids[1]!, 99))).toEqual(["a", "c", "b"]);
    expect(moveDraft(state, ids[0]!, 0)).toBe(state);
    expect(moveDraft(state, "gone", 1)).toBe(state);
  });

  it("are removed from the list and the drafts", () => {
    const { state, ids } = three();
    const removed = removeDraft(state, ids[1]!);
    expect(orderedDrafts(removed).map((d) => d.name)).toEqual(["a", "c"]);
    expect(removed.drafts[ids[1]!]).toBeUndefined();
  });

  it("edit one slot", () => {
    const { state, ids } = three();
    const next = updateSet(state, ids[0]!, 2, { speciesId: "sinistcha" });
    expect(next.drafts[ids[0]!]!.sets[2]!.speciesId).toBe("sinistcha");
    expect(state.drafts[ids[0]!]!.sets[2]!.speciesId).toBeNull();
  });

  it("move a slot, shifting those between, ignoring moves off the ends", () => {
    const { state: start, ids } = three();
    let state = start;
    ["a", "b", "c", "d"].forEach((speciesId, i) => {
      state = updateSet(state, ids[0]!, i, { speciesId });
    });
    const species = (s: Drafts) =>
      s.drafts[ids[0]!]!.sets.slice(0, 4).map((set) => set.speciesId);
    expect(species(moveSlot(state, ids[0]!, 0, 3))).toEqual([
      "b",
      "c",
      "d",
      "a",
    ]);
    expect(species(moveSlot(state, ids[0]!, 3, 1))).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
    expect(species(moveSlot(state, ids[0]!, 1, 2))).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
    expect(moveSlot(state, ids[0]!, 0, -1)).toBe(state);
    expect(moveSlot(state, ids[0]!, 5, 6)).toBe(state);
  });
});

describe("fillSlots", () => {
  it("pads to six and trims extras", () => {
    expect(fillSlots([incineroar])).toHaveLength(SLOTS);
    expect(fillSlots(Array(8).fill(incineroar))).toHaveLength(SLOTS);
  });
});

describe("withStatPoints", () => {
  it("sets one stat, starting unknown points at zero", () => {
    expect(withStatPoints(null, "spe", 32, 32, 66)).toEqual({
      hp: 0,
      atk: 0,
      def: 0,
      spa: 0,
      spd: 0,
      spe: 32,
    });
  });

  it("keeps a stat between 0 and its most", () => {
    const points = withStatPoints(null, "hp", 40, 32, 66);
    expect(points.hp).toBe(32);
    expect(withStatPoints(points, "hp", -3, 32, 66).hp).toBe(0);
    expect(withStatPoints(points, "hp", Number.NaN, 32, 66).hp).toBe(0);
  });

  it("stops the total at the most, never going over", () => {
    let points = withStatPoints(null, "hp", 32, 32, 66);
    points = withStatPoints(points, "spe", 32, 32, 66);
    expect(statTotal(points)).toBe(64);
    points = withStatPoints(points, "atk", 10, 32, 66);
    expect(points.atk).toBe(2);
    expect(statTotal(points)).toBe(66);
    // Lowering one makes room again.
    points = withStatPoints(points, "hp", 20, 32, 66);
    expect(withStatPoints(points, "atk", 20, 32, 66).atk).toBe(14);
  });
});

describe("checkTeam", () => {
  const finished = (speciesId: string, abilityId: string) => ({
    ...emptySet(),
    speciesId,
    abilityId,
    natureId: "adamant",
    moveIds: ["protect"],
    statPoints: { hp: 32, atk: 32, def: 2, spa: 0, spd: 0, spe: 0 },
  });
  const team = (sets: ReturnType<typeof emptySet>[]) => ({
    ...createDraft("M-C"),
    sets: fillSlots(sets),
  });

  it("finds a finished team of four ready, with a warning", () => {
    const report = checkTeam(
      team([
        finished("incineroar", "intimidate"),
        finished("garchomp", "roughskin"),
        finished("charizard", "blaze"),
        finished("kingambit", "defiant"),
      ]),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((w) => w.message)).toEqual([
      "A team of 4 Pokémon is legal in Pokémon Champions, but not recommended",
    ]);
  });

  it("reports what a finished team needs, by the slots' own numbers", () => {
    const report = checkTeam(
      team([
        finished("incineroar", "intimidate"),
        emptySet(),
        emptySet(),
        { ...finished("garchomp", "roughskin"), natureId: null },
      ]),
    );
    expect(report.errors.map((e) => [e.slot, e.message])).toEqual([
      [null, "A team needs at least 4 Pokémon"],
      [4, "Choose a nature"],
    ]);
  });

  it("warns of stat points left unspent", () => {
    const report = checkTeam(
      team([
        finished("incineroar", "intimidate"),
        {
          ...finished("garchomp", "roughskin"),
          statPoints: { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 24 },
        },
        { ...finished("charizard", "blaze"), statPoints: null },
        finished("kingambit", "defiant"),
        finished("sylveon", "pixilate"),
        finished("dragapult", "clearbody"),
      ]),
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings.map((w) => [w.slot, w.message])).toEqual([
      [2, "10 of 66 stat points are unspent"],
      [3, "66 of 66 stat points are unspent"],
    ]);
  });

  it("doesn't report empty slots", () => {
    const report = checkTeam(team([finished("incineroar", "intimidate")]));
    expect(report.errors.some((e) => e.message === "Choose a Pokémon")).toBe(
      false,
    );
  });
});

describe("readPastedTeam", () => {
  const lines = (...text: string[]) => text.join("\n");

  it("makes a Mega its base form holding its stone", () => {
    const { sets } = readPastedTeam(
      lines("Charizard-Mega-Y", "Ability: Blaze", "- Heat Wave"),
    );
    expect(sets[0]).toMatchObject({
      speciesId: "charizard",
      itemId: "charizarditey",
    });
  });

  it("keeps the first six Pokémon", () => {
    const incineroar = lines("Incineroar", "Ability: Intimidate", "- Protect");
    const { sets, problems } = readPastedTeam(
      Array.from({ length: 7 }, () => incineroar).join("\n\n"),
    );
    expect(sets).toHaveLength(SLOTS);
    expect(problems.map((p) => p.message)).toEqual([
      "A team has at most six Pokémon",
    ]);
  });

  it("reports lines it can't read", () => {
    const { sets, problems } = readPastedTeam(
      lines("Incineroar", "Ability: Intimidate", "Mood: grumpy"),
    );
    expect(sets).toHaveLength(1);
    expect(problems.length).toBeGreaterThan(0);
  });
});

describe("draftPaste", () => {
  it("writes the filled slots as a paste that reads back the same", () => {
    const pasted = readPastedTeam(
      [
        "Incineroar @ Sitrus Berry",
        "Ability: Intimidate",
        "EVs: 32 HP / 2 Atk / 32 SpD",
        "Careful Nature",
        "- Fake Out",
        "- Parting Shot",
      ].join("\n"),
    ).sets;
    const draft = {
      ...createDraft("M-C"),
      sets: fillSlots([emptySet(), ...pasted]),
    };
    const paste = draftPaste(draft);
    expect(paste.startsWith("Incineroar @ Sitrus Berry")).toBe(true);
    expect(readPastedTeam(paste).sets).toEqual(pasted);
  });
});
