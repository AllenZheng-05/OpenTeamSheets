import { parseRk9 } from "./rk9";
import { parseShowdown } from "./showdown";
import type { ParseResult } from "./types";

// A team given as text: a Showdown paste or an RK9 teamlist, or a link to a
// PokePaste, whose text is fetched by whoever has the network.

const POKEPASTE = /^https?:\/\/pokepast\.es\/([0-9a-f]+)\/?$/i;

/** A PokePaste link's id, or null if the text isn't one. */
export const pokePasteId = (text: string): string | null =>
  text.trim().match(POKEPASTE)?.[1] ?? null;

/** Where a PokePaste's text and title are, as JSON ({ paste, title }). */
export const pokePasteJsonUrl = (id: string) =>
  `https://pokepast.es/${id}/json`;

/** RK9 teamlists label their fields; Showdown pastes don't. */
export const isRk9Text = (text: string) =>
  /Held Item:/.test(text) && /Stat Alignment:/.test(text);

/** Reads a team's text in whichever format it's in. */
export const parseTeamText = (text: string): ParseResult =>
  isRk9Text(text) ? parseRk9(text) : parseShowdown(text);
