import Link from "next/link";
import { connection } from "next/server";
import { getCurrentRegulation } from "@ots/core";
import { getRegulationDataStatus } from "@ots/core/game-data";
import { RegulationCountdown } from "@/components/regulation-countdown";

/**
 * The home page: one search bar. Search, with filters and box matching,
 * arrives in milestone 2; until then the bar points to the two tabs.
 */
export default async function Home() {
  // Render on each request, so the regulation is right the moment it changes.
  await connection();
  const regulation = getCurrentRegulation();
  const rulesPending = getRegulationDataStatus(regulation) !== "complete";

  return (
    <div className="flex flex-col items-center pt-16 text-center sm:pt-24">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Open Team Sheets
      </h1>
      <p className="mt-2 text-neutral-500">
        Find, build and share Pokémon Champions VGC teams.
      </p>

      <form role="search" className="mt-8 w-full max-w-xl">
        <label htmlFor="search" className="sr-only">
          Search teams
        </label>
        <input
          id="search"
          type="search"
          disabled
          placeholder="Search teams by Pokémon, player or event"
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base shadow-sm placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:bg-neutral-50"
        />
      </form>
      <p className="mt-3 text-sm text-neutral-500">
        Search is coming soon. For now, browse{" "}
        <Link
          href="/tournament"
          className="text-neutral-900 underline underline-offset-2"
        >
          tournament teams
        </Link>{" "}
        or{" "}
        <Link
          href="/community"
          className="text-neutral-900 underline underline-offset-2"
        >
          community teams
        </Link>
        .
      </p>

      <div className="mt-10 space-y-1 text-sm text-neutral-500">
        <p>
          Current format:{" "}
          <span className="text-neutral-900">Regulation {regulation}</span>
          {rulesPending && " · rules still being added"}
        </p>
        <RegulationCountdown />
      </div>
    </div>
  );
}
