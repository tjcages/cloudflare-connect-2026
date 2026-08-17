import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useEffect, useState } from "react";
import type { IslandProps } from "@/types/island-props";
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
    </>
  );
}
