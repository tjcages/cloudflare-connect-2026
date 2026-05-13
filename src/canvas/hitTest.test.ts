import { describe, expect, it } from "vitest";
import { hitTestComponentInstances } from "./hitTest";
import { DEFAULT_ICON_ID } from "../components/iconRegistry";
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
      },
    };

    expect(hitTestComponentInstances([connector], 120, 440, { width: 800, height: 560 })?.id).toBe("connector-line-1");
    expect(hitTestComponentInstances([connector], 120, 600, { width: 800, height: 560 })).toBeUndefined();
  });
});
