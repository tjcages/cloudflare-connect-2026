import { useEffect, useMemo, useRef, useState } from "react";
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
import { LevaPanel } from "leva";
import { Play, Pause } from "lucide-react";
import { PerfOverlay } from "./PerfOverlay";
import { createTestImage } from "./testImage";
import { useEngineControls } from "./controls/levaSchema";
import { LAB_LEVA_THEME } from "./controls/levaTheme";
import { saveConfig, importConfig } from "./persistence";
import { LAB_TEXTURES, loadTextureSource } from "./textures";

function num(params: URLSearchParams, key: string, dflt: number): number {
  const v = params.get(key);
  return v == null ? dflt : Number(v);
}

/** HUD (perf overlay, sidebar, bottom bar) is on unless `?hud=0` — `?hud=0` renders only the bare canvas for visual goldens. */
function hudEnabled(): boolean {
  return new URLSearchParams(window.location.search).get("hud") !== "0";
}

function formatTime(seconds: number): string {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function LabBottomBar({ videoEl }: { videoEl: HTMLVideoElement | null }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!videoEl) {
      setPlaying(false);
      setCurrent(0);
      setDuration(0);
      return;
    }
    const onTime = () => setCurrent(videoEl.currentTime);
    const onMeta = () => setDuration(videoEl.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    videoEl.addEventListener("timeupdate", onTime);
    videoEl.addEventListener("loadedmetadata", onMeta);
    videoEl.addEventListener("play", onPlay);
    videoEl.addEventListener("pause", onPause);
    setDuration(videoEl.duration || 0);
    setCurrent(videoEl.currentTime);
    setPlaying(!videoEl.paused);
    return () => {
      videoEl.removeEventListener("timeupdate", onTime);
      videoEl.removeEventListener("loadedmetadata", onMeta);
      videoEl.removeEventListener("play", onPlay);
      videoEl.removeEventListener("pause", onPause);
    };
  }, [videoEl]);

  return (
    <footer className="lab-bottom-bar">
      <div className="lab-bottom-grid">
        <div className="lab-btn-row">
          <button className="lab-btn" disabled title="Video export — coming in Phase 9">
            Export Video
          </button>
          <button className="lab-btn" disabled title="SVG export — coming in Phase 9">
            Copy SVG
          </button>
        </div>
        {videoEl ? (
          <div className="lab-playback">
            <button
              className="lab-btn"
              style={{ width: 32, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={() => {
                if (videoEl.paused) void videoEl.play();
                else videoEl.pause();
              }}
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span className="lab-time" style={{ textAlign: "right" }}>
              {formatTime(current)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={current}
              onChange={(e) => {
                videoEl.currentTime = Number(e.target.value);
              }}
              aria-label="Texture timeline"
            />
            <span className="lab-time">{formatTime(duration)}</span>
          </div>
        ) : (
          <div />
        )}
        <div aria-hidden />
      </div>
    </footer>
  );
}

function LabInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const manualRef = useRef(false);
  const lastObjectUrlRef = useRef<string | null>(null);
  const prevVideoRef = useRef<HTMLVideoElement | null>(null);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  const hud = hudEnabled();
  const manual = useMemo(() => new URLSearchParams(window.location.search).get("manual") === "1", []);
  const shell = hud && !manual;

  const { config: controls, setControl, textureId, store } = useEngineControls();
  const setControlRef = useRef(setControl);
  setControlRef.current = setControl;
  const stripesEnabledRef = useRef(controls.stripesEnabled);
  stripesEnabledRef.current = controls.stripesEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const params = new URLSearchParams(window.location.search);
    manualRef.current = manual;
    const clock = manual ? createManualClock(0) : createRealClock();

    const engine: StripesEngine = createStripesEngine(canvas, {
      clock,
      seed: num(params, "seed", 1),
      dpr: params.has("dpr") ? num(params, "dpr", 1) : undefined,
      fieldScale: params.has("fieldScale") ? num(params, "fieldScale", 0.5) : undefined,
    });
    engineRef.current = engine;

    function applySize() {
      if (!canvas) return;
      let cssW: number;
      let cssH: number;
      const area = canvasAreaRef.current;
      if (shell && area) {
        cssW = Math.max(1, area.clientWidth - 48);
        cssH = Math.max(1, area.clientHeight - 48);
      } else {
        cssW = num(params, "w", window.innerWidth);
        cssH = num(params, "h", window.innerHeight);
      }
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      engine.resize(cssW, cssH);
    }
    applySize();

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
    let resizeObs: ResizeObserver | null = null;
    if (!manual) {
      engine.start();
      const tick = () => {
        setSnap(engine.getPerf());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      if (shell && canvasAreaRef.current) {
        resizeObs = new ResizeObserver(() => applySize());
        resizeObs.observe(canvasAreaRef.current);
      }
    } else {
      engine.renderFrame();
      setSnap(engine.getPerf());
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!e.shiftKey) return;
      if (e.key !== "s" && e.key !== "S") return;
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)
        return;
      e.preventDefault();
      setControlRef.current({ stripesEnabled: !stripesEnabledRef.current });
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (resizeObs) resizeObs.disconnect();
      engine.dispose();
      engineRef.current = null;
      (window as unknown as { __lab?: unknown }).__lab = undefined;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setConfig(controls);
    saveConfig(controls);
    if (manualRef.current) engine.renderFrame();
  }, [controls]);

  useEffect(() => {
    if (manual) return;
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    if (prevVideoRef.current) {
      prevVideoRef.current.pause();
      prevVideoRef.current = null;
    }
    const preset = LAB_TEXTURES.find((t) => t.id === textureId) ?? LAB_TEXTURES[0];
    loadTextureSource(preset)
      .then(({ source, video }) => {
        if (cancelled) {
          if (video) video.pause();
          return;
        }
        engine.setSource(source);
        prevVideoRef.current = video;
        setVideoEl(video);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [textureId, manual]);

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
    if (prevVideoRef.current) {
      prevVideoRef.current.pause();
      prevVideoRef.current = null;
    }
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
        prevVideoRef.current = video;
        setVideoEl(video);
        video.play().catch(() => {});
        if (manualRef.current) engine.renderFrame();
      };
    } else {
      const img = new Image();
      img.onload = () => {
        engine.setSource(img);
        setVideoEl(null);
        if (manualRef.current) engine.renderFrame();
      };
      img.src = url;
    }
  }

  if (!shell) {
    return <canvas ref={canvasRef} style={{ display: "block" }} />;
  }

  return (
    <div className="lab-shell">
      <div className="lab-main">
        <div className="lab-canvas-area" ref={canvasAreaRef}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
        </div>
        <LabBottomBar videoEl={videoEl} />
      </div>
      <aside className="lab-sidebar">
        <div className="lab-sidebar-scroll playground-leva-panel ui-scroll-hidden">
          <div className="playground-workflow-controls">
            <label
              className="lab-btn"
              style={{
                width: "100%",
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              Upload texture
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleFileChange} />
            </label>
            <button className="lab-btn" onClick={handleExport}>
              Copy config
            </button>
            <button className="lab-btn" onClick={handleImport}>
              Import config
            </button>
          </div>
          <LevaPanel store={store} theme={LAB_LEVA_THEME} fill flat titleBar={false} />
        </div>
      </aside>
      <PerfOverlay snap={snap} />
    </div>
  );
}

export function LabApp() {
  return <LabInner />;
}
