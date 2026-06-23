import { useEffect, useRef, useState } from "react";
import {
  createStripesEngine,
  createManualClock,
  createRealClock,
  serializeEngineConfig,
  normalizeEngineConfig,
  type StripesEngine,
  type PerfSnapshot,
  type EngineConfig,
} from "@necatikcl/stripes-engine";
import { Leva } from "leva";
import { PerfOverlay } from "./PerfOverlay";
import { createTestImage } from "./testImage";
import { useEngineControls } from "./controls/levaSchema";
import { LAB_LEVA_THEME } from "./controls/levaTheme";
import { saveConfig, importConfig } from "./persistence";

function num(params: URLSearchParams, key: string, dflt: number): number {
  const v = params.get(key);
  return v == null ? dflt : Number(v);
}

/** HUD (perf overlay, file picker, Leva) is on unless `?hud=0` — kept out of visual goldens. */
function hudEnabled(): boolean {
  return new URLSearchParams(window.location.search).get("hud") !== "0";
}

function LabInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const manualRef = useRef(false);
  const lastObjectUrlRef = useRef<string | null>(null);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });

  const controls = useEngineControls();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    const manual = params.get("manual") === "1";
    manualRef.current = manual;
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
    engineRef.current = engine;

    const testImage = createTestImage();
    engine.setSource(testImage);

    (window as unknown as { __lab: unknown }).__lab = {
      engine,
      clock,
      renderAt: (ms: number) => {
        if (manual && "set" in clock) (clock as { set(n: number): void }).set(ms);
        engine.renderFrame();
      },
      snapshot: () => engine.getPerf(),
      setConfig: (c: Partial<EngineConfig>) => {
        engine.setConfig(c);
        if (manual) engine.renderFrame();
      },
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
      engineRef.current = null;
      (window as unknown as { __lab?: unknown }).__lab = undefined;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setConfig(controls);
    saveConfig(controls);
    if (manualRef.current) engine.renderFrame();
  }, [controls]);

  function handleExport() {
    void navigator.clipboard.writeText(serializeEngineConfig(controls));
  }

  function handleImport() {
    const text = window.prompt("Paste config JSON:");
    if (!text) return;
    try {
      const cfg = importConfig(text);
      saveConfig(normalizeEngineConfig(cfg));
      window.location.reload();
    } catch {
      window.alert("Invalid config JSON.");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const engine = engineRef.current;
    if (!engine) return;
    if (lastObjectUrlRef.current) URL.revokeObjectURL(lastObjectUrlRef.current);
    const url = URL.createObjectURL(file);
    lastObjectUrlRef.current = url;
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        engine.setSource(video);
        video.play().catch(() => {});
        if (manualRef.current) engine.renderFrame();
      };
    } else {
      const img = new Image();
      img.onload = () => {
        engine.setSource(img);
        if (manualRef.current) engine.renderFrame();
      };
      img.src = url;
    }
  }

  const hud = hudEnabled();
  return (
    <>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      {hud && <PerfOverlay snap={snap} />}
      {hud && (
        <div
          style={{
            position: "fixed",
            bottom: 12,
            left: 12,
            zIndex: 100,
            display: "flex",
            gap: 8,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.6)",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            <label style={{ color: "#fff", fontSize: 12, cursor: "pointer" }}>
              Load image/video
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
            </label>
          </div>
          <button
            onClick={handleExport}
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "none",
              borderRadius: 6,
              padding: "4px 8px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Export config
          </button>
          <button
            onClick={handleImport}
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "none",
              borderRadius: 6,
              padding: "4px 8px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Import config
          </button>
        </div>
      )}
    </>
  );
}

export function LabApp() {
  return (
    <>
      {hudEnabled() && <Leva theme={LAB_LEVA_THEME} />}
      <LabInner />
    </>
  );
}
