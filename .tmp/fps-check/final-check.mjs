import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });

// Raw shader output of the real default source at two timestamps
for (const t of [1.5, 4.2]) {
  const dataUrl = await page.evaluate(async (time) => {
    const mod = await import("/src/playground/playgroundShaderSource.ts");
    const r = new mod.PlaygroundShaderRenderer();
    const compile = r.setSource(mod.DEFAULT_PLAYGROUND_SHADER_SOURCE);
    if (!compile.ok) return "ERR:" + compile.error;
    r.resize(800, 450);
    r.setViewTransform({ fit: "stretch", zoom: 1, panX: 0, panY: 0 });
    r.render(time);
    const img = r.readNativeImageData();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }, t);
  if (dataUrl.startsWith("ERR:")) {
    console.log("compile error:", dataUrl);
    process.exit(1);
  }
  writeFileSync(`final-raw-t${t}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
}
console.log("raw renders ok");

// Full scene with stripes using the new default
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
await page.waitForTimeout(3000);
const fps = await page.evaluate(
  () =>
    new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function loop() {
        frames++;
        const elapsed = performance.now() - start;
        if (elapsed < 3000) requestAnimationFrame(loop);
        else resolve(+(frames / (elapsed / 1000)).toFixed(1));
      }
      requestAnimationFrame(loop);
    }),
);
await page.locator("canvas").first().screenshot({ path: "final-scene.png" });
console.log("scene fps:", fps);
await browser.close();
