import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const expected = JSON.parse(readFileSync("/home/user/cloudflare-connect-2026/expected-rain.tmp.json", "utf8"));
const out = "/tmp/claude-0/-home-user-cloudflare-connect-2026/4100dfc9-3721-517a-82f2-9eb69cf23750/scratchpad";

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));

await page.addInitScript(() => {
  localStorage.setItem("connect:twizzler-controls-visible", "true");
  localStorage.setItem("connect:shader-controls-target", "rain");
});

await page.goto("http://localhost:4321/connect", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const persisted = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("panels:connect-hero-rain-v1") ?? "null")
);

const glslNorm = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
const diffs = [];
for (const key of Object.keys(expected)) {
  const a = expected[key];
  const b = persisted?.[key];
  if (key === "sourceGlsl") {
    if (glslNorm(a) !== glslNorm(b)) diffs.push(`${key}: GLSL differs`);
  } else if (key === "stripes") {
    const norm = (rows) => rows.map((r) => `${r.color}:${r.startFrom}:${r.width}:${r.opacity}`).join("|");
    if (norm(a) !== norm(b)) diffs.push(`${key}: ${norm(b)}`);
  } else if (typeof a === "number") {
    if (Math.abs(a - b) > 1e-9) diffs.push(`${key}: expected ${a}, got ${b}`);
  } else if (a !== b) {
    diffs.push(`${key}: expected ${JSON.stringify(a)}, got ${JSON.stringify(b)}`);
  }
}
console.log("diffs:", diffs.length ? diffs : "none — defaults match the authored config");

// Check the mask reflects offset 23 / height 34.
const mask = await page.evaluate(
  () => document.querySelector("[data-connect-twizzler-ready]")?.parentElement?.style.maskImage
);
console.log("mask:", mask);
await page.waitForTimeout(20000);
await page.screenshot({ path: `${out}/hero-final-defaults.png`, clip: { x: 0, y: 0, width: 1060, height: 760 } });
console.log("console errors:", errors.length ? errors : "none");
await browser.close();
