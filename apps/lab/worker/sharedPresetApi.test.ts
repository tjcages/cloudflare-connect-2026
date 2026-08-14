import { describe, expect, it } from "vitest";
import {
  handleSharedPresetApi,
  type DeleteResult,
  type MutationResult,
  type SharedPreset,
  type SharedPresetCreateInput,
  type SharedPresetKind,
  type SharedPresetStore,
  type SharedPresetUpdateInput,
} from "./sharedPresetApi";

const NOW = "2026-08-14T00:00:00.000Z";
const ID = "11111111-1111-4111-8111-111111111111";

function makePreset(overrides: Partial<SharedPreset> = {}): SharedPreset {
  return {
    id: ID,
    kind: "layout",
    name: "Lobby layout",
    payload: { config: { speed: 1 }, lab: {} },
    schemaVersion: 2,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function memoryStore(initial: SharedPreset[] = []): SharedPresetStore {
  const presets = [...initial];

  function assertUnique(kind: SharedPresetKind, name: string, exceptId?: string): void {
    if (
      presets.some(
        (preset) => preset.id !== exceptId && preset.kind === kind && preset.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error("UNIQUE constraint failed: shared_presets.kind, shared_presets.name");
    }
  }

  return {
    async list(kind) {
      return kind ? presets.filter((preset) => preset.kind === kind) : [...presets];
    },
    async get(id) {
      return presets.find((preset) => preset.id === id) ?? null;
    },
    async create(id: string, input: SharedPresetCreateInput) {
      assertUnique(input.kind, input.name);
      const preset = makePreset({ ...input, id });
      presets.push(preset);
      return preset;
    },
    async update(id: string, input: SharedPresetUpdateInput): Promise<MutationResult> {
      const index = presets.findIndex((preset) => preset.id === id);
      if (index === -1) return { status: "not_found" };
      const current = presets[index];
      if (current.revision !== input.expectedRevision) return { status: "conflict" };
      assertUnique(current.kind, input.name, id);
      const preset = {
        ...current,
        name: input.name,
        payload: input.payload,
        schemaVersion: input.schemaVersion,
        revision: current.revision + 1,
        updatedAt: "2026-08-14T01:00:00.000Z",
      };
      presets[index] = preset;
      return { status: "ok", preset };
    },
    async delete(id: string, expectedRevision: number): Promise<DeleteResult> {
      const index = presets.findIndex((preset) => preset.id === id);
      if (index === -1) return "not_found";
      if (presets[index].revision !== expectedRevision) return "conflict";
      presets.splice(index, 1);
      return "deleted";
    },
  };
}

describe("shared preset API", () => {
  it("lists presets filtered by kind", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets?kind=layout"),
      memoryStore([makePreset(), makePreset({ id: "22222222-2222-4222-8222-222222222222", kind: "color" })]),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ presets: [makePreset()] });
  });

  it("rejects an invalid list kind", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets?kind=unknown"),
      memoryStore(),
    );

    expect(response.status).toBe(400);
  });

  it.each(["layout", "style", "color"] as const)("creates a validated %s preset", async (kind) => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind,
          name: "  Team   preset  ",
          payload:
            kind === "color"
              ? {
                  stripePalette: "Cloudflare",
                  twizzler: { color: "#ff0000", colorFar: "#00ff00", colorNear: "#0000ff", colorEdge: "#ffffff" },
                  backgroundColor: 0x101010,
                }
              : { config: { speed: 2 }, lab: {} },
          schemaVersion: kind === "layout" ? 2 : 1,
        }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      preset: {
        kind,
        name: "Team preset",
        schemaVersion: kind === "layout" ? 2 : 1,
        revision: 1,
      },
    });
  });

  it("strictly validates size payloads", async () => {
    const valid = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "size",
          name: "Lobby wall",
          payload: { unit: "inches", width: 20, height: 10, ppi: 300 },
          schemaVersion: 1,
        }),
      }),
      memoryStore(),
    );
    const invalid = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "size",
          name: "Bad size",
          payload: { unit: "feet", width: 20, height: 10, ppi: 300 },
          schemaVersion: 1,
        }),
      }),
      memoryStore(),
    );

    expect(valid.status).toBe(201);
    expect(invalid.status).toBe(400);
  });

  it("rejects unsupported top-level fields", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "layout",
          name: "Team layout",
          payload: {},
          schemaVersion: 2,
          admin: true,
        }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(400);
  });

  it("rejects oversized bodies without relying on content-length", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "layout",
          name: "Oversized",
          payload: { config: { shaderSourceCode: "x".repeat(280_000) } },
          schemaVersion: 2,
        }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(413);
  });

  it("rejects a serialized payload over 256 KiB", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "layout",
          name: "Payload too large",
          payload: { config: { shaderSourceCode: "x".repeat(262_140) } },
          schemaVersion: 2,
        }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Preset payload is too large." });
  });

  it("accepts a layout containing a large custom shader source", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "layout",
          name: "Custom shader",
          payload: { config: { shaderSourceCode: "x".repeat(190_000) } },
          schemaVersion: 2,
        }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(201);
  });

  it("enforces the schema version assigned to each kind", async () => {
    const layout = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({ kind: "layout", name: "Old layout", payload: { config: {} }, schemaVersion: 1 }),
      }),
      memoryStore(),
    );
    const size = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "size",
          name: "Future size",
          payload: { unit: "pixels", width: 100, height: 100, ppi: 72 },
          schemaVersion: 2,
        }),
      }),
      memoryStore(),
    );

    expect(layout.status).toBe(400);
    expect(size.status).toBe(400);
  });

  it.each([
    { kind: "layout", payload: { speed: 2 }, schemaVersion: 2 },
    {
      kind: "style",
      payload: { config: {}, lab: { previewZoom: 0.5 } },
      schemaVersion: 1,
    },
    {
      kind: "color",
      payload: {
        stripePalette: "Cloudflare",
        twizzler: { color: "red", colorFar: "#00ff00", colorNear: "#0000ff", colorEdge: "#ffffff" },
      },
      schemaVersion: 1,
    },
    {
      kind: "color",
      payload: {
        stripePalette: null,
        twizzler: { color: "#ff0000", colorFar: "#00ff00", colorNear: "#0000ff", colorEdge: "#ffffff" },
        backgroundColor: 0x1000000,
      },
      schemaVersion: 1,
    },
  ] as const)("rejects a malformed $kind payload", async ({ kind, payload, schemaVersion }) => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({ kind, name: "Malformed", payload, schemaVersion }),
      }),
      memoryStore(),
    );

    expect(response.status).toBe(400);
  });

  it("enforces client-aligned size dimension limits", async () => {
    const pixels = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "size",
          name: "Too many pixels",
          payload: { unit: "pixels", width: 8_193, height: 100, ppi: 72 },
          schemaVersion: 1,
        }),
      }),
      memoryStore(),
    );
    const inches = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "size",
          name: "Too many inches",
          payload: { unit: "inches", width: 100, height: 1_001, ppi: 300 },
          schemaVersion: 1,
        }),
      }),
      memoryStore(),
    );

    expect(pixels.status).toBe(400);
    expect(inches.status).toBe(400);
  });

  it("returns duplicate-name conflicts within a kind", async () => {
    const response = await handleSharedPresetApi(
      new Request("https://example.com/api/presets", {
        method: "POST",
        body: JSON.stringify({
          kind: "layout",
          name: "lobby layout",
          payload: { config: {} },
          schemaVersion: 2,
        }),
      }),
      memoryStore([makePreset()]),
    );

    expect(response.status).toBe(409);
  });

  it("updates a preset and increments its revision", async () => {
    const response = await handleSharedPresetApi(
      new Request(`https://example.com/api/presets/${ID}`, {
        method: "PUT",
        body: JSON.stringify({
          name: "Updated layout",
          payload: { config: { speed: 3 }, lab: {} },
          schemaVersion: 2,
          expectedRevision: 1,
        }),
      }),
      memoryStore([makePreset()]),
      ID,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      preset: { name: "Updated layout", schemaVersion: 2, revision: 2 },
    });
  });

  it("rejects stale updates with a conflict", async () => {
    const response = await handleSharedPresetApi(
      new Request(`https://example.com/api/presets/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ name: "Stale", payload: { config: {} }, schemaVersion: 2, expectedRevision: 1 }),
      }),
      memoryStore([makePreset({ revision: 2 })]),
      ID,
    );

    expect(response.status).toBe(409);
  });

  it("deletes only the expected revision", async () => {
    const store = memoryStore([makePreset({ revision: 2 })]);
    const stale = await handleSharedPresetApi(
      new Request(`https://example.com/api/presets/${ID}?expectedRevision=1`, { method: "DELETE" }),
      store,
      ID,
    );
    const current = await handleSharedPresetApi(
      new Request(`https://example.com/api/presets/${ID}?expectedRevision=2`, { method: "DELETE" }),
      store,
      ID,
    );

    expect(stale.status).toBe(409);
    expect(current.status).toBe(204);
  });

  it("returns not found for missing item routes", async () => {
    const response = await handleSharedPresetApi(
      new Request(`https://example.com/api/presets/${ID}`, {
        method: "PUT",
        body: JSON.stringify({ name: "Missing", payload: { config: {} }, schemaVersion: 2, expectedRevision: 1 }),
      }),
      memoryStore(),
      ID,
    );

    expect(response.status).toBe(404);
  });
});
