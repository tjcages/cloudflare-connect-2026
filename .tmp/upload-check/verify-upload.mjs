import { chromium } from "playwright";

const url = process.env.PLAYGROUND_URL ?? "http://localhost:5180/playground";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});

await page.goto(url, { waitUntil: "networkidle" });

// Start from the shader, like a user who is "on this shader".
await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  p.saveLastTextureId("shader");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const before = await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  return p.loadPlaygroundEnvelope().lastTextureId;
});

// Inject a distinctive PNG into the hidden file input, exactly as a real upload would.
await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 256, 256);
  g.addColorStop(0, "#000000");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#ff0000";
  ctx.fillRect(96, 96, 64, 64);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "verify-upload.png", { type: "image/png" });
  const dt = new DataTransfer();
  dt.items.add(file);
  const input = document.querySelector('input[type="file"]');
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
});

await page.waitForTimeout(2500);

const after = await page.evaluate(async () => {
  const p = await import("/src/playground/playgroundPersistence.ts");
  const env = p.loadPlaygroundEnvelope();
  return {
    lastTextureId: env.lastTextureId,
    uploadCount: env.uploads.length,
    uploadKinds: env.uploads.map((u) => u.mediaKind),
  };
});

const errorVisible = await page
  .getByText(/could not be decoded|not recognized|no usable pixel size/i)
  .count();

const canvas = page.getByTestId("playground-texture-canvas");
const canvasCount = await canvas.count();
let nonBlack = false;
if (canvasCount > 0) {
  await canvas.first().screenshot({ path: ".tmp/upload-check/after-upload.png" });
  // Sample the rendered canvas to confirm it is not a blank/black frame.
  nonBlack = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="playground-texture-canvas"]');
    const off = document.createElement("canvas");
    off.width = el.width;
    off.height = el.height;
    const ctx = off.getContext("2d");
    ctx.drawImage(el, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 24) lit++;
    }
    return lit > data.length / 4 / 100; // >1% of pixels lit
  });
}

console.log(
  JSON.stringify(
    {
      before,
      after,
      errorVisible,
      canvasCount,
      nonBlack,
      switchedToUpload: after.lastTextureId.startsWith("upload:"),
      consoleErrors: consoleErrors.slice(0, 5),
    },
    null,
    2,
  ),
);

await browser.close();
