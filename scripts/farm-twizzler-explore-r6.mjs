/**
 * CF-16 Round 6 — even Z gaps, unequal Y gaps (perspective foreshortening).
 *
 * Human: Z (into page) can be even; Y (on screen) must NOT look equally spaced.
 * Engine: yPerspective projects even Z slots with near-open / far-compress Y.
 *
 * Usage: node scripts/farm-twizzler-explore-r6.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts/explore-r6";
mkdirSync(outDir, { recursive: true });

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lock = { ...preset.lab.twizzler, speed: 0 };

/** T5 silhouette + even Z pack + perspective Y. */
const base = {
  heatVariant: 1,
  hillRhythm: 0,
  lineCount: 56,
  lineWidth: 0.75,
  packGapRatio: 4,
  yPerspective: 1.35,
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
  opacity: 0.94,
};

/** @type {Array<{ id: string; label: string; tweaks: Record<string, number> }>} */
const variants = [
  { id: "Y0", label: "base · yPersp 1.35 · Z gap 4× · 56", tweaks: { ...base } },

  // —— foreshorten ladder (same Z gap) ——
  { id: "Y1", label: "flat Y (persp 0) · control", tweaks: { ...base, yPerspective: 0 } },
  { id: "Y2", label: "mild Y foreshorten 0.6", tweaks: { ...base, yPerspective: 0.6 } },
  { id: "Y3", label: "mid Y foreshorten 1.0", tweaks: { ...base, yPerspective: 1.0 } },
  { id: "Y4", label: "strong Y foreshorten 1.8", tweaks: { ...base, yPerspective: 1.8 } },
  { id: "Y5", label: "hard Y foreshorten 2.4", tweaks: { ...base, yPerspective: 2.4 } },
  { id: "Y6", label: "extreme Y foreshorten 3.2", tweaks: { ...base, yPerspective: 3.2 } },

  // —— denser packs still need Y depth ——
  { id: "Y7", label: "72 lines · yPersp 1.35", tweaks: { ...base, lineCount: 72, lineWidth: 0.55 } },
  { id: "Y8", label: "88 lines · yPersp 1.8", tweaks: { ...base, lineCount: 88, lineWidth: 0.45, yPerspective: 1.8 } },
  { id: "Y9", label: "40 lines · yPersp 1.8 · thick", tweaks: { ...base, lineCount: 40, lineWidth: 0.95, yPerspective: 1.8 } },
  { id: "Y10", label: "48 lines · yPersp 2.4", tweaks: { ...base, lineCount: 48, yPerspective: 2.4 } },

  // —— Z gap open + Y foreshorten ——
  { id: "Y11", label: "Z gap 6× · yPersp 1.35", tweaks: { ...base, packGapRatio: 6, lineCount: 48 } },
  { id: "Y12", label: "Z gap 8× · yPersp 1.8", tweaks: { ...base, packGapRatio: 8, lineCount: 40, yPerspective: 1.8 } },
  { id: "Y13", label: "Z gap 5× · yPersp 2.4 · 64", tweaks: { ...base, packGapRatio: 5, lineCount: 64, yPerspective: 2.4 } },

  // —— punch / far-down with perspective ——
  { id: "Y14", label: "yPersp 1.8 · hard punch", tweaks: { ...base, yPerspective: 1.8, depthAmount: 1.3, depthWidth: 0.48, rightHeight: 0.2, scale: 1.3 } },
  { id: "Y15", label: "yPersp 2.0 · strong far-down", tweaks: { ...base, yPerspective: 2.0, depthLift: 1.0 } },
  { id: "Y16", label: "yPersp 1.8 · punch + far-down", tweaks: { ...base, yPerspective: 1.8, depthLift: 1.0, depthAmount: 1.25, scale: 1.26 } },

  // —— hills / heat ——
  { id: "Y17", label: "yPersp 1.35 · lock-B hills", tweaks: { ...base, hillRhythm: 1 } },
  { id: "Y18", label: "yPersp 1.8 · soft-sharp hills", tweaks: { ...base, yPerspective: 1.8, hillRhythm: 2 } },
  { id: "Y19", label: "yPersp 1.8 · ZA wider lobes", tweaks: { ...base, yPerspective: 1.8, heatVariant: 0 } },
  { id: "Y20", label: "yPersp 2.0 · denser Z spots", tweaks: { ...base, yPerspective: 2.0, heatVariant: 2, lineCount: 64 } },

  // —— placement / scale ——
  { id: "Y21", label: "yPersp 1.8 · pack higher", tweaks: { ...base, yPerspective: 1.8, centerY: 0.34 } },
  { id: "Y22", label: "yPersp 1.8 · pack lower", tweaks: { ...base, yPerspective: 1.8, centerY: 0.48 } },
  { id: "Y23", label: "yPersp 2.0 · scale up", tweaks: { ...base, yPerspective: 2.0, scale: 1.32, centerY: 0.38 } },

  // —— statement combos ——
  { id: "Y24", label: "statement · Z6 · yPersp 2.4 · 40", tweaks: { ...base, packGapRatio: 6, yPerspective: 2.4, lineCount: 40, lineWidth: 0.9 } },
  { id: "Y25", label: "dense depth · 80 · yPersp 2.4", tweaks: { ...base, lineCount: 80, lineWidth: 0.4, yPerspective: 2.4, packGapRatio: 4 } },
  { id: "Y26", label: "open depth · Z8 · yPersp 1.8 · punch", tweaks: { ...base, packGapRatio: 8, yPerspective: 1.8, lineCount: 36, depthAmount: 1.25, depthLift: 0.95 } },
  { id: "Y27", label: "calm · yPersp 1.2 · Z5 · 64", tweaks: { ...base, yPerspective: 1.2, packGapRatio: 5, lineCount: 64, amplitude: 0.9, wrinkleStrength: 0.14 } },
  { id: "Y28", label: "hot amp · yPersp 2.0", tweaks: { ...base, yPerspective: 2.0, wrinkleStrength: 0.2, amplitude: 1.0 } },
  { id: "Y29", label: "B hills · yPersp 2.2 · far-down", tweaks: { ...base, hillRhythm: 1, yPerspective: 2.2, depthLift: 1.0, lineCount: 64 } },
  { id: "Y30", label: "ZA + yPersp 2.4 · Z6", tweaks: { ...base, heatVariant: 0, yPerspective: 2.4, packGapRatio: 6, lineCount: 48 } },
  { id: "Y31", label: "mid dens · 64 · yPersp 1.6 · Z5", tweaks: { ...base, lineCount: 64, yPerspective: 1.6, packGapRatio: 5, lineWidth: 0.6 } },
  { id: "Y32", label: "extreme depth · yPersp 3.2 · Z5 · 48", tweaks: { ...base, yPerspective: 3.2, packGapRatio: 5, lineCount: 48, depthLift: 0.95 } },
  { id: "Y33", label: "readable · yPersp 1.5 · Z4 · 56 · thick", tweaks: { ...base, yPerspective: 1.5, lineWidth: 0.9, lineCount: 56 } },
];

