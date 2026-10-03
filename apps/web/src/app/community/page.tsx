import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Community teams" };

/** Published community teams, newest first. Publishing arrives in milestone 5. */
export default function CommunityTeams() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Community teams
        </h1>
        <p className="text-sm text-neutral-500">
          Teams published by players, with write-ups on how to use them.
        </p>
      </header>
      <EmptyState>
        No community teams yet. Published teams will appear here.
      </EmptyState>
    </div>
  );
}
