"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { REGULATIONS, type Regulation } from "@ots/core";
import { regulationData } from "@ots/core/game-data";
import {
  boxSpecies,
  boxTiles,
  displaySpecies,
  emptySet,
  validateTeam,
  type Problem,
  type ValidationResult,
} from "@ots/core/teams";
import { browserBox } from "@/lib/box";
import {
  checkTeam,
  DEFAULT_NAME,
  draftPaste,
  filled,
  SLOTS,
  type Draft,
} from "@/lib/builder";
import { useBuilder } from "@/lib/builder-store";
import { BuilderSlot } from "./builder-slot";
import { Modal } from "./modal";
import { NotInBox } from "./not-in-box";
import { PasteDialog } from "./paste-dialog";
import { PokemonSprite } from "./pokemon-sprite";

// Regulations with rules to build for, newest first.
const BUILDABLE = REGULATIONS.map((r) => r.id)
  .filter((id) => regulationData[id])
  .reverse();

/** Where the selected slot ends up when one slot moves to another. */
function followMove(selected: number, from: number, to: number): number {
  if (selected === from) return to;
  if (from < selected && selected <= to) return selected - 1;
  if (to <= selected && selected < from) return selected + 1;
  return selected;
}

/**
 * One team: its name and regulation, a strip of its six slots (drag one,
 * or use its arrows, to reorder), and the selected slot's set. Changes are
 * saved as they're made.
 */
