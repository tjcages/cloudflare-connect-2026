/**
 * Capture Connect 2 free-shard composite vs reference.
 * Always selects Connect 2 via the Shader dropdown (triggers preset reload).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const outDir = __dirname;
mkdirSync(outDir, { recursive: true });

const url = process.env.LAB_URL ?? "http://localhost:5174/";

const browser = await chromium.launch({
  headless: true,
  args: ["--use-angle=metal", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 400)));

await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const k of [...Array(localStorage.length)].map((_, i) => localStorage.key(i)).filter(Boolean)) {
    if (k.startsWith("stripes-engine-lab")) localStorage.removeItem(k);
  }
  sessionStorage.clear();
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);

const shaderSelect = page.locator("select").filter({ has: page.locator('option[value="connect2"]') }).first();
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => null),
  shaderSelect.selectOption("connect2"),
]);
await page.waitForTimeout(3500);

const status = await page.evaluate(() => {
  const ui = JSON.parse(localStorage.getItem("stripes-engine-lab-ui-settings") || "{}");
  const map = JSON.parse(localStorage.getItem("stripes-engine-lab-by-texture") || "{}");
  const cfg = map["shader:connect2"];
  const lab = window.__lab;
  const shards = typeof lab?.connect2Shards === "function" ? lab.connect2Shards() : [];
  return {
    preset: ui.shaderPresetId,
    shape: ui.connectShapeType,
    stripesEnabled: cfg?.stripesEnabled ?? null,
    shardCount: Array.isArray(shards) ? shards.length : 0,
    select: [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "connect2"))
      ?.value,
  };
});
console.log("status", JSON.stringify(status));

const raw = await page.evaluate(async () => {
  const mod = await import(`/src/connectShader/index.ts?t=${Date.now()}`);
  const params = mod.connectShaderParamDefaultsFor("connect2");
  const camera = mod.connectCameraDefaultsFor("connect2");
  const shape = mod.connectShapeDefaultsFor("connect2");
  const r = mod.createConnectTextureRenderer(1655, 817, shape, camera, params);
  let t = 0;
  for (let i = 0; i < 120; i++) {
    t += 1 / 30;
    r.render(t);
  }
  return {
    full: r.canvas.toDataURL("image/png"),
    underlay: r.underlayCanvas.toDataURL("image/png"),
    params: r.getParams(),
    camera: r.getCamera(),
    shape,
  };
});

writeFileSync(resolve(outDir, "raw-connect2.png"), Buffer.from(raw.full.split(",")[1], "base64"));
writeFileSync(resolve(outDir, "underlay-connect2.png"), Buffer.from(raw.underlay.split(",")[1], "base64"));
writeFileSync(
  resolve(outDir, "raw-meta.json"),
  JSON.stringify({ params: raw.params, camera: raw.camera, shape: raw.shape, status }, null, 2),
);

const underlay = page.locator("canvas.lab-canvas-connect-underlay");
const shards = page.locator("canvas.lab-canvas-connect-shards");
if ((await underlay.count()) > 0) {
  await underlay.first().screenshot({ path: resolve(outDir, "lab-underlay.png") });
}
if ((await shards.count()) > 0) {
  await shards.first().screenshot({ path: resolve(outDir, "lab-shards.png") });
}

// Native-resolution composite (underlay + shards) for fair 1:1 vs target.
const nativeComposite = await page.evaluate(() => {
  const under = document.querySelector("canvas.lab-canvas-connect-underlay");
  const shard = document.querySelector("canvas.lab-canvas-connect-shards");
  if (!(under instanceof HTMLCanvasElement)) return null;
  const w = under.width;
  const h = under.height;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(under, 0, 0);
  if (shard instanceof HTMLCanvasElement) ctx.drawImage(shard, 0, 0);
  return c.toDataURL("image/png");
});
if (nativeComposite) {
  writeFileSync(resolve(outDir, "lab-composite.png"), Buffer.from(nativeComposite.split(",")[1], "base64"));
} else {
  const stack = page.locator(".lab-canvas-stack");
  if ((await stack.count()) > 0) {
    const box = await stack.first().boundingBox();
    if (box) {
      await page.screenshot({
        path: resolve(outDir, "lab-composite.png"),
        clip: {
          x: Math.max(0, box.x - 4),
          y: Math.max(0, box.y - 4),
          width: box.width + 8,
          height: box.height + 8,
        },
      });
    }
  }
}

await page.screenshot({ path: resolve(outDir, "lab-full.png"), fullPage: false });

// Side-by-side vs target via browser canvas (no sharp dependency).
{
  const targetPath = resolve(root, "apps/lab/reference/connect-target.png");
  const compositePath = resolve(outDir, "lab-composite.png");
  const underlayPath = resolve(outDir, "underlay-connect2.png");
  const page2 = await browser.newPage({ viewport: { width: 2000, height: 900 } });
  const toData = (p) => "data:image/png;base64," + readFileSync(p).toString("base64");
  await page2.setContent(`<!doctype html><html><body style="margin:0;background:#1a1a1a;color:#eee;font:13px sans-serif">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px">
  <figure style="margin:0"><figcaption>underlay</figcaption><img src="${toData(underlayPath)}" style="width:100%;background:#fff"/></figure>
  <figure style="margin:0"><figcaption>lab</figcaption><img src="${toData(compositePath)}" style="width:100%;background:#fff"/></figure>
  <figure style="margin:0"><figcaption>target</figcaption><img src="${toData(targetPath)}" style="width:100%;background:#fff"/></figure>
</div></body></html>`);
  await page2.waitForTimeout(250);
  await page2.screenshot({ path: resolve(outDir, "side-by-side-shards.png"), fullPage: true });
  await page2.close();
  console.log("wrote side-by-side-shards.png");
}

console.log("captured", { shardCount: status.shardCount, stripesEnabled: status.stripesEnabled });
await browser.close();
