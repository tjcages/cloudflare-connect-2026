import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyRainAppearance,
  CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
  resolveConnectHeroRain,
  resolveRainOutsideColor,
} from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import {
  applyTwizzlerAppearance,
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  resolveConnectTwizzlerSettings,
} from "../hero/twizzler-control-settings";
import { buildRainSections } from "../panel/rainFields";
import { buildTwizzlerSections, seedTwizzlerPanelValues } from "../panel/twizzlerFields";
import { buildAnimationSvg } from "./animation-exports";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Connect animations page", () => {
  it("ships a chrome-free full-screen route", () => {
    const page = read("src/pages/connect/animations.astro");
    expect(page).toContain("ConnectAnimationsStage");
    expect(page).toContain("interfaceMode={false}");
    expect(page).toContain("header={false}");
    expect(page).toContain("footer={false}");
    expect(page).toContain("main={false}");
  });

  it("portals the dev panel and exposes both authoring targets", () => {
    const stage = read("src/components/_pages/connect/animations/ConnectAnimationsStage.tsx");
    expect(stage).toContain("createPortal(controls, document.body)");
    expect(stage).toContain('["twizzler", "rain"]');
    expect(stage).toContain("AnimationExportTools");
    expect(stage).toContain("settings.enabled ?");
    expect(stage).toContain("rain.enabled ?");
  });

  it("puts a general enabled toggle first for both shaders", () => {
    const twizzlerSections = buildTwizzlerSections(seedTwizzlerPanelValues(CONNECT_TWIZZLER_CONTROL_DEFAULTS));
    const rainSections = buildRainSections();

    expect(CONNECT_TWIZZLER_CONTROL_DEFAULTS.enabled).toBe(true);
    expect(CONNECT_HERO_RAIN_CONTROL_DEFAULTS.enabled).toBe(true);
    expect(twizzlerSections[0]?.title).toBe("General");
    expect(twizzlerSections[0]?.fields[0]).toMatchObject({ key: "enabled", label: "Enabled", type: "toggle" });
    expect(rainSections[0]?.title).toBe("General");
    expect(rainSections[0]?.fields[0]).toMatchObject({ key: "enabled", label: "Enabled", type: "toggle" });
  });

  it("restores Light and Dark appearance presets for both shaders", () => {
    const twizzlerSections = buildTwizzlerSections(seedTwizzlerPanelValues(CONNECT_TWIZZLER_CONTROL_DEFAULTS));
    const rainSections = buildRainSections();
    expect(twizzlerSections[1]?.title).toBe("Appearance");
    expect(twizzlerSections[1]?.fields[0]).toMatchObject({ key: "appearance", label: "Mode", type: "select" });
    expect(rainSections[1]?.title).toBe("Appearance");
    expect(rainSections[1]?.fields[0]).toMatchObject({ key: "appearance", label: "Mode", type: "select" });

    const darkTwizzler = applyTwizzlerAppearance(CONNECT_TWIZZLER_CONTROL_DEFAULTS, "dark");
    expect(darkTwizzler).toMatchObject({
      appearance: "dark",
      colorNear: "#ffefd4",
      colorFar: "#ffd39e",
      colorEdge: "#f0f0f0",
      backgroundColor: "#f86a00",
      ribbonColorMode: "sharedGradient",
    });
    expect(darkTwizzler.gradientStops.map((stop) => stop.color)).toEqual(["#ffd39e", "#f0f0f0", "#ffefd4"]);

    const geometry = CONNECT_HERO_RAIN_CONTROL_DEFAULTS.stripes.map((stripe) => ({
      startFrom: stripe.startFrom,
      width: stripe.width,
      opacity: stripe.opacity,
    }));
    const darkRain = applyRainAppearance(CONNECT_HERO_RAIN_CONTROL_DEFAULTS, "dark");
    expect(darkRain.appearance).toBe("dark");
    expect(darkRain.backgroundColor).toBe("#000000");
    expect(darkRain.stripes.every((stripe) => /^#[0-9a-f]{6}$/i.test(stripe.color))).toBe(true);
    expect(
      darkRain.stripes.every((stripe) => {
        const [r, g, b] =
          stripe.color
            .slice(1)
            .match(/../g)
            ?.map((channel) => Number.parseInt(channel, 16)) ?? [];
        return r === g && g === b;
      }),
    ).toBe(true);
    expect(darkRain.stripes.map(({ startFrom, width, opacity }) => ({ startFrom, width, opacity }))).toEqual(geometry);

    const lightRain = applyRainAppearance(darkRain, "light");
    expect(lightRain.backgroundColor).toBe("#ffffff");
    expect(lightRain.stripes.map((stripe) => stripe.color)).toEqual(
      CONNECT_HERO_RAIN_CONTROL_DEFAULTS.stripes.map((stripe) => stripe.color),
    );
  });

  it("surfaces a rain-only zoom and links it to the engine transform", () => {
    const rainFields = read("src/components/_pages/connect/panel/rainFields.tsx");
    expect(rainFields).toContain('num("zoom", "Rain zoom", 0.1, 8, 0.01)');
    expect(rainFields.match(/num\("zoom"/g)).toHaveLength(1);

    const rain = resolveConnectHeroRain({
      ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
      zoom: 0.65,
    });
    expect(rain.config.transform?.zoom).toBe(0.65);
  });

  it("uses the inverse canvas color outside the zoomed rain source", () => {
    expect(
      resolveRainOutsideColor({
        ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
        backgroundColor: "#ffffff",
      }),
    ).toBe(0x000000);
    expect(
      resolveRainOutsideColor({
        ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
        backgroundColor: "#000000",
      }),
    ).toBe(0xffffff);

    const rain = resolveConnectHeroRain({
      ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
      backgroundColor: "#000000",
    });
    expect(rain.config.background?.color).toBe(0xffffff);
  });

  it("scales the complete stripe field without changing render resolution", () => {
    const defaults = resolveConnectHeroRain(CONNECT_HERO_RAIN_CONTROL_DEFAULTS);
    const scaled = resolveConnectHeroRain({
      ...CONNECT_HERO_RAIN_CONTROL_DEFAULTS,
      visualFieldScale: 0.5,
    });

    expect(scaled.config.grid?.cellWidth).toBe((defaults.config.grid?.cellWidth ?? 0) * 0.5);
    expect(scaled.config.grid?.cellHeight).toBe((defaults.config.grid?.cellHeight ?? 0) * 0.5);
    expect(scaled.config.grid?.gapX).toBe((defaults.config.grid?.gapX ?? 0) * 0.5);
    expect(scaled.config.stripes?.[0]?.width).toBe((defaults.config.stripes?.[0]?.width ?? 0) * 0.5);
    expect(scaled.config.stripeDots?.sizePx).toBe((defaults.config.stripeDots?.sizePx ?? 0) * 0.5);
    expect(scaled.config.fieldScale).toBe(defaults.config.fieldScale);

    const rainFields = read("src/components/_pages/connect/panel/rainFields.tsx");
    expect(rainFields).toContain('num("visualFieldScale", "Field scale", 0.1, 4, 0.01)');
    expect(rainFields).toContain('num("fieldScale", "Field resolution", 0.05, 2, 0.01)');
  });

  it("exports editable waveform and rain vectors from the live cell grid", async () => {
    const canvas = {
      clientHeight: 360,
      clientWidth: 640,
      height: 360,
      style: { height: "360px", width: "640px" },
      width: 640,
    } as HTMLCanvasElement;
    const svg = await buildAnimationSvg({
      animationTimeSec: 0,
      handle: {
        readCellGrid: async () => ({
          colors: null,
          cols: 2,
          rows: 2,
          values: new Uint8Array([0, 128, 192, 255]),
        }),
      } as never,
      rain: resolveConnectHeroRain(CONNECT_HERO_RAIN_CONTROL_DEFAULTS),
      rainCanvas: canvas,
      settings: CONNECT_HERO_TWIZZLER_DEFAULTS,
      twizzlerCanvas: canvas,
    });
    expect(svg).toContain('viewBox="0 0 640 360"');
    expect(svg).toContain('data-layer="twizzler"');
    expect(svg).toContain('data-layer="rain"');
    expect(svg).toContain('data-fiber="0"');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain("<path");
  });

  it("omits every disabled shader from vector exports", async () => {
    const canvas = {
      clientHeight: 360,
      clientWidth: 640,
      height: 360,
      style: { height: "360px", width: "640px" },
      width: 640,
    } as HTMLCanvasElement;
    const handle = {
      readCellGrid: async () => ({
        colors: null,
        cols: 2,
        rows: 2,
        values: new Uint8Array([0, 128, 192, 255]),
      }),
    } as never;
    const common = {
      animationTimeSec: 0,
      rain: resolveConnectHeroRain(CONNECT_HERO_RAIN_CONTROL_DEFAULTS),
      settings: CONNECT_HERO_TWIZZLER_DEFAULTS,
    };

    const twizzlerOnly = await buildAnimationSvg({
      ...common,
      handle: null,
      rainEnabled: false,
      twizzlerCanvas: canvas,
      twizzlerEnabled: true,
    });
    expect(twizzlerOnly).toContain('data-layer="twizzler"');
    expect(twizzlerOnly).not.toContain('data-layer="rain"');

    const rainOnly = await buildAnimationSvg({
      ...common,
      handle,
      rainCanvas: canvas,
      rainEnabled: true,
      twizzlerCanvas: null,
      twizzlerEnabled: false,
    });
    expect(rainOnly).not.toContain('data-layer="twizzler"');
    expect(rainOnly).toContain('data-layer="rain"');

    const backgroundOnly = await buildAnimationSvg({
      ...common,
      canvasHeightPx: 360,
      canvasWidthPx: 640,
      handle: null,
      rainEnabled: false,
      twizzlerCanvas: null,
      twizzlerEnabled: false,
    });
    expect(backgroundOnly).toContain('viewBox="0 0 640 360"');
    expect(backgroundOnly).toContain('fill="#ffffff"');
    expect(backgroundOnly).not.toContain('data-layer="twizzler"');
    expect(backgroundOnly).not.toContain('data-layer="rain"');

    const darkBackgroundOnly = await buildAnimationSvg({
      ...common,
      canvasHeightPx: 360,
      canvasWidthPx: 640,
      handle: null,
      rainEnabled: false,
      settings: resolveConnectTwizzlerSettings(applyTwizzlerAppearance(CONNECT_TWIZZLER_CONTROL_DEFAULTS, "dark")),
      twizzlerCanvas: null,
      twizzlerEnabled: false,
    });
    expect(darkBackgroundOnly).toContain('fill="#f86a00"');
  });

  it("uses the configured white canvas background and demo export controls", () => {
    const styles = read("src/components/_pages/connect/animations/connect-animations.css");
    const exportTools = read("src/components/_pages/connect/animations/AnimationExportTools.tsx");
    expect(styles).toContain("background: #ffffff");
    expect(exportTools).toContain("exportLabVideo");
    expect(exportTools).toContain("Export SVG");
    expect(exportTools).toContain("Export EPS");
    expect(exportTools).not.toContain("ControlActionGroup");
    expect(exportTools.match(/<ControlAction\s/g)).toHaveLength(3);
    expect(styles).not.toContain(".connect-animation-export button");
    expect(exportTools).not.toContain("Video duration");
    expect(exportTools).toContain("latestSettingsRef.current.enabled");
    expect(exportTools).toContain("latestRainRef.current.enabled");
    expect(resolveConnectHeroRain(CONNECT_HERO_RAIN_CONTROL_DEFAULTS).canvasBackground).toBe("#ffffff");
  });
});
