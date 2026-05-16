import { Container, Graphics } from "pixi.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentInstance } from "../../grid/types";
import { resetAppStoreDocumentToDefault, useAppStore } from "../../store";
import { COMPONENT_LAYER_BASE_Z, getComponentLayerZ, getConnectorLineZ, setupComponentLayer } from "./componentLayer";

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

describe("component layer render gate", () => {
  beforeEach(() => {
    resetAppStoreDocumentToDefault();
  });

  it("renders only plus and rect markers during marker-only profiling", () => {
    const plus: ComponentInstance = {
      id: "plus-marker-1",
      type: "plus-marker",
      name: "Plus Marker 1",
      x: 40,
      y: 40,
      props: { theme: "neutral" },
    };
    const rect: ComponentInstance = {
      id: "rect-marker-1",
      type: "rect-marker",
      name: "Rect Marker 1",
      x: 80,
      y: 80,
      props: { theme: "neutral" },
    };
    const icon: ComponentInstance = {
      id: "icon-box-1",
      type: "icon-box",
      name: "Icon Box 1",
      x: 120,
      y: 120,
      props: {
        iconId: "builder-grid",
        title: "Grid",
        theme: "neutral",
        matchCornersWithTheme: false,
        containerHighlighted: false,
      },
    };
    useAppStore.setState({ instances: [plus, rect, icon] });

    const cleanupFns: Array<() => void> = [];
    const app = {
      stage: {
        addChild: vi.fn(),
      },
    };

    setupComponentLayer({
      app: app as unknown as Parameters<typeof setupComponentLayer>[0]["app"],
      cleanup: (fn) => cleanupFns.push(fn),
    });

    const layer = app.stage.addChild.mock.calls[0][0] as Container;
    const structureLayer = layer.children[0] as Container;
    const chromeLayer = layer.children[1] as Container;
    const markerStructureRoots = structureLayer.children;
    const markerChromeRoots = chromeLayer.children.filter((child) => !(child instanceof Graphics));

    expect(markerStructureRoots).toHaveLength(2);
    expect(markerChromeRoots).toHaveLength(2);
    expect(markerStructureRoots.every((child) => child.isCachedAsTexture)).toBe(true);
    expect(markerChromeRoots.every((child) => child.isCachedAsTexture)).toBe(true);

    cleanupFns.forEach((fn) => fn());
  });
});
