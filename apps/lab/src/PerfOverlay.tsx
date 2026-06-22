import type { PerfSnapshot } from "@necatikcl/stripes-engine";

export function PerfOverlay({ snap }: { snap: PerfSnapshot }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        left: 8,
        padding: "8px 10px",
        borderRadius: 6,
        background: "rgba(0,0,0,0.6)",
        color: "#0f0",
        font: "12px ui-monospace, monospace",
        whiteSpace: "pre",
        pointerEvents: "none",
      }}
    >
      {`fps      ${snap.fps.toFixed(1)}
frame ms p50 ${snap.frameMs.p50.toFixed(2)}  p95 ${snap.frameMs.p95.toFixed(2)}  p99 ${snap.frameMs.p99.toFixed(2)}
gpu ms   ${
        Object.entries(snap.passMs)
          .map(([k, v]) => `${k} ${v.toFixed(2)}`)
          .join("  ") || "(timer unsupported)"
      }
samples  ${snap.sampleCount}`}
    </div>
  );
}
