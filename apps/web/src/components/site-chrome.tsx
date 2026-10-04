import Link from "next/link";
import { SearchShortcut } from "./search-shortcut";
import { SiteTabs } from "./site-tabs";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Open Team Sheets
        </Link>
        <SiteTabs />
        <SearchShortcut />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-neutral-500 sm:flex-row sm:justify-between">
        <p>
          Open Team Sheets is an unofficial fan project, not affiliated with or
          endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
          Sprites from Pokémon Showdown.
        </p>
        <a
          href="https://github.com/AllenZheng-05/OpenTeamSheets"
          className="shrink-0 underline-offset-2 hover:underline"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
