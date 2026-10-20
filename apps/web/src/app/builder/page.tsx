import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderLoader } from "@/components/builder-loader";

export const metadata: Metadata = { title: "Builder" };

// The same page for everyone, built once per deploy and served from the
// CDN: the builder runs in the browser, which keeps its teams, and reads
// which team is open from the URL (?team=).

/** Your teams, and the builder for each. */
export default function BuilderPage() {
  return (
    <Suspense>
      <BuilderLoader />
    </Suspense>
  );
}
