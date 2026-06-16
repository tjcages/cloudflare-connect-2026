import { describe, expect, it } from "vitest";
import { collectGridBuildTransfers, type GridBuildWorkerResponse } from "./playgroundGridBuildWorker";

function makeResponse(overrides: Partial<GridBuildWorkerResponse> = {}): GridBuildWorkerResponse {
  return {
    requestId: 1,
    ok: true,
    gridCols: 2,
    gridRows: 2,
    gridIndices: new ArrayBuffer(4),
    stateStableIndices: new ArrayBuffer(4),
    lumaCols: 2,
    lumaRows: 2,
    lumaBytes: new ArrayBuffer(4),
    lumaColors: new ArrayBuffer(12),
    ...overrides,
  };
}

describe("collectGridBuildTransfers", () => {
  it("lists each distinct buffer once", () => {
    const response = makeResponse();
    const transfers = collectGridBuildTransfers(response);
    expect(transfers).toHaveLength(4);
    expect(new Set(transfers).size).toBe(4);
  });

  it("dedupes buffers shared between response fields (grid indices reuse state indices, grid luma reuses luma bytes)", () => {
    // buildPlaygroundBlockGrid returns the same arrays in grid and state/lumaGrid, so the
    // serialized buffers alias; a duplicate in the transfer list makes postMessage throw.
    const shared = new ArrayBuffer(4);
    const sharedLuma = new ArrayBuffer(4);
    const sharedColors = new ArrayBuffer(12);
    const sharedCoverage = new ArrayBuffer(4);
    const response = makeResponse({
      gridIndices: shared,
      stateStableIndices: shared,
      lumaBytes: sharedLuma,
      gridLuma: sharedLuma,
      lumaColors: sharedColors,
      gridColors: sharedColors,
      gridColorCoverage: sharedCoverage,
      lumaColorCoverage: sharedCoverage,
    });
    const transfers = collectGridBuildTransfers(response);
    expect(new Set(transfers).size).toBe(transfers.length);
    expect(transfers).toHaveLength(4);
    expect(transfers).toContain(shared);
    expect(transfers).toContain(sharedLuma);
    expect(transfers).toContain(sharedColors);
    expect(transfers).toContain(sharedCoverage);
  });
});
