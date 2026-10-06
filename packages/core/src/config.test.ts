import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IMPORT_CRON } from "./config";

describe("IMPORT_CRON", () => {
  it("matches the online import workflow's schedule", () => {
    const workflow = readFileSync(
      path.join(
        import.meta.dirname,
        "../../../.github/workflows/import-online.yml",
      ),
      "utf8",
    );
    const crons = [...workflow.matchAll(/cron:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(crons).toEqual([IMPORT_CRON]);
  });
});
