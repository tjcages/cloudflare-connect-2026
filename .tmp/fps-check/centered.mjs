import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const tweak = (amp, base, contrast, ripple) => `
const float AMPLITUDE = ${amp};
const float FREQUENCY = 2.9;
const float SPEED     = 1.;
const float DETAIL    = 5.;
const float RIPPLE    = ${ripple};
const float BASELINE  = ${base};
const float CONTRAST  = ${contrast};
const vec4  PHASE     = vec4(0, 2, 4, 0);

void mainImage(out vec4 O, vec2 I)
{
    vec2 uv = (I + I - iResolution.xy) / iResolution.y;
    float t = iTime * SPEED;
    float y = 0., a = AMPLITUDE, f = FREQUENCY;
    for (float d = 1.; d <= DETAIL; d++)
    {
        y += a * cos(uv.x * f + 2. * t * cos(d)) / d;
        f += f;
    }
    float depth = abs(y) + BASELINE - abs(uv.y);
    depth += RIPPLE * cos(uv.x * 5. - t + depth * 6.) * depth;
    O = (cos(depth + t * .2 + PHASE) + 1.3) * max(depth * CONTRAST, 0.);
    O = tanh(O * O);
}`;

const candidates = [
  { name: "a-soft", src: tweak(".35", ".12", "2.2", ".12") },
  { name: "b-tall", src: tweak(".55", ".08", "2.5", ".12") },
  { name: "c-calm", src: tweak(".35", ".2", "1.8", ".08") },
];

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle" });

for (const cand of candidates) {
  const dataUrl = await page.evaluate(async (src) => {
    const mod = await import("/src/playground/playgroundShaderSource.ts");
    const r = new mod.PlaygroundShaderRenderer();
    const compile = r.setSource(src);
    if (!compile.ok) return "ERR:" + compile.error;
    r.resize(800, 450);
    r.setViewTransform({ fit: "stretch", zoom: 1, panX: 0, panY: 0 });
    r.render(4.2);
    const img = r.readNativeImageData();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    c.getContext("2d").putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }, cand.src);
  if (dataUrl.startsWith("ERR:")) {
    console.log(cand.name, dataUrl);
    continue;
  }
  writeFileSync(`centered-${cand.name}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(cand.name, "ok");
}
await browser.close();
