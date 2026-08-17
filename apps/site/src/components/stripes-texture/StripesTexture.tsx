import type { ThemeName } from "@necatikcl/stripes-engine";
import { StripesShader } from "@necatikcl/stripes-engine/react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { IslandProps } from "@/types/island-props";
import { asThemedEngineConfig, type StripesTextureConfig } from "./config";
import { useStripesOff } from "./stripes-debug";

const subscribeTheme = (onStoreChange: () => void) => {
  addEventListener("themechange", onStoreChange);
  return () => removeEventListener("themechange", onStoreChange);
};

const getTheme = (): ThemeName =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const getServerTheme = (): ThemeName | null => null;

interface Props {
  src: string;
  darkSrc?: string;
  config: StripesTextureConfig;
  label?: string;
  className?: string;
  rootMargin?: string;
}

export default function StripesTexture({
  src,
  darkSrc,
  config,
  label,
  className,
  rootMargin,
}: IslandProps<Props>) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const stripesOff = useStripesOff();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastActivityRef = useRef<string | null>(null);

  const onWaterActivity = useCallback((activity: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const value = activity.toFixed(3);
    if (value === lastActivityRef.current) return;
    lastActivityRef.current = value;
    // Set on the enclosing link so sibling content (the logo) inherits it too;
    // the treatment reading these sits on the card background, not here.
    const target = el.closest("a") ?? el;
    target.style.setProperty("--water-activity", value);
    target.style.setProperty(
      "--water-filter",
      activity > 0.01 ? `saturate(${(1 + 0.75 * activity).toFixed(3)})` : "none"
    );
  }, []);

  // Astro's client:visible observes the island's SSR children — render a
  // placeholder box pre-theme or the island never hydrates.
  if (!theme) return <canvas aria-hidden className={className} />;

  const stripesEnabled = !stripesOff && config.stripesEnabled !== false;
  const darkStripesEnabled =
    !stripesOff &&
    (config.dark?.stripesEnabled ?? config.stripesEnabled) !== false;

  return (
    <StripesShader
      className={className}
      config={asThemedEngineConfig({
        ...config,
        stripesEnabled,
        ...(config.dark
          ? { dark: { ...config.dark, stripesEnabled: darkStripesEnabled } }
          : null),
      })}
      label={label}
      onWaterActivity={onWaterActivity}
      ref={canvasRef}
      rootMargin={rootMargin}
      src={theme === "dark" && darkSrc ? darkSrc : src}
      theme={theme}
    />
  );
}
