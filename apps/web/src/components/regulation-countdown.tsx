"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getCurrentRegulation, getNextRegulation } from "@ots/core";

// Countdown starts 72 hours before the next regulation
const COUNTDOWN_WINDOW_MS = 72 * 60 * 60 * 1000;
// setTimeout fires immediately for delays above this (about 24.8 days).
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * A live countdown once the next regulation is within 72 hours; nothing
 * otherwise. When it starts, the page reloads its data, so Browse switches
 * to the new regulation without a manual reload.
 */
export function RegulationCountdown() {
  const router = useRouter();
  // Null until mounted, so the server and the first browser render match.
  const [now, setNow] = useState<Date | null>(null);
  const regulationAtLoad = useRef<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function tick() {
      const current = new Date();
      setNow(current);

      const regulation = getCurrentRegulation(current);
      regulationAtLoad.current ??= regulation;
      if (regulation !== regulationAtLoad.current) {
        regulationAtLoad.current = regulation;
        router.refresh();
      }

      const next = getNextRegulation(current);
      if (!next) return;

      // Inside the window, tick on each whole second; otherwise sleep until it opens.
      const untilWindow =
        Date.parse(next.startsAt) - COUNTDOWN_WINDOW_MS - current.getTime();
      const delay =
        untilWindow > 0
          ? Math.min(untilWindow, MAX_TIMEOUT_MS)
          : 1000 - current.getMilliseconds();
      timer = setTimeout(tick, delay);
    }

    tick();
    return () => clearTimeout(timer);
  }, [router]);

  const next = now ? getNextRegulation(now) : undefined;
  const msLeft = now && next ? Date.parse(next.startsAt) - now.getTime() : null;
  if (!next || msLeft === null || msLeft > COUNTDOWN_WINDOW_MS) return null;

  return (
    <p className="text-sm text-neutral-500">
      Regulation {next.id} starts in{" "}
      <time role="timer" dateTime={next.startsAt} className="tabular-nums">
        {formatCountdown(msLeft)}
      </time>
    </p>
  );
}

/** 2d 14h 03m 12s */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days}d ${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
}
