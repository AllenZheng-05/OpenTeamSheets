/**
 * Pokémon Showdown's id convention: lowercase letters and digits only, so
 * "Charizard-Mega-Y" becomes "charizardmegay" and "Mr. Mime" "mrmime".
 * Accents are dropped first, so "Flabébé" becomes "flabebe".
 */
export function toId(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
