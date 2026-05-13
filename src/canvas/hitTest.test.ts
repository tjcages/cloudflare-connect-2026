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
    cornerTheme: "neutral",
    theme: "purple",
    iconId: DEFAULT_ICON_ID,
    titleText: "Workers",
  },
});

describe("hitTestComponentInstances", () => {
  it("returns the topmost instance under the pointer", () => {
    const instances = [createInstance("back", 40, 40), createInstance("front", 40, 40)];

    expect(hitTestComponentInstances(instances, 60, 60)?.id).toBe("front");
  });

  it("returns undefined when no instance contains the pointer", () => {
    expect(hitTestComponentInstances([createInstance("box", 40, 40)], 10, 10)).toBeUndefined();
  });
});
