/**
 * CF-16 SVG-native pixel-drift studies.
 *
 * TARGET/candidate pixels score generated Twizzler cubic segments, but no raster
 * content is embedded in the exported SVGs.
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
const driftBundlePath = "/tmp/cf-16-twizzler-drift-bundle.js";
const twizzlerBundlePath = "/tmp/cf-16-twizzler-render-bundle.js";
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
  [resolve(root, "apps/lab/src/export/twizzlerDriftToSvg.ts"), "TwizzlerDriftMod", driftBundlePath],
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
<script>${readFileSync(driftBundlePath, "utf8")}</script>
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
      if (!context) throw new Error("Canvas2D is required to score TARGET mismatch.");
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
    for (let index = 0; index < targetPixels.length; index += 4) {
      const red = Math.abs(targetPixels[index] - candidatePixels[index]);
      const green = Math.abs(targetPixels[index + 1] - candidatePixels[index + 1]);
      const blue = Math.abs(targetPixels[index + 2] - candidatePixels[index + 2]);
      const heat = Math.min(255, ((red + green + blue) / 3) * 4);
      differencePixels.data[index] = 255;
      differencePixels.data[index + 1] = 255 - heat;
      differencePixels.data[index + 2] = 255 - heat;
      differencePixels.data[index + 3] = 255;
    }
    difference.context.putImageData(differencePixels, 0, 0);

    const pixelIndex = (x, y) => {
      const safeX = Math.max(0, Math.min(renderWidth - 1, Math.round(x)));
      const safeY = Math.max(0, Math.min(renderHeight - 1, Math.round(y)));
      return (safeY * renderWidth + safeX) * 4;
    };
    const inkAt = (pixels, x, y) => {
      const index = pixelIndex(x, y);
      return 1 - (pixels[index] + pixels[index + 1] + pixels[index + 2]) / (255 * 3);
    };
    const maxInkAround = (pixels, x, y, radius) => {
      let maximum = 0;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 2) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 2) {
          maximum = Math.max(maximum, inkAt(pixels, x + offsetX, y + offsetY));
        }
      }
      return maximum;
    };
    const rgbDifference = (x, y) => {
      const index = pixelIndex(x, y);
      return (
        (Math.abs(targetPixels[index] - candidatePixels[index]) +
          Math.abs(targetPixels[index + 1] - candidatePixels[index + 1]) +
          Math.abs(targetPixels[index + 2] - candidatePixels[index + 2])) /
        (255 * 3)
      );
    };
    const sample = (x, y) => {
      const targetExact = maxInkAround(targetPixels, x, y, 2);
      const candidateExact = maxInkAround(candidatePixels, x, y, 2);
      let strongestTarget = targetExact;
      let strongestOffsetY = 0;
      for (let offsetY = -16; offsetY <= 16; offsetY += 4) {
        const nearbyTarget = maxInkAround(targetPixels, x, y + offsetY, 3);
        if (nearbyTarget > strongestTarget) {
          strongestTarget = nearbyTarget;
          strongestOffsetY = offsetY;
        }
      }
      const displacedTarget = Math.max(0, strongestTarget - targetExact);
      return {
        absolute: Math.min(
          1,
          Math.max(rgbDifference(x, y) * 4, Math.abs(candidateExact - targetExact) * 1.5, displacedTarget * 1.2),
        ),
        targetDeficit: Math.min(1, displacedTarget * 1.35),
        candidateSurplus: Math.min(1, Math.max(0, candidateExact - targetExact) * 1.5),
        targetDirectionY: strongestOffsetY / 16,
      };
    };

    // eslint-disable-next-line no-undef
    const studies = TwizzlerDriftMod.twizzlerDriftStudiesToSvg({
      width: renderWidth,
      height: renderHeight,
      settings: candidateSettings,
      sample,
      pointStride: 4,
      segmentPointCount: 17,
    });
    for (const svg of Object.values(studies)) {
      // eslint-disable-next-line no-undef
      TwizzlerDriftMod.assertVectorOnlyTwizzlerDriftSvg(svg);
    }
    return {
      candidateData: candidate.canvas.toDataURL("image/png"),
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
  A: resolve(outDir, "CF-16-pixel-drift-A-absolute.svg"),
  B: resolve(outDir, "CF-16-pixel-drift-B-signed.svg"),
  C: resolve(outDir, "CF-16-pixel-drift-C-thresholded.svg"),
};
for (const [id, path] of Object.entries(svgPaths)) {
  writeFileSync(path, `${generated.studies[id]}\n`);
  const svg = readFileSync(path, "utf8");
  if (!svg.includes("<path") || /<(?:image|canvas)\b|data\s*:/i.test(svg)) {
    throw new Error(`${path} failed the vector-only SVG invariant.`);
  }
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

const targetPreviewPath = resolve(outDir, "CF-16-pixel-drift-TARGET.png");
const rasterDeltaPath = resolve(outDir, "CF-16-pixel-drift-RASTER-DELTA.png");
await renderRasterCard("TARGET", "TARGET-twizzler.png · vector-drift evidence basis", targetData, targetPreviewPath);
await renderRasterCard(
  "Δ",
  "original raster pixel-error reference · TARGET vs generated A4 basis",
  generated.differenceData,
  rasterDeltaPath,
);

const previewPaths = {
  A: resolve(outDir, "CF-16-pixel-drift-A-absolute.png"),
  B: resolve(outDir, "CF-16-pixel-drift-B-signed.png"),
  C: resolve(outDir, "CF-16-pixel-drift-C-thresholded.png"),
};
await renderVectorCard(
  "A",
  "absolute-drift field · red cubic opacity/weight follows mismatch",
  generated.studies.A,
  previewPaths.A,
);
await renderVectorCard(
  "B",
  "signed/layered · warm displaced TARGET deficit + red candidate surplus",
  generated.studies.B,
  previewPaths.B,
);
await renderVectorCard(
  "C",
  "thresholded graphic drift · high-error hierarchy + diagonal hero fan",
  generated.studies.C,
  previewPaths.C,
);

const stackPath = resolve(outDir, "CF-16-pixel-drift-COMPARISON-STACK.png");
const stackCards = [targetPreviewPath, rasterDeltaPath, previewPaths.A, previewPaths.B, previewPaths.C]
  .map((path) => `<img src="${dataUrl(path)}">`)
  .join("");
await previewPage.setViewportSize({ width, height: 1400 });
await previewPage.setContent(
  `<!doctype html><html><head><style>html,body{margin:0;background:#111}img{display:block;width:${width}px;height:${cardHeight}px;margin:0 0 8px}</style></head><body>${stackCards}</body></html>`,
);
await previewPage.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
for (const path of [driftBundlePath, twizzlerBundlePath]) rmSync(path, { force: true });

const manifest = {
  issue: "CF-16",
  rain: false,
  geometry: "Generated Twizzler Catmull-Rom fibers exported as cubic SVG path segments",
  scoring: "TARGET/candidate raster mismatch sampled along generated strand segments; raster is evidence only",
  target: targetPreviewPath,
  originalRasterDelta: rasterDeltaPath,
  previews: previewPaths,
  stack: stackPath,
  svgs: Object.fromEntries(Object.entries(svgPaths).map(([id, path]) => [id, { path, bytes: statSync(path).size }])),
  studyBTechnicalLimitation:
    "The TARGET source has no recoverable vector strands. Warm deficit paths are displaced generated-fiber error bands directed by nearby TARGET ink; no raster tracing or target-only geometry reconstruction is used.",
  winner: null,
};
const manifestPath = resolve(outDir, "CF-16-pixel-drift-manifest.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
