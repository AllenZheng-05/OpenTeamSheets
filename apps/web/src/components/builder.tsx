"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDraft } from "@/lib/builder-store";
import { BuilderTeam } from "./builder-team";
import { BuilderTeams } from "./builder-teams";

/**
 * The team builder, as in Showdown: the list of teams saved here, or with
 * ?team=<id> in the URL, that team. The URL decides, so the back button
 * returns to the list.
 */
export function Builder() {
  const id = useSearchParams().get("team");
  return id ? <OpenTeam id={id} /> : <BuilderTeams />;
}

function OpenTeam({ id }: { id: string }) {
  const draft = useDraft(id);
  if (!draft) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          This team isn&apos;t saved here
        </h1>
        <p className="text-sm text-neutral-600">
          Teams are saved in the browser they were built in. It may have been
          deleted, or made in another browser.
        </p>
        <Link
          href="/builder"
          className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Your teams
        </Link>
      </div>
    );
  }
  return <BuilderTeam key={id} draft={draft} />;
}
