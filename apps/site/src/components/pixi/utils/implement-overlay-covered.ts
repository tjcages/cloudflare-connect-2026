import type { implementSafeTickers } from "./implement-safe-tickers";

export const implementOverlayCovered = ({
  state,
  cleanup,
}: {
  state: ReturnType<typeof implementSafeTickers>;
  cleanup: (fn: () => void) => void;
}) => {
  state.overlayCovered =
    document.documentElement.dataset.pageOverlayOpen !== undefined;

  const observer = new MutationObserver(() => {
    state.overlayCovered =
      document.documentElement.dataset.pageOverlayOpen !== undefined;
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-page-overlay-open"],
  });

  cleanup(() => observer.disconnect());
};
