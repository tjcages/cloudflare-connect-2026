import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPreset } from "../presets";
import {
  applyClientLayout,
  listSavedLayouts,
  loadActiveClientLayoutName,
  resolveClientBootPreset,
  saveActiveClientLayoutName,
} from "./savedLayouts";

function stubStorage() {
  const localItems = new Map<string, string>();
  const sessionItems = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => localItems.get(key) ?? null,
    setItem: (key: string, value: string) => {
      localItems.set(key, value);
    },
    removeItem: (key: string) => {
      localItems.delete(key);
    },
    clear: () => {
      localItems.clear();
    },
  });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => sessionItems.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionItems.set(key, value);
    },
    removeItem: (key: string) => {
      sessionItems.delete(key);
    },
    clear: () => {
      sessionItems.clear();
    },
  });
}

describe("savedLayouts", () => {
  beforeEach(() => {
    stubStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the active client layout name", () => {
    expect(loadActiveClientLayoutName()).toBeNull();
    saveActiveClientLayoutName("My Layout");
    expect(loadActiveClientLayoutName()).toBe("My Layout");
    saveActiveClientLayoutName(null);
    expect(loadActiveClientLayoutName()).toBeNull();
  });

  it("lists only user-authored layouts", () => {
    const presets = [
      createPreset("Banner 5:1", { version: 1 } as never, undefined, true),
      createPreset("Agency A", { version: 1 } as never),
      createPreset("Agency B", { version: 1 } as never),
    ];
    expect(listSavedLayouts(presets).map((p) => p.name)).toEqual(["Agency A", "Agency B"]);
  });

  it("falls back to Banner 5:1 when nothing is saved", () => {
    vi.stubGlobal("window", {
      location: { href: "http://localhost/client.html" },
      history: { replaceState: () => undefined },
    });
    const boot = resolveClientBootPreset();
    expect(boot?.name).toBe("Banner 5:1");
    expect(boot?.builtin).toBe(true);
  });

  it("prefers ?preset= over the active layout", () => {
    saveActiveClientLayoutName("Should Not Win");
    let href = "http://localhost/client.html?preset=Banner%205:1";
    vi.stubGlobal("window", {
      location: {
        get href() {
          return href;
        },
      },
      history: {
        replaceState: (_state: unknown, _title: string, url: string) => {
          href = `http://localhost${url}`;
        },
      },
    });
    const boot = resolveClientBootPreset();
    expect(boot?.name).toBe("Banner 5:1");
    expect(new URL(href).searchParams.get("preset")).toBeNull();
  });

  it("applyClientLayout stores active name and boot marker", () => {
    const preset = createPreset(
      "Review v2",
      {
        version: 1,
        background: { color: 0xffffff, transparent: false },
      } as never,
      {
        twizzlerEnabled: true,
        canvasWidth: 1600,
        canvasHeight: 320,
      },
    );
    applyClientLayout(preset, "cf-base");
    expect(loadActiveClientLayoutName()).toBe("Review v2");
    expect(sessionStorage.getItem("stripes-engine-lab-boot-preset")).toBe("Review v2");
  });
});
