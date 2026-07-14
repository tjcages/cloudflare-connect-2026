export const EASING_OPTIONS = {
  Linear: "linear",
  Ease: "ease",
  "Ease-in": "easeIn",
  "Ease-out": "easeOut",
  "Ease-in-out": "easeInOut",
  "Ease In Sine": "easeInSine",
  "Ease Out Sine": "easeOutSine",
  "Ease In Out Sine": "easeInOutSine",
  "Ease In Quad": "easeInQuad",
  "Ease Out Quad": "easeOutQuad",
  "Ease In Out Quad": "easeInOutQuad",
  "Ease In Cubic": "easeInCubic",
  "Ease Out Cubic": "easeOutCubic",
  "Ease In Out Cubic": "easeInOutCubic",
  "Ease In Quart": "easeInQuart",
  "Ease Out Quart": "easeOutQuart",
  "Ease In Out Quart": "easeInOutQuart",
  "Ease In Quint": "easeInQuint",
  "Ease Out Quint": "easeOutQuint",
  "Ease In Out Quint": "easeInOutQuint",
  "Ease In Expo": "easeInExpo",
  "Ease Out Expo": "easeOutExpo",
  "Ease In Out Expo": "easeInOutExpo",
  "Ease In Circ": "easeInCirc",
  "Ease Out Circ": "easeOutCirc",
  "Ease In Out Circ": "easeInOutCirc",
  "Ease In Back": "easeInBack",
  "Ease Out Back": "easeOutBack",
  "Ease In Out Back": "easeInOutBack",
  "Ease In Elastic": "easeInElastic",
  "Ease Out Elastic": "easeOutElastic",
  "Ease In Out Elastic": "easeInOutElastic",
  "Ease In Bounce": "easeInBounce",
  "Ease Out Bounce": "easeOutBounce",
  "Ease In Out Bounce": "easeInOutBounce",
} as const;

export type PresetEasingName = (typeof EASING_OPTIONS)[keyof typeof EASING_OPTIONS];
export type EasingName = PresetEasingName | `custom:${number},${number},${number},${number}`;
export type CustomEasingControlPoints = { x1: number; y1: number; x2: number; y2: number };

export const DEFAULT_CUSTOM_EASING: CustomEasingControlPoints = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 };

export function formatCustomEasing({ x1, y1, x2, y2 }: CustomEasingControlPoints): EasingName {
  const format = (value: number) => Number(clamp01(value).toFixed(3)).toString();
  return `custom:${format(x1)},${format(y1)},${format(x2)},${format(y2)}` as EasingName;
}

