/**
 * Capture three Twizzler experiment variants (A/B/C) for CF-16 review.
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

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "A — mild gaps + soft Z bumps",
    tweaks: {
      wrinkleStrength: 0.018,
      wrinkles: 1.2,
      depthLift: 0.55,
      amplitude: 0.55,
      lineCount: 42,
      lineWidth: 2.4,
    },
  },
  {
    id: "B",
    label: "B — medium gaps + clearer Z hills",
    tweaks: {
      wrinkleStrength: 0.032,
      wrinkles: 1.8,
      depthLift: 0.85,
      amplitude: 0.62,
      lineCount: 40,
      lineWidth: 2.6,
    },
  },
  {
    id: "C",
    label: "C — strong irregular gaps + bold Z waves",
    tweaks: {
      wrinkleStrength: 0.048,
      wrinkles: 2.4,
      depthLift: 1.0,
      amplitude: 0.7,
      lineCount: 38,
      lineWidth: 2.75,
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
  const settings = { ...base, ...variant.tweaks, speed: 0 };
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
  paths.push({ ...variant, outPath, settings });
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

// Build labeled strip + individual labeled cards via a tiny HTML note file
writeFileSync(
  resolve(outDir, "twizzler-variants.json"),
  JSON.stringify(
    paths.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
    null,
    2,
  ),
);
console.log(JSON.stringify({ variants: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })) }, null, 2));
