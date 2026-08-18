import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5183/playground";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(url, { waitUntil: "networkidle" });
await page.getByTestId("playground-leva-panel").waitFor({ timeout: 30000 }).catch(() => {});

await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.getByTestId("playground-leva-panel").waitFor({ timeout: 30000 });
await page.waitForTimeout(800);

const btn = page.getByTestId("playground-top-upload-button");
const box = (await btn.count()) ? await btn.first().boundingBox() : null;
const aboveFold = box ? box.y + box.height <= 900 : false;

await page.getByTestId("playground-leva-panel").screenshot({ path: ".tmp/upload-check/sidebar-with-top-button.png" });

// Drive an upload through the new top button (it triggers the hidden file input).
await page.evaluate(() => {
  document.querySelector('[data-testid="playground-top-upload-button"]').click();
});
await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, "#001133");
  g.addColorStop(1, "#ffee88");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "top-btn-upload.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await page.waitForTimeout(2500);

const after = await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  return p.loadPlaygroundEnvelope().lastTextureId;
});
const errorVisible = await page.getByText(/could not be decoded|not recognized/i).count();

console.log(
  JSON.stringify(
    { topButtonBox: box, aboveFold, switchedToUpload: after.startsWith("upload:"), errorVisible, errs: errs.slice(0, 5) },
    null,
    2,
  ),
);
await browser.close();
