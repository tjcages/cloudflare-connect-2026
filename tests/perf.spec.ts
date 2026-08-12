import { test, expect } from "@playwright/test";

test("renders 4K within the 60fps budget", async ({ page }) => {
  await page.goto("/lab.html?seed=1&dpr=1&w=3840&h=2160");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.bringToFront();
  await page.waitForFunction(() => ((window as any).__lab?.snapshot?.().sampleCount ?? 0) > 60, { timeout: 15_000 });
  const snap = await page.evaluate(() => (window as any).__lab.snapshot());
  console.log("perf @4K static:", JSON.stringify(snap));
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

test("renders 4K with wave reveal animating within the 60fps budget", async ({ page }) => {
  await page.goto("/lab.html?seed=1&dpr=1&w=3840&h=2160");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.bringToFront();
  await page.evaluate(() => {
    (window as any).__lab.setConfig({ reveal: { enabled: true, type: "wave" }, stripesEnabled: true });
    (window as any).__lab.triggerReveal();
  });
  await page.waitForFunction(() => ((window as any).__lab?.snapshot?.().sampleCount ?? 0) > 60, { timeout: 15_000 });
  const snap = await page.evaluate(() => (window as any).__lab.snapshot());
  console.log("perf @4K wave-reveal:", JSON.stringify(snap));
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

test("renders 4K with assembly reveal animating within the 60fps budget", async ({ page }) => {
  await page.goto("/lab.html?seed=1&dpr=1&w=3840&h=2160");
  await page.waitForFunction(() => (window as any).__lab !== undefined);
  await page.bringToFront();
  await page.evaluate(() => {
    (window as any).__lab.setConfig({
      reveal: { enabled: true, type: "assembly", assembly: { order: "center" } },
      stripesEnabled: true,
    });
    (window as any).__lab.triggerReveal();
  });
  await page.waitForFunction(() => ((window as any).__lab?.snapshot?.().sampleCount ?? 0) > 60, { timeout: 15_000 });
  const snap = await page.evaluate(() => (window as any).__lab.snapshot());
  console.log("perf @4K assembly-reveal:", JSON.stringify(snap));
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
