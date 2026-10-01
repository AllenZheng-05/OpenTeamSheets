import { describe, expect, it } from "vitest";
import { getCurrentRegulation } from "@ots/core";
import { app } from "./app";

describe("worker", () => {
  it("answers the health check", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      regulation: getCurrentRegulation(),
    });
  });
});
