import { StripesShader } from "@necatikcl/stripes-engine/react";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import type { IslandProps } from "@/types/island-props";
import {
  CONNECT_HERO_RAIN_DEFAULT,
  loadRainControlSettings,
  RAIN_SHADER_ERROR_EVENT,
  resolveConnectHeroRain,
  type ConnectHeroRain,
} from "./rain-control-settings";
import type { ShaderTarget } from "./shader-targets";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";
import {
  type ConnectTwizzlerSettings,
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
} from "./twizzler-control-settings";

interface Props {
  posterSrc?: string;
  /** Homepage exposes every shader; login only tunes Twizzler + rain. */
  panelTargets?: readonly ShaderTarget[];
  /**
   * Homepage fades the stack under overlay type. Login omits this so the
   * same hero mask blend applies (Astro omits `={false}` boolean props).
   */
  hideTopFade?: boolean;
  /**
   * Authored Twizzler look. Login passes Dark Appearance (cream on orange);
   * homepage keeps the marketing orange-on-white defaults. When set, skip
   * homepage panel persistence so that look is not overwritten.
   */
  defaults?: TwizzlerSettings;
  /** Login rain uses cover-fit; homepage keeps stored hero rain. */
  rainDefaults?: ConnectHeroRain;
}

const PANEL_STORAGE_KEY = "connect:twizzler-controls-visible";
const ConnectTwizzlerControls = lazy(() => import("./ConnectTwizzlerControls"));

export default function ConnectHeroTwizzler({
  posterSrc,
  panelTargets,
  hideTopFade = false,
  defaults,
  rainDefaults,
}: IslandProps<Props>) {
  const authored = defaults ?? CONNECT_HERO_TWIZZLER_DEFAULTS;
  const [settings, setSettings] = useState<ConnectTwizzlerSettings>({
    ...authored,
    enabled: true,
  });
  const [rain, setRain] = useState<ConnectHeroRain>(rainDefaults ?? CONNECT_HERO_RAIN_DEFAULT);
  // Single source of truth for the dev panel's visibility; persisted both
  // ways so a refresh restores the last open/closed choice (closed on a
  // fresh browser). Client islands SSR, so localStorage reads live in
  // effects.
  const [panelOpen, setPanelOpen] = useState(false);

  const setPanelVisible = useCallback((next: boolean) => {
    setPanelOpen(next);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, String(next));
    } catch {
      // Private-mode / quota failures must not break the toggle.
    }
  }, []);

  useEffect(() => {
    // Seed the shaders from this browser's persisted panel tuning so the
    // authored look (or saved tweaks) render without the panel mounting.
    if (!defaults) {
      const stored = loadConnectTwizzlerControlSettings();
      if (stored) setSettings(resolveConnectTwizzlerSettings(stored));
    }
    if (!rainDefaults) {
      setRain(resolveConnectHeroRain(loadRainControlSettings()));
    }
    setPanelOpen(localStorage.getItem(PANEL_STORAGE_KEY) === "true");
  }, [defaults, rainDefaults]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d" || !event.metaKey || !event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      setPanelVisible(!panelOpen);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [panelOpen, setPanelVisible]);

  return (
    <div className="absolute inset-0 h-full w-full">
      {panelOpen ? (
        <Suspense fallback={null}>
          <ConnectTwizzlerControls
            onClose={() => setPanelVisible(false)}
            onRainChange={setRain}
            onSettingsChange={setSettings}
            targets={panelTargets}
          />
        </Suspense>
      ) : null}
      {/* The mask fades the whole stack (ribbon + rain) out toward the top.
          "Fade offset %" slides the band down (fully hidden above it) and
          "Fade height %" sets the band's length, so the fade translates
          instead of stretching from the top edge. */}
      <div
        className="absolute inset-0 h-full w-full"
        style={
          !hideTopFade && (rain.topFadePct > 0 || rain.topFadeOffsetPct > 0)
            ? {
                maskImage: `linear-gradient(to bottom, transparent ${rain.topFadeOffsetPct}%, black ${Math.min(100, rain.topFadeOffsetPct + rain.topFadePct)}%)`,
              }
            : undefined
        }
      >
        {settings.enabled ? (
          <ConnectTwizzler
            canvasClassName="absolute inset-0 size-full"
            className="absolute inset-0 size-full"
            maxDpr={1.5}
            maxFps={30}
            posterSrc={posterSrc}
            rootMargin="240px"
            settings={settings}
          />
        ) : null}
        {/* Rain sits above the ribbon with a transparent clear, matching the
            lab's Both stack (.lab-canvas-output over .lab-canvas-twizzler). */}
        {rain.enabled ? (
          <StripesShader
            className="absolute inset-0 block size-full"
            config={asThemedEngineConfig(rain.config)}
            label="hero-rain"
            maxDpr={1.5}
            onShaderSourceError={(error) => {
              window.dispatchEvent(
                new CustomEvent<string | null>(RAIN_SHADER_ERROR_EVENT, {
                  detail: error,
                }),
              );
            }}
            rootMargin="240px"
            shaderSource={rain.shaderSource}
          />
        ) : null}
      </div>
    </div>
  );
}
