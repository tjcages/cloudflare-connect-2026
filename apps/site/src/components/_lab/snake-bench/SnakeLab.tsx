import { useEffect, useState } from "react";
import Pixi from "@/components/pixi/Pixi";
import { type BenchSummary, benchStats } from "./bench";
import { pixiBench } from "./pixi-bench";
import CanvasBench from "./CanvasBench";

function BaselineBench() {
  "use no memo";

  useEffect(() => {
    let frame = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      benchStats.frame(now, 0);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}

function Readout() {
  "use no memo";

  const [summary, setSummary] = useState<BenchSummary | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setSummary(benchStats.recording ? benchStats.result() : null);
    }, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute right-16 bottom-16 z-10 min-w-260 rounded-8 bg-background-base p-16 text-mono-x-small text-text-base shadow-elevation-default before:inside-border before:border-border-default">
      {summary ? (
        <div className="flex flex-col gap-4">
          <div>
            {summary.impl} · {summary.count} · {summary.shape}
          </div>
          <div>fps {summary.fps}</div>
          <div>
            frame p50 {summary.frameP50} · p95 {summary.frameP95}
          </div>
          <div>
            dropped &gt;17ms {summary.over17} · &gt;33ms {summary.over33}
          </div>
          <div>
            tick p50 {summary.tickP50} · p95 {summary.tickP95}
          </div>
        </div>
      ) : (
        <div>idle — call __bench.start()</div>
      )}
    </div>
  );
}

export default function SnakeLab() {
  "use no memo";

  const params = new URLSearchParams(location.search);
  const impl = params.get("impl") ?? "none";
  const count = Number(params.get("count") ?? 4);
  const bent = params.get("shape") !== "straight";

  benchStats.describe({ impl, count, shape: bent ? "bent" : "straight" });

  return (
    <>
      {impl === "pixi" && (
        <Pixi
          canvasAttrs={{
            "aria-hidden": "true",
            className: "pointer-events-none absolute inset-0 h-full w-full",
          }}
          tickers={[pixiBench(count, bent)]}
        />
      )}

      {impl === "2d" && <CanvasBench count={count} bent={bent} />}

      {impl === "none" && <BaselineBench />}

      <Readout />
    </>
  );
}
