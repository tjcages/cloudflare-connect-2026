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
    ["1100", "#420712", "color(display-p3 0.2593 0.0281 0.0711)", "oklch(0.257 0.103 16.525)"],
    ["1000", "#59121e", "color(display-p3 0.3484 0.0713 0.1162)", "oklch(0.319 0.12 16.525)"],
    ["900", "#792625", "color(display-p3 0.4743 0.1482 0.1459)", "oklch(0.405 0.138 23.868)"],
    ["800", "#a23228", "color(display-p3 0.6357 0.1952 0.1568)", "oklch(0.495 0.177 28.033)"],
    ["700 [Main]", "#d64134", "color(display-p3 0.8399 0.2547 0.2055)", "oklch(0.605 0.222 28.141)"],
    ["650 [Secondary]", "#fb86a0", "color(display-p3 0.9828 0.5257 0.6288)", "oklch(0.767 0.174 7.204)"],
    ["600", "#ee716a", "color(display-p3 0.9338 0.4445 0.417)", "oklch(0.708 0.187 24.153)"],
    ["500", "#ff9290", "color(display-p3 0.9999 0.5738 0.5663)", "oklch(0.786 0.16 20.606)"],
    ["400", "#ffb2af", "color(display-p3 0.9995 0.6968 0.6844)", "oklch(0.842 0.112 20.509)"],
    ["300", "#ffcbca", "color(display-p3 0.9986 0.7969 0.7932)", "oklch(0.892 0.073 18.271)"],
    ["200", "#ffdddd", "color(display-p3 1 0.8664 0.8674)", "oklch(0.929 0.048 16.238)"],
    ["100", "#ffebec", "color(display-p3 0.9996 0.9198 0.9241)", "oklch(0.957 0.028 13.039)"],
    ["0", "#fff5f6", "color(display-p3 1 0.9626 0.9656)", "oklch(0.98 0.013 11.193)"],
  ]),
  colorGroup("Orange", [
    ["1100", "#410c00", "color(display-p3 0.2545 0.0476 0.0006)", "oklch(0.256 0.099 35.68)"],
    ["1000", "#6a230d", "color(display-p3 0.4161 0.1375 0.0529)", "oklch(0.37 0.126 35.681)"],
    ["900", "#873421", "color(display-p3 0.5277 0.2044 0.1281)", "oklch(0.447 0.14 33.4)"],
    ["800", "#c2492c", "color(display-p3 0.7601 0.2858 0.1725)", "oklch(0.577 0.191 33.577)"],
    ["700 [Main]", "#f46021", "color(display-p3 0.9569 0.3765 0.1294)", "oklch(0.686 0.230 39.051)"],
    ["650 [Secondary]", "#f9b73b", "color(display-p3 0.9766 0.7172 0.2332)", "oklch(0.825 0.176 76.57)"],
    ["600", "#f67c3e", "color(display-p3 0.9633 0.4864 0.2441)", "oklch(0.727 0.198 43.478)"],
    ["500", "#fe9c4c", "color(display-p3 0.9975 0.6137 0.2981)", "oklch(0.789 0.177 54.834)"],
    ["400", "#ffb970", "color(display-p3 0.9997 0.7268 0.4405)", "oklch(0.842 0.141 63.186)"],
    ["300", "#ffd295", "color(display-p3 0.9989 0.8249 0.5849)", "oklch(0.892 0.106 71.864)"],
    ["200", "#ffe3b5", "color(display-p3 1 0.8897 0.7099)", "oklch(0.929 0.076 76.552)"],
    ["100", "#feefd2", "color(display-p3 0.9979 0.9363 0.8219)", "oklch(0.957 0.047 79.917)"],
    ["0", "#fff8e8", "color(display-p3 1 0.9712 0.9117)", "oklch(0.98 0.024 82.181)"],
  ]),
  colorGroup("Green", [
    ["1100", "#092f0c", "color(display-p3 0.0335 0.1824 0.0476)", "oklch(0.263 0.09 148.074)"],
    ["1000", "#123f15", "color(display-p3 0.0688 0.2454 0.0832)", "oklch(0.319 0.104 148.074)"],
    ["900", "#17592e", "color(display-p3 0.0908 0.3493 0.179)", "oklch(0.405 0.121 154.326)"],
    ["800", "#1f773a", "color(display-p3 0.123 0.4668 0.2292)", "oklch(0.495 0.155 153.012)"],
    ["700 [Main]", "#2e9d51", "color(display-p3 0.1807 0.6143 0.3174)", "oklch(0.605 0.186 153.367)"],
    ["650 [Secondary]", "#94d14b", "color(display-p3 0.5788 0.8192 0.2946)", "oklch(0.784 0.208 133.016)"],
    ["600", "#61bc62", "color(display-p3 0.3817 0.7372 0.3842)", "oklch(0.708 0.187 147.352)"],
    ["500", "#8cd176", "color(display-p3 0.5478 0.8213 0.4614)", "oklch(0.786 0.17 141.723)"],
    ["400", "#aae08d", "color(display-p3 0.666 0.8769 0.5528)", "oklch(0.842 0.145 138.263)"],
    ["300", "#c5eca4", "color(display-p3 0.7709 0.9245 0.6447)", "oklch(0.892 0.119 134.413)"],
    ["200", "#d7f5ba", "color(display-p3 0.8414 0.9599 0.7296)", "oklch(0.929 0.096 132.824)"],
    ["100", "#e8facb", "color(display-p3 0.9103 0.9796 0.7974)", "oklch(0.957 0.072 126.816)"],
    ["0", "#f5fee0", "color(display-p3 0.9597 0.9944 0.8801)", "oklch(0.98 0.044 122.816)"],
  ]),
  colorGroup("Blue", [
    ["1100", "#0b1859", "color(display-p3 0.0438 0.0957 0.3505)", "oklch(0.257 0.123 265.572)"],
    ["1000", "#142579", "color(display-p3 0.0777 0.1465 0.4756)", "oklch(0.321 0.151 265.572)"],
    ["900", "#1f36ae", "color(display-p3 0.1229 0.2103 0.6826)", "oklch(0.411 0.201 265.932)"],
    ["800", "#2348de", "color(display-p3 0.1365 0.2834 0.8709)", "oklch(0.492 0.242 263.963)"],
    ["700 [Main]", "#2563fe", "color(display-p3 0.146 0.3891 0.9941)", "oklch(0.567 0.253 260.678)"],
    ["650 [Secondary]", "#58d2fe", "color(display-p3 0.346 0.8241 0.9964)", "oklch(0.806 0.154 219.54)"],
    ["600", "#48a6ff", "color(display-p3 0.282 0.6508 1)", "oklch(0.707 0.179 244.223)"],
    ["500", "#72c5ff", "color(display-p3 0.4464 0.7717 1)", "oklch(0.789 0.137 235.016)"],
    ["400", "#91d7ff", "color(display-p3 0.5675 0.8416 0.9994)", "oklch(0.842 0.108 228.786)"],
    ["300", "#afe6ff", "color(display-p3 0.6846 0.9028 0.9996)", "oklch(0.892 0.081 221.876)"],
    ["200", "#caf0ff", "color(display-p3 0.7902 0.9395 0.9999)", "oklch(0.929 0.055 219.592)"],
    ["100", "#dcf7ff", "color(display-p3 0.8642 0.9681 0.9995)", "oklch(0.957 0.037 213.819)"],
    ["0", "#eefcff", "color(display-p3 0.9332 0.9871 1)", "oklch(0.98 0.019 210.891)"],
  ]),
  colorGroup("Purple", [
    ["1100", "#32014d", "color(display-p3 0.1965 0.0024 0.3015)", "oklch(0.256 0.135 311.871)"],
    ["1000", "#440f65", "color(display-p3 0.2683 0.0584 0.395)", "oklch(0.32 0.151 311.494)"],
    ["900", "#5d1e8c", "color(display-p3 0.3652 0.1171 0.5487)", "oklch(0.404 0.184 309.033)"],
    ["800", "#7327c1", "color(display-p3 0.4511 0.1548 0.756)", "oklch(0.488 0.233 303.068)"],
    ["700 [Main]", "#9038fc", "color(display-p3 0.5661 0.2192 0.989)", "oklch(0.589 0.282 300.261)"],
    ["650 [Secondary]", "#da83ff", "color(display-p3 0.8556 0.515 0.9986)", "oklch(0.761 0.212 318.497)"],
    ["600", "#b071fa", "color(display-p3 0.6892 0.4421 0.9786)", "oklch(0.685 0.216 305.409)"],
    ["500", "#c891ff", "color(display-p3 0.783 0.5704 1)", "oklch(0.761 0.177 308.555)"],
    ["400", "#deb6ff", "color(display-p3 0.8701 0.7145 0.999)", "oklch(0.842 0.12 312.108)"],
    ["300", "#ebccff", "color(display-p3 0.9208 0.8016 0.9995)", "oklch(0.892 0.085 314.967)"],
    ["200", "#f3ddff", "color(display-p3 0.954 0.8673 1)", "oklch(0.929 0.058 317.274)"],
    ["100", "#f9eaff", "color(display-p3 0.9751 0.9186 0.9999)", "oklch(0.957 0.036 319.013)"],
    ["0", "#fdf5ff", "color(display-p3 0.9909 0.961 1)", "oklch(0.98 0.018 321.246)"],
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
