import { describe, expect, it } from "vitest";
import {
  choiceText,
  conditionLabel,
  matchOptions,
  parseQuery,
  readChoice,
  suggest,
  type Choice,
  type PokemonDetails,
} from "./search-query";
import type { SearchOption } from "./search-options";

const options: SearchOption[] = [
  { kind: "pokemon", id: "charizard", name: "Charizard" },
  { kind: "pokemon", id: "charizardmegay", name: "Charizard-Mega-Y" },
  { kind: "pokemon", id: "incineroar", name: "Incineroar" },
  { kind: "move", id: "fakeout", name: "Fake Out" },
  { kind: "move", id: "knockoff", name: "Knock Off" },
  { kind: "move", id: "heatwave", name: "Heat Wave" },
  { kind: "ability", id: "intimidate", name: "Intimidate" },
  { kind: "ability", id: "drought", name: "Drought" },
  { kind: "item", id: "charizarditex", name: "Charizardite X" },
  { kind: "item", id: "charizarditey", name: "Charizardite Y" },
  { kind: "item", id: "sitrusberry", name: "Sitrus Berry" },
  { kind: "type", id: "fire", name: "Fire" },
  { kind: "archetype", id: "sun", name: "Sun" },
];

const details: Record<string, PokemonDetails> = {
  incineroar: {
    moves: new Set(["fakeout", "knockoff", "heatwave"]),
    abilities: new Set(["intimidate"]),
  },
  charizard: {
    moves: new Set(["heatwave"]),
    abilities: new Set(["drought"]),
  },
};
const names = (text: string) =>
  suggest(text, options, (id) => details[id]).map((s) => s.name);
const choices = (text: string) =>
  suggest(text, options, (id) => details[id]).map((s) => s.choice);

describe("parseQuery", () => {
  it.each([
    ["Incineroar", { exclude: false, subject: "Incineroar", details: null }],
    ["not Sneasler", { exclude: true, subject: "Sneasler", details: null }],
    ["NOT  sneasler", { exclude: true, subject: "sneasler", details: null }],
    ["-sneasler", { exclude: true, subject: "sneasler", details: null }],
    ["Charizard with", { exclude: false, subject: "Charizard", details: [""] }],
    [
      "not Incineroar with Fake Out and Knock",
      { exclude: true, subject: "Incineroar", details: ["Fake Out", "Knock"] },
    ],
    [
      "Incineroar with Fake Out, Intimidate & Sitrus",
      {
        exclude: false,
        subject: "Incineroar",
        details: ["Fake Out", "Intimidate", "Sitrus"],
      },
    ],
    ["Nothing", { exclude: false, subject: "Nothing", details: null }],
  ])("%j", (text, parsed) => {
    expect(parseQuery(text)).toEqual(parsed);
  });
});

