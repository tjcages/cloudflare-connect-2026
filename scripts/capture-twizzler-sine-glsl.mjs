/**
 * Capture exact Twizzler Sine GLSL (edge-locked + XYZ) stills.
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? {}), speed: 0 };

const variants = [
  {
    id: "A",
    label: "A — exact GLSL + edge lock (rot 0)",
    tweaks: { depthTerrain: 3, rotateX: 0, rotateY: 0, rotateZ: 0 },
  },
  {
    id: "B",
    label: "B — Rotate X 28° / Y -18°",
    tweaks: { depthTerrain: 3, rotateX: 28, rotateY: -18, rotateZ: 0, wrinkles: 2.8 },
  },
  {
    id: "C",
    label: "C — recipe 2 + Rotate Z 12°",
    tweaks: { depthTerrain: 5, rotateX: 12, rotateY: 8, rotateZ: 12, wrinkles: 4.2 },
  },
];

const entryPath = "/tmp/twizzler-sine-entry.ts";
writeFileSync(
  entryPath,
  `
import { createShaderTextureRenderer } from ${JSON.stringify(resolve(root, "apps/lab/src/shaderTextureSource.ts"))};
import { TWIZZLER_SINE_SHADER_SOURCE, twizzlerSineUniforms } from ${JSON.stringify(resolve(root, "apps/lab/src/twizzlerSineShader.ts"))};
import { normalizeTwizzlerSettings } from ${JSON.stringify(resolve(root, "apps/lab/src/twizzler.ts"))};
(globalThis as any).TwizzlerSine = { createShaderTextureRenderer, TWIZZLER_SINE_SHADER_SOURCE, twizzlerSineUniforms, normalizeTwizzlerSettings };
`,
);

const bundlePath = "/tmp/twizzler-sine-bundle.js";
const esbuildBin = resolve(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild");
execFileSync(
  esbuildBin,
  [entryPath, "--bundle", "--format=iife", "--platform=browser", "--target=es2022", `--outfile=${bundlePath}`],
  { stdio: "inherit" },
);
const code = readFileSync(bundlePath, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 416 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="416"></canvas><script>${code}</script></body></html>`);

const paths = [];
for (const variant of variants) {
  const settings = { ...base, ...variant.tweaks, speed: 0 };
  await page.evaluate(
    ({ s, id, label }) => {
      const out = document.getElementById("c");
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      // eslint-disable-next-line no-undef
      const api = TwizzlerSine;
      const renderer = api.createShaderTextureRenderer(1600, 320);
      const err = renderer.setSource(api.TWIZZLER_SINE_SHADER_SOURCE);
      if (err) throw new Error(err);
      const tw = api.normalizeTwizzlerSettings(s);
      renderer.setUniforms(
        api.twizzlerSineUniforms(tw, {
          rotateXDeg: tw.rotateX,
          rotateYDeg: tw.rotateY,
          rotateZDeg: tw.rotateZ,
          panX: tw.panX,
          panY: tw.panY,
          distance: tw.viewDistance,
        }),
      );
      renderer.render(0, undefined, null);
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(renderer.canvas, 0, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 24, 66);
      ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 110, 58);
      renderer.dispose();
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-sine-glsl-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}.png`));
  paths.push({ ...variant, outPath });
}

await page.setViewportSize({ width: 1600, height: 1300 });
const stackHtml = paths
  .map((p) => {
    const b64 = readFileSync(p.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px"/>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0b0b0b">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "twizzler-sine-glsl-ABC-stack.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, resolve(outDir, "twizzler-ABC-stack.png"));

await browser.close();
try {
  unlinkSync(bundlePath);
  unlinkSync(entryPath);
} catch {
  /* ignore */
}
writeFileSync(resolve(outDir, "twizzler-variants.json"), JSON.stringify({ paths, stackPath }, null, 2));
console.log(JSON.stringify({ paths: paths.map((p) => ({ id: p.id, outPath: p.outPath })), stackPath }, null, 2));
