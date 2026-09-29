import { useEffect, useRef, useState } from "react";
import { createLayer, EXPORT_WIDTH, FPS, FRAMES, LAYER_NAMES, type LayerName } from "./layers";
import "./sofi-stadium.css";

declare global {
  interface Window {
    /** Export hook driven by scripts/export-sofi-stadium.mjs. */
    sofiStadium?: { createLayer: typeof createLayer; FRAMES: number; EXPORT_WIDTH: number };
  }
}

const LABELS: Record<LayerName, string> = { twizzler: "Twizzler", rain: "Rain", logo: "Logo" };
/** Preview renders below export size so all three layers hold real time. */
const PREVIEW_MAX_WIDTH = 2880;

export default function SofiStadium() {
  const stage = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<Record<LayerName, boolean>>({ twizzler: true, rain: true, logo: true });
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    window.sofiStadium = { createLayer, FRAMES, EXPORT_WIDTH };
    // `?export` leaves the page idle so the exporter has the GPU to itself.
    if (new URLSearchParams(location.search).has("export")) return;
    const host = stage.current!;
    const width = Math.min(PREVIEW_MAX_WIDTH, Math.round(host.clientWidth * devicePixelRatio));
    const layers = LAYER_NAMES.map((name) => {
      const layer = createLayer(name, width);
      layer.canvas.dataset.layer = name;
      host.appendChild(layer.canvas);
      return layer;
    });
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const target = Math.floor(((performance.now() - start) / 1000) * FPS) % FRAMES;
      for (const layer of layers) {
        // Rain is sequential, so every layer steps (at most two frames per paint) toward real time.
        for (let i = 0; i < 2 && layer.frame !== (target + 1) % FRAMES; i += 1) layer.step();
      }
      setFrame(layers[0]!.frame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      for (const layer of layers) {
        layer.canvas.remove();
        layer.dispose();
      }
    };
  }, []);

  return (
    <main className="sofi-stadium">
      <div
        className="sofi-stadium-stage"
        ref={stage}
        data-hide={LAYER_NAMES.filter((name) => !visible[name]).join(" ")}
      />
      <div className="sofi-stadium-controls">
        {LAYER_NAMES.map((name) => (
          <label key={name}>
            <input
              checked={visible[name]}
              onChange={(event) => setVisible((current) => ({ ...current, [name]: event.target.checked }))}
              type="checkbox"
            />
            {LABELS[name]}
          </label>
        ))}
        <span className="sofi-stadium-time">{(frame / FPS).toFixed(2)}s / 30s</span>
      </div>
    </main>
  );
}
