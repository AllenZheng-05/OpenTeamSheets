import Link from "next/link";
import { useId } from "react";

/**
 * An "i" that shows how the box works while the pointer is over it (or
 * it has keyboard focus), on top of the page without moving anything.
 */
export function BoxHelp() {
  const panelId = useId();
  const term = "font-medium text-neutral-900";
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="How the box works"
        aria-describedby={panelId}
        className="grid size-6 cursor-help place-items-center rounded-full border border-neutral-300 text-xs font-semibold text-neutral-500 group-hover:border-neutral-900 group-hover:text-neutral-900"
      >
        i
      </button>
      {/* The padding bridges the gap, so the pointer can move onto the
          panel (to follow its link) without it closing. */}
      <div
        id={panelId}
        role="tooltip"
        className="invisible absolute top-full right-0 z-30 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-has-focus-visible:visible group-has-focus-visible:opacity-100"
      >
        <div className="w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-700 shadow-xl">
          <p>
            Mark the Pokémon you own, then search for{" "}
            <Link
              href="/tournament?box=0"
              className="text-neutral-900 underline underline-offset-2"
            >
              teams you can build
            </Link>
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className={term}>Sort</dt>
            <dd>Sort by usage, dex number, or typing</dd>
            <dt className={term}>Click</dt>
            <dd>Add or remove a Pokémon</dd>
            <dt className={term}>Drag</dt>
            <dd>Add or remove multiple Pokémon at a time</dd>
            <dt className={term}>Find</dt>
            <dd>Add or remove specific Pokémon</dd>
            <dt className={term}>Arrow keys</dt>
            <dd>Move between Pokémon</dd>
            <dt className={term}>Space</dt>
            <dd>Add or remove the the currently selected Pokémon</dd>
            <dt className={term}>Shift + arrow</dt>
            <dd>Move and add/remove Pokémon as you go</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
