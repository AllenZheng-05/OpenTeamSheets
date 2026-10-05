"use client";

import { useState } from "react";

/**
 * Copies a team's Showdown paste, confirming with "Copied". Given the paste
 * (a team page), it copies it straight away; given only the team (a search
 * result, which doesn't carry pastes), it fetches it as part of the copy.
 */
export function CopyTeamButton({
  paste,
  teamId,
  variant = "outline",
}: {
  paste?: string;
  teamId?: string;
  variant?: "outline" | "solid";
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      if (paste !== undefined) {
        await navigator.clipboard.writeText(paste);
      } else {
        const fetched = fetch(`/api/teams/${teamId}/showdown`).then(
          (response) => {
            if (!response.ok) throw new Error(`Paste: ${response.status}`);
            return response.text();
          },
        );
        // Handing the clipboard the download keeps the copy tied to the
        // click; Safari refuses a copy made after awaiting it.
        if (typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/plain": fetched.then(
                (text) => new Blob([text], { type: "text/plain" }),
              ),
            }),
          ]);
        } else {
          await navigator.clipboard.writeText(await fetched);
        }
      }
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
      {/* Every label in the same spot, only the current one shown, so the
          button keeps the width of the longest and nothing beside it moves. */}
      <span className="inline-grid">
        {(
          [
            ["idle", "Copy team"],
            ["copied", "Copied"],
            ["failed", "Couldn't copy"],
          ] as const
        ).map(([key, label]) => (
          <span
            key={key}
            aria-hidden={key !== state}
            className={`col-start-1 row-start-1 ${key === state ? "" : "invisible"}`}
          >
            {label}
          </span>
        ))}
      </span>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? "Team copied in Showdown format" : ""}
      </span>
    </button>
  );
}
