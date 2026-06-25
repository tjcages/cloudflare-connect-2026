import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { saveConfig, saveTextureId, importConfig, deleteConfig } from "./persistence";
import { DEFAULT_LAB_TEXTURE_ID, LAB_TEXTURES, findTextureEntry, loadFileSource, loadTextureSource } from "./textures";
import type { LabTextureKind, LoadedTextureSource } from "./textures";
import { addUpload, loadManifest, removeUpload, saveManifest } from "./uploads";
import { putTextureBlob, deleteTextureBlob } from "./textureStore";
import { cellGridToSvg, downloadSvg } from "./export/cellGridToSvg";
import { exportLabVideo } from "./export/videoExport";

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

const MAX_BASE_WIDTH = 1000;

function computeCanvasSize(srcW: number, srcH: number, scale: number): { cssW: number; cssH: number } {
  if (srcW <= 0 || srcH <= 0) return { cssW: 400, cssH: 300 };
  let baseW = srcW;
  let baseH = srcH;
  if (baseW > MAX_BASE_WIDTH) {
    baseH = Math.round((baseH * MAX_BASE_WIDTH) / baseW);
    baseW = MAX_BASE_WIDTH;
  }
  return { cssW: Math.round(baseW * scale), cssH: Math.round(baseH * scale) };
}

