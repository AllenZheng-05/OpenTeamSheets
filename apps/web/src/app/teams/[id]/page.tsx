import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BackLink } from "@/components/back-link";
import { CopyTeamButton } from "@/components/copy-team-button";
import { ArchetypePill, StageBadge } from "@/components/pills";
import { TeamSheet } from "@/components/team-sheet";
import { placement } from "@/lib/format";
import { getTeamPage } from "@/lib/teams";

// The page and its metadata both need the team; this loads it once per request.
const loadTeam = cache(getTeamPage);

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
                {top.event.name} · {top.event.dates} · Regulation{" "}
                {team.regulation}
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

      {statPointsUnknown && (
        <p className="text-sm text-neutral-500">
          Stat points aren&apos;t public on official team sheets.
        </p>
      )}

      {(team.placements.length > 0 || team.media.length > 0) && (
        <section className="space-y-2 border-t border-neutral-200 pt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {team.placements.length > 1
              ? `Played by ${team.placements.length} players`
              : "Source"}
          </h2>
          <ul className="space-y-2 text-sm">
            {team.placements.map((p) => (
              <li key={p.id}>
                <p>
                  {p.placement ? `${placement(p.placement)} · ` : ""}
                  {p.player}
                  {p.record ? ` · ${p.record}` : ""} at {p.event.name}
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
