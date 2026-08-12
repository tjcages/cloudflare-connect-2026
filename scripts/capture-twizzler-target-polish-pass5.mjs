/**
 * CF-16 TARGET-polish pass 5.
 *
 * Uses C4 as the metric basis, preserves prior artifacts, and captures three
 * structural studies with consistent TARGET pixel-difference evidence.
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
const c4Path = resolve(outDir, "CF-16-target-polish-PASS4-C4.png");
const bundlePath = "/tmp/twizzler-target-polish-pass5-bundle.js";
mkdirSync(outDir, { recursive: true });
if (!existsSync(c4Path)) throw new Error(`Missing C4 evidence at ${c4Path}; run pass 4 capture first.`);

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (lockB.lineCount !== 240) throw new Error(`Expected locked B at 240 lines, got ${lockB.lineCount}`);

const variants = [
  {
    id: "A5",
    label: "C4 color/terminal + left micro-hills + wider diagonal fan",
    settings: {
      ...lockB,
      targetPolish: 7,
      centerY: 0.52,
      scale: 0.93,
      amplitude: 0.94,
      wrinkleStrength: 0.16,
      lineCount: 240,
      lineWidth: 0.48,
      depthSpread: 1.34,
      depthLift: 0.95,
      bendAmount: -0.06,
      bend2Amount: 0.08,
      bend3Amount: -0.06,
      opacity: 0.72,
      colorFar: "#ffdcaa",
      colorNear: "#ef582f",
      colorEdge: "#ffad32",
    },
  },
  {
    id: "B5",
    label: "fan distribution · hero-rise occupancy → tapered ripples",
    settings: {
      ...lockB,
      targetPolish: 8,
      centerY: 0.52,
      scale: 0.94,
      amplitude: 0.9,
      wrinkleStrength: 0.15,
      lineCount: 288,
      lineWidth: 0.45,
      depthSpread: 1.42,
      depthLift: 0.9,
      bendAmount: -0.08,
      bend2Amount: 0.1,
      bend3Amount: -0.08,
      opacity: 0.69,
      colorFar: "#ffd8a1",
      colorNear: "#f16538",
      colorEdge: "#ffae36",
    },
  },
  {
    id: "C5",
    label: "C4/B4 hybrid · narrow waist → warm broad fan",
    settings: {
      ...lockB,
      targetPolish: 9,
      centerY: 0.52,
      scale: 0.94,
      amplitude: 0.96,
      wrinkleStrength: 0.17,
      lineCount: 280,
      lineWidth: 0.45,
      depthSpread: 1.38,
      depthLift: 0.95,
      bendAmount: -0.1,
      bend2Amount: 0.13,
      bend3Amount: -0.1,
      opacity: 0.71,
      colorFar: "#ffdab0",
      colorNear: "#ef5b31",
      colorEdge: "#ffad34",
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

async function analyzePair(candidateSource, candidateYOffset = 0) {
  return page.evaluate(
    async ({ targetSource, candidateSource: source, yOffset }) => {
      const load = async (imageSource) => {
        const image = new Image();
        image.src = imageSource;
        await image.decode();
        return image;
      };
      const makeCanvas = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1024;
        canvas.height = 204;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 1024, 204);
        return { canvas, context };
      };
      const [targetImage, candidateImage] = await Promise.all([load(targetSource), load(source)]);
      const target = makeCanvas();
      const candidate = makeCanvas();
      target.context.drawImage(targetImage, 0, 0, 1024, 204);
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
        const amount = (red + green + blue) / 3;
        absoluteDifference += amount;
        const targetActive = 255 - Math.min(targetPixels[index], targetPixels[index + 1], targetPixels[index + 2]) > 12;
        const candidateActive =
          255 - Math.min(candidatePixels[index], candidatePixels[index + 1], candidatePixels[index + 2]) > 12;
        if (targetActive || candidateActive) {
          inkDifference += amount;
          inkPixelCount += 1;
          union += 1;
          if (targetActive && candidateActive) intersection += 1;
        }
        const heat = Math.min(255, amount * 4);
        differencePixels.data[index] = 255;
        differencePixels.data[index + 1] = 255 - heat;
        differencePixels.data[index + 2] = 255 - heat;
        differencePixels.data[index + 3] = 255;
      }
      difference.context.putImageData(differencePixels, 0, 0);
      return {
        metrics: {
          rgbMae: Number((absoluteDifference / (1024 * 204)).toFixed(2)),
          inkMae: Number((inkDifference / Math.max(1, inkPixelCount)).toFixed(2)),
          inkIou: Number((intersection / Math.max(1, union)).toFixed(4)),
        },
        differenceData: difference.canvas.toDataURL("image/png"),
      };
    },
    { targetSource: targetData, candidateSource, yOffset: candidateYOffset },
  );
}

async function renderCandidate(settings) {
  return page.evaluate((candidateSettings) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 204;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 1024, 204);
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
      context.fillRect(0, 0, 1024, 272);
      context.fillStyle = "#111111";
      context.fillRect(0, 0, 1024, 68);
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

const c4Metrics = (await analyzePair(dataUrl(c4Path), 68)).metrics;
const targetStill = resolve(outDir, "CF-16-target-polish-PASS5-TARGET.png");
await drawLabeled({ id: "TARGET", label: "TARGET-twizzler.png · pass 5 reference", source: targetData });
await page.locator("#capture").screenshot({ path: targetStill, type: "png" });

const captures = [];
for (const variant of variants) {
  const candidateData = await renderCandidate(variant.settings);
  const analysis = await analyzePair(candidateData);
  const candidatePath = resolve(outDir, `CF-16-target-polish-PASS5-${variant.id}.png`);
  await drawLabeled({ id: variant.id, label: variant.label, source: candidateData });
  await page.locator("#capture").screenshot({ path: candidatePath, type: "png" });
  const diffPath = resolve(outDir, `CF-16-target-polish-PASS5-${variant.id}-DIFF.png`);
  await drawLabeled({
    id: `Δ${variant.id}`,
    label: `pixel diff · RGB ${analysis.metrics.rgbMae} · ink ${analysis.metrics.inkMae} · IoU ${analysis.metrics.inkIou}`,
    source: analysis.differenceData,
  });
  await page.locator("#capture").screenshot({ path: diffPath, type: "png" });
  captures.push({ ...variant, candidatePath, diffPath, metrics: analysis.metrics });
}

const stackPath = resolve(outDir, "CF-16-target-polish-PASS5-STACK.png");
await screenshotCards([targetStill, ...captures.map(({ candidatePath }) => candidatePath)], stackPath);
const aggregateComparisonPath = resolve(outDir, "CF-16-TARGET-vs-OURS-PASS5.png");
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

const outcome = (metric, delta) => {
  const improved = metric === "inkIou" ? delta > 0 : delta < 0;
  if (delta === 0) return "unchanged";
  return improved ? "improved" : "regressed";
};
const manifest = {
  pass: 5,
  basis: { candidate: "C4", metrics: c4Metrics },
  target: targetStill,
  aggregateComparison: aggregateComparisonPath,
  comparisons: comparisonPaths,
  stack: stackPath,
  metricMethod: {
    dimensions: "1024x204",
    lowerIsBetter: ["rgbMae", "inkMae"],
    higherIsBetter: ["inkIou"],
  },
  locked: {
    baselineLineCount: lockB.lineCount,
    lineCountRange: [240, 288],
    cubicPaths: true,
    rain: false,
  },
  variants: captures.map(({ id, label, candidatePath, diffPath, metrics, settings }) => {
    const deltas = {
      rgbMae: Number((metrics.rgbMae - c4Metrics.rgbMae).toFixed(2)),
      inkMae: Number((metrics.inkMae - c4Metrics.inkMae).toFixed(2)),
      inkIou: Number((metrics.inkIou - c4Metrics.inkIou).toFixed(4)),
    };
    return {
      id,
      label,
      candidatePath,
      diffPath,
      metrics,
      versusC4: {
        deltas,
        outcomes: Object.fromEntries(Object.entries(deltas).map(([metric, delta]) => [metric, outcome(metric, delta)])),
      },
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
    };
  }),
};
const manifestPath = resolve(outDir, "CF-16-target-polish-PASS5-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
