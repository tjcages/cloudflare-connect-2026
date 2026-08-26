import { ControlSection } from "@tjcages/panels/dev";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { useState, type RefObject } from "react";
import {
  buildWaveformSvg,
  downloadBlob,
  downloadText,
  recordShaderStack,
} from "./animation-exports";
import "./connect-animations.css";

export default function AnimationExportTools({
  animationStartedAt,
  rainCanvasRef,
  settings,
  twizzlerCanvasRef,
}: {
  animationStartedAt: number;
  rainCanvasRef: RefObject<HTMLCanvasElement | null>;
  settings: TwizzlerSettings;
  twizzlerCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [duration, setDuration] = useState(5);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exportSvg = () => {
    const canvas = twizzlerCanvasRef.current;
    if (!canvas) return;
    const elapsed = Math.max(
      0,
      (performance.now() - animationStartedAt) / 1000
    );
    downloadText(
      buildWaveformSvg(
        canvas.width,
        canvas.height,
        elapsed,
        settings,
        "#000000"
      ),
      "cloudflare-connect-waveform.svg",
      "image/svg+xml"
    );
  };

  const exportVideo = async () => {
    const twizzlerCanvas = twizzlerCanvasRef.current;
    const rainCanvas = rainCanvasRef.current;
    if (!twizzlerCanvas || !rainCanvas || recording) return;
    setError(null);
    setProgress(0);
    setRecording(true);
    try {
      const result = await recordShaderStack({
        twizzlerCanvas,
        rainCanvas,
        durationSec: duration,
        onProgress: setProgress,
      });
      downloadBlob(
        result.blob,
        `cloudflare-connect-animation.${result.extension}`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRecording(false);
      setProgress(0);
    }
  };

  return (
    <ControlSection defaultOpen open title="Export">
      <div className="connect-animation-export">
        <label className="connect-animation-export__duration">
          <span>Video duration</span>
          <input
            aria-label="Video duration in seconds"
            disabled={recording}
            max={30}
            min={1}
            onChange={(event) =>
              setDuration(
                Math.max(1, Math.min(30, Number(event.target.value) || 1))
              )
            }
            step={1}
            type="number"
            value={duration}
          />
        </label>
        <button disabled={recording} onClick={exportVideo} type="button">
          {recording
            ? `Recording ${Math.round(progress * 100)}%`
            : "Export video"}
        </button>
        <button disabled={recording} onClick={exportSvg} type="button">
          Export waveform SVG
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </ControlSection>
  );
}
