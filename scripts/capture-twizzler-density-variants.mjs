/**
 * Capture the CF-16 pack-density/fog A/B/C study.
 *
 * Usage: pir exec node scripts/capture-twizzler-density-variants.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
const presetPath = resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json");
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const bundlePath = "/tmp/twizzler-density-bundle.js";

mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(presetPath, "utf8"));
const lockedB = { ...preset.lab.twizzler, speed: 0 };
const variants = [
  {
    id: "A",
    label: "airier counterpoint · fewer, thicker · clearer far field",
    settings: { ...lockedB, lineCount: 128, lineWidth: 0.9, depthSpread: 0.9 },
  },
  {
    id: "B",
    label: "D2 signal · 240 hairlines · lock-B depth",
    settings: { ...lockedB, lineCount: 240, lineWidth: 0.45, depthSpread: 1.18 },
  },
  {
    id: "C",
    label: "D3 + P3 signals · 320 hairlines · wider depth",
    settings: { ...lockedB, lineCount: 320, lineWidth: 0.5, depthSpread: 1.45 },
  },
];

execFileSync(
  resolve(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild"),
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
await page.setContent(`<!doctype html>
<html>
  <body style="margin:0;background:#fff">
    <canvas id="capture" width="1600" height="416" style="display:block"></canvas>
    <script>${code}</script>
  </body>
</html>`);

const results = [];
for (const variant of variants) {
  await page.evaluate(({ id, label, settings }) => {
    const output = document.getElementById("capture");
    const context = output.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, output.width, output.height);

    const ribbon = document.createElement("canvas");
    ribbon.width = 1600;
    ribbon.height = 320;
    // eslint-disable-next-line no-undef
    TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, settings);

    context.fillStyle = "#111111";
    context.fillRect(0, 0, output.width, 96);
    context.drawImage(ribbon, 0, 96);
    context.fillStyle = "#ffffff";
    context.font = "700 48px ui-sans-serif, system-ui, sans-serif";
    context.fillText(id, 24, 66);
    context.font = "600 23px ui-sans-serif, system-ui, sans-serif";
    context.fillText(label, 112, 48);
    context.font = "500 17px ui-monospace, monospace";
    context.fillText(
      `${settings.lineCount} lines  /  ${settings.lineWidth}px base  /  depth spread ${settings.depthSpread}`,
      112,
      75,
    );
  }, variant);

  const outPath = resolve(outDir, `twizzler-pack-density-${variant.id}-labeled.png`);
  await page.locator("#capture").screenshot({ path: outPath, type: "png" });
  results.push({ id: variant.id, label: variant.label, outPath, settings: variant.settings });
}

const panelHtml = results
  .map(({ outPath }) => {
    const image = readFileSync(outPath).toString("base64");
    return `<img src="data:image/png;base64,${image}" style="display:block;width:1600px;margin-bottom:12px">`;
  })
  .join("");
const target = readFileSync(targetPath).toString("base64");
await page.setViewportSize({ width: 1600, height: 1800 });
await page.setContent(`<!doctype html>
<html>
  <body style="margin:0;background:#0b0b0b">
    ${panelHtml}
    <div style="height:72px;padding:0 24px;color:#fff;font:700 25px/72px ui-sans-serif,system-ui">TARGET REFERENCE</div>
    <img src="data:image/png;base64,${target}" style="display:block;width:1600px;background:#fff">
  </body>
</html>`);
const stackPath = resolve(outDir, "twizzler-pack-density-ABC-stack.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  // Best-effort temporary cleanup.
}

const manifestPath = resolve(outDir, "twizzler-pack-density-ABC.json");
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      axis: "lineCount, lineWidth, depthSpread, fog/nearness",
      locked: "B Z-lobe geometry and cubic Catmull-Rom paths",
      variants: results,
      stackPath,
      targetPath,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({ variants: results.map(({ id, outPath }) => ({ id, outPath })), stackPath, manifestPath }, null, 2),
);
