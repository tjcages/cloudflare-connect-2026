import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import { generateGrid } from "./generator";
import { generateGridAsync } from "./generateGridAsync";

describe("generateGridAsync", () => {
  it("matches sync generation in tests", async () => {
    const config = { ...DEFAULT_CONFIG, seed: "async-grid-test" };
    const syncGrid = generateGrid(config);
    const asyncGrid = await generateGridAsync(config);

    expect(asyncGrid).toEqual(syncGrid);
  });
});
