import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  createRealClock,
  createStripesEngine,
  normalizeEngineConfig,
  resolveThemedConfig,
  type StripesEngine,
} from "@necatikcl/stripes-engine";
import { clearTwizzler, renderTwizzler } from "../twizzler";
import { createTwizzlerMapRenderer, type TwizzlerMapRenderer } from "../twizzlerMapSource";
import {
  buildClientPreviewBundle,
  CLIENT_COLOR_PRESETS,
  CLIENT_LAYOUT_PRESETS,
  CLIENT_SIZE_PRESETS,
  DEFAULT_CLIENT_PREVIEW_STATE,
  resetTweaksForPresets,
  type ClientColorPresetId,
  type ClientLayoutPresetId,
  type ClientPreviewState,
  type ClientSizePresetId,
  type ClientTwizzlerTweaks,
} from "./clientPresets";

function fitScale(cssW: number, cssH: number, maxW: number, maxH: number): number {
  if (cssW <= 0 || cssH <= 0 || maxW <= 0 || maxH <= 0) return 1;
  return Math.min(1, maxW / cssW, maxH / cssH);
}

function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const id = `client-slider-${props.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="client-slider">
      <div className="client-slider-label">
        <label htmlFor={id}>{props.label}</label>
        <span className="client-slider-value">{props.value.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
      />
    </div>
  );
}

function PresetChipGroup<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <fieldset className="client-fieldset">
      <legend>{props.label}</legend>
      <div className="client-chip-row">
        {props.options.map((option) => {
          const selected = option.id === props.value;
          return (
            <button
              key={option.id}
              type="button"
              className={`client-chip${selected ? " is-selected" : ""}`}
              aria-pressed={selected}
              onClick={() => props.onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ClientPreviewApp() {
  const [state, setState] = useState<ClientPreviewState>(DEFAULT_CLIENT_PREVIEW_STATE);
  const bundle = useMemo(() => buildClientPreviewBundle(state), [state]);

  const outputRef = useRef<HTMLCanvasElement>(null);
  const twizzlerRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StripesEngine | null>(null);
  const mapRendererRef = useRef<TwizzlerMapRenderer | null>(null);
  const stateRef = useRef(state);
  const bundleRef = useRef(bundle);
  stateRef.current = state;
  bundleRef.current = bundle;

  const [viewport, setViewport] = useState({ w: 1200, h: 640 });

  useEffect(() => {
    const update = () => {
      const padX = 48;
      const padY = 160;
      setViewport({
        w: Math.max(320, window.innerWidth - padX - 320),
        h: Math.max(220, window.innerHeight - padY),
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const canvas = outputRef.current;
    if (!canvas) return;

    const clock = createRealClock();
    const engine = createStripesEngine(canvas, { clock, seed: 1 });
    engineRef.current = engine;

    const mapRenderer = createTwizzlerMapRenderer(
      bundleRef.current.shaderSourceWidth,
      bundleRef.current.shaderSourceHeight,
    );
    mapRendererRef.current = mapRenderer;

    let raf = 0;
    let startMs = performance.now();
    let lastConfigKey = "";
    let lastSizeKey = "";

    const tick = (now: number) => {
      const current = bundleRef.current;
      const live = stateRef.current;
      const timeSec = (now - startMs) / 1000;

      const sizeKey = `${current.canvasWidth}x${current.canvasHeight}`;
      if (sizeKey !== lastSizeKey) {
        lastSizeKey = sizeKey;
        canvas.style.width = `${current.canvasWidth}px`;
        canvas.style.height = `${current.canvasHeight}px`;
        engine.resize(current.canvasWidth, current.canvasHeight);
        const twizzlerCanvas = twizzlerRef.current;
        if (twizzlerCanvas) {
          twizzlerCanvas.style.width = `${current.canvasWidth}px`;
          twizzlerCanvas.style.height = `${current.canvasHeight}px`;
        }
      }

      mapRenderer.resize(current.shaderSourceWidth, current.shaderSourceHeight);
      mapRenderer.render(timeSec, timeSec, current.twizzler, current.twizzlerMap);
      engine.updateSourceFrame(mapRenderer.canvas);

      const configKey = JSON.stringify({
        rain: live.rainEnabled,
        gaps: current.engineConfig.sparkle?.gaps,
        transparent: current.engineConfig.background?.transparent,
      });
      if (configKey !== lastConfigKey) {
        lastConfigKey = configKey;
        const normalized = normalizeEngineConfig(resolveThemedConfig(current.engineConfig, "light"));
        engine.setConfig(normalized);
      }

      const twizzlerCanvas = twizzlerRef.current;
      if (twizzlerCanvas) {
        if (live.twizzlerEnabled) {
          renderTwizzler(twizzlerCanvas, canvas.width, canvas.height, timeSec, current.twizzler);
        } else {
          clearTwizzler(twizzlerCanvas);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
      mapRendererRef.current = null;
    };
  }, []);

  const scale = fitScale(bundle.canvasWidth, bundle.canvasHeight, viewport.w, viewport.h);
  const stackStyle: CSSProperties = {
    width: bundle.canvasWidth,
    height: bundle.canvasHeight,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
    backgroundColor: "#ffffff",
  };

  const updateTweak = <K extends keyof ClientTwizzlerTweaks>(key: K, value: ClientTwizzlerTweaks[K]) => {
    setState((prev) => ({ ...prev, tweaks: { ...prev.tweaks, [key]: value } }));
  };

  const setSize = (sizeId: ClientSizePresetId) => {
    setState((prev) => ({ ...prev, sizeId }));
  };

  const setLayout = (layoutId: ClientLayoutPresetId) => {
    setState((prev) => ({
      ...prev,
      layoutId,
      tweaks: resetTweaksForPresets(layoutId, prev.colorId),
    }));
  };

  const setColor = (colorId: ClientColorPresetId) => {
    setState((prev) => ({
      ...prev,
      colorId,
      tweaks: resetTweaksForPresets(prev.layoutId, colorId),
    }));
  };

  return (
    <div className="client-app">
      <header className="client-header">
        <div className="client-brand">
          <img src="/connect-logo.svg" alt="Cloudflare Connect" className="client-logo" />
          <div>
            <p className="client-eyebrow">Connect shader</p>
            <h1>Client preview</h1>
          </div>
        </div>
        <p className="client-lede">
          Limited Twizzler + rain controls for review. Camera and full lab editing are locked.
        </p>
      </header>

      <div className="client-body">
        <main className="client-stage" aria-label="Shader preview">
          <div className="client-stage-frame">
            <div className="client-canvas-stack" style={stackStyle}>
              <canvas
                ref={twizzlerRef}
                className="client-canvas-twizzler"
                aria-hidden="true"
                hidden={!state.twizzlerEnabled}
              />
              <canvas ref={outputRef} className="client-canvas-output" />
            </div>
          </div>
          <p className="client-meta">
            {bundle.canvasWidth}×{bundle.canvasHeight}
            <span aria-hidden="true"> · </span>
            {state.twizzlerEnabled ? "Twizzler on" : "Twizzler off"}
            <span aria-hidden="true"> · </span>
            {state.rainEnabled ? "Rain on" : "Rain off"}
          </p>
        </main>

        <aside className="client-panel" aria-label="Limited controls">
          <section className="client-section">
            <h2>Layers</h2>
            <label className="client-toggle">
              <input
                type="checkbox"
                checked={state.twizzlerEnabled}
                onChange={(event) => setState((prev) => ({ ...prev, twizzlerEnabled: event.target.checked }))}
              />
              <span>Show Twizzler</span>
            </label>
            <label className="client-toggle">
              <input
                type="checkbox"
                checked={state.rainEnabled}
                onChange={(event) => setState((prev) => ({ ...prev, rainEnabled: event.target.checked }))}
              />
              <span>Show rain</span>
            </label>
          </section>

          <PresetChipGroup label="Size" value={state.sizeId} options={CLIENT_SIZE_PRESETS} onChange={setSize} />
          <PresetChipGroup label="Layout" value={state.layoutId} options={CLIENT_LAYOUT_PRESETS} onChange={setLayout} />
          <PresetChipGroup label="Color" value={state.colorId} options={CLIENT_COLOR_PRESETS} onChange={setColor} />

          <section className="client-section">
            <h2>Twizzler tweaks</h2>
            <SliderRow
              label="Opacity"
              value={state.tweaks.opacity}
              min={0.2}
              max={1}
              step={0.01}
              onChange={(value) => updateTweak("opacity", value)}
            />
            <SliderRow
              label="Scale"
              value={state.tweaks.scale}
              min={0.6}
              max={1.6}
              step={0.01}
              onChange={(value) => updateTweak("scale", value)}
            />
            <SliderRow
              label="Rotation / twist"
              value={state.tweaks.twist}
              min={0}
              max={2.5}
              step={0.01}
              onChange={(value) => updateTweak("twist", value)}
            />
            <SliderRow
              label="Amplitude"
              value={state.tweaks.amplitude}
              min={0.4}
              max={1.5}
              step={0.01}
              onChange={(value) => updateTweak("amplitude", value)}
            />
            <SliderRow
              label="Vertical position"
              value={state.tweaks.centerY}
              min={0.15}
              max={0.75}
              step={0.01}
              onChange={(value) => updateTweak("centerY", value)}
            />
            <SliderRow
              label="Motion"
              value={state.tweaks.speed}
              min={0}
              max={0.4}
              step={0.01}
              onChange={(value) => updateTweak("speed", value)}
            />
          </section>

          <p className="client-footnote">
            Full authoring lab (camera, drawers, exports): <code>/lab.html</code>
          </p>
        </aside>
      </div>
    </div>
  );
}
