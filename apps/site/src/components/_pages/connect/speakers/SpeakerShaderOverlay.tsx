import { createStripesEngine, paintFramesOverlay, type StripesEngine } from "@necatikcl/stripes-engine";
import { useEffect, useRef } from "react";
import {
  buildPartialFramePlan,
  mapClientPointToRoot,
  measureRelativeRect,
  objectCoverSourceRect,
  resolveFloatingFrames,
  resolvePortraitBands,
  type Rect,
} from "./speaker-shader-geometry";
import { SPEAKER_SHADER_CONFIG, SPEAKER_SHADER_MAX_DPR } from "./speaker-shader-config";

type Aperture = {
  image: HTMLImageElement;
  rect: Rect;
};

const isInside = (clientX: number, clientY: number, rect: DOMRect) =>
  clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

const paintPartialFrameOutline = (context: CanvasRenderingContext2D, frame: Rect) => {
  const { x, y, width, height } = frame;
  const right = x + width;
  const bottom = y + height;
  const corner = Math.min(12, width / 4, height / 4);

  context.strokeStyle = "rgba(255, 191, 20, 0.42)";
  context.lineWidth = 1;
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  context.beginPath();
  context.moveTo(x, y + corner);
  context.lineTo(x, y);
  context.lineTo(x + corner, y);
  context.moveTo(right - corner, y);
  context.lineTo(right, y);
  context.lineTo(right, y + corner);
  context.moveTo(right, bottom - corner);
  context.lineTo(right, bottom);
  context.lineTo(right - corner, bottom);
  context.moveTo(x + corner, bottom);
  context.lineTo(x, bottom);
  context.lineTo(x, bottom - corner);
  context.strokeStyle = "rgba(255, 191, 20, 0.95)";
  context.stroke();
};

