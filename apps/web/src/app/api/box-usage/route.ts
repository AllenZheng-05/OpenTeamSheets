import { supabase } from "@/lib/supabase";

/**
 * How often each box species is used in a regulation's tournament teams,
 * as shares (0 to 1), for sorting the box by usage. The imports store the
 * counts (refresh_box_usage), so this reads a few hundred rows; browsers
 * and the CDN keep the answer for an hour and serve it stale for a day
 * while fetching the next.
 */
export async function GET(request: Request) {
  const regulation = new URL(request.url).searchParams.get("regulation");
  if (!regulation) {
    return Response.json({ error: "regulation is required" }, { status: 400 });
  }
  const { data, error } = await supabase()
    .from("box_usage_stats")
    .select("box_species, placements, total")
    .eq("regulation_id", regulation);
  if (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  return Response.json(
    Object.fromEntries(
      data.map((u) => [u.box_species, u.total ? u.placements / u.total : 0]),
    ),
    {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
