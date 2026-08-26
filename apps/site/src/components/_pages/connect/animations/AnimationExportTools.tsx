import type { SharedShaderHandle } from "@necatikcl/stripes-engine/react";
import type { TwizzlerSettings } from "@tjcages/connect-twizzler";
import { ControlAction, ControlSection } from "@tjcages/panels/dev";
import { useRef, useState, type RefObject } from "react";
import {
  exportLabVideo,
  formatVideoExportStatusLabel,
  resolveRealtimeVideoExportProfile,
  type LabVideoExportPhase,
} from "../../../../../../../apps/lab/src/export/videoExport";
import type { ConnectHeroRain } from "../hero/rain-control-settings";
import { buildAnimationSvg, exportAnimationEps, exportAnimationSvg } from "./animation-exports";
import "./connect-animations.css";

type VectorKind = "SVG" | "EPS";

export default function AnimationExportTools({
  getAnimationTimeSec,
  rain,
  rainCanvasRef,
  rainHandleRef,
  settings,
  twizzlerCanvasRef,
}: {
  getAnimationTimeSec: () => number;
  rain: ConnectHeroRain;
  rainCanvasRef: RefObject<HTMLCanvasElement | null>;
  rainHandleRef: RefObject<SharedShaderHandle | null>;
  settings: TwizzlerSettings;
  twizzlerCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [phase, setPhase] = useState<LabVideoExportPhase>("idle");
  const [recording, setRecording] = useState({ elapsedMs: 0, totalMs: 0 });
  const [transcodePercent, setTranscodePercent] = useState<number | null>(null);
  const [transcodeStartedAt, setTranscodeStartedAt] = useState(0);
  const [vectorBusy, setVectorBusy] = useState<VectorKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRainRef = useRef(rain);
  const stopRecordingRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  latestRainRef.current = rain;

  const videoBusy = phase !== "idle" && phase !== "done" && phase !== "failed";
  const videoLabel = formatVideoExportStatusLabel(
    phase,
    recording,
    transcodePercent,
    transcodeStartedAt > 0 ? performance.now() - transcodeStartedAt : 0,
  );

  const exportVideo = async () => {
    if (phase === "recording") {
      setPhase("finishing");
      stopRecordingRef.current?.abort();
      return;
    }
    if (videoBusy) return;

    const twizzlerCanvas = twizzlerCanvasRef.current;
    const rainCanvas = rainCanvasRef.current;
    if (!twizzlerCanvas || !rainCanvas) return;

    const runId = ++runIdRef.current;
    const stopRecording = new AbortController();
    stopRecordingRef.current = stopRecording;
    setError(null);
    setRecording({ elapsedMs: 0, totalMs: 0 });
    setTranscodePercent(null);
    setTranscodeStartedAt(0);
    setPhase("recording");

    try {
      const profile = resolveRealtimeVideoExportProfile(rainCanvas.width, rainCanvas.height);
      await exportLabVideo({
        canvas: rainCanvas,
        filename: "cloudflare-connect-animation.mp4",
        fps: profile.fps,
        getBackground: () => latestRainRef.current.exportBackground,
        onPhase: (nextPhase) => {
          setPhase(nextPhase);
          if (nextPhase === "transcoding") {
            setTranscodeStartedAt(performance.now());
          }
        },
        onProgress: (elapsedMs, totalMs) => setRecording({ elapsedMs, totalMs }),
        onTranscodeProgress: setTranscodePercent,
        sourceKind: "image",
        stopSignal: stopRecording.signal,
        underlayCanvases: [twizzlerCanvas],
        videoBitsPerSecond: profile.videoBitsPerSecond,
      });
    } catch (caught) {
      if (runId !== runIdRef.current) return;
      setError(caught instanceof Error ? caught.message : String(caught));
      setPhase("failed");
    } finally {
      if (runId === runIdRef.current) {
        stopRecordingRef.current = null;
        window.setTimeout(() => {
          if (runId === runIdRef.current) setPhase("idle");
        }, 1_200);
      }
    }
  };

  const exportVector = async (kind: VectorKind) => {
    const handle = rainHandleRef.current;
    const rainCanvas = rainCanvasRef.current;
    const twizzlerCanvas = twizzlerCanvasRef.current;
    if (!handle || !rainCanvas || !twizzlerCanvas || vectorBusy) return;

    setError(null);
    setVectorBusy(kind);
    try {
      const svg = await buildAnimationSvg({
        animationTimeSec: getAnimationTimeSec(),
        handle,
        rain,
        rainCanvas,
        settings,
        twizzlerCanvas,
      });
      if (kind === "SVG") exportAnimationSvg(svg);
      else exportAnimationEps(svg);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setVectorBusy(null);
    }
  };

  return (
    <ControlSection defaultOpen open title="Export">
      <div className="connect-animation-export">
        <ControlAction disabled={videoBusy && phase !== "recording"} label={videoLabel} onClick={exportVideo} />
        <div className="connect-animation-export__vectors">
          <ControlAction
            disabled={vectorBusy !== null}
            label={vectorBusy === "SVG" ? "Exporting SVG…" : "Export SVG"}
            onClick={() => void exportVector("SVG")}
          />
          <ControlAction
            disabled={vectorBusy !== null}
            label={vectorBusy === "EPS" ? "Exporting EPS…" : "Export EPS"}
            onClick={() => void exportVector("EPS")}
          />
        </div>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </ControlSection>
  );
}
