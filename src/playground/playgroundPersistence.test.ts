import { afterEach, describe, expect, it } from "vitest";
import {
  addColorPreset,
  addSavedShader,
  catalogEntriesForLoadAttempt,
  defaultConfigForTexture,
  deleteColorPreset,
  deleteSavedShader,
  firstCatalogEntryWithUrl,
  loadColorPresets,
  loadSavedShaders,
  mergeColorPresets,
  mergeSavedShaders,
  parsePlaygroundStateInput,
  PLAYGROUND_LS_KEY,
  resolveInitialTextureId,
  serializePlaygroundState,
  type PlaygroundCatalogEntry,
} from "./playgroundPersistence";
import { cloneDefaultOverlayStripes, DEFAULT_STRIPES, normalizeStripe } from "./stripeColors";
import { DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";
import { DEFAULT_PLAYGROUND_FLAMES_CONFIG } from "./playgroundFlamesConfig";
import {
  DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
  type PlaygroundCursorTrailConfig,
} from "./playgroundCursorTrailConfig";

describe("playgroundPersistence envelope migration", () => {
  afterEach(() => {
    localStorage.removeItem(PLAYGROUND_LS_KEY);
  });

  it("reads lastVideoId when lastTextureId is absent", () => {
    localStorage.setItem(
      PLAYGROUND_LS_KEY,
      JSON.stringify({
        version: 1,
        lastVideoId: "example3",
        uploads: [],
        configs: {},
      }),
    );
    expect(resolveInitialTextureId()).toBe("example3");
  });

  it("uses default stripes for new uploads without persisted config", () => {
    const uploadId = "upload:test-upload" as const;
    const config = defaultConfigForTexture(uploadId);
    expect(config.duotoneEnabled).toBe(true);
    expect(config.stripes.map((s) => s.hex)).toEqual(DEFAULT_STRIPES.map((s) => s.hex));
  });

  it("migrates legacy v1/v2 distance configs to the default stripe palette", () => {
    const config = parsePlaygroundStateInput(
      JSON.stringify({ v: 1, d: true, c: "#ffffff", t: 0.12, g: 1.5, th: 0.8, de: 0.9, bp: [1, 2, 3, 4] }),
    );
    expect(config.duotoneEnabled).toBe(true);
    expect(config.stripes.map((s) => s.hex)).toEqual(DEFAULT_STRIPES.map((s) => s.hex));
    expect("ignoreTolerance" in config).toBe(false);
    expect("bandBreakpoints" in config).toBe(false);
  });

  it("clamps legacy negative texture gamma through serialize/parse", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      textureGamma: -50,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.textureGamma).toBe(0.05);
    expect(JSON.parse(text).tgm).toBe(0.05);
  });

  it("round-trips a non-default render scale and omits the default", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      renderScale: 1,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(JSON.parse(text).rs).toBe(1);
    expect(parsePlaygroundStateInput(text).renderScale).toBe(1);

    const defaultText = serializePlaygroundState({
      duotoneEnabled: true,
      renderScale: 2,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(JSON.parse(defaultText).rs).toBeUndefined();
    expect(parsePlaygroundStateInput(defaultText).renderScale).toBeUndefined();
  });

  it("clamps out-of-range render scales", () => {
    // 9 clamps to the default (2), so the wire omits it entirely.
    const high = serializePlaygroundState({
      duotoneEnabled: true,
      renderScale: 9,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(JSON.parse(high).rs).toBeUndefined();

    const low = serializePlaygroundState({
      duotoneEnabled: true,
      renderScale: 0.1,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(JSON.parse(low).rs).toBe(0.5);
  });

  it("omits grid config and stays v3 when grid is default", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      grid: { ...DEFAULT_PLAYGROUND_GRID_CONFIG },
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);
    expect(wire.v).toBe(3);
    expect(wire.gc).toBeUndefined();
    expect(parsePlaygroundStateInput(text).grid).toBeUndefined();
  });

  it("round-trips a non-default grid config as wire v4", () => {
    const grid = {
      ...DEFAULT_PLAYGROUND_GRID_CONFIG,
      cellWidth: 5,
      cellHeight: 9,
      gapX: 1,
      gapY: 2,
      orientation: "horizontal" as const,
      letterSize: 10,
      letterRatio: 0.5,
      cornerRadius: 2,
    };
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      grid,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(JSON.parse(text).v).toBe(4);
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.grid?.cellWidth).toBe(5);
    expect(parsed.grid?.cellHeight).toBe(9);
    expect(parsed.grid?.gapX).toBe(1);
    expect(parsed.grid?.gapY).toBe(2);
    expect(parsed.grid?.orientation).toBe("horizontal");
    expect(parsed.grid?.letterSize).toBe(10);
    expect(parsed.grid?.letterRatio).toBe(0.5);
    expect(parsed.grid?.cornerRadius).toBe(2);
  });

  it("round-trips background CSS as wire v5", () => {
    const backgroundCss = [
      "background: #D9D9D9;",
      "background: color(display-p3 0.851 0.851 0.851);",
      "background-image: linear-gradient(90deg, red, blue);",
    ].join("\n");
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      backgroundCss,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(5);
    expect(wire.bg).toBe(backgroundCss);
    expect(parsePlaygroundStateInput(text).backgroundCss).toBe(backgroundCss);
  });

  it("round-trips a non-default background color as wire v5", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      backgroundColor: 0xd9d9d9,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(5);
    expect(wire.bgh).toBe("#d9d9d9");
    expect(wire.bg).toBeUndefined();
    expect(parsePlaygroundStateInput(text).backgroundColor).toBe(0xd9d9d9);
  });

  it("omits default white background color from copied state", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      backgroundColor: 0xffffff,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(3);
    expect(wire.bgh).toBeUndefined();
    expect(parsePlaygroundStateInput(text).backgroundColor).toBeUndefined();
  });

  it("round-trips texture adjustments and source transform as wire v6", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      textureAdjustments: {
        ...DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS,
        exposure: 0.5,
        contrast: 1.4,
        gamma: 0.8,
        invert: true,
        blurRadius: 1,
      },
      sourceTransform: {
        fit: "cover",
        zoom: 1.5,
        panX: 0.25,
        panY: -0.25,
      },
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(6);
    expect(wire.ta).toMatchObject({ ex: 0.5, co: 1.4, gm: 0.8, iv: true, bl: 1 });
    expect(wire.xf).toEqual({ f: "cover", z: 1.5, x: 0.25, y: -0.25 });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.textureAdjustments?.exposure).toBe(0.5);
    expect(parsed.textureAdjustments?.contrast).toBe(1.4);
    expect(parsed.textureAdjustments?.gamma).toBe(0.8);
    expect(parsed.textureAdjustments?.invert).toBe(true);
    expect(parsed.textureAdjustments?.blurRadius).toBe(1);
    expect(parsed.sourceTransform).toEqual({ fit: "cover", zoom: 1.5, panX: 0.25, panY: -0.25 });
  });

  it("round-trips disabled stripe overlay as wire v6", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripesEnabled: false,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(6);
    expect(wire.se).toBe(false);
    expect(parsePlaygroundStateInput(text).stripesEnabled).toBe(false);
  });

  it("round-trips overlay luminance mode and overlay stripe list as wire v7", () => {
    const overlayStripes = cloneDefaultOverlayStripes().map((stripe, index) =>
      index === 2 ? { ...stripe, hex: "#FF0000", width: 6 } : { ...stripe },
    );
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      textureLuminanceMode: "overlay",
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      overlayStripes,
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(7);
    expect(wire.tlm).toBe("overlay");
    expect(wire.os).toHaveLength(3);
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.textureLuminanceMode).toBe("overlay");
    expect(parsed.overlayStripes?.[2]?.hex).toBe("#FF0000");
    expect(parsed.overlayStripes?.[2]?.width).toBe(6);
  });

  it("round-trips texture luminance colors mode and background color as wire v7", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      textureLuminanceMode: "colors",
      textureLuminanceBackgroundColor: 0x112233,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(7);
    expect(wire.tlm).toBe("colors");
    expect(wire.tbg).toBe("#112233");
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.textureLuminanceMode).toBe("colors");
    expect(parsed.textureLuminanceBackgroundColor).toBe(0x112233);
  });

  it("round-trips non-default flames config as wire v6", () => {
    const flames = {
      ...DEFAULT_PLAYGROUND_FLAMES_CONFIG,
      enabled: true,
      direction: "right" as const,
      baseSpeedPxPerSec: 90,
      maxActive: 24,
      edgeSharpness: 0.5,
    };
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      flames,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(6);
    expect(wire.fl).toEqual({ en: true, dir: "right", spd: 90, ma: 24, es: 0.5 });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.flames?.enabled).toBe(true);
    expect(parsed.flames?.direction).toBe("right");
    expect(parsed.flames?.baseSpeedPxPerSec).toBe(90);
    expect(parsed.flames?.maxActive).toBe(24);
    expect(parsed.flames?.edgeSharpness).toBe(0.5);
  });

  it("omits default flames config from copied state", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      flames: { ...DEFAULT_PLAYGROUND_FLAMES_CONFIG },
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.fl).toBeUndefined();
    expect(parsePlaygroundStateInput(text).flames).toBeUndefined();
  });

  it("omits blank background CSS from copied state", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      backgroundCss: "  \n\t  ",
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(3);
    expect(wire.bg).toBeUndefined();
    expect(parsePlaygroundStateInput(text).backgroundCss).toBeUndefined();
  });

  it("leaves grid undefined for legacy v3 states without grid config", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    expect(parsePlaygroundStateInput(text).grid).toBeUndefined();
  });

  it("round-trips v3 stripes through serialize/parse", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: [
        { id: "a", hex: "#112233", p3Css: "color(display-p3 0.0667 0.1333 0.2)", startFrom: 0.2, width: 3 },
        { id: "b", hex: "#445566", p3Css: "color(display-p3 0.2667 0.3333 0.4)", startFrom: 0.7, width: 6 },
      ],
    });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.stripes).toHaveLength(2);
    expect(parsed.stripes[0]!.hex).toBe("#112233");
    expect(parsed.stripes[0]!.startFrom).toBe(0.2);
    expect(parsed.stripes[1]!.width).toBe(6);
  });

  it("round-trips cursor trail settings through serialize/parse", () => {
    const cursorTrail: PlaygroundCursorTrailConfig = {
      ...DEFAULT_PLAYGROUND_CURSOR_TRAIL_CONFIG,
      pushStrengthPx: 14,
    };
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      cursorTrail,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
    });
    const wire = JSON.parse(text);

    expect(wire.v).toBe(7);
    expect(wire.ct).toEqual({ pd: 14 });
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.cursorTrail?.pushStrengthPx).toBe(14);
  });

  it("ignores legacy trail/click wire keys from payloads predating the GPU migration", () => {
    const legacy = JSON.stringify({
      v: 7,
      d: true,
      ct: { pd: 14, ts: 0.25 },
      cc: { ps: 22, sw: 0.5, scn: 8, scx: 24, skn: 0.1, skx: 0.2, sln: 3, slx: 9 },
    });
    const parsed = parsePlaygroundStateInput(legacy);
    expect(parsed.cursorTrail?.pushStrengthPx).toBe(14);
    expect(parsed.clickWave?.pushStrengthPx).toBe(22);
    expect(parsed.clickWave).not.toHaveProperty("sliceWhiteAlpha");
  });

  it("round-trips a saved shader library through serialize/parse", () => {
    const savedShaders = [
      { id: "one", label: "First", source: "void mainImage(){ A }", createdAt: 10 },
      { id: "two", label: "Second", source: "void mainImage(){ B }", createdAt: 20 },
    ];
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      savedShaders,
    });
    const wire = JSON.parse(text);
    expect(wire.v).toBe(7);
    expect(wire.shl).toEqual([
      { id: "one", l: "First", s: "void mainImage(){ A }", t: 10 },
      { id: "two", l: "Second", s: "void mainImage(){ B }", t: 20 },
    ]);
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.savedShaders).toEqual(savedShaders);
  });

  it("omits the saved shader library when empty", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      savedShaders: [],
    });
    expect(JSON.parse(text)).not.toHaveProperty("shl");
    expect(parsePlaygroundStateInput(text).savedShaders).toBeUndefined();
  });

  it("round-trips a saved shader that carries a full look snapshot", () => {
    const savedShaders = [
      {
        id: "look",
        label: "Big",
        source: "void mainImage(){ C }",
        createdAt: 30,
        config: {
          duotoneEnabled: true,
          stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
          displayWidth: 1280,
          displayHeight: 720,
          // Libraries here must be stripped from the nested snapshot to avoid recursion.
          savedShaders: [{ id: "nested", label: "Nope", source: "x", createdAt: 1 }],
        },
      },
    ];
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      savedShaders,
    });
    const parsed = parsePlaygroundStateInput(text);
    const restored = parsed.savedShaders?.[0];
    expect(restored?.source).toBe("void mainImage(){ C }");
    expect(restored?.config?.displayWidth).toBe(1280);
    expect(restored?.config?.displayHeight).toBe(720);
    // Nested snapshot must not recursively embed the library.
    expect(restored?.config?.savedShaders).toBeUndefined();
  });

  it("round-trips a color preset library through serialize/parse", () => {
    const colorPresets = [
      {
        id: "sunset",
        label: "Sunset",
        stripes: [normalizeStripe({ hex: "#102030", startFrom: 0, width: 3 })],
        createdAt: 11,
      },
    ];
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      colorPresets,
    });
    const wire = JSON.parse(text);
    expect(wire.v).toBe(7);
    expect(wire.cp?.[0]?.l).toBe("Sunset");
    const parsed = parsePlaygroundStateInput(text);
    expect(parsed.colorPresets?.[0]?.label).toBe("Sunset");
    expect(parsed.colorPresets?.[0]?.stripes?.[0]?.hex).toBe("#102030");
  });

  it("omits the color preset library when empty", () => {
    const text = serializePlaygroundState({
      duotoneEnabled: true,
      stripes: DEFAULT_STRIPES.map((stripe) => ({ ...stripe })),
      colorPresets: [],
    });
    expect(JSON.parse(text)).not.toHaveProperty("cp");
    expect(parsePlaygroundStateInput(text).colorPresets).toBeUndefined();
  });
});

