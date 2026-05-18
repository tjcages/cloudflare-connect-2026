import { describe, expect, it } from "vitest";
import {
  COMPONENT_LAYER_BASE_Z,
  CONNECTOR_BASE_ICON_LATTICE_OVERLAY_Z,
  CONNECTOR_BASE_LATTICE_PLANE_Z,
  CONNECTOR_BASE_Z,
  CONNECTOR_JOINTS_CHROME_Z,
  CONNECTOR_TRACKS_CHROME_Z,
  getComponentLayerZ,
  getConnectorLitCornersChromeZ,
  getConnectorPulseChromeZ,
} from "./componentLayer";

describe("component layer z ordering", () => {
  it("layers icon lattice backdrop strictly above lattice plane inside connector base stack", () => {
    expect(CONNECTOR_BASE_ICON_LATTICE_OVERLAY_Z).toBe(CONNECTOR_BASE_LATTICE_PLANE_Z + 1);
  });

  it("places component chrome above the shared connector base plane", () => {
    expect(getComponentLayerZ(3, 0)).toBe(COMPONENT_LAYER_BASE_Z + 3);
    expect(getComponentLayerZ(3, 2)).toBe(COMPONENT_LAYER_BASE_Z + 1);
    expect(getComponentLayerZ(3, 2)).toBeGreaterThan(CONNECTOR_BASE_Z);
  });

  it("keeps the connector base plane below the lowest list-layer chrome z", () => {
    expect(CONNECTOR_BASE_Z).toBe(COMPONENT_LAYER_BASE_Z - 2);
    expect(getComponentLayerZ(5, 4)).toBe(COMPONENT_LAYER_BASE_Z + 1);
    expect(CONNECTOR_BASE_Z).toBeLessThan(getComponentLayerZ(5, 4));
  });

  it("stacks connector tracks under joint caps under component list chrome for animation visibility", () => {
    expect(CONNECTOR_TRACKS_CHROME_Z).toBe(COMPONENT_LAYER_BASE_Z - 1);
    expect(CONNECTOR_JOINTS_CHROME_Z).toBe(COMPONENT_LAYER_BASE_Z);
    expect(CONNECTOR_TRACKS_CHROME_Z).toBeLessThan(CONNECTOR_JOINTS_CHROME_Z);
    expect(getComponentLayerZ(2, 1)).toBe(COMPONENT_LAYER_BASE_Z + 1);
    expect(CONNECTOR_JOINTS_CHROME_Z).toBeLessThan(getComponentLayerZ(2, 1));
  });

  it("keeps connector pulse between tracks and joint caps", () => {
    expect(getConnectorPulseChromeZ(0)).toBeGreaterThan(CONNECTOR_TRACKS_CHROME_Z);
    expect(getConnectorPulseChromeZ(0)).toBeLessThan(CONNECTOR_JOINTS_CHROME_Z);
    expect(getConnectorPulseChromeZ(1)).toBeLessThan(getConnectorPulseChromeZ(0));
  });

  it("draws pulse lit bend tiles above shared joint caps but below list chrome", () => {
    expect(getConnectorLitCornersChromeZ(0)).toBeGreaterThan(CONNECTOR_JOINTS_CHROME_Z);
    expect(getConnectorLitCornersChromeZ(0)).toBeLessThan(getComponentLayerZ(2, 1));
    expect(getConnectorLitCornersChromeZ(1)).toBeLessThan(getConnectorLitCornersChromeZ(0));
  });
});
