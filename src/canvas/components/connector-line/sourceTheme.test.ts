import { describe, expect, it } from "vitest";
import { STROKE_COLOR, type ComponentInstance } from "../../../grid/types";
import { parseHexColor } from "../../color";
import { DEFAULT_ICON_ID } from "../../../lib/iconRegistry";
import { getConnectorEndpointThemeSignature, resolveConnectorEndpointThemeFill } from "./sourceTheme";

const iconThemed = (id: string, theme: "orange" | "purple"): Extract<ComponentInstance, { type: "icon-box" }> => ({
  id,
  type: "icon-box",
  name: "Box",
  x: 40,
  y: 80,
  props: {
    matchCornersWithTheme: false,
    theme,
    iconId: DEFAULT_ICON_ID,
    title: "Workers",
    containerHighlighted: false,
    enabledByLine: "off",
  },
});

describe("connector endpoint theme", () => {
  it("uses rect-marker theme fill packed as rgb", () => {
    const rm: Extract<ComponentInstance, { type: "rect-marker" }> = {
      id: "rect-marker-1",
      type: "rect-marker",
      name: "Rect",
      x: 0,
      y: 0,
      props: { theme: "orange" },
    };
    const fill = resolveConnectorEndpointThemeFill({ kind: "layer", instanceId: rm.id }, [rm], STROKE_COLOR);
    expect(fill).toBe(parseHexColor("#FF4802"));
  });

  it("includes rect-marker id and theme in the fingerprint signature", () => {
    const rm: Extract<ComponentInstance, { type: "rect-marker" }> = {
      id: "rect-marker-9",
      type: "rect-marker",
      name: "Rect",
      x: 0,
      y: 0,
      props: { theme: "purple" },
    };
    expect(getConnectorEndpointThemeSignature({ kind: "layer", instanceId: rm.id }, [rm])).toBe("rect-marker-9:purple");
  });

  it("uses icon-box theme fill packed as rgb", () => {
    const ib = iconThemed("icon-box-1", "orange");
    const fill = resolveConnectorEndpointThemeFill({ kind: "layer", instanceId: ib.id }, [ib], STROKE_COLOR);
    expect(fill).toBe(parseHexColor("#FF4802"));
  });

  it("uses neutral grid-synced fill for static cells", () => {
    const fill = resolveConnectorEndpointThemeFill({ kind: "cell", x: 40, y: 40 }, [], STROKE_COLOR);
    expect(fill).toBe(parseHexColor(STROKE_COLOR));
  });

  it("includes layer id and theme in the fingerprint signature", () => {
    const ib = iconThemed("icon-box-9", "orange");
    expect(getConnectorEndpointThemeSignature({ kind: "layer", instanceId: ib.id }, [ib])).toBe("icon-box-9:orange");
    expect(getConnectorEndpointThemeSignature({ kind: "cell", x: 0, y: 0 }, [])).toBe("cell");
  });

  it("resolves different endpoints independently", () => {
    const a = iconThemed("icon-box-a", "orange");
    const b = iconThemed("icon-box-b", "purple");
    const instances = [a, b];
    expect(resolveConnectorEndpointThemeFill({ kind: "layer", instanceId: a.id }, instances, STROKE_COLOR)).toBe(
      parseHexColor("#FF4802"),
    );
    expect(resolveConnectorEndpointThemeFill({ kind: "layer", instanceId: b.id }, instances, STROKE_COLOR)).toBe(
      parseHexColor("#9C37FF"),
    );
  });
});
