import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONNECT_HERO_RAIN_CONTROL_DEFAULTS, resolveConnectHeroRain } from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
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

  it("uses the configured white canvas background and demo export controls", () => {
    const styles = read("src/components/_pages/connect/animations/connect-animations.css");
    const exportTools = read("src/components/_pages/connect/animations/AnimationExportTools.tsx");
    expect(styles).toContain("background: #ffffff");
    expect(exportTools).toContain("exportLabVideo");
    expect(exportTools).toContain("Export SVG");
    expect(exportTools).toContain("Export EPS");
    expect(exportTools).not.toContain("Video duration");
    expect(resolveConnectHeroRain(CONNECT_HERO_RAIN_CONTROL_DEFAULTS).canvasBackground).toBe("#ffffff");
  });
});
