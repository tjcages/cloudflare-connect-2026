import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import type { IslandProps } from "@/types/island-props";
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
    // Seed the shader from this browser's persisted panel tuning so the
    // authored look (or saved tweaks) render without the panel mounting.
    const stored = loadConnectTwizzlerControlSettings();
    if (stored) setSettings(resolveConnectTwizzlerSettings(stored));
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
            onSettingsChange={setSettings}
          />
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
    </>
  );
}
