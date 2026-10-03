"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Back to the list you came from. Coming from this site, it goes back in
 * history, so the scroll position is as it was; otherwise it opens the
 * Tournament tab.
 */
export function BackLink() {
  const router = useRouter();
  return (
    <Link
      href="/tournament"
      onClick={(event) => {
        if (document.referrer.startsWith(window.location.origin)) {
          event.preventDefault();
          router.back();
        }
      }}
      className="text-sm text-neutral-500 hover:text-neutral-900"
    >
      ← Back to teams
    </Link>
  );
}
