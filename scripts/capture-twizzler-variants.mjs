/**
 * Survival-of-the-fittest Twizzler options — structurally different A/B/C.
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

const shared = {
  color: "#e8481c",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffc857",
  opacity: 0.88,
  speed: 0,
  edgeFluctuation: 0,
  edgeSpeed: 0,
  stippleSize: 0,
  twist: 1.35,
  pointSpacing: 3,
};

/** @type {Array<{ id: string; label: string; settings: Record<string, number|string> }>} */
const variants = [
  {
    id: "A",
    label: "A — rolling pack + mid-freq Y thrash",
    settings: {
      ...shared,
      depthTerrain: 0,
      lineCount: 120,
      lineWidth: 0.72,
      amplitude: 1.0,
      scale: 1.15,
      centerY: 0.38,
      depthSpread: 1.18,
      depthLift: 0.85,
      wrinkles: 3.2,
      wrinkleStrength: 0.1,
      leftHeight: 0.6,
      rightHeight: 0.36,
      bendPosition: 0.25,
      bendAmount: -0.1,
      bend2Position: 0.5,
      bend2Amount: 0.12,
      bend3Position: 0.8,
      bend3Amount: -0.1,
      depthPosition: 0.86,
      depthAmount: 0.9,
      depthWidth: 0.36,
      depth2Position: 0.42,
      depth2Amount: 0.2,
      depth2Width: 0.12,
    },
  },
  {
    id: "B",
    label: "B — jagged spine + high-freq Y chaos",
    settings: {
      ...shared,
      depthTerrain: 1,
      lineCount: 110,
      lineWidth: 0.55,
      amplitude: 1.0,
      scale: 1.45,
      centerY: 0.42,
      depthSpread: 1.75,
      depthLift: 1.0,
      wrinkles: 6.5,
      wrinkleStrength: 0.18,
      leftHeight: 0.35,
      rightHeight: 0.55,
      bendPosition: 0.18,
      bendAmount: 0.22,
      bend2Position: 0.45,
      bend2Amount: -0.28,
      bend3Position: 0.72,
      bend3Amount: 0.2,
      depthPosition: 0.7,
      depthAmount: 1.3,
      depthWidth: 0.28,
      depth2Position: 0.35,
      depth2Amount: 0.55,
      depth2Width: 0.18,
    },
  },
  {
    id: "C",
    label: "C — long sweep + huge low-freq Y hills",
    settings: {
      ...shared,
      depthTerrain: 2,
      lineCount: 140,
      lineWidth: 0.85,
      amplitude: 1.0,
      scale: 1.55,
      centerY: 0.48,
      depthSpread: 0.85,
      depthLift: 0.95,
      wrinkles: 2.0,
      wrinkleStrength: 0.14,
      leftHeight: 0.75,
      rightHeight: 0.22,
      bendPosition: 0.4,
      bendAmount: -0.25,
      bend2Position: 0.65,
      bend2Amount: 0.3,
      bend3Position: 0.88,
      bend3Amount: -0.15,
      depthPosition: 0.92,
      depthAmount: 1.1,
      depthWidth: 0.45,
      depth2Position: 0.55,
      depth2Amount: 0.15,
      depth2Width: 0.2,
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
const page = await browser.newPage({ viewport: { width: 1600, height: 416 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="416" style="display:block;width:1600px;height:416px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

const paths = [];
for (const variant of variants) {
  const settings = { ...variant.settings, speed: 0 };
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
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(ribbon, 0, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 28, 70);
      ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 120, 62);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-r13-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}.png`));
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}-labeled.png`));
  paths.push({ ...variant, outPath, settings });
}

await page.setViewportSize({ width: 1600, height: 1300 });
const stackHtml = paths
  .map((p) => {
    const b64 = readFileSync(p.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px;background:#fff"/>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0b0b0b">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "twizzler-r13-ABC-stack.png");
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
    paths.map(({ id, label, outPath, settings }) => ({
      id,
      label,
      outPath,
      structure: {
        depthTerrain: settings.depthTerrain,
        lineCount: settings.lineCount,
        scale: settings.scale,
        depthSpread: settings.depthSpread,
        wrinkleStrength: settings.wrinkleStrength,
      },
    })),
    null,
    2,
  ),
);
console.log(JSON.stringify({ variants: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })), stackPath }, null, 2));
