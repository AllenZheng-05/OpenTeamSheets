"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown, inside the site's header and footer, when a page fails to load,
 * such as a search the database took too long on.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong loading this page
      </h1>
      <p className="text-sm text-neutral-600">
        It may have been a busy moment for the database. Trying again usually
        works; if it keeps happening, a narrower search (a regulation, or a
        Pokémon) is quicker.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Home
        </Link>
      </div>
      {error.digest && (
        <p className="pt-4 text-xs text-neutral-400">
          Error reference: {error.digest}
        </p>
      )}
    </div>
  );
}
