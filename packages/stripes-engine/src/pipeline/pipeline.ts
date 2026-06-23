import type { GpuTimer } from "../perf/gpuTimer";

export type Pass = { name: string; render(): void; dispose(): void };

export function runPipeline(passes: Pass[], gpuTimer: GpuTimer): void {
  for (const pass of passes) {
    gpuTimer.begin(pass.name);
    try {
      pass.render();
    } finally {
      gpuTimer.end();
    }
  }
}
