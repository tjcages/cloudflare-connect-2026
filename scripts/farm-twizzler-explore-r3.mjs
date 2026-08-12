/**
 * CF-16 exploration Round 3 — around B2 / B9 / B13 / soft X2 / soft X4.
 *
 * Human Round-2 likes: B2, B9, B13, X2, X4 (X2/X4 too jittery → engine hills softened).
 * Reply with codes; we farm Round 4 around winners. CF-16 stays In Progress.
 *
 * Usage: node scripts/farm-twizzler-explore-r3.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.argv.includes("--out")
  ? resolve(process.argv[process.argv.indexOf("--out") + 1])
  : "/opt/cursor/artifacts/explore-r3";
mkdirSync(outDir, { recursive: true });
mkdirSync("/opt/cursor/artifacts", { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lock = { ...preset.lab.twizzler, speed: 0 };

/** Shared ZB heat + BB pack base. */
const zb = {
  heatVariant: 1,
  hillRhythm: 1,
  lineCount: 240,
  lineWidth: 0.45,
  depthSpread: 1.18,
  wrinkles: 1.4,
  wrinkleStrength: 0.14,
  depthTerrain: 0,
  speed: 0,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  // —— Round-2 winners (re-anchored after hill soften) ——
  { id: "C0", label: "B2 reanchor · hotter amp", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "C1", label: "B9 reanchor · right-edge punch", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "C2", label: "B13 reanchor · 280 pack", tweaks: { ...zb, lineCount: 280, lineWidth: 0.38 } },
  { id: "C3", label: "X2 soft · calmer hills", tweaks: { ...zb, hillRhythm: 0 } },
  { id: "C4", label: "X4 soft · sharper hills", tweaks: { ...zb, hillRhythm: 2 } },

  // —— B2 neighborhood (hotter amp) ——
  { id: "H1", label: "B2 mild hot", tweaks: { ...zb, amplitude: 0.92, wrinkleStrength: 0.15 } },
  { id: "H2", label: "B2 max hot", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.2 } },
  { id: "H3", label: "B2 hot + higher", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, centerY: 0.34 } },
  { id: "H4", label: "B2 hot + lower", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, centerY: 0.46 } },
  { id: "H5", label: "B2 hot + more depth", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, depthSpread: 1.38 } },
  { id: "H6", label: "B2 hot + tighter depth", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, depthSpread: 1.0 } },

  // —— B9 neighborhood (right-edge punch) ——
  { id: "R1", label: "B9 mild punch", tweaks: { ...zb, depthAmount: 1.0, depthWidth: 0.38, rightHeight: 0.3, scale: 1.18 } },
  { id: "R2", label: "B9 hard punch", tweaks: { ...zb, depthAmount: 1.25, depthWidth: 0.46, rightHeight: 0.2, scale: 1.28 } },
  { id: "R3", label: "B9 punch + hot amp", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "R4", label: "B9 punch + 280", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, lineCount: 280, lineWidth: 0.38 } },
  { id: "R5", label: "B9 punch + more depth", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, depthSpread: 1.4 } },
  { id: "R6", label: "B9 punch + higher pack", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, centerY: 0.34 } },

  // —— B13 neighborhood (denser pack) ——
  { id: "P1", label: "B13 mild 260", tweaks: { ...zb, lineCount: 260, lineWidth: 0.4 } },
  { id: "P2", label: "B13 denser 300", tweaks: { ...zb, lineCount: 300, lineWidth: 0.34 } },
  { id: "P3", label: "B13 280 + hot", tweaks: { ...zb, lineCount: 280, lineWidth: 0.38, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "P4", label: "B13 280 + punch", tweaks: { ...zb, lineCount: 280, lineWidth: 0.38, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "P5", label: "B13 280 + more depth", tweaks: { ...zb, lineCount: 280, lineWidth: 0.38, depthSpread: 1.4 } },
  { id: "P6", label: "B13 280 + thicker", tweaks: { ...zb, lineCount: 280, lineWidth: 0.5 } },

  // —— Soft calmer hills (X2 lineage) ——
  { id: "S1", label: "soft calm + hot", tweaks: { ...zb, hillRhythm: 0, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "S2", label: "soft calm + punch", tweaks: { ...zb, hillRhythm: 0, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "S3", label: "soft calm + 280", tweaks: { ...zb, hillRhythm: 0, lineCount: 280, lineWidth: 0.38 } },
  { id: "S4", label: "soft calm + hot + 280", tweaks: { ...zb, hillRhythm: 0, amplitude: 1.0, wrinkleStrength: 0.17, lineCount: 280, lineWidth: 0.38 } },
  { id: "S5", label: "soft calm + punch + hot", tweaks: { ...zb, hillRhythm: 0, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },

  // —— Soft sharper hills (X4 lineage) ——
  { id: "K1", label: "soft sharp + hot", tweaks: { ...zb, hillRhythm: 2, amplitude: 1.0, wrinkleStrength: 0.17 } },
  { id: "K2", label: "soft sharp + punch", tweaks: { ...zb, hillRhythm: 2, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },
  { id: "K3", label: "soft sharp + 280", tweaks: { ...zb, hillRhythm: 2, lineCount: 280, lineWidth: 0.38 } },
  { id: "K4", label: "soft sharp + hot + 280", tweaks: { ...zb, hillRhythm: 2, amplitude: 1.0, wrinkleStrength: 0.17, lineCount: 280, lineWidth: 0.38 } },
  { id: "K5", label: "soft sharp + punch + hot", tweaks: { ...zb, hillRhythm: 2, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22 } },

  // —— Triple hybrids / wildcards ——
  { id: "T1", label: "hot + punch + 280", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, lineCount: 280, lineWidth: 0.38 } },
  { id: "T2", label: "hot + punch + more depth", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, depthSpread: 1.4 } },
  { id: "T3", label: "hot + 280 + more depth", tweaks: { ...zb, amplitude: 1.0, wrinkleStrength: 0.17, lineCount: 280, lineWidth: 0.38, depthSpread: 1.4 } },
  { id: "T4", label: "punch + 280 + higher", tweaks: { ...zb, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, lineCount: 280, lineWidth: 0.38, centerY: 0.34 } },
  { id: "T5", label: "calm soft + hot + punch + 280", tweaks: { ...zb, hillRhythm: 0, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, lineCount: 280, lineWidth: 0.38 } },
  { id: "T6", label: "sharp soft + hot + punch + 280", tweaks: { ...zb, hillRhythm: 2, amplitude: 1.0, wrinkleStrength: 0.17, depthAmount: 1.15, depthWidth: 0.42, rightHeight: 0.26, scale: 1.22, lineCount: 280, lineWidth: 0.38 } },
];

const bundlePath = "/tmp/twizzler-explore-r3-bundle.js";
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
      ctx.fillText(label, 100, 52);
    },
    { s: settings, id: variant.id, label: variant.label },
  );
  const outPath = resolve(outDir, `r3-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve("/opt/cursor/artifacts", `r3-${variant.id}.png`));
  results.push({ ...variant, outPath, settings });
}

const stackHtml = results
  .map((r) => `<img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px;margin:0 0 6px"/>`)
  .join("");
await page.setViewportSize({ width: 1600, height: Math.min(14000, results.length * 406) });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "r3-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, "/opt/cursor/artifacts/r3-STACK.png");

const cardW = 800;
const cardH = 200;
const rows = Math.ceil(results.length / 2);
await page.setViewportSize({ width: cardW * 2, height: Math.min(9000, rows * cardH) });
const sheetCells = results
  .map((r) => {
    const b64 = readFileSync(r.outPath).toString("base64");
    return `<div style="width:${cardW}px;height:${cardH}px;overflow:hidden"><img src="data:image/png;base64,${b64}" style="width:${cardW}px;display:block"/></div>`;
  })
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;flex-wrap:wrap">${sheetCells}</body></html>`);
const sheetPath = resolve(outDir, "r3-SHEET.png");
await page.screenshot({ path: sheetPath, type: "png", fullPage: true });
copyFileSync(sheetPath, "/opt/cursor/artifacts/r3-SHEET.png");

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
if (existsSync(targetPath)) {
  const compareIds = ["C0", "C1", "C2", "C3", "C4", "R3", "P3", "T1", "T5", "T6"];
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
  await page.setViewportSize({ width: 1600, height: 4200 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${blocks.join("")}</body></html>`);
  const comparePath = resolve(outDir, "r3-TARGET-COMPARE.png");
  await page.screenshot({ path: comparePath, type: "png", fullPage: true });
  copyFileSync(comparePath, "/opt/cursor/artifacts/r3-TARGET-COMPARE.png");
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  round: 3,
  fromPicks: ["B2", "B9", "B13", "X2", "X4"],
  note: "X2/X4 hills softened in engine (less high-freq jitter). C3/C4 are soft reanchors.",
  instruction: "Reply with codes you like (e.g. R3 P3 T1 S2). Round 4 farms around those.",
  stackPath: "/opt/cursor/artifacts/r3-STACK.png",
  sheetPath: "/opt/cursor/artifacts/r3-SHEET.png",
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "r3-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync("/opt/cursor/artifacts/r3-manifest.json", JSON.stringify(manifest, null, 2));

const boardDir = resolve(root, "apps/lab/src/presets/builtin/handoff/variants");
mkdirSync(boardDir, { recursive: true });
writeFileSync(
  resolve(boardDir, "EXPLORE-R3.md"),
  `# CF-16 exploration Round 3

From your Round-2 likes: **B2, B9, B13, X2, X4** (X2/X4 hills softened).

Reply with codes. Multi-select. No winner until you say so.

| Family | Codes | Focus |
|--------|-------|-------|
| Reanchors | **C0–C4** | B2 / B9 / B13 / soft-X2 / soft-X4 |
| Hot amp | **H1–H6** | B2 neighborhood |
| Right punch | **R1–R6** | B9 neighborhood |
| Dense pack | **P1–P6** | B13 neighborhood |
| Soft calm | **S1–S5** | X2 lineage × winners |
| Soft sharp | **K1–K5** | X4 lineage × winners |
| Hybrids | **T1–T6** | stacked combos |

Stills: \`/opt/cursor/artifacts/r3-*.png\` · \`r3-SHEET.png\` · \`r3-STACK.png\` · \`r3-TARGET-COMPARE.png\`
`,
);

console.log(JSON.stringify({ round: 3, count: results.length, sheetPath: manifest.sheetPath }, null, 2));
