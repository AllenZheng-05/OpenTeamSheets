import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  prepareOfficialEvent,
  readDates,
  readOfficialEvents,
  readStandingsPage,
  readTeamlistPage,
  teamFromLimitless,
  type OfficialEvent,
} from "./limitless";

const fixture = (name: string) =>
  readFileSync(
    path.join(import.meta.dirname, "__fixtures__/limitless", name),
    "utf8",
  );

const baltimore: OfficialEvent = {
  id: 441,
  standings: "0037",
  name: "Regional Baltimore, MD",
  regulation: "M-C",
};

describe("readStandingsPage", () => {
  // A real standings page, trimmed to a cross-section of players.
  const { tournament, players } = readStandingsPage(fixture("standings.html"));

  it("reads the event", () => {
    expect(tournament).toMatchObject({
      type: "regional",
      city: "Baltimore",
      date: "September 18–20, 2026",
      players_r1: 1079,
    });
  });

  it("reads each player's placement, record and flags", () => {
    expect(players[0]).toMatchObject({
      name: "Joseph Ugarte",
      tp_id: 991,
      placement: 1,
      wins: 15,
      losses: 2,
      day2: 1,
      topcut: 1,
    });
    expect(players.filter((p) => p.topcut).map((p) => p.placement)).toEqual(
      Array.from({ length: 13 }, (_, i) => i + 1),
    );
  });
});

describe("readTeamlistPage and teamFromLimitless", () => {
  it("reads a real team into game data ids", () => {
    const { team, unknown } = teamFromLimitless(
      readTeamlistPage(fixture("teamlist-0991.html")),
    );
    expect(unknown).toEqual([]);
    expect(team.sets[1]).toMatchObject({
      speciesId: "salamence",
      itemId: "salamencite",
      abilityId: "intimidate",
      natureId: "timid",
      moveIds: ["hypervoice", "dracometeor", "flamethrower", "protect"],
      statPoints: null,
    });
  });

  it("maps Limitless's form ids", () => {
    const { team } = teamFromLimitless(
      readTeamlistPage(fixture("teamlist-0735.html")),
    );
    expect(team.sets[0]?.speciesId).toBe("floetteeternal");
  });

  it.each([
    ["tauros-paldea", "taurospaldeacombat"],
    ["tauros-paldea-aqua", "taurospaldeaaqua"],
    ["tauros-paldea-blaze", "taurospaldeablaze"],
  ])("maps %s", (id, speciesId) => {
    const { team, unknown } = teamFromLimitless([
      {
        id,
        name: "Paldean Tauros",
        item: null,
        ability: "Intimidate",
        nature: "Jolly",
        moves: ["Protect"],
      },
    ]);
    expect(unknown).toEqual([]);
    expect(team.sets[0]?.speciesId).toBe(speciesId);
  });

  it('reads the bare label "Held Item:" as no item', () => {
    const { team, unknown } = teamFromLimitless([
      {
        id: "garchomp",
        name: "Garchomp",
        item: "Held Item:",
        ability: "Rough Skin",
        nature: "Jolly",
        moves: ["Protect"],
      },
    ]);
    expect(unknown).toEqual([]);
    expect(team.sets[0]?.itemId).toBeNull();
  });

  it("keeps an item that isn't in the game as listed", () => {
    const { team, unknown } = teamFromLimitless([
      {
        id: "indeedee",
        name: "Indeedee",
        item: "Choice Band",
        ability: "Psychic Surge",
        nature: "Modest",
        moves: ["Trick"],
      },
    ]);
    expect(unknown).toEqual([]);
    expect(team.sets[0]).toMatchObject({
      itemId: null,
      listedItem: "Choice Band",
    });
  });

  it("reports other names that aren't in the game data", () => {
    const { unknown } = teamFromLimitless([
      {
        id: "kingambit",
        name: "Kingambit",
        item: "Black Glasses",
        ability: "Not An Ability",
        nature: "Adamant",
        moves: ["Protect"],
      },
    ]);
    expect(unknown).toEqual(['ability "Not An Ability"']);
  });
});

