import { Hono } from "hono";
import { getCurrentRegulation } from "@ots/core";

export const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, regulation: getCurrentRegulation() }),
);
