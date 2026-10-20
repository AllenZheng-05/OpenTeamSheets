import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySet } from "@ots/core/teams";
import { createDraft } from "./builder";

/** A fresh store over the given storage. */
async function freshStore(storage: Partial<Storage>) {
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  return (await import("./builder-store")).useBuilder;
}

/** An in-memory localStorage. */
function memoryStorage(): Partial<Storage> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("the builder store", () => {
  it("saves teams and loads them back, in order", async () => {
    const storage = memoryStorage();
    const first = await freshStore(storage);
    const a = first.getState().newDraft();
    const b = first.getState().newDraft();
    first.getState().updateSet(a, 0, { speciesId: "incineroar" });
    first.getState().renameDraft(a, "Sun");
    first.getState().moveDraft(a, 0);

    const reloaded = await freshStore(storage);
    const { drafts, order } = reloaded.getState();
    expect(order).toEqual([a, b]);
    expect(drafts[a]!.name).toBe("Sun");
    expect(drafts[a]!.sets[0]!.speciesId).toBe("incineroar");
  });

  it("opens a team as a new draft", async () => {
    const store = await freshStore(memoryStorage());
    const id = store.getState().openTeam({
      name: "Wolfe · 1st at Baltimore",
      regulation: "M-B",
      sets: [{ ...emptySet(), speciesId: "sinistcha" }],
      sourceTeamId: "team-1",
    });
    const { drafts, order } = store.getState();
    expect(order).toEqual([id]);
    expect(drafts[id]!.sets[0]!.speciesId).toBe("sinistcha");
  });

  it("deletes a team", async () => {
    const store = await freshStore(memoryStorage());
    const id = store.getState().newDraft();
    store.getState().deleteDraft(id);
    expect(store.getState().order).toEqual([]);
    expect(store.getState().drafts).toEqual({});
  });

  it("works in memory when storage is blocked", async () => {
    const blocked = () => {
      throw new Error("SecurityError");
    };
    const store = await freshStore({
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    });
    const id = store.getState().newDraft();
    store.getState().updateSet(id, 0, { speciesId: "incineroar" });
    expect(store.getState().drafts[id]!.sets[0]!.speciesId).toBe("incineroar");
  });

  it("lists version 1's drafts newest first", async () => {
    const older = { ...createDraft("M-C"), updatedAt: "2026-10-01T00:00:00Z" };
    const newer = { ...createDraft("M-C"), updatedAt: "2026-10-02T00:00:00Z" };
    const storage = memoryStorage();
    storage.data.set(
      "ots-builder",
      JSON.stringify({
        state: {
          drafts: { [older.id]: older, [newer.id]: newer },
          currentId: older.id,
        },
        version: 1,
      }),
    );
    const store = await freshStore(storage);
    expect(store.getState().order).toEqual([newer.id, older.id]);
  });

  it("puts a hand-edited order right", async () => {
    const draft = createDraft("M-C");
    const storage = memoryStorage();
    storage.data.set(
      "ots-builder",
      JSON.stringify({
        state: { drafts: { [draft.id]: draft }, order: ["gone"] },
        version: 2,
      }),
    );
    const store = await freshStore(storage);
    expect(store.getState().order).toEqual([draft.id]);
  });
});
