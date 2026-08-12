/**
 * CF-16 iterative exploration farm — Round 2 around ZA×BB / ZB×BB.
 *
 * Not a finalist bake. Produce a wide labeled board so the human can keep
 * picking winners and we narrow next round. CF-16 stays In Progress.
 *
 * Usage:
 *   node scripts/farm-twizzler-explore-r2.mjs
 *   node scripts/farm-twizzler-explore-r2.mjs --out /opt/cursor/artifacts/explore-r2
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = process.argv.includes("--out")
  ? resolve(process.argv[process.argv.indexOf("--out") + 1])
  : "/opt/cursor/artifacts/explore-r2";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lock = { ...preset.lab.twizzler, speed: 0 };

/** Shared BB pack+hills lock from human picks. */
const bb = {
  hillRhythm: 1,
  lineCount: 240,
  lineWidth: 0.45,
  depthSpread: 1.18,
  wrinkles: 1.4,
  wrinkleStrength: 0.14,
  depthTerrain: 0,
  speed: 0,
};

/**
 * Round-2 board. Codes are what the human should reply with.
 * A* = ZA heat neighborhood · B* = ZB heat neighborhood.
 * @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>}
 */
const variants = [
  // —— anchors ——
  { id: "A0", label: "ZA×BB anchor", tweaks: { ...bb, heatVariant: 0 } },
  { id: "B0", label: "ZB×BB anchor", tweaks: { ...bb, heatVariant: 1 } },

  // —— ZA neighborhood (wider lobes) ——
  { id: "A1", label: "ZA softer amp", tweaks: { ...bb, heatVariant: 0, amplitude: 0.82, wrinkleStrength: 0.11 } },
  { id: "A2", label: "ZA hotter amp", tweaks: { ...bb, heatVariant: 0, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "A3", label: "ZA pack higher", tweaks: { ...bb, heatVariant: 0, centerY: 0.32 } },
  { id: "A4", label: "ZA pack lower", tweaks: { ...bb, heatVariant: 0, centerY: 0.46 } },
  { id: "A5", label: "ZA thicker strokes", tweaks: { ...bb, heatVariant: 0, lineWidth: 0.62 } },
  { id: "A6", label: "ZA finer hairlines", tweaks: { ...bb, heatVariant: 0, lineWidth: 0.32 } },
  { id: "A7", label: "ZA more depth spread", tweaks: { ...bb, heatVariant: 0, depthSpread: 1.4 } },
  { id: "A8", label: "ZA tighter depth", tweaks: { ...bb, heatVariant: 0, depthSpread: 0.95 } },
  { id: "A9", label: "ZA right-edge punch", tweaks: { ...bb, heatVariant: 0, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "A10", label: "ZA gentler bends", tweaks: { ...bb, heatVariant: 0, bendAmount: -0.06, bend2Amount: 0.08, bend3Amount: -0.06 } },
  { id: "A11", label: "ZA stronger bends", tweaks: { ...bb, heatVariant: 0, bendAmount: -0.14, bend2Amount: 0.16, bend3Amount: -0.14 } },
  { id: "A12", label: "ZA foggy far", tweaks: { ...bb, heatVariant: 0, opacity: 0.78, depthLift: 1.05, colorFar: undefined } },
  { id: "A13", label: "ZA denser pack 280", tweaks: { ...bb, heatVariant: 0, lineCount: 280, lineWidth: 0.38 } },
  { id: "A14", label: "ZA airier 180", tweaks: { ...bb, heatVariant: 0, lineCount: 180, lineWidth: 0.58 } },
  { id: "A15", label: "ZA scale up", tweaks: { ...bb, heatVariant: 0, scale: 1.28, centerY: 0.38 } },

  // —— ZB neighborhood (mid lobes) ——
  { id: "B1", label: "ZB softer amp", tweaks: { ...bb, heatVariant: 1, amplitude: 0.82, wrinkleStrength: 0.11 } },
  { id: "B2", label: "ZB hotter amp", tweaks: { ...bb, heatVariant: 1, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "B3", label: "ZB pack higher", tweaks: { ...bb, heatVariant: 1, centerY: 0.32 } },
  { id: "B4", label: "ZB pack lower", tweaks: { ...bb, heatVariant: 1, centerY: 0.46 } },
  { id: "B5", label: "ZB thicker strokes", tweaks: { ...bb, heatVariant: 1, lineWidth: 0.62 } },
  { id: "B6", label: "ZB finer hairlines", tweaks: { ...bb, heatVariant: 1, lineWidth: 0.32 } },
  { id: "B7", label: "ZB more depth spread", tweaks: { ...bb, heatVariant: 1, depthSpread: 1.4 } },
  { id: "B8", label: "ZB tighter depth", tweaks: { ...bb, heatVariant: 1, depthSpread: 0.95 } },
  { id: "B9", label: "ZB right-edge punch", tweaks: { ...bb, heatVariant: 1, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "B10", label: "ZB gentler bends", tweaks: { ...bb, heatVariant: 1, bendAmount: -0.06, bend2Amount: 0.08, bend3Amount: -0.06 } },
  { id: "B11", label: "ZB stronger bends", tweaks: { ...bb, heatVariant: 1, bendAmount: -0.14, bend2Amount: 0.16, bend3Amount: -0.14 } },
  { id: "B12", label: "ZB foggy far", tweaks: { ...bb, heatVariant: 1, opacity: 0.78, depthLift: 1.05 } },
  { id: "B13", label: "ZB denser pack 280", tweaks: { ...bb, heatVariant: 1, lineCount: 280, lineWidth: 0.38 } },
  { id: "B14", label: "ZB airier 180", tweaks: { ...bb, heatVariant: 1, lineCount: 180, lineWidth: 0.58 } },
  { id: "B15", label: "ZB scale up", tweaks: { ...bb, heatVariant: 1, scale: 1.28, centerY: 0.38 } },

  // —— crossover / wildcards near the picks ——
  { id: "X1", label: "ZA heat × calmer hills", tweaks: { ...bb, heatVariant: 0, hillRhythm: 0 } },
  { id: "X2", label: "ZB heat × calmer hills", tweaks: { ...bb, heatVariant: 1, hillRhythm: 0 } },
  { id: "X3", label: "ZA heat × sharper hills", tweaks: { ...bb, heatVariant: 0, hillRhythm: 2 } },
  { id: "X4", label: "ZB heat × sharper hills", tweaks: { ...bb, heatVariant: 1, hillRhythm: 2 } },
  { id: "X5", label: "ZA + ZC blend feel (dense spots)", tweaks: { ...bb, heatVariant: 2, lineWidth: 0.45 } },
  { id: "X6", label: "ZB thick lock-B stroke", tweaks: { ...bb, heatVariant: 1, lineWidth: 0.72 } },
];

// Drop undefined colorFar if present
for (const v of variants) {
  for (const key of Object.keys(v.tweaks)) {
    if (v.tweaks[key] === undefined) delete v.tweaks[key];
  }
}

const bundlePath = "/tmp/twizzler-explore-r2-bundle.js";
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
const page = await browser.newPage({ viewport: { width: 1600, height: 400 } });

async function loadPage() {
  await page.setViewportSize({ width: 1600, height: 400 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="400"></canvas><script>${code}</script></body></html>`);
}

await loadPage();

const results = [];
for (const variant of variants) {
  const settings = { ...lock, ...variant.tweaks, speed: 0 };
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
      ctx.fillRect(0, 0, out.width, 88);
      ctx.drawImage(ribbon, 0, 88);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 44px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(id, 20, 58);
      ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 110, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `r2-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve("/opt/cursor/artifacts", `r2-${variant.id}.png`));
  results.push({ ...variant, outPath, settings });
}

// Full stack
const stackHtml = results
  .map((r) => {
    const b64 = readFileSync(r.outPath).toString("base64");
    return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 6px"/>`;
  })
  .join("");
await page.setViewportSize({ width: 1600, height: Math.min(12000, results.length * 406) });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "r2-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, "/opt/cursor/artifacts/r2-STACK.png");

// 2-column contact sheet of labeled cards (faster browse)
const sheetCols = 2;
const cardW = 800;
const cardH = 200;
const rows = Math.ceil(results.length / sheetCols);
await page.setViewportSize({ width: cardW * sheetCols, height: Math.min(8000, rows * cardH) });
const sheetCells = results
  .map((r) => {
    const b64 = readFileSync(r.outPath).toString("base64");
    return `<div style="width:${cardW}px;height:${cardH}px;overflow:hidden;position:relative">
      <img src="data:image/png;base64,${b64}" style="width:${cardW}px;height:auto;display:block"/>
    </div>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;flex-wrap:wrap">${sheetCells}</body></html>`);
const sheetPath = resolve(outDir, "r2-SHEET.png");
await page.screenshot({ path: sheetPath, type: "png", fullPage: true });
copyFileSync(sheetPath, "/opt/cursor/artifacts/r2-SHEET.png");

// TARGET compare strip: TARGET + A0 + B0 + top wildcards
const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
if (existsSync(targetPath)) {
  const compareIds = ["A0", "B0", "A9", "B9", "A7", "B7", "X1", "X3"];
  const blocks = [
    `<div style="color:#fff;font:600 26px sans-serif;padding:10px 14px;background:#111">TARGET</div>
     <img src="data:image/png;base64,${readFileSync(targetPath).toString("base64")}" style="display:block;width:1600px;background:#fff"/>`,
  ];
  for (const id of compareIds) {
    const r = results.find((x) => x.id === id);
    if (!r) continue;
    blocks.push(
      `<div style="color:#fff;font:600 26px sans-serif;padding:10px 14px;background:#111">${id} — ${r.label}</div>
       <img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px"/>`,
    );
  }
  await page.setViewportSize({ width: 1600, height: 3600 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${blocks.join("")}</body></html>`);
  const comparePath = resolve(outDir, "r2-TARGET-COMPARE.png");
  await page.screenshot({ path: comparePath, type: "png", fullPage: true });
  copyFileSync(comparePath, "/opt/cursor/artifacts/r2-TARGET-COMPARE.png");
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  round: 2,
  anchors: { A0: "ZA×BB", B0: "ZB×BB" },
  instruction: "Reply with codes you like (e.g. A7 B2 B9 X3). We will farm Round 3 around those.",
  stackPath: "/opt/cursor/artifacts/r2-STACK.png",
  sheetPath: "/opt/cursor/artifacts/r2-SHEET.png",
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "r2-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync("/opt/cursor/artifacts/r2-manifest.json", JSON.stringify(manifest, null, 2));

// Repo pick board for the PR
const boardDir = resolve(root, "apps/lab/src/presets/builtin/handoff/variants");
mkdirSync(boardDir, { recursive: true });
writeFileSync(
  resolve(boardDir, "EXPLORE-R2.md"),
  `# CF-16 exploration Round 2 — pick codes

Anchors from your last likes: **A0** = ZA×BB · **B0** = ZB×BB.

Reply with any codes you like (multi-select). We will farm Round 3 around those winners.
**Do not mark CF-16 Done until you declare a winner.**

| Code | Family | What it explores |
|------|--------|------------------|
${results.map((r) => `| **${r.id}** | ${r.id[0] === "X" ? "crossover" : r.id[0] === "A" ? "ZA heat" : "ZB heat"} | ${r.label} |`).join("\n")}

Stills: \`/opt/cursor/artifacts/r2-*.png\` · stack \`r2-STACK.png\` · sheet \`r2-SHEET.png\` · compare \`r2-TARGET-COMPARE.png\`
`,
);

console.log(JSON.stringify({ round: 2, count: results.length, stackPath: manifest.stackPath, sheetPath: manifest.sheetPath }, null, 2));
