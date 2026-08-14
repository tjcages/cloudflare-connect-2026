import { afterEach, describe, expect, it, vi } from "vitest";
import { createSharedPreset, deleteSharedPreset, loadSharedPresets, updateSharedPreset } from "./sharedPresetApi";
import type { SharedPreset, SharedPresetInput } from "../sharedPresets";
import { createPreset, loadStoredPresets, savePresets } from "../presets";

const layoutInput: SharedPresetInput<"layout"> = {
  kind: "layout",
  name: "Team hero",
  payload: { config: { version: 1, marker: "complete" } as never, lab: { drawerOpen: { Presets: true } } },
  schemaVersion: 2,
};

const layout: SharedPreset<"layout"> = {
  id: "layout-1",
  ...layoutInput,
  revision: 1,
  createdAt: "2026-08-14T12:00:00.000Z",
  updatedAt: "2026-08-14T12:00:00.000Z",
};

describe("shared preset API client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads and validates a kind-specific catalog without touching local working state", async () => {
    const items = new Map<string, string>();
    const getItem = vi.fn((key: string) => items.get(key) ?? null);
    const setItem = vi.fn((key: string, value: string) => items.set(key, value));
    vi.stubGlobal("localStorage", { getItem, setItem });
    const localLayout = createPreset("Private draft", { version: 1, local: true } as never, {
      drawerOpen: { Presets: false },
    });
    savePresets([localLayout]);
    getItem.mockClear();
    setItem.mockClear();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ presets: [layout] })));

    await expect(loadSharedPresets("layout")).resolves.toEqual([layout]);
    expect(fetch).toHaveBeenCalledWith("/api/presets?kind=layout", expect.objectContaining({ headers: { accept: "application/json" } }));
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(loadStoredPresets()).toEqual([localLayout]);
  });

  it("posts only the explicit named snapshot and validates the response", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
      Response.json({ preset: layout }, { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createSharedPreset(layoutInput)).resolves.toEqual(layout);
    const [, request] = fetchMock.mock.calls[0];
    expect(request).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(request?.body))).toEqual(layoutInput);
  });

  it("sends optimistic-lock revisions for updates and deletes", async () => {
    const updated = { ...layout, revision: 2, updatedAt: "2026-08-14T13:00:00.000Z" };
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(Response.json({ preset: updated }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateSharedPreset(layout.id, layoutInput, 1)).resolves.toEqual(updated);
    const [, updateRequest] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(updateRequest?.body))).toEqual({
      name: layoutInput.name,
      payload: layoutInput.payload,
      schemaVersion: 2,
      expectedRevision: 1,
    });
    await deleteSharedPreset(layout.id, 2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/presets/layout-1?expectedRevision=2");
  });

  it("surfaces conflict errors and rejects malformed server payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ error: "Preset changed on another device." }, { status: 409 }))
        .mockResolvedValueOnce(Response.json({ presets: [{ ...layout, revision: 0 }] })),
    );
    await expect(updateSharedPreset(layout.id, layoutInput, 1)).rejects.toThrow("Preset changed on another device.");
    await expect(loadSharedPresets("layout")).rejects.toThrow("invalid preset revision");
  });
});
