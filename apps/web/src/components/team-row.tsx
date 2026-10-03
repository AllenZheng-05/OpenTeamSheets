import Link from "next/link";
import { placement } from "@/lib/format";
import type { PlacementRow } from "@/lib/teams";
import { CopyTeamButton } from "./copy-team-button";
import { ArchetypePill, StageBadge } from "./pills";
import { TeamSheet } from "./team-sheet";

/**
 * One team in a list, readable without clicking. The whole card links to
 * the team's page; Copy team sits above the link so it doesn't open it.
 */
export function TeamRow({ row }: { row: PlacementRow }) {
  const place = row.placement ? placement(row.placement) : null;
  return (
    <article className="relative rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-neutral-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* The left column's text wraps within its width rather than
            spilling over the Pokémon. */}
        <div className="flex gap-3 lg:w-48 lg:shrink-0 lg:flex-col">
          <div className="min-w-0 flex-1 wrap-break-word">
            {(place || row.stage) && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {place}
                {row.record && (
                  <span className="font-normal normal-case tracking-normal">
                    {row.record}
                  </span>
                )}
                {row.stage && <StageBadge stage={row.stage} />}
              </p>
            )}
            <h2 className="font-semibold">
              <Link
                href={`/teams/${row.teamId}`}
                className="outline-none after:absolute after:inset-0 after:rounded-xl"
              >
                {row.player}
                <span className="sr-only">
                  {place ? `, ${place} at ${row.event.name}` : ""}: open team
                </span>
              </Link>
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">{row.event.name}</p>
            <p className="text-xs text-neutral-500">{row.event.dates}</p>
            {row.archetypes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {row.archetypes.map((a) => (
                  <ArchetypePill key={a.id} name={a.name} />
                ))}
              </div>
            )}
          </div>
          <div className="relative z-10 shrink-0 lg:hidden">
            <CopyTeamButton paste={row.showdown} />
          </div>
        </div>
        <TeamSheet pokemon={row.pokemon} variant="compact" />
        <div className="relative z-10 hidden lg:block lg:shrink-0">
          <CopyTeamButton paste={row.showdown} />
        </div>
      </div>
    </article>
  );
}
