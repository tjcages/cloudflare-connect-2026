/**
 * Capture structurally extreme A/B/C Twizzler experiments (fresh r2 filenames).
 * Usage: node scripts/capture-twizzler-variants.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
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

const shared = {
  ...base,
  color: "#e8481c",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffc857",
  opacity: 0.9,
  speed: 0,
  edgeFluctuation: 0,
  edgeSpeed: 0,
  stippleSize: 0,
  centerY: 0.55,
};

/**
 * Structurally different recipes — different spines (depthTerrain), density, and energy.
 * A keeps C-spread + B-bump DNA; B/C are intentionally opposite extremes.
 */
/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "A — C sparse fan + B jagged bumps",
    tweaks: {
      depthTerrain: 1,
      depthSpread: 2.2,
      lineCount: 20,
      lineWidth: 3.8,
      twist: 0.7,
      scale: 1.35,
      amplitude: 1.0,
      wrinkles: 6,
      wrinkleStrength: 0.09,
      depthLift: 1.0,
      depthAmount: 1.6,
      bendPosition: 0.2,
      bendAmount: -0.35,
      bend2Position: 0.4,
      bend2Amount: 0.42,
      bend3Position: 0.68,
      bend3Amount: -0.4,
      rightHeight: 0.22,
      leftHeight: 0.55,
    },
  },
  {
    id: "B",
    label: "B — dense rolling pack, low Z fan",
    tweaks: {
      depthTerrain: 0,
      depthSpread: 0.55,
      lineCount: 64,
      lineWidth: 1.4,
      twist: 1.6,
      scale: 0.95,
      amplitude: 0.7,
      wrinkles: 2.0,
      wrinkleStrength: 0.02,
      depthLift: 0.45,
      depthAmount: 0.7,
      bendPosition: 0.25,
      bendAmount: -0.08,
      bend2Position: 0.5,
      bend2Amount: 0.1,
      bend3Position: 0.8,
      bend3Amount: -0.08,
      rightHeight: 0.4,
      leftHeight: 0.62,
    },
  },
  {
    id: "C",
    label: "C — few thick fibers, long single sweep",
    tweaks: {
      depthTerrain: 2,
      depthSpread: 2.5,
      lineCount: 10,
      lineWidth: 5.2,
      twist: 0.45,
      scale: 1.55,
      amplitude: 1.0,
      wrinkles: 1.0,
      wrinkleStrength: 0.01,
      depthLift: 1.0,
      depthAmount: 1.2,
      bendPosition: 0.35,
      bendAmount: -0.15,
      bend2Position: 0.6,
      bend2Amount: 0.2,
      bend3Position: 0.85,
      bend3Amount: -0.45,
      rightHeight: 0.5,
      leftHeight: 0.48,
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
const page = await browser.newPage({ viewport: { width: 1600, height: 420 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="420" style="display:block;width:1600px;height:420px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

const paths = [];
for (const variant of variants) {
  const settings = { ...shared, ...variant.tweaks, speed: 0 };
  await page.evaluate(
    ({ s, id, label }) => {
      const out = document.getElementById("c");
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);

      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 320;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
      ctx.drawImage(ribbon, 0, 100);

      // Bake huge letter into pixels so cache/confusion is impossible.
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 28, 70);
      ctx.font = "600 28px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 120, 62);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-r2-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  // Also refresh legacy names so old links update.
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}.png`));
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}-labeled.png`));
  paths.push({ ...variant, outPath, tweaks: variant.tweaks });
}

// Stack of fresh r2 images
await page.setViewportSize({ width: 1600, height: 1300 });
const stackHtml = paths
  .map((p) => {
    const b64 = readFileSync(p.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px;background:#fff"/>`;
  })
  .join("");
await page.setContent(
  `<!DOCTYPE html><html><body style="margin:0;background:#0b0b0b">${stackHtml}</body></html>`,
);
const stackPath = resolve(outDir, "twizzler-r2-ABC-stack.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, resolve(outDir, "twizzler-ABC-stack.png"));

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
console.log(JSON.stringify({ variants: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })), stackPath }, null, 2));
