import { test, expect } from "@playwright/test";

test("renders 4K within the 60fps budget", async ({ page }) => {
  // 3840×2160 css @ dpr 1 = true 4K backing store.
  await page.goto("/?seed=1&dpr=1&w=3840&h=2160");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.bringToFront();
  // Wait until enough frames have accumulated (replaces a fixed 2500ms timeout).
  await page.waitForFunction(() => ((window as any).__lab?.snapshot?.().sampleCount ?? 0) > 60, { timeout: 15_000 });
  const snap = await page.evaluate(() => (window as any).__lab.snapshot());
  console.log("perf @4K:", JSON.stringify(snap));
  expect(snap.sampleCount).toBeGreaterThan(30);
  const gpuTimed = Object.keys(snap.passMs).length > 0;
  if (gpuTimed) {
    expect(snap.frameMs.p50).toBeLessThanOrEqual(16.6);
  } else {
    test
      .info()
      .annotations.push({ type: "warn", description: "No GPU timer (software renderer?) — perf budget not enforced" });
  }
});
