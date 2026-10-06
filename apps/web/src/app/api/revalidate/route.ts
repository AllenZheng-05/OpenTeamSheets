import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { TOURNAMENT_DATA_TAG } from "@ots/core/config";

/**
 * Called by the importer when it finishes (apps/worker's refreshSite):
 * drops every cache of tournament data and marks /box for rebuilding.
 * Both refill on their next visit, which the workflows make straight
 * away (warm-cache). Needs REVALIDATE_SECRET as a bearer token.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json(
      { error: "REVALIDATE_SECRET isn't set" },
      { status: 503 },
    );
  }
  const given = request.headers.get("authorization") ?? "";
  if (!matches(given, `Bearer ${secret}`)) {
    return Response.json({ error: "Not allowed" }, { status: 401 });
  }

  // Expired outright, not served stale: the next visit (the workflow's
  // warm-up) waits for fresh data, and everyone after gets it.
  revalidateTag(TOURNAMENT_DATA_TAG, { expire: 0 });
  revalidatePath("/box");
  return Response.json({ revalidated: true });
}

/** Compares in constant time, so the secret can't be guessed by timing. */
function matches(a: string, b: string): boolean {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
