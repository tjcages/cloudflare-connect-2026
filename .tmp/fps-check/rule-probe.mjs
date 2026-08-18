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
  if (!row) return "no row";
  const matching = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (rule.selectorText && rule.style?.gridTemplateColumns) {
        try {
          if (row.matches(rule.selectorText)) {
            matching.push({
              sel: rule.selectorText.slice(0, 100),
              gtc: rule.style.gridTemplateColumns,
              priority: rule.style.getPropertyPriority("grid-template-columns"),
            });
          }
        } catch {}
      }
    }
  }
  return { matching, inline: row.getAttribute("style") };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
