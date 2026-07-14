import type { PerfSnapshot } from "@necatikcl/stripes-engine";

export function PerfOverlay({ snap }: { snap: PerfSnapshot }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "4px 6px",
        borderRadius: 4,
        background: "rgba(0,0,0,0.42)",
        color: "#0f0",
        font: "8px ui-monospace, monospace",
        lineHeight: 1.25,
        whiteSpace: "pre",
        pointerEvents: "none",
        textAlign: "center",
        zIndex: 20,
      }}
    >
      {`fps ${snap.fps.toFixed(1)} · frame ${snap.frameMs.p50.toFixed(1)}ms`}
    </div>
  );
}
