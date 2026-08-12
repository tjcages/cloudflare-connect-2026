/**
 * Verify exact B silhouette: r21 baseline @120 vs lock @240 (denser samples only).
 * Usage: node scripts/capture-twizzler-variants.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

/** Exact settings from the B the user picked (r21). */
const bExact = {
  color: "#e8481c",
  colorFar: "#ffd89a",
  colorNear: "#e8481c",
  colorEdge: "#ffc857",
  opacity: 0.88,
  speed: 0,
  edgeFluctuation: 0,
  edgeSpeed: 0,
  stippleSize: 0,
  twist: 1.35,
  pointSpacing: 3,
  lineCount: 120,
  lineWidth: 0.72,
  amplitude: 1.0,
  scale: 1.15,
  centerY: 0.4,
  depthSpread: 1.18,
  depthLift: 0.85,
  leftHeight: 0.6,
  rightHeight: 0.36,
  bendPosition: 0.25,
  bendAmount: -0.1,
  bend2Position: 0.5,
  bend2Amount: 0.12,
  bend3Position: 0.8,
  bend3Amount: -0.1,
  depthPosition: 0.86,
  depthAmount: 0.9,
  depthWidth: 0.36,
  depth2Position: 0.42,
  depth2Amount: 0.2,
  depth2Width: 0.12,
  wrinkles: 1.4,
  wrinkleStrength: 0.14,
  depthTerrain: 0,
};

const variants = [
  {
    id: "B120",
    label: "B exact r21 settings @120 (shape check)",
    settings: { ...bExact },
  },
  {
    id: "B",
    label: "B lock — same shape, 240 lines, denser samples",
    settings: { ...bExact, lineCount: 240, pointSpacing: 1.5 },
  },
];

const bundlePath = "/tmp/twizzler-bundle.js";
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 416 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="416" style="display:block;width:1600px;height:416px;background:#fff"></canvas>
<script>${code}</script>
</body></html>`);

const paths = [];
for (const variant of variants) {
  await page.evaluate(
    ({ s, id, label }) => {
      const out = document.getElementById("c");
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 320;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, out.width, 96);
      ctx.drawImage(ribbon, 0, 96);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 48px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 24, 68);
      ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 140, 60);
    },
    { s: variant.settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `twizzler-r24-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  if (variant.id === "B") {
    copyFileSync(outPath, resolve(outDir, "twizzler-variant-B.png"));
    copyFileSync(outPath, resolve(outDir, "twizzler-variant-B-labeled.png"));
  }
  paths.push({ id: variant.id, label: variant.label, outPath });
}

await page.setViewportSize({ width: 1600, height: 900 });
const stackHtml = paths
  .map((p) => {
    const b64 = readFileSync(p.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px;background:#fff"/>`;
  })
  .join("");
// Also stack original r21-B for visual diff
const r21 = resolve(outDir, "twizzler-r21-B.png");
let extra = "";
try {
  const b64 = readFileSync(r21).toString("base64");
  extra = `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 12px;background:#fff"/>`;
} catch {
  /* missing */
}
await page.setContent(
  `<!DOCTYPE html><html><body style="margin:0;background:#0b0b0b">${extra}${stackHtml}</body></html>`,
);
const stackPath = resolve(outDir, "twizzler-r24-compare-stack.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}
writeFileSync(resolve(outDir, "twizzler-variants.json"), JSON.stringify({ paths, stackPath }, null, 2));
console.log(JSON.stringify({ paths, stackPath }, null, 2));
