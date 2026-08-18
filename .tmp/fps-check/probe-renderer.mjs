import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({
  channel: "chrome",
  headless: false,
  args: ["--window-position=100,100", "--window-size=1400,900"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
await page.goto(url, { waitUntil: "networkidle" });

const out = await page.evaluate(async () => {
  const mod = await import("/src/playground/playgroundShaderSource.ts");
  const sampleMod = await import("/src/playground/samplePlaygroundFrame.ts");
  const r = new mod.PlaygroundShaderRenderer();
  const err = r.setSource(mod.DEFAULT_PLAYGROUND_SHADER_SOURCE);
  const transform = { fit: "stretch", zoom: 1, panX: 0, panY: 0 };

  const stats = (img) => {
    if (!img) return null;
    let sum = 0;
    let max = 0;
    for (let i = 0; i < img.data.length; i += 4) {
      const l = img.data[i] + img.data[i + 1] + img.data[i + 2];
      sum += l;
      max = Math.max(max, l);
    }
    return { w: img.width, h: img.height, avg: +(sum / (img.data.length / 4)).toFixed(1), max };
  };

  // Path A: big render first (like visible mode), then sample without re-render
  const c1 = document.createElement("canvas");
  const ctx1 = c1.getContext("2d", { willReadFrequently: true });
  r.resize(800, 450);
  r.setViewTransform(transform);
  r.render(1.0);
  const a = sampleMod.sampleShaderPlaygroundFrame(r, 242, 137, c1, ctx1, transform, 1.0, {
    renderBeforeSample: false,
  });

  // Path B: on-demand render at cell res (new skip path)
  const r2 = new mod.PlaygroundShaderRenderer();
  r2.setSource(mod.DEFAULT_PLAYGROUND_SHADER_SOURCE);
  const c2 = document.createElement("canvas");
  const ctx2 = c2.getContext("2d", { willReadFrequently: true });
  const b = sampleMod.sampleShaderPlaygroundFrame(r2, 242, 137, c2, ctx2, transform, 1.0, {
    renderBeforeSample: true,
  });

  return { compileErr: err, pathA: stats(a), pathB: stats(b) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
