import {
  parseTwizzlerGradientStops,
  serializeTwizzlerGradientStops,
} from "@tjcages/connect-twizzler/gradient";
import { folder } from "leva";
import type { TwizzlerControlSettings } from "../hero/twizzler-control-settings";
import { colorLibraryInputPlugin } from "./colorLibraryInputPlugin";
import { loadControlDrawerOpen } from "./drawerState";
import { gradientStopsPlugin } from "./gradientStopsPlugin";

/**
 * The Twizzler surface of the lab's Leva panel (`apps/lab/src/controls/levaSchema.ts`),
 * reproduced for the Connect site. Folder names, labels, ranges, ordering and the
 * `render` predicates are kept identical so a value tuned here means the same thing
 * in the lab — only the lab-only branches (client-app mode, texture map folders,
 * time transport) are dropped, since the site has no state behind them.
 */

const RIBBON_COLOR_MODE_OPTIONS = {
  Solid: "solid",
  "Shared gradient": "sharedLinear",
  "Shared field": "sharedGradient",
  "Fiber gradient": "fiberGradient",
  "Baked segments": "baked",
} as const;

type Get = (path: string) => unknown;

const drawerFolder = (
  id: string,
  schema: Parameters<typeof folder>[0],
  settings?: { render?: (get: Get) => boolean; defaultOpen?: boolean }
) =>
  folder(schema, {
    collapsed: !loadControlDrawerOpen(id, settings?.defaultOpen ?? false),
    ...(settings?.render ? { render: settings.render } : {}),
  });

const isBaked = (get: Get) =>
  get("Appearance.twizzlerRibbonColorMode") === "baked";

const isFieldGradient = (get: Get) => {
  const mode = get("Appearance.twizzlerRibbonColorMode");
  return (
    mode === "sharedLinear" ||
    mode === "sharedGradient" ||
    mode === "fiberGradient"
  );
};

/** Leva schema for one Twizzler target, seeded from its persisted values. */
export function buildTwizzlerLevaSchema(values: TwizzlerControlSettings) {
  const colorNear = values.colorNear ?? values.color;

  return {
    Appearance: drawerFolder(
      "Appearance",
      {
        twizzlerRibbonColorMode: {
          value: values.ribbonColorMode ?? "sharedGradient",
          label: "Color mode",
          options: RIBBON_COLOR_MODE_OPTIONS,
        },
        twizzlerColor: {
          ...colorLibraryInputPlugin({ value: colorNear, label: "Color" }),
          // Solid: sole ink swatch. Baked: near/right endpoint (paired with Color left).
          render: (get: Get) => {
            const mode = get("Appearance.twizzlerRibbonColorMode");
            return mode === "solid" || mode === "baked";
          },
        },
        twizzlerColorFar: {
          ...colorLibraryInputPlugin({
            value: values.colorFar,
            label: "Color left (X)",
          }),
          render: isBaked,
        },
        twizzlerGradientStops: {
          ...gradientStopsPlugin({
            value: serializeTwizzlerGradientStops(
              parseTwizzlerGradientStops(
                values.gradientStops,
                values.colorFar,
                colorNear
              )
            ),
            colorFar: values.colorFar,
            colorNear,
          }),
          render: isFieldGradient,
        },
        twizzlerColorEdge: {
          ...colorLibraryInputPlugin({
            value: values.colorEdge ?? "#e92e28",
            label: "Color peaks (Y)",
          }),
          render: isBaked,
        },
        twizzlerOpacity: {
          value: values.opacity,
          min: 0,
          max: 1,
          step: 0.01,
          label: "Opacity",
        },
        twizzlerScale: {
          value: values.scale,
          min: 0.05,
          max: 20,
          step: 0.05,
          label: "Zoom",
        },
      },
      { defaultOpen: true }
    ),

    Twizzler: drawerFolder(
      "Twizzler",
      {
        Shape: drawerFolder(
          "Twizzler Shape",
          {
            twizzlerCenterY: {
              value: values.centerY,
              min: -1,
              max: 2,
              step: 0.01,
              label: "Center Y",
            },
            twizzlerPanX: {
              value: values.panX ?? 0,
              min: -800,
              max: 800,
              step: 1,
              label: "Move X",
            },
            twizzlerPanY: {
              value: values.panY ?? 0,
              min: -800,
              max: 800,
              step: 1,
              label: "Move Y",
            },
            twizzlerPanZ: {
              value: values.panZ ?? 0,
              min: -10,
              max: 10,
              step: 0.05,
              label: "Move Z",
            },
            twizzlerAmplitude: {
              value: values.amplitude,
              min: 0,
              max: 10,
              step: 0.05,
              label: "Amplitude",
            },
            twizzlerTwist: {
              value: values.twist,
              min: 0,
              max: 6,
              step: 0.05,
              label: "Twist",
            },
            twizzlerRotateXDeg: {
              value: values.rotateXDeg ?? 12,
              min: -720,
              max: 720,
              step: 0.5,
              label: "Rotate X",
            },
            twizzlerRotateYDeg: {
              value: values.rotateYDeg ?? -18,
              min: -720,
              max: 720,
              step: 0.5,
              label: "Rotate Y",
            },
            twizzlerRotateZDeg: {
              value: values.rotateZDeg ?? 0,
              min: -720,
              max: 720,
              step: 0.5,
              label: "Rotate Z",
            },
            twizzlerFov: {
              value: values.fov ?? 1.05,
              min: 0.05,
              max: 12,
              step: 0.02,
              label: "FOV",
            },
            twizzlerCamDist: {
              value: values.camDist ?? 10.5,
              min: 0.5,
              max: 120,
              step: 0.1,
              label: "Cam Z",
            },
          },
          { defaultOpen: true }
        ),

        Gradients: drawerFolder(
          "Twizzler Gradients",
          {
            twizzlerGradientXEnabled: {
              value: values.gradientXEnabled ?? true,
              label: "X color",
            },
            twizzlerGradientXMix: {
              value: values.gradientXMix ?? 1,
              min: 0,
              max: 1,
              step: 0.02,
              label: "X mix",
            },
            twizzlerGradientYEnabled: {
              value: values.gradientYEnabled ?? true,
              label: "Y accents",
            },
            twizzlerGradientYMix: {
              value: values.gradientYMix ?? 0.85,
              min: 0,
              max: 1,
              step: 0.02,
              label: "Y mix",
            },
            twizzlerGradientZEnabled: {
              value: values.gradientZEnabled ?? true,
              label: "Z → background",
            },
            twizzlerGradientZStrength: {
              value: values.gradientZStrength ?? 0.75,
              min: 0,
              max: 5,
              step: 0.02,
              label: "Z fade strength",
            },
            twizzlerGradientZCenter: {
              value: values.gradientZCenter ?? 0,
              min: -5,
              max: 5,
              step: 0.02,
              label: "Z center",
            },
            twizzlerGradientZWidth: {
              value: values.gradientZWidth ?? 0.95,
              min: 0.05,
              max: 10,
              step: 0.02,
              label: "Z width",
            },
          },
          // Axis X/Y/Z mixes only drive Baked segments (Color mode).
          // Shared gradient uses the 1D ramp; Shared field / Fiber use the 2D hotspot editor.
          { render: isBaked, defaultOpen: true }
        ),

        Stroke: drawerFolder(
          "Twizzler Stroke",
          {
            twizzlerLineWidth: {
              value: values.lineWidth,
              min: 0.05,
              max: 40,
              step: 0.05,
              label: "Base width",
            },
            twizzlerPerspectiveWidth: {
              value: values.perspectiveWidth ?? 1.8,
              min: 0,
              max: 20,
              step: 0.05,
              label: "Persp width",
            },
            twizzlerMinLineWidth: {
              value: values.minLineWidth ?? 0.4,
              min: 0.01,
              max: 20,
              step: 0.05,
              label: "Min width",
            },
            twizzlerMaxLineWidth: {
              value: values.maxLineWidth ?? 3.2,
              min: 0.05,
              max: 80,
              step: 0.1,
              label: "Max width",
            },
            twizzlerLineCount: {
              value: values.lineCount,
              min: 1,
              max: 400,
              step: 1,
              label: "Layers",
            },
            twizzlerPointSpacing: {
              value: values.pointSpacing,
              min: 1,
              max: 200,
              step: 1,
              label: "Point spacing",
            },
          },
          // Stroke width / layers available in Default.
          {}
        ),

        Motion: drawerFolder(
          "Twizzler Motion",
          {
            twizzlerSpeed: {
              value: values.speed,
              min: 0,
              max: 20,
              step: 0.05,
              label: "Speed",
            },
          },
          { defaultOpen: true }
        ),
      },
      { defaultOpen: true }
    ),
  };
}

