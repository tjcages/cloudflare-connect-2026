import { describe, expect, it } from "vitest";
import { handleSharedSizePresetApi, type SharedSizePresetStore } from "./sharedSizePresetApi";
import type { SharedSizePreset } from "../src/sharedSizePresets";

function memoryStore(initial: SharedSizePreset[] = []): SharedSizePresetStore {
  const presets = [...initial];
  return {
    async list() {
      return presets;
    },
    async create(id, input) {
      if (presets.some((preset) => preset.name.toLowerCase() === input.name.toLowerCase())) {
        throw new Error("UNIQUE constraint failed: shared_size_presets.name");
      }
      const preset = { ...input, id, createdAt: "2026-08-13T00:00:00.000Z", updatedAt: "2026-08-13T00:00:00.000Z" };
      presets.push(preset);
      return preset;
    },
    async delete(id) {
      const index = presets.findIndex((preset) => preset.id === id);
      if (index === -1) return false;
      presets.splice(index, 1);
      return true;
    },
  };
}

describe("shared size preset API", () => {
  it("lists presets", async () => {
    const response = await handleSharedSizePresetApi(
      new Request("https://example.com/api/size-presets"),
      memoryStore(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ presets: [] });
  });

  it("creates a validated preset", async () => {
    const response = await handleSharedSizePresetApi(
      new Request("https://example.com/api/size-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Lobby wall", unit: "inches", width: 20, height: 10, ppi: 300 }),
      }),
      memoryStore(),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      preset: { name: "Lobby wall", unit: "inches", width: 20, height: 10, ppi: 300 },
    });
  });

  it("rejects duplicate names with a conflict", async () => {
    const store = memoryStore([
      {
        id: "one",
        name: "Lobby wall",
        unit: "inches",
        width: 20,
        height: 10,
        ppi: 300,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    ]);
    const response = await handleSharedSizePresetApi(
      new Request("https://example.com/api/size-presets", {
        method: "POST",
        body: JSON.stringify({ name: "lobby wall", unit: "inches", width: 24, height: 12, ppi: 300 }),
      }),
      store,
    );
    expect(response.status).toBe(409);
  });

  it("rejects oversized bodies without relying on a content-length header", async () => {
    const response = await handleSharedSizePresetApi(
      new Request("https://example.com/api/size-presets", {
        method: "POST",
        body: JSON.stringify({
          name: "Oversized",
          unit: "pixels",
          width: 1920,
          height: 1080,
          ppi: 72,
          padding: "x".repeat(16_384),
        }),
      }),
      memoryStore(),
    );
    expect(response.status).toBe(413);
  });

  it("deletes an existing shared size", async () => {
    const preset = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Lobby wall",
      unit: "inches" as const,
      width: 20,
      height: 10,
      ppi: 300,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:00.000Z",
    };
    const store = memoryStore([preset]);
    const response = await handleSharedSizePresetApi(
      new Request(`https://example.com/api/size-presets/${preset.id}`, { method: "DELETE" }),
      store,
      preset.id,
    );
    expect(response.status).toBe(204);
    expect(await store.list()).toEqual([]);
  });

  it("returns not found when deleting a missing shared size", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const response = await handleSharedSizePresetApi(
      new Request(`https://example.com/api/size-presets/${id}`, { method: "DELETE" }),
      memoryStore(),
      id,
    );
    expect(response.status).toBe(404);
  });
});
