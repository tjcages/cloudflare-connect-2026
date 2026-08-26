import { StripesShader } from "@necatikcl/stripes-engine/react";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import {
  CONNECT_HERO_RAIN_DEFAULT,
  loadRainControlSettings,
  RAIN_SHADER_ERROR_EVENT,
  resolveConnectHeroRain,
  type ConnectHeroRain,
} from "../hero/rain-control-settings";
import { CONNECT_HERO_TWIZZLER_DEFAULTS } from "../hero/twizzler-defaults";
import {
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
} from "../hero/twizzler-control-settings";
import AnimationExportTools from "./AnimationExportTools";
import "./connect-animations.css";

const ConnectTwizzlerControls = lazy(
  () => import("../hero/ConnectTwizzlerControls")
);
const PANEL_STORAGE_KEY = "connect:animations-controls-visible";
const ANIMATION_TARGETS = ["twizzler", "rain"] as const;

export default function ConnectAnimationsStage() {
  const [settings, setSettings] = useState<TwizzlerSettings>(
    CONNECT_HERO_TWIZZLER_DEFAULTS
  );
  const [rain, setRain] = useState<ConnectHeroRain>(CONNECT_HERO_RAIN_DEFAULT);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const twizzlerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationStartedAt = useRef(0);

  const setPanelVisible = useCallback((next: boolean) => {
    setPanelOpen(next);
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, String(next));
    } catch {
      // Private-mode / quota failures must not break the toggle.
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    animationStartedAt.current = performance.now();
    const stored = loadConnectTwizzlerControlSettings();
    if (stored) setSettings(resolveConnectTwizzlerSettings(stored));
    setRain(resolveConnectHeroRain(loadRainControlSettings()));
    const panelPreference = localStorage.getItem(PANEL_STORAGE_KEY);
    setPanelOpen(panelPreference === null ? true : panelPreference === "true");
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

  const controls = panelOpen ? (
    <Suspense fallback={null}>
      <ConnectTwizzlerControls
        onClose={() => setPanelVisible(false)}
        onRainChange={setRain}
        onSettingsChange={setSettings}
        targets={ANIMATION_TARGETS}
        toolsSlot={
          <AnimationExportTools
            animationStartedAt={animationStartedAt.current}
            rainCanvasRef={rainCanvasRef}
            settings={settings}
            twizzlerCanvasRef={twizzlerCanvasRef}
          />
        }
      />
    </Suspense>
  ) : null;

  return (
    <div className="connect-animations-root">
      <div className="connect-animations-stage">
        <ConnectTwizzler
          canvasClassName="connect-animations-canvas"
          className="connect-animations-layer"
          maxDpr={1.5}
          maxFps={30}
          posterSrc="/connect/twizzler-poster.png"
          ref={twizzlerCanvasRef}
          rootMargin="240px"
          settings={settings}
        />
        <StripesShader
          className="connect-animations-canvas connect-animations-rain"
          config={asThemedEngineConfig(rain.config)}
          label="animations-rain"
          maxDpr={1.5}
          onShaderSourceError={(error) => {
            window.dispatchEvent(
              new CustomEvent<string | null>(RAIN_SHADER_ERROR_EVENT, {
                detail: error,
              })
            );
          }}
          ref={rainCanvasRef}
          rootMargin="240px"
          shaderSource={rain.shaderSource}
        />
      </div>
      {mounted && controls ? createPortal(controls, document.body) : null}
    </div>
  );
}
