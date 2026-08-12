/**
 * Capture authored CF-16 macro-hill pass 4 plus the target reference.
 *
 * Usage:
 *   node scripts/capture-twizzler-macro-hills-pass4.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts";
const bundlePath = "/tmp/twizzler-macro-hills-pass4-bundle.js";
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...preset.lab.twizzler, speed: 0, depthTerrain: 0 };
if (base.lineCount !== 240) {
  throw new Error(`CF-16 macro-hill pass 4 requires the 240-line lock; received ${base.lineCount}`);
}

const variants = [
  { id: "A4", label: "TARGET study · quiet hills → compressed trough → hero rise", hillRhythm: 0 },
  { id: "B4", label: "flat opening → offset pinch → delayed crest → terminal dip", hillRhythm: 1 },
  { id: "C4", label: "left pulses → narrow waist → long fan rise → two waves", hillRhythm: 2 },
];

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
<canvas id="capture" width="1600" height="416" style="display:block"></canvas>
<script>${code}</script>
</body></html>`);

const targetDataUrl = `data:image/png;base64,${readFileSync(targetPath).toString("base64")}`;
await page.evaluate(async (source) => {
  const capture = document.getElementById("capture");
  const context = capture.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, capture.width, capture.height);
  context.fillStyle = "#111111";
  context.fillRect(0, 0, capture.width, 96);
  context.fillStyle = "#ffffff";
  context.font = "700 48px ui-sans-serif, system-ui, sans-serif";
  context.fillText("TARGET", 24, 66);
  context.font = "600 24px ui-sans-serif, system-ui, sans-serif";
  context.fillText("reference silhouette · quiet left → compressed center → hero rise → restrained ripples", 220, 59);

  const image = new Image();
  image.src = source;
  await image.decode();
  const drawHeight = (capture.width / image.width) * image.height;
  const top = 96 + (320 - drawHeight) * 0.5;
  context.drawImage(image, 0, top, capture.width, drawHeight);
}, targetDataUrl);
const targetPanelPath = resolve(outDir, "twizzler-macro-hills-pass4-TARGET.png");
await page.locator("#capture").screenshot({ path: targetPanelPath, type: "png" });

const stills = [];
for (const variant of variants) {
  const settings = { ...base, hillRhythm: variant.hillRhythm };
  await page.evaluate(
    ({ id, label, settings: input }) => {
      const capture = document.getElementById("capture");
      const context = capture.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, capture.width, capture.height);

      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 320;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, ribbon.width, ribbon.height, 0, input);

      context.fillStyle = "#111111";
      context.fillRect(0, 0, capture.width, 96);
      context.drawImage(ribbon, 0, 96);
      context.fillStyle = "#ffffff";
      context.font = "700 48px ui-sans-serif, system-ui, sans-serif";
      context.fillText(id, 24, 66);
      context.font = "600 24px ui-sans-serif, system-ui, sans-serif";
      context.fillText(`${label} · 240 cubic fibers · B heat · rain off`, 120, 59);
    },
    { id: variant.id, label: variant.label, settings },
  );

  const path = resolve(outDir, `twizzler-macro-hills-pass4-${variant.id}.png`);
  await page.locator("#capture").screenshot({ path, type: "png" });
  stills.push({ ...variant, path });
}

const panelPaths = [targetPanelPath, ...stills.map(({ path }) => path)];
const stackHtml = panelPaths
  .map((path) => {
    const image = readFileSync(path).toString("base64");
    return `<img src="data:image/png;base64,${image}" style="display:block;width:1600px;margin-bottom:12px">`;
  })
  .join("");
await page.setViewportSize({ width: 1600, height: 1712 });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#111">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "twizzler-macro-hills-pass4-TARGET-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  // The temporary bundle is best-effort cleanup.
}

const manifest = {
  pass: 4,
  target: "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png",
  targetPanelPath,
  locked: {
    lineCount: base.lineCount,
    depthTerrain: base.depthTerrain,
    wrinkles: base.wrinkles,
    wrinkleStrength: base.wrinkleStrength,
    speed: base.speed,
    rain: false,
    stroke: "Catmull-Rom cubic Bézier",
    macroWaveRecipe: "authored knots; no global sine",
  },
  stills,
  stackPath,
};
writeFileSync(resolve(outDir, "twizzler-macro-hills-pass4-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
