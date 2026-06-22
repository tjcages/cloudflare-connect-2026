import { useEffect, useRef, useState } from "react";
import {
  createStripesEngine,
  createManualClock,
  createRealClock,
  type StripesEngine,
  type PerfSnapshot,
} from "@necatikcl/stripes-engine";
import { PerfOverlay } from "./PerfOverlay";

function num(params: URLSearchParams, key: string, dflt: number): number {
  const v = params.get(key);
  return v == null ? dflt : Number(v);
}

export function LabApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    const manual = params.get("manual") === "1";
    const clock = manual ? createManualClock(0) : createRealClock();
    const cssW = num(params, "w", window.innerWidth);
    const cssH = num(params, "h", window.innerHeight);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const engine: StripesEngine = createStripesEngine(canvas, {
      clock,
      seed: num(params, "seed", 1),
      dpr: params.has("dpr") ? num(params, "dpr", 1) : undefined,
      fieldScale: params.has("fieldScale") ? num(params, "fieldScale", 0.5) : undefined,
    });
    engine.resize(cssW, cssH);

    (window as unknown as { __lab: unknown }).__lab = {
      engine,
      clock,
      renderAt: (ms: number) => {
        if (manual && "set" in clock) (clock as { set(n: number): void }).set(ms);
        engine.renderFrame();
      },
      snapshot: () => engine.getPerf(),
    };

    let raf = 0;
    if (!manual) {
      engine.start();
      const tick = () => {
        setSnap(engine.getPerf());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      engine.renderFrame();
      setSnap(engine.getPerf());
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      engine.dispose();
      (window as unknown as { __lab?: unknown }).__lab = undefined;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <PerfOverlay snap={snap} />
    </>
  );
}
