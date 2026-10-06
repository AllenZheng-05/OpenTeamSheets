import { TEAM_PASTE_MAX_AGE } from "@ots/core/config";
import { teamShowdown } from "@/lib/teams";

/**
 * A team as a Showdown paste, for Copy team on search results. A team's
 * sets never change once imported, so browsers and the CDN keep it.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/teams/[id]/showdown">,
) {
  const paste = await teamShowdown((await context.params).id);
  if (paste === null) return new Response("No such team", { status: 404 });
  return new Response(paste, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, max-age=${TEAM_PASTE_MAX_AGE}, immutable`,
    },
  });
}
