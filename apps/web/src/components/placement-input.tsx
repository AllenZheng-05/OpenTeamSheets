"use client";

import { useId, useState } from "react";
import {
  placementLabel,
  readPlacement,
  TOP_CUTOFFS,
  type Stage,
} from "@/lib/search";

/** The placements the list offers, besides any number typed in. */
const PLACEMENTS: { label: string; stage: Stage; top: number | null }[] = [
  { label: "Any", stage: "all", top: null },
  { label: "Day 2", stage: "day-2", top: null },
  { label: "Top cut", stage: "top-cut", top: null },
  ...TOP_CUTOFFS.map((n) => ({
    label: `Top ${n}`,
    stage: "all" as const,
    top: n,
  })),
];

/**
 * Placement: any, day 2, top cut, or the top so many at each event. Pick
 * from the list, or type a number ("16" or "Top 16").
 */
export function PlacementInput({
  stage,
  top,
  onChange,
}: {
  stage: Stage;
  top: number | null;
  onChange: (stage: Stage, top: number | null) => void;
}) {
  const listId = useId();
  const current = placementLabel(stage, top);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(current);
  // Show the URL's value when it changes, such as on Back.
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    setText(current);
  }

  function apply(value: string) {
    const placement = readPlacement(value);
    setOpen(false);
    if (!placement) {
      setText(current);
      return;
    }
    setText(placementLabel(placement.stage, placement.top));
    if (placement.stage !== stage || placement.top !== top) {
      onChange(placement.stage, placement.top);
    }
  }

  return (
    <div
      className="relative flex items-center gap-1.5 text-sm"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={`${listId}-input`} className="text-neutral-600">
        Placement
      </label>
      <div className="flex items-center rounded-lg border border-neutral-300 bg-white">
        <input
          id={`${listId}-input`}
          type="text"
          autoComplete="off"
          placeholder="Any"
          aria-describedby={`${listId}-hint`}
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(text);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          onBlur={() => apply(text)}
          className="w-20 rounded-l-lg bg-transparent px-2 py-1.5 outline-none placeholder:text-neutral-500"
        />
        <span id={`${listId}-hint`} className="sr-only">
          Type a number for the top that many at each event, or open the list
        </span>
        <button
          type="button"
          aria-label="Placement options"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => setOpen((o) => !o)}
          className="rounded-r-lg px-1.5 py-1.5 text-neutral-500 hover:bg-neutral-100"
        >
          <span aria-hidden>▾</span>
        </button>
      </div>
      {open && (
        <ul
          id={listId}
          className="absolute top-full right-0 z-20 mt-1 w-32 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {PLACEMENTS.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                aria-current={p.stage === stage && p.top === top}
                onClick={() => apply(p.label)}
                className="w-full px-3 py-1.5 text-left hover:bg-neutral-100 aria-[current=true]:font-semibold"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
