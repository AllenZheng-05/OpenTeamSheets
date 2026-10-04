"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SEARCH_INPUT_ID } from "./team-search";

/**
 * Pressing "/" focuses the search box, or opens the home page's search
 * from a page without one. Ignored while typing in a field.
 */
export function SearchShortcut() {
  const router = useRouter();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }
      event.preventDefault();
      const input = document.getElementById(SEARCH_INPUT_ID);
      if (input) input.focus();
      else router.push("/");
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);
  return null;
}
