let cachedRootZoom: number | null = null;
let watchingRootZoom = false;

const invalidateRootZoom = () => {
  cachedRootZoom = null;
};

const readRootZoom = () => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(
    "--zoom-ramp"
  );
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

export const resolveZoom = (element?: Element | null): number => {
  const applied = element?.currentCSSZoom;
  if (typeof applied === "number") return applied;

  if (!watchingRootZoom) {
    watchingRootZoom = true;
    addEventListener("resize", invalidateRootZoom);
    new MutationObserver(invalidateRootZoom).observe(document.documentElement, {
      attributeFilter: ["data-zoom-off"],
    });
  }

  cachedRootZoom ??= readRootZoom();
  return cachedRootZoom;
};
