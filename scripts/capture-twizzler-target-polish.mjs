/**
 * CF-16 TARGET-match polish farm.
 *
 * Produces three intentionally different, unselected candidates plus a
 * TARGET-vs-OURS comparison under /opt/cursor/artifacts.
 *
 * Usage: node scripts/capture-twizzler-target-polish.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const bundlePath = "/tmp/twizzler-target-polish-bundle.js";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (lockB.lineCount !== 240) throw new Error(`Expected locked B at 240 lines, got ${lockB.lineCount}`);

const variants = [
  {
    id: "A",
    label: "silhouette-led · shallow hills → low pinch → clean high exit",
    settings: {
      ...lockB,
      targetPolish: 1,
      centerY: 0.52,
      scale: 0.94,
      amplitude: 0.72,
      depthSpread: 0.96,
      lineWidth: 0.64,
      opacity: 0.7,
      colorFar: "#ffd79d",
      colorNear: "#f57347",
      colorEdge: "#ffb342",
    },
  },
  {
    id: "B",
    label: "fan-led · dense crossing node → broad diagonal coral fan",
    settings: {
      ...lockB,
      targetPolish: 2,
      centerY: 0.53,
      scale: 0.98,
      amplitude: 0.78,
      depthSpread: 1.12,
      lineWidth: 0.68,
      opacity: 0.74,
      colorFar: "#ffd08c",
      colorNear: "#f45f36",
      colorEdge: "#ffad32",
    },
  },
  {
    id: "C",
    label: "depth-led · fogged layered entry → rolling right-edge energy",
    settings: {
      ...lockB,
      targetPolish: 3,
      centerY: 0.52,
      scale: 0.9,
      amplitude: 0.7,
      depthSpread: 1.02,
      lineWidth: 0.62,
      opacity: 0.66,
      colorFar: "#ffddb0",
      colorNear: "#f77d52",
      colorEdge: "#ffbd4a",
    },
  },
];

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
const targetData = `data:image/png;base64,${readFileSync(targetPath).toString("base64")}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 272 } });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">
<canvas id="capture" width="1024" height="272" style="display:block"></canvas>
<script>${code}</script></body></html>`);

async function drawLabeled({ id, label, settings, target }) {
  await page.evaluate(
    async ({ candidateId, candidateLabel, candidateSettings, targetSource }) => {
      const out = document.getElementById("capture");
      const context = out.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, out.width, out.height);
      context.fillStyle = "#111111";
      context.fillRect(0, 0, out.width, 68);
      context.fillStyle = "#ffffff";
      context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
      context.fillText(candidateId, 18, 45);
      context.font = "600 18px ui-sans-serif, system-ui, sans-serif";
      context.fillText(candidateLabel, candidateId === "TARGET" ? 170 : 92, 42);

      if (targetSource) {
        const image = new Image();
        image.src = targetSource;
        await image.decode();
        context.drawImage(image, 0, 68, 1024, 204);
        return;
      }

      const ribbon = document.createElement("canvas");
      ribbon.width = 1024;
      ribbon.height = 204;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1024, 204, 0, candidateSettings);
      context.drawImage(ribbon, 0, 68);
    },
    {
      candidateId: id,
      candidateLabel: label,
      candidateSettings: settings ?? null,
      targetSource: target ?? null,
    },
  );
}

const targetStill = resolve(outDir, "CF-16-TARGET-labeled.png");
await drawLabeled({ id: "TARGET", label: "TARGET-twizzler.png · sole visual reference", target: targetData });
await page.locator("#capture").screenshot({ path: targetStill, type: "png" });

const captures = [];
for (const variant of variants) {
  await drawLabeled(variant);
  const outPath = resolve(outDir, `CF-16-target-polish-${variant.id}.png`);
  await page.locator("#capture").screenshot({ path: outPath, type: "png" });
  captures.push({ ...variant, outPath });
}

const cards = [targetStill, ...captures.map((capture) => capture.outPath)]
  .map((path) => {
    const data = readFileSync(path).toString("base64");
    return `<img src="data:image/png;base64,${data}" style="display:block;width:1024px;margin:0 0 8px">`;
  })
  .join("");
await page.setViewportSize({ width: 1024, height: 1080 });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#111">${cards}</body></html>`);

const stackPath = resolve(outDir, "CF-16-target-polish-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
const comparisonPath = resolve(outDir, "CF-16-TARGET-vs-OURS.png");
await page.screenshot({ path: comparisonPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  // Ignore cleanup failures after captures are safely written.
}

const manifest = {
  target: targetStill,
  comparison: comparisonPath,
  stack: stackPath,
  locked: {
    lineCount: lockB.lineCount,
    wrinkles: lockB.wrinkles,
    cubicPaths: true,
    rain: false,
  },
  variants: captures.map(({ id, label, outPath, settings }) => ({
    id,
    label,
    outPath,
    settings: {
      targetPolish: settings.targetPolish,
      centerY: settings.centerY,
      scale: settings.scale,
      depthSpread: settings.depthSpread,
      colorFar: settings.colorFar,
      colorNear: settings.colorNear,
    },
  })),
};
writeFileSync(resolve(outDir, "CF-16-target-polish-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
