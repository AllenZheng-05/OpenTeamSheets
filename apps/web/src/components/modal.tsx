"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A modal on the browser's own <dialog>: it keeps focus inside, closes on
 * Escape or a click outside it, and gives focus back to what opened it.
 * It opens when shown; `children` gets `close` to close it from a button.
 */
export function Modal({
  title,
  onClose,
  wide,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  /** Room for a paste rather than a message. */
  wide?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  // Held in state, not a ref, so `close` can be handed out while rendering.
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const pressedOutside = useRef(false);
  const titleId = useId();
  useEffect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  }, [dialog]);
  const close = () => dialog?.close();

  return (
    <dialog
      ref={setDialog}
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the backdrop lands on the dialog itself. One that starts
      // inside (selecting text, then letting go outside) doesn't close it.
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOutside.current) close();
      }}
      className={`m-auto rounded-xl bg-white text-sm shadow-xl backdrop:bg-neutral-900/40 ${
        wide
          ? "w-[min(40rem,calc(100%-2rem))]"
          : "w-[min(28rem,calc(100%-2rem))]"
      }`}
    >
      <div className="p-5">
        <h2 id={titleId} className="flex items-center gap-2 font-semibold">
          {title}
        </h2>
        {children(close)}
      </div>
    </dialog>
  );
}
