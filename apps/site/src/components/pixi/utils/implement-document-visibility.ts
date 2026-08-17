import type { implementSafeTickers } from "./implement-safe-tickers";

export const implementDocumentVisibility = ({
  state,
  cleanup,
}: {
  state: ReturnType<typeof implementSafeTickers>;
  cleanup: (fn: () => void) => void;
}) => {
  const onVisibilityChange = () => {
    state.documentVisible = document.visibilityState === "visible";
  };

  document.addEventListener("visibilitychange", onVisibilityChange);

  cleanup(() =>
    document.removeEventListener("visibilitychange", onVisibilityChange)
  );
};