export function parseCustomEasing(value: string | undefined): CustomEasingControlPoints | null {
  if (!value?.startsWith("custom:")) return null;
  const parts = value.slice("custom:".length).split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  return {
    x1: clamp01(parts[0] ?? DEFAULT_CUSTOM_EASING.x1),
    y1: clamp01(parts[1] ?? DEFAULT_CUSTOM_EASING.y1),
    x2: clamp01(parts[2] ?? DEFAULT_CUSTOM_EASING.x2),
    y2: clamp01(parts[3] ?? DEFAULT_CUSTOM_EASING.y2),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function cubicBezierValue(p1x: number, p1y: number, p2x: number, p2y: number, v: number): number {
  const sample = (a1: number, a2: number, t: number) => {
    const inv = 1 - t;
    return 3 * inv * inv * t * a1 + 3 * inv * t * t * a2 + t * t * t;
  };
  const derivative = (a1: number, a2: number, t: number) =>
    3 * (1 - t) * (1 - t) * a1 + 6 * (1 - t) * t * (a2 - a1) + 3 * t * t * (1 - a2);

  let t = v;
  for (let i = 0; i < 6; i++) {
    const xAtT = sample(p1x, p2x, t) - v;
    const slope = derivative(p1x, p2x, t);
    if (Math.abs(xAtT) < 0.00001 || slope === 0) break;
    t = clamp01(t - xAtT / slope);
  }
  return sample(p1y, p2y, t);
}

export function easeValue(t: number, easing: string | undefined): number {
  const x = clamp01(t);
  const custom = parseCustomEasing(easing);
  if (custom) return clamp01(cubicBezierValue(custom.x1, custom.y1, custom.x2, custom.y2, x));

  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = (2 * Math.PI) / 3;
  const c5 = (2 * Math.PI) / 4.5;
  const easeOutBounce = (v: number): number => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (v < 1 / d1) return n1 * v * v;
    if (v < 2 / d1) {
      const shifted = v - 1.5 / d1;
      return n1 * shifted * shifted + 0.75;
    }
    if (v < 2.5 / d1) {
      const shifted = v - 2.25 / d1;
      return n1 * shifted * shifted + 0.9375;
    }
    const shifted = v - 2.625 / d1;
    return n1 * shifted * shifted + 0.984375;
  };

  let eased = x;
  switch (easing) {
    case "ease":
      eased = cubicBezierValue(0.25, 0.1, 0.25, 1, x);
      break;
    case "easeIn":
      eased = cubicBezierValue(0.42, 0, 1, 1, x);
      break;
    case "easeOut":
      eased = cubicBezierValue(0, 0, 0.58, 1, x);
      break;
    case "easeInOut":
      eased = cubicBezierValue(0.42, 0, 0.58, 1, x);
      break;
    case "easeInSine":
      eased = 1 - Math.cos((x * Math.PI) / 2);
      break;
    case "easeOutSine":
      eased = Math.sin((x * Math.PI) / 2);
      break;
    case "easeInOutSine":
      eased = -(Math.cos(Math.PI * x) - 1) / 2;
      break;
    case "easeInQuad":
      eased = x * x;
      break;
    case "easeOutQuad":
      eased = 1 - (1 - x) * (1 - x);
      break;
    case "easeInOutQuad":
      eased = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
      break;
    case "easeInCubic":
      eased = x ** 3;
      break;
    case "easeOutCubic":
      eased = 1 - (1 - x) ** 3;
      break;
    case "easeInOutCubic":
      eased = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
      break;
    case "easeInQuart":
      eased = x ** 4;
      break;
    case "easeOutQuart":
      eased = 1 - (1 - x) ** 4;
      break;
    case "easeInOutQuart":
      eased = x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
      break;
    case "easeInQuint":
      eased = x ** 5;
      break;
    case "easeOutQuint":
      eased = 1 - (1 - x) ** 5;
      break;
    case "easeInOutQuint":
      eased = x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2;
      break;
    case "easeInExpo":
      eased = x === 0 ? 0 : 2 ** (10 * x - 10);
      break;
    case "easeOutExpo":
      eased = x === 1 ? 1 : 1 - 2 ** (-10 * x);
      break;
    case "easeInOutExpo":
      eased = x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
      break;
    case "easeInCirc":
      eased = 1 - Math.sqrt(1 - x * x);
      break;
    case "easeOutCirc":
      eased = Math.sqrt(1 - (x - 1) ** 2);
      break;
    case "easeInOutCirc":
      eased = x < 0.5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2;
      break;
    case "easeInBack":
      eased = c3 * x ** 3 - c1 * x * x;
      break;
    case "easeOutBack":
      eased = 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
      break;
    case "easeInOutBack":
      eased =
        x < 0.5
          ? ((2 * x) ** 2 * ((c2 + 1) * 2 * x - c2)) / 2
          : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
      break;
    case "easeInElastic":
      eased = x === 0 ? 0 : x === 1 ? 1 : -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * c4);
      break;
    case "easeOutElastic":
      eased = x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
      break;
    case "easeInOutElastic":
      eased =
        x === 0
          ? 0
          : x === 1
            ? 1
            : x < 0.5
              ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
              : (2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
      break;
    case "easeInBounce":
      eased = 1 - easeOutBounce(1 - x);
      break;
    case "easeOutBounce":
      eased = easeOutBounce(x);
      break;
    case "easeInOutBounce":
      eased = x < 0.5 ? (1 - easeOutBounce(1 - 2 * x)) / 2 : (1 + easeOutBounce(2 * x - 1)) / 2;
      break;
    default:
      eased = x;
  }
  return clamp01(eased);
}
