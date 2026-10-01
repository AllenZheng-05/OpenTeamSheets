/**
 * Turns a display name such as "Charizard-Mega-Y" or "Mr. Mime" into the id
 * used in the database ("charizard-mega-y", "mr-mime"). Accents, apostrophes
 * and periods are dropped, so "Flabébé" becomes "flabebe".
 */
export function normalizeSpeciesId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ'’.]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
