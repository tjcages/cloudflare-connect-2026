import { StripesShader } from "@necatikcl/stripes-engine/react";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import type { IslandProps } from "@/types/island-props";
import {
  CONNECT_HERO_RAIN_CONFIG,
  CONNECT_HERO_RAIN_SHADER_SOURCE,
} from "./hero-rain-config";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "./twizzler-defaults";

interface Props {
  posterSrc?: string;
}

const PANEL_STORAGE_KEY = "connect:twizzler-controls-visible";
const ConnectTwizzlerControls = lazy(() => import("./ConnectTwizzlerControls"));

export default function ConnectHeroTwizzler({ posterSrc }: IslandProps<Props>) {
  const [settings, setSettings] = useState<TwizzlerSettings>(
    CONNECT_HERO_TWIZZLER_DEFAULTS
  );
  const [panelLoaded, setPanelLoaded] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(PANEL_STORAGE_KEY) === "true") {
      setPanelLoaded(true);
      return;
    }

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
      setPanelLoaded(true);
      localStorage.setItem(PANEL_STORAGE_KEY, "true");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return (
    <>
      {panelLoaded ? (
        <Suspense fallback={null}>
          <ConnectTwizzlerControls onSettingsChange={setSettings} />
        </Suspense>
      ) : null}
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
        config={asThemedEngineConfig(CONNECT_HERO_RAIN_CONFIG)}
        label="hero-rain"
        maxDpr={1.5}
        rootMargin="240px"
        shaderSource={CONNECT_HERO_RAIN_SHADER_SOURCE}
      />
    </>
  );
}
