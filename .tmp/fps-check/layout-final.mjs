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
  const ta = document.querySelector("[data-testid='playground-shader-leva-panel'] textarea");
  const row = ta?.closest('[class*="grzFYX"]');
  return {
    rowGtc: row ? getComputedStyle(row).gridTemplateColumns : null,
    taWidth: ta ? Math.round(ta.getBoundingClientRect().width) : null,
    rowWidth: row ? Math.round(row.getBoundingClientRect().width) : null,
  };
});
console.log(JSON.stringify(info));
await page.locator("[data-testid='playground-shader-leva-panel']").screenshot({ path: "shader-panel2.png" });
await browser.close();
