import { describe, expect, it } from "vitest";
import { hitTestComponentInstances } from "./hitTest";
import { DEFAULT_ICON_ID } from "../lib/iconRegistry";
import type { ComponentInstance } from "../grid/types";

const createInstance = (id: string, x: number, y: number): ComponentInstance => ({
  id,
  type: "icon-box",
  name: id,
  x,
  y,
  props: {
    matchCornersWithTheme: false,
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    title: "Workers",
    containerHighlighted: false,
  },
});

const createConnector = (): Extract<ComponentInstance, { type: "connector-line" }> => ({
  id: "connector-line-1",
  type: "connector-line",
  name: "Connector Line 1",
  x: 40,
  y: 40,
  props: {
    preferredConnection: "horizontal",
    source: { kind: "cell", x: 40, y: 40 },
    target: { kind: "cell", x: 200, y: 200 },
    overlayGrid: true,
    animated: true,
  },
});

describe("hitTestComponentInstances", () => {
  it("returns the topmost instance under the pointer", () => {
    const instances = [createInstance("front", 40, 40), createInstance("back", 40, 40)];

    /** Icon-box hit target is the shadow card + padding (see `getIconBoxShadowCardBoundsInRootSpace`), not the title strip. */
    expect(hitTestComponentInstances(instances, 80, 108)?.id).toBe("front");
  });

  it("returns undefined when no instance contains the pointer", () => {
    expect(hitTestComponentInstances([createInstance("box", 40, 40)], 10, 10)).toBeUndefined();
  });

  it("hits connector line segments without requiring a component-sized rectangular box", () => {
    const connector = createConnector();

    expect(hitTestComponentInstances([connector], 118, 40)?.id).toBe("connector-line-1");
    expect(hitTestComponentInstances([connector], 40, 200)).toBeUndefined();
  });

  it("hit tests the same bounded dogleg route used for rendering", () => {
    const base = createConnector() as Extract<ComponentInstance, { type: "connector-line" }>;
    const connector: ComponentInstance = {
      ...base,
      props: {
        preferredConnection: "horizontal",
        source: { kind: "cell", x: 40, y: 520 },
        target: { kind: "cell", x: 280, y: 520 },
        overlayGrid: true,
        animated: true,
      },
    };

    expect(hitTestComponentInstances([connector], 120, 440, { width: 800, height: 560 })?.id).toBe("connector-line-1");
    expect(hitTestComponentInstances([connector], 120, 600, { width: 800, height: 560 })).toBeUndefined();
  });

  it("hit tests plus-marker against its 40×40 registry bounds", () => {
    const pm: ComponentInstance = {
      id: "plus-marker-1",
      type: "plus-marker",
      name: "Plus Marker 1",
      x: 100,
      y: 100,
      props: { theme: "orange" },
    };

    expect(hitTestComponentInstances([pm], 110, 110)?.id).toBe("plus-marker-1");
    expect(hitTestComponentInstances([pm], 99, 110)).toBeUndefined();
  });

  it("hit tests rect-marker against its 4×4 registry bounds", () => {
    const rm: ComponentInstance = {
      id: "rect-marker-1",
      type: "rect-marker",
      name: "Rect Marker 1",
      x: 98,
      y: 98,
      props: { theme: "orange" },
    };

    expect(hitTestComponentInstances([rm], 100, 100)?.id).toBe("rect-marker-1");
    expect(hitTestComponentInstances([rm], 97, 100)).toBeUndefined();
    expect(hitTestComponentInstances([rm], 101, 101)?.id).toBe("rect-marker-1");
    expect(hitTestComponentInstances([rm], 103, 101)).toBeUndefined();
  });
});
