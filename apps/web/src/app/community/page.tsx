import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Community teams" };

/** Published community teams, newest first. Publishing arrives in milestone 5. */
export default function CommunityTeams() {
  return (
    <div className="space-y-5">
      <EmptyState>
        No community teams yet. Published teams will appear here.
      </EmptyState>
    </div>
  );
}
