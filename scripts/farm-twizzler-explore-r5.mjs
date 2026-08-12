/**
 * CF-16 Round 5 — wide gaps (≥4× stroke) on T5 plane.
 *
 * Human: gaps way too small; need clear gap ≥ 4× line width.
 * Engine now sizes Z pitch from packGapRatio.
 *
 * Usage: node scripts/farm-twizzler-explore-r5.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts/explore-r5";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lock = { ...preset.lab.twizzler, speed: 0 };

/** T5 silhouette + sparse even pack. */
const base = {
  heatVariant: 1,
  hillRhythm: 0,
  lineCount: 72,
  lineWidth: 0.55,
  packGapRatio: 4,
  depthSpread: 1.18,
  wrinkles: 1.4,
  wrinkleStrength: 0.17,
  depthTerrain: 0,
  speed: 0,
  amplitude: 1.0,
  depthAmount: 1.15,
  depthWidth: 0.42,
  rightHeight: 0.26,
  scale: 1.22,
  depthLift: 0.85,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  { id: "G0", label: "base · 72 lines · gap 4×", tweaks: { ...base } },

  // —— gap ratio ladder ——
  { id: "G1", label: "gap 5× · 72", tweaks: { ...base, packGapRatio: 5 } },
  { id: "G2", label: "gap 6× · 72", tweaks: { ...base, packGapRatio: 6 } },
  { id: "G3", label: "gap 8× · 64", tweaks: { ...base, packGapRatio: 8, lineCount: 64 } },
  { id: "G4", label: "gap 10× · 56", tweaks: { ...base, packGapRatio: 10, lineCount: 56 } },
  { id: "G5", label: "gap 12× · 48", tweaks: { ...base, packGapRatio: 12, lineCount: 48 } },

  // —— line count at gap 4× ——
  { id: "G6", label: "gap 4× · 48 lines", tweaks: { ...base, lineCount: 48 } },
  { id: "G7", label: "gap 4× · 56 lines", tweaks: { ...base, lineCount: 56 } },
  { id: "G8", label: "gap 4× · 64 lines", tweaks: { ...base, lineCount: 64 } },
  { id: "G9", label: "gap 4× · 80 lines", tweaks: { ...base, lineCount: 80 } },
  { id: "G10", label: "gap 4× · 96 lines", tweaks: { ...base, lineCount: 96, lineWidth: 0.45 } },

  // —— stroke weight at gap 4× ——
  { id: "G11", label: "gap 4× · thicker 0.75", tweaks: { ...base, lineWidth: 0.75, lineCount: 56 } },
  { id: "G12", label: "gap 4× · mid 0.65", tweaks: { ...base, lineWidth: 0.65, lineCount: 64 } },
  { id: "G13", label: "gap 4× · finer 0.4", tweaks: { ...base, lineWidth: 0.4, lineCount: 88 } },
  { id: "G14", label: "gap 6× · thick 0.7", tweaks: { ...base, packGapRatio: 6, lineWidth: 0.7, lineCount: 48 } },

  // —— far-down / punch on open pack ——
  { id: "G15", label: "gap 4× · strong far-down", tweaks: { ...base, depthLift: 1.0 } },
  { id: "G16", label: "gap 5× · strong far-down", tweaks: { ...base, packGapRatio: 5, depthLift: 1.0 } },
  { id: "G17", label: "gap 4× · hard punch", tweaks: { ...base, depthAmount: 1.3, depthWidth: 0.48, rightHeight: 0.2, scale: 1.3 } },
  { id: "G18", label: "gap 6× · punch + far-down", tweaks: { ...base, packGapRatio: 6, lineCount: 64, depthLift: 1.0, depthAmount: 1.25, scale: 1.26 } },

  // —— hills ——
  { id: "G19", label: "gap 4× · lock-B hills", tweaks: { ...base, hillRhythm: 1 } },
  { id: "G20", label: "gap 5× · soft-sharp hills", tweaks: { ...base, packGapRatio: 5, hillRhythm: 2, lineCount: 64 } },
  { id: "G21", label: "gap 6× · calm hills", tweaks: { ...base, packGapRatio: 6, hillRhythm: 0, lineCount: 64 } },

  // —— heat ——
  { id: "G22", label: "gap 4× · ZA wider lobes", tweaks: { ...base, heatVariant: 0 } },
  { id: "G23", label: "gap 5× · denser Z spots", tweaks: { ...base, packGapRatio: 5, heatVariant: 2, lineCount: 64 } },
  { id: "G24", label: "gap 4× · hotter amp", tweaks: { ...base, wrinkleStrength: 0.2 } },
  { id: "G25", label: "gap 4× · cooler amp", tweaks: { ...base, amplitude: 0.88, wrinkleStrength: 0.14 } },

  // —— placement ——
  { id: "G26", label: "gap 4× · pack higher", tweaks: { ...base, centerY: 0.34 } },
  { id: "G27", label: "gap 4× · pack lower", tweaks: { ...base, centerY: 0.48 } },
  { id: "G28", label: "gap 5× · scale up", tweaks: { ...base, packGapRatio: 5, scale: 1.32, centerY: 0.38, lineCount: 64 } },

  // —— open air hybrids ——
  { id: "G29", label: "gap 8× · 40 · thick", tweaks: { ...base, packGapRatio: 8, lineCount: 40, lineWidth: 0.85 } },
  { id: "G30", label: "gap 6× · 56 · far-down · punch", tweaks: { ...base, packGapRatio: 6, lineCount: 56, depthLift: 1.0, depthAmount: 1.25, scale: 1.26 } },
  { id: "G31", label: "gap 4× · 72 · B hills · far-down", tweaks: { ...base, hillRhythm: 1, depthLift: 1.0 } },
  { id: "G32", label: "gap 10× · 36 · statement", tweaks: { ...base, packGapRatio: 10, lineCount: 36, lineWidth: 0.9 } },
  { id: "G33", label: "gap 5× · 72 · mild punch", tweaks: { ...base, packGapRatio: 5, depthAmount: 1.05, scale: 1.18 } },
];

