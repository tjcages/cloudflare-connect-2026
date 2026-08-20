import {
  createManualClock,
  createStripesEngine,
  paintFramesOverlay,
  type EngineConfig,
  type StripesEngine,
} from "@necatikcl/stripes-engine";
import { useEffect, useRef } from "react";
import {
  loadSpeakerFrameSettings,
  SPEAKER_FRAME_DEFAULTS,
  SPEAKER_FRAME_SETTINGS_EVENT,
  speakerSharedEngineConfig,
  type SpeakerFrameSettings,
} from "./speaker-frame-controls";
import {
  buildPartialFramePlan,
  createCursorFrame,
  cursorFrameRect,
  mapClientPointToRoot,
  measureRelativeRect,
  moveCursorFrame,
  objectCoverSourceRect,
  resolveAuthoredFrames,
  resolvePortraitBands,
  type CursorFrameSeed,
  type Point,
  type Rect,
} from "./speaker-shader-geometry";
import { SPEAKER_SHADER_CONFIG, SPEAKER_SHADER_MAX_DPR } from "./speaker-shader-config";
import {
  armSpeakerWiper,
  commitPendingSpeakerWipers,
  parseSpeakerWiperOverride,
  replaySpeakerWiper,
  resetSpeakerWiper,
  resolveWipingFrames,
  speakerFrameOutlineColor,
  speakerFramePaintConfig,
  speakerWiperShouldEnter,
  speakerWiperShouldLeave,
  SPEAKER_WIPER_DURATION_MS,
  SPEAKER_WIPER_ENTER_RATIO,
  SPEAKER_WIPER_SHADER_DELAY_MS,
  type SpeakerWiperClock,
} from "./speaker-wiper";

type Aperture = {
  image: HTMLImageElement;
  rect: Rect;
};

const isInside = (clientX: number, clientY: number, rect: DOMRect) =>
  clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

const paintPartialFrameOutline = (
  context: CanvasRenderingContext2D,
  frame: Rect,
  stroke: (opacity: number) => string,
  opacity = 1,
) => {
  const { x, y, width, height } = frame;
  const right = x + width;
  const bottom = y + height;
  const corner = Math.min(12, width / 4, height / 4);

  const drawRect = (color: string, lineWidth: number) => {
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  };

  const drawCorners = (color: string, lineWidth: number) => {
    context.beginPath();
    context.moveTo(x, y + corner);
    context.lineTo(x, y);
    context.lineTo(x + corner, y);
    context.moveTo(right - corner, y);
    context.lineTo(right, y);
    context.lineTo(right, y + corner);
    context.moveTo(right, bottom - corner);
    context.lineTo(right, bottom);
    context.lineTo(right, bottom - corner);
    context.moveTo(x + corner, bottom);
    context.lineTo(x, bottom);
    context.lineTo(x, bottom - corner);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };

  drawRect("rgba(0, 0, 0, 0.45)", 3);
  drawCorners("rgba(0, 0, 0, 0.55)", 3);
  drawRect(stroke(0.7 * opacity), 1);
  drawCorners(stroke(opacity), 2);
};