export default function SpeakerShaderOverlay() {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const outputCanvas = outputRef.current;
    const renderCanvas = renderRef.current;
    if (!outputCanvas || !renderCanvas) return;

    const root = outputCanvas.closest<HTMLElement>("[data-speaker-shader-root]");
    if (!root) return;

    const apertureElements = Array.from(root.querySelectorAll<HTMLElement>("[data-speaker-shader-aperture]"));
    const images = apertureElements.map((element) => element.querySelector<HTMLImageElement>("img"));
    if (apertureElements.length === 0 || images.some((image) => !image)) return;

    const outputContext = outputCanvas.getContext("2d");
    const sourceCanvas = document.createElement("canvas");
    const sourceContext = sourceCanvas.getContext("2d");
    if (!outputContext || !sourceContext) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let engine: StripesEngine | null = null;
    let apertures: Aperture[] = [];
    let portraitBands: Rect[] = [];
    let width = 0;
    let height = 0;
    let renderDpr = 1;
    let animationTimeSec = 0;
    let lastFrameMs = 0;
    let animationFrame = 0;
    let visible = false;
    let disposed = false;
    let pointerInside = false;
    let lastClientX = Number.NaN;
    let lastClientY = Number.NaN;

    const readGeometry = () => {
      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      width = rootRect.width / zoom;
      height = rootRect.height / zoom;
      apertures = apertureElements.map((element, index) => ({
        image: images[index] as HTMLImageElement,
        rect: measureRelativeRect(rootRect, element.getBoundingClientRect(), zoom),
      }));
      portraitBands = resolvePortraitBands(
        apertures.map(({ rect }) => rect),
        width,
      );
    };

    const drawSource = () => {
      sourceContext.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      sourceContext.clearRect(0, 0, width, height);

      for (const { image, rect } of apertures) {
        if (!image.complete || image.naturalWidth === 0) continue;
        const source = objectCoverSourceRect(
          { width: image.naturalWidth, height: image.naturalHeight },
          { width: rect.width, height: rect.height },
        );
        sourceContext.drawImage(
          image,
          source.x,
          source.y,
          source.width,
          source.height,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
        );
      }

      engine?.setSource(sourceCanvas);
    };

    const paint = () => {
      const frames = resolveFloatingFrames(animationTimeSec, portraitBands, reducedMotion.matches);
      const plan = buildPartialFramePlan(
        frames,
        apertures.map(({ rect }) => rect),
      );

      outputContext.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      outputContext.clearRect(0, 0, width, height);

      if (plan.renderPasses === 1) {
        outputContext.save();
        outputContext.beginPath();
        for (const { rect } of plan.maskFragments) {
          outputContext.rect(rect.x, rect.y, rect.width, rect.height);
        }
        outputContext.clip();
        outputContext.drawImage(renderCanvas, 0, 0, width, height);

        const decorativeFrames = engine?.readFramesOverlay();
        if (decorativeFrames) {
          paintFramesOverlay(outputContext, decorativeFrames);
        }

        outputContext.restore();
      }

      outputContext.save();
      outputContext.beginPath();
      for (const band of portraitBands) {
        outputContext.rect(band.x, band.y, band.width, band.height);
      }
      outputContext.clip();
      for (const outline of plan.outlines) {
        paintPartialFrameOutline(outputContext, outline);
      }
      outputContext.restore();
    };

    const renderOnce = () => {
      if (!engine || width < 1 || height < 1) return;
      engine.renderFrame();
      paint();
      outputCanvas.style.opacity = "1";
    };

    const tick = (nowMs: number) => {
      if (!visible || disposed || !engine) return;
      const deltaSec = Math.min(0.05, Math.max(0, (nowMs - lastFrameMs) / 1_000));
      lastFrameMs = nowMs;
      animationTimeSec += deltaSec;
      renderOnce();
      animationFrame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!engine) return;
      engine.setRevealGate(true);
      if (reducedMotion.matches) {
        renderOnce();
        return;
      }
      if (animationFrame) return;
      lastFrameMs = performance.now();
      animationFrame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      engine?.setRevealGate(false);
      engine?.settle();
    };

    const resize = () => {
      readGeometry();
      if (width < 1 || height < 1) return;

      renderDpr = Math.min(window.devicePixelRatio || 1, SPEAKER_SHADER_MAX_DPR);
      const pixelWidth = Math.max(1, Math.round(width * renderDpr));
      const pixelHeight = Math.max(1, Math.round(height * renderDpr));
      outputCanvas.width = pixelWidth;
      outputCanvas.height = pixelHeight;
      sourceCanvas.width = pixelWidth;
      sourceCanvas.height = pixelHeight;
      engine?.resize(width, height);
      drawSource();
      if (visible && reducedMotion.matches) renderOnce();
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rootRect = root.getBoundingClientRect();
      if (!isInside(clientX, clientY, rootRect)) {
        if (pointerInside) engine?.setCursor(null);
        pointerInside = false;
        return;
      }

      const point = mapClientPointToRoot(clientX, clientY, rootRect, root.currentCSSZoom || 1);
      pointerInside = true;
      engine?.setCursor(point.x, point.y);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      updatePointer(lastClientX, lastClientY);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      engine?.setCursor(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      const rootRect = root.getBoundingClientRect();
      if (!isInside(event.clientX, event.clientY, rootRect)) return;
      const point = mapClientPointToRoot(event.clientX, event.clientY, rootRect, root.currentCSSZoom || 1);
      engine?.click(point.x, point.y);
    };

    const onScroll = () => {
      if (!Number.isNaN(lastClientX)) {
        updatePointer(lastClientX, lastClientY);
      }
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver((entries) => {
      const nextVisible = entries.some((entry) => entry.isIntersecting);
      if (nextVisible === visible) return;
      visible = nextVisible;
      if (visible) start();
      else stop();
    });
    const imageLoadHandlers = images.map((image) => {
      if (!image) return null;
      const handler = () => {
        drawSource();
        if (visible && reducedMotion.matches) renderOnce();
      };
      // Paired with the explicit imageLoadHandlers cleanup below.
      // eslint-disable-next-line @eslint-react/web-api-no-leaked-event-listener
      image.addEventListener("load", handler);
      return { image, handler };
    });

    try {
      readGeometry();
      renderDpr = Math.min(window.devicePixelRatio || 1, SPEAKER_SHADER_MAX_DPR);
      engine = createStripesEngine(renderCanvas, { dpr: renderDpr, seed: 1 });
      engine.setConfig(SPEAKER_SHADER_CONFIG);
      if (reducedMotion.matches) {
        engine.setConfig({
          reveal: { ...SPEAKER_SHADER_CONFIG.reveal, enabled: false },
          cursorTrail: { ...SPEAKER_SHADER_CONFIG.cursorTrail, enabled: false },
          clickWave: { ...SPEAKER_SHADER_CONFIG.clickWave, enabled: false },
        });
      }
      resize();
      engine.triggerReveal();

      resizeObserver.observe(root);
      for (const element of apertureElements) resizeObserver.observe(element);
      intersectionObserver.observe(root);
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
      root.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("scroll", onScroll, true);
    } catch (error) {
      console.warn("Speaker shader unavailable; preserving portrait fallback.", error);
    }

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      for (const listener of imageLoadHandlers) {
        if (!listener) continue;
        listener.image.removeEventListener("load", listener.handler);
      }
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      engine?.dispose();
      engine = null;
    };
  }, []);

  return (
    <>
      <canvas aria-hidden className="pointer-events-none absolute inset-0 z-10 size-full opacity-0" ref={outputRef} />
      <canvas aria-hidden className="pointer-events-none absolute inset-0 size-full opacity-0" ref={renderRef} />
    </>
  );
}