function LabCanvasSizeControls({
  sourceWidth,
  sourceHeight,
  scale,
  onScale,
}: {
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  onScale: (s: number) => void;
}) {
  const { cssW, cssH } = computeCanvasSize(sourceWidth, sourceHeight, scale);
  const disabled = sourceWidth <= 0 || sourceHeight <= 0;

  return (
    <section className="playground-canvas-size-controls">
      <div className="playground-canvas-size-row">
        <div>
          <span className="playground-canvas-scale-label">{disabled ? "— × —" : `${cssW} × ${cssH}`}</span>
        </div>
        <div>
          <div className="playground-canvas-scale-controls">
            <div className="playground-canvas-scale-buttons">
              {([1, 2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  style={scale === n ? { fontWeight: 600, color: "var(--leva-text)" } : undefined}
                  onClick={() => onScale(n)}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LabBottomBar({
  videoEl,
  onExportSvg,
  onExportVideo,
}: {
  videoEl: HTMLVideoElement | null;
  onExportSvg: () => void;
  onExportVideo: () => void;
}) {
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
          <button className="lab-btn" onClick={onExportVideo}>
            Export Video
          </button>
          <button className="lab-btn" onClick={onExportSvg}>
            Export SVG
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
  const engineRef = useRef<StripesEngine | null>(null);
  const manualRef = useRef(false);
  const uploadObjectUrlRef = useRef<string | null>(null);
  const prevVideoRef = useRef<HTMLVideoElement | null>(null);
  const [snap, setSnap] = useState<PerfSnapshot>({
    fps: 0,
    frameMs: { p50: 0, p95: 0, p99: 0 },
    passMs: {},
    sampleCount: 0,
  });
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  videoElRef.current = videoEl;
  const [sourceSize, setSourceSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [scale, setScale] = useState(
    (LAB_TEXTURES.find((t) => t.id === DEFAULT_LAB_TEXTURE_ID) ?? LAB_TEXTURES[0]).defaultScale,
  );
  const [ready, setReady] = useState(false);
  const sourceSizeRef = useRef(sourceSize);
  sourceSizeRef.current = sourceSize;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  const hud = hudEnabled();
  const manual = useMemo(() => new URLSearchParams(window.location.search).get("manual") === "1", []);
  const shell = hud && !manual;

  const onReplayRef = useRef<() => void>(() => {});
  const onReplay = useCallback(() => onReplayRef.current(), []);
  const onExportSvgRef = useRef<() => void>(() => {});
  const onExportSvg = useCallback(() => onExportSvgRef.current(), []);
  const onExportVideoRef = useRef<() => void>(() => {});
  const onExportVideo = useCallback(() => onExportVideoRef.current(), []);
  const { config: controls, setControl, textureId, store } = useEngineControls(onReplay, onExportSvg, onExportVideo);
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const setControlRef = useRef(setControl);
  setControlRef.current = setControl;
  const textureIdRef = useRef(textureId);
  textureIdRef.current = textureId;
  const mountTextureIdRef = useRef(textureId);
  const selectedEntry = useMemo(() => findTextureEntry(textureId, loadManifest()), [textureId]);
  const canDeleteTexture = selectedEntry?.origin === "upload";

  function handleDeleteTexture() {
    const manifest = loadManifest();
    const entry = findTextureEntry(textureId, manifest);
    if (!entry || entry.origin !== "upload") return;
    saveManifest(removeUpload(manifest, entry.id));
    void deleteTextureBlob(entry.id);
    deleteConfig(entry.id);
    saveTextureId(DEFAULT_LAB_TEXTURE_ID);
    window.location.reload();
  }

  const stripesEnabledRef = useRef(controls.stripesEnabled);
  stripesEnabledRef.current = controls.stripesEnabled;
  const revealEnabledRef = useRef(controls.reveal.enabled);
  revealEnabledRef.current = controls.reveal.enabled;

  const applyCanvasSize = useCallback(
    (engine: StripesEngine, canvas: HTMLCanvasElement, src: { w: number; h: number }, s: number) => {
      const { cssW, cssH } = computeCanvasSize(src.w, src.h, s);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      engine.resize(cssW, cssH);
    },
    [],
  );

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

    if (!shell) {
      const cssW = num(params, "w", window.innerWidth);
      const cssH = num(params, "h", window.innerHeight);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      engine.resize(cssW, cssH);
    }

    const testImage = createTestImage();
    engine.setSource(testImage);

    if (shell) {
      const src = { w: testImage.width, h: testImage.height };
      setSourceSize(src);
      applyCanvasSize(engine, canvas, src, scaleRef.current);
    }

    onReplayRef.current = () => engine.triggerReveal();

    const buildExportSvg = (): string => {
      const cfg = controlsRef.current;
      const readback = engine.readCellGrid();
      const stripes = cfg.stripes.map((s) => ({
        hex: "#" + s.color.toString(16).padStart(6, "0"),
        startFrom: s.startFrom,
        width: s.width,
      }));
      return cellGridToSvg(readback, stripes, {
        cellSizePx: cfg.grid.cellWidth,
        useCellColors: readback.colors !== null,
      });
    };
    onExportSvgRef.current = () => downloadSvg(buildExportSvg());

    onExportVideoRef.current = () => {
      const targetCanvas = canvasRef.current;
      if (!targetCanvas) return;
      const video = videoElRef.current;
      void exportLabVideo({
        canvas: targetCanvas,
        sourceKind: video ? "video" : "image",
        video: video ?? undefined,
        backgroundColor: controlsRef.current.background.color,
      }).catch(() => {});
    };

    (window as unknown as { __lab: unknown }).__lab = {
      engine,
      clock,
      exportSvg: () => buildExportSvg(),
      renderAt: (ms: number) => {
        if (manual && "set" in clock) (clock as { set(n: number): void }).set(ms);
        engine.renderFrame();
      },
      snapshot: () => engine.getPerf(),
      setConfig: (c: Partial<EngineConfig>) => {
        engine.setConfig(c);
        if (manual) engine.renderFrame();
      },
      cursorTo: (x: number | null, y?: number) => engine.setCursor(x, y),
      clickAt: (x: number, y?: number) => engine.click(x, y),
      triggerReveal: () => engine.triggerReveal(),
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
      if (uploadObjectUrlRef.current) {
        URL.revokeObjectURL(uploadObjectUrlRef.current);
        uploadObjectUrlRef.current = null;
      }
      engine.dispose();
      engineRef.current = null;
      (window as unknown as { __lab?: unknown }).__lab = undefined;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!shell) return;
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    applyCanvasSize(engine, canvas, sourceSizeRef.current, scale);
  }, [scale, shell, applyCanvasSize]);

  useEffect(() => {
    if (manual) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMove = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const rect = canvas.getBoundingClientRect();
      engine.setCursor(e.clientX - rect.left, e.clientY - rect.top);
    };
    const onLeave = () => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.setCursor(null);
    };
    const onDown = (e: PointerEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const rect = canvas.getBoundingClientRect();
      engine.click(e.clientX - rect.left, e.clientY - rect.top);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [manual]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const configToApply = manualRef.current
      ? { ...controls, reveal: { ...controls.reveal, enabled: false } }
      : controls;
    engine.setConfig(configToApply);
    saveConfig(textureIdRef.current, controls);
    if (manualRef.current) engine.renderFrame();
  }, [controls]);

  useEffect(() => {
    saveTextureId(textureId);
    // The leva store is seeded from the selected texture's saved config at init,
    // so switching textures reloads to re-init with that texture's own settings.
    if (!manual && textureId !== mountTextureIdRef.current) {
      window.location.reload();
    }
  }, [textureId, manual]);

  useEffect(() => {
    if (manual) return;
    const engine = engineRef.current;
    if (!engine) return;
    let cancelled = false;
    if (prevVideoRef.current) {
      prevVideoRef.current.pause();
      prevVideoRef.current = null;
    }
    const entry = findTextureEntry(textureId, loadManifest()) ?? LAB_TEXTURES[0];
    setScale(entry.defaultScale);
    loadTextureSource(entry)
      .then((loaded) => {
        if (cancelled) {
          if (loaded.video) loaded.video.pause();
          if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
          return;
        }
        applyLoadedSource(loaded);
        setReady(true);
        if (revealEnabledRef.current) engine.triggerReveal();
      })
      .catch(() => {
        if (cancelled) return;
        if (textureId !== DEFAULT_LAB_TEXTURE_ID) {
          saveManifest(removeUpload(loadManifest(), textureId));
          saveTextureId(DEFAULT_LAB_TEXTURE_ID);
          window.location.reload();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [textureId, manual]);

  function applyLoadedSource(loaded: LoadedTextureSource) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine) return;
    if (uploadObjectUrlRef.current) URL.revokeObjectURL(uploadObjectUrlRef.current);
    uploadObjectUrlRef.current = loaded.objectUrl;
    engine.setSource(loaded.source);
    prevVideoRef.current = loaded.video;
    setVideoEl(loaded.video);
    if (shell) {
      let srcW = 0;
      let srcH = 0;
      if (loaded.video) {
        srcW = loaded.video.videoWidth;
        srcH = loaded.video.videoHeight;
      } else if (loaded.source instanceof HTMLImageElement) {
        srcW = loaded.source.naturalWidth;
        srcH = loaded.source.naturalHeight;
      }
      if (srcW > 0 && srcH > 0) {
        const src = { w: srcW, h: srcH };
        setSourceSize(src);
        if (canvas) applyCanvasSize(engine, canvas, src, scaleRef.current);
      }
    }
    if (manualRef.current) engine.renderFrame();
  }

  function handleExport() {
    void navigator.clipboard.writeText(serializeEngineConfig(controls));
  }

  function handleImport() {
    const text = window.prompt("Paste config JSON:");
    if (!text) return;
    try {
      const cfg = importConfig(text);
      saveConfig(textureIdRef.current, normalizeEngineConfig(cfg));
      window.location.reload();
    } catch {
      window.alert("Invalid config JSON.");
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
    const id = `upload-${crypto.randomUUID()}`;
    try {
      await putTextureBlob(id, file, file.type);
    } catch {
      window.alert("Couldn't save this upload (storage full). It will show for this session but won't persist.");
      loadFileSource(file)
        .then((loaded) => {
          if (engineRef.current) {
            applyLoadedSource(loaded);
          } else if (loaded.objectUrl) {
            URL.revokeObjectURL(loaded.objectUrl);
          }
        })
        .catch(() => {});
      return;
    }
    saveManifest(addUpload(loadManifest(), { id, label: file.name, kind, defaultScale: 1, createdAt: Date.now() }));
    saveTextureId(id);
    window.location.reload();
  }

  if (!shell) {
    return <canvas ref={canvasRef} style={{ display: "block" }} />;
  }

  return (
    <div className="lab-shell">
      <div className="lab-main">
        <div className="lab-canvas-area">
          <canvas
            ref={canvasRef}
            style={{ display: "block", opacity: ready ? 1 : 0, transition: "opacity 150ms ease" }}
          />
        </div>
        <LabBottomBar videoEl={videoEl} onExportSvg={onExportSvg} onExportVideo={onExportVideo} />
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
            <button className="lab-btn" onClick={handleDeleteTexture} disabled={!canDeleteTexture}>
              Delete texture
            </button>
            <button className="lab-btn" onClick={handleExport}>
              Copy config
            </button>
            <button className="lab-btn" onClick={handleImport}>
              Import config
            </button>
          </div>
          <LabCanvasSizeControls
            sourceWidth={sourceSize.w}
            sourceHeight={sourceSize.h}
            scale={scale}
            onScale={setScale}
          />
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
