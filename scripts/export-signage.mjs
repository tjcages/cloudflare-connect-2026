/**
 * Export a signage day as a seamless 40s ProRes loop at the venue's native 7200x1620, 60 fps.
 *
 * Needs the site dev server running (`site` launch config, port 4399).
 * Usage: node scripts/export-signage.mjs [--day monday|tuesday|wednesday]
 *   --url http://localhost:4399   dev server origin
 *   --out exports/signage         output folder
 *   --profile hq                  ProRes profile: 4444 (~15 GB), hq (~12 GB), standard, lt, proxy
 *   --frames N                    render only the first N frames (smoke test)
 *
 * The loop starts after the intro, with the text settled, and plays one sweep
 * every 20s: left to right at 1s, right to left at 21s. Time is virtual
 * (Playwright's fake clock), so every frame is rendered, never captured live.
 * Background (Twizzler + rain) is rendered offline in the page; the white
 * cards, title and logo are DOM screenshots, taken only while a sweep changes
 * them. Each composited frame is POSTed here and piped raw into ffmpeg.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values } = parseArgs({
  options: {
    day: { type: "string", default: "monday" },
    url: { type: "string", default: "http://localhost:4399" },
    out: { type: "string", default: "exports/signage" },
    profile: { type: "string", default: "hq" },
    frames: { type: "string" },
  },
});
const FPS = 60;
const WIDTH = 7200;
const HEIGHT = 1620;
const CSS_WIDTH = 1800;
/** Sweep start frames (1s, 21s) and how long the text layer keeps changing after each (2.4s title + margin). */
const SWEEPS = [FPS, 21 * FPS];
const SWEEP_FRAMES = 190;
const outDir = resolve(values.out);
mkdirSync(outDir, { recursive: true });

let sink;
let overlay = Buffer.alloc(0);
const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Connection", "close");
  if (req.method === "OPTIONS") return res.end();
  if (req.method === "GET") return res.setHeader("Content-Type", "image/png"), res.end(overlay);
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", async () => {
    if (!sink.write(Buffer.concat(chunks))) await new Promise((drained) => sink.once("drain", drained));
    res.end();
  });
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const port = server.address().port;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"],
});
const context = await browser.newContext({
  viewport: { width: CSS_WIDTH, height: HEIGHT / (WIDTH / CSS_WIDTH) },
  deviceScaleFactor: WIDTH / CSS_WIDTH,
});
const page = await context.newPage();
page.on("pageerror", (error) => console.error(error));
page.on("console", (message) => message.type() === "warning" && console.warn(`\n${message.text()}`));
await page.clock.install({ time: 0 });
await page.goto(`${values.url}/connect/signage/?export&day=${values.day}`);
while (!(await page.evaluate(() => Boolean(window.signageExport)))) await new Promise((wait) => setTimeout(wait, 200));
await page.evaluate(() => document.fonts.ready);
await new Promise((wait) => setTimeout(wait, 1500)); // real-time CSS blur-in
// The intro's animation timer stalls under the fake clock, so skip it: a replay cycle
// (same as the live sign's later sweeps) rebuilds the text settled, then tick until it is static.
await page.clock.pauseAt(10_000);
await page.evaluate(() => window.signageExport.setCycle(1));
await new Promise((wait) => setTimeout(wait, 100));
await page.clock.runFor(6000);

const total = Number(values.frames ?? (await page.evaluate(() => window.signageExport.FRAMES)));
const file = resolve(outDir, `signage-${values.day}-${WIDTH}x${HEIGHT}-60fps-prores-${values.profile}.mov`);
const ffmpeg = spawn(
  "ffmpeg",
  [
    ...["-y", "-loglevel", "error"],
    ...["-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${WIDTH}x${HEIGHT}`, "-r", String(FPS), "-i", "-"],
    // RGB -> BT.709 limited-range 10-bit.
    ...["-vf", `scale=out_color_matrix=bt709:out_range=tv,format=${values.profile === "4444" ? "p410le" : "p210le"}`],
    // Hardware ProRes (Apple silicon); prores_ks is identical in format but far slower at this size.
    ...["-c:v", "prores_videotoolbox", "-profile:v", values.profile],
    ...["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"],
    file,
  ],
  { stdio: ["pipe", "inherit", "inherit"] },
);
const finished = new Promise((done, fail) =>
  ffmpeg.on("close", (code) => (code === 0 ? done() : fail(new Error(`ffmpeg exited ${code}`)))),
);
sink = ffmpeg.stdin;

const shoot = async () => (overlay = await page.screenshot({ type: "png", omitBackground: true }));
const started = Date.now();
let settled = await shoot();
for (let tries = 0; ; tries += 1) {
  await page.clock.runFor(1000);
  const next = await shoot();
  if (next.equals(settled)) break;
  if (tries === 20) throw new Error("text layer never settled");
  settled = next;
}
let fetchOverlay = true;
for (let frame = 0; frame < total; frame += 1) {
  if (frame > 0) {
    const step = Math.round((frame * 1000) / FPS) - Math.round(((frame - 1) * 1000) / FPS);
    await page.clock.runFor(step);
  }
  const sweep = SWEEPS.findIndex((start) => frame === start);
  if (sweep >= 0) {
    // Cycle 2 sweeps left to right, 3 right to left (even/odd, as on the live sign).
    await page.evaluate((cycle) => window.signageExport.setCycle(cycle), 2 + sweep);
    await new Promise((wait) => setTimeout(wait, 100));
  }
  if (SWEEPS.some((start) => frame >= start && frame < start + SWEEP_FRAMES)) {
    await shoot();
    fetchOverlay = true;
  }
  await page.evaluate((args) => window.signageExport.renderFrame(args), { frame, port, fetchOverlay });
  fetchOverlay = false;
  if ((frame + 1) % 60 === 0 || frame + 1 === total) {
    const eta = ((Date.now() - started) / (frame + 1)) * (total - frame - 1);
    process.stdout.write(`\r${frame + 1}/${total} frames · ~${Math.round(eta / 60000)} min left   `);
  }
}
// The text must be back to its starting pixels, or the loop seam would jump.
if (total === 2400 && !(await shoot()).equals(settled)) console.warn("\nWARNING: text layer differs from frame 0; loop seam is not clean");
ffmpeg.stdin.end();
await finished;
console.log(`\n${file}`);
await browser.close();
server.close();
