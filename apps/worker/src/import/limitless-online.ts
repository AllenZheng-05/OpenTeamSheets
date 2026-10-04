import { getCurrentRegulation, isRegulation, type Regulation } from "@ots/core";
import { sheetErrors } from "@ots/core/teams";
import {
  prepareTeams,
  teamFromLimitless,
  type LimitlessSet,
  type PreparedEvent,
} from "./limitless";

// Online tournaments from Limitless's public API (play.limitlesstcg.com/api,
// no key needed; 50 requests per 5 minutes). One request lists a page of
// tournaments; for each, one gives its details and one its standings with
// every player's team.

export const PLAY_SITE = "https://play.limitlesstcg.com";
const API = `${PLAY_SITE}/api`;

/** A tournament in the API's list. */
export interface OnlineTournament {
  id: string;
  name: string;
  /** ISO date and time it started. */
  date: string;
  format: string;
  players: number;
}

export interface OnlineDetails extends OnlineTournament {
  /** Whether teamlists are public. */
  decklists: boolean;
  phases: { phase: number; type: string; rounds: number; mode: string }[];
}

/** A Pokémon in an online teamlist; moves are "attacks", as in the TCG. */
export interface OnlineSet {
  id: string;
  name: string;
  item: string | null;
  ability: string | null;
  attacks: string[];
  nature: string | null;
}

export interface OnlineStanding {
  name: string;
  /** The player's username, unique on Limitless. */
  player: string;
  placing: number | null;
  record: { wins: number; losses: number; ties: number };
  decklist: OnlineSet[] | null;
  drop: number | null;
}

export const tournamentsUrl = (format: string, page: number) =>
  `${API}/tournaments?game=VGC&format=${encodeURIComponent(format)}&limit=100&page=${page}`;
export const detailsUrl = (id: string) => `${API}/tournaments/${id}/details`;
export const standingsUrl = (id: string) =>
  `${API}/tournaments/${id}/standings`;

/**
 * How many players made the top cut: the single-elimination bracket after
 * Swiss (listed as SINGLE_BRACKET or SINGLE_ELIMINATION), two to the power
 * of its rounds. None without one.
 */
export function topCutSize(details: OnlineDetails): number {
  const bracket = details.phases.find((p) => /^SINGLE_/.test(p.type));
  return bracket ? 2 ** bracket.rounds : 0;
}

/**
 * An online event's URL name: its name, then its Limitless id so it's
 * unique ("tenkis-cart-weekly-120-reg-m-c-6ab66fd8783097f8dcb703fc").
 * Names are often decorated with emoji, which drop out.
 */
export function onlineSlug(name: string, id: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  return words ? `${words}-${id.toLowerCase()}` : `online-${id.toLowerCase()}`;
}

const toSet = (set: OnlineSet): LimitlessSet => ({
  id: set.id,
  name: set.name,
  item: set.item,
  ability: set.ability,
  nature: set.nature,
  moves: set.attacks,
});

/**
 * The regulation a tournament was played in: the format it lists, or the
 * one in effect on its date, whichever its teams break fewer rules in.
 * Organizers set the format by hand and sometimes leave the previous one
 * (an "M-B" tour listed as M-A), but some tournaments really do keep an
 * older format, such as practice for an official event still played in it.
 */
export function tournamentRegulation(
  details: OnlineDetails,
  standings: OnlineStanding[],
): Regulation {
  const listed = details.format as Regulation;
  const byDate = getCurrentRegulation(new Date(details.date));
  if (listed === byDate) return listed;
  const errorsIn = (regulation: Regulation) =>
    standings.reduce((count, player) => {
      if (!player.decklist) return count;
      const { team, unknown } = teamFromLimitless(player.decklist.map(toSet));
      return unknown.length
        ? count
        : count + sheetErrors(team, regulation).length;
    }, 0);
  return errorsIn(listed) < errorsIn(byDate) ? listed : byDate;
}

/**
 * Builds the import for one online tournament, or null if it isn't a
 * Champions tournament (see tournamentRegulation for its regulation).
 * Online events have no day 2; the top cut is the bracket after Swiss.
 */
export function prepareOnlineEvent(
  details: OnlineDetails,
  standings: OnlineStanding[],
): PreparedEvent | null {
  if (!isRegulation(details.format)) return null;
  const regulation = tournamentRegulation(details, standings);
  const day = details.date.slice(0, 10);
  const cut = topCutSize(details);
  return {
    event: {
      source: "limitless",
      sourceId: details.id,
      slug: onlineSlug(details.name, details.id),
      name: details.name.trim(),
      regulationId: regulation,
      official: false,
      startsOn: day,
      endsOn: day,
      playerCount: details.players,
      standingsUrl: `${PLAY_SITE}/tournament/${details.id}/standings`,
      topCutSize: cut || null,
    },
    ...prepareTeams(
      standings.map((p) => ({
        name: p.name,
        sourcePlayerId: p.player,
        placement: p.placing,
        wins: p.record.wins,
        losses: p.record.losses,
        droppedRound: p.drop,
        madeDayTwo: false,
        madeTopCut: cut > 0 && p.placing !== null && p.placing <= cut,
        teamlistUrl: p.decklist
          ? `${PLAY_SITE}/tournament/${details.id}/player/${encodeURIComponent(p.player)}/teamlist`
          : null,
        sets: p.decklist ? p.decklist.map(toSet) : null,
      })),
      regulation,
    ),
  };
}
