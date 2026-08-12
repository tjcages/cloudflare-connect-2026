/**
 * CF-16 axis A/B/C farm — one process, four axes × three stills + stacks.
 *
 * Usage:
 *   node scripts/farm-twizzler-axes.mjs
 *   node scripts/farm-twizzler-axes.mjs --axis z-heat
 *   node scripts/farm-twizzler-axes.mjs --out /opt/cursor/artifacts
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outRoot = process.argv.includes("--out")
  ? resolve(process.argv[process.argv.indexOf("--out") + 1])
  : "/opt/cursor/artifacts";
const axisFilter = process.argv.includes("--axis")
  ? process.argv[process.argv.indexOf("--axis") + 1]
  : null;

const preset = JSON.parse(readFileSync(resolve(root, "apps/lab/src/presets/builtin/banner-5x1.json"), "utf8"));
const lockB = { ...(preset.lab?.twizzler ?? preset.config?.twizzler), speed: 0 };
if (!lockB?.lineCount) throw new Error("banner-5x1.json missing lab.twizzler");

/**
 * Four CF-16 axes. Each A/B/C is a structural move on that axis only.
 * @type {Record<string, { dir: string; label: string; variants: Array<{ id: string; label: string; tweaks: Record<string, number> }> }>}
 */
const axes = {
  "z-heat": {
    dir: "z-heat",
    label: "Z-scattered amplitude heat",
    variants: [
      // Fewer wider Z lobes (high patchScale via low wrinkles)
      {
        id: "A",
        label: "fewer wider Z lobes",
        tweaks: { wrinkles: 0.9, wrinkleStrength: 0.16, centerY: 0.4 },
      },
      // Mid / lock-B character
      {
        id: "B",
        label: "mid Z lobes (lock B)",
        tweaks: { wrinkles: 1.4, wrinkleStrength: 0.14 },
      },
      // Denser Z spots through depth
      {
        id: "C",
        label: "denser Z spots",
        tweaks: { wrinkles: 3.4, wrinkleStrength: 0.13, centerY: 0.39 },
      },
    ],
  },
  "macro-hills": {
    dir: "macro-hills",
    label: "L→R hill rhythm (spine / bends / marketing knots)",
    variants: [
      // Calmer fewer hills — sparse terrain + soft bends
      {
        id: "A",
        label: "calmer fewer hills",
        tweaks: {
          depthTerrain: 2,
          bendAmount: -0.05,
          bend2Amount: 0.06,
          bend3Amount: -0.05,
          amplitude: 0.88,
        },
      },
      // Current energy (lock B rolling terrain)
      {
        id: "B",
        label: "current energy (lock B)",
        tweaks: {
          depthTerrain: 0,
          bendAmount: -0.1,
          bend2Amount: 0.12,
          bend3Amount: -0.1,
          amplitude: 1.0,
        },
      },
      // More hills / sharper valleys (jagged terrain + stronger bends)
      {
        id: "C",
        label: "more hills / sharper valleys",
        tweaks: {
          depthTerrain: 1,
          bendAmount: -0.16,
          bend2Amount: 0.18,
          bend3Amount: -0.15,
          bendPosition: 0.22,
          bend2Position: 0.48,
          bend3Position: 0.78,
          amplitude: 1.0,
        },
      },
    ],
  },
  "pack-density": {
    dir: "pack-density",
    label: "Pack denseness / fog / nearness",
    variants: [
      {
        id: "A",
        label: "airier fewer thicker",
        tweaks: { lineCount: 140, lineWidth: 1.05, depthSpread: 1.05, opacity: 0.92 },
      },
      {
        id: "B",
        label: "240 mid (lock B)",
        tweaks: { lineCount: 240, lineWidth: 0.72, depthSpread: 1.18, opacity: 0.88 },
      },
      {
        id: "C",
        label: "320 hairlines",
        tweaks: { lineCount: 320, lineWidth: 0.48, depthSpread: 1.35, opacity: 0.84 },
      },
    ],
  },
  "target-polish": {
    dir: "target-polish",
    label: "TARGET match strategies (silhouette / fog / right-edge)",
    variants: [
      // Strategy A: silhouette — marketing spine + bends toward TARGET rise-to-right
      {
        id: "A",
        label: "silhouette: sparse sweep + right rise",
        tweaks: {
          depthTerrain: 2,
          centerY: 0.36,
          bendAmount: -0.08,
          bend2Amount: 0.1,
          bend3Amount: -0.14,
          bend3Position: 0.72,
          leftHeight: 0.55,
          rightHeight: 0.28,
          scale: 1.22,
        },
      },
      // Strategy B: color fog / pack open — depthSpread + depth lobes for misty volume
      {
        id: "B",
        label: "color fog: deeper stack + soft far fade",
        tweaks: {
          depthSpread: 1.55,
          depthLift: 1.05,
          depthAmount: 1.05,
          depthWidth: 0.42,
          depth2Amount: 0.35,
          depth2Width: 0.18,
          opacity: 0.82,
          lineWidth: 0.62,
        },
      },
      // Strategy C: right-edge energy — fan / coral punch / near-camera right
      {
        id: "C",
        label: "right-edge energy: fan + coral punch",
        tweaks: {
          depthPosition: 0.9,
          depthAmount: 1.15,
          depthWidth: 0.4,
          rightHeight: 0.22,
          edgeTaper: 0.02,
          amplitude: 1.0,
          wrinkleStrength: 0.15,
          scale: 1.2,
          centerY: 0.38,
        },
      },
    ],
  },
};

