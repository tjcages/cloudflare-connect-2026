import { pick, rnd } from "@/utils/random";

export const ARCHETYPES = [
  "marketing",
  "dashboard",
  "article",
  "media",
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

const CHART_BARS = 10;
const BLOCK_WIDTHS = 3;
const TILES = 6;

const ACCENTS = ["purple", "blue", "green", "orange"] as const;
const CHART_BAR_RANGE: [number, number] = [6, 24];
const BLOCK_WIDTH_RANGES: [number, number][] = [
  [44, 76],
  [56, 92],
  [40, 68],
];
const TILE_NEUTRALS = [
  "color-mix(in oklab, var(--color-darker) 3%, transparent)",
  "color-mix(in oklab, var(--color-darker) 5%, transparent)",
];
const TILE_ACCENT_CHANCE = 0.3;

export type BrowserContent = {
  begin: () => HTMLElement | null;
  settle: () => void;
};

export function createBrowserContent(browser: HTMLElement): BrowserContent {
  const panels = new Map<Archetype, HTMLElement>();
  for (const name of ARCHETYPES) {
    const el = browser.querySelector<HTMLElement>(
      `[data-browser-archetype="${name}"]`
    );
    if (el) panels.set(name, el);
  }

  // No panel is active on the server — the Browser's own `app` layout is the
  // designer's initial screen, and the first deploy reveals a panel over it.
  let current: Archetype | null = null;
  let incoming: Archetype | null = null;

  // Scoped to the panel, not the browser: the outgoing panel stays visible
  // beneath the reveal and must not re-tint mid-wave.
  const randomize = (el: HTMLElement) => {
    el.style.setProperty(
      "--browser-accent",
      `var(--color-dynamic-${pick([...ACCENTS])}-6)`
    );

    for (let i = 1; i <= CHART_BARS; i++) {
      el.style.setProperty(
        `--browser-chart-bar-${i}`,
        `${Math.round(rnd(CHART_BAR_RANGE[0], CHART_BAR_RANGE[1]))}px`
      );
    }

    for (let i = 1; i <= BLOCK_WIDTHS; i++) {
      const [min, max] = BLOCK_WIDTH_RANGES[i - 1];
      el.style.setProperty(
        `--browser-block-width-${i}`,
        `${Math.round(rnd(min, max))}px`
      );
    }

    for (let i = 1; i <= TILES; i++) {
      el.style.setProperty(
        `--browser-tile-${i}`,
        rnd(0, 1) < TILE_ACCENT_CHANCE
          ? "var(--browser-accent)"
          : pick([...TILE_NEUTRALS])
      );
    }
  };

  const nextArchetype = (): Archetype | null => {
    const available = ARCHETYPES.filter(
      (name) => name !== current && panels.has(name)
    );
    return available.length > 0 ? pick(available) : current;
  };

  return {
    begin: () => {
      const next = nextArchetype();
      const el = next ? panels.get(next) : undefined;
      if (!next || !el) return null;
      incoming = next;
      randomize(el);
      el.setAttribute("data-active", "true");
      el.setAttribute("data-revealing", "true");
      return el;
    },
    settle: () => {
      if (!incoming) return;
      const el = panels.get(incoming);
      if (el) {
        el.removeAttribute("data-revealing");
        // Whatever inline scratch the caller's reveal wrote — the Pages card
        // masks; a fade would set opacity and blur.
        el.style.removeProperty("mask-image");
        el.style.removeProperty("opacity");
        el.style.removeProperty("filter");
      }
      if (current && current !== incoming) {
        panels.get(current)?.removeAttribute("data-active");
      }
      current = incoming;
      incoming = null;
    },
  };
}
