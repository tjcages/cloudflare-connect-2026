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
  if (!t.includes("glCopySubTextureCHROMIUM")) console.log(`[${msg.type()}]`, t.slice(0, 220));
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
await page.waitForTimeout(2000);

const out = await page.evaluate(async () => {
  const perf = await import("/src/playground/playgroundPerfProfile.ts");
  return new Promise((resolve) => {
    const agg = {};
    let last = null;
    let ticks = 0;
    const start = performance.now();
    function loop() {
      const s = perf.getLastPlaygroundPerfSample();
      if (s && s !== last) {
        last = s;
        ticks++;
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === "number") agg[k] = Math.max(agg[k] ?? 0, v);
          else if (typeof v === "boolean") agg[k] = (agg[k] ?? false) || v;
        }
      }
      if (performance.now() - start < 3000) requestAnimationFrame(loop);
      else resolve({ ticks, agg });
    }
    requestAnimationFrame(loop);
  });
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
