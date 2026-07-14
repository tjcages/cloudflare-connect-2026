import type { EngineConfig } from "@necatikcl/stripes-engine";
import type { LabSettings } from "../../persistence";
import { intToHex } from "../../lib/color";
import { colorLibraryInputPlugin } from "../colorLibraryInputPlugin";
import { drawerFolder } from "./drawerFolder";

export function buildBackgroundFolder(args: {
  d: EngineConfig;
  initialLabSettings: LabSettings;
  backgroundHex: string | null;
  handleBackgroundColorLiveChange: (hex: string | null) => void;
}) {
  const { d, initialLabSettings, backgroundHex, handleBackgroundColorLiveChange } = args;
  return drawerFolder("Background", {
    backgroundFillMode: {
      value:
        initialLabSettings.backgroundFillMode ??
        (d.background.transparent ? "transparent" : d.background.gradient.enabled ? "gradient" : "solid"),
      options: { Transparent: "transparent", Source: "source", Solid: "solid", Gradient: "gradient" } as const,
      label: "Fill",
    },
    backgroundColor: {
      ...colorLibraryInputPlugin({
        value: backgroundHex,
        label: "Color",
        persist: "backgroundColor",
        onLiveChange: handleBackgroundColorLiveChange,
      }),
      render: (get) => get("Background.backgroundFillMode") === "solid",
    },
    backgroundGradientDirection: {
      value: d.background.gradient.direction,
      options: {
        "Top to bottom": "topToBottom",
        "Left to right": "leftToRight",
        "Right to left": "rightToLeft",
        "Bottom to top": "bottomToTop",
      } as const,
      label: "Gradient direction",
      render: (get) => get("Background.backgroundFillMode") === "gradient",
    },
    backgroundGradientStopCount: {
      value: d.background.gradient.stopCount,
      min: 2,
      max: 4,
      step: 1,
      label: "Gradient stops",
      render: (get) => get("Background.backgroundFillMode") === "gradient",
    },
    backgroundGradientStop0: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[0]), label: "Stop 1" }),
      label: "Stop 1",
      render: (get) => get("Background.backgroundFillMode") === "gradient",
    },
    backgroundGradientStop1: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[1]), label: "Stop 2" }),
      label: "Stop 2",
      render: (get) => get("Background.backgroundFillMode") === "gradient",
    },
    backgroundGradientStop2: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[2]), label: "Stop 3" }),
      label: "Stop 3",
      render: (get) =>
        get("Background.backgroundFillMode") === "gradient" &&
        Number(get("Background.backgroundGradientStopCount")) >= 3,
    },
    backgroundGradientStop3: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.gradient.stops[3]), label: "Stop 4" }),
      label: "Stop 4",
      render: (get) =>
        get("Background.backgroundFillMode") === "gradient" &&
        Number(get("Background.backgroundGradientStopCount")) >= 4,
    },
    backgroundGridEnabled: { value: d.background.grid.enabled, label: "Grid fill" },
    backgroundGridCellWidth: {
      value: d.background.grid.cellWidth,
      min: 8,
      max: 512,
      step: 1,
      label: "Grid cell W",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridCellHeight: {
      value: d.background.grid.cellHeight,
      min: 8,
      max: 512,
      step: 1,
      label: "Grid cell H",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridGapX: {
      value: d.background.grid.gapX,
      min: 0,
      max: 256,
      step: 1,
      label: "Grid gap X",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridGapY: {
      value: d.background.grid.gapY,
      min: 0,
      max: 256,
      step: 1,
      label: "Grid gap Y",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridCornerRadius: {
      value: d.background.grid.cornerRadius,
      min: 0,
      max: 256,
      step: 1,
      label: "Grid radius",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridColor: {
      ...colorLibraryInputPlugin({ value: intToHex(d.background.grid.color), label: "Grid color" }),
      label: "Grid color",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
    backgroundGridOpacity: {
      value: d.background.grid.opacity,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Grid opacity",
      render: (get) => !!get("Background.backgroundGridEnabled"),
    },
  });
}
