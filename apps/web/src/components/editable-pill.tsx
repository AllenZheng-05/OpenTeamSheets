"use client";

import { useState } from "react";
import type { Choice, Suggestion } from "@/lib/search-query";
import { Combobox } from "./combobox";

/**
 * A chosen filter in the search bar. Clicking its text edits it as search
 * text ("not Charizard with Charizardite Y"), with the same suggestions as
 * the search box; picking one replaces the pill, and Escape, clicking away
 * or text that names nothing leaves it as it was.
 */
export function EditablePill({
  label,
  text,
  suggestions,
  completes,
  onStartEditing,
  onQueryChange,
  onReplace,
  onRemove,
}: {
  label: string;
  text: string;
  suggestions: (query: string) => Suggestion[];
  completes: (suggestion: Suggestion, typed: string) => boolean;
  onStartEditing: () => void;
  onQueryChange: (query: string) => void;
  onReplace: (choice: Choice) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  // Plain pills; an excluded filter says "Not …" in its label.
  const colors = "border-neutral-300 bg-neutral-100 text-neutral-900";

  if (editing) {
    return (
      <li
        className={`flex items-center rounded-full border px-2.5 py-0.5 text-sm ${colors}`}
      >
        <Combobox
          variant="inline"
          label={`Edit ${label}`}
          placeholder=""
          initialText={text}
          autoFocus
          suggestions={suggestions}
          completes={completes}
          onQueryChange={onQueryChange}
          onSelect={(s) => {
            setEditing(false);
            onReplace(s.choice);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li
      className={`flex items-center gap-0.5 rounded-full border py-0.5 pr-1 pl-2.5 text-sm ${colors}`}
    >
      <button
        type="button"
        onClick={() => {
          onStartEditing();
          setEditing(true);
        }}
        title="Edit"
        className="text-left"
      >
        {label}
        <span className="sr-only">. Edit</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full px-1 opacity-60 hover:opacity-100"
      >
        <span aria-hidden>×</span>
        <span className="sr-only">Remove {label}</span>
      </button>
    </li>
  );
}
