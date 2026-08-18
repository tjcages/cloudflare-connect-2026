import { ConnectTwizzler } from "@tjcages/connect-twizzler/react";
import { useEffect, useState } from "react";
import {
  AGENDA_TWIZZLER_SETTINGS_EVENT,
  AGENDA_TWIZZLER_TARGETS,
  loadAgendaTwizzlerSettings,
  type AgendaTwizzlerSettingsEvent,
  type AgendaTwizzlerTarget,
} from "./agenda-twizzler-settings";

const MAX_DPR = 1.5;
const SOURCE_FPS = 30;

export default function AgendaTwizzlerOverlay() {
  const [settings, setSettings] = useState(() =>
    Object.fromEntries(
      AGENDA_TWIZZLER_TARGETS.map(({ id }) => [
        id,
        loadAgendaTwizzlerSettings(id),
      ])
    )
  );
  const [ready, setReady] = useState<Record<AgendaTwizzlerTarget, boolean>>(
    () =>
      Object.fromEntries(
        AGENDA_TWIZZLER_TARGETS.map(({ id }) => [id, false])
      ) as Record<AgendaTwizzlerTarget, boolean>
  );
  const allReady = AGENDA_TWIZZLER_TARGETS.every(({ id }) => ready[id]);

  useEffect(() => {
    const onSettings = (event: Event) => {
      const { target, settings: nextSettings } = (
        event as CustomEvent<AgendaTwizzlerSettingsEvent>
      ).detail;
      setSettings((current) => ({
        ...current,
        [target]: nextSettings,
      }));
    };
    window.addEventListener(AGENDA_TWIZZLER_SETTINGS_EVENT, onSettings);
    return () =>
      window.removeEventListener(AGENDA_TWIZZLER_SETTINGS_EVENT, onSettings);
  }, []);

  useEffect(() => {
    if (!allReady) return;

    const outputCanvas = document.querySelector<HTMLCanvasElement>(
      "[data-agenda-twizzler-output]"
    );
    if (!outputCanvas) return;

    const root = outputCanvas.closest<HTMLElement>(
      "[data-agenda-twizzler-root]"
    );
    const sourceCanvases = AGENDA_TWIZZLER_TARGETS.map(({ id }) =>
      root?.querySelector<HTMLCanvasElement>(
        `[data-agenda-twizzler-source="${id}"] canvas`
      )
    );
    const apertureElements = root
      ? Array.from(
          root.querySelectorAll<HTMLElement>("[data-agenda-twizzler-aperture]")
        )
      : [];
    const context = outputCanvas.getContext("2d");
    if (
      !root ||
      sourceCanvases.some((canvas) => !canvas) ||
      apertureElements.length !== sourceCanvases.length ||
      !context
    )
      return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let visible = false;
    let animationFrame = 0;

    const paint = () => {
      if (
        width < 1 ||
        height < 1 ||
        sourceCanvases.some((canvas) => !canvas || canvas.width < 1)
      )
        return;

      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      for (const [index, aperture] of apertureElements.entries()) {
        const rect = aperture.getBoundingClientRect();
        const sourceCanvas = sourceCanvases[index] as HTMLCanvasElement;
        context.drawImage(
          sourceCanvas,
          0,
          0,
          sourceCanvas.width,
          sourceCanvas.height,
          (rect.left - rootRect.left) / zoom,
          (rect.top - rootRect.top) / zoom,
          rect.width / zoom,
          rect.height / zoom
        );
      }
      outputCanvas.style.opacity = "1";
    };

    // The twizzler sources render at 30fps, so compositing faster than that
    // only re-blits identical frames (plus four layout reads per pass).
    const minFrameIntervalMs = 1000 / SOURCE_FPS - 1;
    let lastPaintMs = 0;
    const tick = (nowMs: number) => {
      if (!visible) return;
      animationFrame = requestAnimationFrame(tick);
      if (nowMs - lastPaintMs < minFrameIntervalMs) return;
      lastPaintMs = nowMs;
      paint();
    };

    const start = () => {
      if (!visible || animationFrame) return;
      if (reducedMotion.matches) {
        paint();
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const resize = () => {
      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      width = rootRect.width / zoom;
      height = rootRect.height / zoom;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      outputCanvas.width = Math.max(1, Math.round(width * dpr));
      outputCanvas.height = Math.max(1, Math.round(height * dpr));
      if (visible) paint();
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? false;
        if (visible) start();
        else stop();
      },
      { rootMargin: "240px" }
    );
    const resizeObserver = new ResizeObserver(resize);
    const onMotionChange = () => {
      stop();
      if (visible) start();
    };

    resize();
    intersectionObserver.observe(root);
    resizeObserver.observe(root);
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      stop();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, [allReady]);

  return (
    <>
      {AGENDA_TWIZZLER_TARGETS.map(({ id }) => (
        <div
          key={id}
          className="absolute inset-x-40 top-40 h-200 opacity-0"
          data-agenda-twizzler-source={id}
        >
          <ConnectTwizzler
            canvasClassName="size-full"
            className="size-full"
            maxDpr={MAX_DPR}
            maxFps={30}
            onReady={() => setReady((current) => ({ ...current, [id]: true }))}
            rootMargin="240px"
            settings={settings[id]}
          />
        </div>
      ))}
      <canvas
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-0 transition-opacity duration-300"
        data-agenda-twizzler-output
      />
    </>
  );
}
