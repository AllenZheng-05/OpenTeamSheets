"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/tournament", label: "Tournament" },
  { href: "/community", label: "Community" },
];

/** The header's tabs, underlining the page you're on. */
export function SiteTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Teams" className="flex h-full gap-6">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center border-b-2 text-sm font-medium ${
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
