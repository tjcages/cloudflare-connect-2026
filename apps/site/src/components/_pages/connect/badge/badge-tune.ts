import type { PanelField } from "@tjcages/panels/dev";
import { BADGE_PLATE_LIGHT_DEFAULT } from "./badge-logo";
import {
  BADGE_TWIZZLER_OVERLAY_DEFAULTS,
  type BadgeTwizzlerOverlay,
} from "./badge-twizzler-overlay";

export type BadgeTune = {
  modelScale: number;
  hangLift: number;
  hangX: number;
  hangZ: number;
  cardWidth: number;
  cardHeight: number;
  cardDepth: number;
  cardRadius: number;
  cardOverlap: number;
  shaderInset: number;
  cardEmissive: number;
  cardRoughness: number;
  cardClearcoat: number;
  cardPitch: number;
  cameraFov: number;
  cameraX: number;
  cameraY: number;
  cameraZ: number;
  printZoom: number;
  printPanX: number;
  printPanY: number;
  printTwizzler: boolean;
  printRain: boolean;
  printPadX: number;
  printPadTop: number;
  printFeather: number;
  sourceZoom: number;
  sourcePanX: number;
  sourcePanY: number;
  sourceLight: number;
  shadowOpacity: number;
  shadowSoftOpacity: number;
  wallZ: number;
  lightX: number;
  lightY: number;
  lightZ: number;
  nudgeX: number;
  nudgeY: number;
  inflate: number;
  fadeStart: number;
  fadeEnd: number;
  gravity: number;
  dampingTip: number;
  dampingCord: number;
  dampingY: number;
  dragFollow: number;
  restPull: number;
  swayFollow: number;
  dragLimitX: number;
  dragLimitDown: number;
  constraintStiffness: number;
  twistPos: number;
  twistVel: number;
  twistMax: number;
  twistSmooth: number;
  rollPos: number;
  rollMax: number;
  inwardZ: number;
  ambient: number;
  hemi: number;
  keyLight: number;
  fillLight: number;
  rimLight: number;
  logoEnabled: boolean;
  logoBand: number;
  logoPadX: number;
  logoPadY: number;
  logoScale: number;
  logoPrintZoom: number;
  logoMarkOpacity: number;
  footerBand: number;
  backdropZoom: number;
  backdropMaskW: number;
  backdropMaskH: number;
  backdropMaskX: number;
  backdropMaskY: number;
} & BadgeTwizzlerOverlay;

export const BADGE_SOURCE_PAN = 1;
export const BADGE_LOGO_SCALE_MIN = 0.4;
export const BADGE_LOGO_SCALE_MAX = 1.6;

