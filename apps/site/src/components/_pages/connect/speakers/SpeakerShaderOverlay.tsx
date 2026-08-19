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
  SPEAKER_FRAME_VARIANT_IDS,
  speakerSharedEngineConfig,
  speakerVariantEngineConfig,
  type SpeakerFrameSettings,
  type SpeakerFrameVariantId,
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
  parseSpeakerWiperOverride,
  resolveSpeakerWipers,
  speakerWiperEngineConfig,
  speakerWiperOutlineColor,
} from "./speaker-wiper";

type Aperture = {
  image: HTMLImageElement;
  rect: Rect;
};

const isInside = (clientX: number, clientY: number, rect: DOMRect) =>
  clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;

const variantOutlineColor = (variant: SpeakerFrameVariantId, opacity: number) => {
  switch (variant) {
    case "orange":
      return `rgba(255, 191, 20, ${opacity})`;
    case "grey":
      return `rgba(214, 214, 214, ${opacity})`;
    default: {
      const unused: never = variant;
      return unused;
    }
  }
};

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

  context.strokeStyle = stroke(0.42 * opacity);
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
  context.lineTo(right, bottom - corner);
  context.moveTo(x + corner, bottom);
  context.lineTo(x, bottom);
  context.lineTo(x, bottom - corner);
  context.strokeStyle = stroke(0.95 * opacity);
  context.stroke();
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
    let animationFrame = 0;
    let visible = false;
    let disposed = false;
    let pointerInside = false;
    let lastClientX = Number.NaN;
    let lastClientY = Number.NaN;
    let cursorFrame: CursorFrameSeed | null = null;
    let cursorTarget: Point | null = null;
    const wiperStartedAtMs: (number | null)[] = apertureElements.map(() => null);
    const wiperProgressOverride = parseSpeakerWiperOverride(window.location.search);

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

    const paintLayer = (frames: Rect[], config: Partial<EngineConfig>, fill?: string) => {
      if (!engine || frames.length === 0) return;
      engine.setConfig(config);
      engine.renderFrame();
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
      if (fill) {
        outputContext.globalAlpha = 1;
        outputContext.fillStyle = fill;
        outputContext.fillRect(0, 0, width, height);
      }
      outputContext.globalAlpha = settingsRef.current.shaderOpacity;
      outputContext.drawImage(renderCanvas, 0, 0, width, height);

      const decorativeFrames = engine.readFramesOverlay();
      if (decorativeFrames) {
        paintFramesOverlay(outputContext, decorativeFrames);
      }
      outputContext.restore();
    };

    const paint = () => {
      const settings = settingsRef.current;
      const apertureRects = apertures.map(({ rect }) => rect);
      const authored = resolveAuthoredFrames(settings.placements, apertureRects);
      const wipers = resolveSpeakerWipers(apertureRects, wiperStartedAtMs, performance.now(), {
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
        for (const variant of SPEAKER_FRAME_VARIANT_IDS) {
          const frames = authored.filter((frame) => frame.variant === variant).map((frame) => frame.rect);
          if (variant === "orange" && pointerFrameRect) {
            frames.push(pointerFrameRect);
          }
          paintLayer(frames, {
            ...speakerVariantEngineConfig(settings, variant),
            background: SPEAKER_SHADER_CONFIG.background,
          });
        }
        paintLayer(
          wipers.filter((frame) => frame.pane === "inverted").map((frame) => frame.rect),
          speakerWiperEngineConfig(settings, "inverted"),
          "#ffbf14",
        );
        paintLayer(
          wipers.filter((frame) => frame.pane === "white").map((frame) => frame.rect),
          speakerWiperEngineConfig(settings, "white"),
          "#ffffff",
        );
      }

      outputContext.save();
      outputContext.beginPath();
      for (const band of portraitBands) {
        outputContext.rect(band.x, band.y, band.width, band.height);
      }
      outputContext.clip();
      for (const frame of authored) {
        paintPartialFrameOutline(outputContext, frame.rect, (opacity) => variantOutlineColor(frame.variant, opacity));
      }
      for (const frame of wipers) {
        paintPartialFrameOutline(outputContext, frame.rect, (opacity) => speakerWiperOutlineColor(frame.pane, opacity));
      }
      if (pointerFrameRect) {
        paintPartialFrameOutline(outputContext, pointerFrameRect, (opacity) => variantOutlineColor("orange", opacity));
      }
      outputContext.restore();
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
      if (!visible || disposed || !engine) return;
      animationFrame = requestAnimationFrame(tick);
      if (nowMs - lastFrameMs < minFrameIntervalMs) return;
      lastFrameMs = nowMs;
      clock.set(nowMs);
      renderOnce();
    };

    const start = () => {
      if (!engine) return;
      engine.setRevealGate(true);
      if (reducedMotion.matches) {
        clock.set(performance.now());
        renderOnce();
        return;
      }
      if (animationFrame) return;
      lastFrameMs = performance.now();
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

    const startWiper = (index: number) => {
      if (wiperStartedAtMs[index] != null) return;
      wiperStartedAtMs[index] = performance.now();
      if (reducedMotion.matches && visible) renderOnce();
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
          if (!entry.isIntersecting) continue;
          const index = apertureElements.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          startWiper(index);
        }
      },
      { threshold: 0.28, rootMargin: "0px 0px -10% 0px" },
    );
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
      engine.triggerReveal();

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
    }

    return () => {
      disposed = true;
      stop();
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