describe("suggest", () => {
  it("suggests everything matching, then a player", () => {
    expect(names("char")).toEqual([
      "Charizard",
      "Charizard-Mega-Y",
      "Charizardite X",
      "Charizardite Y",
      "Player name contains “char”",
    ]);
  });

  it("excludes with “not”", () => {
    expect(names("not sun")).toEqual([
      "Not Sun",
      "Not players whose name contains “sun”",
    ]);
    expect(choices("not sun")[0]).toEqual({ mode: "not", archetype: "sun" });
    expect(choices("not fire")[0]).toEqual({
      mode: "not",
      condition: { type: "fire" },
    });
  });

  it("adds details to a Pokémon with “with”", () => {
    expect(names("Charizard with charizardite")).toEqual([
      "Charizard with Charizardite X",
      "Charizard with Charizardite Y",
    ]);
    expect(choices("not charizard with charizardite y")[0]).toEqual({
      mode: "not",
      condition: { pokemon: "charizard", item: "charizarditey" },
    });
  });

  it("limits details to the Pokémon's own moves and abilities", () => {
    expect(names("Charizard with Fake")).toEqual([]);
    expect(names("Incineroar with Fake")).toEqual(["Incineroar with Fake Out"]);
  });

  it("chains details with “and”", () => {
    expect(choices("Incineroar with Fake Out and intim")).toEqual([
      {
        mode: "has",
        condition: {
          pokemon: "incineroar",
          moves: ["fakeout"],
          ability: "intimidate",
        },
      },
    ]);
    // A detail that isn't the Pokémon's ends the suggestions.
    expect(names("Incineroar with Drought and Fake")).toEqual([]);
  });

  it("keeps a Pokémon's combinations while “with” is typed", () => {
    // All but the last, the player option, which echoes the text.
    const full = names("Incineroar").slice(0, -1);
    for (const text of ["Incineroar w", "Incineroar wi", "incineroar wit"]) {
      expect(names(text).slice(0, -1)).toEqual(full);
    }
  });

  it("follows a full combination with what can be added to it", () => {
    const and = [
      "Incineroar with Fake Out and Knock Off",
      "Incineroar with Fake Out and Heat Wave",
      "Incineroar with Fake Out and Intimidate",
      "Incineroar with Fake Out and Charizardite X",
      "Incineroar with Fake Out and Charizardite Y",
      "Incineroar with Fake Out and Sitrus Berry",
    ];
    expect(names("Incineroar with Fake Out")).toEqual([
      "Incineroar with Fake Out",
      ...and,
    ]);
    // Also while "and" is half typed.
    expect(names("Incineroar with fake out a")).toEqual(
      names("Incineroar with Fake Out"),
    );
    expect(names("Incineroar with Fake Out an")).toEqual(
      names("Incineroar with Fake Out"),
    );
  });

  it("keeps offering “and” for as many details as fit", () => {
    expect(
      names("Incineroar with Fake Out and Intimidate and Sitrus Berry"),
    ).toEqual([
      "Incineroar with Fake Out and Intimidate and Sitrus Berry",
      "Incineroar with Fake Out and Knock Off and Intimidate and Sitrus Berry",
      "Incineroar with Fake Out and Heat Wave and Intimidate and Sitrus Berry",
    ]);
    expect(
      choices("Incineroar with Fake Out and Intimidate and Sitrus Berry")[0],
    ).toEqual({
      mode: "has",
      condition: {
        pokemon: "incineroar",
        moves: ["fakeout"],
        ability: "intimidate",
        item: "sitrusberry",
      },
    });
  });

  it("lists every detail after “with” or “and”, before one is typed", () => {
    const combinations = names("Incineroar").slice(1, -1);
    expect(names("Incineroar with")).toEqual(combinations);
    expect(names("Incineroar with ")).toEqual(combinations);
    expect(names("Incineroar with Fake Out and ")).toEqual([
      "Incineroar with Fake Out and Knock Off",
      "Incineroar with Fake Out and Heat Wave",
      "Incineroar with Fake Out and Intimidate",
      "Incineroar with Fake Out and Charizardite X",
      "Incineroar with Fake Out and Charizardite Y",
      "Incineroar with Fake Out and Sitrus Berry",
    ]);
  });

  it("doesn't take a half-typed “with” after a partial name", () => {
    expect(names("Incin w")).toEqual(["Player name contains “Incin w”"]);
  });

  it("offers only items until a Pokémon's moves and abilities are loaded", () => {
    const unloaded = (text: string) =>
      suggest(text, options, () => undefined).map((s) => s.name);
    expect(unloaded("Charizard with Knock")).toEqual([]);
    expect(unloaded("Charizard with Sitrus")).toEqual([
      "Charizard with Sitrus Berry",
    ]);
  });

  it("follows a Pokémon's full name with its combinations, by kind", () => {
    const shown = suggest("incineroar", options, (id) => details[id]);
    expect(shown.map((s) => [s.group, s.name])).toEqual([
      ["Pokémon", "Incineroar"],
      ["Moves", "Incineroar with Fake Out"],
      ["Moves", "Incineroar with Knock Off"],
      ["Moves", "Incineroar with Heat Wave"],
      ["Abilities", "Incineroar with Intimidate"],
      ["Items", "Incineroar with Charizardite X"],
      ["Items", "Incineroar with Charizardite Y"],
      ["Items", "Incineroar with Sitrus Berry"],
      ["Players", "Player name contains “incineroar”"],
    ]);
  });

  it("keeps other Pokémon that match a full name", () => {
    expect(names("Charizard").slice(0, 3)).toEqual([
      "Charizard",
      "Charizard-Mega-Y",
      "Charizard with Heat Wave",
    ]);
  });

  it("only offers combinations for a full name", () => {
    expect(names("Incinero")).toEqual([
      "Incineroar",
      "Player name contains “Incinero”",
    ]);
  });

  it("gives each suggestion the text that searches for it", () => {
    const text = (q: string) =>
      suggest(q, options, (id) => details[id]).map((s) => s.text);
    expect(text("not charizard with charizardite y")[0]).toBe(
      "not Charizard with Charizardite Y",
    );
    expect(text("not charizard with charizardite y")[1]).toBe(
      "not Charizard with Heat Wave and Charizardite Y",
    );
    expect(text("inci")[0]).toBe("Incineroar");
    expect(text("not fir")[0]).toBe("not Fire");
  });

  it("groups “with” suggestions by kind", () => {
    expect(
      suggest("Incineroar with i", options, (id) => details[id]).map(
        (s) => s.group,
      ),
    ).toEqual(["Abilities"]);
  });
});

