/**
 * Export the Hub signage as seamlessly looping 20-second H.265 videos, one per day.
 *
 * Needs the site dev server running (`pir dev:site`, or the `site` launch config).
 * Usage: node scripts/export-signage.mjs [monday|tuesday|wednesday ...]
 *   --url http://localhost:4399   dev server origin
 *   --out ~/Downloads             output folder
 *   --frames N                    render only the first N frames (smoke test)
 *
 * Each frame renders deterministically: the shader layers step one frame and a
 * fake page clock advances the text animations by exactly 1/60 s before a
 * full-resolution screenshot is piped into ffmpeg. Frame 0 starts a text sweep,
 * so every loop seam replays it.
 */
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    url: { type: "string", default: "http://localhost:4399" },
    out: { type: "string", default: resolve(homedir(), "Downloads") },
    frames: { type: "string" },
  },
});
const days = positionals.length ? positionals : ["monday", "tuesday", "wednesday"];
const outDir = resolve(values.out.replace(/^~/, homedir()));
mkdirSync(outDir, { recursive: true });

// Native LED raster (apps/site/.../signage/README.md): 7200 × 1620, 40:9.
const WIDTH = 7200;
const HEIGHT = 1620;
const CSS_WIDTH = 1920;
const FPS = 60;

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"],
});

for (const day of days) {
  const page = await browser.newPage({
    viewport: { width: CSS_WIDTH, height: (CSS_WIDTH * HEIGHT) / WIDTH },
    deviceScaleFactor: WIDTH / CSS_WIDTH,
  });
  page.on("pageerror", (error) => console.error(error));
  await page.clock.install();
  await page.goto(`${values.url}/connect/signage/?export&day=${day}`);
  await page.waitForFunction(() => window.signageExport);
  await page.evaluate(() => document.fonts.ready);
  // From here, page time only moves when the exporter advances it.
  await page.clock.pauseAt(Date.now() + 1000);
  // Let the page entrance and first text sweep settle (fake clock), and the CSS fade (real time).
  await page.clock.runFor(10_000);
  await page.waitForTimeout(600);
  const total = await page.evaluate(() => window.signageExport.frames);
  const frames = Math.min(total, Number(values.frames ?? total));

  const file = resolve(outDir, `${day}-hub-signage-${WIDTH}x${HEIGHT}-${FPS}fps-20s.mp4`);
  const ffmpeg = spawn(
    "ffmpeg",
    [
      ...["-y", "-loglevel", "error"],
      ...["-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "-"],
      // Convert with the BT.709 matrix the file is tagged with (swscale defaults to
      // BT.601, which shifts the orange and the sponsor blue).
      ...["-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int"],
      // 10-bit HEVC keeps the white veil and shader gradients free of banding.
      ...["-c:v", "libx265", "-preset", "medium", "-crf", "12", "-pix_fmt", "yuv420p10le"],
      ...["-x265-params", "log-level=error", "-tag:v", "hvc1", "-movflags", "+faststart"],
      // Screenshots are sRGB: tag the sRGB curve so QuickTime matches the browser.
      ...["-color_primaries", "bt709", "-color_trc", "iec61966-2-1", "-colorspace", "bt709"],
      file,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const finished = new Promise((done, fail) =>
    ffmpeg.on("close", (code) => (code === 0 ? done() : fail(new Error(`ffmpeg exited ${code}`)))),
  );

  await page.evaluate(() => window.signageExport.replay());
  // The sweep starts after React commits and fonts resolve (microtasks, real time).
  await page.waitForTimeout(300);
  const started = Date.now();
  let reported = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    await page.evaluate(() => window.signageExport.step());
    const png = await page.screenshot({ type: "png", scale: "device" });
    if (!ffmpeg.stdin.write(png)) {
      await new Promise((drained) => ffmpeg.stdin.once("drain", drained));
    }
    await page.clock.runFor(1000 / FPS);
    if (Date.now() - reported >= 5000 || frame + 1 === frames) {
      reported = Date.now();
      const eta = ((Date.now() - started) / (frame + 1)) * (frames - frame - 1);
      const filled = Math.round(((frame + 1) / frames) * 30);
      const bar = "█".repeat(filled) + "░".repeat(30 - filled);
      const percent = Math.round(((frame + 1) / frames) * 100);
      process.stdout.write(
        `\r${day} ${bar} ${percent}% · ${frame + 1}/${frames} frames · ~${Math.round(eta / 1000)}s left   `,
      );
    }
  }
  ffmpeg.stdin.end();
  await finished;
  await page.close();
  console.log(`\n${day}: ${file}`);
}

await browser.close();
