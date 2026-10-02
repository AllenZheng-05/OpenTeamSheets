import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareImport, readEventFile } from "./event-file";

const event = `
event:
  name: Test Regional
  source: other
  sourceId: test-regional
  regulation: M-C
  official: true
  startsOn: 2026-09-19
  endsOn: 2026-09-20
`;

const kingambit = `Kingambit @ Black Glasses
Ability: Defiant
Adamant Nature
- Sucker Punch
- Kowtow Cleave
- Iron Head
- Protect`;

/** A legal six with the given first Pokémon. */
const team = (first: string) =>
  [
    first,
    "Incineroar @ Sitrus Berry\nAbility: Intimidate\nCareful Nature\n- Fake Out\n- Flare Blitz",
    "Garchomp @ Choice Scarf\nAbility: Rough Skin\nJolly Nature\n- Earthquake\n- Rock Slide",
    "Sylveon @ Life Orb\nAbility: Pixilate\nModest Nature\n- Hyper Voice\n- Protect",
    "Corviknight @ Leftovers\nAbility: Mirror Armor\nCareful Nature\n- Tailwind\n- Roost",
    "Dragapult @ Focus Sash\nAbility: Clear Body\nTimid Nature\n- Draco Meteor\n- Protect",
  ].join("\n\n");

const indent = (text: string) =>
  text
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

describe("readEventFile", () => {
  it("lists everything wrong with a file's shape", () => {
    expect(() =>
      readEventFile(`
event:
  name: Test
  source: smogon
  sourceId: x
  regulation: Z-Z
  official: yes
  startsOn: September 19
  endsOn: 2026-09-20
teams:
  - player: Ash
  - player: Ash
    paste: x
    placement: first
`),
    ).toThrow(
      [
        "event: `source` must be one of rk9, limitless, other",
        "event: `regulation` must be a regulation such as M-C",
        "event: `official` must be true or false",
        "event: `startsOn` must be a date like 2026-09-19",
        "team 1: `paste` must be text",
        "team 2: `placement` must be a whole number",
        "team 2: Ash is listed twice",
      ].join("\n"),
    );
  });

  it("needs an event and a list of teams", () => {
    expect(() => readEventFile("hello: world")).toThrow(/`event` section/);
  });
});

describe("prepareImport", () => {
  it("prepares the Baltimore top cut without errors", async () => {
    const file = readEventFile(
      readFileSync(
        path.join(
          import.meta.dirname,
          "../../../../data/events/baltimore-2027.yaml",
        ),
        "utf8",
      ),
    );
    const result = await prepareImport(file);
    expect(result.ok).toBe(true);
    expect(result.reports).toHaveLength(13);
    expect(result.reports[0]).toMatchObject({
      player: "Joseph Ugarte",
      archetypes: ["sand", "psychic-terrain"],
    });
    expect(result.payload.event).toMatchObject({
      source: "rk9",
      regulationId: "M-C",
    });
  });

  it("fetches PokePaste links", async () => {
    const file = readEventFile(`${event}
teams:
  - player: Ash
    paste: https://pokepast.es/816414687c1c150d
`);
    const fetched: string[] = [];
    const result = await prepareImport(file, async (url) => {
      fetched.push(url);
      return team(kingambit);
    });
    expect(fetched).toEqual(["https://pokepast.es/816414687c1c150d"]);
    expect(result.ok).toBe(true);
  });

  it("reports an illegal team and blocks the import", async () => {
    const file = readEventFile(`${event}
teams:
  - player: Ash
    paste: |
${indent(team(kingambit.replace("Iron Head", "Moonblast")))}
`);
    const result = await prepareImport(file, async () => "");
    expect(result.ok).toBe(false);
    expect(result.reports[0]?.errors).toEqual([
      { slot: 1, message: "Kingambit can't learn Moonblast" },
    ]);
  });

  it("builds the import_event payload", async () => {
    const file = readEventFile(`${event}
teams:
  - player: Ash
    placement: 1
    record: 10-2
    teamlistUrl: https://example.com/ash
    media:
      - kind: stream_vod
        url: https://example.com/vod
        start: 3721
    paste: |
${indent(team(kingambit))}
`);
    const { payload } = await prepareImport(file, async () => "");
    expect(payload.teams[0]).toMatchObject({
      playerName: "Ash",
      placement: 1,
      record: "10-2",
      teamlistUrl: "https://example.com/ash",
      archetypes: ["tailwind"],
      media: [
        {
          kind: "stream_vod",
          url: "https://example.com/vod",
          startSeconds: 3721,
          title: null,
        },
      ],
    });
    expect((payload.teams[0] as { sets: object[] }).sets[0]).toEqual({
      slot: 1,
      speciesId: "kingambit",
      itemId: "blackglasses",
      abilityId: "defiant",
      natureId: "adamant",
      moves: ["suckerpunch", "kowtowcleave", "ironhead", "protect"],
      statPoints: null,
      level: 50,
      ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
      shiny: false,
    });
  });
});
