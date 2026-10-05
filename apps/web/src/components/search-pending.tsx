"use client";

import {
  createContext,
  useContext,
  useTransition,
  type ReactNode,
  type TransitionStartFunction,
} from "react";

// Whether a search is loading, shared by the search bar (which starts it)
// and the results (which fade while the next ones load).

const SearchPendingContext = createContext<{
  pending: boolean;
  startTransition: TransitionStartFunction;
} | null>(null);

export function SearchPendingProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return (
    <SearchPendingContext value={{ pending, startTransition }}>
      {children}
    </SearchPendingContext>
  );
}

/** The shared search transition, or null outside a provider. */
export const useSearchPending = () => useContext(SearchPendingContext);

/** Results, faded and marked busy while the next search loads. */
export function SearchResultsFade({ children }: { children: ReactNode }) {
  const pending = useSearchPending()?.pending ?? false;
  return (
    <div
      aria-busy={pending}
      className={`space-y-5 transition-opacity ${pending ? "pointer-events-none opacity-50" : ""}`}
    >
      {children}
    </div>
  );
}
