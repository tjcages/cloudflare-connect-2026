/**
 * Capture Twizzler canvas on white for CF-16 visual matching.
 * Usage: node scripts/capture-twizzler.mjs [outPath]
 */
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outPath = resolve(process.argv[2] ?? "/opt/cursor/artifacts/twizzler-still.png");
mkdirSync(dirname(outPath), { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const twizzler = preset.lab?.twizzler ?? preset.config?.twizzler;
if (!twizzler) throw new Error("banner-5x1.json missing lab.twizzler");

const bundlePath = resolve(root, "/tmp/twizzler-bundle.js".replace(/^\/tmp/, "/tmp"));
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
const page = await browser.newPage({ viewport: { width: 1600, height: 360 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="320" style="display:block;width:1600px;height:320px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

await page.evaluate((settings) => {
  const ribbon = document.createElement("canvas");
  ribbon.width = 1600;
  ribbon.height = 320;
  // eslint-disable-next-line no-undef
  TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, settings);
  const out = document.getElementById("c");
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(ribbon, 0, 0);
}, twizzler);

await page.locator("#c").screenshot({ path: outPath, type: "png" });
await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}
console.log(JSON.stringify({ outPath, lineCount: twizzler.lineCount }));
