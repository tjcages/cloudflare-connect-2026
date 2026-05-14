import { describe, expect, it } from "vitest";
import { CONNECTOR_HIGHLIGHT_COLOR, getConnectorCornerCapRect, getConnectorRenderSpec } from "./setup";

describe("connector line render spec", () => {
  it("places segment and endpoint frames in the structural plane below connector chrome", () => {
    expect(getConnectorRenderSpec(false, 0xf3f3f3).structuralDrawOrder).toEqual(["segmentFrames", "endpointFrames"]);
    expect(getConnectorRenderSpec(false, 0xf3f3f3).chromeDrawOrder).toEqual(["lineUnderlay", "line", "corners"]);
  });

  it("uses blue line and corner strokes when the connector is selected", () => {
    expect(getConnectorRenderSpec(true, 0xf3f3f3)).toMatchObject({
      lineColor: CONNECTOR_HIGHLIGHT_COLOR,
      cornerStrokeColor: CONNECTOR_HIGHLIGHT_COLOR,
      segmentFrameColor: 0xf3f3f3,
    });
  });

  it("centers corner caps on the connector route point", () => {
    const rect = getConnectorCornerCapRect({ x: 120, y: 120 });

    expect(rect).toEqual({
      x: 117,
      y: 117,
      size: 6,
      radius: 1,
    });
    expect(rect.x + rect.size / 2).toBe(120);
    expect(rect.y + rect.size / 2).toBe(120);
  });
});
