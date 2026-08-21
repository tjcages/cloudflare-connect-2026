export type Theme = "system" | "light" | "dark";
export type ResolvedTheme = Exclude<Theme, "system">;
export type InterfaceMode = "human" | "machine";

const DURATION = 700;
const EASING = "cubic-bezier(0.6,0.6,0,1)";
const TOGGLE = 250;
const HEAD = 0.6;
const GAPS = [0.78, 0.6, 0.45, 0.32, 0.2, 0.1];
const HUES = [
  "var(--color-orange-900)",
  "var(--color-red-900)",
  "var(--color-purple-900)",
  "var(--color-blue-900)",
  "var(--color-green-900)",
  "var(--color-orange-800)",
];
const BAND_STEP = 1.5;
const ZONE = GAPS.length * BAND_STEP;

export const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;

let injected = false;

function injectStyles() {
  if (injected) return;
  injected = true;

  const progress = "var(--vt-p)";
  const bands = GAPS.map((_, index) => GAPS.length - 1 - index)
    .flatMap((band) => {
      const bottom = (band + 1) * BAND_STEP;
      const gapStart = band * BAND_STEP + BAND_STEP * GAPS[band];
      const gapEnd = band * BAND_STEP;
      return [
        `#000 calc(${progress} - ${bottom.toFixed(2)}%)`,
        `#000 calc(${progress} - ${gapStart.toFixed(2)}%)`,
        `#0000 calc(${progress} - ${gapStart.toFixed(2)}%)`,
        `#0000 calc(${progress} - ${gapEnd.toFixed(2)}%)`,
      ];
    })
    .join(",");

  const style = document.createElement("style");
  style.textContent =
    `@property --vt-p{syntax:"<percentage>";inherits:true;initial-value:0%}` +
    `@keyframes vt-sweep{from{--vt-p:0%}to{--vt-p:${(100 + ZONE).toFixed(2)}%}}` +
    `::view-transition-group(root){animation:none}${[
      "theme-thumb",
      "theme-icon-0",
      "theme-icon-1",
      "theme-icon-2",
      "interface-thumb",
      "interface-label-human",
      "interface-label-machine",
    ]
      .flatMap((name) => [
        `::view-transition-group(${name})`,
        `::view-transition-old(${name})`,
        `::view-transition-new(${name})`,
      ])
      .join(
        ","
      )}{animation-duration:${TOGGLE}ms;animation-timing-function:${EASING}}` +
    `::view-transition-old(root),::view-transition-new(root){mix-blend-mode:normal;` +
    `animation:vt-sweep ${DURATION}ms ${EASING} both}` +
    `::view-transition-image-pair(root){` +
    `animation:vt-sweep ${DURATION}ms ${EASING} both;` +
    `background:linear-gradient(to top,` +
    `${HUES[HUES.length - 1]} 0%,${GAPS.map(
      (_, index) => GAPS.length - 1 - index
    )
      .flatMap((band) => [
        `${HUES[band]} calc(${progress} - ${((band + 1) * BAND_STEP).toFixed(2)}%)`,
        `${HUES[band]} calc(${progress} - ${(band * BAND_STEP).toFixed(2)}%)`,
      ])
      .join(",")},${HUES[0]} 100%)}` +
    `::view-transition-new(root){mask-image:linear-gradient(to top,` +
    `#000 0%,#000 calc(${progress} - ${ZONE.toFixed(2)}%),` +
    `#0000 calc(${progress} - ${ZONE.toFixed(2)}%),${bands},` +
    `#0000 ${progress},#0000 100%)}` +
    `::view-transition-old(root){mask-image:linear-gradient(to top,` +
    `#0000 calc(${progress} + ${HEAD}%),#000 calc(${progress} + ${HEAD}%))}`;
  document.head.appendChild(style);
}

function runThemeTransition(commit: () => void) {
  if (
    !document.startViewTransition ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    commit();
    return;
  }

  injectStyles();
  document.startViewTransition(commit);
}

export function applyTheme(theme: Theme) {
  if (document.documentElement.dataset.interfaceMode === "machine") {
    document.documentElement.dataset.theme = "dark";
    return;
  }

  const resolved = resolveTheme(theme);

  const commit = () => {
    document.documentElement.dataset.theme = resolved;
    dispatchEvent(new CustomEvent("themechange", { detail: resolved }));
  };

  if (document.documentElement.dataset.theme === resolved) {
    commit();
    return;
  }

  runThemeTransition(commit);
}

export function applyInterfaceMode(
  mode: InterfaceMode,
  lockedHumanTheme?: string
) {
  const storedTheme =
    (localStorage.getItem("theme") as Theme | null) ?? "system";
  const humanTheme: Theme =
    lockedHumanTheme === "light" || lockedHumanTheme === "dark"
      ? lockedHumanTheme
      : storedTheme;
  const resolved = mode === "machine" ? "dark" : resolveTheme(humanTheme);

  const commit = () => {
    document.documentElement.dataset.interfaceMode = mode;
    document.documentElement.dataset.theme = resolved;
    localStorage.setItem("connect-interface-mode", mode);
    dispatchEvent(new CustomEvent("themechange", { detail: resolved }));
    dispatchEvent(new CustomEvent("interfacemodechange", { detail: mode }));
  };

  runThemeTransition(commit);
}

export function toggleTheme() {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
}
