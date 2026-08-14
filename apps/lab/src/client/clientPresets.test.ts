import { describe, expect, it } from "vitest";
import type { ThemedEngineConfig } from "@necatikcl/stripes-engine";
import { LIBRARY_COLOR } from "../components/colorLibrary";
import {
  buildClientPreviewBundle,
  CLIENT_APPEARANCE_PRESETS,
  CLIENT_COLOR_PRESETS,
  CLIENT_GRAPHIC_MODES,
  CLIENT_LAYOUT_PRESETS,
  CLIENT_SIZE_PRESETS,
  clientGraphicFlags,
  DEFAULT_CLIENT_PREVIEW_STATE,
  findClientAppearancePreset,
  findClientColorPreset,
  findClientLayoutPreset,
  findClientSizePreset,
  rainLevaFromAppearance,
  rainLevaFromColor,
  rainLevaFromLayout,
  resetTweaksForLayout,
  resolveClientGraphicMode,
  resolveClientSvgExportLayers,
  shouldSyncHeroGraphicFromFlags,
  withClientRainFxVisibility,
} from "./clientPresets";

describe("client preview presets", () => {
  it("ships size, layout, color, and appearance preset catalogs", () => {
    expect(CLIENT_SIZE_PRESETS.map((p) => p.id)).toEqual(["banner-5x1", "wide-3x1", "hero-16x9", "square"]);
    expect(CLIENT_LAYOUT_PRESETS).toHaveLength(4);
    expect(CLIENT_COLOR_PRESETS.map((p) => p.id)).toEqual([
      "coral-classic",
      "red",
      "green",
      "blue",
      "purple",
      "soft-gold",
      "deep-ember",
      "light",
    ]);
    expect(CLIENT_APPEARANCE_PRESETS.map((p) => p.id)).toEqual(["light", "dark"]);
  });

  it("Default Color is the factory rain palette", () => {
    const preset = findClientColorPreset("coral-classic");
    expect(preset.label).toBe("Default");
    expect(preset.stripePalette).toBe("Default");
    expect(preset.twizzler.colorNear).toBe(LIBRARY_COLOR.orangeAccent);
  });

  it("Rain hue Color presets reuse COLOR_LIBRARY Pair/Accent/Deep", () => {
    const blue = findClientColorPreset("blue");
    expect(blue.label).toBe("Blue");
    expect(blue.stripePalette).toBe("Blue");
    expect(blue.twizzler.colorFar).toBe("#38c5f6");
    expect(blue.twizzler.colorNear).toBe("#1f72ff");
    expect(blue.twizzler.colorEdge).toBe("#1c50d9");
  });

  it("Light color preset matches Dark Appearance cream ink", () => {
    const color = findClientColorPreset("light");
    const dark = findClientAppearancePreset("dark");
    expect(color.label).toBe("Light");
    expect(color.twizzler).toEqual(dark.twizzler);
  });

  it("dark appearance is cream Twizzler on deep orange (stripes-settings-cf-base)", () => {
    const dark = findClientAppearancePreset("dark");
    expect(dark.backgroundHex).toBe("#f86a00");
    expect(dark.twizzler.colorFar).toBe("#ffd39e");
    expect(dark.twizzler.colorNear).toBe("#ffefd4");
    expect(dark.twizzler.colorEdge).toBe("#f0f0f0");
    expect(dark.ribbonColorMode).toBe("sharedGradient");
    const light = findClientAppearancePreset("light");
    expect(light.backgroundHex).toBe("#ffffff");
    expect(light.twizzler.colorNear).toBe("#f46021");
    expect(light.ribbonColorMode).toBe("sharedGradient");
  });

  it("maps Graphic modes to Twizzler / Rain layer flags", () => {
    expect(resolveClientGraphicMode(true, false)).toBe("twizzler");
    expect(resolveClientGraphicMode(false, true)).toBe("rain");
    expect(resolveClientGraphicMode(true, true)).toBe("both");
    expect(resolveClientGraphicMode(false, false)).toBe("twizzler");
    expect(clientGraphicFlags("twizzler")).toEqual({ twizzlerEnabled: true, rainEnabled: false });
    expect(clientGraphicFlags("rain")).toEqual({ twizzlerEnabled: false, rainEnabled: true });
    expect(clientGraphicFlags("both")).toEqual({ twizzlerEnabled: true, rainEnabled: true });
    expect(resolveClientSvgExportLayers("twizzler")).toEqual({ includeTwizzler: true, includeRain: false });
    expect(resolveClientSvgExportLayers("rain")).toEqual({ includeTwizzler: false, includeRain: true });
    expect(resolveClientSvgExportLayers("both")).toEqual({ includeTwizzler: true, includeRain: true });
    expect(CLIENT_GRAPHIC_MODES.map((m) => m.id)).toEqual(["twizzler", "rain", "both"]);
  });

  it("does not snap Graphic back to Twizzler while Rain flags are catching up (CF-67)", () => {
    const midSwitch = shouldSyncHeroGraphicFromFlags({
      prevFlags: { twizzlerEnabled: true, rainEnabled: false },
      twizzlerEnabled: true,
      rainEnabled: false,
      heroGraphic: "rain",
    });
    expect(midSwitch.sync).toBe(false);

    const afterFlags = shouldSyncHeroGraphicFromFlags({
      prevFlags: { twizzlerEnabled: false, rainEnabled: true },
      twizzlerEnabled: false,
      rainEnabled: true,
      heroGraphic: "rain",
    });
    expect(afterFlags.sync).toBe(false);

    const layoutApplied = shouldSyncHeroGraphicFromFlags({
      prevFlags: { twizzlerEnabled: true, rainEnabled: false },
      twizzlerEnabled: false,
      rainEnabled: true,
      heroGraphic: "twizzler",
    });
    expect(layoutApplied.sync).toBe(true);
    expect(layoutApplied.derived).toBe("rain");
  });

  it("gates rain FX off for Twizzler-only without mutating source knobs (CF-69)", () => {
    const source = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      rainEnabled: true,
    }).engineConfig as ThemedEngineConfig & {
      frames: { enabled: boolean };
      letters: { enabled: boolean };
      flames: { enabled: boolean };
      background: {
        stars: { enabled: boolean };
        meteors: { enabled: boolean };
      };
      sparkle: {
        gaps: { enabled: boolean };
        stripe: { enabled: boolean };
        width: { enabled: boolean };
        motion: { enabled: boolean };
      };
    };
    source.frames.enabled = true;
    source.letters.enabled = true;
    source.flames.enabled = true;
    source.background.stars.enabled = true;
    source.background.meteors.enabled = true;
    source.sparkle.stripe.enabled = true;
    source.sparkle.width.enabled = true;
    source.sparkle.motion.enabled = true;

    const gated = withClientRainFxVisibility(source, false) as typeof source;
    expect(gated.frames.enabled).toBe(false);
    expect(gated.letters.enabled).toBe(false);
    expect(gated.flames.enabled).toBe(false);
    expect(gated.background.stars.enabled).toBe(false);
    expect(gated.background.meteors.enabled).toBe(false);
    expect(gated.sparkle.gaps.enabled).toBe(false);
    expect(gated.sparkle.stripe.enabled).toBe(false);
    expect(gated.sparkle.width.enabled).toBe(false);
    expect(gated.sparkle.motion.enabled).toBe(false);
    // Source knobs unchanged (Graphic toggle must not wipe authored rain FX).
    expect(source.frames.enabled).toBe(true);
    expect(source.letters.enabled).toBe(true);
    expect(source.background.stars.enabled).toBe(true);

    const rainOn = withClientRainFxVisibility(source, true) as typeof source;
    expect(rainOn).toBe(source);
    expect(rainOn.frames.enabled).toBe(true);
  });

  it("builds Hero 16:9 with solid white stage and rain off by default", () => {
    const bundle = buildClientPreviewBundle(DEFAULT_CLIENT_PREVIEW_STATE);
    expect(bundle.canvasWidth).toBe(1280);
    expect(bundle.canvasHeight).toBe(720);
    expect(bundle.engineConfig.background?.transparent).toBe(false);
    expect(bundle.engineConfig.background?.color).toBe(0xffffff);
    expect(bundle.engineConfig.sparkle?.gaps?.enabled).toBe(false);
    // Rain off must not disable the stripe engine — LabApp hides the rain canvas instead.
    expect(bundle.engineConfig.stripesEnabled).toBe(true);
    expect(bundle.twizzler.lineCount).toBe(56);
    expect(bundle.twizzler.lineWidth).toBeCloseTo(2.3);
    expect(bundle.twizzler.pointSpacing).toBe(10);
    expect(bundle.twizzler.perspectiveWidth).toBeCloseTo(6.2);
    expect(bundle.twizzler.minLineWidth).toBeCloseTo(3.5);
    expect(bundle.twizzler.maxLineWidth).toBeCloseTo(24.1);
    expect(bundle.twizzler.color).toBe("#f46021");
    expect(bundle.twizzler.colorFar).toBe("#fea700");
    expect(bundle.twizzler.gradientStops).toEqual([
      { id: "far", x: 0.08, y: 0.78, offset: 0.08, color: "#fea700" },
      { id: "peak", x: 0.5, y: 0.16, offset: 0.5, color: "#e92e28" },
      { id: "near", x: 0.92, y: 0.72, offset: 0.92, color: "#f46021" },
    ]);
    expect(bundle.twizzler.colorEdge).toBe("#e92e28");
    expect(bundle.twizzler.opacity).toBeCloseTo(1);
    expect(bundle.twizzler.rotateXDeg).toBeCloseTo(12);
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-18);
    expect(bundle.twizzler.rotateZDeg).toBeCloseTo(0);
    expect(bundle.twizzler.gradientXEnabled).toBe(true);
    expect(bundle.twizzler.gradientYEnabled).toBe(true);
    expect(bundle.twizzler.gradientZEnabled).toBe(true);
    expect(bundle.twizzler.gradientsEnabled).toBe(true);
    expect(bundle.twizzler.ribbonColorMode).toBe("sharedGradient");
    expect(bundle.twizzler.depthTerrain).toBe(0);
  });

  it("toggles rain via sparkle.gaps without disabling the stripe engine", () => {
    const withRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: true });
    expect(withRain.engineConfig.sparkle?.gaps?.enabled).toBe(true);
    expect(withRain.engineConfig.stripesEnabled).toBe(true);
    expect(JSON.stringify(withRain.engineConfig)).not.toMatch(/rotateX|connectCamera|shaderView/i);

    const noRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: false });
    expect(noRain.engineConfig.sparkle?.gaps?.enabled).toBe(false);
    expect(noRain.engineConfig.stripesEnabled).toBe(true);
  });

  it("uses section-grid factory rain engine when rainEnabled (not Banner blank rain)", () => {
    const withRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: true });
    expect(withRain.engineConfig.grid?.cellWidth).toBe(17);
    expect(withRain.engineConfig.grid?.cellHeight).toBe(1);
    expect(withRain.engineConfig.grid?.angleDeg).toBe(45);
    expect(withRain.engineConfig.sparkle?.gaps?.coverage).toBe(0);
    expect((withRain.engineConfig.stripes ?? []).length).toBeGreaterThan(1);
    expect((withRain.engineConfig.stripes ?? []).every((s) => (s.opacity ?? 0) > 0)).toBe(true);

    const noRain = buildClientPreviewBundle({ ...DEFAULT_CLIENT_PREVIEW_STATE, rainEnabled: false });
    expect(noRain.engineConfig.grid?.cellWidth).toBe(3);
    expect(noRain.engineConfig.grid?.angleDeg).toBe(-38);
  });

  it("applies size, layout, and color overlays independently", () => {
    const size = findClientSizePreset("square");
    const layout = findClientLayoutPreset("high-fan");
    const color = findClientColorPreset("light");
    const bundle = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      sizeId: size.id,
      layoutId: layout.id,
      colorId: color.id,
      tweaks: resetTweaksForLayout(layout.id),
    });
    expect(bundle.canvasWidth).toBe(800);
    expect(bundle.canvasHeight).toBe(800);
    expect(bundle.twizzler.color).toBe("#ffefd4");
    expect(bundle.twizzler.colorFar).toBe("#ffd39e");
    expect(bundle.twizzler.colorEdge).toBe("#f0f0f0");
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-28);
    expect(bundle.twizzler.centerY).toBeCloseTo(0.38);
  });

  it("layout presets never carry color fields", () => {
    for (const layout of CLIENT_LAYOUT_PRESETS) {
      expect(layout.twizzler).not.toHaveProperty("color");
      expect(layout.twizzler).not.toHaveProperty("colorFar");
      expect(layout.twizzler).not.toHaveProperty("colorNear");
      expect(layout.twizzler).not.toHaveProperty("colorEdge");
    }
  });

  it("size presets only define canvas dimensions", () => {
    for (const size of CLIENT_SIZE_PRESETS) {
      expect(Object.keys(size).sort()).toEqual(["height", "id", "label", "width"]);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });

  it("lets tweaks override layout/color for standard knobs only", () => {
    const bundle = buildClientPreviewBundle({
      ...DEFAULT_CLIENT_PREVIEW_STATE,
      tweaks: {
        opacity: 0.5,
        scale: 0.9,
        twist: 2,
        rotateXDeg: 20,
        rotateYDeg: -30,
        rotateZDeg: 5,
        amplitude: 0.7,
        centerY: 0.55,
        speed: 0.2,
      },
    });
    expect(bundle.twizzler.opacity).toBeCloseTo(0.5);
    expect(bundle.twizzler.rotateXDeg).toBeCloseTo(20);
    expect(bundle.twizzler.rotateYDeg).toBeCloseTo(-30);
    expect(bundle.twizzler.speed).toBeCloseTo(0.2);
    expect(bundle.twizzler.lineCount).toBe(56);
  });

  it("maps Layout / Color / Appearance presets onto Rain Leva keys", () => {
    const layout = rainLevaFromLayout("high-fan");
    expect(layout.connectCameraRotateY).toBeDefined();
    expect(layout.connectCameraPanY).toBeDefined();

    const color = rainLevaFromColor("coral-classic");
    expect(color.stripePalette).toBe("Default");
    expect(color.connectFillColor).toBe(LIBRARY_COLOR.orangeAccent);
    expect(color.connectFillColor2).toBe(LIBRARY_COLOR.orangePair);

    expect(rainLevaFromColor("blue").stripePalette).toBe("Blue");
    expect(rainLevaFromColor("green").stripePalette).toBe("Green");
    expect(rainLevaFromColor("red").stripePalette).toBe("Red");
    expect(rainLevaFromColor("purple").stripePalette).toBe("Purple");

    const appearance = rainLevaFromAppearance("dark");
    expect(appearance.backgroundColor).toBe("#f86a00");
    expect(appearance.connectFillColor).toBeDefined();
  });
});
