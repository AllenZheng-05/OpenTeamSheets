"use client";

import { useId, useState } from "react";
import { isRegulation, type Regulation } from "@ots/core";
import { regulationData } from "@ots/core/game-data";
import { pokePasteId, pokePasteJsonUrl } from "@ots/core/teams";
import { readPastedTeam, type PastedTeam } from "@/lib/builder";
import { CopyTeamButton } from "./copy-team-button";
import { Modal } from "./modal";

/**
 * A pasted team, and when it came from a PokePaste link, its title and the
 * regulation its format names ("gen9championsvgc2026regmc" is M-C).
 */
export type PasteResult = PastedTeam & {
  title: string | null;
  regulation: Regulation | null;
};

/** The regulation a PokePaste's format names, if the builder has its rules. */
const regulationIn = (notes: string | undefined): Regulation | null => {
  const match = notes?.match(/champions\w*reg([a-z])([a-z])\b/i);
  const id = match ? `${match[1]}-${match[2]}`.toUpperCase() : null;
  return id && isRegulation(id) && regulationData[id] ? id : null;
};

/**
 * The text of what was pasted: the text itself, or for a PokePaste link,
 * the paste it links to, fetched from the browser (PokePaste allows it).
 */
async function readPaste(text: string): Promise<PasteResult> {
  const id = pokePasteId(text);
  if (!id) return { ...readPastedTeam(text), title: null, regulation: null };
  const response = await fetch(pokePasteJsonUrl(id));
  if (!response.ok) throw new Error(`PokePaste: ${response.status}`);
  const json = (await response.json()) as {
    paste: string;
    title?: string;
    notes?: string;
  };
  return {
    ...readPastedTeam(json.paste),
    title: json.title?.trim() || null,
    regulation: regulationIn(json.notes),
  };
}

/**
 * A modal for a team as text: a Showdown paste, an RK9 teamlist or a
 * PokePaste link. Lines it can't read are listed before anything changes,
 * with a second press to go ahead without them.
 */
export function PasteDialog({
  title,
  intro,
  initialText = "",
  submitLabel,
  copyable,
  onSubmit,
  onClose,
}: {
  title: string;
  intro: string;
  initialText?: string;
  submitLabel: string;
  /** Offers to copy the text as it stands, edits included. */
  copyable?: boolean;
  onSubmit: (team: PasteResult) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<
    | { kind: "editing" }
    | { kind: "reading" }
    | { kind: "failed"; message: string }
    // Read, with problems: pressing again goes ahead.
    | { kind: "unsure"; team: PasteResult }
  >({ kind: "editing" });
  const fieldId = useId();
  const problemsId = useId();

  async function submit(close: () => void) {
    if (state.kind === "unsure") {
      onSubmit(state.team);
      close();
      return;
    }
    setState({ kind: "reading" });
    let team: PasteResult;
    try {
      team = await readPaste(text);
    } catch {
      setState({
        kind: "failed",
        message:
          "Couldn't fetch that PokePaste. Check the link, or paste its text instead.",
      });
      return;
    }
    if (team.sets.length === 0) {
      setState({
        kind: "failed",
        message:
          "No Pokémon found. Paste a Showdown team, an RK9 team list or a PokePaste link.",
      });
    } else if (team.problems.length > 0) {
      setState({ kind: "unsure", team });
    } else {
      onSubmit(team);
      close();
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(close);
          }}
        >
          <label htmlFor={fieldId} className="mt-1 block text-neutral-600">
            {intro}
          </label>
          <textarea
            id={fieldId}
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (state.kind !== "reading") setState({ kind: "editing" });
            }}
            rows={14}
            spellCheck={false}
            aria-describedby={state.kind === "editing" ? undefined : problemsId}
            placeholder={"Incineroar @ Sitrus Berry\nAbility: Intimidate\n…"}
            className="mt-3 w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-neutral-500"
          />
          <div id={problemsId} aria-live="polite">
            {state.kind === "failed" && (
              <p className="mt-2 text-red-700">{state.message}</p>
            )}
            {state.kind === "unsure" && (
              <div className="mt-2">
                <p className="text-neutral-600">
                  Found {state.team.sets.length} Pokémon, but some lines
                  couldn&apos;t be read and will be left out:
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-700 marker:text-amber-300">
                  {state.team.problems.map((p, i) => (
                    <li key={i}>
                      {p.line ? `Line ${p.line}: ` : ""}
                      {p.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {copyable && (
              <div className="mr-auto">
                <CopyTeamButton paste={text} />
              </div>
            )}
            <button
              type="button"
              onClick={close}
              className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-4 py-1.5 font-medium hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={state.kind === "reading" || text.trim() === ""}
              className="cursor-pointer rounded-lg bg-neutral-900 px-4 py-1.5 font-medium text-white hover:bg-neutral-700 disabled:cursor-default disabled:opacity-50"
            >
              {state.kind === "reading"
                ? "Reading…"
                : state.kind === "unsure"
                  ? `${submitLabel} anyway`
                  : submitLabel}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
