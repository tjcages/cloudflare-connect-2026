import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const info = await page.evaluate(() => {
  const sel = '.playground-shader-leva-panel [class*="grzFYX"]:has(textarea)';
  const match = document.querySelector(sel);
  const cssLoaded = [...document.styleSheets].some((s) => {
    try {
      return [...s.cssRules].some((r) => r.cssText?.includes("playground-shader-leva-panel"));
    } catch {
      return false;
    }
  });
  return { selectorMatches: Boolean(match), cssLoaded };
});
console.log(JSON.stringify(info));
await browser.close();
