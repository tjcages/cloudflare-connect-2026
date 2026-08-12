/**
 * Fast Twizzler variant farm — one process, many stills (no per-agent boot).
 *
 * Keeps locked B base (240 lines, cubic stroke in engine). Only sweeps knobs /
 * light structural axes so you can pick winners quickly.
 *
 * Usage:
 *   node scripts/farm-twizzler-variants.mjs
 *   node scripts/farm-twizzler-variants.mjs --out /opt/cursor/artifacts/farm
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
  : "/opt/cursor/artifacts/farm";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!base?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  { id: "B0", label: "lock B (baseline)", tweaks: {} },
  // Z-lobe structure (dedicated heat recipe; no spine or placement changes)
  { id: "Z1", label: "fewer, wider Z lobes", tweaks: { heatVariant: 0 } },
  { id: "Z2", label: "mid-density wide Z lobes", tweaks: { heatVariant: 1 } },
  { id: "Z3", label: "denser Z spots", tweaks: { heatVariant: 2 } },
  // Amp energy
  { id: "E1", label: "quieter amp", tweaks: { wrinkleStrength: 0.09, amplitude: 0.85 } },
  { id: "E2", label: "hotter amp", tweaks: { wrinkleStrength: 0.18, amplitude: 1.0 } },
  { id: "E3", label: "hot + scale up", tweaks: { wrinkleStrength: 0.16, scale: 1.25 } },
  // Pack denseness / stroke
  { id: "D1", label: "thicker strokes", tweaks: { lineWidth: 0.9 } },
  { id: "D2", label: "hairlines", tweaks: { lineWidth: 0.45 } },
  { id: "D3", label: "300 lines", tweaks: { lineCount: 300, lineWidth: 0.55 } },
  // Vertical placement / spread
  { id: "P1", label: "pack higher", tweaks: { centerY: 0.32 } },
  { id: "P2", label: "pack lower", tweaks: { centerY: 0.48 } },
  { id: "P3", label: "more depth spread", tweaks: { depthSpread: 1.45 } },
  // Spine hills (bend amounts — keep cubic smooth)
  { id: "S1", label: "gentler bends", tweaks: { bendAmount: -0.06, bend2Amount: 0.08, bend3Amount: -0.06 } },
  { id: "S2", label: "stronger bends", tweaks: { bendAmount: -0.14, bend2Amount: 0.16, bend3Amount: -0.14 } },
  { id: "S3", label: "more depth lift", tweaks: { depthLift: 1.1 } },
];

const bundlePath = "/tmp/twizzler-farm-bundle.js";
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
      ctx.fillText(label, 110, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `farm-${variant.id}.png`);
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
const stackPath = resolve(outDir, "farm-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  base: {
    lineCount: base.lineCount,
    lineWidth: base.lineWidth,
    wrinkles: base.wrinkles,
    wrinkleStrength: base.wrinkleStrength,
    heatVariant: base.heatVariant,
    centerY: base.centerY,
  },
  stackPath,
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "farm-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
