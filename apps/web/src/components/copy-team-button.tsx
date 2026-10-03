"use client";

import { useState } from "react";

/** Copies a team's Showdown paste, confirming with "Copied". */
export function CopyTeamButton({
  paste,
  variant = "outline",
}: {
  paste: string;
  variant?: "outline" | "solid";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(paste);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  const styles =
    variant === "solid"
      ? "bg-neutral-900 text-white hover:bg-neutral-700"
      : "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50";

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${styles}`}
    >
      {state === "copied"
        ? "Copied"
        : state === "failed"
          ? "Couldn't copy"
          : "Copy team"}
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Team copied in Showdown format" : ""}
      </span>
    </button>
  );
}
