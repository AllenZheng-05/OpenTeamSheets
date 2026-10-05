import Link from "next/link";
import { count, placement } from "@/lib/format";
import type { PlacementRow } from "@/lib/teams";
import { CopyTeamButton } from "./copy-team-button";
import { ArchetypePill, OnlineBadge, SheetErrorsBadge } from "./pills";
import { TeamSheet } from "./team-sheet";

/**
 * One team in a list, readable without clicking. The whole card links to
 * the team's page; Copy team sits above the link so it doesn't open it.
 */
export function TeamRow({
  row,
  owned = null,
}: {
  row: PlacementRow;
  /** The player's box, when searching by it: missing Pokémon are dimmed. */
  owned?: Set<string> | null;
}) {
  return (
    <article className="relative rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-neutral-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        {/* The left column's text wraps within its width rather than
            spilling over the Pokémon. */}
        <div className="flex gap-3 lg:w-48 lg:shrink-0 lg:flex-col">
          <div className="flex min-w-0 flex-1 flex-col wrap-break-word">
            <h2 className="font-semibold">
              <Link
                href={`/teams/${row.teamId}`}
                className="outline-none after:absolute after:inset-0 after:rounded-xl"
              >
                Used by {count(row.uses)}{" "}
                {row.uses === 1 ? "player" : "players"}
                <span className="sr-only">: open team</span>
              </Link>
            </h2>
            {(row.topCuts > 0 || row.dayTwos > 0) && (
              <p className="text-sm text-neutral-500">
                {[
                  row.topCuts > 0 &&
                    `${count(row.topCuts)} top ${row.topCuts === 1 ? "cut" : "cuts"}`,
                  row.dayTwos > 0 &&
                    `${count(row.dayTwos)} day 2${row.dayTwos === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {row.hasSheetErrors && (
              <p className="mt-1">
                <SheetErrorsBadge />
              </p>
            )}
            {row.archetypes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {row.archetypes.map((a) => (
                  <ArchetypePill key={a.id} name={a.name} />
                ))}
              </div>
            )}
            {/* At the bottom of the column, under everything else. */}
            <p className="mt-auto pt-3 text-xs text-neutral-500">
              Best: {row.placement ? placement(row.placement) : "unplaced"}
              {row.bestCount > 1 && <> ×{count(row.bestCount)}</>} at{" "}
              {row.event.name}
              {!row.event.official && <OnlineBadge />}
            </p>
          </div>
          <div className="relative z-10 shrink-0 lg:hidden">
            <CopyTeamButton paste={row.showdown} />
          </div>
        </div>
        <TeamSheet pokemon={row.pokemon} variant="compact" owned={owned} />
        <div className="relative z-10 hidden lg:block lg:shrink-0">
          <CopyTeamButton paste={row.showdown} />
        </div>
      </div>
    </article>
  );
}
