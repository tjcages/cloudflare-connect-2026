import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 200)));
await page.goto(url, { waitUntil: "networkidle" });

// Raw ribbons render
const dataUrl = await page.evaluate(async () => {
  const mod = await import("/src/playground/playgroundShaderSource.ts");
  const r = new mod.PlaygroundShaderRenderer();
  const compile = r.setSource(mod.RIBBONS_PLAYGROUND_SHADER_SOURCE);
  if (!compile.ok) return "ERR:" + compile.error;
  r.resize(800, 450);
  r.setViewTransform({ fit: "stretch", zoom: 1, panX: 0, panY: 0 });
  r.render(3.0);
  const img = r.readNativeImageData();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d").putImageData(img, 0, 0);
  return c.toDataURL("image/png");
});
if (dataUrl.startsWith("ERR:")) {
  console.log("ribbons compile error:", dataUrl.slice(0, 300));
  process.exit(1);
}
writeFileSync("ribbons-widths.png", Buffer.from(dataUrl.split(",")[1], "base64"));
console.log("ribbons compile ok");

// Panel layout with shader selected
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
await page.waitForTimeout(2500);
const panel = page.locator("[data-testid='playground-shader-leva-panel']");
await panel.screenshot({ path: "shader-panel.png" });
const compileFieldCount = await page.locator("text=Compile error").count();
console.log("compile error fields visible:", compileFieldCount);
await browser.close();