const bundlePath = "/tmp/twizzler-explore-r6-bundle.js";
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
  const outPath = resolve(outDir, `r6-${variant.id}.png`);
  await page.locator("#c").screenshot({ path: outPath, type: "png" });
  copyFileSync(outPath, resolve("/opt/cursor/artifacts", `r6-${variant.id}.png`));
  results.push({ ...variant, outPath });
}

const stackHtml = results
  .map((r) => `<img src="data:image/png;base64,${readFileSync(r.outPath).toString("base64")}" style="display:block;width:1600px;margin:0 0 6px"/>`)
  .join("");
await page.setViewportSize({ width: 1600, height: Math.min(14000, results.length * 406) });
await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
await page.screenshot({ path: resolve(outDir, "r6-STACK.png"), type: "png", fullPage: true });
copyFileSync(resolve(outDir, "r6-STACK.png"), "/opt/cursor/artifacts/r6-STACK.png");

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
await page.screenshot({ path: resolve(outDir, "r6-SHEET.png"), type: "png", fullPage: true });
copyFileSync(resolve(outDir, "r6-SHEET.png"), "/opt/cursor/artifacts/r6-SHEET.png");

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
if (existsSync(targetPath)) {
  const ids = ["Y0", "Y1", "Y4", "Y5", "Y12", "Y16", "Y24", "Y32"];
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
  await page.screenshot({ path: resolve(outDir, "r6-TARGET-COMPARE.png"), type: "png", fullPage: true });
  copyFileSync(resolve(outDir, "r6-TARGET-COMPARE.png"), "/opt/cursor/artifacts/r6-TARGET-COMPARE.png");
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

const manifest = {
  round: 6,
  note: "Even Z gaps; unequal screen-Y gaps via yPerspective foreshortening.",
  instruction: "Reply with Y-codes (e.g. Y4 Y16 Y24). Round 7 farms those.",
  sheetPath: "/opt/cursor/artifacts/r6-SHEET.png",
  variants: results.map(({ id, label, outPath, tweaks }) => ({ id, label, outPath, tweaks })),
};
writeFileSync(resolve(outDir, "r6-manifest.json"), JSON.stringify(manifest, null, 2));
writeFileSync("/opt/cursor/artifacts/r6-manifest.json", JSON.stringify(manifest, null, 2));
mkdirSync(resolve(root, "apps/lab/src/presets/builtin/handoff/variants"), { recursive: true });
writeFileSync(
  resolve(root, "apps/lab/src/presets/builtin/handoff/variants/EXPLORE-R6.md"),
  `# CF-16 Round 6 — even Z, unequal Y

Z gaps stay even (\`packGapRatio\`). Screen **Y** gaps foreshorten via \`yPerspective\` (near open / far compress).

**Y1** = flat control (persp 0). Prefer codes where Y gaps clearly change through the pack.

Reply with **Y-codes**. Stills: \`/opt/cursor/artifacts/r6-*.png\`
`,
);
writeFileSync(
  resolve(root, "apps/lab/src/presets/builtin/handoff/variants/README.md"),
  `# CF-16 handoff variants

Round 6 active: **even Z gaps, unequal Y gaps** (\`yPerspective\`).

See \`EXPLORE-R6.md\`. Artifacts: \`/opt/cursor/artifacts/r6-*.png\`.
`,
);

console.log(`Round 6: ${results.length} variants → ${outDir}`);
for (const r of results) console.log(`  ${r.id}  ${r.label}`);
