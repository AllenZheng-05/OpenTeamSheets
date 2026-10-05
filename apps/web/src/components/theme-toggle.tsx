"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const dark = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme showing: the one chosen, or the device's. */
function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return dark().matches ? "dark" : "light";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = dark();
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

/**
 * Switches between light and dark, remembering the choice in this browser
 * (the layout applies it before the page paints). Until it's used, the
 * site follows the device's setting.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage unavailable: the choice lasts until the page closes.
    }
    listeners.forEach((listener) => listener());
  }

  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    >
      {/* Before it knows the theme (while rendering on the server), it
          shows nothing rather than guess. */}
      {theme === "dark" ? (
        // A sun: switches to light.
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4" />
        </svg>
      ) : theme === "light" ? (
        // A moon: switches to dark.
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        >
          <path d="M16.5 12.5A7 7 0 0 1 7.5 3.5a7 7 0 1 0 9 9Z" />
        </svg>
      ) : null}
    </button>
  );
}
