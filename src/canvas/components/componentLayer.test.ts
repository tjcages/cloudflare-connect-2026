import { describe, expect, it } from "vitest";
import { COMPONENT_LAYER_BASE_Z, getComponentLayerZ, getConnectorLineZ } from "./componentLayer";

describe("component layer z ordering", () => {
  it("places regular component layers above the shared connector planes", () => {
    const connectorZ = getConnectorLineZ();

    expect(getComponentLayerZ(3, 0)).toBe(COMPONENT_LAYER_BASE_Z + 3);
    expect(getComponentLayerZ(3, 2)).toBe(COMPONENT_LAYER_BASE_Z + 1);
    expect(getComponentLayerZ(3, 2)).toBeGreaterThan(connectorZ.chromePulse);
  });

  it("uses fixed shared planes for connector lines", () => {
    expect(getConnectorLineZ()).toEqual({
      structure: COMPONENT_LAYER_BASE_Z - 2,
      tracksChrome: COMPONENT_LAYER_BASE_Z - 1,
      jointsChrome: COMPONENT_LAYER_BASE_Z,
      chromePulse: COMPONENT_LAYER_BASE_Z,
    });
  });
});
