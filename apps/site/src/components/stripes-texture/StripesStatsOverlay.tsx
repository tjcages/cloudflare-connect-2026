import type { StripesStats } from "@necatikcl/stripes-engine/stats";
import { useEffect, useState } from "react";

import { useStripesStatsOpen } from "./stripes-debug";

const HOTKEY_LABEL = "Shift+D";

function fixed(value: number, digits = 1) {
  return value.toFixed(digits);
}

export default function StripesStatsOverlay() {
  const enabled = useStripesStatsOpen();
  const [stats, setStats] = useState<StripesStats | null>(null);

  // The stats module is only fetched on the first toggle, and the engine
  // collects nothing until this subscription exists — so the readout is free
  // while it is off.
  useEffect(() => {
    if (!enabled) {
      setStats(null);
      return;
    }
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    void import("@necatikcl/stripes-engine/stats").then(
      ({ subscribeStripesStats }) => {
        if (cancelled) return;
        unsubscribe = subscribeStripesStats(
          (next) => {
            setStats(next);
            console.info(
              `[stripes] ${next.rendering}/${next.total} rendering · ${next.paused} paused · ${
                next.revealOpen
              } reveal-open · ${fixed(next.megapixelsPerFrame, 2)} Mpx out/frame · ${fixed(
                next.shadedMegapixelsPerFrame,
                2
              )} Mpx shaded/frame · ${fixed(next.blitsPerSecond)} blits/s`,
              next.instances.map(
                (row) =>
                  `${row.label}#${row.id.replace("shared-", "")} out ${row.outputWidth}x${
                    row.outputHeight
                  } field ${row.fieldWidth}x${row.fieldHeight} (x${row.fieldScale}) shaded ${fixed(
                    row.shadedMegapixels,
                    2
                  )}M ${row.rendering ? "LIVE" : "paused"} ${fixed(row.fps)}fps/cap${
                    row.maxFps || "∞"
                  } [${row.passes.map((pass) => `${pass.name} ${pass.width}x${pass.height}${pass.dispatches > 1 ? `x${pass.dispatches}` : ""}`).join(" | ")}]`
              )
            );
          },
          { intervalMs: 500 }
        );
      }
    );
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [enabled]);

  if (!enabled) return null;

  const shadedMpxPerSecond = stats
    ? stats.instances.reduce(
        (sum, row) => sum + row.shadedMegapixels * row.fps,
        0
      )
    : 0;

  return (
    <div className="backdrop-blur-sm pointer-events-none fixed top-8 right-8 z-9999 max-h-[80vh] w-420 overflow-y-auto rounded-8 bg-darker/88 p-12 font-mono text-[11px] leading-normal text-lighter shadow-elevation-default">
      <div className="mb-8 flex items-baseline justify-between gap-8">
        <span className="font-bold">stripes</span>
        <span className="opacity-60">{HOTKEY_LABEL} to close</span>
      </div>

      {stats ? (
        <>
          <div className="grid grid-cols-2 gap-x-12">
            <span className="opacity-60">registered</span>
            <span>{stats.total}</span>
            <span className="opacity-60">rendering</span>
            <span className={stats.rendering > 0 ? "text-blue-400" : undefined}>
              {stats.rendering}
            </span>
            <span className="opacity-60">paused</span>
            <span>{stats.paused}</span>
            <span className="opacity-60">reveal gate open</span>
            <span>{stats.revealOpen}</span>
            <span className="opacity-60">Mpx out / frame</span>
            <span
              className={
                stats.megapixelsPerFrame > 4 ? "text-orange-400" : undefined
              }
            >
              {fixed(stats.megapixelsPerFrame, 2)}
            </span>
            <span className="opacity-60">Mpx shaded / frame</span>
            <span
              className={
                stats.shadedMegapixelsPerFrame > 4
                  ? "text-orange-400"
                  : "text-green-400"
              }
            >
              {fixed(stats.shadedMegapixelsPerFrame, 2)}
            </span>
            <span className="opacity-60">blits / s</span>
            <span>{fixed(stats.blitsPerSecond)}</span>
            <span className="opacity-60">Mpx shaded / s</span>
            <span
              className={
                shadedMpxPerSecond > 100 ? "text-orange-400" : undefined
              }
            >
              {fixed(shadedMpxPerSecond)}
            </span>
          </div>

          <div className="relative mt-8 flex flex-col gap-8 pt-8 before:inside-border-t before:border-lighter/20">
            {stats.instances.length === 0 && (
              <span className="opacity-60">no instances registered</span>
            )}
            {stats.instances.map((row) => (
              <div className="flex flex-col gap-1" key={row.id}>
                <div className="flex items-baseline gap-6">
                  <span
                    className={row.rendering ? "text-blue-400" : "opacity-35"}
                  >
                    {row.rendering ? "●" : "○"}
                  </span>
                  <span className="w-104 shrink-0 truncate">{row.label}</span>
                  <span className="shrink-0 opacity-60">
                    {row.outputWidth}×{row.outputHeight}
                  </span>
                  <span className="ml-auto shrink-0 tabular-nums">
                    {fixed(row.shadedMegapixels, 2)}M
                  </span>
                  <span className="w-56 shrink-0 text-right tabular-nums opacity-80">
                    {fixed(row.fps)}/{row.maxFps || "∞"}
                  </span>
                  {row.revealGateOpen && (
                    <span className="shrink-0 text-green-400">R</span>
                  )}
                </div>

                <div className="flex items-baseline gap-6 pl-18 opacity-70">
                  <span>field</span>
                  <span className="text-green-400">
                    {row.fieldWidth}×{row.fieldHeight}
                  </span>
                  <span>
                    ×{row.fieldScale} · out {fixed(row.megapixels, 2)}M
                  </span>
                </div>

                {row.passes.length === 0 ? (
                  <span className="pl-18 opacity-40">
                    no pass sample yet — waiting for a rendered frame
                  </span>
                ) : (
                  row.passes.map((pass, index) => (
                    <div
                      className="flex items-baseline gap-6 pl-18"
                      key={`${pass.name}-${index}`}
                    >
                      <span
                        className={
                          pass.atOutputResolution
                            ? "w-136 shrink-0 truncate text-orange-400"
                            : "w-136 shrink-0 truncate opacity-70"
                        }
                      >
                        {pass.name}
                      </span>
                      <span className="shrink-0 opacity-55">
                        {pass.width}×{pass.height}
                        {pass.dispatches > 1 && `×${pass.dispatches}`}
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums opacity-80">
                        {fixed(pass.pixels / 1e6, 3)}M
                      </span>
                      <span className="w-40 shrink-0 text-right tabular-nums opacity-45">
                        {fixed(
                          (pass.pixels /
                            Math.max(1, row.shadedMegapixels * 1e6)) *
                            100,
                          0
                        )}
                        %
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <span className="opacity-60">waiting for the first sample…</span>
      )}
    </div>
  );
}
