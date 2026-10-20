"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Regulation } from "@ots/core";
import type { TeamSet } from "@ots/core/teams";

/**
 * Opens a team in the builder as a new draft, leaving the teams already
 * there alone. Given the sets (a team page) it uses them; given only the
 * team (a search result) it fetches them on click. The builder's store,
 * and its game data, load on click too, so pages don't carry them.
 */
export function OpenInBuilderButton({
  teamId,
  name,
  team,
}: {
  teamId: string;
  /** What to call the new draft, such as "Wolfe · 1st at Baltimore". */
  name: string;
  team?: { regulation: Regulation; sets: TeamSet[] };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "opening" | "failed">("idle");

  async function open() {
    setState("opening");
    try {
      const [{ useBuilder }, loaded] = await Promise.all([
        import("@/lib/builder-store"),
        team ??
          fetch(`/api/teams/${teamId}/sets`).then((response) => {
            if (!response.ok) throw new Error(`Sets: ${response.status}`);
            return response.json() as Promise<{
              regulation: Regulation;
              sets: TeamSet[];
            }>;
          }),
      ]);
      const id = useBuilder
        .getState()
        .openTeam({ name, ...loaded, sourceTeamId: teamId });
      router.push(`/builder?team=${id}`);
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={state === "opening"}
      className="cursor-pointer rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium whitespace-nowrap text-neutral-900 transition-colors hover:bg-neutral-50 disabled:cursor-default disabled:opacity-60"
    >
      {/* Every label in the same spot, only the current one shown, so the
          button keeps the width of the longest. */}
      <span className="inline-grid">
        {(
          [
            ["idle", "Open in builder"],
            ["opening", "Opening…"],
            ["failed", "Couldn't open"],
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
    </button>
  );
}
