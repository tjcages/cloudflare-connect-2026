/**
 * CF-16 Round 4 — T5 + even-gap plane wiggle + far-Z down.
 *
 * From human: only T5 liked; far ribbons should sit lower; gaps should be even
 * (wiggling plane, not fluctuating spacing). Structural engine changes already in.
 *
 * Usage: node scripts/farm-twizzler-explore-r4.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts/explore-r4";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lock = { ...preset.lab.twizzler, speed: 0 };

/** T5 lock (banner default). */
const t5 = {
  heatVariant: 1,
  hillRhythm: 0,
  lineCount: 280,
  lineWidth: 0.38,
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
  { id: "D0", label: "T5 + even gaps + far-down (new base)", tweaks: { ...t5 } },

  // —— far-Z down strength (depthLift / depthSpread) ——
  { id: "D1", label: "stronger far-down", tweaks: { ...t5, depthLift: 1.05 } },
  { id: "D2", label: "max far-down", tweaks: { ...t5, depthLift: 1.2 } },
  { id: "D3", label: "milder far-down", tweaks: { ...t5, depthLift: 0.65 } },
  { id: "D4", label: "far-down + wider stack", tweaks: { ...t5, depthLift: 1.05, depthSpread: 1.4 } },
  { id: "D5", label: "far-down + tighter stack", tweaks: { ...t5, depthLift: 1.05, depthSpread: 0.95 } },

  // —— pack denseness around T5 280 ——
  { id: "D6", label: "T5 @ 240 even", tweaks: { ...t5, lineCount: 240, lineWidth: 0.42 } },
  { id: "D7", label: "T5 @ 300 even", tweaks: { ...t5, lineCount: 300, lineWidth: 0.34 } },
  { id: "D8", label: "T5 thicker hair", tweaks: { ...t5, lineWidth: 0.48 } },
  { id: "D9", label: "T5 finer hair", tweaks: { ...t5, lineWidth: 0.3 } },

  // —— right-edge punch around T5 ——
  { id: "D10", label: "T5 milder punch", tweaks: { ...t5, depthAmount: 0.95, depthWidth: 0.36, rightHeight: 0.3, scale: 1.15 } },
  { id: "D11", label: "T5 harder punch", tweaks: { ...t5, depthAmount: 1.3, depthWidth: 0.48, rightHeight: 0.2, scale: 1.3 } },
  { id: "D12", label: "T5 punch + far-down", tweaks: { ...t5, depthLift: 1.1, depthAmount: 1.25, depthWidth: 0.44, rightHeight: 0.22, scale: 1.26 } },

  // —— amp / heat around T5 ——
  { id: "D13", label: "T5 cooler amp", tweaks: { ...t5, amplitude: 0.88, wrinkleStrength: 0.14 } },
  { id: "D14", label: "T5 hotter amp", tweaks: { ...t5, amplitude: 1.0, wrinkleStrength: 0.2 } },
  { id: "D15", label: "T5 + ZA wider lobes", tweaks: { ...t5, heatVariant: 0 } },
  { id: "D16", label: "T5 + denser Z spots", tweaks: { ...t5, heatVariant: 2 } },

  // —— hills around soft-calm T5 ——
  { id: "D17", label: "T5 + lock-B hills", tweaks: { ...t5, hillRhythm: 1 } },
  { id: "D18", label: "T5 + soft-sharp hills", tweaks: { ...t5, hillRhythm: 2 } },
  { id: "D19", label: "T5 calmer + far-down + B hills", tweaks: { ...t5, hillRhythm: 1, depthLift: 1.05 } },

  // —— placement / scale ——
  { id: "D20", label: "T5 pack higher", tweaks: { ...t5, centerY: 0.34 } },
  { id: "D21", label: "T5 pack lower", tweaks: { ...t5, centerY: 0.46 } },
  { id: "D22", label: "T5 scale up", tweaks: { ...t5, scale: 1.32, centerY: 0.38 } },
  { id: "D23", label: "T5 scale down", tweaks: { ...t5, scale: 1.1 } },

  // —— stacked “direction correct” hybrids ——
  { id: "D24", label: "far-down + 300 + mild punch", tweaks: { ...t5, depthLift: 1.1, lineCount: 300, lineWidth: 0.34, depthAmount: 1.05, scale: 1.18 } },
  { id: "D25", label: "far-down + wider + hot", tweaks: { ...t5, depthLift: 1.1, depthSpread: 1.38, wrinkleStrength: 0.19 } },
  { id: "D26", label: "far-down + B hills + 300", tweaks: { ...t5, depthLift: 1.08, hillRhythm: 1, lineCount: 300, lineWidth: 0.34 } },
  { id: "D27", label: "far-down + ZA heat + punch", tweaks: { ...t5, depthLift: 1.1, heatVariant: 0, depthAmount: 1.2, scale: 1.26 } },
  { id: "D28", label: "max far-down + hard punch + 280", tweaks: { ...t5, depthLift: 1.2, depthAmount: 1.3, depthWidth: 0.48, rightHeight: 0.2, scale: 1.3 } },
  { id: "D29", label: "far-down + foggy opacity", tweaks: { ...t5, depthLift: 1.1, opacity: 0.8 } },
  { id: "D30", label: "plane calm · less amp · strong far-down", tweaks: { ...t5, depthLift: 1.15, amplitude: 0.9, wrinkleStrength: 0.13, depthSpread: 1.3 } },
  { id: "D31", label: "plane energetic · strong far-down", tweaks: { ...t5, depthLift: 1.15, amplitude: 1.0, wrinkleStrength: 0.2, depthSpread: 1.35, depthAmount: 1.2 } },
];

