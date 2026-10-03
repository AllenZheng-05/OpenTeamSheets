import readings from "../../data/sheet-readings.json";
import { gameData } from "../game-data/data";
import type { Regulation } from "../regulation";
import { getSpecies, itemForm, nameOf } from "./lookup";
import type { Team } from "./types";
import { validateTeam } from "./validate";

// Official team sheets are published as entered by the event's staff, typos
// included. They're stored as published; these errors explain what's wrong,
// and for typos we've reviewed (data/sheet-readings.json), what was
// probably meant. A reading is shown beside the sheet and never replaces it.

export interface SheetError {
  slot: number | null;
  message: string;
  /** The listed item, ability or move the error is about. */
  field?: "item" | "ability" | "move";
  value?: string;
  /** What the listing probably meant, by name. */
  reading?: string;
  /**
   * The listed ability is the Mega's own (Drought for Charizard holding
   * Charizardite Y), so the one before Mega Evolving isn't known.
   */
  megaAbility?: boolean;
  /**
   * The listing is the first ability or move alphabetically (Adaptability,
   * Accelerock), which sheets show when that field was left blank.
   */
  leftBlank?: boolean;
}

/** The first option alphabetically, which a blank field on a sheet shows. */
const firstByName = (records: { id: string; name: string }[]) =>
  [...records].sort((a, b) => a.name.localeCompare(b.name, "en"))[0]?.id;
const BLANK: Partial<Record<"item" | "ability" | "move", string>> = {
  ability: firstByName(gameData.abilities),
  move: firstByName(gameData.moves),
};

type Reading = { species: string; listed: string; reading: string };
// An item that isn't in the game is listed by name ("Choice Band").
const READINGS: Record<"item" | "ability" | "move", Reading[]> = {
  item: readings.items,
  ability: readings.abilities,
  move: readings.moves,
};

/** Our reading of a listing, for the species or its base species. */
export function sheetReading(
  speciesId: string,
  field: "item" | "ability" | "move",
  listed: string,
): string | null {
  const species = getSpecies(speciesId);
  const ids = [speciesId, species?.baseSpeciesId];
  const match = READINGS[field].find(
    (r) => r.listed === listed && ids.includes(r.species),
  );
  return match ? match.reading : null;
}

/** What's wrong with a finished team sheet, as published. */
export function sheetErrors(team: Team, regulation: Regulation): SheetError[] {
  return validateTeam(team, regulation, { complete: true }).errors.map(
    (error): SheetError => {
      const set = error.slot ? team.sets[error.slot - 1] : undefined;
      if (!set?.speciesId || !error.field || !error.value) return error;
      const species = getSpecies(set.speciesId);
      const form = species?.battleOnlyFromId ?? set.speciesId;
      const mega = itemForm(form, set.itemId);
      if (error.field === "ability" && mega?.ability1 === error.value) {
        return {
          ...error,
          message: `${nameOf("ability", error.value)} is ${mega.name}'s ability, so ${getSpecies(form)?.name ?? form}'s own isn't known`,
          megaAbility: true,
        };
      }
      const reading = sheetReading(form, error.field, error.value);
      if (!reading && BLANK[error.field] === error.value) {
        return { ...error, leftBlank: true };
      }
      return reading
        ? {
            ...error,
            reading: nameOf(error.field, reading),
          }
        : error;
    },
  );
}

/** "Slot 5: Basculegion can't learn Last Resort (probably Last Respects)" */
export const describeSheetError = (error: SheetError) =>
  `${error.slot ? `Slot ${error.slot}: ` : ""}${error.message}${
    error.reading
      ? ` (probably ${error.reading})`
      : error.leftBlank
        ? " (probably left blank)"
        : ""
  }`;
