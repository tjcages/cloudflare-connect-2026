import { expect, test } from "@playwright/test";

type ParityFrame = {
  frame: number;
  time: number;
  hovered: boolean;
  diff: number;
  maxDelta: number;
  diffPixels: number;
  pixelCount: number;
};

function describeFrame(r: ParityFrame): string {
  return `frame ${r.frame} (time=${r.time}, hovered=${r.hovered}, maxDelta=${r.maxDelta}, diffPixels=${r.diffPixels})`;
}

test("comet logo renders identically to the patched baseline", async ({ page }) => {
  await page.goto("/comet-parity.html");
  const results = (await page.evaluate(() =>
    (window as never as { __parity: () => unknown[] }).__parity(),
  )) as ParityFrame[];

  // The real gate: a moved comet, a wrong curve or a dropped behaviour shifts
  // pixels by far more than one or two LSBs. A per-channel delta of 1-2 is the
  // signature of independent GLSL-program floating-point rounding, not a
  // logic defect — see task-6-report.md for the investigation. The full
  // 50-frame sweep's observed worst case is maxDelta=2 (one pixel, one frame;
  // every other differing frame is 1), so the threshold sits one step above
  // that measured ceiling rather than the un-sampled ">1" first proposed.
  const largeDelta = results.filter((r) => r.maxDelta > 2);
  expect(
    largeDelta,
    `frames with maxDelta > 2 (logic-shaped differences): ${largeDelta.map(describeFrame).join(", ")}`,
  ).toEqual([]);

  // Guard against a systematic ±1 shift across the whole image, which would
  // be a genuine difference hiding under the delta rule above.
  const widespread = results.filter((r) => r.diffPixels > r.pixelCount * 0.01);
  expect(
    widespread,
    `frames with diffPixels above 1% of the frame: ${widespread.map(describeFrame).join(", ")}`,
  ).toEqual([]);
});
