import { parse as parseYaml } from "yaml";
import { isRegulation, type Regulation } from "@ots/core";
import {
  deriveArchetypes,
  parseRk9,
  parseShowdown,
  teamFingerprint,
  validateTeam,
  type Problem,
  type Team,
} from "@ots/core/teams";

// An event file (data/events/*.yaml) describes one tournament and its teams.
// Each team's paste is Showdown or RK9 text, or a PokePaste link.

const SOURCES = ["rk9", "limitless", "other"] as const;
const MEDIA_KINDS = ["stream_vod", "youtube", "replay"] as const;

export interface EventFile {
  event: {
    name: string;
    source: (typeof SOURCES)[number];
    sourceId: string;
    regulation: Regulation;
    official: boolean;
    startsOn: string;
    endsOn: string;
    playerCount?: number;
    standingsUrl?: string;
  };
  teams: {
    player: string;
    placement?: number;
    record?: string;
    teamlistUrl?: string;
    paste: string;
    media?: {
      kind: (typeof MEDIA_KINDS)[number];
      url: string;
      start?: number;
      title?: string;
    }[];
  }[];
}

type Fields = Record<string, unknown>;
const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads an event file, or throws listing everything wrong with its shape. */
export function readEventFile(text: string): EventFile {
  const problems: string[] = [];
  const data: unknown = parseYaml(text);
  if (!isObject(data) || !isObject(data.event) || !Array.isArray(data.teams)) {
    throw new Error(
      "An event file needs an `event` section and a `teams` list",
    );
  }

  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  const textField = (
    fields: Fields,
    key: string,
    where: string,
    required = true,
  ) => {
    const value = fields[key];
    check(
      (!required && value === undefined) ||
        (typeof value === "string" && value !== ""),
      `${where}: \`${key}\` must be text`,
    );
  };
  const numberField = (fields: Fields, key: string, where: string) => {
    const value = fields[key];
    check(
      value === undefined || (Number.isInteger(value) && (value as number) > 0),
      `${where}: \`${key}\` must be a whole number`,
    );
  };
  const dateField = (fields: Fields, key: string) => {
    check(
      typeof fields[key] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(fields[key]),
      `event: \`${key}\` must be a date like 2026-09-19`,
    );
  };

  const event = data.event;
  textField(event, "name", "event");
  check(
    SOURCES.includes(event.source as (typeof SOURCES)[number]),
    `event: \`source\` must be one of ${SOURCES.join(", ")}`,
  );
  textField(event, "sourceId", "event");
  check(
    typeof event.regulation === "string" && isRegulation(event.regulation),
    "event: `regulation` must be a regulation such as M-C",
  );
  check(
    typeof event.official === "boolean",
    "event: `official` must be true or false",
  );
  dateField(event, "startsOn");
  dateField(event, "endsOn");
  numberField(event, "playerCount", "event");
  textField(event, "standingsUrl", "event", false);

  const players = new Set<string>();
  data.teams.forEach((team: unknown, index) => {
    const where = `team ${index + 1}`;
    if (!isObject(team)) {
      problems.push(`${where}: must have a player and a paste`);
      return;
    }
    textField(team, "player", where);
    textField(team, "paste", where);
    numberField(team, "placement", where);
    textField(team, "record", where, false);
    textField(team, "teamlistUrl", where, false);
    if (typeof team.player === "string") {
      check(
        !players.has(team.player),
        `${where}: ${team.player} is listed twice`,
      );
      players.add(team.player);
    }
    const media = team.media ?? [];
    check(Array.isArray(media), `${where}: \`media\` must be a list`);
    (Array.isArray(media) ? media : []).forEach((link: unknown, linkIndex) => {
      const linkWhere = `${where}, media ${linkIndex + 1}`;
      if (!isObject(link)) {
        problems.push(`${linkWhere}: must have a kind and a url`);
        return;
      }
      check(
        MEDIA_KINDS.includes(link.kind as (typeof MEDIA_KINDS)[number]),
        `${linkWhere}: \`kind\` must be one of ${MEDIA_KINDS.join(", ")}`,
      );
      textField(link, "url", linkWhere);
      textField(link, "title", linkWhere, false);
      check(
        link.start === undefined ||
          (Number.isInteger(link.start) && (link.start as number) >= 0),
        `${linkWhere}: \`start\` must be a number of seconds`,
      );
    });
  });

  if (problems.length > 0) throw new Error(problems.join("\n"));
  return data as unknown as EventFile;
}

