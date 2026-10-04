"use client";

import { useId, type ReactNode } from "react";

/**
 * Text with a tooltip that shows on hover or keyboard focus (and on tap,
 * which focuses it). The text is a button so keyboards can reach it; the
 * tooltip is linked to it for screen readers.
 */
export function InfoTip({
  children,
  tip,
}: {
  children: ReactNode;
  tip: ReactNode;
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex max-w-full">
      <button
        type="button"
        aria-describedby={id}
        className="max-w-full cursor-help truncate text-left underline decoration-neutral-300 decoration-dotted underline-offset-4 hover:decoration-neutral-500"
      >
        {children}
      </button>
      <span
        role="tooltip"
        id={id}
        className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1.5 w-64 rounded-lg bg-neutral-900 px-3 py-2 text-xs leading-relaxed font-normal text-white opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {tip}
      </span>
    </span>
  );
}
