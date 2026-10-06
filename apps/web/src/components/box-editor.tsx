"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getCurrentRegulation } from "@ots/core";
import { fold } from "@/lib/search-query";
import {
  BOX_COOKIE,
  BOX_GROUP_COOKIE,
  BOX_SORT_COOKIE,
  BOX_SORTS,
  browserCookie,
  decodeBox,
  readBoxSort,
  saveBox,
  saveBoxGroup,
  saveBoxSort,
  groupByAdded,
  sortTiles,
  type BoxSort,
  type BoxTileView,
} from "@/lib/box";
import { TypePill } from "./pills";
import { BoxHelp } from "@/components/box-help";
import { PokemonSprite } from "./pokemon-sprite";
import { BoxGridSkeleton } from "./box-skeleton";

/** How long a touch must rest on a tile before dragging selects. */
const LONG_PRESS_MS = 300;
/** How far a touch can move before it's a scroll, not a press. */
const SCROLL_SLOP_PX = 8;

/**
 * The Pokémon a player owns, as a grid to tick off. Click or tap a tile to
 * toggle it, or drag across tiles: starting on one you don't have adds
 * everything you pass over, starting on one you have removes. On touch
 * screens, press briefly before dragging so scrolling still works.
 * Arrow keys move, Space toggles, and Shift with an arrow carries the
 * current tile's state to the next. Changes are saved straight away.
 */