export const BADGE_TUNE_DEFAULTS: BadgeTune = {
  modelScale: 15.8,
  hangLift: 0.85,
  hangX: -0.12,
  hangZ: 0,
  cardWidth: 0.1,
  cardHeight: 0.158,
  cardDepth: 0.003,
  cardRadius: 0.013,
  cardOverlap: -0.025,
  shaderInset: 0.0035,
  cardEmissive: 0.17,
  cardRoughness: 0.18,
  cardClearcoat: 1,
  cardPitch: -0.12,
  cameraFov: 30,
  cameraX: 0,
  cameraY: 0.15,
  cameraZ: 8,
  printZoom: 1.17,
  printPanX: -0.44,
  printPanY: -0.065,
  printTwizzler: false,
  printRain: false,
  printPadX: 0,
  printPadTop: 0,
  printFeather: 0.065,
  sourceZoom: 1.18,
  sourcePanX: 0.0015,
  sourcePanY: 0,
  sourceLight: BADGE_PLATE_LIGHT_DEFAULT,
  shadowOpacity: 0.01,
  shadowSoftOpacity: 0,
  wallZ: -0.03,
  lightX: -0.55,
  lightY: -0.55,
  lightZ: -1,
  nudgeX: -0.01,
  nudgeY: -0.024,
  inflate: 0.032,
  fadeStart: 2.2,
  fadeEnd: 4.8,
  gravity: -0.85,
  dampingTip: 0.95,
  dampingCord: 0.98,
  dampingY: 0.9,
  dragFollow: 0.12,
  restPull: 0.01,
  swayFollow: 0.16,
  dragLimitX: 0.15,
  dragLimitDown: 0.09,
  constraintStiffness: 0.32,
  twistPos: 3.5,
  twistVel: 10,
  twistMax: 0.72,
  twistSmooth: 0.055,
  rollPos: 0.42,
  rollMax: 0.2,
  inwardZ: 0.2,
  ambient: 0.58,
  hemi: 0.5,
  keyLight: 1.45,
  fillLight: 0.7,
  rimLight: 0.7,
  logoEnabled: true,
  logoBand: 0.21,
  logoPadX: 0.04,
  logoPadY: -0.005,
  logoScale: 1.26,
  logoPrintZoom: 1.6,
  logoMarkOpacity: 1,
  footerBand: 0.28,
  backdropZoom: 1,
  backdropMaskW: 62,
  backdropMaskH: 78,
  backdropMaskX: 62,
  backdropMaskY: 44,
  ...BADGE_TWIZZLER_OVERLAY_DEFAULTS,
  twizzlerOpacity: 1,
  twizzlerScale: 3.65,
  twizzlerCenterY: 0.5,
  twizzlerPanX: 0,
  twizzlerPanY: 0,
  twizzlerPanZ: 0,
  twizzlerAmplitude: 1.39,
  twizzlerTwist: 1.15,
  twizzlerRotateX: -151.4,
  twizzlerRotateY: 125.4,
  twizzlerRotateZ: 12.1,
  twizzlerFov: 0.95,
  twizzlerCamDist: 12.42,
  twizzlerLineWidth: 3.86,
  twizzlerPerspectiveWidth: 40,
  twizzlerMinLineWidth: 0.4,
  twizzlerMaxLineWidth: 9.54,
  twizzlerLineCount: 79,
  twizzlerPointSpacing: 10,
  twizzlerSpeed: 0.95,
};

function slider(
  key: keyof BadgeTune & string,
  label: string,
  min: number,
  max: number,
  step: number,
  description?: string
): PanelField<BadgeTune> {
  return description
    ? { type: "slider", key, label, min, max, step, description }
    : { type: "slider", key, label, min, max, step };
}

