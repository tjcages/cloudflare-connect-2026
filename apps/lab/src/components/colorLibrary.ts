export type LibraryColor = {
  label: string;
  hex: string;
  p3?: string;
  oklch?: string;
};

export type LibraryGroup = {
  name: string;
  colors: LibraryColor[];
};

type ColorStep = [label: string, hex: string, p3?: string, oklch?: string];

function colorGroup(name: string, steps: ColorStep[]): LibraryGroup {
  return {
    name,
    colors: steps.map(([label, hex, p3, oklch]) => ({ label, hex, p3, oklch })),
  };
}

function normalizeHex(value: string): string {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : "#000000";
}

function p3ChannelFromHex(hex: string, start: number): string {
  return (Number.parseInt(hex.slice(start, start + 2), 16) / 255).toFixed(4);
}

export function p3CssFromHex(hex: string): string {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return `color(display-p3 ${p3ChannelFromHex(normalized, 0)} ${p3ChannelFromHex(normalized, 2)} ${p3ChannelFromHex(normalized, 4)})`;
}

const NEUTRAL: LibraryGroup = {
  name: "Neutral",
  colors: [
    { label: "White", hex: "#ffffff" },
    { label: "0", hex: "#fdfdfd" },
    { label: "1", hex: "#fafafa" },
    { label: "2", hex: "#f7f7f7" },
    { label: "3", hex: "#f4f4f4" },
    { label: "4", hex: "#f2f2f2" },
    { label: "5", hex: "#f0f0f0" },
    { label: "6", hex: "#ebebeb" },
    { label: "7", hex: "#e0e0e0" },
    { label: "8", hex: "#b8b8b8" },
    { label: "9", hex: "#999999" },
    { label: "10", hex: "#707070" },
    { label: "11", hex: "#292929" },
    { label: "12", hex: "#1f1f1f" },
  ],
};