export default function SpeakerShaderOverlay() {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<SpeakerFrameSettings>(SPEAKER_FRAME_DEFAULTS);

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
    const clock = createManualClock(performance.now());
    settingsRef.current = loadSpeakerFrameSettings();
    let engine: StripesEngine | null = null;
    let apertures: Aperture[] = [];
    let portraitBands: Rect[] = [];
    let width = 0;
    let height = 0;
    let renderDpr = 1;
    let lastFrameMs = 0;
    let wiperNowMs = 0;
    let animationFrame = 0;
    let visible = false;
    let disposed = false;
    let pointerInside = false;
    let lastClientX = Number.NaN;
    let lastClientY = Number.NaN;
    let cursorFrame: CursorFrameSeed | null = null;
    let cursorTarget: Point | null = null;

    const wiperClock: SpeakerWiperClock = {
      startedAtMs: apertureElements.map(() => null),
      pending: new Set<number>(),
    };
    const intersectingWipers = new Set<number>();
    const wiperProgressOverride = parseSpeakerWiperOverride(window.location.search);
    let shaderReadyAtMs: number | null = null;

    const wiperStartDelayMs = () => {
      if (reducedMotion.matches || typeof wiperProgressOverride === "number") return 0;
      if (shaderReadyAtMs == null) return SPEAKER_WIPER_SHADER_DELAY_MS;
      return Math.max(0, shaderReadyAtMs - performance.now());
    };

    const applyPortraitOpacity = () => {
      images.forEach((image, index) => {
        if (!image) return;
        if (reducedMotion.matches) {
          image.style.opacity = "1";
          return;
        }
        const startedAt = wiperClock.startedAtMs[index];
        const visibleUnderIris =
          typeof wiperProgressOverride === "number" || (startedAt != null && wiperNowMs - startedAt >= 0);
        image.style.opacity = visibleUnderIris ? "1" : "0";
      });
    };

    const revealPortraits = () => {
      for (const image of images) {
        if (image) image.style.opacity = "1";
      }
    };

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

    const compositeLayer = (frames: Rect[], source: CanvasImageSource, includeDecorative: boolean) => {
      if (!engine || frames.length === 0) return;
      const plan = buildPartialFramePlan(
        frames,
        apertures.map(({ rect }) => rect),
      );
      if (plan.renderPasses === 0) return;

      outputContext.save();
      outputContext.beginPath();
      for (const { rect } of plan.maskFragments) {
        outputContext.rect(rect.x, rect.y, rect.width, rect.height);
      }
      outputContext.clip();
      outputContext.globalAlpha = settingsRef.current.shaderOpacity;
      outputContext.drawImage(source, 0, 0, width, height);

      if (includeDecorative) {
        const decorativeFrames = engine.readFramesOverlay();
        if (decorativeFrames) {
          paintFramesOverlay(outputContext, decorativeFrames);
        }
      }
      outputContext.restore();
    };

    const paintLayer = (frames: Rect[], config: Partial<EngineConfig>) => {
      if (!engine || frames.length === 0) return;
      engine.setConfig(config);
      engine.renderFrame();
      compositeLayer(frames, renderCanvas, true);
    };

    const paint = () => {
      const settings = settingsRef.current;
      const apertureRects = apertures.map(({ rect }) => rect);
      const authored = resolveAuthoredFrames(settings.placements, apertureRects);
      const frames = resolveWipingFrames(authored, apertureRects, wiperClock.startedAtMs, wiperNowMs, {
        reducedMotion: reducedMotion.matches,
        progressOverride: wiperProgressOverride,
      });
      if (cursorFrame && cursorTarget) {
        cursorFrame = moveCursorFrame(cursorFrame, cursorTarget, portraitBands, {
          widthScale: settings.cursorWidth,
          heightScale: settings.cursorHeight,
          follow: reducedMotion.matches ? 1 : settings.cursorFollow,
        });
      }
      const pointerFrameRect = cursorFrame ? cursorFrameRect(cursorFrame) : null;

      outputContext.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      outputContext.clearRect(0, 0, width, height);

      if (engine) {
        const trailEnabled = settings.trailEnabled && !reducedMotion.matches;
        const overlayTrail = {
          ...SPEAKER_SHADER_CONFIG.cursorTrail,
          enabled: trailEnabled,
          particleRadius: settings.trailRadius,
          particleAlpha: settings.trailAlpha,
          particleLifeMs: settings.trailLife,
          pushStrengthPx: settings.trailPush,
        };
        const idleTrail = { ...overlayTrail, particleAlpha: 0, pushStrengthPx: 0 };
        engine.setCursor(null);
        const paintOrder = ["orange", "grey"] as const;
        for (const variant of paintOrder) {
          const variantFrames = frames.filter((frame) => frame.variant === variant).map((frame) => frame.rect);
          const config = {
            ...speakerSharedEngineConfig(settings),
            ...speakerFramePaintConfig(settings, variant),
            cursorTrail: idleTrail,
          };
          switch (variant) {
            case "orange":
              paintLayer(variantFrames, config);
              break;
            case "grey":
              paintLayer(variantFrames, config);
              if (pointerInside && pointerFrameRect && !reducedMotion.matches) {
                if (!Number.isNaN(lastClientX)) updatePointer(lastClientX, lastClientY);
                paintLayer([pointerFrameRect], { ...config, cursorTrail: overlayTrail });
              }
              break;
            default: {
              const unused: never = variant;
              throw new Error(`Unhandled speaker frame variant: ${String(unused)}`);
            }
          }
        }
      }

      outputContext.save();
      outputContext.beginPath();
      for (const band of portraitBands) {
        outputContext.rect(band.x, band.y, band.width, band.height);
      }
      outputContext.clip();
      for (const frame of frames) {
        if (frame.variant !== "grey") continue;
        paintPartialFrameOutline(outputContext, frame.rect, (opacity) =>
          speakerFrameOutlineColor("#ffffff", opacity),
        );
      }
      outputContext.restore();
      applyPortraitOpacity();
    };

    const renderOnce = () => {
      if (!engine || width < 1 || height < 1) return;
      paint();
      outputCanvas.style.opacity = "1";
    };

    // Cap the loop at 60fps: a 120Hz display otherwise doubles the full
    // engine render + canvas2d composite for motion nobody can distinguish.
    const minFrameIntervalMs = 1_000 / 60 - 1;
    const tick = (nowMs: number) => {
      if (!visible || disposed || !engine) {
        animationFrame = 0;
        return;
      }
      animationFrame = requestAnimationFrame(tick);
      const hasPendingWiper = wiperClock.pending.size > 0;
      if (!hasPendingWiper && nowMs - lastFrameMs < minFrameIntervalMs) return;
      lastFrameMs = nowMs;
      commitPendingSpeakerWipers(wiperClock, nowMs, wiperStartDelayMs());
      wiperNowMs = nowMs;
      clock.set(nowMs);
      renderOnce();
    };

    const replayIdleWipers = () => {
      const nowMs = performance.now();
      const playingWindowMs = SPEAKER_WIPER_SHADER_DELAY_MS + SPEAKER_WIPER_DURATION_MS;
      for (const index of intersectingWipers) {
        if (wiperClock.pending.has(index)) continue;
        const startedAt = wiperClock.startedAtMs[index];
        if (startedAt != null && nowMs - startedAt < playingWindowMs) continue;
        replayWiper(index);
      }
    };

    const start = () => {
      if (!engine) return;
      engine.setRevealGate(true);
      engine.triggerReveal();
      shaderReadyAtMs = performance.now() + (reducedMotion.matches ? 0 : SPEAKER_WIPER_SHADER_DELAY_MS);
      if (reducedMotion.matches) {
        replayIdleWipers();
        wiperNowMs = performance.now();
        clock.set(wiperNowMs);
        renderOnce();
        return;
      }
      if (animationFrame) return;
      replayIdleWipers();
      lastFrameMs = performance.now();
      wiperNowMs = lastFrameMs;
      clock.set(lastFrameMs);
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
      cursorFrame = null;
      cursorTarget = null;
      drawSource();
      if (visible && reducedMotion.matches) renderOnce();
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rootRect = root.getBoundingClientRect();
      if (!isInside(clientX, clientY, rootRect)) {
        if (pointerInside) engine?.setCursor(null);
        pointerInside = false;
        return null;
      }

      const point = mapClientPointToRoot(clientX, clientY, rootRect, root.currentCSSZoom || 1);
      pointerInside = true;
      engine?.setCursor(point.x, point.y);
      return point;
    };

    const updateCursorFrame = (point: Point) => {
      cursorTarget = point;
      cursorFrame ??= createCursorFrame(point, portraitBands, {
        widthScale: settingsRef.current.cursorWidth,
        heightScale: settingsRef.current.cursorHeight,
      });
      if (reducedMotion.matches) renderOnce();
    };

    const onPointerMove = (event: PointerEvent) => {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
      const point = updatePointer(lastClientX, lastClientY);
      if (point) updateCursorFrame(point);
    };

    const onPointerLeave = () => {
      pointerInside = false;
      engine?.setCursor(null);
      cursorFrame = null;
      cursorTarget = null;
      if (reducedMotion.matches) renderOnce();
    };

    const onPointerDown = (event: PointerEvent) => {
      const rootRect = root.getBoundingClientRect();
      if (!isInside(event.clientX, event.clientY, rootRect)) return;
      const point = mapClientPointToRoot(event.clientX, event.clientY, rootRect, root.currentCSSZoom || 1);
      engine?.click(point.x, point.y);
    };

    const applyFrameSettings = (settings: SpeakerFrameSettings) => {
      settingsRef.current = settings;
      engine?.setConfig({
        ...speakerSharedEngineConfig(settings),
        cursorTrail: {
          ...SPEAKER_SHADER_CONFIG.cursorTrail,
          enabled: settings.trailEnabled && !reducedMotion.matches,
          particleRadius: settings.trailRadius,
          particleAlpha: settings.trailAlpha,
          particleLifeMs: settings.trailLife,
          pushStrengthPx: settings.trailPush,
        },
      });
      if (visible && reducedMotion.matches) renderOnce();
    };

    const onFrameSettings = (event: Event) => {
      applyFrameSettings((event as CustomEvent<SpeakerFrameSettings>).detail);
    };

    const onScroll = () => {
      if (!Number.isNaN(lastClientX)) {
        updatePointer(lastClientX, lastClientY);
      }
    };

    const isImageReady = (index: number) => {
      const image = images[index];
      return Boolean(image?.complete && image.naturalWidth > 0);
    };

    const armWiper = (index: number) => {
      const result = armSpeakerWiper(wiperClock, index, {
        imageReady: isImageReady(index),
        reducedMotion: reducedMotion.matches,
        nowMs: performance.now(),
      });
      if (result === "rest" && visible) renderOnce();
    };

    const replayWiper = (index: number) => {
      const result = replaySpeakerWiper(wiperClock, index, {
        imageReady: isImageReady(index),
        reducedMotion: reducedMotion.matches,
        nowMs: performance.now(),
      });
      if (result === "rest" && visible) renderOnce();
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver((entries) => {
      const nextVisible = entries.some((entry) => entry.isIntersecting);
      if (nextVisible === visible) return;
      visible = nextVisible;
      if (visible) start();
      else stop();
    });
    const wiperObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = apertureElements.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          if (speakerWiperShouldEnter(entry.intersectionRatio)) {
            intersectingWipers.add(index);
            armWiper(index);
            continue;
          }
          if (!speakerWiperShouldLeave(entry.intersectionRatio)) continue;
          const wasTracking = intersectingWipers.delete(index);
          if (!wasTracking) continue;
          resetSpeakerWiper(wiperClock, index);
          const image = images[index];
          if (image && !reducedMotion.matches) image.style.opacity = "0";
          if (visible && reducedMotion.matches) renderOnce();
        }
      },
      { threshold: [0, SPEAKER_WIPER_ENTER_RATIO] },
    );
    const imageLoadHandlers = images.map((image, index) => {
      if (!image) return null;
      const handler = () => {
        drawSource();
        if (intersectingWipers.has(index)) armWiper(index);
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
      engine = createStripesEngine(renderCanvas, {
        dpr: renderDpr,
        seed: 1,
        clock,
      });
      engine.setConfig(SPEAKER_SHADER_CONFIG);
      applyFrameSettings(settingsRef.current);
      if (reducedMotion.matches) {
        engine.setConfig({
          reveal: { ...SPEAKER_SHADER_CONFIG.reveal, enabled: false },
          cursorTrail: { ...SPEAKER_SHADER_CONFIG.cursorTrail, enabled: false },
          clickWave: { ...SPEAKER_SHADER_CONFIG.clickWave, enabled: false },
        });
      }
      resize();

      resizeObserver.observe(root);
      for (const element of apertureElements) {
        resizeObserver.observe(element);
        wiperObserver.observe(element);
      }
      intersectionObserver.observe(root);
      root.addEventListener("pointermove", onPointerMove);
      root.addEventListener("pointerleave", onPointerLeave);
      root.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener(SPEAKER_FRAME_SETTINGS_EVENT, onFrameSettings);
    } catch (error) {
      console.warn("Speaker shader unavailable; preserving portrait fallback.", error);
      revealPortraits();
    }

    return () => {
      disposed = true;
      stop();
      for (const image of images) {
        if (image) image.style.opacity = "";
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      wiperObserver.disconnect();
      for (const listener of imageLoadHandlers) {
        if (!listener) continue;
        listener.image.removeEventListener("load", listener.handler);
      }
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener(SPEAKER_FRAME_SETTINGS_EVENT, onFrameSettings);
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
