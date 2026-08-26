import { StripesShader } from "@necatikcl/stripes-engine/react";
import type { SharedShaderHandle } from "@necatikcl/stripes-engine/react";
import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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
  CONNECT_TWIZZLER_DEFAULT,
  loadConnectTwizzlerControlSettings,
  resolveConnectTwizzlerSettings,
  type ConnectTwizzlerSettings,
} from "../hero/twizzler-control-settings";
import AnimationExportTools from "./AnimationExportTools";
import "./connect-animations.css";

const ConnectTwizzlerControls = lazy(() => import("../hero/ConnectTwizzlerControls"));
const PANEL_STORAGE_KEY = "connect:animations-controls-visible";
const ANIMATION_TARGETS = ["twizzler", "rain"] as const;

export default function ConnectAnimationsStage() {
  const [settings, setSettings] = useState<ConnectTwizzlerSettings>(CONNECT_TWIZZLER_DEFAULT);
  const [rain, setRain] = useState<ConnectHeroRain>(CONNECT_HERO_RAIN_DEFAULT);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const twizzlerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rainHandleRef = useRef<SharedShaderHandle | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const animationClockRef = useRef({
    elapsedSec: 0,
    lastNowMs: 0,
    speed: CONNECT_HERO_TWIZZLER_DEFAULTS.speed,
  });

  const getAnimationTimeSec = useCallback(() => {
    const now = performance.now();
    const clock = animationClockRef.current;
    if (clock.lastNowMs > 0) {
      clock.elapsedSec += ((now - clock.lastNowMs) / 1000) * clock.speed;
    }
    clock.lastNowMs = now;
    return clock.elapsedSec;
  }, []);

  const handleSettingsChange = useCallback(
    (next: ConnectTwizzlerSettings) => {
      getAnimationTimeSec();
      animationClockRef.current.speed = next.speed;
      setSettings(next);
    },
    [getAnimationTimeSec],
  );

  const handleRainHandle = useCallback((handle: SharedShaderHandle | null) => {
    rainHandleRef.current = handle;
  }, []);

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
    animationClockRef.current.lastNowMs = performance.now();
    const stored = loadConnectTwizzlerControlSettings();
    if (stored) {
      const restored = resolveConnectTwizzlerSettings(stored);
      animationClockRef.current.speed = restored.speed;
      setSettings(restored);
    }
    setRain(resolveConnectHeroRain(loadRainControlSettings()));
    const panelPreference = localStorage.getItem(PANEL_STORAGE_KEY);
    setPanelOpen(panelPreference === null ? true : panelPreference === "true");
  }, []);

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

  const controls = panelOpen ? (
    <Suspense fallback={null}>
      <ConnectTwizzlerControls
        onClose={() => setPanelVisible(false)}
        onRainChange={setRain}
        onSettingsChange={handleSettingsChange}
        targets={ANIMATION_TARGETS}
        toolsSlot={
          <AnimationExportTools
            getAnimationTimeSec={getAnimationTimeSec}
            rain={rain}
            rainCanvasRef={rainCanvasRef}
            rainHandleRef={rainHandleRef}
            settings={settings}
            stageRef={stageRef}
            twizzlerCanvasRef={twizzlerCanvasRef}
          />
        }
      />
    </Suspense>
  ) : null;

  return (
    <div
      className="connect-animations-root"
      style={{ background: rain.enabled ? rain.canvasBackground : settings.backgroundColor }}
    >
      <div className="connect-animations-stage" ref={stageRef}>
        {settings.enabled ? (
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
        ) : null}
        {rain.enabled ? (
          <StripesShader
            className="connect-animations-canvas connect-animations-rain"
            config={asThemedEngineConfig(rain.config)}
            label="animations-rain"
            maxDpr={1.5}
            onHandle={handleRainHandle}
            onShaderSourceError={(error) => {
              window.dispatchEvent(
                new CustomEvent<string | null>(RAIN_SHADER_ERROR_EVENT, {
                  detail: error,
                }),
              );
            }}
            ref={rainCanvasRef}
            rootMargin="240px"
            shaderSource={rain.shaderSource}
          />
        ) : null}
      </div>
      {mounted && controls ? createPortal(controls, document.body) : null}
    </div>
  );
}
