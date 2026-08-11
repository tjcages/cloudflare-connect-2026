/**
 * Capture three A-direction Twizzler wave-amplitude experiments.
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

/** A-base + wave energy multipliers (2x / 3x / 4x). */
const aBase = {
  ...base,
  wrinkleStrength: 0.022,
  wrinkles: 2.2,
  depthLift: 0.7,
  lineCount: 42,
  lineWidth: 2.45,
  twist: 1.15,
  speed: 0,
  bendPosition: 0.18,
  bendAmount: -0.12,
  bend2Position: 0.46,
  bend2Amount: 0.16,
  bend3Position: 0.78,
  bend3Amount: -0.14,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A2",
    label: "A2 — ~2x wave amplitude / more hills",
    tweaks: {
      amplitude: 0.95,
      depthLift: 0.85,
      wrinkleStrength: 0.028,
      wrinkles: 2.6,
      scale: 1.05,
    },
  },
  {
    id: "A3",
    label: "A3 — ~3x wave amplitude / lively terrain",
    tweaks: {
      amplitude: 1.0,
      depthLift: 1.0,
      wrinkleStrength: 0.038,
      wrinkles: 3.4,
      scale: 1.12,
      bendAmount: -0.18,
      bend2Amount: 0.22,
      bend3Amount: -0.2,
    },
  },
  {
    id: "A4",
    label: "A4 — ~4x wave amplitude / bold multi-hills",
    tweaks: {
      amplitude: 1.0,
      depthLift: 1.0,
      wrinkleStrength: 0.05,
      wrinkles: 4.2,
      scale: 1.22,
      bendAmount: -0.24,
      bend2Amount: 0.28,
      bend3Amount: -0.26,
      bend2Position: 0.42,
      bend3Position: 0.72,
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
