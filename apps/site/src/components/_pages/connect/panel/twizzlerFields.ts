import { parseTwizzlerGradientStops } from "@tjcages/connect-twizzler/gradient";
import type { PanelField } from "@tjcages/panels/dev";
import {
  CONNECT_TWIZZLER_CONTROL_DEFAULTS,
  CONNECT_TWIZZLER_PANEL_ID,
  type TwizzlerControlSettings,
} from "../hero/twizzler-control-settings";
import { COLOR_LIBRARY } from "./colorLibrary";
import { configToolsField } from "./configTools";
import { color, num, select, toggle } from "./fieldHelpers";
import type { PanelSectionDef, PanelValues } from "./panelSections";

/**
 * The Twizzler surface of the lab's Leva panel, translated 1:1 into
 * @tjcages/panels field defs. Drawer ids, labels, ranges, ordering and the
 * mode-conditional fields are kept identical so a value tuned here means the
 * same thing in the lab — sections are rebuilt per render, which is how the
 * leva `render` predicates are reproduced.
 */

const RIBBON_COLOR_MODE_OPTIONS = {
  Solid: "solid",
  "Shared gradient": "sharedLinear",
  "Shared field": "sharedGradient",
  "Fiber gradient": "fiberGradient",
  "Baked segments": "baked",
} as const;

/** Panel values for the hero target — the control settings record itself
 *  (`color` doubles as the near/solid ink; `colorNear` is synced on change). */
export type TwizzlerPanelValues = PanelValues;

export function seedTwizzlerPanelValues(settings: TwizzlerControlSettings): TwizzlerPanelValues {
  const colorNear = settings.colorNear ?? settings.color;
  return {
    ...settings,
    color: colorNear,
    gradientStops: parseTwizzlerGradientStops(settings.gradientStops, settings.colorFar, colorNear),
  };
}

/** Panel values → the settings record persisted + fed to the shader. */
export function twizzlerSettingsFromPanelValues(values: TwizzlerPanelValues): TwizzlerControlSettings {
  const colorNear = values.color as string;
  const colorFar = values.colorFar as string;
  return {
    ...(values as unknown as TwizzlerControlSettings),
    color: colorNear,
    colorNear,
    gradientStops: parseTwizzlerGradientStops(values.gradientStops, colorFar, colorNear),
  };
}

export function buildTwizzlerSections(values: TwizzlerPanelValues): PanelSectionDef[] {
  const mode = values.ribbonColorMode as string;
  const isBaked = mode === "baked";
  const isFieldGradient = mode === "sharedLinear" || mode === "sharedGradient" || mode === "fiberGradient";

  const appearance: PanelField<PanelValues>[] = [select("ribbonColorMode", "Color mode", RIBBON_COLOR_MODE_OPTIONS)];
  // Solid: sole ink swatch. Baked: near/right endpoint (paired with Color left).
  if (mode === "solid" || isBaked) appearance.push(color("color", "Color"));
  if (isBaked) appearance.push(color("colorFar", "Color left (X)"));
  if (isFieldGradient) {
    appearance.push({
      type: "gradient-stops",
      key: "gradientStops",
      label: "Field",
      layout: "field",
      library: COLOR_LIBRARY,
    });
  }
  if (isBaked) appearance.push(color("colorEdge", "Color peaks (Y)"));
  appearance.push(num("opacity", "Opacity", 0, 1, 0.01), num("scale", "Zoom", 0.05, 20, 0.05));

  const twizzlerChildren: PanelSectionDef[] = [
    {
      id: "Twizzler Shape",
      title: "Shape",
      defaultOpen: true,
      fields: [
        num("centerY", "Center Y", -1, 2, 0.01),
        num("panX", "Move X", -800, 800, 1),
        num("panY", "Move Y", -800, 800, 1),
        num("panZ", "Move Z", -10, 10, 0.05),
        num("amplitude", "Amplitude", 0, 10, 0.05),
        num("twist", "Twist", 0, 6, 0.05),
        num("rotateXDeg", "Rotate X", -720, 720, 0.5),
        num("rotateYDeg", "Rotate Y", -720, 720, 0.5),
        num("rotateZDeg", "Rotate Z", -720, 720, 0.5),
        num("fov", "FOV", 0.05, 12, 0.02),
        num("camDist", "Cam Z", 0.5, 120, 0.1),
      ],
    },
  ];

  // Axis X/Y/Z mixes only drive Baked segments (Color mode).
  if (isBaked) {
    twizzlerChildren.push({
      id: "Twizzler Gradients",
      title: "Gradients",
      defaultOpen: true,
      fields: [
        toggle("gradientXEnabled", "X color"),
        num("gradientXMix", "X mix", 0, 1, 0.02),
        toggle("gradientYEnabled", "Y accents"),
        num("gradientYMix", "Y mix", 0, 1, 0.02),
        toggle("gradientZEnabled", "Z → background"),
        num("gradientZStrength", "Z fade strength", 0, 5, 0.02),
        num("gradientZCenter", "Z center", -5, 5, 0.02),
        num("gradientZWidth", "Z width", 0.05, 10, 0.02),
      ],
    });
  }

  twizzlerChildren.push(
    {
      id: "Twizzler Stroke",
      title: "Stroke",
      fields: [
        num("lineWidth", "Base width", 0.05, 40, 0.05),
        num("perspectiveWidth", "Persp width", 0, 20, 0.05),
        num("minLineWidth", "Min width", 0.01, 20, 0.05),
        num("maxLineWidth", "Max width", 0.05, 80, 0.1),
        num("lineCount", "Layers", 1, 400, 1),
        num("pointSpacing", "Point spacing", 1, 200, 1),
      ],
    },
    {
      id: "Twizzler Motion",
      title: "Motion",
      defaultOpen: true,
      fields: [num("speed", "Speed", 0, 20, 0.05)],
    },
  );

  return [
    {
      id: "Twizzler General",
      title: "General",
      defaultOpen: true,
      fields: [toggle("enabled", "Enabled")],
    },
    {
      id: "Appearance",
      title: "Appearance",
      defaultOpen: true,
      fields: appearance,
    },
    {
      id: "Twizzler",
      title: "Twizzler",
      defaultOpen: true,
      fields: [],
      children: twizzlerChildren,
    },
    // Always the closing section, so the authored look can be lifted out.
    {
      id: "Config",
      title: "Config",
      defaultOpen: true,
      persistOpen: false,
      fields: [
        configToolsField({
          label: "hero twizzler",
          defaults: CONNECT_TWIZZLER_CONTROL_DEFAULTS,
          storageIds: [CONNECT_TWIZZLER_PANEL_ID],
          toConfig: twizzlerSettingsFromPanelValues,
          seed: seedTwizzlerPanelValues,
        }),
      ],
    },
  ];
}
