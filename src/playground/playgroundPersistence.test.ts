import { afterEach, describe, expect, it } from "vitest";
import {
  catalogEntriesForLoadAttempt,
  defaultConfigForTexture,
  firstCatalogEntryWithUrl,
  parsePlaygroundStateInput,
  PLAYGROUND_LS_KEY,
  resolveInitialTextureId,
  serializePlaygroundState,
  type PlaygroundCatalogEntry,
} from "./playgroundPersistence";
import { DEFAULT_STRIPES } from "./stripeColors";
import { DEFAULT_PLAYGROUND_GRID_CONFIG } from "./playgroundGridConfig";
import { DEFAULT_PLAYGROUND_TEXTURE_ADJUSTMENTS } from "./playgroundTextureAdjustments";

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
