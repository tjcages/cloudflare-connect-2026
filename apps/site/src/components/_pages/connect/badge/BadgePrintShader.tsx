"use no memo";

import {
  createStripesEngine,
  resolveThemedConfig,
  type StripesEngine,
} from "@necatikcl/stripes-engine";
import { useEffect, useRef, type RefObject } from "react";
import {
  asThemedEngineConfig,
  type StripesTextureConfig,
} from "@/components/stripes-texture/config";
import { blitPrintFrame } from "./badge-print-blit";

type BadgePrintShaderProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  src: string;
  config: StripesTextureConfig;
  width: number;
  height: number;
  paused?: boolean;
  maxDpr?: number;
};

/**
 * Runs the case-study stripe engine onto a 2D canvas the badge can copy.
 * The shared `StripesShader` worker will not paint a capture parked at
 * `left: -2000px`, even with a wide rootMargin — so this uses the same
 * main-thread engine as CTA / speaker overlays and blits in the same frame.
 */
export default function BadgePrintShader({
  canvasRef,
  src,
  config,
  width,
  height,
  paused = false,
  maxDpr = 1,
}: BadgePrintShaderProps) {
  const renderRef = useRef<HTMLCanvasElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const hasSourceRef = useRef(false);
  const pausedRef = useRef(paused);
  const configRef = useRef(config);
  pausedRef.current = paused;
  configRef.current = config;

  useEffect(() => {
    const renderCanvas = renderRef.current;
    const outputCanvas = outputRef.current;
    if (!renderCanvas || !outputCanvas) return;

    canvasRef.current = outputCanvas;
    const outputCtx = outputCanvas.getContext("2d");
    if (!outputCtx) return;

    const engine = createStripesEngine(renderCanvas, { dpr: maxDpr, seed: 1 });
    engineRef.current = engine;
    hasSourceRef.current = false;
    engine.resize(width, height);
    engine.setConfig(
      resolveThemedConfig(asThemedEngineConfig(configRef.current), "light")
    );
    engine.setRevealGate(true);

    let raf = 0;

    const copyFrame = () => {
      if (
        outputCanvas.width !== renderCanvas.width ||
        outputCanvas.height !== renderCanvas.height
      ) {
        outputCanvas.width = renderCanvas.width;
        outputCanvas.height = renderCanvas.height;
      }
      blitPrintFrame(
        outputCtx,
        hasSourceRef.current ? renderCanvas : null
      );
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (pausedRef.current) return;
      engine.renderFrame();
      copyFrame();
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      hasSourceRef.current = false;
      engine.setSource(null);
      engine.dispose();
      engineRef.current = null;
      if (canvasRef.current === outputCanvas) canvasRef.current = null;
    };
  }, [canvasRef, height, maxDpr, width]);

  useEffect(() => {
    const engine = engineRef.current;
    const renderCanvas = renderRef.current;
    const outputCanvas = outputRef.current;
    const outputCtx = outputCanvas?.getContext("2d");
    if (!engine || !renderCanvas || !outputCanvas || !outputCtx) return;

    hasSourceRef.current = false;
    engine.setSource(null);
    blitPrintFrame(outputCtx, null);

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (cancelled || engineRef.current !== engine) return;
      engine.setSource(image);
      engine.triggerReveal();
      hasSourceRef.current = true;
      engine.renderFrame();
      blitPrintFrame(outputCtx, renderCanvas);
    };
    image.onerror = () => {
      if (cancelled || engineRef.current !== engine) return;
      engine.triggerReveal();
    };
    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      hasSourceRef.current = false;
      if (engineRef.current === engine) engine.setSource(null);
    };
  }, [height, maxDpr, src, width]);

  useEffect(() => {
    engineRef.current?.setConfig(
      resolveThemedConfig(asThemedEngineConfig(config), "light")
    );
  }, [config]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-0"
      style={{ clipPath: "inset(100%)", height, width }}
    >
      <canvas className="absolute inset-0 size-full" ref={renderRef} />
      <canvas className="absolute inset-0 size-full" ref={outputRef} />
    </div>
  );
}