describe("conditionLabel", () => {
  const name = (_: string, id: string) =>
    options.find((o) => o.id === id)?.name ?? id;

  it.each([
    [{ pokemon: "incineroar" }, "Incineroar"],
    [
      {
        pokemon: "incineroar",
        moves: ["fakeout", "knockoff"],
        item: "sitrusberry",
      },
      "Incineroar with Fake Out and Knock Off and Sitrus Berry",
    ],
    [{ moves: ["knockoff"] }, "Knock Off"],
    [{ type: "fire" }, "Fire type"],
  ])("%j", (condition, label) => {
    expect(conditionLabel(condition, name)).toBe(label);
  });
});

describe("matchOptions", () => {
  const list = [
    { name: "Incineroar", group: "Pokémon" },
    { name: "Flabébé", group: "Pokémon" },
    { name: "Mr. Rime", group: "Pokémon" },
    { name: "Fire Fang", group: "Moves" },
    { name: "Knock Off", group: "Moves" },
  ];
  const found = (q: string) => matchOptions(list, q).map((o) => o.name);

  it("ranks names starting with the text first, keeping groups in order", () => {
    expect(found("f")).toEqual(["Flabébé", "Fire Fang"]);
  });

  it("matches later words, ignores case and accents, and from two letters, inside words", () => {
    expect(found("off")).toEqual(["Knock Off"]);
    expect(found("FLABEBE")).toEqual(["Flabébé"]);
    expect(found("rime")).toEqual(["Mr. Rime"]);
    expect(found("ock")).toEqual(["Knock Off"]);
  });

  it("suggests nothing for empty text", () => {
    expect(found("  ")).toEqual([]);
  });
});

describe("choiceText and readChoice", () => {
  const name = (kind: string, id: string) =>
    options.find((o) => o.kind === kind && o.id === id)?.name ?? id;
  const read = (text: string, allowPlayer = false) =>
    readChoice(text, options, (id) => details[id], allowPlayer);

  it.each<Choice>([
    { mode: "has", condition: { pokemon: "incineroar" } },
    {
      mode: "not",
      condition: { pokemon: "charizard", item: "charizarditey" },
    },
    {
      mode: "has",
      condition: {
        pokemon: "incineroar",
        moves: ["fakeout"],
        ability: "intimidate",
      },
    },
    { mode: "not", condition: { type: "fire" } },
    { mode: "has", condition: { moves: ["knockoff"] } },
    { mode: "not", archetype: "sun" },
  ])("round-trips %j", (choice) => {
    expect(read(choiceText(choice, name))).toEqual(choice);
  });

  it("reads a player only for a player pill", () => {
    expect(read("wolfe")).toBeNull();
    expect(read("not wolfe", true)).toEqual({ mode: "not", player: "wolfe" });
  });

  it("rejects text that names nothing", () => {
    expect(read("Incineroar with Moonblast")).toBeNull();
    expect(read("Incinero")).toBeNull();
    expect(read("   ", true)).toBeNull();
  });
});