const bundlePath = "/tmp/twizzler-explore-r5-bundle.js";
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
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="400"></canvas><script>${code}</script></body></html>`);

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
      ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(label, 100, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `r5-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve("/opt/cursor/artifacts", `r5-${variant.id}.png`));
  results.push({ ...variant, outPath });
}

const stackHtml = results
  .map((r) => `<img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px;margin:0 0 6px"/>`)
  .join("");
await page.setViewportSize({ width: 1600, height: Math.min(14000, results.length * 406) });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
await page.screenshot({ path: resolve(outDir, "r5-STACK.png"), type: "png", fullPage: true });
copyFileSync(resolve(outDir, "r5-STACK.png"), "/opt/cursor/artifacts/r5-STACK.png");

const cardW = 800;
const cardH = 200;
await page.setViewportSize({ width: cardW * 2, height: Math.min(9000, Math.ceil(results.length / 2) * cardH) });
const sheet = results
  .map(
    (r) =>
      `<div style="width:${cardW}px;height:${cardH}px;overflow:hidden"><img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="width:${cardW}px;display:block"/></div>`,
  )
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;flex-wrap:wrap">${sheet}</body></html>`);
await page.screenshot({ path: resolve(outDir, "r5-SHEET.png"), type: "png", fullPage: true });
copyFileSync(resolve(outDir, "r5-SHEET.png"), "/opt/cursor/artifacts/r5-SHEET.png");

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
if (existsSync(targetPath)) {
  const ids = ["G0", "G2", "G5", "G11", "G18", "G29", "G30", "G32"];
  const blocks = [
    `<div style="color:#fff;font:600 26px sans-serif;padding:10px 14px;background:#111">TARGET</div>
     <img src="data:image/png;base64,${readFileSync(targetPath).toString("base64")}" style="display:block;width:1600px;background:#fff"/>`,
  ];
  for (const id of ids) {
    const r = results.find((x) => x.id === id);
    if (!r) continue;
    blocks.push(
      `<div style="color:#fff;font:600 26px sans-serif;padding:10px 14px;background:#111">${id} — ${r.label}</div>
       <img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px"/>`,
    );
  }
  await page.setViewportSize({ width: 1600, height: 3800 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${blocks.join("")}</body></html>`);
  await page.screenshot({ path: resolve(outDir, "r5-TARGET-COMPARE.png"), type: "png", fullPage: true });
  copyFileSync(resolve(outDir, "r5-TARGET-COMPARE.png"), "/opt/cursor/artifacts/r5-TARGET-COMPARE.png");
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  round: 5,
  note: "packGapRatio enforces clear gap ≥ ratio × stroke. Banner default gap 4× @ 72 lines.",
  instruction: "Reply with G-codes (e.g. G2 G11 G30). Round 6 farms those.",
  sheetPath: "/opt/cursor/artifacts/r5-SHEET.png",
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "r5-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync("/opt/cursor/artifacts/r5-manifest.json", JSON.stringify(manifest, null, 2));
mkdirSync(resolve(root, "apps/lab/src/presets/builtin/handoff/variants"), { recursive: true });
writeFileSync(
  resolve(root, "apps/lab/src/presets/builtin/handoff/variants/EXPLORE-R5.md"),
  `# CF-16 Round 5 — gaps ≥ 4× stroke

Clear gap between fibers is now \`packGapRatio × stroke\` (default **4×**).

Reply with **G-codes**. Stills: \`/opt/cursor/artifacts/r5-*.png\`
`,
);
console.log(JSON.stringify({ round: 5, count: results.length }, null, 2));
