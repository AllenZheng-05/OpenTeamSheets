import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { TeamRow } from "@/components/team-row";
import {
  browsePlacements,
  PAGE_SIZE,
  readStage,
  STAGES,
  type Stage,
} from "@/lib/teams";

export const metadata: Metadata = { title: "Tournament teams" };

/** The query string for a stage and page, leaving out the defaults. */
function query(stage: Stage, page: number): string {
  const params = new URLSearchParams();
  if (stage !== "all") params.set("stage", stage);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/tournament?${text}` : "/tournament";
}

/** Every team played at official tournaments, newest event first. */
export default async function TournamentTeams({
  searchParams,
}: PageProps<"/tournament">) {
  const params = await searchParams;
  const stage = readStage(params.stage);
  const page = Number(params.page ?? 1);
  if (!Number.isInteger(page) || page < 1) notFound();

  const { rows, total } = await browsePlacements(stage, page - 1);
  if (rows.length === 0 && page > 1) notFound();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Tournament teams
        </h1>
        <p className="text-sm text-neutral-500">
          Every team played at official tournaments, newest first.
        </p>
      </header>

      <nav aria-label="Stage" className="flex gap-1">
        {STAGES.map((s) => (
          <Link
            key={s.id}
            href={query(s.id, 1)}
            aria-current={s.id === stage ? "page" : undefined}
            className="rounded-full border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-50 aria-[current=page]:border-neutral-900 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {rows.length > 0 ? (
        <>
          <ol className="space-y-3">
            {rows.map((row) => (
              <li key={row.id}>
                <TeamRow row={row} />
              </li>
            ))}
          </ol>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            href={(n) => query(stage, n)}
          />
        </>
      ) : (
        <EmptyState>
          No tournament teams yet. Official results will appear here once
          they&apos;re imported.
        </EmptyState>
      )}
    </div>
  );
}
