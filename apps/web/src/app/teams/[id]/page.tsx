import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BackLink } from "@/components/back-link";
import { CopyTeamButton } from "@/components/copy-team-button";
import { ArchetypePill, OnlineBadge, StageBadge } from "@/components/pills";
import { TeamSheet } from "@/components/team-sheet";
import { count, placement } from "@/lib/format";
import { cachedTeamPage, resultTotals, type TeamPage } from "@/lib/teams";

// The page and its metadata both need the team; this loads it once per
// request, from a cache that lasts until the next import.
const loadTeam = cache(cachedTeamPage);

export async function generateMetadata({
  params,
}: PageProps<"/teams/[id]">): Promise<Metadata> {
  const team = await loadTeam((await params).id);
  if (!team) return { title: "Team not found" };
  const top = team.placements[0];
  const title = top
    ? `${top.player}${top.placement ? ` · ${placement(top.placement)}` : ""} at ${top.event.name}`
    : "Team";
  const description = team.pokemon.map((p) => p.name).join(", ");
  return { title, description, openGraph: { title, description } };
}

export default async function TeamPage({ params }: PageProps<"/teams/[id]">) {
  const team = await loadTeam((await params).id);
  if (!team) notFound();

  const top = team.placements[0];
  const statPointsUnknown = team.pokemon.some((p) => p.statPoints === null);

  return (
    <article className="space-y-6">
      <BackLink />

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {top?.player ?? "Team"}
            {top?.placement && (
              <span className="text-neutral-500">
                {" "}
                · {placement(top.placement)}
              </span>
            )}
          </h1>
          {top && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
              {top.record && <span>{top.record}</span>}
              {top.stage && <StageBadge stage={top.stage} />}
              <span>
                {top.event.name}
                {!top.event.official && <OnlineBadge />} · {top.event.dates} ·
                Regulation {team.regulation}
              </span>
            </p>
          )}
          {team.archetypes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {team.archetypes.map((a) => (
                <ArchetypePill key={a.id} name={a.name} />
              ))}
            </div>
          )}
        </div>
        <CopyTeamButton paste={team.showdown} variant="solid" />
      </header>

      <TeamSheet pokemon={team.pokemon} variant="full" />

      {team.sheetErrors.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h2 className="font-semibold text-amber-900">
            This team sheet has errors as published
          </h2>
          <p className="mt-1 text-amber-900/80">
            It&apos;s shown exactly as listed in the official results. Where a
            typo&apos;s meaning seems clear, our reading is marked
            &ldquo;probably&rdquo;; it&apos;s a guess and isn&apos;t applied.
            Showdown will reject the copied team until these are fixed.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-950">
            {team.sheetErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}

      {statPointsUnknown && (
        <p className="text-sm text-neutral-500">
          Stat points aren&apos;t public on official team sheets.
        </p>
      )}

      {team.placements.length > 0 && (
        <TournamentResults placements={team.placements} />
      )}

      {team.media.length > 0 && (
        <section className="space-y-2 border-t border-neutral-200 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Videos
          </h2>
          <ul className="space-y-2 text-sm">
            {team.media.map((m) => (
              <li key={m.url}>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {m.title ?? MEDIA_LABELS[m.kind] ?? "Video"} ↗
                </a>
                {m.startSeconds !== null && (
                  <span className="text-neutral-500">
                    {" "}
                    from {timestamp(m.startSeconds)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2 hover:text-neutral-900"
    >
      {children} ↗
    </a>
  );
}

const MEDIA_LABELS: Record<string, string> = {
  stream_vod: "Stream VOD",
  youtube: "YouTube video",
  replay: "Replay",
};

/** 3721 → "1:02:01". */
function timestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Every tournament result with this team: totals, then official results
 * and online ones, each best first.
 */
function TournamentResults({
  placements,
}: {
  placements: TeamPage["placements"];
}) {
  const totals = resultTotals(placements);
  // Results come best first, official before online.
  const official = placements.filter((p) => p.event.official);
  const online = placements.filter((p) => !p.event.official);
  const plural = (n: number, one: string, many: string) =>
    `${count(n)} ${n === 1 ? one : many}`;
  const stat = (label: string, value: React.ReactNode, note?: string) => (
    <div className="rounded-xl border border-neutral-200 px-4 py-3">
      <dt className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">
        {value}
        {note && (
          <span className="block truncate text-xs font-normal text-neutral-500">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
  const bestFinish = (label: string, results: typeof placements) => {
    const best = results[0];
    return stat(
      label,
      best?.placement ? placement(best.placement) : "—",
      best ? best.event.name : "None yet",
    );
  };

  return (
    <section className="space-y-4 border-t border-neutral-200 pt-5">
      <h2 className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        Tournament results
      </h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stat(
          "Times used",
          count(totals.uses),
          `${count(totals.official)} official · ${count(totals.online)} online`,
        )}
        {bestFinish("Best official", official)}
        {bestFinish("Best online", online)}
        {stat("Top cuts", count(totals.topCuts))}
        {stat("Day 2s", count(totals.dayTwos), "Including top cuts")}
        {stat(
          "Record",
          totals.record
            ? `${plural(totals.record.wins, "win", "wins")} - ${plural(totals.record.losses, "loss", "losses")}`
            : "—",
        )}
      </dl>
      <div className="grid gap-6 md:grid-cols-2">
        <ResultList label="Official" results={official} />
        <ResultList label="Online" results={online} />
      </div>
    </section>
  );
}

/** One side of a team's results: official or online, best first. */
function ResultList({
  label,
  results,
}: {
  label: string;
  results: TeamPage["placements"];
}) {
  return (
    <div className="min-w-0 space-y-2">
      <h3 className="text-sm font-semibold text-neutral-900">
        {label}{" "}
        <span className="font-normal text-neutral-500">
          ({count(results.length)})
        </span>
      </h3>
      {results.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No {label.toLowerCase()} results yet.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {results.map((p) => (
            <li key={p.id}>
              <p className="flex flex-wrap items-center gap-x-1.5">
                <span>
                  {p.placement ? `${placement(p.placement)} · ` : ""}
                  {p.player}
                  {p.record ? ` · ${p.record}` : ""} at {p.event.name}
                </span>
                {p.stage && <StageBadge stage={p.stage} />}
              </p>
              <p className="space-x-3 text-neutral-500">
                {p.teamlistUrl && (
                  <ExternalLink href={p.teamlistUrl}>
                    Teamlist on Limitless
                  </ExternalLink>
                )}
                {p.event.standingsUrl && (
                  <ExternalLink href={p.event.standingsUrl}>
                    Standings on Limitless
                  </ExternalLink>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
