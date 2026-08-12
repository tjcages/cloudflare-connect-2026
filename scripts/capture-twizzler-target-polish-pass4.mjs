/**
 * CF-16 TARGET-polish pass 4.
 *
 * Preserves prior rounds and emits A4/B4/C4, per-candidate TARGET + pixel-diff
 * comparisons, a pass-4 stack, and metrics against each pass-3 evidence basis.
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
const bundlePath = "/tmp/twizzler-target-polish-pass4-bundle.js";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (lockB.lineCount !== 240) throw new Error(`Expected locked B at 240 lines, got ${lockB.lineCount}`);

const variants = [
  {
    id: "A4",
    basis: "C3",
    label: "C3 silhouette + corrected warm/cool depth order",
    settings: {
      ...lockB,
      targetPolish: 4,
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
      opacity: 0.72,
      colorFar: "#ffe0bc",
      colorNear: "#ef5d32",
      colorEdge: "#ffb13c",
    },
  },
  {
    id: "B4",
    basis: "B3",
    label: "B3 fog/color + corrected macro occupancy",
    settings: {
      ...lockB,
      targetPolish: 5,
      centerY: 0.52,
      scale: 0.96,
      amplitude: 0.94,
      wrinkleStrength: 0.17,
      lineCount: 288,
      lineWidth: 0.45,
      depthSpread: 1.36,
      depthLift: 0.9,
      bendAmount: -0.1,
      bend2Amount: 0.13,
      bend3Amount: -0.1,
      opacity: 0.7,
      colorFar: "#ffd397",
      colorNear: "#f26839",
      colorEdge: "#ffac37",
    },
  },
  {
    id: "C4",
    basis: "C3",
    label: "C3 terminal heat + smoother marketing hills",
    settings: {
      ...lockB,
      targetPolish: 6,
      centerY: 0.52,
      scale: 0.93,
      amplitude: 0.92,
      wrinkleStrength: 0.15,
      lineCount: 240,
      lineWidth: 0.48,
      depthSpread: 1.25,
      depthLift: 0.95,
      bendAmount: -0.1,
      bend2Amount: 0.12,
      bend3Amount: -0.1,
      opacity: 0.73,
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

async function loadPair(targetSource, candidateSource, candidateYOffset = 0) {
  return page.evaluate(
    async ({ targetImageSource, candidateImageSource, yOffset }) => {
      const load = async (source) => {
        const image = new Image();
        image.src = source;
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
      const [targetImage, candidateImage] = await Promise.all([load(targetImageSource), load(candidateImageSource)]);
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

const pass3Paths = Object.fromEntries(
  ["A3", "B3", "C3"].map((id) => [id, resolve(outDir, `CF-16-target-polish-PASS3-${id}.png`)]),
);
for (const [id, path] of Object.entries(pass3Paths)) {
  if (!existsSync(path)) throw new Error(`Missing ${id} evidence at ${path}; run the pass-3 capture first.`);
}
const pass3Metrics = Object.fromEntries(
  await Promise.all(
    Object.entries(pass3Paths).map(async ([id, path]) => [id, (await loadPair(targetData, dataUrl(path), 68)).metrics]),
  ),
);

const targetStill = resolve(outDir, "CF-16-target-polish-PASS4-TARGET.png");
await drawLabeled({ id: "TARGET", label: "TARGET-twizzler.png · pass 4 reference", source: targetData });
await page.locator("#capture").screenshot({ path: targetStill, type: "png" });

const captures = [];
for (const variant of variants) {
  const candidateData = await renderCandidate(variant.settings);
  const analysis = await loadPair(targetData, candidateData);
  const candidatePath = resolve(outDir, `CF-16-target-polish-PASS4-${variant.id}.png`);
  await drawLabeled({ id: variant.id, label: variant.label, source: candidateData });
  await page.locator("#capture").screenshot({ path: candidatePath, type: "png" });
  const diffPath = resolve(outDir, `CF-16-target-polish-PASS4-${variant.id}-DIFF.png`);
  const metricLabel = `pixel diff · RGB ${analysis.metrics.rgbMae} · ink ${analysis.metrics.inkMae} · IoU ${analysis.metrics.inkIou}`;
  await drawLabeled({ id: `Δ${variant.id}`, label: metricLabel, source: analysis.differenceData });
  await page.locator("#capture").screenshot({ path: diffPath, type: "png" });
  captures.push({ ...variant, candidatePath, diffPath, metrics: analysis.metrics });
}

const stackPath = resolve(outDir, "CF-16-target-polish-PASS4-STACK.png");
await screenshotCards([targetStill, ...captures.map(({ candidatePath }) => candidatePath)], stackPath);
const aggregateComparisonPath = resolve(outDir, "CF-16-TARGET-vs-OURS-PASS4.png");
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
  pass: 4,
  pass3DimensionEvidence: {
    silhouette: { candidate: "C3", evidence: `highest pass-3 ink IoU (${pass3Metrics.C3.inkIou})` },
    colorFog: {
      candidate: "B3",
      evidence: `lowest pass-3 ink MAE (${pass3Metrics.B3.inkMae}) and layered-depth treatment`,
    },
    rightEdgeEnergy: { candidate: "C3", evidence: "terminal-first strategy with strongest pass-3 mask overlap" },
    overallWinner: null,
  },
  target: targetStill,
  aggregateComparison: aggregateComparisonPath,
  comparisons: comparisonPaths,
  stack: stackPath,
  pass3Metrics,
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
  variants: captures.map(({ id, basis, label, candidatePath, diffPath, metrics, settings }) => {
    const basisMetrics = pass3Metrics[basis];
    return {
      id,
      basis,
      label,
      candidatePath,
      diffPath,
      metrics,
      versusPass3Basis: {
        rgbMaeDelta: Number((metrics.rgbMae - basisMetrics.rgbMae).toFixed(2)),
        inkMaeDelta: Number((metrics.inkMae - basisMetrics.inkMae).toFixed(2)),
        inkIouDelta: Number((metrics.inkIou - basisMetrics.inkIou).toFixed(4)),
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
const manifestPath = resolve(outDir, "CF-16-target-polish-PASS4-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
