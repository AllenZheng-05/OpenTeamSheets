const ORDINALS = new Intl.PluralRules("en-US", { type: "ordinal" });
const SUFFIXES: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "st",
  two: "nd",
  few: "rd",
};

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function placement(n: number): string {
  return `${n}${SUFFIXES[ORDINALS.select(n)] ?? "th"}`;
}

// Event dates are calendar days ("2026-09-18"), so they're formatted in UTC
// to stay the same day in every time zone.
const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const day = (date: Date) => date.getUTCDate();
const parse = (value: string) => new Date(`${value}T00:00:00Z`);

/** "Sep 18–20, 2026", "Sep 30 – Oct 2, 2026" or "Dec 30, 2026 – Jan 2, 2027". */
export function dateRange(start: string, end: string): string {
  const from = parse(start);
  const to = parse(end);
  const year = (date: Date) => date.getUTCFullYear();
  if (start === end) return `${month.format(from)} ${day(from)}, ${year(from)}`;
  if (year(from) !== year(to)) {
    return `${month.format(from)} ${day(from)}, ${year(from)} – ${month.format(to)} ${day(to)}, ${year(to)}`;
  }
  if (from.getUTCMonth() !== to.getUTCMonth()) {
    return `${month.format(from)} ${day(from)} – ${month.format(to)} ${day(to)}, ${year(to)}`;
  }
  return `${month.format(from)} ${day(from)}–${day(to)}, ${year(to)}`;
}

/** 5 of 13 → "38%". */
export function percent(part: number, whole: number): string {
  return whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
}

/** 1079 → "1,079". */
export function count(n: number): string {
  return n.toLocaleString("en-US");
}
