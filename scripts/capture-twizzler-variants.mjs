/**
 * Capture locked B (r21 look) with 240 lines + light curve smooth only.
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
const twizzler = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!twizzler.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

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

await page.evaluate((s) => {
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
  ctx.fillText("B", 28, 70);
  ctx.font = "600 26px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`B lock restored — ${s.lineCount} lines, light smooth only`, 120, 62);
}, twizzler);

const outPath = resolve(outDir, "twizzler-r23-B.png");
await page.locator("#c").screenshot({ path: outPath, type: "png" });
copyFileSync(outPath, resolve(outDir, "twizzler-variant-B.png"));
copyFileSync(outPath, resolve(outDir, "twizzler-variant-B-labeled.png"));
await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}
writeFileSync(
  resolve(outDir, "twizzler-variants.json"),
  JSON.stringify({ id: "B", outPath, lineCount: twizzler.lineCount, wrinkles: twizzler.wrinkles }, null, 2),
);
console.log(JSON.stringify({ outPath, lineCount: twizzler.lineCount }, null, 2));
