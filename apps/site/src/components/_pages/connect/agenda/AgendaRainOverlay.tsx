import {
  createStripesEngine,
  type EngineConfig,
  type StripesEngine,
} from "@necatikcl/stripes-engine";
import { useEffect, useRef } from "react";
import { AGENDA_RAIN_CONFIG, AGENDA_RAIN_MAX_DPR } from "./agenda-rain-config";
import {
  AGENDA_RAIN_DEFAULTS,
  AGENDA_RAIN_SETTINGS_EVENT,
  loadAgendaRainSettings,
  type AgendaRainSettings,
} from "./agenda-rain-controls";
import {
  createRainTextureRenderer,
  DEFAULT_RAIN_SHADER_ID,
  DEFAULT_RAIN_SHADER_SOURCE,
  type RainTextureRenderer,
} from "./rain-texture-source";

/** Shader time used for the single static frame under reduced motion. */
const STATIC_TIME_SEC = 6;

/** Cap on the shader source canvas's longest side. */
const SOURCE_MAX_DIM = 2048;

type Rect = { x: number; y: number; width: number; height: number };

const colorNumber = (value: string, fallback: number) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^[\da-f]{6}$/i.test(normalized)) return fallback;
  return Number.parseInt(normalized, 16);
};

/**
 * One rain shader for all three agenda panels. A single stripes engine spans
 * the agenda root, fed by the shared "Wave to Full Screen" texture source,
 * and the day panels act as apertures: the output canvas clips the engine's
 * frame to each panel rect, so the same animation flows uninterrupted from
 * panel to panel — the same shared-context masking the speakers section uses.
 */
