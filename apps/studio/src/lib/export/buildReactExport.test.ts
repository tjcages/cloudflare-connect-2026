import { describe, expect, it } from "vitest";
import { cloneDefaultStripes } from "@necatikcl/stripes-shader";
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
    expect(prompt).toContain("pnpm add pixi.js");
    expect(prompt).not.toContain("pnpm add react");
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
    expect(bundle.installInstructions).not.toMatch(/pnpm add pixi\.js react/);
  });

  it("generates full portable bundle without index.ts barrel", () => {
    const bundle = buildReactExport(baseSnapshot, { targetDir: "components" });
    expect(bundle.files.length).toBeGreaterThan(10);
    expect(bundle.files.some((file) => file.relativePath.endsWith("index.ts"))).toBe(false);
    expect(bundle.files.some((file) => file.relativePath.endsWith("/scene.ts"))).toBe(true);
    expect(bundle.files.some((file) => file.relativePath.includes("/runtime/computeBlockGrid.ts"))).toBe(true);
    expect(bundle.files.some((file) => file.relativePath.includes("/runtime/playgroundTextureAdjustments.ts"))).toBe(
      true,
    );
    expect(bundle.files.some((file) => file.relativePath.includes("/runtime/playgroundSourceTransform.ts"))).toBe(true);
  });

  it("includes non-default texture controls in generated defaultConfig", () => {
    const snapshot = buildPlaygroundExportSnapshot({
      config: {
        duotoneEnabled: true,
        stripesEnabled: false,
        textureAdjustments: {
          brightness: 0.1,
          exposure: 0.2,
          contrast: 1.5,
          blackPoint: 0.1,
          whitePoint: 0.9,
          gamma: 0.8,
          invert: true,
          posterizeLevels: 4,
          thresholdBias: 0.05,
          noiseAmount: 0.1,
          blurRadius: 1,
          sharpenAmount: 0.5,
        },
        sourceTransform: { fit: "cover", zoom: 1.25, panX: 0.2, panY: -0.2 },
        stripes: cloneDefaultStripes(),
      },
      displayWidth: 640,
      displayHeight: 360,
      mediaKind: "image",
    });
    const bundle = buildReactExport(snapshot, { targetDir: "components" });
    const typesSource = bundle.files.find((file) => file.relativePath.endsWith("/types.ts"))?.content ?? "";

    expect(typesSource).toContain("textureAdjustments");
    expect(typesSource).toContain('"stripesEnabled": false');
    expect(typesSource).toContain('"contrast": 1.5');
    expect(typesSource).toContain("sourceTransform");
    expect(typesSource).toContain('"fit": "cover"');
  });

  it("manual astro text is a plain description without code fences", () => {
    const bundle = buildReactExport(baseSnapshot, { targetDir: "src/components" });
    expect(bundle.astroUsage).not.toContain("```");
    expect(bundle.astroUsage).not.toContain("## Instructions");
    expect(bundle.astroUsage).toContain("Astro");
    expect(bundle.astroUsage).toContain("client:load");
  });
});
