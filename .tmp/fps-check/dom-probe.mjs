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
  if (!ta) return "no textarea";
  const chain = [];
  let el = ta;
  for (let i = 0; i < 6 && el; i++) {
    chain.push({
      tag: el.tagName,
      cls: el.className?.toString().slice(0, 80),
      display: getComputedStyle(el).display,
      gtc: getComputedStyle(el).gridTemplateColumns?.slice(0, 60),
    });
    el = el.parentElement;
  }
  return chain;
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
