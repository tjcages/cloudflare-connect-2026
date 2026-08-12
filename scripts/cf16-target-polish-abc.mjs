/**
 * CF-16 target-polish axis — three match strategies against TARGET-twizzler.png.
 *
 * A — silhouette-led: thin low left third, dominant full-height right fan (silhouetteRemap).
 * B — fog/color-led: airy hairline ink, steep far→near white fog, saturated near core (fogLift).
 * C — right-edge/depth-led: combed right-edge S-waves + vertical opening + depth lift (rightFan).
 *
 * Locked: 240 lines, cubic Bézier strokes, rain OFF, lock-B base settings.
 *
 * Usage:
 *   node scripts/cf16-target-polish-abc.mjs
 *   node scripts/cf16-target-polish-abc.mjs --out /opt/cursor/artifacts/cf16-target-polish
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outArg = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "/opt/cursor/artifacts/cf16-target-polish";
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const base = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!base?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

const targetPng = readFileSync(resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png")).toString(
  "base64",
);

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number | string> }>} */
const variants = [
  {
    id: "A",
    label: "silhouette-led — thin low left third, dominant full-height right fan (silhouetteRemap)",
    tweaks: {
      silhouetteRemap: 1,
      centerY: 0.5,
      depthSpread: 1.35,
      lineWidth: 0.55,
      opacity: 0.72,
      fogLift: 0.3,
      colorNear: "#f2581e",
    },
  },
  {
    id: "B",
    label: "fog/color-led — airy hairline ink, steep white fog, narrow saturated near core (fogLift)",
    tweaks: {
      fogLift: 0.85,
      lineWidth: 0.5,
      opacity: 0.58,
      depthSpread: 1.3,
      colorNear: "#f96a24",
      colorFar: "#ffd9b8",
    },
  },
  {
    id: "C",
    label: "right-edge/depth-led — combed right S-waves, vertical opening, quiet left (rightFan)",
    tweaks: {
      rightFan: 1,
      depthLift: 1.0,
      depthSpread: 1.4,
      amplitude: 0.62,
      centerY: 0.42,
      lineWidth: 0.6,
      opacity: 0.78,
      fogLift: 0.2,
      colorNear: "#f4611f",
    },
  },
];

const bundlePath = "/tmp/twizzler-target-polish-bundle.js";
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
const page = await browser.newPage({ viewport: { width: 1600, height: 360 } });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="356"></canvas><script>${code}</script></body></html>`);

const results = [];
for (const variant of variants) {
  const settings = { ...base, ...variant.tweaks, speed: 0 };
  await page.evaluate(
    ({ s, id, label }) => {
      const out = document.getElementById("c");
      const ctx = out.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      const ribbon = document.createElement("canvas");
      ribbon.width = 1600;
      ribbon.height = 300;
      // eslint-disable-next-line no-undef
      TwizzlerMod.renderTwizzler(ribbon, 1600, 300, 0, s);
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, out.width, 56);
      ctx.drawImage(ribbon, 0, 56);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 34px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 20, 40);
      ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 76, 36);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `target-polish-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  results.push({ ...variant, outPath, settings });
}

// STACK: A / B / C.
const stackHtml = results
  .map((r) => {
    const b64 = readFileSync(r.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 8px"/>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "target-polish-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });

// COMPARE: TARGET on top, then A / B / C.
const compareHtml = [
  `<div style="background:#111;color:#fff;font:bold 24px ui-sans-serif,system-ui,sans-serif;padding:12px 20px">TARGET</div>`,
  `<img src="data:image/png;base64,${targetPng}" style="display:block;width:1600px;margin:0 0 8px"/>`,
  stackHtml,
].join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${compareHtml}</body></html>`);
const comparePath = resolve(outDir, "target-polish-COMPARE.png");
await page.screenshot({ path: comparePath, type: "png", fullPage: true });

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  base: { lineCount: base.lineCount, lineWidth: base.lineWidth, centerY: base.centerY },
  stackPath,
  comparePath,
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "target-polish-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
