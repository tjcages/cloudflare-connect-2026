/**
 * CF-16 pixel-drift pass 4: shape-based fidelity refinements with objective
 * source-size raster-to-vector metrics.
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
const traceBundlePath = "/tmp/cf-16-raster-drift-pass4-trace-bundle.js";
const twizzlerBundlePath = "/tmp/cf-16-twizzler-pass4-render-bundle.js";
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
      if (!context) throw new Error("Canvas2D is required for pass-4 evidence and metrics.");
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
    // eslint-disable-next-line no-undef
    const baselineSvg = RasterDriftTraceMod.rasterDriftTraceToSvg("A3", field);
    // eslint-disable-next-line no-undef
    const studies = RasterDriftTraceMod.rasterDriftTracePass4StudiesToSvg(field);
    const allStudies = { A3: baselineSvg, ...studies };
    for (const svg of Object.values(allStudies)) {
      // eslint-disable-next-line no-undef
      RasterDriftTraceMod.assertRasterDriftTraceSvg(svg);
    }

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
    const metrics = {};
    for (const [strategy, svg] of Object.entries(allStudies)) {
      metrics[strategy] = compare(differencePixels.data, await rasterizeSvg(svg));
    }
    return {
      differenceData: difference.canvas.toDataURL("image/png"),
      baselineSvg,
      studies,
      metrics,
    };
  },
  {
    targetSource: targetData,
    candidateSettings: settings,
    renderWidth: width,
    renderHeight: height,
  },
);

const svgPaths = {
  A4: resolve(outDir, "CF-16-pixel-drift-PASS4-A4-antialiased.svg"),
  B4: resolve(outDir, "CF-16-pixel-drift-PASS4-B4-ridge-protected.svg"),
  C4: resolve(outDir, "CF-16-pixel-drift-PASS4-C4-color-calibrated.svg"),
};
const vectorStats = {};
for (const [strategy, path] of Object.entries(svgPaths)) {
  writeFileSync(path, `${generated.studies[strategy]}\n`);
  const svg = readFileSync(path, "utf8");
  const pathCount = svg.match(/<path\b/g)?.length ?? 0;
  if (pathCount === 0 || /<(?:image|canvas)\b|data\s*:/i.test(svg)) {
    throw new Error(`${path} failed the vector-only SVG invariant.`);
  }
  vectorStats[strategy] = { path, paths: pathCount, bytes: statSync(path).size };
}

const baselineMetrics = generated.metrics.A3;
const metrics = Object.fromEntries(
  Object.entries(generated.metrics).map(([strategy, values]) => [
    strategy,
    {
      ...values,
      versusA3:
        strategy === "A3"
          ? null
          : {
              rgbMaeDelta: Number((values.rgbMae - baselineMetrics.rgbMae).toFixed(3)),
              inkIouDelta: Number((values.inkIou - baselineMetrics.inkIou).toFixed(5)),
              vectorCoverageDelta: Number((values.vectorCoverage - baselineMetrics.vectorCoverage).toFixed(5)),
            },
    },
  ]),
);

const previewPage = await browser.newPage({ viewport: { width, height: cardHeight } });
const cardCss = `
  html,body{margin:0;width:${width}px;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}
  header{height:68px;box-sizing:border-box;padding:13px 18px;background:#111;color:#fff;display:flex;align-items:center;gap:24px}
  strong{font-size:34px;line-height:1} span{font-size:16px;font-weight:600}
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
const metricLabel = (strategy, description) => {
  const value = metrics[strategy];
  const delta = value.versusA3;
  return `${description} · RGB ${value.rgbMae} · IoU ${value.inkIou}${delta ? ` · ΔRGB ${delta.rgbMaeDelta} · ΔIoU ${delta.inkIouDelta}` : " · baseline"}`;
};

const targetPreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS4-TARGET.png");
const rasterDeltaPath = resolve(outDir, "CF-16-pixel-drift-PASS4-RASTER-DELTA.png");
const baselinePreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS4-A3-BASELINE.png");
await renderRasterCard("TARGET", "TARGET-twizzler.png · pass-4 evidence basis", targetData, targetPreviewPath);
await renderRasterCard("Δ", "original raster pixel-error metric reference", generated.differenceData, rasterDeltaPath);
await renderVectorCard("A3", metricLabel("A3", "pass-3 fidelity baseline"), generated.baselineSvg, baselinePreviewPath);

const previewPaths = {
  A4: resolve(outDir, "CF-16-pixel-drift-PASS4-A4-antialiased.png"),
  B4: resolve(outDir, "CF-16-pixel-drift-PASS4-B4-ridge-protected.png"),
  C4: resolve(outDir, "CF-16-pixel-drift-PASS4-C4-color-calibrated.png"),
};
await renderVectorCard(
  "A4",
  metricLabel("A4", "anti-aliased fidelity · ten smoothed bands"),
  generated.studies.A4,
  previewPaths.A4,
);
await renderVectorCard(
  "B4",
  metricLabel("B4", "ridge-protected fidelity · explicit channel erosion"),
  generated.studies.B4,
  previewPaths.B4,
);
await renderVectorCard(
  "C4",
  metricLabel("C4", "color-calibrated fidelity · bounded uniform levels"),
  generated.studies.C4,
  previewPaths.C4,
);

const stackPath = resolve(outDir, "CF-16-pixel-drift-PASS4-COMPARISON-STACK.png");
const stackCards = [
  targetPreviewPath,
  rasterDeltaPath,
  baselinePreviewPath,
  previewPaths.A4,
  previewPaths.B4,
  previewPaths.C4,
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
  pass: 4,
  rain: false,
  dimensions: { width, height },
  source: "TARGET-vs-generated-A4 raster pixel drift",
  target: targetPreviewPath,
  originalRasterDelta: rasterDeltaPath,
  baseline: {
    strategy: "A3",
    preview: baselinePreviewPath,
    svg: "/opt/cursor/artifacts/CF-16-pixel-drift-PASS3-A3-fidelity.svg",
  },
  previews: previewPaths,
  stack: stackPath,
  svgs: vectorStats,
  metrics,
  metricMethod: {
    rgbMae: "Mean absolute RGB-channel error at 1024x204; lower is closer.",
    inkIou: "IoU of source/vector non-white masks using ink > 12; higher is closer.",
    coverage: "Fraction of pixels above the same ink threshold.",
  },
  winner: null,
};
const manifestPath = resolve(outDir, "CF-16-pixel-drift-PASS4-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
