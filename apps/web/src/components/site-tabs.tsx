"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/tournament", label: "Tournament" },
  { href: "/community", label: "Community" },
  { href: "/box", label: "My box" },
];

/** The header's tabs, underlining the page you're on. */
export function SiteTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Site"
      className="flex h-11 w-full gap-6 overflow-x-auto sm:h-full sm:w-auto"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center border-b-2 text-sm font-medium whitespace-nowrap ${
              active
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