const bundlePath = "/tmp/twizzler-explore-r4-bundle.js";
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
  const outPath = resolve(outDir, `r4-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve("/opt/cursor/artifacts", `r4-${variant.id}.png`));
  results.push({ ...variant, outPath });
}

const stackHtml = results
  .map((r) => `<img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px;margin:0 0 6px"/>`)
  .join("");
await page.setViewportSize({ width: 1600, height: Math.min(14000, results.length * 406) });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
const stackPath = resolve(outDir, "r4-STACK.png");
await page.screenshot({ path: stackPath, type: "png", fullPage: true });
copyFileSync(stackPath, "/opt/cursor/artifacts/r4-STACK.png");

const cardW = 800;
const cardH = 200;
await page.setViewportSize({ width: cardW * 2, height: Math.min(9000, Math.ceil(results.length / 2) * cardH) });
const sheet = results
  .map((r) => `<div style="width:${cardW}px;height:${cardH}px;overflow:hidden"><img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="width:${cardW}px;display:block"/></div>`)
  .join("");
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#111;display:flex;flex-wrap:wrap">${sheet}</body></html>`);
const sheetPath = resolve(outDir, "r4-SHEET.png");
await page.screenshot({ path: sheetPath, type: "png", fullPage: true });
copyFileSync(sheetPath, "/opt/cursor/artifacts/r4-SHEET.png");

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
if (existsSync(targetPath)) {
  const ids = ["D0", "D1", "D4", "D12", "D24", "D26", "D28", "D31"];
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
  const comparePath = resolve(outDir, "r4-TARGET-COMPARE.png");
  await page.screenshot({ path: comparePath, type: "png", fullPage: true });
  copyFileSync(comparePath, "/opt/cursor/artifacts/r4-TARGET-COMPARE.png");
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  round: 4,
  fromPicks: ["T5"],
  structural: ["even Z gaps", "shared plane amp wiggle", "far fibers lower (+Y)"],
  instruction: "Reply with D-codes you like (e.g. D0 D4 D12 D28). Round 5 farms those.",
  sheetPath: "/opt/cursor/artifacts/r4-SHEET.png",
  stackPath: "/opt/cursor/artifacts/r4-STACK.png",
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "r4-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync("/opt/cursor/artifacts/r4-manifest.json", JSON.stringify(manifest, null, 2));

mkdirSync(resolve(root, "apps/lab/src/presets/builtin/handoff/variants"), { recursive: true });
writeFileSync(
  resolve(root, "apps/lab/src/presets/builtin/handoff/variants/EXPLORE-R4.md"),
  `# CF-16 Round 4 — T5 + even-gap plane + far-down

Structural course-correct from your notes:
- **Even gaps** between fibers (no fluctuating spacing)
- Pack moves as a **wiggling plane**
- **Far-Z fibers sit lower** on screen

Base **D0** = T5 settings on the new engine.

Reply with codes (e.g. \`D0 D4 D12 D28\`).

Stills: \`/opt/cursor/artifacts/r4-*.png\`
`,
);

console.log(JSON.stringify({ round: 4, count: results.length, sheetPath: manifest.sheetPath }, null, 2));
