import {
  createCometLogoTextureRenderer,
  createStripesEngine,
  resolveThemedConfig,
  type StripesEngine,
  type ThemeName,
} from "@necatikcl/stripes-engine";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { asThemedEngineConfig } from "@/components/stripes-texture/config";
import { useStripesOff } from "@/components/stripes-texture/stripes-debug";
import {
  CTA_COMET_LOGO_SETTINGS,
  CTA_COMET_LOGO_SHAPE,
  CTA_TEXTURE_CONFIG,
} from "./texture-config";

const subscribeTheme = (onStoreChange: () => void) => {
  addEventListener("themechange", onStoreChange);
  return () => removeEventListener("themechange", onStoreChange);
};

const getTheme = (): ThemeName =>
  document.documentElement.dataset.theme === "dark" ? "dark" : "light";

const getServerTheme = (): ThemeName | null => null;

// Uncapped, the engine renders at raw devicePixelRatio — 2.25× this cap's
// pixel work on a 3× phone for no visible gain on a texture backdrop.
const MAX_DPR = 2;

const readDpr = (canvas: HTMLCanvasElement) =>
  Math.min(window.devicePixelRatio || 1, MAX_DPR) *
  (canvas.currentCSSZoom ?? 1);

export default function CtaTexture() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const stripesOff = useStripesOff();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);

  const config = resolveThemedConfig(
    asThemedEngineConfig({
      ...CTA_TEXTURE_CONFIG,
      stripesEnabled: !stripesOff,
      dark: { ...CTA_TEXTURE_CONFIG.dark, stripesEnabled: !stripesOff },
    }),
    theme ?? "light"
  );
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const readSize = () => {
      const rect = canvas.getBoundingClientRect();
      const zoom = canvas.currentCSSZoom ?? 1;
      return { width: rect.width / zoom, height: rect.height / zoom };
    };

    const size = readSize();
    const engine = createStripesEngine(canvas, { dpr: readDpr(canvas) });
    const comet = createCometLogoTextureRenderer(size.width, size.height, {
      shape: CTA_COMET_LOGO_SHAPE,
    });
    engineRef.current = engine;

    engine.setConfig(configRef.current);
    engine.resize(size.width, size.height);
    engine.setSource(comet.canvas);

    const primary = document.querySelector("[data-cta-primary]");

    const pointer = {
      x: comet.width / 2,
      y: comet.height / 2,
      hovered: primary?.matches(":hover") ?? false,
    };
    let timeSec = 0;
    let lastMs = performance.now();
    let frame = 0;
    let visible = false;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now();
      const deltaSec = Math.min(0.1, Math.max(0, (now - lastMs) / 1000));
      lastMs = now;

      timeSec += deltaSec;
      comet.render(timeSec, pointer, CTA_COMET_LOGO_SETTINGS);
      engine.updateSourceFrame(comet.canvas);
    };

    const start = () => {
      if (frame) return;
      lastMs = performance.now();
      frame = requestAnimationFrame(tick);
      engine.start();
    };

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
      engine.stop();
    };

    const renderObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting === visible) continue;
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      const next = readSize();
      if (next.width < 1 || next.height < 1) return;
      engine.setDpr(readDpr(canvas));
      engine.resize(next.width, next.height);
      comet.resize(next.width, next.height);
      engine.setSource(comet.canvas);
    });

    let inside = false;
    let lastClientX = Number.NaN;
    let lastClientY = Number.NaN;

    const hitTest = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const hit =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (hit) {
        const zoom = canvas.currentCSSZoom ?? 1;
        const width = rect.width / zoom;
        const height = rect.height / zoom;
        const x = (clientX - rect.left) / zoom;
        const y = (clientY - rect.top) / zoom;
        inside = true;
        pointer.x = (x / Math.max(1, width)) * comet.width;
        pointer.y = (y / Math.max(1, height)) * comet.height;
        engine.setCursor(x, y);
      } else if (inside) {
        inside = false;
        engine.setCursor(null);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      hitTest(lastClientX, lastClientY);
    };

    const onScroll = () => {
      if (!Number.isNaN(lastClientX)) hitTest(lastClientX, lastClientY);
    };

    const onDocumentLeave = () => {
      if (!inside) return;
      inside = false;
      engine.setCursor(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        return;
      const zoom = canvas.currentCSSZoom ?? 1;
      engine.click(
        (event.clientX - rect.left) / zoom,
        (event.clientY - rect.top) / zoom
      );
    };

    const onPrimaryEnter = () => {
      pointer.hovered = true;
    };

    const onPrimaryLeave = () => {
      pointer.hovered = false;
    };

    primary?.addEventListener("pointerenter", onPrimaryEnter);
    primary?.addEventListener("pointerleave", onPrimaryLeave);

    renderObserver.observe(canvas);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerleave", onDocumentLeave);

    return () => {
      primary?.removeEventListener("pointerenter", onPrimaryEnter);
      primary?.removeEventListener("pointerleave", onPrimaryLeave);
      renderObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerleave", onDocumentLeave);
      stop();
      engine.dispose();
      comet.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setConfig(config);
  }, [config]);

  return (
    <canvas
      aria-hidden
      className="pointer-events-none absolute centering-h-720 centering-w-1680 z-10"
      ref={canvasRef}
    />
  );
}
