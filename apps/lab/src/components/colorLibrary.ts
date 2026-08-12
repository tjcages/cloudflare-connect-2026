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
    { label: "3", hex: "#f5f5f5" },
    { label: "4", hex: "#f4f4f4" },
    { label: "5", hex: "#f0f0f0" },
    { label: "6", hex: "#ebebeb" },
    { label: "7", hex: "#d1d1d1" },
    { label: "8", hex: "#adadad" },
    { label: "9", hex: "#8f8f8f" },
    { label: "10", hex: "#707070" },
    { label: "11", hex: "#5c5c5c" },
    { label: "12", hex: "#292929" },
  ],
};

export const COLOR_LIBRARY: LibraryGroup[] = [
  NEUTRAL,
  colorGroup("Red", [
    ["0", "#fff6f7", "color(display-p3 1 0.964706 0.968627)"],
    ["100", "#ffebed", "color(display-p3 1 0.921569 0.929412)"],
    ["200", "#ffdedf", "color(display-p3 1 0.870588 0.87451)"],
    ["300", "#ffcdcf", "color(display-p3 1 0.803922 0.811765)"],
    ["400", "#ffb5b6", "color(display-p3 1 0.709804 0.713726)"],
    ["500", "#ff9a96", "color(display-p3 1 0.603922 0.588235)"],
    ["600", "#ff6967", "color(display-p3 1 0.411765 0.403922)"],
    ["700", "#fa4541", "color(display-p3 0.980392 0.270588 0.254902)"],
    ["800 [Pair]", "#ff89a5", "color(display-p3 1 0.537255 0.647059)"],
    ["900 [Accent]", "#e92e28", "color(display-p3 0.913725 0.180392 0.156863)"],
    ["1000", "#b0241f", "color(display-p3 0.690196 0.141176 0.121569)"],
    ["1100", "#882426", "color(display-p3 0.533333 0.141176 0.14902)"],
    ["1200", "#611c25", "color(display-p3 0.380392 0.109804 0.145098)"],
    ["1300", "#471a1e", "color(display-p3 0.278431 0.101961 0.117647)"],
    ["1400", "#371115", "color(display-p3 0.215686 0.066667 0.082353)"],
    ["1500", "#2a0b0f", "color(display-p3 0.164706 0.043137 0.058824)"],
  ]),
  colorGroup("Orange", [
    ["0", "#fff8ea", "color(display-p3 1 0.972549 0.917647)"],
    ["100", "#ffefd4", "color(display-p3 1 0.937255 0.831373)"],
    ["200", "#ffe3bb", "color(display-p3 1 0.890196 0.733333)"],
    ["300", "#ffd39e", "color(display-p3 1 0.827451 0.619608)"],
    ["400", "#ffbb7d", "color(display-p3 1 0.733333 0.490196)"],
    ["500", "#ffa05b", "color(display-p3 1 0.627451 0.356863)"],
    ["600", "#ff8839", "color(display-p3 1 0.533333 0.223529)"],
    ["700 [Brand]", "#f77720", "color(display-p3 0.968627 0.466667 0.12549)"],
    ["800 [Pair]", "#fea700", "color(display-p3 0.996078 0.654902 0)"],
    ["900 [Accent]", "#f46021", "color(display-p3 0.956863 0.376471 0.129412)"],
    ["1000", "#b33806", "color(display-p3 0.701961 0.219608 0.023529)"],
    ["1100", "#8a2b01", "color(display-p3 0.541176 0.168627 0.003922)"],
    ["1200", "#5b260e", "color(display-p3 0.356863 0.14902 0.054902)"],
    ["1300", "#44200d", "color(display-p3 0.266667 0.12549 0.05098)"],
    ["1400", "#331607", "color(display-p3 0.2 0.086275 0.027451)"],
    ["1500", "#261106", "color(display-p3 0.14902 0.066667 0.023529)"],
  ]),
  colorGroup("Green", [
    ["0", "#f3fede", "color(display-p3 0.952941 0.996078 0.870588)"],
    ["100", "#e4fac7", "color(display-p3 0.894118 0.980392 0.780392)"],
    ["200", "#cff6b4", "color(display-p3 0.811765 0.964706 0.705882)"],
    ["300", "#b7ef96", "color(display-p3 0.717647 0.937255 0.588235)"],
    ["400", "#95e47a", "color(display-p3 0.584314 0.894118 0.478431)"],
    ["500", "#6bd65f", "color(display-p3 0.419608 0.839216 0.372549)"],
    ["600", "#23c04f", "color(display-p3 0.137255 0.752941 0.309804)"],
    ["700", "#00ae58", "color(display-p3 0 0.682353 0.345098)"],
    ["800 [Pair]", "#80d328", "color(display-p3 0.501961 0.827451 0.156863)"],
    ["900 [Accent]", "#009b53", "color(display-p3 0 0.607843 0.32549)"],
    ["1000", "#00753d", "color(display-p3 0 0.458824 0.239216)"],
    ["1100", "#005c31", "color(display-p3 0 0.360784 0.192157)"],
    ["1200", "#174220", "color(display-p3 0.090196 0.258824 0.12549)"],
    ["1300", "#14331a", "color(display-p3 0.078431 0.2 0.101961)"],
    ["1400", "#0e2513", "color(display-p3 0.054902 0.145098 0.07451)"],
    ["1500", "#091c0c", "color(display-p3 0.035294 0.109804 0.047059)"],
  ]),
  colorGroup("Blue", [
    ["0", "#ecfcff", "color(display-p3 0.92549 0.988235 1)"],
    ["100", "#d8f7ff", "color(display-p3 0.847059 0.968627 1)"],
    ["200", "#c3f0ff", "color(display-p3 0.764706 0.941176 1)"],
    ["300", "#a4e7ff", "color(display-p3 0.643137 0.905882 1)"],
    ["400", "#82d8ff", "color(display-p3 0.509804 0.847059 1)"],
    ["500", "#5dc6ff", "color(display-p3 0.364706 0.776471 1)"],
    ["600", "#23a9ff", "color(display-p3 0.137255 0.662745 1)"],
    ["700", "#008ffd", "color(display-p3 0 0.560784 0.992157)"],
    ["800 [Pair]", "#38c5f6", "color(display-p3 0.219608 0.772549 0.964706)"],
    ["900 [Accent]", "#1f72ff", "color(display-p3 0.121569 0.447059 1)"],
    ["1000", "#1c50d9", "color(display-p3 0.109804 0.313726 0.85098)"],
    ["1100", "#1e3fae", "color(display-p3 0.117647 0.247059 0.682353)"],
    ["1200", "#1c3370", "color(display-p3 0.109804 0.2 0.439216)"],
    ["1300", "#182951", "color(display-p3 0.094118 0.160784 0.317647)"],
    ["1400", "#121e3a", "color(display-p3 0.070588 0.117647 0.227451)"],
    ["1500", "#0d162c", "color(display-p3 0.05098 0.086275 0.172549)"],
  ]),
  colorGroup("Purple", [
    ["0", "#fef5ff", "color(display-p3 0.996078 0.960784 1)"],
    ["100", "#fbeaff", "color(display-p3 0.984314 0.917647 1)"],
    ["200", "#f6ddff", "color(display-p3 0.964706 0.866667 1)"],
    ["300", "#efcdff", "color(display-p3 0.937255 0.803922 1)"],
    ["400", "#e3b7ff", "color(display-p3 0.890196 0.717647 1)"],
    ["500", "#d39eff", "color(display-p3 0.827451 0.619608 1)"],
    ["600", "#bd7aff", "color(display-p3 0.741176 0.478431 1)"],
    ["700", "#b162ff", "color(display-p3 0.694118 0.384314 1)"],
    ["800 [Pair]", "#ec80f7", "color(display-p3 0.92549 0.501961 0.968627)"],
    ["900 [Accent]", "#a22fff", "color(display-p3 0.635294 0.184314 1)"],
    ["1000", "#811fc4", "color(display-p3 0.505882 0.121569 0.768627)"],
    ["1100", "#672091", "color(display-p3 0.403922 0.12549 0.568627)"],
    ["1200", "#4b2063", "color(display-p3 0.294118 0.12549 0.388235)"],
    ["1300", "#371c46", "color(display-p3 0.215686 0.109804 0.27451)"],
    ["1400", "#281732", "color(display-p3 0.156863 0.090196 0.196078)"],
    ["1500", "#1d1125", "color(display-p3 0.113725 0.066667 0.145098)"],
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

/** Named tokens used by Twizzler / client preview (must stay in COLOR_LIBRARY). */
export const LIBRARY_COLOR = {
  /** Orange / 900 [Accent] — HTML #ff6709 */
  orangeAccent: "#f46021",
  /** Orange / 800 [Pair] — HTML #ffcc33 gold */
  orangePair: "#fea700",
  /** Orange / 700 [Brand] */
  orangeBrand: "#f77720",
  /** Orange / 1000 */
  orangeDeep: "#b33806",
  /** Red / 900 [Accent] — HTML #ff2a2a peaks */
  redAccent: "#e92e28",
  /** Neutral / White */
  white: "#ffffff",
  /** Neutral / 11 */
  graphite: "#5c5c5c",
} as const;

export function findLibraryColor(groupName: string, label: string): LibraryColor | null {
  const group = COLOR_LIBRARY.find((entry) => entry.name === groupName);
  if (!group) return null;
  return group.colors.find((color) => color.label === label) ?? null;
}

export type LibraryColorMatch = {
  group: string;
  label: string;
  hex: string;
  /** Stable display token, e.g. `Orange / 900 [Accent]`. */
  token: string;
};

/** Resolve a hex to a COLOR_LIBRARY token when it matches exactly. */
export function findLibraryColorByHex(hex: string): LibraryColorMatch | null {
  const normalized = normalizeHex(hex);
  for (const group of COLOR_LIBRARY) {
    for (const color of group.colors) {
      if (color.hex.toLowerCase() === normalized) {
        return {
          group: group.name,
          label: color.label,
          hex: color.hex,
          token: `${group.name} / ${color.label}`,
        };
      }
    }
  }
  return null;
}
