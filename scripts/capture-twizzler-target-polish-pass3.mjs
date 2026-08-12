/**
 * CF-16 TARGET-polish pass 3.
 *
 * Preserves pass-2 artifacts, emits labeled A3/B3/C3 candidates, per-candidate
 * TARGET comparisons with a deterministic pixel-difference heatmap, and a
 * pass-3 stack under /opt/cursor/artifacts.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const bundlePath = "/tmp/twizzler-target-polish-pass3-bundle.js";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (lockB.lineCount !== 240) throw new Error(`Expected locked B at 240 lines, got ${lockB.lineCount}`);

const variants = [
  {
    id: "A3",
    label: "silhouette-first · calm opening → low pinch → lifted terminal",
    settings: {
      ...lockB,
      targetPolish: 1,
      centerY: 0.52,
      scale: 0.94,
      amplitude: 0.9,
      wrinkleStrength: 0.15,
      lineCount: 240,
      lineWidth: 0.56,
      depthSpread: 1.32,
      depthLift: 0.88,
      bendAmount: -0.06,
      bend2Amount: 0.08,
      bend3Amount: -0.06,
      opacity: 0.7,
      colorFar: "#ffd8a0",
      colorNear: "#f46f42",
      colorEdge: "#ffb23e",
    },
  },
  {
    id: "B3",
    label: "depth/fog-first · 296 hairlines · layered Z warmth",
    settings: {
      ...lockB,
      targetPolish: 2,
      centerY: 0.53,
      scale: 0.96,
      amplitude: 1,
      wrinkleStrength: 0.18,
      lineCount: 296,
      lineWidth: 0.45,
      depthSpread: 1.45,
      depthLift: 0.92,
      bendAmount: -0.08,
      bend2Amount: 0.1,
      bend3Amount: -0.08,
      opacity: 0.7,
      colorFar: "#ffd397",
      colorNear: "#f26839",
      colorEdge: "#ffac37",
    },
  },
  {
    id: "C3",
    label: "right-edge-first · asymmetric hills · terminal heat",
    settings: {
      ...lockB,
      targetPolish: 3,
      centerY: 0.52,
      scale: 0.92,
      amplitude: 1,
      wrinkleStrength: 0.18,
      lineCount: 240,
      lineWidth: 0.5,
      depthSpread: 1.26,
      depthLift: 1,
      bendAmount: -0.14,
      bend2Amount: 0.16,
      bend3Amount: -0.14,
      opacity: 0.74,
      colorFar: "#ffdcaa",
      colorNear: "#ef582f",
      colorEdge: "#ffad32",
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

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
const targetData = dataUrl(targetPath);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1024, height: 272 } });
await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">
<canvas id="capture" width="1024" height="272" style="display:block"></canvas>
<script>${readFileSync(bundlePath, "utf8")}</script></body></html>`);

async function analyzePair(targetSource, candidateSource, candidateYOffset = 0) {
  return page.evaluate(
    async ({ targetImageSource, candidateImageSource, yOffset }) => {
      const load = async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        return image;
      };
      const [targetImage, candidateImage] = await Promise.all([load(targetImageSource), load(candidateImageSource)]);
      const makeCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 204;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        return { canvas, context };
      };
      const target = makeCanvas();
      target.context.drawImage(targetImage, 0, 0, 1024, 204);
      const candidate = makeCanvas();
      candidate.context.drawImage(candidateImage, 0, -yOffset, 1024, candidateImage.height);
      const targetPixels = target.context.getImageData(0, 0, 1024, 204).data;
      const candidatePixels = candidate.context.getImageData(0, 0, 1024, 204).data;
      const difference = makeCanvas();
      const differencePixels = difference.context.createImageData(1024, 204);
      let absoluteDifference = 0;
      let inkDifference = 0;
      let inkPixelCount = 0;
      let intersection = 0;
      let union = 0;
      for (let index = 0; index < targetPixels.length; index += 4) {
        const red = Math.abs(targetPixels[index] - candidatePixels[index]);
        const green = Math.abs(targetPixels[index + 1] - candidatePixels[index + 1]);
        const blue = Math.abs(targetPixels[index + 2] - candidatePixels[index + 2]);
        const differenceAmount = (red + green + blue) / 3;
        absoluteDifference += differenceAmount;
        const targetInk = 255 - Math.min(targetPixels[index], targetPixels[index + 1], targetPixels[index + 2]);
        const candidateInk =
          255 - Math.min(candidatePixels[index], candidatePixels[index + 1], candidatePixels[index + 2]);
        const targetActive = targetInk > 12;
        const candidateActive = candidateInk > 12;
        if (targetActive || candidateActive) {
          inkDifference += differenceAmount;
          inkPixelCount += 1;
          union += 1;
          if (targetActive && candidateActive) intersection += 1;
        }
        const heat = Math.min(255, differenceAmount * 4);
        differencePixels.data[index] = 255;
        differencePixels.data[index + 1] = 255 - heat;
        differencePixels.data[index + 2] = 255 - heat;
        differencePixels.data[index + 3] = 255;
      }
      difference.context.putImageData(differencePixels, 0, 0);
      const pixelCount = 1024 * 204;
      return {
        metrics: {
          rgbMae: Number((absoluteDifference / pixelCount).toFixed(2)),
          inkMae: Number((inkDifference / Math.max(1, inkPixelCount)).toFixed(2)),
          inkIou: Number((intersection / Math.max(1, union)).toFixed(4)),
        },
        differenceData: difference.canvas.toDataURL("image/png"),
      };
    },
    {
      targetImageSource: targetSource,
      candidateImageSource: candidateSource,
      yOffset: candidateYOffset,
    },
  );
}

async function renderCandidate(settings) {
  return page.evaluate((candidateSettings) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 204;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const ribbon = document.createElement("canvas");
    ribbon.width = 1024;
    ribbon.height = 204;
    // eslint-disable-next-line no-undef
    TwizzlerMod.renderTwizzler(ribbon, 1024, 204, 0, candidateSettings);
    context.drawImage(ribbon, 0, 0);
    return canvas.toDataURL("image/png");
  }, settings);
}

async function drawLabeled({ id, label, source }) {
  await page.evaluate(
    async ({ candidateId, candidateLabel, imageSource }) => {
      const image = new Image();
      image.src = imageSource;
      await image.decode();
      const out = document.getElementById("capture");
      const context = out.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, out.width, out.height);
      context.fillStyle = "#111111";
      context.fillRect(0, 0, out.width, 68);
      context.fillStyle = "#ffffff";
      context.font = "700 34px ui-sans-serif, system-ui, sans-serif";
      context.fillText(candidateId, 18, 45);
      context.font = "600 17px ui-sans-serif, system-ui, sans-serif";
      context.fillText(candidateLabel, candidateId === "TARGET" ? 170 : 104, 42);
      context.drawImage(image, 0, 68, 1024, 204);
    },
    { candidateId: id, candidateLabel: label, imageSource: source },
  );
}

async function screenshotCards(paths, outPath) {
  const cards = paths
    .map((path) => `<img src="${dataUrl(path)}" style="display:block;width:1024px;margin:0 0 8px">`)
    .join("");
  await page.setViewportSize({ width: 1024, height: Math.min(4000, paths.length * 280) });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#111">${cards}</body></html>`);
  await page.screenshot({ path: outPath, type: "png", fullPage: true });
}

const pass2Metrics = {};
for (const id of ["A", "B", "C"]) {
  const priorPath = resolve(outDir, `CF-16-target-polish-${id}.png`);
  if (existsSync(priorPath)) {
    pass2Metrics[id] = (await analyzePair(targetData, dataUrl(priorPath), 68)).metrics;
  }
}

const targetStill = resolve(outDir, "CF-16-target-polish-PASS3-TARGET.png");
await drawLabeled({ id: "TARGET", label: "TARGET-twizzler.png · pass 3 reference", source: targetData });
await page.locator("#capture").screenshot({ path: targetStill, type: "png" });

const captures = [];
for (const variant of variants) {
  const candidateData = await renderCandidate(variant.settings);
  const analysis = await analyzePair(targetData, candidateData);
  const candidatePath = resolve(outDir, `CF-16-target-polish-PASS3-${variant.id}.png`);
  await drawLabeled({ id: variant.id, label: variant.label, source: candidateData });
  await page.locator("#capture").screenshot({ path: candidatePath, type: "png" });

  const diffPath = resolve(outDir, `CF-16-target-polish-PASS3-${variant.id}-DIFF.png`);
  const metricLabel = `pixel diff · RGB MAE ${analysis.metrics.rgbMae} · ink MAE ${analysis.metrics.inkMae} · ink IoU ${analysis.metrics.inkIou}`;
  await drawLabeled({ id: `Δ${variant.id}`, label: metricLabel, source: analysis.differenceData });
  await page.locator("#capture").screenshot({ path: diffPath, type: "png" });
  captures.push({ ...variant, candidatePath, diffPath, metrics: analysis.metrics });
}

const stackPath = resolve(outDir, "CF-16-target-polish-PASS3-STACK.png");
await screenshotCards([targetStill, ...captures.map(({ candidatePath }) => candidatePath)], stackPath);

const aggregateComparisonPath = resolve(outDir, "CF-16-TARGET-vs-OURS-PASS3.png");
await screenshotCards(
  [targetStill, ...captures.flatMap(({ candidatePath, diffPath }) => [candidatePath, diffPath])],
  aggregateComparisonPath,
);

const comparisonPaths = {};
for (const capture of captures) {
  const comparisonPath = resolve(outDir, `CF-16-TARGET-vs-${capture.id}.png`);
  await screenshotCards([targetStill, capture.candidatePath, capture.diffPath], comparisonPath);
  comparisonPaths[capture.id] = comparisonPath;
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  // Ignore cleanup failures after captures are safely written.
}

const manifest = {
  pass: 3,
  target: targetStill,
  aggregateComparison: aggregateComparisonPath,
  comparisons: comparisonPaths,
  stack: stackPath,
  metricMethod: {
    dimensions: "1024x204",
    rgbMae: "mean absolute RGB channel difference across all pixels; lower is closer",
    inkMae: "mean RGB difference where TARGET or candidate has non-white ink; lower is closer",
    inkIou: "intersection-over-union of non-white ink masks; higher is closer",
  },
  pass2Metrics,
  locked: {
    baselineLineCount: lockB.lineCount,
    lineCountRange: [240, 296],
    cubicPaths: true,
    rain: false,
  },
  variants: captures.map(({ id, label, candidatePath, diffPath, metrics, settings }) => ({
    id,
    label,
    candidatePath,
    diffPath,
    metrics,
    versusPass2: pass2Metrics[id[0]]
      ? {
          inkMaeDelta: Number((metrics.inkMae - pass2Metrics[id[0]].inkMae).toFixed(2)),
          inkIouDelta: Number((metrics.inkIou - pass2Metrics[id[0]].inkIou).toFixed(4)),
        }
      : null,
    settings: {
      targetPolish: settings.targetPolish,
      amplitude: settings.amplitude,
      wrinkleStrength: settings.wrinkleStrength,
      lineCount: settings.lineCount,
      lineWidth: settings.lineWidth,
      depthSpread: settings.depthSpread,
      depthLift: settings.depthLift,
      bendAmount: settings.bendAmount,
      bend2Amount: settings.bend2Amount,
      bend3Amount: settings.bend3Amount,
      colorFar: settings.colorFar,
      colorNear: settings.colorNear,
    },
  })),
};
const manifestPath = resolve(outDir, "CF-16-target-polish-PASS3-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