/** Flat Leva values (`twizzlerX`) → the panel settings record. */
export function twizzlerSettingsFromLevaValues(
  values: Record<string, unknown>
): TwizzlerControlSettings {
  const colorNear = values.twizzlerColor as string;
  const colorFar = values.twizzlerColorFar as string;

  return {
    color: colorNear,
    colorNear,
    colorFar,
    colorEdge: values.twizzlerColorEdge as string,
    ribbonColorMode:
      values.twizzlerRibbonColorMode as TwizzlerControlSettings["ribbonColorMode"],
    gradientStops: parseTwizzlerGradientStops(
      values.twizzlerGradientStops,
      colorFar,
      colorNear
    ),
    opacity: values.twizzlerOpacity as number,
    scale: values.twizzlerScale as number,
    centerY: values.twizzlerCenterY as number,
    panX: values.twizzlerPanX as number,
    panY: values.twizzlerPanY as number,
    panZ: values.twizzlerPanZ as number,
    amplitude: values.twizzlerAmplitude as number,
    twist: values.twizzlerTwist as number,
    rotateXDeg: values.twizzlerRotateXDeg as number,
    rotateYDeg: values.twizzlerRotateYDeg as number,
    rotateZDeg: values.twizzlerRotateZDeg as number,
    fov: values.twizzlerFov as number,
    camDist: values.twizzlerCamDist as number,
    perspectiveWidth: values.twizzlerPerspectiveWidth as number,
    lineWidth: values.twizzlerLineWidth as number,
    minLineWidth: values.twizzlerMinLineWidth as number,
    maxLineWidth: values.twizzlerMaxLineWidth as number,
    lineCount: values.twizzlerLineCount as number,
    pointSpacing: values.twizzlerPointSpacing as number,
    gradientXEnabled: values.twizzlerGradientXEnabled as boolean,
    gradientXMix: values.twizzlerGradientXMix as number,
    gradientYEnabled: values.twizzlerGradientYEnabled as boolean,
    gradientYMix: values.twizzlerGradientYMix as number,
    gradientZEnabled: values.twizzlerGradientZEnabled as boolean,
    gradientZStrength: values.twizzlerGradientZStrength as number,
    gradientZCenter: values.twizzlerGradientZCenter as number,
    gradientZWidth: values.twizzlerGradientZWidth as number,
    speed: values.twizzlerSpeed as number,
  };
}
