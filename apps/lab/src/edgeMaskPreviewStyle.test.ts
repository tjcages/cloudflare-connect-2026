import type { EdgeMaskConfig } from "@necatikcl/stripes-engine";
import { describe, expect, it } from "vitest";
import { edgeMaskPreviewStyle } from "./edgeMaskPreviewStyle";

const CONFIG: EdgeMaskConfig = {
  enabled: true,
  start: 0.1,
  end: 0.3,
  power: 2,
  sides: { top: true, right: true, bottom: true, left: true },
};

describe("edgeMaskPreviewStyle", () => {
  it("builds the powered ramp for every enabled side", () => {
    const style = edgeMaskPreviewStyle(CONFIG);
    const image = String(style?.maskImage);

    expect(image.match(/linear-gradient/g)).toHaveLength(4);
    expect(image).toContain("to right");
    expect(image).toContain("to left");
    expect(image).toContain("to bottom");
    expect(image).toContain("to top");
    expect(image).toContain("rgb(0 0 0 / 0.25) 20%");
    expect(style?.maskComposite).toBe("intersect");
  });

  it("includes only enabled sides", () => {
    const style = edgeMaskPreviewStyle({
      ...CONFIG,
      sides: { top: false, right: false, bottom: false, left: true },
    });

    expect(String(style?.maskImage).match(/linear-gradient/g)).toHaveLength(1);
    expect(style?.maskImage).toContain("to right");
  });

  it("does not mask the source when disabled", () => {
    expect(edgeMaskPreviewStyle({ ...CONFIG, enabled: false })).toBeUndefined();
  });
});
