import Link from "next/link";
import { SearchShortcut } from "./search-shortcut";
import { SiteTabs } from "./site-tabs";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 px-4 sm:h-14 sm:flex-nowrap">
        <Link
          href="/"
          className="order-1 py-3 font-semibold tracking-tight whitespace-nowrap sm:py-0"
        >
          Open Team Sheets
        </Link>
        {/* On phones the tabs take a row of their own, below the name and
            the theme toggle; from sm up, all one row. */}
        <div className="order-3 w-full sm:order-2 sm:h-full sm:w-auto">
          <SiteTabs />
        </div>
        <SearchShortcut />
        <div className="order-2 ml-auto flex items-center sm:order-3">
          <ThemeToggle />
        </div>
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
          target="_blank"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
