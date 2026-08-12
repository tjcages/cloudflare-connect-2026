/**
 * Capture Shadertoy-style sine-pack Twizzler (depthTerrain 3/4/5) with CF colors.
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
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };

const variants = [
  {
    id: "A",
    label: "A — exact Shadertoy sin(t)+cos(t/2)",
    tweaks: { depthTerrain: 3, wrinkles: 1.4, wrinkleStrength: 0.1, centerY: 0.5, lineCount: 40, lineWidth: 0.9, amplitude: 1.0, scale: 1, pointSpacing: 1 },
  },
  {
    id: "B",
    label: "B — Shadertoy m·t + cos(t/2)",
    tweaks: { depthTerrain: 4, wrinkles: 2.8, wrinkleStrength: 0.1, centerY: 0.5, lineCount: 40, lineWidth: 0.9, amplitude: 1.0, scale: 1, pointSpacing: 1 },
  },
  {
    id: "C",
    label: "C — Shadertoy m·t + cos(t)",
    tweaks: { depthTerrain: 5, wrinkles: 4.2, wrinkleStrength: 0.1, centerY: 0.5, lineCount: 40, lineWidth: 0.85, amplitude: 1.0, scale: 1, pointSpacing: 1 },
  },
];

const bundlePath = "/tmp/twizzler-bundle.js";
const esbuildBin = resolve(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild");
execFileSync(
  esbuildBin,
  [
    resolve(root, "apps/lab/src/twizzler.ts"),
    "--bundle",
    "--format=iife",
    "--global-name=TwizzlerMod",
    "--platform=browser",
    "--target=es2022",
    `--outfile=${bundlePath}`,
  ],
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
      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 320;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(ribbon, 0, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 24, 66);
      ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 110, 58);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-shaderpack-${variant.id}.png`);
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
const stackPath = resolve(outDir, "twizzler-shaderpack-ABC-stack.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, resolve(outDir, "twizzler-ABC-stack.png"));

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}
writeFileSync(resolve(outDir, "twizzler-variants.json"), JSON.stringify({ paths, stackPath }, null, 2));
console.log(JSON.stringify({ paths: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })), stackPath }, null, 2));
