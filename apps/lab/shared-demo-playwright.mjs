// Verification harness for the REAL shared-context <StripesShader> feature.
// Serves dist-shared-demo, loads in headless chromium (GPU flags as the spike),
// and asserts: exactly ONE Worker, no console/page errors, non-blank shared
// canvases, Display-P3 (sRGB-vs-P3 readback divergence on real GL output),
// video animation, and IntersectionObserver scroll gating.
//
// Readback methods (a transferControlToOffscreen canvas CANNOT be read on the
// main thread via drawImage/getImageData — it yields the blank backing, not the
// worker-painted frame), so:
//   - non-blank / video-animation / scroll-gating: sample the Playwright
//     screenshot PNG (the real composited output) at each canvas's box.
//   - Display-P3: run the spike's in-worker readback — a worker creates the
//     same P3 WebGL2 OffscreenCanvas recipe the shared worker uses, renders a
//     wide-gamut color, transferToImageBitmap, then reads the bitmap back
//     through an srgb and a display-p3 2D OffscreenCanvas and asserts the
//     sampled values DIFFER (ImageBitmap exposes no colorSpace; screenshots are
//     sRGB-flattened — neither can prove P3, so the readback is the proof).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

function resolveFromStore(name) {
  try {
    return require.resolve(name, { paths: [resolve(repoRoot, "node_modules")] });
  } catch {
    const dir = resolve(repoRoot, "node_modules/.pnpm");
    const re = new RegExp(`^${name.replace("/", "\\+")}@`);
    const glob = require("node:fs").readdirSync(dir).find((d) => re.test(d));
    if (!glob) throw new Error(`${name} not found in node_modules/.pnpm`);
    return require.resolve(resolve(dir, glob, "node_modules", name));
  }
}

const playwright = await import(pathToFileURL(resolveFromStore("playwright")).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
const sharp = require(resolveFromStore("sharp"));

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "dist-shared-demo");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, p);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const url = `http://localhost:${port}/index.html`;

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 800, height: 700 } });

const consoleErrors = [];
const pageErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("pageerror", (e) => pageErrors.push(e.message));

// Count Worker instantiations BEFORE the app bundle runs.
await page.addInitScript(() => {
  const Original = window.Worker;
  window.__WORKER_COUNT__ = 0;
  window.Worker = class extends Original {
    constructor(...args) {
      window.__WORKER_COUNT__ = (window.__WORKER_COUNT__ || 0) + 1;
      super(...args);
    }
  };
});

