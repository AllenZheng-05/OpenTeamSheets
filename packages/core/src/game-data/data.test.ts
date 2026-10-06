import { describe, expect, it } from "vitest";
import { REGULATIONS } from "../regulation";
import {
  gameData,
  getRegulationDataStatus,
  regulationData,
  spriteStyle,
} from "./data";

const { types, typeChart, natures, species, moves, abilities, items } =
  gameData;
const ids = (records: { id: string }[]) => new Set(records.map((r) => r.id));
const typeIds = ids(types);
const speciesIds = ids(species);
const moveIds = ids(moves);
const abilityIds = ids(abilities);
const itemIds = ids(items);

/** The values in `values` that aren't in `known`, for readable failures. */
const missing = (values: (string | null)[], known: Set<string>) =>
  values.filter((value) => value !== null && !known.has(value));

describe("game data", () => {
  it.each([
    ["types", types],
    ["natures", natures],
    ["species", species],
    ["moves", moves],
    ["abilities", abilities],
    ["items", items],
  ])("%s have unique ids", (_, records) => {
    expect(ids(records).size).toBe(records.length);
  });

  it("has the 18 types and a full type chart", () => {
    expect(types).toHaveLength(18);
    expect(Object.keys(typeChart).sort()).toEqual([...typeIds].sort());
    for (const row of Object.values(typeChart)) {
      expect(Object.keys(row).sort()).toEqual([...typeIds].sort());
      for (const multiplier of Object.values(row)) {
        expect([0, 0.5, 1, 2]).toContain(multiplier);
      }
    }
  });

  it("has the 25 natures", () => {
    expect(natures).toHaveLength(25);
  });

  it("species refer to known types, abilities, species and items", () => {
    expect(
      missing(
        species.flatMap((s) => [s.type1, s.type2]),
        typeIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.flatMap((s) => [s.ability1, s.ability2, s.abilityHidden]),
        abilityIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.map((s) => s.baseSpeciesId),
        speciesIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.map((s) => s.requiredItemId),
        itemIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.map((s) => s.battleOnlyFromId),
        speciesIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.map((s) => s.requiredAbilityId),
        abilityIds,
      ),
    ).toEqual([]);
    expect(
      missing(
        species.map((s) => s.requiredMoveId),
        moveIds,
      ),
    ).toEqual([]);
  });

  it("battle-only forms change from a form that can be legal", () => {
    const battleOnly = new Set(
      species.filter((s) => s.battleOnlyFromId !== null).map((s) => s.id),
    );
    expect(
      species.filter(
        (s) =>
          s.battleOnlyFromId !== null && battleOnly.has(s.battleOnlyFromId),
      ),
    ).toEqual([]);
  });

  it("moves refer to known types", () => {
    expect(
      missing(
        moves.map((m) => m.typeId),
        typeIds,
      ),
    ).toEqual([]);
  });
});

describe.each(Object.entries(regulationData))("regulation %s", (_, data) => {
  const { legality, learnsets } = data!;

  it("only allows known species and items", () => {
    expect(missing(legality.species, speciesIds)).toEqual([]);
    expect(missing(legality.items, itemIds)).toEqual([]);
  });

  it("never allows forms that only exist mid-battle", () => {
    const battleOnly = species
      .filter((s) => s.battleOnlyFromId !== null)
      .map((s) => s.id);
    expect(legality.species.filter((id) => battleOnly.includes(id))).toEqual(
      [],
    );
  });

  it("has a learnset of known moves for each legal species", () => {
    expect(Object.keys(learnsets).sort()).toEqual([...legality.species].sort());
    expect(missing(Object.values(learnsets).flat(), moveIds)).toEqual([]);
  });
});

describe("getRegulationDataStatus", () => {
  it("is pending exactly for regulations without data", () => {
    for (const { id } of REGULATIONS) {
      expect(getRegulationDataStatus(id) === "pending").toBe(
        regulationData[id] === undefined,
      );
    }
  });
});

describe("spriteStyle", () => {
  it("prefers 3D renders when small and HOME renders when large", () => {
    expect(spriteStyle("incineroar", "small")).toEqual({
      normal: "dex",
      shiny: "dex",
    });
    expect(spriteStyle("incineroar", "large")).toEqual({
      normal: "home-centered",
      shiny: "home-centered",
    });
  });

  it("falls back to a style a newer form does have", () => {
    const style = spriteStyle("raichu-megax", "large");
    expect(style.normal).not.toBe("home-centered");
    expect(style.shiny).toBeNull();
  });
});