export default function AgendaRainOverlay() {
  const outputRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<AgendaRainSettings>(AGENDA_RAIN_DEFAULTS);

  useEffect(() => {
    const outputCanvas = outputRef.current;
    const renderCanvas = renderRef.current;
    if (!outputCanvas || !renderCanvas) return;

    const root = outputCanvas.closest<HTMLElement>("[data-agenda-rain-root]");
    if (!root) return;

    const apertureElements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-agenda-rain-aperture]")
    );
    const outputContext = outputCanvas.getContext("2d");
    if (apertureElements.length === 0 || !outputContext) return;

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    settingsRef.current = loadAgendaRainSettings();
    let engine: StripesEngine | null = null;
    let rainSource: RainTextureRenderer | null = null;
    let apertures: Rect[] = [];
    let width = 0;
    let height = 0;
    let renderDpr = 1;
    let shaderTimeSec = 0;
    let lastFrameMs = 0;
    let animationFrame = 0;
    let visible = false;
    let disposed = false;
    let appliedShaderId = DEFAULT_RAIN_SHADER_ID;

    const readGeometry = () => {
      const rootRect = root.getBoundingClientRect();
      const zoom = root.currentCSSZoom || 1;
      width = rootRect.width / zoom;
      height = rootRect.height / zoom;
      apertures = apertureElements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: (rect.left - rootRect.left) / zoom,
          y: (rect.top - rootRect.top) / zoom,
          width: rect.width / zoom,
          height: rect.height / zoom,
        };
      });
    };

    const paint = () => {
      outputContext.setTransform(renderDpr, 0, 0, renderDpr, 0, 0);
      outputContext.clearRect(0, 0, width, height);
      outputContext.globalAlpha = settingsRef.current.shaderOpacity;
      // Blit each aperture's slice of the shared frame instead of clipping a
      // full-root draw — the panels cover a fraction of the root, and 2D
      // drawImage from a WebGL canvas is the expensive step here.
      const scaleX = renderCanvas.width / width;
      const scaleY = renderCanvas.height / height;
      for (const rect of apertures) {
        if (rect.width < 1 || rect.height < 1) continue;
        outputContext.drawImage(
          renderCanvas,
          rect.x * scaleX,
          rect.y * scaleY,
          rect.width * scaleX,
          rect.height * scaleY,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );
      }
      outputContext.globalAlpha = 1;
    };

    const renderOnce = () => {
      if (!engine || !rainSource || width < 1 || height < 1) return;
      const settings = settingsRef.current;
      rainSource.render(
        reducedMotion.matches ? STATIC_TIME_SEC : shaderTimeSec,
        {
          rotateXDeg: settings.sourceRotateX,
          rotateYDeg: settings.sourceRotateY,
          rotateZDeg: settings.sourceRotateZ,
          zoom: settings.sourceZoom,
          panX: settings.sourcePanX,
          panY: settings.sourcePanY,
        }
      );
      engine.updateSourceFrame(rainSource.canvas);
      engine.renderFrame();
      paint();
      outputCanvas.style.opacity = "1";
    };

    const tick = (nowMs: number) => {
      if (!visible || disposed || !engine) return;
      const deltaSec = Math.min(
        0.05,
        Math.max(0, (nowMs - lastFrameMs) / 1_000)
      );
      lastFrameMs = nowMs;
      shaderTimeSec += deltaSec * settingsRef.current.sourceSpeed;
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

    // The source must match the root's aspect: the engine fits it by width,
    // so a squarer canvas would collapse the texture to a fraction of the
    // section's height instead of flowing through all three panels.
    const resizeSource = () => {
      if (!rainSource || width < 1 || height < 1) return;
      const scale = settingsRef.current.sourceScale;
      const cap = Math.min(
        1,
        SOURCE_MAX_DIM / Math.max(width * scale, height * scale)
      );
      rainSource.resize(width * scale * cap, height * scale * cap);
    };

    const resize = () => {
      readGeometry();
      if (width < 1 || height < 1) return;

      renderDpr = Math.min(window.devicePixelRatio || 1, AGENDA_RAIN_MAX_DPR);
      outputCanvas.width = Math.max(1, Math.round(width * renderDpr));
      outputCanvas.height = Math.max(1, Math.round(height * renderDpr));
      engine?.resize(width, height);
      resizeSource();
      if (visible && reducedMotion.matches) renderOnce();
    };

    const applyShaderSource = (source: string, id: string) => {
      const error = rainSource?.setSource(source);
      if (error) {
        console.warn(`Agenda rain shader "${id}" failed to compile.`, error);
        return;
      }
      appliedShaderId = id;
      if (visible && reducedMotion.matches) renderOnce();
    };

    const applyShaderPreset = (id: string) => {
      if (!rainSource || id === appliedShaderId) return;
      if (id === DEFAULT_RAIN_SHADER_ID) {
        applyShaderSource(DEFAULT_RAIN_SHADER_SOURCE, id);
        return;
      }
      // The library ships every lab shader (~95KB of GLSL); load it only
      // when a non-default preset is actually picked.
      void import("./rain-shader-library").then(({ findRainShaderSource }) => {
        if (disposed || settingsRef.current.shaderPreset !== id) return;
        const source = findRainShaderSource(id);
        if (source) applyShaderSource(source, id);
        else console.warn(`Unknown agenda rain shader preset "${id}".`);
      });
    };

    const applySettings = (settings: AgendaRainSettings) => {
      settingsRef.current = settings;
      applyShaderPreset(settings.shaderPreset);
      resizeSource();
      engine?.setConfig({
        grid: {
          ...AGENDA_RAIN_CONFIG.grid,
          cellWidth: settings.gridCellWidth,
          cellHeight: settings.gridCellHeight,
          gapX: settings.gridGapX,
          gapY: settings.gridGapY,
          cornerRadius: settings.gridCornerRadius,
          overlapAmount: settings.gridOverlap,
          orientation: settings.gridOrientation,
          angleDeg: settings.gridAngle,
          streamGapWave: {
            enabled: settings.waveEnabled,
            squeeze: settings.waveSqueeze,
            wavelengthCells: settings.waveWavelengthCells,
            speed: settings.waveSpeed,
            phaseDeg: settings.wavePhaseDeg,
          },
        },
        sparkle: {
          gaps: {
            enabled: settings.rainEnabled,
            coverage: settings.gapsCoverage,
            speed: settings.gapsSpeed,
          },
          width: {
            ...AGENDA_RAIN_CONFIG.sparkle.width,
            enabled: settings.sparkleWidthEnabled,
            coverage: settings.sparkleWidthCoverage,
            swingPx: settings.sparkleSwing,
          },
          stripe: {
            ...AGENDA_RAIN_CONFIG.sparkle.stripe,
            enabled: settings.sparkleStripeEnabled,
            coverage: settings.sparkleStripeCoverage,
            maxBrightness: settings.sparkleBrightness,
            speed: settings.sparkleSpeed,
            hueDriftDeg: settings.sparkleHueDrift,
            saturationBoost: settings.sparkleSaturation,
          },
          motion: {
            enabled: settings.motionEnabled,
            amplitudePx: settings.motionAmplitude,
            staggerPx: settings.motionStagger,
            maxOffsetPx: settings.motionMaxOffset,
            speed: settings.motionSpeed,
            direction: settings.motionDirection,
          },
        },
        stripeDots: {
          enabled: settings.dotsEnabled,
          density: settings.dotsDensity,
          randomVisibility: settings.dotsVisibility,
          sizePx: settings.dotsSize,
          brightness: settings.dotsBrightness,
          hueDriftDeg: settings.dotsHueDrift,
          saturationBoost: settings.dotsSaturation,
        },
        stripeBorder: {
          enabled: settings.borderEnabled,
          minWidthPx: settings.borderMinWidth,
          density: settings.borderDensity,
        },
        gridLines: {
          enabled: settings.gridLinesEnabled,
          brightness: settings.gridLinesBrightness,
          density: settings.gridLinesDensity,
        },
        stripesEnabled: settings.stripesEnabled,
        fieldScale: settings.fieldScale,
        stripes: settings.stripes.map((stripe) => ({
          color: colorNumber(stripe.color, AGENDA_RAIN_CONFIG.stripes[0].color),
          startFrom: stripe.startFrom,
          width: stripe.width,
          opacity: stripe.opacity,
        })),
        adjustments: {
          ...AGENDA_RAIN_CONFIG.adjustments,
          brightness: settings.brightness,
          exposure: settings.exposure,
          contrast: settings.contrast,
          blackPoint: settings.blackPoint,
          whitePoint: settings.whitePoint,
          gamma: settings.gamma,
          invert: settings.invert,
          posterizeLevels: settings.posterizeLevels,
          thresholdBias: settings.thresholdBias,
          noiseAmount: settings.noiseAmount,
          blurRadius: settings.blurRadius,
          sharpenAmount: settings.sharpenAmount,
        },
        background: {
          ...AGENDA_RAIN_CONFIG.background,
          transparent: settings.backgroundTransparent,
          color: colorNumber(
            settings.backgroundColor,
            AGENDA_RAIN_CONFIG.background.color
          ),
          stars: {
            ...AGENDA_RAIN_CONFIG.background.stars,
            enabled: settings.starsEnabled && !reducedMotion.matches,
          },
          meteors: {
            ...AGENDA_RAIN_CONFIG.background.meteors,
            enabled: settings.meteorsEnabled && !reducedMotion.matches,
          },
        },
        flames: {
          ...AGENDA_RAIN_CONFIG.flames,
          enabled: settings.flamesEnabled && !reducedMotion.matches,
        },
        colors: {
          ...AGENDA_RAIN_CONFIG.colors,
          mode: settings.colorMode,
          stripeBlendMode:
            settings.stripeBlendMode as EngineConfig["colors"]["stripeBlendMode"],
        },
        renderMode: settings.renderMode as EngineConfig["renderMode"],
        renderIntensity: settings.renderIntensity,
        renderParams: [
          settings.renderParamA,
          settings.renderParamB,
          settings.renderParamC,
          settings.renderParamD,
        ],
        renderColorA: colorNumber(
          settings.renderColorA,
          AGENDA_RAIN_CONFIG.renderColorA
        ),
        renderColorB: colorNumber(
          settings.renderColorB,
          AGENDA_RAIN_CONFIG.renderColorB
        ),
      });
      if (visible && reducedMotion.matches) renderOnce();
    };

    const onSettings = (event: Event) => {
      applySettings((event as CustomEvent<AgendaRainSettings>).detail);
    };

    const onMotionChange = () => {
      stop();
      applySettings(settingsRef.current);
      if (visible) start();
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const nextVisible = entries.some((entry) => entry.isIntersecting);
        if (nextVisible === visible) return;
        visible = nextVisible;
        if (visible) start();
        else stop();
      },
      { rootMargin: "240px" }
    );

    try {
      readGeometry();
      renderDpr = Math.min(window.devicePixelRatio || 1, AGENDA_RAIN_MAX_DPR);
      rainSource = createRainTextureRenderer();
      engine = createStripesEngine(renderCanvas, { dpr: renderDpr, seed: 1 });
      engine.setConfig(AGENDA_RAIN_CONFIG);
      applySettings(settingsRef.current);
      resize();

      resizeObserver.observe(root);
      for (const element of apertureElements) resizeObserver.observe(element);
      intersectionObserver.observe(root);
      reducedMotion.addEventListener("change", onMotionChange);
      window.addEventListener(AGENDA_RAIN_SETTINGS_EVENT, onSettings);
    } catch (error) {
      console.warn(
        "Agenda rain shader unavailable; preserving panel fallback.",
        error
      );
    }

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      window.removeEventListener(AGENDA_RAIN_SETTINGS_EVENT, onSettings);
      engine?.dispose();
      engine = null;
      rainSource?.dispose();
      rainSource = null;
    };
  }, []);

  return (
    <>
      <canvas
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-0 transition-opacity duration-300"
        ref={outputRef}
      />
      <canvas
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full opacity-0"
        ref={renderRef}
      />
    </>
  );
}