export function BoxEditor({
  tiles: baseTiles,
  regulations,
}: {
  /** Every box Pokémon; usage is loaded here. */
  tiles: BoxTileView[];
  /** Every regulation, oldest first, for grouping by when one was added. */
  regulations: string[];
}) {
  // The regulation usage is from: the current one by this browser's clock,
  // so the page itself never needs rebuilding when a regulation starts.
  const [regulation] = useState(() => getCurrentRegulation());
  // Rendered in the browser only (BoxEditorLoader), so it starts from the
  // player's cookies directly.
  const [sort, setSort] = useState(() =>
    readBoxSort(browserCookie(BOX_SORT_COOKIE)),
  );
  const [grouped, setGrouped] = useState(
    () => browserCookie(BOX_GROUP_COOKIE) === "1",
  );
  // Usage, from a cached route the daily import keeps current.
  const [usage, setUsage] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    let current = true;
    void fetch(`/api/box-usage?regulation=${encodeURIComponent(regulation)}`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, number>) => {
        if (current) setUsage(data);
      })
      .catch(() => {
        if (current) setUsage({});
      });
    return () => {
      current = false;
    };
  }, [regulation]);
  const tiles = useMemo(
    () => baseTiles.map((t) => ({ ...t, usage: usage?.[t.id] ?? 0 })),
    [baseTiles, usage],
  );
  const changeGrouped = (next: boolean) => {
    setGrouped(next);
    saveBoxGroup(next);
  };
  const changeSort = (next: BoxSort) => {
    setSort(next);
    saveBoxSort(next);
  };
  const [owned, setOwned] = useState(() =>
    decodeBox(
      browserCookie(BOX_COOKIE),
      baseTiles.map((t) => t.id),
    ),
  );
  const [query, setQuery] = useState("");
  const ids = useMemo(() => tiles.map((t) => t.id), [tiles]);
  const gridRef = useRef<HTMLDivElement>(null);
  // The drag in progress: whether it adds or removes, and for touch,
  // whether the long press has started it yet.
  const drag = useRef<{
    add: boolean;
    active: boolean;
    pointerType: string;
    startX: number;
    startY: number;
    timer?: ReturnType<typeof setTimeout>;
    startId: string;
  } | null>(null);

  const shown = useMemo(() => {
    const q = fold(query);
    const sorted = sortTiles(tiles, sort);
    return q ? sorted.filter((t) => fold(t.name).includes(q)) : sorted;
  }, [tiles, query, sort]);
  const groups = useMemo(
    () =>
      grouped
        ? groupByAdded(shown, regulations)
        : [{ regulation: null, tiles: shown }],
    [grouped, shown, regulations],
  );
  // Grouping reorders the tiles; keyboard moves follow what's on screen.
  const ordered = useMemo(() => groups.flatMap((g) => g.tiles), [groups]);

  const first = useRef(true);
  useEffect(() => {
    // Saving on the first render would only rewrite what's there.
    if (first.current) {
      first.current = false;
      return;
    }
    saveBox(owned, ids);
  }, [owned, ids]);

  const set = (id: string, add: boolean) =>
    setOwned((current) => {
      if (current.has(id) === add) return current;
      const next = new Set(current);
      if (add) next.add(id);
      else next.delete(id);
      return next;
    });

  const tileAt = (x: number, y: number) =>
    (
      document.elementFromPoint(x, y) as HTMLElement | null
    )?.closest<HTMLElement>("[data-tile]")?.dataset.tile;

  // While a touch drag is selecting, the page mustn't scroll.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const stopScroll = (event: TouchEvent) => {
      if (drag.current?.active) event.preventDefault();
    };
    grid.addEventListener("touchmove", stopScroll, { passive: false });
    return () => grid.removeEventListener("touchmove", stopScroll);
  }, []);

  useEffect(() => {
    const end = () => {
      const d = drag.current;
      if (!d) return;
      clearTimeout(d.timer);
      // A quick tap on a touch screen toggles the tile it landed on.
      if (!d.active && d.pointerType !== "mouse") set(d.startId, d.add);
      drag.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  function onPointerDown(event: React.PointerEvent, id: string) {
    if (event.button !== 0) return;
    const add = !owned.has(id);
    drag.current = {
      add,
      active: event.pointerType === "mouse",
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      startId: id,
    };
    if (event.pointerType === "mouse") {
      // No text selection while dragging; focus the tile so the keyboard
      // carries on from it.
      event.preventDefault();
      (event.currentTarget as HTMLElement).focus();
      set(id, add);
    } else {
      drag.current.timer = setTimeout(() => {
        if (!drag.current) return;
        drag.current.active = true;
        set(id, add);
      }, LONG_PRESS_MS);
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    if (!d.active) {
      // A touch that moves before the long press is a scroll.
      const moved = Math.hypot(
        event.clientX - d.startX,
        event.clientY - d.startY,
      );
      if (moved > SCROLL_SLOP_PX) {
        clearTimeout(d.timer);
        drag.current = null;
      }
      return;
    }
    const id = tileAt(event.clientX, event.clientY);
    if (id) set(id, d.add);
  }

  /**
   * The tile a key press moves to from `index` in the tiles as shown:
   * left and right step through them, up and down go to the nearest tile
   * in the row above or below (across groups), Home and End to the ends.
   */
  function moveFrom(index: number, key: string): number | null {
    const buttons = [
      ...(gridRef.current?.querySelectorAll<HTMLElement>("[data-tile]") ?? []),
    ];
    const last = buttons.length - 1;
    if (key === "ArrowRight") return index < last ? index + 1 : null;
    if (key === "ArrowLeft") return index > 0 ? index - 1 : null;
    if (key === "Home") return 0;
    if (key === "End") return last;
    if (key !== "ArrowDown" && key !== "ArrowUp") return null;
    const here = buttons[index]!.getBoundingClientRect();
    const middle = here.left + here.width / 2;
    const rows = buttons
      .map((button, i) => ({ i, rect: button.getBoundingClientRect() }))
      .filter(({ rect }) =>
        key === "ArrowDown"
          ? rect.top > here.bottom - 1
          : rect.bottom < here.top + 1,
      );
    if (rows.length === 0) return null;
    const rowTop =
      key === "ArrowDown"
        ? Math.min(...rows.map((r) => r.rect.top))
        : Math.max(...rows.map((r) => r.rect.top));
    const row = rows.filter((r) => Math.abs(r.rect.top - rowTop) < 1);
    const distance = (r: { rect: DOMRect }) =>
      Math.abs(r.rect.left + r.rect.width / 2 - middle);
    return row.reduce((a, b) => (distance(b) < distance(a) ? b : a)).i;
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const target = moveFrom(index, event.key);
    if (target === null) return;
    event.preventDefault();
    if (event.shiftKey) {
      set(ordered[target]!.id, owned.has(ordered[index]!.id));
    }
    gridRef.current
      ?.querySelectorAll<HTMLElement>("[data-tile]")
      [target]?.focus();
  }

  const [focused, setFocused] = useState(0);

  // One tooltip for every tile, placed over whichever is hovered or has
  // keyboard focus, kept inside the screen.
  const tipId = useId();
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    tile: BoxTileView;
    left: number;
    top: number;
  } | null>(null);
  const showTip = (tile: BoxTileView, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setTip({ tile, left: rect.left + rect.width / 2, top: rect.top });
  };
  useLayoutEffect(() => {
    const element = tipRef.current;
    if (!tip || !element) return;
    const margin = 8;
    const width = element.offsetWidth;
    const left = Math.min(
      Math.max(tip.left - width / 2, margin),
      document.documentElement.clientWidth - width - margin,
    );
    element.style.left = `${left}px`;
    element.style.top = `${tip.top - element.offsetHeight - 4}px`;
  }, [tip]);
  // The tooltip is fixed to the screen, so scrolling would leave it behind.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, [tip]);
  const tabStop = Math.min(focused, Math.max(ordered.length - 1, 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="box-find" className="sr-only">
          Find a Pokémon
        </label>
        <input
          id="box-find"
          type="search"
          autoComplete="off"
          placeholder="Find a Pokémon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ordered[0]) {
              e.preventDefault();
              // The search stays, so the toggled tile stays in view.
              set(ordered[0].id, !owned.has(ordered[0].id));
            } else if (e.key === "Escape") {
              setQuery("");
            }
          }}
          className="w-64 max-w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          Sort
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value as BoxSort)}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-900"
          >
            {BOX_SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => changeGrouped(e.target.checked)}
            className="size-4 accent-neutral-900"
          />
          Group by regulation
        </label>
        <button
          type="button"
          onClick={() => setOwned(new Set(ids))}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setOwned(new Set())}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
        >
          Clear all
        </button>
        <p aria-live="polite" className="ml-auto text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900">{owned.size}</span>{" "}
          of {tiles.length} owned
        </p>
        <BoxHelp />
      </div>

      <div
        ref={gridRef}
        onPointerMove={onPointerMove}
        className="space-y-5 select-none"
      >
        {/* Sorted by usage, the order waits for usage to load. */}
        {sort === "usage" && usage === null ? (
          <BoxGridSkeleton />
        ) : (
          groups.map((group, g) => {
            const offset = groups
              .slice(0, g)
              .reduce((sum, earlier) => sum + earlier.tiles.length, 0);
            const heading =
              group.regulation && `Added in Reg ${group.regulation}`;
            return (
              <section
                key={group.regulation ?? "all"}
                aria-label={heading ?? undefined}
              >
                {heading && (
                  <h2 className="mb-2 text-sm font-semibold text-neutral-900">
                    {heading}{" "}
                    <span className="font-normal text-neutral-500">
                      ({group.tiles.length})
                    </span>
                  </h2>
                )}
                <ul
                  aria-label={heading ?? "Your box"}
                  className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5"
                >
                  {group.tiles.map((tile, groupIndex) => {
                    const index = offset + groupIndex;
                    const has = owned.has(tile.id);
                    return (
                      <li key={tile.id}>
                        <button
                          type="button"
                          data-tile={tile.id}
                          aria-describedby={
                            tip?.tile.id === tile.id ? tipId : undefined
                          }
                          // The shared tooltip: on mouse hover, or keyboard
                          // focus. Taps select instead.
                          onPointerEnter={(e) => {
                            if (e.pointerType === "mouse")
                              showTip(tile, e.currentTarget);
                          }}
                          onPointerLeave={(e) => {
                            if (e.pointerType === "mouse") setTip(null);
                          }}
                          onBlur={() => setTip(null)}
                          aria-pressed={has}
                          tabIndex={index === tabStop ? 0 : -1}
                          onFocus={(e) => {
                            setFocused(index);
                            if (e.currentTarget.matches(":focus-visible")) {
                              showTip(tile, e.currentTarget);
                            }
                          }}
                          onPointerDown={(e) => onPointerDown(e, tile.id)}
                          // Pointers toggle on press; this is Space and Enter.
                          onClick={(e) => {
                            if (e.detail === 0) set(tile.id, !has);
                          }}
                          onKeyDown={(e) => onKeyDown(e, index)}
                          className={`flex w-full flex-col items-center rounded-lg border px-1 pt-1 pb-1.5 text-center transition-colors [&_img]:pointer-events-none ${
                            has
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-neutral-200 bg-white opacity-50 grayscale hover:opacity-80"
                          }`}
                        >
                          <span aria-hidden>
                            <PokemonSprite
                              name={tile.name}
                              spriteId={tile.spriteId}
                              shiny={false}
                              size={56}
                            />
                          </span>
                          <span className="w-full truncate text-xs">
                            {tile.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}
      </div>
      {tip && (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className="pointer-events-none fixed z-30 w-max max-w-48 rounded-lg bg-neutral-900 px-2.5 py-1.5 text-left text-xs text-white shadow-lg"
        >
          <span className="block font-semibold">{tip.tile.name}</span>
          <span className="mt-1 flex gap-1">
            {tip.tile.types.map((type) => (
              <TypePill key={type} type={type} />
            ))}
          </span>
          <span className="mt-1 block text-neutral-300">
            {tip.tile.usage > 0
              ? `On ${formatUsage(tip.tile.usage)} of Reg ${regulation} tournament teams`
              : `Not used on Reg ${regulation} tournament teams yet`}
          </span>
        </div>
      )}
      {shown.length === 0 && (
        <p className="text-sm text-neutral-500">No Pokémon match “{query}”.</p>
      )}
    </div>
  );
}

/** 0.3127 → "31.3%"; small shares keep a digit that shows they're there. */
function formatUsage(share: number): string {
  const percent = share * 100;
  return percent >= 10
    ? `${percent.toFixed(1)}%`
    : `${percent.toPrecision(2)}%`;
}
