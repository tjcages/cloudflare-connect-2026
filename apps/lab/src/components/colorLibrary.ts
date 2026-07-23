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
  const numericLabel = (label: string): number | null => {
    const value = label.match(/^\d+/)?.[0];
    return value === undefined ? null : Number.parseInt(value, 10);
  };
  const sortedSteps = [...steps].sort(([left], [right]) => {
    const leftValue = numericLabel(left);
    const rightValue = numericLabel(right);
    if (leftValue === null) return rightValue === null ? 0 : -1;
    if (rightValue === null) return 1;
    return leftValue - rightValue;
  });
  return {
    name,
    colors: sortedSteps.map(([label, hex, p3, oklch]) => ({ label, hex, p3, oklch })),
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
    ["0", "#fff5f6", "color(display-p3 1 0.9626 0.9656)", "oklch(0.98 0.013 11.193)"],
    ["100", "#ffebec", "color(display-p3 0.9996 0.9198 0.9241)", "oklch(0.957 0.028 13.039)"],
    ["200", "#ffdddd", "color(display-p3 1 0.8664 0.8674)", "oklch(0.929 0.048 16.238)"],
    ["300", "#ffcbca", "color(display-p3 0.9986 0.7969 0.7932)", "oklch(0.892 0.073 18.271)"],
    ["400", "#ffb2af", "color(display-p3 0.9995 0.6968 0.6844)", "oklch(0.842 0.112 20.509)"],
    ["500", "#ff9590", "color(display-p3 0.9997 0.585 0.5634)", "oklch(0.79 0.156 22.408)"],
    ["600", "#f7695a", "color(display-p3 0.9677 0.4132 0.3512)", "oklch(0.708 0.211 27.742)"],
    ["700", "#e65543", "color(display-p3 0.9035 0.3335 0.2631)", "oklch(0.655 0.218 29.029)"],
    ["1000", "#a23228", "color(display-p3 0.6357 0.1952 0.1568)", "oklch(0.495 0.177 28.033)"],
    ["1100", "#792625", "color(display-p3 0.4743 0.1482 0.1459)", "oklch(0.405 0.138 23.868)"],
    ["1200", "#59121e", "color(display-p3 0.3484 0.0713 0.1162)", "oklch(0.319 0.12 16.525)"],
    ["1300", "#420712", "color(display-p3 0.2593 0.0281 0.0711)", "oklch(0.257 0.103 16.525)"],
    ["1400", "#300008", "color(display-p3 0.1901 0.0001 0.0326)", "oklch(0.204 0.092 16.525)"],
    ["1500", "#160002", "color(display-p3 0.0868 0.0003 0.009)", "oklch(0.132 0.059 16.525)"],
    ["900-Accent", "#d64134", "color(display-p3 0.8399 0.2547 0.2055)", "oklch(0.605 0.222 28.141)"],
    ["800-Pair", "#fb86a0", "color(display-p3 0.9828 0.5257 0.6288)", "oklch(0.767 0.174 7.204)"],
  ]),
  colorGroup("Orange", [
    ["0", "#fff8e8", "color(display-p3 1 0.9712 0.9117)", "oklch(0.98 0.024 82.181)"],
    ["100", "#feefd2", "color(display-p3 0.9979 0.9363 0.8219)", "oklch(0.957 0.047 79.917)"],
    ["200", "#ffe3b5", "color(display-p3 1 0.8897 0.7099)", "oklch(0.929 0.076 76.552)"],
    ["300", "#ffd295", "color(display-p3 0.9989 0.8249 0.5849)", "oklch(0.892 0.106 71.864)"],
    ["400", "#ffb970", "color(display-p3 0.9997 0.7268 0.4405)", "oklch(0.842 0.141 63.186)"],
    ["500", "#fe9c4c", "color(display-p3 0.9975 0.6137 0.2981)", "oklch(0.789 0.177 54.834)"],
    ["600", "#fb843d", "color(display-p3 0.9847 0.5174 0.2396)", "oklch(0.746 0.198 46.397)"],
    ["700", "#f27235", "color(display-p3 0.95 0.4488 0.2071)", "oklch(0.708 0.206 42.151)"],
    ["1000", "#c2492c", "color(display-p3 0.7601 0.2858 0.1725)", "oklch(0.577 0.191 33.577)"],
    ["1100", "#873421", "color(display-p3 0.5277 0.2044 0.1281)", "oklch(0.447 0.14 33.4)"],
    ["1200", "#6a230d", "color(display-p3 0.4161 0.1375 0.0529)", "oklch(0.37 0.126 35.681)"],
    ["1300", "#400e00", "color(display-p3 0.2499 0.0562 0.0008)", "oklch(0.256 0.095 37.482)"],
    ["1400", "#2d0900", "color(display-p3 0.1755 0.0358 0.0004)", "oklch(0.207 0.074 39.335)"],
    ["1500", "#130200", "color(display-p3 0.0743 0.0086 0)", "oklch(0.13 0.047 39.335)"],
    ["900-Accent", "#e26936", "color(display-p3 0.8881 0.4136 0.2134)", "oklch(0.672 0.195 40.244)"],
    ["800-Pair", "#f9b73b", "color(display-p3 0.9766 0.7172 0.2332)", "oklch(0.825 0.176 76.57)"],
  ]),
  colorGroup("Green", [
    ["0", "#f5fee0", "color(display-p3 0.9597 0.9944 0.8801)", "oklch(0.98 0.044 122.816)"],
    ["100", "#e8facb", "color(display-p3 0.9103 0.9796 0.7974)", "oklch(0.957 0.072 126.816)"],
    ["200", "#d7f5ba", "color(display-p3 0.8414 0.9599 0.7296)", "oklch(0.929 0.096 132.824)"],
    ["300", "#c3ed9f", "color(display-p3 0.7632 0.9293 0.625)", "oklch(0.892 0.129 134.413)"],
    ["400", "#a6e186", "color(display-p3 0.6513 0.8841 0.5243)", "oklch(0.842 0.16 138.263)"],
    ["500", "#87d36e", "color(display-p3 0.528 0.8288 0.4319)", "oklch(0.786 0.186 141.723)"],
    ["600", "#5cbd5e", "color(display-p3 0.3614 0.7425 0.3668)", "oklch(0.708 0.198 147.352)"],
    ["700", "#36af56", "color(display-p3 0.21 0.6881 0.3353)", "oklch(0.657 0.208 151.846)"],
    ["1000", "#1f773a", "color(display-p3 0.123 0.4668 0.2292)", "oklch(0.495 0.155 153.012)"],
    ["1100", "#17592e", "color(display-p3 0.0908 0.3493 0.179)", "oklch(0.405 0.121 154.326)"],
    ["1200", "#123f15", "color(display-p3 0.0688 0.2454 0.0832)", "oklch(0.319 0.104 148.074)"],
    ["1300", "#092f0c", "color(display-p3 0.0335 0.1824 0.0476)", "oklch(0.263 0.09 148.074)"],
    ["1400", "#002003", "color(display-p3 0 0.1274 0.0109)", "oklch(0.209 0.085 148.074)"],
    ["1500", "#000c01", "color(display-p3 0 0.0458 0.0026)", "oklch(0.13 0.053 148.074)"],
    ["900-Accent", "#2e9d51", "color(display-p3 0.1807 0.6143 0.3174)", "oklch(0.605 0.186 153.367)"],
    ["800-Pair", "#94d14b", "color(display-p3 0.5788 0.8192 0.2946)", "oklch(0.784 0.208 133.016)"],
  ]),
  colorGroup("Blue", [
    ["0", "#eefcff", "color(display-p3 0.9332 0.9871 1)", "oklch(0.98 0.019 210.891)"],
    ["100", "#dcf7ff", "color(display-p3 0.8642 0.9681 0.9995)", "oklch(0.957 0.037 213.819)"],
    ["200", "#caf0ff", "color(display-p3 0.7902 0.9395 0.9999)", "oklch(0.929 0.055 219.592)"],
    ["300", "#afe6ff", "color(display-p3 0.6846 0.9028 0.9996)", "oklch(0.892 0.081 221.876)"],
    ["400", "#91d7ff", "color(display-p3 0.5675 0.8416 0.9994)", "oklch(0.842 0.108 228.786)"],
    ["500", "#72c5ff", "color(display-p3 0.4464 0.7717 1)", "oklch(0.789 0.137 235.016)"],
    ["600", "#48a6ff", "color(display-p3 0.282 0.6508 1)", "oklch(0.707 0.179 244.223)"],
    ["700", "#318bff", "color(display-p3 0.1937 0.5449 1)", "oklch(0.645 0.211 251.853)"],
    ["1000", "#2348de", "color(display-p3 0.1365 0.2834 0.8709)", "oklch(0.492 0.242 263.963)"],
    ["1100", "#1f36ae", "color(display-p3 0.1229 0.2103 0.6826)", "oklch(0.411 0.201 265.932)"],
    ["1200", "#142579", "color(display-p3 0.0777 0.1465 0.4756)", "oklch(0.321 0.151 265.572)"],
    ["1300", "#0b1859", "color(display-p3 0.0438 0.0957 0.3505)", "oklch(0.257 0.123 265.572)"],
    ["1400", "#03093f", "color(display-p3 0.0128 0.0362 0.2477)", "oklch(0.192 0.105 265.572)"],
    ["1500", "#000028", "color(display-p3 0.0017 0 0.1572)", "oklch(0.13 0.089 265.571)"],
    ["900-Accent", "#2563fe", "color(display-p3 0.146 0.3891 0.9941)", "oklch(0.567 0.253 260.678)"],
    ["800-Pair", "#6dceff", "color(display-p3 0.4276 0.8082 0.9999)", "oklch(0.806 0.139 226.453)"],
  ]),
  colorGroup("Purple", [
    ["0", "#fdf5ff", "color(display-p3 0.9909 0.961 1)", "oklch(0.98 0.018 321.246)"],
    ["100", "#f9eaff", "color(display-p3 0.9751 0.9186 0.9999)", "oklch(0.957 0.036 319.013)"],
    ["200", "#f3ddff", "color(display-p3 0.954 0.8673 1)", "oklch(0.929 0.058 317.274)"],
    ["300", "#ebccff", "color(display-p3 0.9208 0.8016 0.9995)", "oklch(0.892 0.085 314.967)"],
    ["400", "#deb6ff", "color(display-p3 0.8701 0.7145 0.999)", "oklch(0.842 0.12 312.108)"],
    ["500", "#c891ff", "color(display-p3 0.783 0.5704 1)", "oklch(0.761 0.177 308.555)"],
    ["600", "#b071fa", "color(display-p3 0.6892 0.4421 0.9786)", "oklch(0.685 0.216 305.409)"],
    ["700", "#a254fb", "color(display-p3 0.6365 0.3282 0.9836)", "oklch(0.635 0.255 304.111)"],
    ["1000", "#7819c4", "color(display-p3 0.4712 0.0985 0.7682)", "oklch(0.488 0.249 305.605)"],
    ["1100", "#600f93", "color(display-p3 0.3745 0.0593 0.5782)", "oklch(0.404 0.205 309.033)"],
    ["1200", "#460768", "color(display-p3 0.2733 0.027 0.409)", "oklch(0.32 0.162 311.494)"],
    ["1300", "#32014d", "color(display-p3 0.1965 0.0024 0.3015)", "oklch(0.256 0.135 311.871)"],
    ["1400", "#200034", "color(display-p3 0.1267 0 0.2032)", "oklch(0.197 0.105 311.871)"],
    ["1500", "#0e0019", "color(display-p3 0.053 0.0001 0.0983)", "oklch(0.13 0.069 311.871)"],
    ["900-Accent", "#9635f7", "color(display-p3 0.5876 0.2073 0.9705)", "oklch(0.589 0.282 303.361)"],
    ["800-Pair", "#da83ff", "color(display-p3 0.8556 0.515 0.9986)", "oklch(0.761 0.212 318.497)"],
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
    CSS.supports("color", "color(display-p3 1 1 1)");
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
