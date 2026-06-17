/**
 * Guards the curated public API surface: verifies expected runtime symbols are
 * present and that internal-only symbols do not leak through public.ts.
 */
import { describe, expect, it, vi } from "vitest";

// Stub pixi.js so the module graph can be traversed without a real WebGL context.
vi.mock("pixi.js", () => ({
  Application: class {
    canvas = typeof document !== "undefined" ? document.createElement("canvas") : {};
    renderer = { resize: vi.fn(), resolution: 1 };
    ticker = { stop: vi.fn(), add: vi.fn() };
    stage = { addChild: vi.fn() };
    init = vi.fn().mockReturnValue(new Promise<void>(() => {}));
    render = vi.fn();
    destroy = vi.fn();
  },
  Ticker: class {
    static shared = { add: vi.fn(), remove: vi.fn() };
    add = vi.fn();
    remove = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    destroy = vi.fn();
  },
  Container: class {
    addChild = vi.fn();
    removeChild = vi.fn();
    destroy = vi.fn();
    children = [];
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
    visible = true;
  },
  Sprite: class {
    texture = null;
    destroy = vi.fn();
    width = 0;
    height = 0;
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
  },
  Texture: {
    from: vi.fn(() => ({ destroy: vi.fn(), width: 0, height: 0 })),
    EMPTY: { destroy: vi.fn(), width: 0, height: 0 },
  },
  Filter: class {
    uniforms = {};
    destroy = vi.fn();
  },
  GlProgram: class {},
  GpuProgram: class {},
  RenderTexture: { create: vi.fn(() => ({ destroy: vi.fn(), width: 0, height: 0 })) },
  Assets: { load: vi.fn() },
  extensions: { add: vi.fn() },
}));

import * as pub from "./public";

describe("public.ts — runtime symbol presence", () => {
  it("exports StripesShader as a runtime value", () => {
    expect("StripesShader" in pub).toBe(true);
    expect(pub.StripesShader).toBeDefined();
  });

  it("exports DEFAULT_STRIPES_SHADER_CONFIG as a runtime value", () => {
    expect("DEFAULT_STRIPES_SHADER_CONFIG" in pub).toBe(true);
    expect(pub.DEFAULT_STRIPES_SHADER_CONFIG).toBeDefined();
  });

  it("exports normalizeStripesShaderConfig as a runtime value", () => {
    expect("normalizeStripesShaderConfig" in pub).toBe(true);
    expect(typeof pub.normalizeStripesShaderConfig).toBe("function");
  });

  it("exports serializeStripesShaderConfig as a runtime value", () => {
    expect("serializeStripesShaderConfig" in pub).toBe(true);
    expect(typeof pub.serializeStripesShaderConfig).toBe("function");
  });

  it("exports createStripesShaderScene as a runtime value", () => {
    expect("createStripesShaderScene" in pub).toBe(true);
    expect(typeof pub.createStripesShaderScene).toBe("function");
  });

  it("exports resolveStripesSceneConfig as a runtime value", () => {
    expect("resolveStripesSceneConfig" in pub).toBe(true);
    expect(typeof pub.resolveStripesSceneConfig).toBe("function");
  });
});

describe("public.ts — internal symbols are absent", () => {
  it("does NOT export createStripeDuotoneFilter", () => {
    expect("createStripeDuotoneFilter" in pub).toBe(false);
  });

  it("does NOT export buildStripeLetterAtlas", () => {
    expect("buildStripeLetterAtlas" in pub).toBe(false);
  });
});
