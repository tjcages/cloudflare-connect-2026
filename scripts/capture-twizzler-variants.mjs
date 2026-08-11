/**
 * Capture B-silhouette Twizzler with escalating vertical fiber spacing.
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

/** B silhouette DNA (rolling terrain) — spacing varies per variant. */
const bBase = {
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
  depthTerrain: 0,
  amplitude: 0.85,
  wrinkles: 2.2,
  wrinkleStrength: 0.025,
  twist: 1.35,
  scale: 1.05,
  depthLift: 0.75,
  depthAmount: 0.9,
  bendPosition: 0.25,
  bendAmount: -0.1,
  bend2Position: 0.5,
  bend2Amount: 0.12,
  bend3Position: 0.8,
  bend3Amount: -0.1,
  leftHeight: 0.6,
  rightHeight: 0.36,
  centerY: 0.55,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  {
    id: "A",
    label: "A — B shape + medium vertical open",
    tweaks: {
      depthSpread: 1.35,
      lineCount: 36,
      lineWidth: 2.1,
      scale: 1.0,
    },
  },
  {
    id: "B",
    label: "B — B shape + WAY more vertical spacing (lock)",
    tweaks: {
      depthSpread: 2.35,
      lineCount: 32,
      lineWidth: 2.2,
      scale: 1.05,
      depthLift: 0.9,
    },
  },
  {
    id: "C",
    label: "C — B shape + extreme full-height fan",
    tweaks: {
      depthSpread: 2.5,
      lineCount: 28,
      lineWidth: 2.4,
      scale: 1.1,
      depthLift: 1.0,
      amplitude: 0.9,
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
  const settings = { ...bBase, ...variant.tweaks, speed: 0 };
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
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 28, 70);
      ctx.font = "600 26px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 120, 62);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-r3-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}.png`));
  copyFileSync(outPath, resolve(outDir, `twizzler-variant-${variant.id}-labeled.png`));
  paths.push({ ...variant, outPath, tweaks: { ...bBase, ...variant.tweaks } });
}

await page.setViewportSize({ width: 1600, height: 1300 });
const stackHtml = paths
  .map((p) => {
    const b64 = readFileSync(p.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px;background:#fff"/>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0b0b0b">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "twizzler-r3-ABC-stack.png");
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
    paths.map(({ id, label, outPath, tweaks }) => ({
      id,
      label,
      outPath,
      tweaks: {
        depthSpread: tweaks.depthSpread,
        lineCount: tweaks.lineCount,
        lineWidth: tweaks.lineWidth,
        depthTerrain: tweaks.depthTerrain,
      },
    })),
    null,
    2,
  ),
);
console.log(JSON.stringify({ variants: paths.map((p) => ({ id: p.id, label: p.label, outPath: p.outPath })), stackPath }, null, 2));
