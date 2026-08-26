import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import { buildWaveformSvg } from "./animation-exports";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

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
    const stage = read(
      "src/components/_pages/connect/animations/ConnectAnimationsStage.tsx"
    );
    expect(stage).toContain("createPortal(controls, document.body)");
    expect(stage).toContain('["twizzler", "rain"]');
    expect(stage).toContain("AnimationExportTools");
  });

  it("exports editable waveform paths", () => {
    const svg = buildWaveformSvg(
      640,
      360,
      0,
      CONNECT_HERO_TWIZZLER_DEFAULTS,
      "#000000"
    );
    expect(svg).toContain('viewBox="0 0 640 360"');
    expect(svg).toContain('data-layer="connect-waveform"');
    expect(svg).toContain('data-fiber="0"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain("<path");
  });

  it("inverts the animation and video canvas backgrounds", () => {
    const styles = read(
      "src/components/_pages/connect/animations/connect-animations.css"
    );
    const exports = read(
      "src/components/_pages/connect/animations/animation-exports.ts"
    );
    expect(styles).toContain("background: #000000");
    expect(styles).not.toContain("background: #ffffff");
    expect(exports).toContain('context.fillStyle = "#000000"');
  });
});
