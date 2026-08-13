import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  effectiveStripes,
  normalizeEngineConfig,
  type EngineConfig,
  type StripesEngine,
} from "@necatikcl/stripes-engine";
import { cellGridToSvg } from "../../../lab/src/export/cellGridToSvg";
import type { InsertMetadata, PluginToUiMessage, UiToPluginMessage } from "../shared/messages";

const INITIAL_WIDTH = 800;
const INITIAL_HEIGHT = 600;

function postToFigma(message: UiToPluginMessage): void {
  parent.postMessage({ pluginMessage: message }, "*");
}

function integerToHex(color: number): string {
  return `#${Math.round(color).toString(16).padStart(6, "0")}`;
}

function hexToInteger(color: string): number {
  return Number.parseInt(color.replace("#", ""), 16);
}

function demoSource(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 900;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#060606");
  gradient.addColorStop(0.48, "#d9d9d9");
  gradient.addColorStop(1, "#171717");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.save();
  context.translate(600, 440);
  context.rotate(-0.22);
  context.fillStyle = "#ffffff";
  context.fillRect(-370, -110, 740, 220);
  context.fillStyle = "#111111";
  context.font = "900 150px Avenir Next, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("CONNECT", 0, 5);
  context.restore();

  const glow = context.createRadialGradient(930, 180, 10, 930, 180, 260);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(650, -100, 650, 650);
  return canvas;
}

function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the render."))), "image/png");
  });
}

function cloneDefaultConfig(): EngineConfig {
  return normalizeEngineConfig({
    ...structuredClone(DEFAULT_ENGINE_CONFIG),
    background: { ...structuredClone(DEFAULT_ENGINE_CONFIG.background), color: 0x101010, transparent: false },
    grid: { ...structuredClone(DEFAULT_ENGINE_CONFIG.grid), cellWidth: 10, cellHeight: 10, gapX: 1, gapY: 1 },
  });
}

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
};

function NumberField({ label, value, min, max, step = 1, onChange }: NumberFieldProps) {
  return (
    <label className="control-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{Number.isInteger(value) ? value : value.toFixed(1)}</output>
    </label>
  );
}