const POKEPASTE = /^https?:\/\/pokepast\.es\/([0-9a-f]+)\/?$/i;

/** The text of a PokePaste, from its JSON form. */
export async function fetchPokePaste(url: string): Promise<string> {
  const id = url.match(POKEPASTE)?.[1];
  const response = await fetch(`https://pokepast.es/${id}/json`);
  if (!response.ok) {
    throw new Error(`Couldn't fetch ${url} (HTTP ${response.status})`);
  }
  return ((await response.json()) as { paste: string }).paste;
}

/** RK9 teamlists label their fields; Showdown pastes don't. */
const isRk9Text = (text: string) =>
  /Held Item:/.test(text) && /Stat Alignment:/.test(text);

export interface TeamReport {
  player: string;
  placement: number | null;
  archetypes: string[];
  errors: Problem[];
  warnings: Problem[];
}

export interface PreparedImport {
  /** The argument for import_event(). */
  payload: {
    event: Omit<EventFile["event"], "regulation"> & {
      regulationId: Regulation;
    };
    teams: object[];
  };
  reports: TeamReport[];
  /** False if any team has an error; then nothing should be imported. */
  ok: boolean;
}

/**
 * Parses, validates, fingerprints and tags every team in an event file,
 * and builds the payload for import_event().
 */
export async function prepareImport(
  file: EventFile,
  fetchPaste: (url: string) => Promise<string> = fetchPokePaste,
): Promise<PreparedImport> {
  const { regulation, ...event } = file.event;
  const reports: TeamReport[] = [];
  const teams: object[] = [];

  for (const entry of file.teams) {
    const report: TeamReport = {
      player: entry.player,
      placement: entry.placement ?? null,
      archetypes: [],
      errors: [],
      warnings: [],
    };
    reports.push(report);

    let text = entry.paste;
    if (POKEPASTE.test(text.trim())) {
      try {
        text = await fetchPaste(text.trim());
      } catch (error) {
        report.errors.push({ slot: null, message: (error as Error).message });
        continue;
      }
    }
    const parsed = isRk9Text(text) ? parseRk9(text) : parseShowdown(text);
    const team: Team = parsed.team;
    const validation = validateTeam(team, regulation, { complete: true });
    report.errors.push(...parsed.errors, ...validation.errors);
    report.warnings.push(...validation.warnings);
    report.archetypes = deriveArchetypes(team);

    teams.push({
      fingerprint: teamFingerprint(team, regulation),
      archetypes: report.archetypes,
      playerName: entry.player,
      placement: entry.placement ?? null,
      record: entry.record ?? null,
      teamlistUrl: entry.teamlistUrl ?? null,
      sets: team.sets.map((set, index) => ({
        slot: index + 1,
        speciesId: set.speciesId,
        itemId: set.itemId,
        abilityId: set.abilityId,
        natureId: set.natureId,
        moves: set.moveIds,
        statPoints: set.statPoints,
        level: set.level,
        ivs: set.ivs,
        shiny: set.shiny,
      })),
      media: (entry.media ?? []).map((link) => ({
        kind: link.kind,
        url: link.url,
        startSeconds: link.start ?? null,
        title: link.title ?? null,
      })),
    });
  }

  return {
    payload: { event: { ...event, regulationId: regulation }, teams },
    reports,
    ok: reports.every((report) => report.errors.length === 0),
  };
}
