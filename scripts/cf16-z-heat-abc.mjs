/**
 * CF-16 Z-heat axis — A/B/C stills for the Z-scattered amplitude-heat exploration.
 *
 * Axis: how many / how wide the amplitude-heat lobes sit through DEPTH (Z /
 * across the 240-line stack), keeping the fluid along-X behavior. Driven by the
 * `heatVariant` recipe switch in apps/lab/src/twizzler.ts (twizzlerHeatRecipe):
 *   A = heatVariant 0 — fewer, wider Z lobes (3 broad bands, zFrequency 0.95)
 *   B = heatVariant 1 — mid / lock-B character (5 bands, historical Z density)
 *   C = heatVariant 2 — denser Z spots (9 tight bands, zFrequency 5.2)
 * (heatVariant 3–5 are the refined A2/B2/C2 recipes; see
 * scripts/capture-twizzler-z-heat-pass2.mjs.)
 *
 * Usage:
 *   node scripts/cf16-z-heat-abc.mjs
 *   node scripts/cf16-z-heat-abc.mjs --out /opt/cursor/artifacts/cf16-z-heat
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
  : "/opt/cursor/artifacts/cf16-z-heat";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!base?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  { id: "A", label: "fewer, wider Z lobes — 3 broad heat bands sweep the stack (heatVariant 0)", tweaks: { heatVariant: 0 } },
  { id: "B", label: "mid / lock-B character — 5 Z bands, historical density (heatVariant 1)", tweaks: { heatVariant: 1 } },
  { id: "C", label: "denser Z spots — 9 tight bands speckle heat through depth (heatVariant 2)", tweaks: { heatVariant: 2 } },
];

const bundlePath = "/tmp/twizzler-zheat-abc-bundle.js";
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
      ctx.fillText(label, 90, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `z-heat-${variant.id}.png`);
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
const stackPath = resolve(outDir, "z-heat-STACK.png");
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
writeFileSync(resolve(outDir, "z-heat-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
