/**
 * Champions VGC regulations in order. Each one runs until the next one
 * starts. Add a regulation once it is announced. Search and the builder default to the
 * current regulation, past regulations stay searchable through the filter.
 */
export const REGULATIONS = [
  { id: "M-A", startsAt: "2026-04-08T02:00:00Z" },
  { id: "M-B", startsAt: "2026-06-17T02:00:00Z" },
  { id: "M-C", startsAt: "2026-09-09T02:00:00Z" },
  // Reg M-D not officially announced but can be assumed to start at this time
  { id: "M-D", startsAt: "2026-12-02T02:00:00Z" },
] as const;

export type RegulationSchedule = (typeof REGULATIONS)[number];

export type Regulation = RegulationSchedule["id"];

/** The latest regulation that has started at `now`. */
export function getCurrentRegulation(now: Date = new Date()): Regulation {
  const started = REGULATIONS.filter(
    (regulation) => Date.parse(regulation.startsAt) <= now.getTime(),
  );
  return (started.at(-1) ?? REGULATIONS[0]).id;
}

/** The first regulation that hasn't started at `now`, if one is scheduled. */
export function getNextRegulation(
  now: Date = new Date(),
): RegulationSchedule | undefined {
  return REGULATIONS.find(
    (regulation) => Date.parse(regulation.startsAt) > now.getTime(),
  );
}

export function isRegulation(value: string): value is Regulation {
  return REGULATIONS.some((regulation) => regulation.id === value);
}