const selected = axisFilter
  ? Object.fromEntries(Object.entries(axes).filter(([k]) => k === axisFilter))
  : axes;
if (Object.keys(selected).length === 0) {
  throw new Error(`Unknown --axis ${axisFilter}. Expected one of: ${Object.keys(axes).join(", ")}`);
}

const bundlePath = "/tmp/twizzler-axes-bundle.js";
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

const targetPath = resolve(root, "apps/lab/src/presets/builtin/handoff/TARGET-twizzler.png");
const hasTarget = existsSync(targetPath);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 416 } });

async function loadRenderPage() {
  await page.setViewportSize({ width: 1600, height: 416 });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff">
<canvas id="c" width="1600" height="416"></canvas><script>${code}</script></body></html>`);
}

await loadRenderPage();

const manifest = { lockB: { lineCount: lockB.lineCount, wrinkles: lockB.wrinkles, depthTerrain: lockB.depthTerrain }, axes: {} };

for (const [axisKey, axis] of Object.entries(selected)) {
  const outDir = resolve(outRoot, axis.dir);
  mkdirSync(outDir, { recursive: true });
  const results = [];
  await loadRenderPage();

  for (const variant of axis.variants) {
    const settings = { ...lockB, ...variant.tweaks, speed: 0 };
    await page.evaluate(
      ({ s, id, label, axisLabel }) => {
        const out = document.getElementById("c");
        const ctx = out.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        const ribbon = document.createElement("canvas");
        ribbon.width = 1600;
        ribbon.height = 320;
        // eslint-disable-next-line no-undef
        TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, out.width, 96);
        ctx.drawImage(ribbon, 0, 96);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 48px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(id, 24, 68);
        ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(`${axisLabel} — ${label}`, 100, 58);
      },
      { s: settings, id: variant.id, label: variant.label, axisLabel: axis.label },
    );
    const outPath = resolve(outDir, `${axis.dir}-${variant.id}.png`);
    await page.locator("#c").screenshot({ path: outPath, type: "png" });
    // unlabeled ribbon-only still for judging
    await page.evaluate(
      ({ s }) => {
        const out = document.getElementById("c");
        const ctx = out.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, out.width, out.height);
        const ribbon = document.createElement("canvas");
        ribbon.width = 1600;
        ribbon.height = 320;
        // eslint-disable-next-line no-undef
        TwizzlerMod.renderTwizzler(ribbon, 1600, 320, 0, s);
        const y0 = Math.floor((out.height - 320) / 2);
        ctx.drawImage(ribbon, 0, y0);
      },
      { s: settings },
    );
    const cleanPath = resolve(outDir, `${axis.dir}-${variant.id}-clean.png`);
    await page.locator("#c").screenshot({ path: cleanPath, type: "png" });
    results.push({ ...variant, outPath, cleanPath, settings });
  }

  // Stack labeled A/B/C
  const stackHtml = results
    .map((r) => {
      const b64 = readFileSync(r.outPath).toString("base64");
      return `<img src="data:image/png;base64,${b64}" style="display:block;width:1600px;margin:0 0 8px"/>`;
    })
    .join("");
  await page.setViewportSize({ width: 1600, height: Math.min(8000, results.length * 424) });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${stackHtml}</body></html>`);
  const stackPath = resolve(outDir, `${axis.dir}-STACK.png`);
  await page.screenshot({ path: stackPath, type: "png", fullPage: true });

  // TARGET vs OURS compare for target-polish (and always when target exists for that axis)
  if (axisKey === "target-polish" && hasTarget) {
    await page.setViewportSize({ width: 1600, height: 1280 });
    const rows = [];
    const targetB64 = readFileSync(targetPath).toString("base64");
    rows.push(
      `<div style="color:#fff;font:600 28px ui-sans-serif;padding:12px 16px;background:#111">TARGET</div>
       <img src="data:image/png;base64,${targetB64}" style="display:block;width:1600px;background:#fff"/>`,
    );
    for (const r of results) {
      const b64 = readFileSync(r.cleanPath).toString("base64");
      rows.push(
        `<div style="color:#fff;font:600 28px ui-sans-serif;padding:12px 16px;background:#111">OURS ${r.id} — ${r.label}</div>
         <img src="data:image/png;base64,${b64}" style="display:block;width:1600px;background:#fff"/>`,
      );
    }
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:#0a0a0a">${rows.join("")}</body></html>`,
    );
    const comparePath = resolve(outDir, "target-polish-TARGET-vs-OURS.png");
    await page.screenshot({ path: comparePath, type: "png", fullPage: true });
    // also drop a copy at artifacts root for easy browse
    copyFileSync(comparePath, resolve(outRoot, "target-polish-TARGET-vs-OURS.png"));
  }

  // Convenience copies at artifacts root
  for (const r of results) {
    copyFileSync(r.outPath, resolve(outRoot, `${axis.dir}-${r.id}.png`));
  }
  copyFileSync(stackPath, resolve(outRoot, `${axis.dir}-STACK.png`));

  const axisManifest = {
    axis: axisKey,
    label: axis.label,
    stackPath,
    variants: results.map(({ id, label, outPath, cleanPath, tweaks }) => ({
      id,
      label,
      outPath,
      cleanPath,
      tweaks,
    })),
  };
  writeFileSync(resolve(outDir, `${axis.dir}-manifest.json`), JSON.stringify(axisManifest, null, 2));
  // also write into repo for branch commits (settings only — no absolute paths)
  const repoOut = resolve(root, "apps/lab/src/presets/builtin/handoff/variants", axis.dir);
  mkdirSync(repoOut, { recursive: true });
  writeFileSync(
    resolve(repoOut, "abc.json"),
    JSON.stringify(
      {
        axis: axisKey,
        label: axis.label,
        lockBBase: true,
        variants: axis.variants,
      },
      null,
      2,
    ),
  );
  manifest.axes[axisKey] = axisManifest;
  // restore canvas page for next axis
  await loadRenderPage();
}

await browser.close();
try {
  unlinkSync(bundlePath);
} catch {
  /* ignore */
}

writeFileSync(resolve(outRoot, "axes-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
