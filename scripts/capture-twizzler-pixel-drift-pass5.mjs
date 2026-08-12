/**
 * CF-16 pixel-drift pass 5: deterministic coarse-to-fine optimization around
 * exact A3 contour topology.
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
const traceBundlePath = "/tmp/cf-16-raster-drift-pass5-trace-bundle.js";
const twizzlerBundlePath = "/tmp/cf-16-twizzler-pass5-render-bundle.js";
const esbuildBin = resolve(root, "node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild");
const width = 1024;
const height = 204;
const cardHeight = 272;

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
if (settings.lineCount !== 240) throw new Error(`Expected 240 generated fibers, got ${settings.lineCount}`);

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
  async ({ targetSource, candidateSettings, renderWidth, renderHeight }) => {
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
      if (!context) throw new Error("Canvas2D is required for pass-5 search metrics.");
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
      return { id, parameters, ...compare(differencePixels.data, await rasterizeSvg(svg)) };
    };

    // eslint-disable-next-line no-undef
    const base = RasterDriftTraceMod.A3_FIDELITY_PARAMETERS;
    const baseline = await evaluateParameters("A3-baseline", {
      ...base,
      quantiles: [...base.quantiles],
    });
    const selectionBaseline = { rgbMae: 11.133, inkIou: 0.756 };
    const quantileSets = [[...base.quantiles], [0.045, 0.2, 0.4, 0.59, 0.76, 0.9]];
    const opacityMappings = [
      { opacityScale: 0.98, opacityGamma: 1 },
      { opacityScale: 1.02, opacityGamma: 0.97 },
      { opacityScale: 1.06, opacityGamma: 0.93 },
    ];
    const reds = ["#ff0000", "#ff0606"];
    const cleanups = [
      {
        minimumComponentCellsLow: 2,
        minimumComponentCellsHigh: 3,
        minimumAreaLow: 2,
        minimumAreaHigh: 3,
      },
      {
        minimumComponentCellsLow: 1,
        minimumComponentCellsHigh: 2,
        minimumAreaLow: 1,
        minimumAreaHigh: 2,
      },
    ];
    const tolerances = [
      { simplifyToleranceLow: 0.44, simplifyToleranceHigh: 0.36 },
      { simplifyToleranceLow: 0.3, simplifyToleranceHigh: 0.26 },
    ];
    const morphologyRadii = [0, 1];
    const coarseParameters = [];
    for (const quantiles of quantileSets) {
      for (const opacity of opacityMappings) {
        for (const red of reds) {
          for (const cleanup of cleanups) {
            for (const tolerance of tolerances) {
              for (const morphologyRadius of morphologyRadii) {
                coarseParameters.push({
                  ...base,
                  ...opacity,
                  ...cleanup,
                  ...tolerance,
                  quantiles,
                  red,
                  morphologyRadius,
                });
              }
            }
          }
        }
      }
    }
    const coarseScores = [];
    for (let index = 0; index < coarseParameters.length; index += 1) {
      coarseScores.push(await evaluateParameters(`coarse-${String(index).padStart(3, "0")}`, coarseParameters[index]));
    }

    // eslint-disable-next-line no-undef
    const coarseLeaders = RasterDriftTraceMod.selectRasterDriftFidelityCandidates(coarseScores, selectionBaseline, 4);
    const refinementParameters = [];
    const seenParameters = new Set(coarseParameters.map((parameters) => JSON.stringify(parameters)));
    const addRefinement = (parameters) => {
      const key = JSON.stringify(parameters);
      if (seenParameters.has(key)) return;
      seenParameters.add(key);
      refinementParameters.push(parameters);
    };
    for (const leader of coarseLeaders) {
      for (const opacityScaleOffset of [-0.02, 0, 0.02]) {
        for (const gammaOffset of [-0.035, 0, 0.035]) {
          addRefinement({
            ...leader.parameters,
            quantiles: [...leader.parameters.quantiles],
            opacityScale: Number((leader.parameters.opacityScale + opacityScaleOffset).toFixed(3)),
            opacityGamma: Number((leader.parameters.opacityGamma + gammaOffset).toFixed(3)),
          });
        }
      }
      for (const quantileOffset of [-0.012, 0.012]) {
        addRefinement({
          ...leader.parameters,
          quantiles: leader.parameters.quantiles.map((value) =>
            Number(Math.max(0.01, Math.min(0.98, value + quantileOffset)).toFixed(3)),
          ),
        });
      }
      for (const toleranceOffset of [-0.04, 0.04]) {
        addRefinement({
          ...leader.parameters,
          quantiles: [...leader.parameters.quantiles],
          simplifyToleranceLow: Number(
            Math.max(0.18, leader.parameters.simplifyToleranceLow + toleranceOffset).toFixed(3),
          ),
          simplifyToleranceHigh: Number(
            Math.max(0.16, leader.parameters.simplifyToleranceHigh + toleranceOffset).toFixed(3),
          ),
        });
      }
    }
    const refinementScores = [];
    for (let index = 0; index < refinementParameters.length; index += 1) {
      refinementScores.push(
        await evaluateParameters(`refine-${String(index).padStart(3, "0")}`, refinementParameters[index]),
      );
    }
    const allScores = [...coarseScores, ...refinementScores];
    // eslint-disable-next-line no-undef
    const selected = RasterDriftTraceMod.selectRasterDriftFidelityCandidates(allScores, selectionBaseline, 3);
    const outputIds = ["A5", "B5", "C5"];
    const outputs = {};
    for (let index = 0; index < outputIds.length; index += 1) {
      const outputId = outputIds[index];
      const selection = selected[index];
      if (!selection) continue;
      // eslint-disable-next-line no-undef
      const svg = RasterDriftTraceMod.rasterDriftFidelityToSvg(field, outputId, selection.parameters);
      // eslint-disable-next-line no-undef
      RasterDriftTraceMod.assertRasterDriftTraceSvg(svg);
      outputs[outputId] = { ...selection, svg };
    }
    // eslint-disable-next-line no-undef
    const baselineSvg = RasterDriftTraceMod.rasterDriftFidelityToSvg(field, "A3", baseline.parameters);
    return {
      differenceData: difference.canvas.toDataURL("image/png"),
      baseline,
      baselineSvg,
      selectionBaseline,
      outputs,
      search: {
        coarseCount: coarseScores.length,
        refinementCount: refinementScores.length,
        totalCount: allScores.length,
        coarseLeaders: coarseLeaders.map(({ id, classification, rgbMae, inkIou }) => ({
          id,
          classification,
          rgbMae,
          inkIou,
        })),
      },
    };
  },
  {
    targetSource: targetData,
    candidateSettings: settings,
    renderWidth: width,
    renderHeight: height,
  },
);

const outputIds = ["A5", "B5", "C5"];
const svgPaths = Object.fromEntries(outputIds.map((id) => [id, resolve(outDir, `CF-16-pixel-drift-PASS5-${id}.svg`)]));
const vectorStats = {};
for (const id of outputIds) {
  const output = generated.outputs[id];
  if (!output) continue;
  const path = svgPaths[id];
  writeFileSync(path, `${output.svg}\n`);
  const svg = readFileSync(path, "utf8");
  const pathCount = svg.match(/<path\b/g)?.length ?? 0;
  if (pathCount === 0 || /<(?:image|canvas)\b|data\s*:/i.test(svg)) {
    throw new Error(`${path} failed the vector-only SVG invariant.`);
  }
  vectorStats[id] = {
    path,
    paths: pathCount,
    bytes: statSync(path).size,
    classification: output.classification,
    parameters: output.parameters,
    metrics: {
      rgbMae: output.rgbMae,
      inkIou: output.inkIou,
      vectorCoverage: output.vectorCoverage,
      versusA3: {
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

const targetPreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS5-TARGET.png");
const rasterDeltaPath = resolve(outDir, "CF-16-pixel-drift-PASS5-RASTER-DELTA.png");
const baselinePreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS5-A3-BASELINE.png");
await renderRasterCard("TARGET", "TARGET-twizzler.png · pass-5 evidence basis", targetData, targetPreviewPath);
await renderRasterCard(
  "Δ",
  "original raster pixel-error optimization target",
  generated.differenceData,
  rasterDeltaPath,
);
await renderVectorCard(
  "A3",
  `baseline · RGB ${generated.baseline.rgbMae} · IoU ${generated.baseline.inkIou} · coverage ${generated.baseline.vectorCoverage}`,
  generated.baselineSvg,
  baselinePreviewPath,
);

const previewPaths = Object.fromEntries(
  outputIds.map((id) => [id, resolve(outDir, `CF-16-pixel-drift-PASS5-${id}.png`)]),
);
for (const id of outputIds) {
  const output = generated.outputs[id];
  if (!output) continue;
  const status = output.classification === "improvement" ? "JOINT IMPROVEMENT" : "DIAGNOSTIC ALTERNATIVE";
  await renderVectorCard(
    id,
    `${status} · RGB ${output.rgbMae} · IoU ${output.inkIou} · coverage ${output.vectorCoverage}`,
    output.svg,
    previewPaths[id],
  );
}

const stackPath = resolve(outDir, "CF-16-pixel-drift-PASS5-COMPARISON-STACK.png");
const stackCards = [targetPreviewPath, rasterDeltaPath, baselinePreviewPath, ...outputIds.map((id) => previewPaths[id])]
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
  pass: 5,
  rain: false,
  dimensions: { width, height },
  source: "TARGET-vs-generated-A4 raster pixel drift",
  target: targetPreviewPath,
  originalRasterDelta: rasterDeltaPath,
  baseline: {
    strategy: "A3",
    preview: baselinePreviewPath,
    svg: "/opt/cursor/artifacts/CF-16-pixel-drift-PASS3-A3-fidelity.svg",
    metrics: generated.baseline,
    acceptanceThresholds: generated.selectionBaseline,
  },
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
    "Improvement requires RGB MAE < 11.133 and ink IoU > 0.756. Remaining slots, if any, are explicitly diagnostic.",
  winner: null,
};
const manifestPath = resolve(outDir, "CF-16-pixel-drift-PASS5-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
