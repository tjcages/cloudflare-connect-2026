import { expect, test } from "@playwright/test";

test("comet logo renders identically to the patched baseline", async ({ page }) => {
  await page.goto("/comet-parity.html");
  const results = await page.evaluate(() => (window as never as { __parity: () => unknown[] }).__parity());
  const mismatched = (results as { frame: number; time: number; hovered: boolean; diff: number }[]).filter(
    (r) => r.diff > 0,
  );
  expect(mismatched, `frames differing from baseline: ${JSON.stringify(mismatched)}`).toEqual([]);
});
