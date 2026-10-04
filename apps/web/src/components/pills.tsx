// Small labels. Type pills carry each type's usual colour; amber marks a
// team sheet's errors; everything else stays neutral.

const TYPE_COLORS: Record<string, string> = {
  normal: "#9fa19f",
  fire: "#e62829",
  water: "#2980ef",
  electric: "#fac000",
  grass: "#3fa129",
  ice: "#3dcef3",
  fighting: "#ff8000",
  poison: "#9141cb",
  ground: "#915121",
  flying: "#81b9ef",
  psychic: "#ef4179",
  bug: "#91a119",
  rock: "#afa981",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#624d4e",
  steel: "#60a1b8",
  fairy: "#ef70ef",
};

// Light backgrounds need dark text to stay readable.
const DARK_TEXT = new Set(["electric", "ice", "normal", "rock", "flying"]);

export function TypePill({ type }: { type: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        backgroundColor: TYPE_COLORS[type] ?? "#9fa19f",
        color: DARK_TEXT.has(type) ? "#171717" : "#ffffff",
      }}
    >
      {type}
    </span>
  );
}

/** How far a player went at the event. */
export function StageBadge({ stage }: { stage: "top-cut" | "day-2" }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
        stage === "top-cut"
          ? "bg-neutral-900 text-white"
          : "bg-neutral-100 text-neutral-700"
      }`}
    >
      {stage === "top-cut" ? "Top cut" : "Day 2"}
    </span>
  );
}

/** A team sheet with errors as published, such as a move it can't learn. */
export function SheetErrorsBadge() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-amber-900">
      Sheet errors
    </span>
  );
}

/** An online tournament, rather than an official Play! Pokémon event. */
export function OnlineBadge() {
  return (
    <span className="ml-1.5 rounded border border-neutral-300 px-1 py-px align-[1px] text-[10px] font-medium tracking-wide text-neutral-600 uppercase">
      Online
    </span>
  );
}

export function ArchetypePill({ name }: { name: string }) {
  return (
    <span className="rounded-full border border-neutral-200 px-2 py-0.5 text-xs text-neutral-600">
      {name}
    </span>
  );
}
