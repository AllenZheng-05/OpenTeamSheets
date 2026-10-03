import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const USER_AGENT =
  "OpenTeamSheets/0.1 (+https://openteamsheets.com; contact@openteamsheets.com)";

/**
 * Fetches pages one at a time, at most one request per `delayMs`, and keeps
 * every response on disk so a page is downloaded once. Used for Limitless,
 * whose site we read rather than an API.
 */
export function createPoliteFetcher({
  cacheDir = path.join(os.homedir(), ".cache", "openteamsheets", "limitless"),
  delayMs = 1000,
}: { cacheDir?: string; delayMs?: number } = {}) {
  let lastRequest = 0;
  let requests = 0;

  const cachePath = (url: string) => {
    const { hostname, pathname } = new URL(url);
    return path.join(cacheDir, hostname, `${pathname.replace(/\/$/, "")}.html`);
  };

  async function download(url: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      const wait = lastRequest + delayMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      requests++;
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (response.ok) return response.text();
      // Back off and retry when the site is busy; give up on anything else.
      const busy = response.status === 429 || response.status >= 500;
      if (!busy || attempt === 3) {
        throw new Error(`${url} answered ${response.status}`);
      }
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * 10 * attempt),
      );
    }
  }

  return {
    /** The page, from the cache unless `refresh` is set or it isn't cached. */
    async get(url: string, { refresh = false } = {}): Promise<string> {
      const file = cachePath(url);
      if (!refresh) {
        try {
          return await readFile(file, "utf8");
        } catch {
          // Not cached yet.
        }
      }
      const html = await download(url);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, html);
      return html;
    },
    /** How many requests were actually sent. */
    get requests() {
      return requests;
    },
  };
}
