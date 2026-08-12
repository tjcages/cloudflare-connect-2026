/**
 * Capture CF-16 Z-scattered amplitude heat pass-three candidates.
 *
 * Usage:
 *   pir exec node scripts/capture-twizzler-z-heat-pass3.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
const map = preset.lab?.twizzlerMap ?? preset.config?.twizzlerMap;
if (base.lineCount !== 240) throw new Error(`CF-16 Z heat capture requires 240 lines; received ${base.lineCount}`);
if (map?.flowEnabled !== false) throw new Error("CF-16 Z heat capture requires rain/flow OFF");

const variants = [
  {
    id: "A3",
    label: "one dominant broad hot lobe · two subordinate offset sheets",
    heatVariant: 6,
    structure: "nonperiodic 1+2 topology",
  },
  {
    id: "B3",
    label: "broad warm regions containing smaller intense Z islands",
    heatVariant: 7,
    structure: "two-scale asymmetric clusters",
  },
  {
    id: "C3",
    label: "Poisson-like dense hot spots · broad low-frequency envelope",
    heatVariant: 8,
    structure: "minimum-separated field",
  },
];

const bundlePath = "/tmp/twizzler-z-heat-pass3-bundle.js";
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
<canvas id="c" width="1600" height="416" style="display:block;width:1600px;height:416px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

const results = [];
for (const variant of variants) {
  const settings = { ...base, heatVariant: variant.heatVariant, speed: 0 };
  const geometry = await page.evaluate(
    ({ s, id, label, structure }) => {
      const out = document.getElementById("c");
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 320;
      // eslint-disable-next-line no-undef
      const built = TwizzlerMod.buildTwizzlerLines(1600, 320, 0, s);
      // eslint-disable-next-line no-undef
      const recipe = TwizzlerMod.twizzlerHeatRecipe(s.heatVariant);
      // eslint-disable-next-line no-undef
      const svgPath = TwizzlerMod.twizzlerSvgPathCubic(built.lines[0]?.points ?? []);
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(ribbon, 0, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 48px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 24, 66);
      ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`${label} · ${structure}`, 120, 59);
      return {
        lineCount: built.lines.length,
        cubicSvgPath: svgPath.includes(" C"),
        bandCount: recipe.bandCount,
        envelope: recipe.envelope ?? null,
      };
    },
    { s: settings, ...variant },
  );
  if (geometry.lineCount !== 240) throw new Error(`${variant.id} changed line count to ${geometry.lineCount}`);
  if (!geometry.cubicSvgPath) throw new Error(`${variant.id} did not produce a cubic SVG path`);
  const outPath = resolve(outDir, `twizzler-z-heat-pass3-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  results.push({ ...variant, outPath, geometry });
}

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const targetBase64 = readFileSync(targetPath).toString("base64");
const cards = [
  `<section><div class="label">TARGET — CF-16 reference</div><div class="image target"><img src="data:image/png;base64,${targetBase64}"/></div></section>`,
  ...results.map((result) => {
    const base64 = readFileSync(result.outPath).toString("base64");
    return `<section><img src="data:image/png;base64,${base64}"/></section>`;
  }),
].join("");
await page.setViewportSize({ width: 1600, height: 1800 });
await page.setContent(`<!DOCTYPE html><html><head><style>
html,body{margin:0;background:#080808}section{width:1600px;margin:0 0 12px}section>img{display:block;width:1600px}
.label{box-sizing:border-box;height:96px;padding:24px;color:#fff;background:#111;font:bold 36px ui-sans-serif,system-ui,sans-serif}
.image{height:320px;background:#fff}.target{display:flex;align-items:center}.target img{width:1600px;height:312px;object-fit:contain}
</style></head><body>${cards}</body></html>`);
const stackPath = resolve(outDir, "twizzler-z-heat-pass3-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  targetPath,
  stackPath,
  invariants: {
    lineCount: base.lineCount,
    amplitude: base.amplitude,
    wrinkleStrength: base.wrinkleStrength,
    rain: "off",
    canvasStroke: "cubic Catmull-Rom",
    svgExportable: results.every((result) => result.geometry.cubicSvgPath),
    fixedBendSpine: {
      bendPosition: base.bendPosition,
      bendAmount: base.bendAmount,
      bend2Position: base.bend2Position,
      bend2Amount: base.bend2Amount,
      bend3Position: base.bend3Position,
      bend3Amount: base.bend3Amount,
    },
  },
  variants: results,
};
writeFileSync(resolve(outDir, "twizzler-z-heat-pass3-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