export const BADGE_TUNE_FIELDS: PanelField<BadgeTune>[] = [
  {
    type: "presets",
    label: "Presets",
    presets: [{ label: "Reset", values: () => ({ ...BADGE_TUNE_DEFAULTS }) }],
  },
  { type: "section", title: "Badge" },
  slider("modelScale", "Scale", 8, 28, 0.1),
  slider("hangLift", "Lift", -0.4, 1.2, 0.01),
  slider("hangX", "Offset X", -1.2, 1.2, 0.01),
  slider("hangZ", "Offset Z", -1.2, 1.2, 0.01),
  slider("cardWidth", "Card width", 0.06, 0.16, 0.001),
  slider("cardHeight", "Card height", 0.1, 0.22, 0.001),
  slider("cardDepth", "Card depth", 0.001, 0.01, 0.0005),
  slider("cardRadius", "Corner radius", 0.002, 0.04, 0.001),
  slider(
    "cardOverlap",
    "Hook overlap",
    -0.05,
    0.03,
    0.001,
    "Negative lifts the lanyard off the card. The badge stays put."
  ),
  slider("shaderInset", "Print inset", 0, 0.012, 0.0005),
  slider("cardEmissive", "Plastic white", 0, 1, 0.01),
  slider("cardRoughness", "Roughness", 0, 1, 0.01),
  slider("cardClearcoat", "Clearcoat", 0, 1, 0.01),
  slider(
    "cardPitch",
    "Pitch",
    -0.4,
    0.4,
    0.005,
    "Negative tips the top into the screen so the coat catches light."
  ),
  { type: "section", title: "Camera" },
  slider("cameraFov", "FOV", 18, 55, 0.5),
  slider("cameraX", "Camera X", -3, 3, 0.01),
  slider("cameraY", "Camera Y", -1.5, 2, 0.01),
  slider("cameraZ", "Camera Z", 4, 14, 0.05),
  { type: "section", title: "Shader SVG" },
  slider(
    "sourceZoom",
    "SVG scale",
    0.4,
    2.8,
    0.01,
    "The upload stays a vector or PNG. Scale and pan it inside the stripe conversion."
  ),
  slider("sourcePanX", "SVG X", -BADGE_SOURCE_PAN, BADGE_SOURCE_PAN, 0.01),
  slider("sourcePanY", "SVG Y", -BADGE_SOURCE_PAN, BADGE_SOURCE_PAN, 0.01),
  slider(
    "sourceLight",
    "SVG brightness",
    0,
    1,
    0.01,
    "Fill brightness on the logo in the source plate. Lower = darker, especially the inner area."
  ),
  { type: "section", title: "Print" },
  slider(
    "printZoom",
    "Field zoom",
    0.2,
    1.8,
    0.01,
    "How the converted field sits on the badge."
  ),
  slider("printPanX", "Field pan X", -0.8, 0.8, 0.005),
  slider("printPanY", "Field pan Y", -0.8, 0.8, 0.005),
  slider("printPadX", "Pad X", 0, 0.2, 0.005),
  slider("printPadTop", "Pad top", 0, 0.2, 0.005),
  slider(
    "printFeather",
    "Bottom fade",
    0,
    0.2,
    0.005,
    "Feather into the footer. Sides and top stay sharp."
  ),
  {
    type: "toggle",
    key: "printTwizzler",
    label: "Twizzler overlay",
    description:
      "Adds the themed ribbon under the case-study print. Tune it below.",
  },
  {
    type: "toggle",
    key: "printRain",
    label: "Hero rain overlay",
  },
  { type: "section", title: "Twizzler overlay" },
  slider("twizzlerOpacity", "Opacity", 0, 1, 0.01),
  slider("twizzlerScale", "Zoom", 0.05, 20, 0.05),
  slider("twizzlerCenterY", "Center Y", -1, 2, 0.01),
  slider("twizzlerPanX", "Move X", -800, 800, 1),
  slider("twizzlerPanY", "Move Y", -800, 800, 1),
  slider("twizzlerPanZ", "Move Z", -10, 10, 0.05),
  slider("twizzlerAmplitude", "Amplitude", 0, 10, 0.05),
  slider("twizzlerTwist", "Twist", 0, 6, 0.05),
  slider("twizzlerRotateX", "Rotate X", -720, 720, 0.5),
  slider("twizzlerRotateY", "Rotate Y", -720, 720, 0.5),
  slider("twizzlerRotateZ", "Rotate Z", -720, 720, 0.5),
  slider("twizzlerFov", "FOV", 0.05, 12, 0.02),
  slider("twizzlerCamDist", "Cam Z", 0.5, 120, 0.1),
  slider("twizzlerLineWidth", "Base width", 0.05, 40, 0.05),
  slider("twizzlerPerspectiveWidth", "Persp width", 0, 20, 0.05),
  slider("twizzlerMinLineWidth", "Min width", 0.01, 20, 0.05),
  slider("twizzlerMaxLineWidth", "Max width", 0.05, 80, 0.1),
  slider("twizzlerLineCount", "Layers", 1, 400, 1),
  slider("twizzlerPointSpacing", "Point spacing", 1, 200, 1),
  slider("twizzlerSpeed", "Speed", 0, 20, 0.05),
  { type: "section", title: "Shadow" },
  slider("shadowOpacity", "Opacity", 0, 0.8, 0.01),
  slider("shadowSoftOpacity", "Soft opacity", 0, 0.5, 0.01),
  slider("wallZ", "Wall Z", -0.25, -0.01, 0.005),
  slider("lightX", "Light X", -1.2, 1.2, 0.01),
  slider(
    "lightY",
    "Light Y",
    -1.4,
    0.4,
    0.01,
    "Lower values push the shadow down."
  ),
  slider("lightZ", "Light Z", -2, -0.2, 0.01),
  slider("nudgeX", "Nudge X", -0.05, 0.05, 0.001),
  slider("nudgeY", "Nudge Y", -0.08, 0.04, 0.001),
  slider("inflate", "Soft inflate", 0, 0.08, 0.001),
  slider("fadeStart", "Fade start", 0, 6, 0.05),
  slider("fadeEnd", "Fade end", 0.5, 10, 0.05),
  { type: "section", title: "Physics" },
  slider("gravity", "Gravity", -2, 0, 0.01),
  slider("dampingTip", "Tip damping", 0.8, 0.995, 0.001),
  slider("dampingCord", "Cord damping", 0.8, 0.995, 0.001),
  slider("dampingY", "Y damping", 0.7, 0.995, 0.001),
  slider("dragFollow", "Drag follow", 0.02, 0.4, 0.005),
  slider("restPull", "Rest pull", 0, 0.08, 0.001),
  slider("swayFollow", "Sway follow", 0, 0.5, 0.005),
  slider("dragLimitX", "Drag limit X", 0.05, 0.6, 0.005),
  slider("dragLimitDown", "Stretch down", 0, 0.18, 0.001),
  slider("constraintStiffness", "Stiffness", 0.05, 0.8, 0.01),
  slider("twistPos", "Twist from X", 0, 10, 0.05),
  slider("twistVel", "Twist from velocity", 0, 24, 0.1),
  slider("twistMax", "Twist max", 0, 1.4, 0.01),
  slider("twistSmooth", "Twist smooth", 0.01, 0.3, 0.005),
  slider("rollPos", "Roll from X", 0, 1.5, 0.01),
  slider("rollMax", "Roll max", 0, 0.6, 0.005),
  slider("inwardZ", "Inward Z", 0, 0.8, 0.01),
  { type: "section", title: "Lights" },
  slider("ambient", "Ambient", 0, 2, 0.01),
  slider("hemi", "Hemisphere", 0, 2, 0.01),
  slider("keyLight", "Key", 0, 3, 0.01),
  slider("fillLight", "Fill", 0, 2, 0.01),
  slider("rimLight", "Rim", 0, 2, 0.01),
  { type: "section", title: "Logo" },
  {
    type: "toggle",
    key: "logoEnabled",
    label: "Show logo",
    description: "Centered mark, tinted to the selected color scheme.",
  },
  slider("logoBand", "Mark height", 0.08, 0.7, 0.01),
  slider("logoPadX", "Pad X", 0, 0.28, 0.005),
  slider("logoPadY", "Mark Y", -0.2, 0.2, 0.005),
  slider(
    "logoScale",
    "Mark scale",
    BADGE_LOGO_SCALE_MIN,
    BADGE_LOGO_SCALE_MAX,
    0.01
  ),
  slider("logoPrintZoom", "Stripe zoom", 0.4, 3.5, 0.01),
  slider(
    "logoMarkOpacity",
    "Mark opacity",
    0,
    1,
    0.01,
    "Centered mark on top of the case-study shader."
  ),
  { type: "section", title: "Identity" },
  slider("footerBand", "Footer height", 0.1, 0.36, 0.005),
  { type: "section", title: "Backdrop" },
  slider("backdropZoom", "Field zoom", 0.4, 2.2, 0.01),
  slider("backdropMaskW", "Mask width %", 20, 100, 1),
  slider("backdropMaskH", "Mask height %", 20, 120, 1),
  slider("backdropMaskX", "Mask X %", 0, 100, 1),
  slider("backdropMaskY", "Mask Y %", 0, 100, 1),
];

export const BADGE_TUNE_PANEL_ID = "connect-badge-tune-v16";