describe("readDates", () => {
  it.each([
    ["September 18–20, 2026", "2026-09-18", "2026-09-20"],
    ["August 31 – September 2, 2026", "2026-08-31", "2026-09-02"],
    ["June 6, 2026", "2026-06-06", "2026-06-06"],
  ])("%s", (text, startsOn, endsOn) => {
    expect(readDates(text)).toEqual({ startsOn, endsOn });
  });

  it("rejects a format it doesn't know", () => {
    expect(() => readDates("next Tuesday")).toThrow(/Couldn't read the date/);
  });
});

describe("prepareOfficialEvent", () => {
  const standings = readStandingsPage(fixture("standings.html"));
  const teamlists = new Map([
    [991, readTeamlistPage(fixture("teamlist-0991.html"))],
    [735, readTeamlistPage(fixture("teamlist-0735.html"))],
  ]);
  const prepared = prepareOfficialEvent(baltimore, standings, teamlists);

  it("describes the event", () => {
    expect(prepared.event).toEqual({
      source: "limitlessvgc",
      sourceId: "0037",
      slug: "baltimore-2026",
      name: "Regional Baltimore, MD",
      regulationId: "M-C",
      official: true,
      startsOn: "2026-09-18",
      endsOn: "2026-09-20",
      playerCount: 1079,
      standingsUrl: "https://standings.limitlessvgc.com/0037/standings",
      topCutSize: 13,
    });
  });

  it("imports players whose teamlists it has, with their results", () => {
    expect(prepared.teams).toHaveLength(2);
    expect(prepared.teams[0]).toMatchObject({
      playerName: "Joseph Ugarte",
      placement: 1,
      wins: 15,
      losses: 2,
      madeDayTwo: true,
      madeTopCut: true,
      droppedRound: null,
      archetypes: ["sand", "psychic-terrain"],
      teamlistUrl:
        "https://standings.limitlessvgc.com/0037/player/0991/teamlist",
    });
  });

  it("imports a sheet with errors as published, and reports them", () => {
    const withTypos = new Map(teamlists);
    withTypos.set(991, [
      ...teamlists.get(991)!.slice(0, 5),
      { ...teamlists.get(991)![5]!, moves: ["Moonblast"] },
    ]);
    const result = prepareOfficialEvent(baltimore, standings, withTypos);
    expect(result.teams).toHaveLength(2);
    expect(result.sheetErrors).toEqual([
      {
        player: "Joseph Ugarte",
        placement: 1,
        teamlistUrl:
          "https://standings.limitlessvgc.com/0037/player/0991/teamlist",
        reasons: ["Slot 6: Sneasler can't learn Moonblast"],
      },
    ]);
    // Stored for search.
    expect(result.teams[0]?.sheetErrors).toEqual([
      {
        slot: 6,
        message: "Sneasler can't learn Moonblast",
        field: "move",
        value: "moonblast",
      },
    ]);
    expect(prepared.teams[0]?.sheetErrors).toEqual([]);
  });

  it("skips players without a teamlist, and names it doesn't know", () => {
    const withUnknown = new Map(teamlists);
    withUnknown.set(991, [
      { ...teamlists.get(991)![0]!, ability: "Not An Ability" },
    ]);
    const result = prepareOfficialEvent(baltimore, standings, withUnknown);
    expect(result.teams).toHaveLength(1);
    expect(
      result.skipped.find((s) => s.player === "Joseph Ugarte")?.reasons,
    ).toEqual(['Unknown ability "Not An Ability"']);
    expect(
      result.skipped.filter((s) => s.reasons[0] === "No teamlist").length,
    ).toBe(standings.players.length - 2);
  });
});

describe("readOfficialEvents", () => {
  it("reads the committed event list", () => {
    const events = readOfficialEvents(
      readFileSync(
        path.join(import.meta.dirname, "../../../../data/official-events.yaml"),
        "utf8",
      ),
    );
    expect(events.map((e) => e.standings)).toEqual([
      "0033",
      "0034",
      "0035",
      "0036",
      "0037",
      "0038",
      "0039",
    ]);
  });

  it("lists everything wrong with an entry", () => {
    expect(() =>
      readOfficialEvents(
        "events:\n  - id: x\n    standings: 37\n    regulation: Z\n",
      ),
    ).toThrow(
      [
        "event 1: `id` must be a number",
        'event 1: `standings` must be a quoted id such as "0037"',
        "event 1: `name` must be text",
        "event 1: `regulation` must be a regulation such as M-C",
      ].join("\n"),
    );
  });
});
