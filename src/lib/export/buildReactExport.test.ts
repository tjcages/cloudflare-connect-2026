import { describe, expect, it } from "vitest";
import { cloneDefaultStripes } from "../../playground/stripeColors";
import { buildAiInstructions, buildReactExport } from "./buildReactExport";
import { buildPlaygroundExportSnapshot } from "./playgroundSnapshot";

const baseSnapshot = buildPlaygroundExportSnapshot({
  config: {
    duotoneEnabled: true,
    stripes: cloneDefaultStripes(),
  },
  displayWidth: 640,
  displayHeight: 360,
  mediaKind: "video",
});

describe("buildAiInstructions", () => {
  it("auto-detects components folder and does not ask user for paths", () => {
    const prompt = buildAiInstructions(baseSnapshot);
    expect(prompt).toContain("src/components");
    expect(prompt).toContain("Do **not** ask the user");
    expect(prompt).not.toContain("Playground config snapshot");
    expect(prompt).toContain("shaders.ts");
    expect(prompt).toContain("scene.ts");
    expect(prompt).toContain("runtime/stripeLetterFont.ts");
    expect(prompt).toContain("Playground parity");
    expect(prompt).toContain("Berkeley Mono Trial");
    expect(prompt).toContain("STRIPE_FILTER_VERTEX");
  });

  it("does not install react", () => {
    const prompt = buildAiInstructions(baseSnapshot);
    expect(prompt).toContain("npm install pixi.js");
    expect(prompt).not.toContain("npm install react");
  });

  it("ends with user instructions for Astro, not agent optional step", () => {
    const prompt = buildAiInstructions(baseSnapshot);
    const lintIndex = prompt.indexOf("Final verification");
    const instructionsIndex = prompt.indexOf("Instructions for the user");
    expect(lintIndex).toBeGreaterThan(-1);
    expect(instructionsIndex).toBeGreaterThan(lintIndex);
    expect(prompt).toContain("do not implement Astro yourself");
    expect(prompt).toContain("relay only");
    expect(prompt).not.toContain("## 9. Optional: Using in Astro");
  });
});

describe("buildReactExport", () => {
  it("does not include react in install instructions", () => {
    const bundle = buildReactExport(baseSnapshot, { targetDir: "src/components" });
    expect(bundle.installInstructions).toContain("pixi.js");
    expect(bundle.installInstructions).not.toMatch(/npm install pixi\.js react/);
  });

  it("generates full portable bundle without index.ts barrel", () => {
    const bundle = buildReactExport(baseSnapshot, { targetDir: "components" });
    expect(bundle.files.length).toBeGreaterThan(10);
    expect(bundle.files.some((file) => file.relativePath.endsWith("index.ts"))).toBe(false);
    expect(bundle.files.some((file) => file.relativePath.endsWith("/scene.ts"))).toBe(true);
    expect(bundle.files.some((file) => file.relativePath.includes("/runtime/computeBlockGrid.ts"))).toBe(true);
  });

  it("manual astro text is a plain description without code fences", () => {
    const bundle = buildReactExport(baseSnapshot, { targetDir: "src/components" });
    expect(bundle.astroUsage).not.toContain("```");
    expect(bundle.astroUsage).not.toContain("## Instructions");
    expect(bundle.astroUsage).toContain("Astro");
    expect(bundle.astroUsage).toContain("client:load");
  });
});
