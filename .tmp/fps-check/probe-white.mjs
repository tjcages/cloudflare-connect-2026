import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-position=100,100", "--window-size=1400,900"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
page.on("console", (msg) => {
  const t = msg.text();
  if (msg.type() === "error" || t.includes("[playground]")) console.log("[console]", t.slice(0, 200));
});
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  const cfg = p.defaultConfigForTexture("shader");
  cfg.displayWidth = 1696;
  cfg.displayHeight = 960;
  delete cfg.shaderSource;
  p.savePersistedConfig("shader", cfg);
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(3500);

const info = await page.evaluate(async () => {
  const perf = await import("/src/playground/playgroundPerfProfile.ts");
  const s = perf.getLastPlaygroundPerfSample();
  const dbg = window.__PG_DEBUG__ ?? null;
  const canvases = [...document.querySelectorAll("canvas")].map((c) => ({
    w: c.width,
    h: c.height,
    cls: c.className,
    parent: c.parentElement?.className ?? "",
  }));
  // read center pixels of the biggest canvas via 2d copy
  const big = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.width - a.width * a.width)[0];
  let px = null;
  if (big) {
    const c2 = document.createElement("canvas");
    c2.width = 8;
    c2.height = 8;
    const ctx = c2.getContext("2d");
    ctx.drawImage(big, big.width / 2 - 4, big.height / 2 - 4, 8, 8, 0, 0, 8, 8);
    px = [...ctx.getImageData(0, 0, 2, 2).data];
  }
  return { perfSample: s, dbg, canvases, px };
});
console.log(JSON.stringify(info, null, 1).slice(0, 2500));
await browser.close();
