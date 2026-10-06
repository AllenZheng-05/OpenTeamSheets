/**
 * Tells the site that tournament data changed, so it drops its cached
 * searches, team pages and search bar options and rebuilds /box. The site
 * never checks for new data itself; this call, at the end of each import,
 * is the only signal (see core's config).
 *
 * Needs SITE_URL and REVALIDATE_SECRET (the site's own secret) in the
 * environment or in the env file connect() loaded. A production run
 * without them fails, since the site would otherwise keep its old results
 * for a week. A local run without them skips this: restart `pnpm dev`, or
 * set SITE_URL=http://localhost:3000 and the secret from apps/web/.env.local.
 */
export async function refreshSite(args: string[]): Promise<void> {
  const site = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret) {
    if (args.includes("--prod")) {
      throw new Error(
        "Set SITE_URL and REVALIDATE_SECRET so the site drops its old results",
      );
    }
    console.log("site: not refreshed (SITE_URL and REVALIDATE_SECRET unset)");
    return;
  }
  const response = await fetch(new URL("/api/revalidate", site), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    // A redirect to another host would drop the secret; name it instead.
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `${site} redirects to ${response.headers.get("location")}; set SITE_URL to that`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Refreshing the site: ${response.status} ${await response.text()}`,
    );
  }
  console.log(`site: refreshed (${site})`);
}
