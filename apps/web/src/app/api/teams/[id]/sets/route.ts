import { TEAM_PASTE_MAX_AGE } from "@ots/core/config";
import { teamSets } from "@/lib/teams";

/**
 * A team's sets and regulation, for Open in builder on search results. A
 * team's sets never change once imported, so browsers and the CDN keep it.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/teams/[id]/sets">,
) {
  const team = await teamSets((await context.params).id);
  if (team === null) {
    return Response.json({ error: "No such team" }, { status: 404 });
  }
  return Response.json(team, {
    headers: {
      "Cache-Control": `public, max-age=${TEAM_PASTE_MAX_AGE}, immutable`,
    },
  });
}