describe("saved shader storage", () => {
  afterEach(() => {
    localStorage.removeItem(PLAYGROUND_LS_KEY);
  });

  it("adds, lists, and deletes saved shaders", () => {
    expect(loadSavedShaders()).toEqual([]);
    const created = addSavedShader("  My Shader ", "void mainImage(){}");
    expect(created.label).toBe("My Shader");
    const loaded = loadSavedShaders();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.source).toBe("void mainImage(){}");
    const remaining = deleteSavedShader(created.id);
    expect(remaining).toEqual([]);
    expect(loadSavedShaders()).toEqual([]);
  });

  it("merges imported shaders without duplicating identical entries", () => {
    const first = addSavedShader("A", "source-a");
    const mergedSame = mergeSavedShaders([{ id: "other", label: "A", source: "source-a", createdAt: 5 }]);
    expect(mergedSame).toHaveLength(1);
    expect(mergedSame[0]?.id).toBe(first.id);
    const mergedNew = mergeSavedShaders([{ id: "b", label: "B", source: "source-b", createdAt: 6 }]);
    expect(mergedNew.map((entry) => entry.label)).toEqual(["A", "B"]);
  });
});

describe("color preset storage", () => {
  afterEach(() => {
    localStorage.removeItem(PLAYGROUND_LS_KEY);
  });

  it("adds, lists, and deletes color presets", () => {
    expect(loadColorPresets()).toEqual([]);
    const created = addColorPreset("  Sunset ", [normalizeStripe({ hex: "#102030", startFrom: 0, width: 3 })]);
    expect(created.label).toBe("Sunset");
    const loaded = loadColorPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.stripes[0]?.hex).toBe("#102030");
    const remaining = deleteColorPreset(created.id);
    expect(remaining).toEqual([]);
    expect(loadColorPresets()).toEqual([]);
  });

  it("merges imported color presets without duplicating identical palettes", () => {
    const stripes = [normalizeStripe({ hex: "#102030", startFrom: 0, width: 3 })];
    const first = addColorPreset("Sunset", stripes);
    const mergedSame = mergeColorPresets([{ id: "other", label: "Sunset", stripes, createdAt: 5 }]);
    expect(mergedSame).toHaveLength(1);
    expect(mergedSame[0]?.id).toBe(first.id);
    const mergedNew = mergeColorPresets([
      { id: "b", label: "Ocean", stripes: [normalizeStripe({ hex: "#0044ff", startFrom: 0, width: 2 })], createdAt: 6 },
    ]);
    expect(mergedNew.map((entry) => entry.label)).toEqual(["Sunset", "Ocean"]);
  });
});

describe("playground catalog load helpers", () => {
  const catalog: PlaygroundCatalogEntry[] = [
    {
      id: "example10",
      label: "example 10",
      url: "/playground/example10.jpg",
      mediaKind: "image",
      displayScale: 1,
      stripes: [],
      isUpload: false,
    },
    {
      id: "example5",
      label: "example 5",
      url: "/playground/example5.mp4",
      mediaKind: "video",
      displayScale: 1,
      stripes: [],
      isUpload: false,
    },
    {
      id: "upload:missing",
      label: "missing upload",
      url: "",
      mediaKind: "image",
      displayScale: 1,
      stripes: [],
      isUpload: true,
    },
  ];

  it("prefers the selected texture when it has a URL", () => {
    expect(catalogEntriesForLoadAttempt(catalog, "example5").map((entry) => entry.id)).toEqual([
      "example5",
      "example10",
    ]);
  });

  it("falls back to the first loadable texture when the selection is missing or empty", () => {
    expect(catalogEntriesForLoadAttempt(catalog, "upload:missing").map((entry) => entry.id)).toEqual([
      "example10",
      "example5",
    ]);
    expect(firstCatalogEntryWithUrl(catalog)?.id).toBe("example10");
  });
});