export function PluginApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<EngineConfig>(cloneDefaultConfig);
  const [outputWidth, setOutputWidth] = useState(INITIAL_WIDTH);
  const [outputHeight, setOutputHeight] = useState(INITIAL_HEIGHT);
  const [sourceName, setSourceName] = useState("Built-in test card");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState<"SVG" | "PNG" | "selection" | null>(null);
  const [status, setStatus] = useState("Starting WebGL renderer…");

  const updateConfig = useCallback((transform: (current: EngineConfig) => EngineConfig) => {
    setConfig((current) => normalizeEngineConfig(transform(current)));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const engine = createStripesEngine(canvas, { dpr: 1, seed: 11, fieldScale: 1 });
      engineRef.current = engine;
      engine.resize(INITIAL_WIDTH, INITIAL_HEIGHT);
      engine.setSource(demoSource());
      engine.start();
      setReady(true);
      setStatus("Ready to insert into Figma");
      return () => {
        engine.dispose();
        engineRef.current = null;
        bitmapRef.current?.close();
        bitmapRef.current = null;
      };
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "WebGL2 could not start in this plugin window.");
    }
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setConfig(config);
  }, [config]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resize(outputWidth, outputHeight);
  }, [outputWidth, outputHeight]);

  const loadImageBytes = useCallback(async (bytes: Blob, name: string) => {
    setStatus(`Loading ${name}…`);
    const bitmap = await createImageBitmap(bytes);
    bitmapRef.current?.close();
    bitmapRef.current = bitmap;
    engineRef.current?.setSource(bitmap);
    setSourceName(name);
    setStatus("Source loaded");
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<{ pluginMessage?: PluginToUiMessage }>) => {
      const message = event.data.pluginMessage;
      if (!message) return;
      if (message.type === "selection-image") {
        void loadImageBytes(new Blob([Uint8Array.from(message.bytes).buffer]), message.name)
          .catch((error) => setStatus(error instanceof Error ? error.message : "Could not decode the selected image."))
          .finally(() => setBusy(null));
      } else if (message.type === "selection-error" || message.type === "insert-error") {
        setStatus(message.message);
        setBusy(null);
      } else if (message.type === "insert-complete") {
        setStatus(`${message.format} inserted and selected`);
        setBusy(null);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadImageBytes]);

  const metadata = useMemo<InsertMetadata>(
    () => ({ config, outputWidth, outputHeight, sourceName }),
    [config, outputHeight, outputWidth, sourceName],
  );

  const buildSvg = useCallback((): string => {
    const engine = engineRef.current;
    if (!engine) throw new Error("Renderer is not ready.");
    engine.renderFrame();
    const readback = engine.readCellGrid();
    return cellGridToSvg(
      readback,
      effectiveStripes(config).map((stripe) => ({
        hex: integerToHex(stripe.color),
        startFrom: stripe.startFrom,
        width: stripe.width,
        opacity: stripe.opacity,
      })),
      {
        cellWidthPx: config.grid.cellWidth,
        cellHeightPx: config.grid.cellHeight,
        gapX: config.grid.gapX,
        gapY: config.grid.gapY,
        useCellColors: readback.colors !== null,
        orientation: config.grid.orientation,
        angleDeg: config.grid.angleDeg,
        rotationMode: config.grid.rotationMode,
        overlapAmount: config.grid.overlapAmount,
        streamGapWave: config.grid.streamGapWave,
        backgroundHex: config.background.transparent ? undefined : integerToHex(config.background.color),
        letters: config.letters,
        blendMode: config.colors.stripeBlendMode,
        widthSparkle: config.sparkle.width,
        canvasWidthPx: outputWidth,
        canvasHeightPx: outputHeight,
      },
    );
  }, [config, outputHeight, outputWidth]);

  const insertSvg = () => {
    setBusy("SVG");
    setStatus("Building editable vectors…");
    try {
      postToFigma({ type: "insert-svg", svg: buildSvg(), metadata });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not build SVG.");
      setBusy(null);
    }
  };

  const insertPng = async () => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    setBusy("PNG");
    setStatus("Encoding pixel render…");
    try {
      engine.renderFrame();
      const blob = await blobFromCanvas(canvas);
      postToFigma({ type: "insert-png", bytes: new Uint8Array(await blob.arrayBuffer()), metadata });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not encode PNG.");
      setBusy(null);
    }
  };

  const selectFigmaImage = () => {
    setBusy("selection");
    setStatus("Reading selected image fill…");
    postToFigma({ type: "request-selection-image" });
  };

  const setGrid = (value: number) =>
    updateConfig((current) => ({ ...current, grid: { ...current.grid, cellWidth: value, cellHeight: value } }));
  const setGap = (value: number) =>
    updateConfig((current) => ({ ...current, grid: { ...current.grid, gapX: value, gapY: value } }));

  return (
    <main className="plugin-shell">
      <header className="masthead">
        <div>
          <p className="eyebrow">NCTK / FIGMA INSTRUMENT 01</p>
          <h1>Connect Shader</h1>
        </div>
        <span
          className={`live-light ${ready ? "is-ready" : ""}`}
          aria-label={ready ? "Renderer ready" : "Renderer loading"}
        />
      </header>

      <section className="preview-panel" aria-label="Shader preview">
        <div className="preview-corner preview-corner--top">
          LIVE / {outputWidth}×{outputHeight}
        </div>
        <canvas ref={canvasRef} />
        <div className="preview-corner preview-corner--bottom">WEBGL2 / SEED 11</div>
      </section>

      <section className="source-strip">
        <div className="source-copy">
          <span>Source</span>
          <strong title={sourceName}>{sourceName}</strong>
        </div>
        <div className="source-actions">
          <button type="button" className="button button--quiet" onClick={selectFigmaImage} disabled={busy !== null}>
            {busy === "selection" ? "Reading…" : "Use selection"}
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null}
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadImageBytes(file, file.name).catch((error) => setStatus(String(error)));
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="controls" aria-label="Render controls">
        <div className="section-label">
          <span>01</span> Output
        </div>
        <div className="dimension-grid">
          <label>
            <span>Width</span>
            <input
              type="number"
              min="64"
              max="4096"
              value={outputWidth}
              onChange={(event) => setOutputWidth(Math.max(64, Math.min(4096, Number(event.target.value))))}
            />
          </label>
          <span className="dimension-cross">×</span>
          <label>
            <span>Height</span>
            <input
              type="number"
              min="64"
              max="4096"
              value={outputHeight}
              onChange={(event) => setOutputHeight(Math.max(64, Math.min(4096, Number(event.target.value))))}
            />
          </label>
        </div>

        <div className="section-label">
          <span>02</span> Structure
        </div>
        <NumberField label="Cell" value={config.grid.cellWidth} min={3} max={32} onChange={setGrid} />
        <NumberField
          label="Gap"
          value={config.grid.gapX}
          min={0}
          max={Math.min(12, config.grid.cellWidth)}
          onChange={setGap}
        />
        <NumberField
          label="Angle"
          value={config.grid.angleDeg}
          min={-90}
          max={90}
          onChange={(value) => updateConfig((current) => ({ ...current, grid: { ...current.grid, angleDeg: value } }))}
        />
        <NumberField
          label="Contrast"
          value={config.adjustments.contrast}
          min={0.2}
          max={3}
          step={0.1}
          onChange={(value) =>
            updateConfig((current) => ({ ...current, adjustments: { ...current.adjustments, contrast: value } }))
          }
        />

        <div className="section-label">
          <span>03</span> Ink
        </div>
        <div className="ink-row">
          <label className="background-control">
            <input
              type="checkbox"
              checked={!config.background.transparent}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  background: { ...current.background, transparent: !event.target.checked },
                }))
              }
            />
            <span>Background</span>
          </label>
          <input
            className="color-swatch color-swatch--background"
            type="color"
            aria-label="Background color"
            value={integerToHex(config.background.color)}
            onChange={(event) =>
              updateConfig((current) => ({
                ...current,
                background: { ...current.background, color: hexToInteger(event.target.value) },
              }))
            }
          />
          <div className="stripe-colors" aria-label="Stripe colors">
            {config.stripes.map((stripe, index) => (
              <input
                key={index}
                className="color-swatch"
                type="color"
                aria-label={`Stripe ${index + 1} color`}
                value={integerToHex(stripe.color)}
                onChange={(event) =>
                  updateConfig((current) => ({
                    ...current,
                    stripes: current.stripes.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, color: hexToInteger(event.target.value) } : item,
                    ),
                  }))
                }
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="export-dock">
        <output className="status" title={status}>
          <span className="status-pip" />
          {status}
        </output>
        <div className="export-actions">
          <button
            type="button"
            className="button button--vector"
            onClick={insertSvg}
            disabled={!ready || busy !== null}
          >
            {busy === "SVG" ? "Building…" : "Insert editable"}
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void insertPng()}
            disabled={!ready || busy !== null}
          >
            {busy === "PNG" ? "Encoding…" : "Insert render"}
          </button>
        </div>
      </footer>
    </main>
  );
}
