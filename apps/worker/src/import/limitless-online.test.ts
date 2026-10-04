import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  onlineSlug,
  prepareOnlineEvent,
  topCutSize,
  type OnlineDetails,
  type OnlineStanding,
} from "./limitless-online";

const fixture = <T>(name: string): T =>
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "__fixtures__/limitless-online", name),
      "utf8",
    ),
  ) as T;

// A real tournament (Tenki's Cart Weekly #120), its standings trimmed to
// the top 10 and one player who dropped without a placement.
const details = fixture<OnlineDetails>("details.json");
const standings = fixture<OnlineStanding[]>("standings.json");

describe("topCutSize", () => {
  it("is two to the power of the bracket's rounds", () => {
    expect(topCutSize(details)).toBe(2);
    expect(
      topCutSize({
        ...details,
        phases: [
          { phase: 1, type: "SWISS", rounds: 6, mode: "BO3" },
          { phase: 2, type: "SINGLE_BRACKET", rounds: 3, mode: "BO3" },
        ],
      }),
    ).toBe(8);
    expect(
      topCutSize({
        ...details,
        phases: [
          { phase: 1, type: "SWISS", rounds: 7, mode: "BO3" },
          { phase: 2, type: "SINGLE_ELIMINATION", rounds: 4, mode: "BO3" },
        ],
      }),
    ).toBe(16);
  });

  it("is zero without a bracket", () => {
    expect(topCutSize({ ...details, phases: [] })).toBe(0);
  });
});

describe("onlineSlug", () => {
  it.each([
    [
      "Tenki's Cart Weekly #120 - Reg M-C",
      "tenki-s-cart-weekly-120-reg-m-c-6ab66fd8783097f8dcb703fc",
    ],
    [
      "⛩️Chadweezy95 VGC Champions Tournament Ep 24!⛩️",
      "chadweezy95-vgc-champions-tournament-ep-24-6ab66fd8783097f8dcb703fc",
    ],
    ["🏆🏆", "online-6ab66fd8783097f8dcb703fc"],
  ])("%s", (name, slug) => {
    expect(onlineSlug(name, "6ab66fd8783097f8dcb703fc")).toBe(slug);
  });

  it("matches the database's slug format", () => {
    expect(onlineSlug("𝗡𝗲𝗺𝗲 𝗪𝗲𝗲𝗸𝗹𝘆 𝗠-𝐂 𝗧𝗼𝘂𝗿 🏆 #𝟕𝟐", "abc123")).toMatch(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
    );
  });
});

describe("prepareOnlineEvent", () => {
  const prepared = prepareOnlineEvent(details, standings)!;

  it("describes the event as unofficial", () => {
    expect(prepared.event).toEqual({
      source: "limitless",
      sourceId: "6ab66fd8783097f8dcb703fc",
      slug: "tenki-s-cart-weekly-120-reg-m-c-6ab66fd8783097f8dcb703fc",
      name: "Tenki's Cart Weekly #120 - Reg M-C",
      regulationId: "M-C",
      official: false,
      startsOn: "2026-10-01",
      endsOn: "2026-10-01",
      playerCount: 137,
      standingsUrl:
        "https://play.limitlesstcg.com/tournament/6ab66fd8783097f8dcb703fc/standings",
      topCutSize: 2,
    });
  });

  it("imports each player's team, record and top cut", () => {
    expect(prepared.teams).toHaveLength(11);
    expect(prepared.teams[1]).toMatchObject({
      playerName: standings.find((p) => p.placing === 1)!.name,
      sourcePlayerId: "altkyle",
      placement: 1,
      wins: 11,
      losses: 0,
      madeDayTwo: false,
      madeTopCut: true,
      teamlistUrl:
        "https://play.limitlesstcg.com/tournament/6ab66fd8783097f8dcb703fc/player/altkyle/teamlist",
    });
    expect(prepared.teams[3]).toMatchObject({
      placement: 3,
      madeTopCut: false,
    });
    expect((prepared.teams[1] as { sets: unknown[] }).sets).toHaveLength(6);
  });

  it("imports a player who dropped without a placement, with their record", () => {
    expect(prepared.teams[0]).toMatchObject({
      placement: null,
      wins: 0,
      losses: 2,
      droppedRound: 2,
      madeTopCut: false,
    });
    expect(prepared.skipped).toEqual([]);
  });

  it("uses the date's regulation when the listed format is out of date", () => {
    // M-C teams in an M-C tournament its organizer left listed as M-A.
    expect(
      prepareOnlineEvent({ ...details, format: "M-A" }, standings)!.event
        .regulationId,
    ).toBe("M-C");
  });

  it("keeps the listed format when the teams fit it better than the date's", () => {
    // M-C teams listed as M-C, dated during M-B.
    expect(
      prepareOnlineEvent(
        { ...details, date: "2026-07-01T15:00:00.000Z" },
        standings,
      )!.event.regulationId,
    ).toBe("M-C");
  });

  it("ignores formats that aren't Champions regulations", () => {
    expect(
      prepareOnlineEvent({ ...details, format: "SVI" }, standings),
    ).toBeNull();
  });
});