export function BuilderTeam({ draft }: { draft: Draft }) {
  const renameDraft = useBuilder((s) => s.renameDraft);
  const setRegulation = useBuilder((s) => s.setRegulation);
  const moveSlot = useBuilder((s) => s.moveSlot);
  const updateSet = useBuilder((s) => s.updateSet);
  const replaceSets = useBuilder((s) => s.replaceSets);
  const [slot, setSlot] = useState(0);
  // Check team's result, shown in a modal until it's closed.
  const [checked, setChecked] = useState<ValidationResult | null>(null);
  const [editingText, setEditingText] = useState(false);
  // Counts saves from Import / Export, so the open slot's fields start
  // over with the new team.
  const [saves, setSaves] = useState(0);
  // The player's box, to mark Pokémon they don't have; null if they've
  // never set one up. The builder runs in the browser, so this reads the
  // cookie directly.
  const [owned] = useState(() => browserBox(boxTiles().map((t) => t.id)));
  // What's wrong with the team as it stands (an unfinished set isn't).
  const problems = useMemo(
    () =>
      validateTeam({ sets: draft.sets }, draft.regulation, { complete: false }),
    [draft.sets, draft.regulation],
  );
  // The slot being dragged, and the one it's over.
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const panelId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Left and right move between slots, as in any tab list.
  function onTabKey(event: KeyboardEvent, index: number) {
    const to =
      event.key === "ArrowRight"
        ? (index + 1) % SLOTS
        : event.key === "ArrowLeft"
          ? (index + SLOTS - 1) % SLOTS
          : null;
    if (to === null) return;
    event.preventDefault();
    setSlot(to);
    tabs.current[to]?.focus();
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= SLOTS || from === to) return;
    moveSlot(draft.id, from, to);
    setSlot((selected) => followMove(selected, from, to));
  }

  return (
    <div className="space-y-5">
      <Link
        href="/builder"
        className="inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Your teams
      </Link>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 basis-56">
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Team name
          </span>
          <input
            type="text"
            value={draft.name}
            placeholder={DEFAULT_NAME}
            maxLength={80}
            onChange={(e) => renameDraft(draft.id, e.target.value)}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-neutral-500"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-neutral-600">
            Regulation
          </span>
          <select
            value={draft.regulation}
            onChange={(e) =>
              setRegulation(draft.id, e.target.value as Regulation)
            }
            className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-sm"
          >
            {BUILDABLE.map((id) => (
              <option key={id} value={id}>
                Reg {id}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setChecked(checkTeam(draft))}
          className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Check team
        </button>
        <button
          type="button"
          onClick={() => setEditingText(true)}
          className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
        >
          Import / Export
        </button>
      </div>

      {editingText && (
        <PasteDialog
          title="Import / Export"
          intro="The team as a Showdown paste: copy it, edit it, or replace it with another paste, RK9 team list or PokePaste link. Saving replaces the team's Pokémon."
          initialText={draftPaste(draft)}
          submitLabel="Save"
          copyable
          onSubmit={({ sets }) => {
            replaceSets(draft.id, sets);
            setSlot(0);
            setSaves((n) => n + 1);
          }}
          onClose={() => setEditingText(false)}
        />
      )}

      {checked && (
        <CheckDialog
          report={checked}
          regulation={draft.regulation}
          names={draft.sets.map((s) => displaySpecies(s)?.name ?? null)}
          onJump={(i) => {
            setSlot(i);
            tabs.current[i]?.focus();
          }}
          onClose={() => setChecked(null)}
        />
      )}

      <div
        role="tablist"
        aria-label="Team slots"
        className="grid grid-cols-6 gap-1.5"
      >
        {draft.sets.map((set, i) => {
          const species = displaySpecies(set);
          const selected = i === slot;
          const name = species?.name ?? `Slot ${i + 1}`;
          return (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDragging(i);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging !== null) move(dragging, i);
                setDragging(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              className={`group/slot relative min-w-0 rounded-lg border ${
                selected
                  ? "border-neutral-900 bg-white"
                  : over === i && dragging !== i
                    ? "border-neutral-500 bg-neutral-50"
                    : "border-neutral-200 bg-neutral-50 hover:border-neutral-400"
              } ${dragging === i ? "opacity-50" : ""}`}
            >
              <button
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${panelId}-tab-${i}`}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSlot(i)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`flex w-full min-w-0 cursor-pointer flex-col items-center gap-1 px-1 pt-5 pb-2 text-xs ${
                  selected ? "text-neutral-900" : "text-neutral-600"
                }`}
              >
                {filled(set) ? (
                  <PokemonSprite
                    key={species?.spriteId}
                    name={species?.name ?? "Pokémon"}
                    spriteId={species?.spriteId ?? null}
                    shiny={set.shiny}
                    size={48}
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-12 items-center justify-center text-xl text-neutral-400"
                  >
                    +
                  </span>
                )}
                <span className="flex w-full min-w-0 items-center justify-center gap-0.5">
                  <span className="truncate">{name}</span>
                  {filled(set) &&
                    owned &&
                    !owned.has(boxSpecies(set.speciesId!)) && <NotInBox />}
                </span>
              </button>
              {/* Shown on the selected slot, and on others when hovered. */}
              <div
                className={`absolute inset-x-0.5 top-0.5 flex justify-between ${
                  selected
                    ? ""
                    : "invisible group-focus-within/slot:visible group-hover/slot:visible"
                }`}
              >
                <CardButton
                  label={`Move ${name} left`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ←
                </CardButton>
                {filled(set) && (
                  <CardButton
                    label={`Remove ${name}`}
                    disabled={false}
                    danger
                    onClick={() => updateSet(draft.id, i, emptySet())}
                  >
                    <TrashIcon />
                  </CardButton>
                )}
                <CardButton
                  label={`Move ${name} right`}
                  disabled={i === SLOTS - 1}
                  onClick={() => move(i, i + 1)}
                >
                  →
                </CardButton>
              </div>
            </div>
          );
        })}
      </div>

      <section
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-tab-${slot}`}
      >
        <BuilderSlot
          key={`${slot}-${saves}`}
          draft={draft}
          slot={slot}
          owned={owned}
          problems={{
            errors: problems.errors.filter((p) => p.slot === slot + 1),
            warnings: problems.warnings.filter((p) => p.slot === slot + 1),
          }}
        />
      </section>
    </div>
  );
}

/** A small button in a slot card's top edge: an arrow, or remove. */
function CardButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-5 cursor-pointer items-center justify-center rounded text-xs text-neutral-600 hover:bg-neutral-200 ${danger ? "hover:text-red-700" : "hover:text-neutral-900"} ${
        disabled ? "invisible" : ""
      }`}
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5"
    >
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5h6.6L12 4M6.75 6.5v4.5M9.25 6.5v4.5" />
    </svg>
  );
}

/**
 * Check team's result in a modal, as Showdown's Validate gives: ready, or
 * every problem with its Pokémon (clicking one closes this and opens that
 * slot), then warnings. It shows the team as it was when checked.
 */
function CheckDialog({
  report,
  regulation,
  names,
  onJump,
  onClose,
}: {
  report: ValidationResult;
  regulation: string;
  /** Each slot's Pokémon, by slot index. */
  names: (string | null)[];
  onJump: (slot: number) => void;
  onClose: () => void;
}) {
  const ready = report.errors.length === 0;
  const count = report.errors.length;
  const line = (
    problem: Problem,
    i: number,
    tone: "error" | "warning",
    close: () => void,
  ) => {
    const who = problem.slot ? names[problem.slot - 1] : null;
    const text = (
      <>
        {who && <span className="font-medium text-neutral-900">{who}: </span>}
        <span className={tone === "error" ? "text-red-700" : "text-amber-700"}>
          {problem.message}
        </span>
      </>
    );
    return (
      <li key={`${tone}-${i}`}>
        {problem.slot ? (
          <button
            type="button"
            onClick={() => {
              close();
              onJump(problem.slot! - 1);
            }}
            className="cursor-pointer text-left hover:underline"
          >
            {text}
          </button>
        ) : (
          text
        )}
      </li>
    );
  };

  return (
    <Modal
      onClose={onClose}
      title={
        <>
          <span
            aria-hidden
            className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs text-white ${ready ? "bg-emerald-600" : "bg-red-600"}`}
          >
            {ready ? "✓" : "!"}
          </span>
          {ready
            ? `Your team is ready for Reg ${regulation}.`
            : `Your team isn't ready for Reg ${regulation}.`}
        </>
      }
    >
      {(close) => (
        <>
          {!ready && (
            <>
              <p className="mt-3 text-neutral-600">
                {count === 1
                  ? "Fix this problem:"
                  : `Fix these ${count} problems:`}
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-red-300">
                {report.errors.map((p, i) => line(p, i, "error", close))}
              </ul>
            </>
          )}
          {report.warnings.length > 0 && (
            <>
              <p className="mt-3 text-neutral-600">Worth knowing:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-amber-300">
                {report.warnings.map((p, i) => line(p, i, "warning", close))}
              </ul>
            </>
          )}
          <form method="dialog" className="mt-5 flex justify-end">
            <button
              autoFocus
              className="cursor-pointer rounded-lg bg-neutral-900 px-4 py-1.5 font-medium text-white hover:bg-neutral-700"
            >
              OK
            </button>
          </form>
        </>
      )}
    </Modal>
  );
}