export const COLOR_LIBRARY: LibraryGroup[] = [
  NEUTRAL,
  colorGroup("Red", [
    ["0", "#fff6f7", "color(display-p3 1 0.963972 0.96715)"],
    ["100", "#ffebed", "color(display-p3 0.998697 0.92321 0.928076)"],
    ["200", "#ffdedf", "color(display-p3 0.999689 0.87238 0.875312)"],
    ["300", "#ffcdcd", "color(display-p3 0.998508 0.805016 0.80497)"],
    ["400", "#ffb5b3", "color(display-p3 0.998499 0.710436 0.703854)"],
    ["500", "#ff9a96", "color(display-p3 1 0.604198 0.589856)"],
    ["600", "#ff6a5d", "color(display-p3 0.999481 0.41643 0.364828)"],
    ["700", "#fa4638", "color(display-p3 0.978864 0.274772 0.218126)"],
    ["800 [Pair]", "#ff8aa3", "color(display-p3 1 0.539371 0.639563)"],
    ["900 [Accent]", "#e92d28", "color(display-p3 0.913014 0.177963 0.155553)"],
    ["1000", "#b0241f", "color(display-p3 0.691577 0.141625 0.121593)"],
    ["1100", "#841d21", "color(display-p3 0.516562 0.111938 0.129589)"],
    ["1200", "#61071c", "color(display-p3 0.381896 0.028523 0.109333)"],
    ["1300", "#490011", "color(display-p3 0.285966 0 0.065387)"],
    ["1400", "#330009", "color(display-p3 0.200734 0 0.03514)"],
    ["1500", "#180002", "color(display-p3 0.093353 0 0.009538)"],
  ]),
  colorGroup("Orange", [
    ["0", "#fff7e7", "color(display-p3 1 0.97 0.904897)"],
    ["100", "#ffeece", "color(display-p3 1 0.933614 0.807952)"],
    ["200", "#ffe2af", "color(display-p3 1 0.884673 0.685507)"],
    ["300", "#ffd08c", "color(display-p3 1 0.816459 0.547227)"],
    ["400", "#ffb662", "color(display-p3 1 0.712231 0.382793)"],
    ["500", "#ff9633", "color(display-p3 1 0.590048 0.201384)"],
    ["600", "#ff7b20", "color(display-p3 1 0.484035 0.12489)"],
    ["700", "#ff6816", "color(display-p3 1 0.409168 0.086264)"],
    ["800 [Pair]", "#ffb300", "color(display-p3 1 0.703439 0)"],
    ["900 [Accent]", "#f46021", "color(display-p3 0.956509 0.375662 0.127859)"],
    ["1000", "#d23d1c", "color(display-p3 0.82355 0.238903 0.111213)"],
    ["1100", "#922d18", "color(display-p3 0.57212 0.17499 0.093055)"],
    ["1200", "#741c01", "color(display-p3 0.453003 0.109109 0.005804)"],
    ["1300", "#460800", "color(display-p3 0.274499 0.033222 0)"],
    ["1400", "#310600", "color(display-p3 0.193818 0.023141 0)"],
    ["1500", "#160100", "color(display-p3 0.084646 0.005419 0)"],
  ]),
  colorGroup("Green", [
    ["0", "#f3fedd", "color(display-p3 0.951636 0.995831 0.868608)"],
    ["100", "#e4fbc6", "color(display-p3 0.893694 0.982358 0.778181)"],
    ["200", "#cff6b4", "color(display-p3 0.811518 0.964498 0.70469)"],
    ["300", "#b7ef96", "color(display-p3 0.718663 0.935459 0.588679)"],
    ["400", "#94e47a", "color(display-p3 0.581594 0.892202 0.477221)"],
    ["500", "#6bd65f", "color(display-p3 0.420887 0.838543 0.37427)"],
    ["600", "#23c050", "color(display-p3 0.136574 0.7534 0.312073)"],
    ["700", "#00b249", "color(display-p3 0 0.69994 0.285746)"],
    ["800 [Pair]", "#80d328", "color(display-p3 0.503563 0.827345 0.158755)"],
    ["900 [Accent]", "#009f47", "color(display-p3 0 0.624988 0.279123)"],
    ["1000", "#007932", "color(display-p3 0 0.475189 0.197583)"],
    ["1100", "#005b28", "color(display-p3 0 0.355722 0.158241)"],
    ["1200", "#00400e", "color(display-p3 0 0.249941 0.054917)"],
    ["1300", "#002f06", "color(display-p3 0 0.186179 0.023832)"],
    ["1400", "#002100", "color(display-p3 0 0.130572 0)"],
    ["1500", "#000c00", "color(display-p3 0 0.047546 0)"],
  ]),
  colorGroup("Blue", [
    ["0", "#ebfcff", "color(display-p3 0.920473 0.989319 1)"],
    ["100", "#d6f8ff", "color(display-p3 0.838417 0.972187 1)"],
    ["200", "#c0f1ff", "color(display-p3 0.75115 0.94513 1)"],
    ["300", "#9ee8ff", "color(display-p3 0.621222 0.910544 1)"],
    ["400", "#7ad9ff", "color(display-p3 0.476645 0.850707 1)"],
    ["500", "#50c7ff", "color(display-p3 0.313728 0.781776 1)"],
    ["600", "#00a9ff", "color(display-p3 0 0.66092 1)"],
    ["700", "#008dff", "color(display-p3 0 0.554037 1)"],
    ["800 [Pair]", "#3ed1ff", "color(display-p3 0.244007 0.819472 1)"],
    ["900 [Accent]", "#0065ff", "color(display-p3 0 0.395638 1)"],
    ["1000", "#1149e7", "color(display-p3 0.067472 0.287823 0.905029)"],
    ["1100", "#1836b5", "color(display-p3 0.092491 0.213143 0.709793)"],
    ["1200", "#0e267e", "color(display-p3 0.053119 0.14876 0.495013)"],
    ["1300", "#07195d", "color(display-p3 0.026612 0.097382 0.365362)"],
    ["1400", "#020942", "color(display-p3 0.007485 0.037152 0.259133)"],
    ["1500", "#01002a", "color(display-p3 0.002154 0 0.165632)"],
  ]),
  colorGroup("Purple", [
    ["0", "#fef5ff", "color(display-p3 0.997501 0.959685 1)"],
    ["100", "#fceaff", "color(display-p3 0.987186 0.916141 1)"],
    ["200", "#f8dcff", "color(display-p3 0.972097 0.86338 1)"],
    ["300", "#f1cbff", "color(display-p3 0.944929 0.796081 1)"],
    ["400", "#e6b4ff", "color(display-p3 0.900425 0.706987 1)"],
    ["500", "#d18fff", "color(display-p3 0.821333 0.559142 1)"],
    ["600", "#ba6dff", "color(display-p3 0.730811 0.427595 1)"],
    ["700", "#ae4eff", "color(display-p3 0.683354 0.306325 1)"],
    ["800 [Pair]", "#e87eff", "color(display-p3 0.910802 0.493654 1)"],
    ["900 [Accent]", "#a32bff", "color(display-p3 0.637969 0.168521 1)"],
    ["1000", "#8308cc", "color(display-p3 0.515287 0.029603 0.798373)"],
    ["1100", "#690199", "color(display-p3 0.410906 0.002028 0.601112)"],
    ["1200", "#4d006d", "color(display-p3 0.301299 0 0.425693)"],
    ["1300", "#380050", "color(display-p3 0.218613 0 0.314446)"],
    ["1400", "#240036", "color(display-p3 0.142801 0 0.212596)"],
    ["1500", "#10001a", "color(display-p3 0.062506 0 0.103848)"],
  ]),
];

const P3_BY_HEX = new Map(
  COLOR_LIBRARY.flatMap((group) =>
    group.colors.map((color) => [normalizeHex(color.hex), color.p3 ?? p3CssFromHex(color.hex)]),
  ),
);

let supportsDisplayP3Cache: boolean | null = null;

export function supportsDisplayP3Color(): boolean {
  if (supportsDisplayP3Cache !== null) return supportsDisplayP3Cache;
  supportsDisplayP3Cache =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("color", "color(display-p3 1 1 1)") &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(color-gamut: p3)").matches;
  return supportsDisplayP3Cache;
}

export function p3ColorForHex(hex: string): string {
  const normalized = normalizeHex(hex);
  return P3_BY_HEX.get(normalized) ?? p3CssFromHex(normalized);
}

export function cssColorForHex(hex: string): string {
  const normalized = normalizeHex(hex);
  return supportsDisplayP3Color() ? p3ColorForHex(normalized) : normalized;
}
