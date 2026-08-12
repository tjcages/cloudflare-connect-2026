/**
 * CF-16 pixel-drift pass 2: vectorize the raster Δ itself.
 *
 * Raster pixels are used transiently for contour/ridge extraction. Exported
 * SVGs contain path geometry only and are asserted before writing.
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
const traceBundlePath = "/tmp/cf-16-raster-drift-trace-bundle.js";
const twizzlerBundlePath = "/tmp/cf-16-twizzler-pass2-render-bundle.js";
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
      if (!context) throw new Error("Canvas2D is required to derive the raster drift field.");
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

    // eslint-disable-next-line no-undef
    const studies = RasterDriftTraceMod.rasterDriftTraceStudiesToSvg({
      width: renderWidth,
      height: renderHeight,
      intensity,
    });
    for (const [strategy, svg] of Object.entries(studies)) {
      // eslint-disable-next-line no-undef
      RasterDriftTraceMod.assertRasterDriftTraceSvg(svg, { requireCubic: strategy !== "A2" });
    }
    return {
      differenceData: difference.canvas.toDataURL("image/png"),
      studies,
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
  A2: resolve(outDir, "CF-16-pixel-drift-PASS2-A2-contours.svg"),
  B2: resolve(outDir, "CF-16-pixel-drift-PASS2-B2-strands.svg"),
  C2: resolve(outDir, "CF-16-pixel-drift-PASS2-C2-hybrid.svg"),
};
const vectorStats = {};
for (const [strategy, path] of Object.entries(svgPaths)) {
  writeFileSync(path, `${generated.studies[strategy]}\n`);
  const svg = readFileSync(path, "utf8");
  const pathCount = svg.match(/<path\b/g)?.length ?? 0;
  const cubicPathCount = svg.match(/<path\b[^>]*\bd="[^"]*\bC/gi)?.length ?? 0;
  if (pathCount === 0 || /<(?:image|canvas)\b|data\s*:/i.test(svg)) {
    throw new Error(`${path} failed the vector-only SVG invariant.`);
  }
  if (strategy !== "A2" && cubicPathCount === 0) {
    throw new Error(`${path} must include reconstructed cubic strand paths.`);
  }
  vectorStats[strategy] = { path: path, paths: pathCount, cubicPaths: cubicPathCount, bytes: statSync(path).size };
}

const previewPage = await browser.newPage({ viewport: { width, height: cardHeight } });
const cardCss = `
  html,body{margin:0;width:${width}px;background:#fff;font-family:ui-sans-serif,system-ui,sans-serif}
  header{height:68px;box-sizing:border-box;padding:13px 18px;background:#111;color:#fff;display:flex;align-items:center;gap:24px}
  strong{font-size:34px;line-height:1} span{font-size:17px;font-weight:600}
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

const targetPreviewPath = resolve(outDir, "CF-16-pixel-drift-PASS2-TARGET.png");
const rasterDeltaPath = resolve(outDir, "CF-16-pixel-drift-PASS2-RASTER-DELTA.png");
await renderRasterCard("TARGET", "TARGET-twizzler.png · pass-2 evidence basis", targetData, targetPreviewPath);
await renderRasterCard(
  "Δ",
  "original raster pixel-error reference · contour/ridge source only",
  generated.differenceData,
  rasterDeltaPath,
);

const previewPaths = {
  A2: resolve(outDir, "CF-16-pixel-drift-PASS2-A2-contours.png"),
  B2: resolve(outDir, "CF-16-pixel-drift-PASS2-B2-strands.png"),
  C2: resolve(outDir, "CF-16-pixel-drift-PASS2-C2-hybrid.png"),
};
await renderVectorCard(
  "A2",
  "exact contour trace · faithful filled shapes, not editable Twizzler strands",
  generated.studies.A2,
  previewPaths.A2,
);
await renderVectorCard(
  "B2",
  "ridge reconstruction · approximate but editable cubic strands",
  generated.studies.B2,
  previewPaths.B2,
);
await renderVectorCard(
  "C2",
  "hybrid · contour mass + reconstructed cubic high-error line texture",
  generated.studies.C2,
  previewPaths.C2,
);

const stackPath = resolve(outDir, "CF-16-pixel-drift-PASS2-COMPARISON-STACK.png");
const stackCards = [targetPreviewPath, rasterDeltaPath, previewPaths.A2, previewPaths.B2, previewPaths.C2]
  .map((path) => `<img src="${dataUrl(path)}">`)
  .join("");
await previewPage.setViewportSize({ width, height: 1400 });
await previewPage.setContent(
  `<!doctype html><html><head><style>html,body{margin:0;background:#111}img{display:block;width:${width}px;height:${cardHeight}px;margin:0 0 8px}</style></head><body>${stackCards}</body></html>`,
);
await previewPage.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
for (const path of [traceBundlePath, twizzlerBundlePath]) rmSync(path, { force: true });

const manifest = {
  issue: "CF-16",
  pass: 2,
  rain: false,
  source: "TARGET-vs-generated-A4 raster pixel drift",
  target: targetPreviewPath,
  originalRasterDelta: rasterDeltaPath,
  previews: previewPaths,
  stack: stackPath,
  svgs: vectorStats,
  tradeoffs: {
    A2: "Most faithful quantized visual contour trace; filled path shapes are not editable Twizzler strands.",
    B2: "Tracked raster ridges fitted to cubic paths; editable strand geometry is approximate and may not retain every source contour.",
    C2: "Contour underlay preserves low-frequency error mass while selected editable cubic ridges retain line texture.",
  },
  winner: null,
};
const manifestPath = resolve(outDir, "CF-16-pixel-drift-PASS2-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
