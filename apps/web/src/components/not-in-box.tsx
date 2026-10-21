/** A crossed-out Poké Ball after the name of a Pokémon not in the player's box. */
export function NotInBox() {
  return (
    <span title="Not in your box" className="shrink-0 text-amber-700">
      <span className="sr-only"> (not in your box)</span>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="size-3"
      >
        <circle cx="8" cy="8" r="5.5" />
        <path d="M2.5 8h11" />
        <circle cx="8" cy="8" r="1.6" />
        <path d="M2 14 14 2" />
      </svg>
    </span>
  );
}
