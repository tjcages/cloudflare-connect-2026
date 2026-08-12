/**
 * CF-16 pack-density axis — three structural reads of the Twizzler line pack.
 *
 * Axis: how the pack reads as a mass (lineCount / lineWidth / depthSpread + fog).
 *   A — airier: few thick strands, low fog → each line holds color, open gaps.
 *   B — lock B baseline: 240-line mid pack (untouched reference).
 *   C — 320 hairlines, wide spread, heavy fog → misty dense mass.
 * Heat (wrinkles/wrinkleStrength) and the bend spine stay locked to B everywhere.
 *
 * Usage:
 *   node scripts/cf16-pack-density-abc.mjs
 *   node scripts/cf16-pack-density-abc.mjs --out /opt/cursor/artifacts/cf16-pack-density
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
  : "/opt/cursor/artifacts/cf16-pack-density";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!base?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "airier — 72 thick strands, tight spread, fog 0.65: each line holds color, gaps breathe",
    tweaks: { lineCount: 72, lineWidth: 2.2, depthSpread: 0.75, fogStrength: 0.65, opacity: 0.78 },
  },
  {
    id: "B",
    label: "lock B — 240-line mid pack, width 0.72, spread 1.18, fog 1.0 (baseline)",
    tweaks: {},
  },
  {
    id: "C",
    label: "misty mass — 360 hairlines (0.3), spread 1.8, fog 1.5: far pack dissolves to haze",
    tweaks: { lineCount: 360, lineWidth: 0.3, depthSpread: 1.8, fogStrength: 1.5, opacity: 0.95 },
  },
];

const bundlePath = "/tmp/cf16-pack-density-bundle.js";
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
  const outPath = resolve(outDir, `pack-density-${variant.id}.png`);
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
const stackPath = resolve(outDir, "pack-density-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  axis: "pack density + fog read (CF-16)",
  base: {
    lineCount: base.lineCount,
    lineWidth: base.lineWidth,
    depthSpread: base.depthSpread,
    opacity: base.opacity,
    fogStrength: base.fogStrength ?? 1,
  },
  stackPath,
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "pack-density-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
