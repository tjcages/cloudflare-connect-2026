/**
 * CF-16 pixel-drift pass 6: deeper deterministic optimization across band
 * counts, quantiles, calibrated per-band alpha, cleanup, and simplification.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const traceBundlePath = "/tmp/cf-16-raster-drift-pass6-trace-bundle.js";
const twizzlerBundlePath = "/tmp/cf-16-twizzler-pass6-render-bundle.js";
const esbuildBin = resolve(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild");
const width = 1024;
const height = 204;
const cardHeight = 272;
const maximumSvgBytes = 2_500_000;

mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
const settings = {
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
};

for (const [entry, globalName, outfile] of [
  [resolve(root, "apps/lab/src/export/rasterDriftTraceToSvg.ts"), "RasterDriftTraceMod", traceBundlePath],
  [resolve(root, "apps/lab/src/twizzler.ts"), "TwizzlerMod", twizzlerBundlePath],
]) {
  execFileSync(
    esbuildBin,
    [
      entry,
      "--bundle",
      "--format=iife",
      `--global-name=${globalName}`,
      "--platform=browser",
      "--target=es2022",
      `--outfile=${outfile}`,
    ],
    { stdio: "inherit" },
  );
}

const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
const targetData = dataUrl(targetPath);
const browser = await chromium.launch({ headless: true });
const generationPage = await browser.newPage({ viewport: { width, height: cardHeight } });
await generationPage.setContent(`<!doctype html><html><body>
<script>${readFileSync(twizzlerBundlePath, "utf8")}</script>
<script>${readFileSync(traceBundlePath, "utf8")}</script>
</body></html>`);

const generated = await generationPage.evaluate(
  async ({ targetSource, candidateSettings, renderWidth, renderHeight, svgByteLimit }) => {
    const load = async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return image;
    };
    const makeCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = renderWidth;
      canvas.height = renderHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas2D is required for pass-6 search metrics.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, renderWidth, renderHeight);
      return { canvas, context };
    };
    const targetImage = await load(targetSource);
    const target = makeCanvas();
    target.context.drawImage(targetImage, 0, 0, renderWidth, renderHeight);
    const candidate = makeCanvas();
    const ribbon = document.createElement("canvas");
    ribbon.width = renderWidth;
    ribbon.height = renderHeight;
    // eslint-disable-next-line no-undef
    TwizzlerMod.renderTwizzler(ribbon, renderWidth, renderHeight, 0, candidateSettings);
    candidate.context.drawImage(ribbon, 0, 0);

    const targetPixels = target.context.getImageData(0, 0, renderWidth, renderHeight).data;
    const candidatePixels = candidate.context.getImageData(0, 0, renderWidth, renderHeight).data;
    const difference = makeCanvas();
    const differencePixels = difference.context.createImageData(renderWidth, renderHeight);
    const intensity = new Uint8Array(renderWidth * renderHeight);
    for (let pixel = 0; pixel < intensity.length; pixel += 1) {
      const index = pixel * 4;
      const red = Math.abs(targetPixels[index] - candidatePixels[index]);
      const green = Math.abs(targetPixels[index + 1] - candidatePixels[index + 1]);
      const blue = Math.abs(targetPixels[index + 2] - candidatePixels[index + 2]);
      const heat = Math.min(255, ((red + green + blue) / 3) * 4);
      intensity[pixel] = Math.round(heat);
      differencePixels.data[index] = 255;
      differencePixels.data[index + 1] = 255 - heat;
      differencePixels.data[index + 2] = 255 - heat;
      differencePixels.data[index + 3] = 255;
    }
    difference.context.putImageData(differencePixels, 0, 0);
    const field = { width: renderWidth, height: renderHeight, intensity };

    const rasterizeSvg = async (svg) => {
      const source = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      try {
        const image = await load(source);
        const canvas = makeCanvas();
        canvas.context.drawImage(image, 0, 0, renderWidth, renderHeight);
        return canvas.context.getImageData(0, 0, renderWidth, renderHeight).data;
      } finally {
        URL.revokeObjectURL(source);
      }
    };
    const compare = (sourcePixels, vectorPixels) => {
      let absoluteDifference = 0;
      let intersection = 0;
      let union = 0;
      let sourceInkPixels = 0;
      let vectorInkPixels = 0;
      for (let index = 0; index < sourcePixels.length; index += 4) {
        absoluteDifference +=
          (Math.abs(sourcePixels[index] - vectorPixels[index]) +
            Math.abs(sourcePixels[index + 1] - vectorPixels[index + 1]) +
            Math.abs(sourcePixels[index + 2] - vectorPixels[index + 2])) /
          3;
        const sourceInk = 255 - Math.min(sourcePixels[index], sourcePixels[index + 1], sourcePixels[index + 2]);
        const vectorInk = 255 - Math.min(vectorPixels[index], vectorPixels[index + 1], vectorPixels[index + 2]);
        const sourceActive = sourceInk > 12;
        const vectorActive = vectorInk > 12;
        if (sourceActive) sourceInkPixels += 1;
        if (vectorActive) vectorInkPixels += 1;
        if (sourceActive || vectorActive) union += 1;
        if (sourceActive && vectorActive) intersection += 1;
      }
      const pixelCount = renderWidth * renderHeight;
      return {
        rgbMae: Number((absoluteDifference / pixelCount).toFixed(3)),
        inkIou: Number((intersection / Math.max(1, union)).toFixed(5)),
        sourceCoverage: Number((sourceInkPixels / pixelCount).toFixed(5)),
        vectorCoverage: Number((vectorInkPixels / pixelCount).toFixed(5)),
      };
    };
    const evaluateParameters = async (id, parameters) => {
      // eslint-disable-next-line no-undef
      const svg = RasterDriftTraceMod.rasterDriftFidelityToSvg(field, id, parameters);
      const bytes = new Blob([svg]).size;
      const paths = svg.match(/<path\b/g)?.length ?? 0;
      return {
        id,
        parameters,
        bytes,
        paths,
        ...compare(differencePixels.data, await rasterizeSvg(svg)),
      };
    };

    // C5 is the pass-5 RGB baseline; hard thresholds also exceed A5/B5 IoU.
    // eslint-disable-next-line no-undef
    const base = RasterDriftTraceMod.A3_FIDELITY_PARAMETERS;
    const pass5Parameters = {
      ...base,
      quantiles: [...base.quantiles],
      opacityScale: 1,
      opacityGamma: 1.035,
      minimumComponentCellsLow: 1,
      minimumComponentCellsHigh: 2,
      minimumAreaLow: 1,
      minimumAreaHigh: 2,
      simplifyToleranceLow: 0.44,
      simplifyToleranceHigh: 0.36,
      morphologyRadius: 0,
    };
    const baseline = await evaluateParameters("C5-baseline", pass5Parameters);
    const hardTargets = { rgbMae: 8.422, inkIou: 0.83356 };
    const quantileLayouts = [
      [0.04, 0.14, 0.27, 0.42, 0.58, 0.73, 0.88],
      [0.03, 0.11, 0.21, 0.33, 0.47, 0.62, 0.77, 0.91],
      [0.025, 0.09, 0.17, 0.27, 0.39, 0.52, 0.66, 0.8, 0.93],
      [0.02, 0.07, 0.14, 0.22, 0.32, 0.44, 0.57, 0.7, 0.83, 0.94],
      [0.015, 0.05, 0.1, 0.16, 0.23, 0.31, 0.4, 0.5, 0.61, 0.73, 0.85, 0.95],
    ];
    const opacityProfiles = [
      { opacityScale: 0.98, opacityGamma: 1, calibration: "neutral" },
      { opacityScale: 1, opacityGamma: 1.02, calibration: "mid-lift" },
      { opacityScale: 1.02, opacityGamma: 0.98, calibration: "pale-lift" },
      { opacityScale: 0.99, opacityGamma: 1.04, calibration: "hot-soften" },
    ];
    const calibratedScales = (count, calibration) =>
      Array.from({ length: count }, (_, index) => {
        const progress = count <= 1 ? 0 : index / (count - 1);
        if (calibration === "mid-lift") return Number((1 + Math.sin(progress * Math.PI) * 0.04).toFixed(3));
        if (calibration === "pale-lift") return Number((1.07 - progress * 0.07).toFixed(3));
        if (calibration === "hot-soften") return Number((1.03 - progress * 0.08).toFixed(3));
        return 1;
      });
    const thresholdGaps = [2, 4];
    const cleanups = [
      {
        minimumComponentCellsLow: 1,
        minimumComponentCellsHigh: 2,
        minimumAreaLow: 1,
        minimumAreaHigh: 2,
      },
      {
        minimumComponentCellsLow: 1,
        minimumComponentCellsHigh: 1,
        minimumAreaLow: 1,
        minimumAreaHigh: 1,
      },
    ];
    const tolerances = [
      { simplifyToleranceLow: 0.26, simplifyToleranceHigh: 0.22 },
      { simplifyToleranceLow: 0.18, simplifyToleranceHigh: 0.16 },
    ];
    const coarseParameters = [];
    for (const quantiles of quantileLayouts) {
      for (const opacity of opacityProfiles) {
        for (const minimumThresholdGap of thresholdGaps) {
          for (const cleanup of cleanups) {
            for (const tolerance of tolerances) {
              coarseParameters.push({
                ...base,
                ...cleanup,
                ...tolerance,
                quantiles,
                minimumThresholdGap,
                opacityScale: opacity.opacityScale,
                opacityGamma: opacity.opacityGamma,
                bandOpacityScales: calibratedScales(quantiles.length, opacity.calibration),
                red: "#ff0000",
                morphologyRadius: 0,
              });
            }
          }
        }
      }
    }
    const coarseScores = [];
    for (let index = 0; index < coarseParameters.length; index += 1) {
      coarseScores.push(await evaluateParameters(`coarse6-${String(index).padStart(3, "0")}`, coarseParameters[index]));
    }
    const boundedCoarse = coarseScores.filter((candidate) => candidate.bytes <= svgByteLimit);
    // eslint-disable-next-line no-undef
    const coarseLeaders = RasterDriftTraceMod.selectRasterDriftPass6Candidates(boundedCoarse, hardTargets);
    const refinementParameters = [];
    const seen = new Set(coarseParameters.map((parameters) => JSON.stringify(parameters)));
    const addRefinement = (parameters) => {
      const key = JSON.stringify(parameters);
      if (seen.has(key)) return;
      seen.add(key);
      refinementParameters.push(parameters);
    };
    for (const leader of coarseLeaders) {
      for (const scaleOffset of [-0.02, 0, 0.02]) {
        for (const gammaOffset of [-0.03, 0, 0.03]) {
          addRefinement({
            ...leader.parameters,
            quantiles: [...leader.parameters.quantiles],
            bandOpacityScales: [...(leader.parameters.bandOpacityScales ?? [])],
            opacityScale: Number((leader.parameters.opacityScale + scaleOffset).toFixed(3)),
            opacityGamma: Number((leader.parameters.opacityGamma + gammaOffset).toFixed(3)),
          });
        }
      }
      for (const quantileOffset of [-0.008, 0.008]) {
        addRefinement({
          ...leader.parameters,
          quantiles: leader.parameters.quantiles.map((value) =>
            Number(Math.max(0.008, Math.min(0.98, value + quantileOffset)).toFixed(3)),
          ),
          bandOpacityScales: [...(leader.parameters.bandOpacityScales ?? [])],
        });
      }
      for (const toleranceOffset of [-0.03, 0.03]) {
        addRefinement({
          ...leader.parameters,
          quantiles: [...leader.parameters.quantiles],
          bandOpacityScales: [...(leader.parameters.bandOpacityScales ?? [])],
          simplifyToleranceLow: Number(
            Math.max(0.14, leader.parameters.simplifyToleranceLow + toleranceOffset).toFixed(3),
          ),
          simplifyToleranceHigh: Number(
            Math.max(0.12, leader.parameters.simplifyToleranceHigh + toleranceOffset).toFixed(3),
          ),
        });
      }
      for (const calibrationOffset of [-0.02, 0.02]) {
        addRefinement({
          ...leader.parameters,
          quantiles: [...leader.parameters.quantiles],
          bandOpacityScales: (leader.parameters.bandOpacityScales ?? []).map((value) =>
            Number(Math.max(0.88, Math.min(1.12, value + calibrationOffset)).toFixed(3)),
          ),
        });
      }
    }
    const refinementScores = [];
    for (let index = 0; index < refinementParameters.length; index += 1) {
      refinementScores.push(
        await evaluateParameters(`refine6-${String(index).padStart(3, "0")}`, refinementParameters[index]),
      );
    }
    const allScores = [...coarseScores, ...refinementScores];
    const boundedScores = allScores.filter((candidate) => candidate.bytes <= svgByteLimit);
    // eslint-disable-next-line no-undef
    const selected = RasterDriftTraceMod.selectRasterDriftPass6Candidates(boundedScores, hardTargets);
    const outputs = {};
    for (const selection of selected) {
      // eslint-disable-next-line no-undef
      const svg = RasterDriftTraceMod.rasterDriftFidelityToSvg(field, selection.role, selection.parameters);
      // eslint-disable-next-line no-undef
      RasterDriftTraceMod.assertRasterDriftTraceSvg(svg);
      outputs[selection.role] = { ...selection, svg };
    }
    // eslint-disable-next-line no-undef
    const baselineSvg = RasterDriftTraceMod.rasterDriftFidelityToSvg(field, "C5", baseline.parameters);
    return {
      differenceData: difference.canvas.toDataURL("image/png"),
      baseline,
      baselineSvg,
      hardTargets,
      outputs,
      search: {
        coarseCount: coarseScores.length,
        refinementCount: refinementScores.length,
        totalCount: allScores.length,
        boundedCount: boundedScores.length,
        bandCounts: quantileLayouts.map((layout) => layout.length),
        coarseLeaders: coarseLeaders.map(({ id, role, classification, rgbMae, inkIou, bytes }) => ({
          id,
          role,
          classification,
          rgbMae,
          inkIou,
          bytes,
        })),
      },
    };
  },
  {
    targetSource: targetData,
    candidateSettings: settings,
    renderWidth: width,
    renderHeight: height,
    svgByteLimit: maximumSvgBytes,
  },
);

const outputIds = ["A6", "B6", "C6"];
const svgPaths = Object.fromEntries(outputIds.map((id) => [id, resolve(outDir, `CF-16-pixel-drift-PASS6-${id}.svg`)]));
const vectorStats = {};
for (const id of outputIds) {
  const output = generated.outputs[id];
  if (!output) continue;
  const path = svgPaths[id];
  writeFileSync(path, `${output.svg}\n`);
  const svg = readFileSync(path, "utf8");
  const bytes = statSync(path).size;
  const pathCount = svg.match(/<path\b/g)?.length ?? 0;
  if (bytes > maximumSvgBytes) throw new Error(`${path} exceeds the ${maximumSvgBytes}-byte bound.`);
  if (pathCount === 0 || /<(?:image|canvas)\b|data\s*:/i.test(svg)) {
    throw new Error(`${path} failed the vector-only SVG invariant.`);
  }
  vectorStats[id] = {
    path,
    paths: pathCount,
    bytes,
    classification: output.classification,
    sourceCandidateId: output.id,
    parameters: output.parameters,
    metrics: {
      rgbMae: output.rgbMae,
      inkIou: output.inkIou,
      vectorCoverage: output.vectorCoverage,
      versusC5: {
        rgbMaeDelta: Number((output.rgbMae - generated.baseline.rgbMae).toFixed(3)),
        inkIouDelta: Number((output.inkIou - generated.baseline.inkIou).toFixed(5)),
        vectorCoverageDelta: Number((output.vectorCoverage - generated.baseline.vectorCoverage).toFixed(5)),
      },
    },
  };
}

const previewPage = await browser.newPage({ viewport: { width, height: cardHeight } });
const cardCss = `
  html,body{margin:0;width:${width}px;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}
  header{height:68px;box-sizing:border-box;padding:13px 18px;background:#111;color:#fff;display:flex;align-items:center;gap:24px}
  strong{font-size:34px;line-height:1} span{font-size:15px;font-weight:600}
  img,svg{display:block;width:${width}px;height:${height}px}
`;
const renderRasterCard = async (id, label, source, outPath) => {
  await previewPage.setContent(
    `<!doctype html><html><head><style>${cardCss}</style></head><body><header><strong>${id}</strong><span>${label}</span></header><img src="${source}"></body></html>`,
  );
  await previewPage.screenshot({ path: outPath, type: "png", fullPage: true });
};
const renderVectorCard = async (id, label, svg, outPath) => {
  await previewPage.setContent(
    `<!doctype html><html><head><style>${cardCss}</style></head><body><header><strong>${id}</strong><span>${label}</span></header>${svg}</body></html>`,
  );
  await previewPage.screenshot({ path: outPath, type: "png", fullPage: true });
};

const targetPreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS6-TARGET.png");
const rasterDeltaPath = resolve(outDir, "CF-16-pixel-drift-PASS6-RASTER-DELTA.png");
const baselinePreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS6-C5-BASELINE.png");
await renderRasterCard("TARGET", "TARGET-twizzler.png · pass-6 evidence basis", targetData, targetPreviewPath);
await renderRasterCard(
  "Δ",
  "original raster pixel-error optimization target",
  generated.differenceData,
  rasterDeltaPath,
);
await renderVectorCard(
  "C5",
  `pass-5 RGB baseline · RGB ${generated.baseline.rgbMae} · IoU ${generated.baseline.inkIou} · coverage ${generated.baseline.vectorCoverage}`,
  generated.baselineSvg,
  baselinePreviewPath,
);

const previewPaths = Object.fromEntries(
  outputIds.map((id) => [id, resolve(outDir, `CF-16-pixel-drift-PASS6-${id}.png`)]),
);
const roleLabels = {
  A6: "best RGB satisfying IoU floor",
  B6: "best IoU satisfying RGB ceiling",
  C6: "best balanced joint candidate",
};
for (const id of outputIds) {
  const output = generated.outputs[id];
  if (!output) continue;
  const status = output.classification === "improvement" ? "HARD-TARGET IMPROVEMENT" : "PARETO/DIAGNOSTIC";
  await renderVectorCard(
    id,
    `${status} · ${roleLabels[id]} · RGB ${output.rgbMae} · IoU ${output.inkIou} · ${output.parameters.quantiles.length} bands`,
    output.svg,
    previewPaths[id],
  );
}

const stackPath = resolve(outDir, "CF-16-pixel-drift-PASS6-COMPARISON-STACK.png");
const stackCards = [
  targetPreviewPath,
  rasterDeltaPath,
  baselinePreviewPath,
  ...outputIds.map((id) => previewPaths[id]).filter((path) => path),
]
  .map((path) => `<img src="${dataUrl(path)}">`)
  .join("");
await previewPage.setViewportSize({ width, height: 1680 });
await previewPage.setContent(
  `<!doctype html><html><head><style>html,body{margin:0;background:#111}img{display:block;width:${width}px;height:${cardHeight}px;margin:0 0 8px}</style></head><body>${stackCards}</body></html>`,
);
await previewPage.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
for (const path of [traceBundlePath, twizzlerBundlePath]) rmSync(path, { force: true });

const manifest = {
  issue: "CF-16",
  pass: 6,
  rain: false,
  dimensions: { width, height },
  source: "TARGET-vs-generated-A4 raster pixel drift",
  target: targetPreviewPath,
  originalRasterDelta: rasterDeltaPath,
  baseline: {
    strategy: "C5",
    preview: baselinePreviewPath,
    svg: "/opt/cursor/artifacts/CF-16-pixel-drift-PASS5-C5.svg",
    metrics: generated.baseline,
  },
  hardTargets: generated.hardTargets,
  search: generated.search,
  previews: previewPaths,
  stack: stackPath,
  svgs: vectorStats,
  metricMethod: {
    rgbMae: "Mean absolute RGB-channel error at 1024x204; lower is closer.",
    inkIou: "IoU of source/vector non-white masks using ink > 12; higher is closer.",
    coverage: "Fraction of pixels above the same ink threshold.",
  },
  selectionRule:
    "Improvement requires RGB MAE < 8.422 and ink IoU > 0.83356. Non-qualifying role outputs are explicitly Pareto/diagnostic.",
  maximumSvgBytes,
  winner: null,
};
const manifestPath = resolve(outDir, "CF-16-pixel-drift-PASS6-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
