"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { displaySpecies } from "@ots/core/teams";
import { DEFAULT_NAME, orderedDrafts, type Draft } from "@/lib/builder";
import { useBuilder } from "@/lib/builder-store";
import { PokemonSprite } from "./pokemon-sprite";

/**
 * The teams saved in this browser, as cards in the player's order: drag a
 * card (or use its arrows) to reorder, click it to open the team.
 */
export function BuilderTeams() {
  const drafts = useBuilder((s) => s.drafts);
  const order = useBuilder((s) => s.order);
  const newDraft = useBuilder((s) => s.newDraft);
  const moveDraft = useBuilder((s) => s.moveDraft);
  const router = useRouter();
  const teams = orderedDrafts({ drafts, order });
  // The card being dragged, and the place it would drop.
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function create() {
    router.push(`/builder?team=${newDraft()}`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={create}
          className="cursor-pointer rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New team
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center">
          <p className="font-medium">No teams yet</p>
          <p className="mt-1 text-sm text-neutral-500">
            Start one with New team, or open a tournament team in the builder
            from its page.
          </p>
        </div>
      ) : (
        <ol aria-label="Your teams" className="space-y-3">
          {teams.map((draft, index) => (
            <TeamCard
              key={draft.id}
              draft={draft}
              index={index}
              count={teams.length}
              dragging={dragging === draft.id}
              dropHere={over === index && dragging !== draft.id}
              onDragStart={() => setDragging(draft.id)}
              onDragOver={() => setOver(index)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDrop={() => {
                if (dragging) moveDraft(dragging, index);
                setDragging(null);
                setOver(null);
              }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function TeamCard({
  draft,
  index,
  count,
  dragging,
  dropHere,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: {
  draft: Draft;
  index: number;
  count: number;
  dragging: boolean;
  dropHere: boolean;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const moveDraft = useBuilder((s) => s.moveDraft);
  const deleteDraft = useBuilder((s) => s.deleteDraft);
  const name = draft.name.trim() || DEFAULT_NAME;

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draft.id);
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={`relative cursor-grab rounded-xl border bg-white p-4 transition-shadow hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-neutral-900 ${
        dropHere ? "border-neutral-900" : "border-neutral-200"
      } ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            {/* The whole card opens the team. */}
            <Link
              href={`/builder?team=${draft.id}`}
              draggable={false}
              className="outline-none after:absolute after:inset-0 after:rounded-xl"
            >
              {name}
            </Link>
          </h2>
          <p className="text-xs text-neutral-500">Reg {draft.regulation}</p>
        </div>
        <div className="relative z-10 flex shrink-0 gap-0.5">
          <CardButton
            label={`Move ${name} up`}
            disabled={index === 0}
            onClick={() => moveDraft(draft.id, index - 1)}
          >
            ↑
          </CardButton>
          <CardButton
            label={`Move ${name} down`}
            disabled={index === count - 1}
            onClick={() => moveDraft(draft.id, index + 1)}
          >
            ↓
          </CardButton>
          <CardButton
            label={`Delete ${name}`}
            onClick={() => {
              if (window.confirm(`Delete "${name}"? This can't be undone.`)) {
                deleteDraft(draft.id);
              }
            }}
            danger
          >
            ✕
          </CardButton>
        </div>
      </div>
      <ul aria-label="Pokémon" className="mt-3 flex gap-1">
        {draft.sets.map((set, i) => {
          const species = displaySpecies(set);
          return (
            <li key={i}>
              {species ? (
                <PokemonSprite
                  name={species.name}
                  spriteId={species.spriteId}
                  shiny={set.shiny}
                  size={32}
                />
              ) : (
                <span
                  aria-label="Empty slot"
                  role="img"
                  className="block size-8 rounded-full border border-dashed border-neutral-300"
                />
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );
}

function CardButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
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
      className={`flex size-7 cursor-pointer items-center justify-center rounded-md text-sm hover:bg-neutral-100 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent ${
        danger ? "text-red-700" : "text-neutral-600"
      }`}
    >
      {children}
    </button>
  );
}
