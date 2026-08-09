import { expect, test } from "@playwright/test";

type ParityFrame = {
  frame: number;
  time: number;
  hovered: boolean;
  diff: number;
  maxDelta: number;
  diffPixels: number;
  outlierPixels: number;
  pixelCount: number;
};

function describeFrame(r: ParityFrame): string {
  return `frame ${r.frame} (time=${r.time}, hovered=${r.hovered}, maxDelta=${r.maxDelta}, diffPixels=${r.diffPixels}, outlierPixels=${r.outlierPixels})`;
}

test("comet logo stays within the patched baseline's rounding budget", async ({ page }) => {
  await page.goto("/comet-parity.html");
  const results = (await page.evaluate(() =>
    (window as never as { __parity: () => unknown[] }).__parity(),
  )) as ParityFrame[];

  // Hard ceiling: nothing may ever reach a per-channel delta of 3. Two
  // independently-compiled GLSL programs (this port's minimal shader vs. the
  // baseline's ~3,500 extra lines of unreachable formation-mode code) round
  // additive blendFunc(ONE, ONE) accumulation into an RGBA8 target
  // differently at the last bit; a moved comet, a wrong curve or a dropped
  // behaviour shifts pixels by far more than this — see task-6-report.md.
  const largeDelta = results.filter((r) => r.maxDelta > 2);
  expect(
    largeDelta,
    `frames with maxDelta > 2 (logic-shaped differences): ${largeDelta.map(describeFrame).join(", ")}`,
  ).toEqual([]);

  // ±1 is the rule; a delta of 2 (two independent boundary flips landing the
  // same direction) is a budgeted rarity, not something to legalise outright.
  const tooManyOutliers = results.filter((r) => r.outlierPixels > 2);
  expect(
    tooManyOutliers,
    `frames with more than 2 delta>=2 pixels: ${tooManyOutliers.map(describeFrame).join(", ")}`,
  ).toEqual([]);

  // Guard against a systematic ±1 shift across the whole image, which would
  // be a genuine difference hiding under the delta rules above.
  const widespread = results.filter((r) => r.diffPixels > r.pixelCount * 0.01);
  expect(
    widespread,
    `frames with diffPixels above 1% of the frame: ${widespread.map(describeFrame).join(", ")}`,
  ).toEqual([]);
});
