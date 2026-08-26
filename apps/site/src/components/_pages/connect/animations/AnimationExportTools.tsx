import type { SharedShaderHandle } from "@necatikcl/stripes-engine/react";
import { ControlAction, ControlSection } from "@tjcages/panels/dev";
import { useRef, useState, type RefObject } from "react";
import {
  exportLabVideo,
  formatVideoExportStatusLabel,
  resolveRealtimeVideoExportProfile,
  type LabVideoExportPhase,
} from "../../../../../../../apps/lab/src/export/videoExport";
import type { ConnectHeroRain } from "../hero/rain-control-settings";
import type { ConnectTwizzlerSettings } from "../hero/twizzler-control-settings";
import { buildAnimationSvg, exportAnimationEps, exportAnimationSvg } from "./animation-exports";
import "./connect-animations.css";

type VectorKind = "SVG" | "EPS";

const createCaptureCanvas = (
  stage: HTMLDivElement | null,
  rainCanvas: HTMLCanvasElement | null,
  twizzlerCanvas: HTMLCanvasElement | null,
) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(
    1,
    rainCanvas?.width ?? 0,
    twizzlerCanvas?.width ?? 0,
    Math.round((stage?.clientWidth ?? 1) * dpr),
  );
  canvas.height = Math.max(
    1,
    rainCanvas?.height ?? 0,
    twizzlerCanvas?.height ?? 0,
    Math.round((stage?.clientHeight ?? 1) * dpr),
  );
  return canvas;
};

export default function AnimationExportTools({
  getAnimationTimeSec,
  rain,
  rainCanvasRef,
  rainHandleRef,
  settings,
  stageRef,
  twizzlerCanvasRef,
}: {
  getAnimationTimeSec: () => number;
  rain: ConnectHeroRain;
  rainCanvasRef: RefObject<HTMLCanvasElement | null>;
  rainHandleRef: RefObject<SharedShaderHandle | null>;
  settings: ConnectTwizzlerSettings;
  stageRef: RefObject<HTMLDivElement | null>;
  twizzlerCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [phase, setPhase] = useState<LabVideoExportPhase>("idle");
  const [recording, setRecording] = useState({ elapsedMs: 0, totalMs: 0 });
  const [transcodePercent, setTranscodePercent] = useState<number | null>(null);
  const [transcodeStartedAt, setTranscodeStartedAt] = useState(0);
  const [vectorBusy, setVectorBusy] = useState<VectorKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRainRef = useRef(rain);
  const latestSettingsRef = useRef(settings);
  const stopRecordingRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  latestRainRef.current = rain;
  latestSettingsRef.current = settings;

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

    const captureCanvas = createCaptureCanvas(stageRef.current, rainCanvasRef.current, twizzlerCanvasRef.current);

    const runId = ++runIdRef.current;
    const stopRecording = new AbortController();
    stopRecordingRef.current = stopRecording;
    setError(null);
    setRecording({ elapsedMs: 0, totalMs: 0 });
    setTranscodePercent(null);
    setTranscodeStartedAt(0);
    setPhase("recording");

    try {
      const profile = resolveRealtimeVideoExportProfile(captureCanvas.width, captureCanvas.height);
      await exportLabVideo({
        canvas: captureCanvas,
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
        isSourceVisible: () => false,
        sourceKind: "image",
        stopSignal: stopRecording.signal,
        underlayLayers: [
          {
            isVisible: () => latestSettingsRef.current.enabled,
            source: () => twizzlerCanvasRef.current,
          },
          {
            isVisible: () => latestRainRef.current.enabled,
            source: () => rainCanvasRef.current,
          },
        ],
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
    const rainCanvas = rainCanvasRef.current;
    const twizzlerCanvas = twizzlerCanvasRef.current;
    if (vectorBusy) return;

    setError(null);
    setVectorBusy(kind);
    try {
      const svg = await buildAnimationSvg({
        animationTimeSec: getAnimationTimeSec(),
        canvasHeightPx: stageRef.current?.clientHeight,
        canvasWidthPx: stageRef.current?.clientWidth,
        handle: rainHandleRef.current,
        rain,
        rainCanvas,
        rainEnabled: rain.enabled,
        settings,
        twizzlerCanvas,
        twizzlerEnabled: settings.enabled,
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
