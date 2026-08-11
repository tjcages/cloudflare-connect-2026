/**
 * Capture three distinct Twizzler A/B/C experiments with exaggerated Z (depth) spread.
 * Usage: node scripts/capture-twizzler-variants.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = preset.lab?.twizzler;
if (!base) throw new Error("missing lab.twizzler");

const aBase = {
  ...base,
  color: "#e8481c",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffc857",
  opacity: 0.88,
  speed: 0,
  edgeFluctuation: 0,
  edgeSpeed: 0,
  stippleSize: 0,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "A — deep Z fan + rolling hills (A2)",
    tweaks: {
      depthTerrain: 0,
      depthSpread: 1.85,
      depthLift: 0.95,
      amplitude: 0.95,
      wrinkleStrength: 0.028,
      wrinkles: 2.5,
      scale: 1.08,
      lineCount: 36,
      lineWidth: 2.6,
      twist: 1.05,
      bendAmount: -0.14,
      bend2Amount: 0.18,
      bend3Amount: -0.16,
      depthAmount: 1.35,
      rightHeight: 0.28,
    },
  },
  {
    id: "B",
    label: "B — extreme Z poles + jagged terrain",
    tweaks: {
      depthTerrain: 1,
      depthSpread: 2.35,
      depthLift: 1.0,
      amplitude: 1.0,
      wrinkleStrength: 0.07,
      wrinkles: 5.2,
      scale: 1.2,
      lineCount: 48,
      lineWidth: 2.0,
      twist: 1.4,
      bendAmount: -0.3,
      bend2Amount: 0.34,
      bend3Amount: -0.32,
      depthAmount: 1.55,
      rightHeight: 0.18,
    },
  },
  {
    id: "C",
    label: "C — sparse near/far layers + long sweep",
    tweaks: {
      depthTerrain: 2,
      depthSpread: 2.1,
      depthLift: 1.0,
      amplitude: 0.9,
      wrinkleStrength: 0.016,
      wrinkles: 1.5,
      scale: 1.3,
      lineCount: 22,
      lineWidth: 3.6,
      twist: 0.75,
      bendAmount: -0.1,
      bend2Amount: 0.12,
      bend3Amount: -0.38,
      depthAmount: 1.1,
      rightHeight: 0.42,
    },
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
const page = await browser.newPage({ viewport: { width: 1600, height: 400 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="320" style="display:block;width:1600px;height:320px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

const paths = [];
for (const variant of variants) {
  const settings = { ...aBase, ...variant.tweaks, speed: 0 };
  await page.evaluate((s) => {
    const ribbon = document.createElement("canvas");
    ribbon.width = 1600;
    ribbon.height = 320;
    // eslint-disable-next-line no-undef
    TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
    const out = document.getElementById("c");
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(ribbon, 0, 0);
  }, settings);
  const outPath = resolve(outDir, `twizzler-variant-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  paths.push({ ...variant, outPath, tweaks: variant.tweaks });
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

writeFileSync(
  resolve(outDir, "twizzler-variants.json"),
  JSON.stringify(
    paths.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
    null,
    2,
  ),
);
console.log(JSON.stringify({ variants: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })) }, null, 2));