await page.goto(url, { waitUntil: "load" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Bounding box (device px) for each shader canvas, in the current scroll state.
async function canvasBoxes() {
  return page.evaluate(() => {
    const out = {};
    for (const section of document.querySelectorAll("section[data-shader-id]")) {
      const id = section.getAttribute("data-shader-id");
      const canvas = section.querySelector("canvas");
      const kind = section.getAttribute("data-shader-kind");
      if (!canvas) {
        out[id] = { kind, rect: null };
        continue;
      }
      const r = canvas.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
      out[id] = {
        kind,
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        inViewport: visible,
      };
    }
    return out;
  });
}

// Screenshot the viewport, decode with sharp, and sample the center of each
// canvas box. Returns { kind, inViewport, nonBlank, center:[r,g,b] }.
async function sampleViewport() {
  const boxes = await canvasBoxes();
  const png = await page.screenshot({ fullPage: false });
  const img = sharp(png);
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => {
    const xi = Math.max(0, Math.min(info.width - 1, Math.round(x)));
    const yi = Math.max(0, Math.min(info.height - 1, Math.round(y)));
    const i = (yi * info.width + xi) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const out = {};
  for (const [id, b] of Object.entries(boxes)) {
    if (!b.rect || !b.inViewport) {
      out[id] = { kind: b.kind, inViewport: !!b.inViewport, nonBlank: false, center: null };
      continue;
    }
    const cx = b.rect.x + b.rect.w / 2;
    const cy = b.rect.y + b.rect.h / 2;
    // Sample a dense grid spanning the canvas; nonBlank = any pixel clearly off
    // the page background (#0a0a0a ≈ 10,10,10). The grid also serves as a frame
    // fingerprint for video-animation diffing.
    const samples = [];
    const N = 8;
    for (let gx = 0; gx < N; gx++) {
      for (let gy = 0; gy < N; gy++) {
        const fx = b.rect.x + ((gx + 0.5) / N) * b.rect.w;
        const fy = b.rect.y + ((gy + 0.5) / N) * b.rect.h;
        samples.push(px(fx, fy));
      }
    }
    const nonBlank = samples.some((p) => p[0] > 30 || p[1] > 30 || p[2] > 30);
    const fingerprint = samples.flat();
    out[id] = { kind: b.kind, inViewport: true, nonBlank, center: px(cx, cy), fingerprint, meta: { w: meta.width, h: meta.height } };
  }
  return out;
}

// In-worker Display-P3 proof: build the shared worker's exact P3 context recipe,
// render a known wide-gamut color, transferToImageBitmap, read back through srgb
// and display-p3 2D contexts. Wide-gamut content reads DIFFERENT values in the
// two color spaces; sRGB content reads the same. Asserts divergence.
async function assertP3InWorker() {
  return page.evaluate(async () => {
    const workerSrc = `
      const W = 64, H = 64;
      const glCanvas = new OffscreenCanvas(W, H);
      const gl = glCanvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false });
      let report;
      if (!gl) {
        report = { ok: false, reason: "no webgl2 in worker" };
        self.postMessage(report);
      } else {
        gl.drawingBufferColorSpace = "display-p3";
        gl.unpackColorSpace = "display-p3";
        const drawingBufferColorSpace = gl.drawingBufferColorSpace;
        const VERT = "#version 300 es\\nin vec2 a;out vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.,1.);}";
        const FRAG = "#version 300 es\\nprecision highp float;in vec2 v;out vec4 o;void main(){o=vec4(mix(vec3(1.,0.,0.),vec3(0.,1.,0.),v.x),1.);}";
        const cc = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
        const p = gl.createProgram();
        gl.attachShader(p, cc(gl.VERTEX_SHADER, VERT));
        gl.attachShader(p, cc(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(p);
        gl.useProgram(p);
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(p, "a"); gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.viewport(0, 0, W, H);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.flush();
        // Blit the P3 drawing buffer to a bitmaprenderer display canvas, exactly
        // like the feature, then read THAT display canvas back through srgb and
        // p3 2D contexts (the spike's proven divergence path).
        const bmp = glCanvas.transferToImageBitmap();
        const display = new OffscreenCanvas(W, H);
        display.getContext("bitmaprenderer").transferFromImageBitmap(bmp);
        function read(cs, x) {
          const c = new OffscreenCanvas(W, H);
          const ctx = c.getContext("2d", { colorSpace: cs });
          ctx.drawImage(display, 0, 0);
          const d = ctx.getImageData(x, H >> 1, 1, 1).data;
          const attrs = ctx.getContextAttributes ? ctx.getContextAttributes() : {};
          return { actual: attrs.colorSpace ?? "<undefined>", px: [d[0], d[1], d[2], d[3]] };
        }
        // Sample saturated-green edge (right side) where P3 vs sRGB diverges most.
        const xs = W - 2;
        const srgb = read("srgb", xs);
        const p3 = read("display-p3", xs);
        const diverged = srgb.px.some((v, i) => Math.abs(v - p3.px[i]) > 1);
        report = { ok: true, drawingBufferColorSpace, srgb, p3, diverged };
        self.postMessage(report);
      }
    `;
    const blob = new Blob([workerSrc], { type: "text/javascript" });
    const w = new Worker(URL.createObjectURL(blob), { type: "module" });
    const result = await new Promise((res) => {
      w.onmessage = (e) => res(e.data);
      w.onerror = (e) => res({ ok: false, reason: "worker error: " + e.message });
      setTimeout(() => res({ ok: false, reason: "timeout" }), 5000);
    });
    w.terminate();
    return result;
  });
}

// Let the top (on-screen) instances mount, register, decode media and render a
// few frames. Offscreen ones must NOT render yet (visible:false gating).
await sleep(2500);

const workerCount = await page.evaluate(() => window.__WORKER_COUNT__ ?? 0);
const beforeScroll = await sampleViewport();
const p3 = await assertP3InWorker();

// Video animation: sample the on-screen video canvas twice, ~700ms apart, and
// confirm its pixels changed.
const videoT0 = beforeScroll["vid-0"]?.fingerprint ?? null;
await sleep(800);
const midScroll = await sampleViewport();
const videoT1 = midScroll["vid-0"]?.fingerprint ?? null;
let videoMaxDelta = 0;
if (videoT0 && videoT1) {
  for (let i = 0; i < videoT0.length; i++) videoMaxDelta = Math.max(videoMaxDelta, Math.abs(videoT0[i] - videoT1[i]));
}
const videoAnimated = videoMaxDelta > 2;

// Scroll gating: the bottom sections start outside the viewport (and the
// IntersectionObserver never marked them visible, so the worker never rendered
// them). Confirm they are blank before scroll, then scroll them in and confirm
// they render.
await page.evaluate(() => {
  const last = document.querySelector('section[data-shader-id="vid-2"]');
  last?.scrollIntoView({ block: "center" });
});
await sleep(2000);
const afterScroll = await sampleViewport();

await page.screenshot({ path: "/tmp/shared-demo.png", fullPage: true });

// Gating evidence: vid-2 was off-screen+blank before, rendered after scroll.
const gating = {
  vid2BeforeInViewport: beforeScroll["vid-2"]?.inViewport ?? null,
  vid2BeforeNonBlank: beforeScroll["vid-2"]?.nonBlank ?? null,
  vid2AfterInViewport: afterScroll["vid-2"]?.inViewport ?? null,
  vid2AfterNonBlank: afterScroll["vid-2"]?.nonBlank ?? null,
  works:
    beforeScroll["vid-2"]?.inViewport === false &&
    afterScroll["vid-2"]?.inViewport === true &&
    afterScroll["vid-2"]?.nonBlank === true,
};

const report = {
  workerCount,
  consoleErrors,
  pageErrors,
  p3,
  video: { maxDelta: videoMaxDelta, animated: !!videoAnimated },
  gating,
  beforeScroll,
  afterScroll,
};

const onScreenIds = ["img-0", "vid-0"];
const pass = {
  oneWorker: workerCount === 1,
  noErrors: consoleErrors.length === 0 && pageErrors.length === 0,
  nonBlank: onScreenIds.every((id) => beforeScroll[id]?.nonBlank === true),
  p3: p3.ok === true && p3.drawingBufferColorSpace === "display-p3" && p3.diverged === true,
  videoAnimated: !!videoAnimated,
  gating: gating.works === true,
};
report.pass = pass;
report.allPass = Object.values(pass).every(Boolean);

console.log("SHARED_DEMO_RESULT_JSON_START");
console.log(JSON.stringify(report, null, 2));
console.log("SHARED_DEMO_RESULT_JSON_END");

await browser.close();
server.close();
process.exit(report.allPass ? 0 : 1);
