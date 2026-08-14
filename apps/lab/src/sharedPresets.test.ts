import { describe, expect, it } from "vitest";
import { createPreset } from "./presets";
import { DEFAULT_LAB_SETTINGS } from "./persistence";
import {
  MAX_SHARED_PRESET_PAYLOAD_BYTES,
  SHARED_PRESET_SCHEMA_VERSIONS,
  configPresetFromSharedLayout,
  legacySizeFromSharedPreset,
  mergeSharedLayoutLab,
  mergeSharedStyleLab,
  sharedLayoutInputFromConfigPreset,
  sharedLayoutLabFromSnapshot,
  sharedPresetInputFromLegacySize,
  sharedStyleLabFromSnapshot,
  validateSharedPreset,
  validateSharedPresetInput,
  type SharedPreset,
  type SharedPresetUpdateInput,
} from "./sharedPresets";

describe("shared preset domain", () => {
  it("round-trips the complete ConfigPreset snapshot without mutating it", () => {
    const local = createPreset(
      "Team hero",
      { transform: { fit: "width", zoom: 1.75 }, marker: "engine-value" } as never,
      {
        ...DEFAULT_LAB_SETTINGS,
        canvasWidth: 1600,
        canvasHeight: 320,
        clientGraphicMode: "both",
        drawerOpen: { Presets: true, Twizzler: false },
        previewZoom: 0.42,
      },
    );
    const input = sharedLayoutInputFromConfigPreset(local);
    const shared: SharedPreset<"layout"> = {
      id: "layout-1",
      ...input,
      revision: 3,
      createdAt: "2026-08-14T12:00:00.000Z",
      updatedAt: "2026-08-14T12:30:00.000Z",
      createdBy: "designer@example.com",
    };

    const restored = configPresetFromSharedLayout(shared);

    expect(restored).toEqual(local);
    expect(restored.config).not.toBe(local.config);
    expect(restored.lab).not.toBe(local.lab);
  });

  it("narrows update inputs by kind without collapsing their payload", () => {
    const update: SharedPresetUpdateInput<"layout"> = {
      name: "Revision two",
      payload: { config: { version: 1 } as never, lab: { drawerOpen: { Presets: true } } },
      schemaVersion: 2,
      expectedRevision: 1,
    };
    expect(update.payload.lab?.drawerOpen).toEqual({ Presets: true });
  });

  it("strictly rejects unknown envelope fields and mismatched kinds", () => {
    const base = {
      id: "size-1",
      kind: "size",
      name: "Lobby wall",
      payload: { unit: "inches", width: 20, height: 10, ppi: 300 },
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-14T12:00:00.000Z",
      updatedAt: "2026-08-14T12:00:00.000Z",
    };
    expect(validateSharedPreset(base, "size").ok).toBe(true);
    expect(validateSharedPreset({ ...base, surprise: true }, "size").ok).toBe(false);
    expect(validateSharedPreset(base, "layout").ok).toBe(false);
  });

  it("adapts the existing shared size API without changing selector data", () => {
    const input = sharedPresetInputFromLegacySize({
      name: "Lobby wall",
      unit: "inches",
      width: 20,
      height: 10,
      ppi: 300,
    });
    expect(input).toEqual({
      kind: "size",
      name: "Lobby wall",
      payload: { unit: "inches", width: 20, height: 10, ppi: 300 },
      schemaVersion: 1,
    });
    expect(
      legacySizeFromSharedPreset({
        id: "size-1",
        ...input,
        revision: 1,
        createdAt: "2026-08-14T12:00:00.000Z",
        updatedAt: "2026-08-14T12:30:00.000Z",
      }),
    ).toEqual({
      id: "size-1",
      name: "Lobby wall",
      unit: "inches",
      width: 20,
      height: 10,
      ppi: 300,
      createdAt: "2026-08-14T12:00:00.000Z",
      updatedAt: "2026-08-14T12:30:00.000Z",
    });
  });

  it("rejects local UI state from styles but permits it in full layouts", () => {
    const style = {
      kind: "style",
      name: "No local chrome",
      payload: { config: { version: 1 }, lab: { drawerOpen: { Presets: true } } },
      schemaVersion: SHARED_PRESET_SCHEMA_VERSIONS.style,
    };
    expect(validateSharedPresetInput(style, "style").ok).toBe(false);
    expect(validateSharedPresetInput({ ...style, kind: "layout", schemaVersion: 2 }, "layout").ok).toBe(true);
  });

  it("keeps workspace chrome local when a shared layout is saved and applied", () => {
    const snapshot = {
      ...DEFAULT_LAB_SETTINGS,
      canvasWidth: 2400,
      previewZoom: 0.4,
      shaderSidebarWidth: 420,
      drawerOpen: { Presets: false },
    };
    const shared = sharedLayoutLabFromSnapshot(snapshot);
    expect(shared.canvasWidth).toBe(2400);
    expect(shared.previewZoom).toBeUndefined();
    expect(shared.shaderSidebarWidth).toBeUndefined();
    expect(shared.drawerOpen).toBeUndefined();

    const applied = mergeSharedLayoutLab(shared, {
      previewZoom: 0.72,
      shaderSidebarWidth: 310,
      drawerOpen: { Presets: true },
    });
    expect(applied.canvasWidth).toBe(2400);
    expect(applied.previewZoom).toBe(0.72);
    expect(applied.shaderSidebarWidth).toBe(310);
    expect(applied.drawerOpen).toEqual({ Presets: true });
  });

  it("keeps size, export, and workspace settings local when a shared style is applied", () => {
    const shared = sharedStyleLabFromSnapshot({
      ...DEFAULT_LAB_SETTINGS,
      canvasWidth: 2400,
      clientSizeWidth: 20,
      exportDurationSec: 12,
      twizzlerEnabled: false,
      stripePalette: "Purple",
    });
    expect(shared.canvasWidth).toBeUndefined();
    expect(shared.clientSizeWidth).toBeUndefined();
    expect(shared.exportDurationSec).toBeUndefined();
    expect(shared.twizzlerEnabled).toBe(false);
    expect(shared.stripePalette).toBe("Purple");

    const applied = mergeSharedStyleLab(shared, {
      canvasWidth: 800,
      clientSizeWidth: 800,
      exportDurationSec: 4,
      previewZoom: 0.5,
    });
    expect(applied.canvasWidth).toBe(800);
    expect(applied.clientSizeWidth).toBe(800);
    expect(applied.exportDurationSec).toBe(4);
    expect(applied.previewZoom).toBe(0.5);
    expect(applied.twizzlerEnabled).toBe(false);
  });

  it("enforces the 256 KiB payload limit using serialized UTF-8 bytes", () => {
    const withinLimit = {
      kind: "layout",
      name: "Compact",
      payload: { config: { notes: "x".repeat(1000) } },
      schemaVersion: 2,
    };
    const tooLarge = {
      ...withinLimit,
      payload: { config: { notes: "x".repeat(MAX_SHARED_PRESET_PAYLOAD_BYTES) } },
    };
    expect(validateSharedPresetInput(withinLimit, "layout").ok).toBe(true);
    expect(validateSharedPresetInput(tooLarge, "layout")).toEqual({
      ok: false,
      message: "Preset data must be 256 KiB or smaller.",
    });
  });

  it("requires color integers in the supported RGB range", () => {
    const input = (backgroundColor: number) => ({
      kind: "color" as const,
      name: "Brand",
      payload: {
        stripePalette: "Orange",
        twizzler: { color: "#f46021", colorFar: "#fea700", colorNear: "#f46021", colorEdge: "#e92e28" },
        backgroundColor,
      },
      schemaVersion: 1 as const,
    });
    expect(validateSharedPresetInput(input(0xffffff), "color").ok).toBe(true);
    expect(validateSharedPresetInput(input(0x1000000), "color").ok).toBe(false);
    expect(validateSharedPresetInput(input(1.5), "color").ok).toBe(false);
  });

  it("accepts bounded light and dark stripe color arrays", () => {
    const input = {
      kind: "color" as const,
      name: "Brand",
      payload: {
        stripePalette: "Custom",
        twizzler: { color: "#f46021", colorFar: "#fea700", colorNear: "#f46021", colorEdge: "#e92e28" },
        stripeColors: [0, 0xffffff],
        darkStripeColors: [0x101010, 0xeeeeee],
        darkBackgroundColor: 0x111111,
      },
      schemaVersion: 1 as const,
    };
    expect(validateSharedPresetInput(input, "color").ok).toBe(true);
    expect(
      validateSharedPresetInput({ ...input, payload: { ...input.payload, stripeColors: [0x1000000] } }, "color").ok,
    ).toBe(false);
  });
});
