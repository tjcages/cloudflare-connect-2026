/**
 * Capture A/B/C around C-spread + B-amplitude merge.
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

/** C spread + B bumps DNA (banner lock). */
const merge = {
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
  // C spread
  depthSpread: 2.1,
  lineCount: 22,
  lineWidth: 3.6,
  twist: 0.75,
  scale: 1.25,
  // B amplitudes / bumps
  depthTerrain: 1,
  amplitude: 1.0,
  wrinkles: 5.2,
  wrinkleStrength: 0.07,
  depthLift: 1.0,
  depthAmount: 1.55,
  bendPosition: 0.22,
  bendAmount: -0.3,
  bend2Position: 0.38,
  bend2Amount: 0.34,
  bend3Position: 0.7,
  bend3Amount: -0.32,
  rightHeight: 0.28,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "A — C spread + B bumps (locked merge)",
    tweaks: {},
  },
  {
    id: "B",
    label: "B — merge + extra bump energy",
    tweaks: {
      wrinkles: 6.2,
      wrinkleStrength: 0.09,
      bendAmount: -0.36,
      bend2Amount: 0.4,
      bend3Amount: -0.38,
      scale: 1.32,
      amplitude: 1.0,
    },
  },
  {
    id: "C",
    label: "C — merge + wider sparse Z spread",
    tweaks: {
      depthSpread: 2.45,
      lineCount: 18,
      lineWidth: 4.0,
      twist: 0.65,
      scale: 1.28,
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
  const settings = { ...merge, ...variant.tweaks, speed: 0 };
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
