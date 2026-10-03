import Link from "next/link";
import { count } from "@/lib/format";

/**
 * "Showing 26–50 of 1,079" with Previous, page numbers and Next. Pages are
 * numbered from 1 in the URL (`?page=2`); `query` holds the other filters.
 */
export function Pagination({
  page,
  pageSize,
  total,
  href,
}: {
  /** The current page, from 1. */
  page: number;
  pageSize: number;
  total: number;
  /** The link to a page number. */
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  // The first and last pages, plus two either side of the current one.
  const shown = [
    ...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pages]),
  ]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);

  const link =
    "rounded-md px-3 py-1.5 text-sm hover:bg-neutral-100 aria-[current=page]:bg-neutral-900 aria-[current=page]:text-white";

  return (
    <nav
      aria-label="Pages"
      className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-between"
    >
      <p className="text-sm text-neutral-500">
        Showing {count(first)}–{count(last)} of {count(total)}
      </p>
      {pages > 1 && (
        <ol className="flex flex-wrap items-center gap-1">
          {page > 1 && (
            <li>
              <Link href={href(page - 1)} className={link} rel="prev">
                Previous
              </Link>
            </li>
          )}
          {shown.map((n, i) => (
            <li key={n} className="flex items-center gap-1">
              {i > 0 && n - shown[i - 1]! > 1 && (
                <span className="px-1 text-neutral-400" aria-hidden>
                  …
                </span>
              )}
              <Link
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={link}
              >
                {n}
              </Link>
            </li>
          ))}
          {page < pages && (
            <li>
              <Link href={href(page + 1)} className={link} rel="next">
                Next
              </Link>
            </li>
          )}
        </ol>
      )}
    </nav>
  );
}
