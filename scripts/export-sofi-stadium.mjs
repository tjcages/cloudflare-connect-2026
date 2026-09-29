/**
 * Export the SoFi Stadium layers as transparent, seamlessly looping ProRes 4444 videos.
 *
 * Needs the site dev server running (`pir dev:site`, or the `site` launch config).
 * Usage: node scripts/export-sofi-stadium.mjs [twizzler|rain|logo ...]
 *   --url http://localhost:4399   dev server origin
 *   --out exports/sofi-stadium    output folder
 *   --frames N                    render only the first N frames (smoke test)
 *
 * The page renders each frame deterministically (no real-time capture, so no
 * dropped frames) and POSTs its straight-alpha RGBA pixels here; they are piped
 * raw into ffmpeg.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: "http://localhost:4399" },
    out: { type: "string", default: "exports/sofi-stadium" },
    frames: { type: "string" },
  },
});
const layers = positionals.length ? positionals : ["twizzler", "rain", "logo"];
const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });

// One receiver for the whole run. Frames arrive up to IN_FLIGHT at a time and
// are written to the current layer's ffmpeg stdin strictly in frame order.
const IN_FLIGHT = 3;
let sink = null;
let pending = new Map();
let nextFrame = 0;
let onFrameWritten = () => {};
let flushing = Promise.resolve();
const flush = async () => {
  while (pending.has(nextFrame)) {
    const buffer = pending.get(nextFrame);
    pending.delete(nextFrame);
    if (!sink.write(buffer)) await new Promise((drained) => sink.once("drain", drained));
    nextFrame += 1;
    onFrameWritten(nextFrame);
  }
};
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  // Layer setup can idle past Node's keep-alive timeout; a reused dead socket fails the fetch.
  res.setHeader("Connection", "close");
  if (req.method === "OPTIONS") return res.end();
  const frame = Number(new URL(req.url, "http://x").searchParams.get("frame"));
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    // A retried frame may already be written; drop the duplicate.
    if (frame >= nextFrame) pending.set(frame, Buffer.concat(chunks));
    res.end();
    flushing = flushing.then(flush);
  });
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"],
});
const page = await browser.newPage();
page.on("pageerror", (error) => console.error(error));
page.on("console", (message) => message.type() === "warning" && console.warn(`\n${message.text()}`));
await page.goto(`${values.url}/connect/sofi-stadium/?export`);
await page.waitForFunction(() => window.sofiStadium);
const { FRAMES, EXPORT_WIDTH } = await page.evaluate(() => window.sofiStadium);
const frames = Math.min(FRAMES, Number(values.frames ?? FRAMES));
const width = EXPORT_WIDTH;
const height = width / 6;

for (const layer of layers) {
  const file = resolve(outDir, `sofi-stadium-${layer}-${width}x${height}-60fps.mov`);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      ...["-y", "-loglevel", "error"],
      ...["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${width}x${height}`, "-r", "60", "-i", "-"],
      // ProRes 4444 + alpha: the standard transparent master for playback servers and editors.
      // Hardware encoder (Apple silicon); prores_ks is identical in format but ~5× slower at 8K.
      ...["-c:v", "prores_videotoolbox", "-profile:v", "4444", "-pix_fmt", "yuva444p10le"],
      ...["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"],
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const finished = new Promise((done, fail) =>
    ffmpeg.on("close", (code) => (code === 0 ? done() : fail(new Error(`ffmpeg exited ${code}`)))),
  );
  sink = ffmpeg.stdin;
  pending = new Map();
  nextFrame = 0;
  const started = Date.now();
  const allWritten = new Promise((done) => {
    onFrameWritten = (written) => {
      if (written % 60 === 0 || written === frames) {
        const eta = ((Date.now() - started) / written) * (frames - written);
        process.stdout.write(`\r${layer}: ${written}/${frames} frames · ~${Math.round(eta / 1000)}s left   `);
      }
      if (written === frames) done();
    };
  });

  await page.evaluate(
    async ({ layer, width, frames, port, inFlight }) => {
      const source = window.sofiStadium.createLayer(layer, width);
      const context = source.canvas.getContext("2d");
      const requests = [];
      // A Blob body uploads ~4x faster than a typed array. Chrome occasionally
      // drops one of these 40 MB uploads under memory pressure: retry it.
      const send = async (frame, data) => {
        for (let attempt = 1; ; attempt += 1) {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/?frame=${frame}`, {
              method: "POST",
              body: new Blob([data]),
            });
            if (response.ok) return;
            throw new Error(`HTTP ${response.status}`);
          } catch (error) {
            if (attempt === 5) throw error;
            console.warn(`frame ${frame}: ${error} (retry ${attempt})`);
            await new Promise((wait) => setTimeout(wait, 1000 * attempt));
          }
        }
      };
      for (let frame = 0; frame < frames; frame += 1) {
        source.step();
        const { data } = context.getImageData(0, 0, source.canvas.width, source.canvas.height);
        requests.push(send(frame, data));
        if (requests.length >= inFlight) await requests.shift();
      }
      await Promise.all(requests);
      source.dispose();
    },
    { layer, width, frames, port, inFlight: IN_FLIGHT },
  );
  await allWritten;
  ffmpeg.stdin.end();
  await finished;
  console.log(`\n${layer}: ${file}`);
}

await browser.close();
server.close();
