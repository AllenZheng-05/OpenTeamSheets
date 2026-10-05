"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

/**
 * An "i" that shows how the box works, on top of the page without moving
 * anything: while a mouse is over it, while it has keyboard focus, or after
 * a tap or click until the next one (or a tap elsewhere, or Escape).
 */
export function BoxHelp() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const term = "font-medium text-neutral-900";
  return (
    <div ref={root} className="group relative">
      <button
        type="button"
        aria-label="How the box works"
        aria-describedby={panelId}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid size-6 cursor-help place-items-center rounded-full border border-neutral-300 text-xs font-semibold text-neutral-500 group-hover:border-neutral-900 group-hover:text-neutral-900 aria-expanded:border-neutral-900 aria-expanded:text-neutral-900"
      >
        i
      </button>
      {/* The padding bridges the gap, so the pointer can move onto the
          panel (to follow its link) without it closing. */}
      <div
        id={panelId}
        role="tooltip"
        // Out of the layout until shown, so it can't widen the page on a
        // phone. Hover shows it only where there's a pointer to hover with.
        className={`absolute top-full right-0 z-30 pt-2 group-has-focus-visible:block [@media(hover:hover)]:group-hover:block ${open ? "block" : "hidden"}`}
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
