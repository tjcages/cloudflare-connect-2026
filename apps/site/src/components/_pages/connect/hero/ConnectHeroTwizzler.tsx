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
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";
import {
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
} from "./twizzler-control-settings";

interface Props {
  posterSrc?: string;
}

const PANEL_STORAGE_KEY = "connect:twizzler-controls-visible";
const ConnectTwizzlerControls = lazy(() => import("./ConnectTwizzlerControls"));

export default function ConnectHeroTwizzler({ posterSrc }: IslandProps<Props>) {
  const [settings, setSettings] = useState<TwizzlerSettings>(
    CONNECT_HERO_TWIZZLER_DEFAULTS
  );
  const [rain, setRain] = useState<ConnectHeroRain>(CONNECT_HERO_RAIN_DEFAULT);
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
    const stored = loadConnectTwizzlerControlSettings();
    if (stored) setSettings(resolveConnectTwizzlerSettings(stored));
    setRain(resolveConnectHeroRain(loadRainControlSettings()));
    setPanelOpen(localStorage.getItem(PANEL_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "d" ||
        !event.metaKey ||
        !event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setPanelVisible(!panelOpen);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [panelOpen, setPanelVisible]);

  return (
    <>
      {panelOpen ? (
        <Suspense fallback={null}>
          <ConnectTwizzlerControls
            onClose={() => setPanelVisible(false)}
            onRainChange={setRain}
            onSettingsChange={setSettings}
          />
        </Suspense>
      ) : null}
      {/* The mask fades the whole stack (ribbon + rain) out toward the top.
          "Fade offset %" slides the band down (fully hidden above it) and
          "Fade height %" sets the band's length, so the fade translates
          instead of stretching from the top edge. */}
      <div
        className="absolute inset-0"
        style={
          rain.topFadePct > 0 || rain.topFadeOffsetPct > 0
            ? {
                maskImage: `linear-gradient(to bottom, transparent ${rain.topFadeOffsetPct}%, black ${Math.min(100, rain.topFadeOffsetPct + rain.topFadePct)}%)`,
              }
            : undefined
        }
      >
        <ConnectTwizzler
          canvasClassName="size-full"
          className="size-full"
          maxDpr={1.5}
          maxFps={30}
          posterSrc={posterSrc}
          rootMargin="240px"
          settings={settings}
        />
        {/* Rain sits above the ribbon with a transparent clear, matching the
            lab's Both stack (.lab-canvas-output over .lab-canvas-twizzler). */}
        <StripesShader
          className="absolute inset-0 size-full"
          config={asThemedEngineConfig(rain.config)}
          label="hero-rain"
          maxDpr={1.5}
          onShaderSourceError={(error) => {
            window.dispatchEvent(
              new CustomEvent<string | null>(RAIN_SHADER_ERROR_EVENT, {
                detail: error,
              })
            );
          }}
          rootMargin="240px"
          shaderSource={rain.shaderSource}
        />
      </div>
    </>
  );
}
