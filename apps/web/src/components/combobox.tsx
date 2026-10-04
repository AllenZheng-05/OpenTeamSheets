"use client";

import { useId, useMemo, useState, type ReactNode } from "react";

export interface ComboboxOption {
  /** Unique among the suggestions. */
  key: string;
  name: string;
  /** What Tab or the arrow keys fill the box with; the name if not given. */
  text?: string;
  /** Suggestions with the same group are listed under it. */
  group?: string;
}

/**
 * A text box that suggests options as you type (the ARIA combobox
 * pattern). Tab and Shift+Tab, or the down and up arrows, move through the
 * suggestions and fill the box with each; Enter picks the one shown (or the
 * first); Escape goes back to what was typed, then closes the list.
 * Picking calls onSelect and clears the box, unless `completes` says the
 * option should first be filled in to show what can follow it.
 *
 * The "box" variant is a full search box; the "inline" variant is a bare
 * input that sizes itself to its text, for editing inside something else
 * such as a pill.
 */
export function Combobox<T extends ComboboxOption>({
  label,
  placeholder,
  suggestions,
  onSelect,
  onQueryChange,
  completes,
  before,
  onBackspaceEmpty,
  inputId,
  size = "md",
  end,
  below,
  variant = "box",
  initialText = "",
  autoFocus = false,
  onCancel,
  onSubmit,
}: {
  /** For screen readers; the box shows the placeholder. */
  label: string;
  placeholder: string;
  /** The suggestions for typed text. */
  suggestions: (query: string) => T[];
  onSelect: (option: T) => void;
  /** Called with typed text (not text filled in from a suggestion). */
  onQueryChange?: (query: string) => void;
  inputId?: string;
  size?: "md" | "lg";
  /** Shown inside the box at its right end, such as a button. */
  end?: ReactNode;
  /** Shown inside the box under the text, such as filters. */
  below?: ReactNode;
  /**
   * Whether picking an option fills it in rather than choosing it, given
   * what was typed. Picking it again once filled in chooses it.
   */
  completes?: (option: T, typed: string) => boolean;
  /** Shown inside the box before the text, such as chosen filters. */
  before?: ReactNode;
  /** Backspace in the empty box, such as to remove the last filter. */
  onBackspaceEmpty?: () => void;
  variant?: "box" | "inline";
  /** The text to start with, such as what's being edited. */
  initialText?: string;
  autoFocus?: boolean;
  /**
   * Leaving without picking (Escape with nothing to undo, clicking away,
   * or Enter with no suggestions); the inline variant uses it to stop editing.
   */
  onCancel?: () => void;
  /** Enter with no suggestions to pick, such as in the empty box. */
  onSubmit?: () => void;
}) {
  const listId = useId();
  const id = inputId ?? `${listId}-input`;
  // What was typed, which the suggestions are for, and what the box shows,
  // which moving through the suggestions changes.
  const [typed, setTyped] = useState(initialText);
  const [text, setText] = useState(initialText);
  const [open, setOpen] = useState(autoFocus);
  // The suggestion moved to, or -1 for none.
  const [active, setActive] = useState(-1);

  const shown = useMemo(() => suggestions(typed), [suggestions, typed]);
  const expanded = open && shown.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  function type(value: string) {
    setTyped(value);
    setText(value);
    setActive(-1);
    onQueryChange?.(value);
  }

  function moveTo(index: number) {
    const option = shown[index];
    if (!option) return;
    setActive(index);
    setText(option.text ?? option.name);
    setOpen(true);
    document
      .getElementById(optionId(index))
      ?.scrollIntoView({ block: "nearest" });
  }

  function pick(option: T | undefined) {
    if (!option) return;
    if (completes?.(option, typed)) {
      // Fill it in as if typed, so its own suggestions show.
      type(option.text ?? option.name);
      setOpen(true);
      return;
    }
    onSelect(option);
    type("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const count = shown.length;
    const next = () => (active + 1) % count;
    const previous = () => (active <= 0 ? count - 1 : active - 1);
    if (event.key === "Tab" && expanded) {
      event.preventDefault();
      moveTo(event.shiftKey ? previous() : next());
    } else if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      moveTo(next());
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      moveTo(previous());
    } else if (event.key === "Enter") {
      event.preventDefault();
      // Without one moved to, the suggestion matching the text exactly, or
      // else the first.
      const exact = shown.find(
        (o) =>
          (o.text ?? o.name).trim().toLowerCase() ===
          typed.trim().toLowerCase(),
      );
      if (count > 0) pick(active >= 0 ? shown[active] : (exact ?? shown[0]));
      else if (onSubmit) onSubmit();
      else onCancel?.();
    } else if (event.key === "Backspace" && text === "") {
      onBackspaceEmpty?.();
    } else if (event.key === "Escape") {
      if (active >= 0) {
        setText(typed);
        setActive(-1);
      } else if (expanded && variant === "box") setOpen(false);
      else if (onCancel) onCancel();
      else type("");
    }
  }

  const input = (className: string) => (
    <input
      id={id}
      type="text"
      role="combobox"
      autoComplete="off"
      spellCheck={false}
      autoFocus={autoFocus}
      aria-label={variant === "inline" ? label : undefined}
      aria-expanded={expanded}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={
        expanded && active >= 0 ? optionId(active) : undefined
      }
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        type(event.target.value);
        setOpen(true);
      }}
      onFocus={() => setOpen(true)}
      onBlur={() => {
        setOpen(false);
        onCancel?.();
      }}
      onKeyDown={onKeyDown}
      className={className}
    />
  );

  const list = (className: string) => (
    <ul
      id={listId}
      role="listbox"
      aria-label={label}
      hidden={!expanded}
      className={`absolute top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 text-left text-sm text-neutral-900 shadow-lg ${className}`}
    >
      {shown.map((option, index) => {
        const heading =
          option.group && option.group !== shown[index - 1]?.group
            ? option.group
            : null;
        return (
          <li key={option.key} role="presentation">
            {heading && (
              <p
                aria-hidden
                className="px-3 pt-2 pb-1 text-xs font-bold text-neutral-800"
              >
                {heading}
              </p>
            )}
            <div
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // Keep focus in the box while clicking.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              className="cursor-pointer px-3 py-1.5 hover:bg-neutral-50 aria-selected:bg-neutral-100"
            >
              {option.name}
              {option.group && (
                <span className="sr-only">, {option.group}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const announcement = (
    <p aria-live="polite" className="sr-only">
      {open && typed.trim()
        ? `${shown.length} suggestion${shown.length === 1 ? "" : "s"}`
        : ""}
    </p>
  );

  if (variant === "inline") {
    // A hidden copy of the text sets the width, so the input fits it.
    return (
      <span className="relative inline-grid">
        <span
          aria-hidden
          className="invisible col-start-1 row-start-1 pr-px whitespace-pre"
        >
          {text || placeholder || " "}
        </span>
        {input(
          "col-start-1 row-start-1 w-full min-w-0 bg-transparent outline-none",
        )}
        {list("left-0 w-72")}
        {announcement}
      </span>
    );
  }

  const sizes = size === "lg" ? "px-2 py-3 text-base" : "px-1.5 py-2 text-sm";
  return (
    <div className="rounded-xl border border-neutral-300 bg-white shadow-sm focus-within:border-neutral-500">
      <div className="relative flex items-stretch">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pl-2">
          {before}
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
          {input(
            `min-w-40 flex-1 bg-transparent outline-none placeholder:text-neutral-400 ${sizes}`,
          )}
        </div>
        {end}
        {list("w-full")}
      </div>
      {below}
      {announcement}
    </div>
  );
}
