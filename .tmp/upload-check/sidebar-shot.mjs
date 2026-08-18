import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5183/playground";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });

await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const sidebar = page.getByTestId("playground-leva-panel");
await sidebar.screenshot({ path: ".tmp/upload-check/sidebar.png" });

const uploadBtn = page.getByRole("button", { name: /upload texture/i });
const info = {
  uploadButtonCount: await uploadBtn.count(),
  uploadButtonVisible: (await uploadBtn.count()) ? await uploadBtn.first().isVisible() : false,
  workflowControlsCount: await page.getByTestId("playground-workflow-controls").count(),
};
const box = (await uploadBtn.count()) ? await uploadBtn.first().boundingBox() : null;
info.uploadButtonBox = box;
console.log(JSON.stringify(info, null, 2));

await browser.close();
