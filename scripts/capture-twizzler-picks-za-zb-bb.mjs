/**
 * Capture CF-16 human picks: ZA×BB vs ZB×BB.
 *
 * ZA = Z heat A (heatVariant 0) · ZB = Z heat B (heatVariant 1)
 * BB = macro hills B (hillRhythm 1) + pack B hairlines (240 @ 0.45)
 *
 * Usage: node scripts/capture-twizzler-picks-za-zb-bb.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = {
  ...preset.lab.twizzler,
  speed: 0,
  hillRhythm: 1,
  lineCount: 240,
  lineWidth: 0.45,
  depthSpread: 1.18,
};

const variants = [
  {
    id: "ZA×BB",
    fileId: "ZA-x-BB",
    label: "ZA heat (wider lobes) × BB hills+pack",
    heatVariant: 0,
  },
  {
    id: "ZB×BB",
    fileId: "ZB-x-BB",
    label: "ZB heat (mid lobes) × BB hills+pack",
    heatVariant: 1,
  },
];

const bundlePath = "/tmp/twizzler-picks-bundle.js";
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
<canvas id="c" width="1600" height="416"></canvas><script>${code}</script></body></html>`);

const results = [];
for (const variant of variants) {
  const settings = { ...base, heatVariant: variant.heatVariant };
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
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(ribbon, 0, 96);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 42px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 20, 64);
      ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 160, 58);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `CF-16-pick-${variant.fileId}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  results.push({ ...variant, outPath, settings });
}

// Default banner still (ZA×BB)
copyFileSync(results[0].outPath, resolve(outDir, "CF-16-pick-DEFAULT-ZA-x-BB.png"));

const stackHtml = results
  .map((r) => `<img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px;margin:0 0 8px"/>`)
  .join("");
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const targetBlock = existsSync(targetPath)
  ? `<div style="color:#fff;font:600 28px sans-serif;padding:12px;background:#111">TARGET</div>
     <img src="data:image/png;base64,${readFileSync(targetPath).toString("base64")}" style="display:block;width:1600px;background:#fff"/>`
  : "";
await page.setViewportSize({ width: 1600, height: 1400 });
await page.setContent(
  `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${targetBlock}${stackHtml}</body></html>`,
);
const stackPath = resolve(outDir, "CF-16-pick-ZA-ZB-BB-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  picks: { ZA: "heatVariant 0", ZB: "heatVariant 1", BB: "hillRhythm 1 + pack B lineWidth 0.45 @ 240" },
  bannerDefault: "ZA×BB",
  stackPath,
  variants: results.map(({ id, fileId, label, outPath, heatVariant }) => ({
    id,
    fileId,
    label,
    outPath,
    heatVariant,
  })),
};
writeFileSync(resolve(outDir, "CF-16-pick-ZA-ZB-BB-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
