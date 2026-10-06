"use client";

import dynamic from "next/dynamic";
import { BoxSkeleton } from "./box-skeleton";

/**
 * The box editor, rendered in the browser only: it reads the player's box
 * from their cookies there, which keeps the page the same for everyone so
 * it can be served from the CDN.
 */
export const BoxEditorLoader = dynamic(
  () => import("./box-editor").then((m) => m.BoxEditor),
  { ssr: false, loading: () => <BoxSkeleton /> },
);
