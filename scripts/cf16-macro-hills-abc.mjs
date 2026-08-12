/**
 * CF-16 macro-hills axis — A/B/C stills for the left→right hill rhythm.
 *
 * Axis: spine / bends / marketing centerY only. Locked: 240 lines, cubic
 * strokes, lock-B heat (wrinkles 1.4 / wrinkleStrength 0.14), rain off.
 *
 * A = calmer, fewer hills — hillRhythm 0 (calm recipe) with the built-in
 *     rhythm damped further via spineGain.
 * B = branch baseline (hillRhythm 1), untouched.
 * C = more hills / sharper valleys — hillRhythm 2 (accelerating recipe)
 *     plus extra narrow 4th/5th bend knots and amplified built-in rhythm.
 *
 * Usage:
 *   node scripts/cf16-macro-hills-abc.mjs
 *   node scripts/cf16-macro-hills-abc.mjs --out /opt/cursor/artifacts/cf16-macro-hills
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outArg = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "/opt/cursor/artifacts/cf16-macro-hills";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!base?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "calm long swell — one soft hill into a lifted tail",
    tweaks: {
      hillRhythm: 0,
      spineGain: 0.5,
      spineShare: 0.36,
      bendWidth: 0.2,
      bend4Position: 0.5,
      bend4Amount: 0.45,
      bend5Position: 0.14,
      bend5Amount: -0.4,
      depthLift: 0.5,
      leftHeight: 0.52,
      rightHeight: 0.42,
    },
  },
  { id: "B", label: "lock-B baseline energy (unchanged)", tweaks: {} },
  {
    id: "C",
    label: "accelerating multi-hill ridge — sharper valleys, still cubic-smooth",
    tweaks: {
      hillRhythm: 2,
      spineGain: 1.0,
      spineShare: 0.44,
      bendWidth: 0.055,
      bend4Position: 0.33,
      bend4Amount: 0.55,
      bend5Position: 0.52,
      bend5Amount: -0.55,
      depthLift: 1.0,
      leftHeight: 0.64,
      rightHeight: 0.3,
    },
  },
];

const bundlePath = "/tmp/twizzler-macro-hills-bundle.js";
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
<canvas id="c" width="1600" height="400"></canvas><script>${code}</script></body></html>`);

const results = [];
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
      ribbon.height = 300;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 300, 0, s);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, out.width, 88);
      ctx.drawImage(ribbon, 0, 88);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 42px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 20, 58);
      ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 80, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `macro-hills-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  results.push({ ...variant, outPath, settings });
}

const stackH = results.length * 412;
await page.setViewportSize({ width: 1600, height: Math.min(8000, stackH) });
const stackHtml = results
  .map((r) => {
    const b64 = readFileSync(r.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 8px"/>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "macro-hills-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  axis: "macro-hills (left→right spine rhythm)",
  base: {
    lineCount: base.lineCount,
    lineWidth: base.lineWidth,
    wrinkles: base.wrinkles,
    wrinkleStrength: base.wrinkleStrength,
    centerY: base.centerY,
  },
  stackPath,
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "macro-hills-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
