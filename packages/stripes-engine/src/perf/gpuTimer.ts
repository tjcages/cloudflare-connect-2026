type TimerExt = { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number };
type PendingQuery = { name: string; query: WebGLQuery };

export type GpuTimer = {
  supported: boolean;
  begin(name: string): void;
  end(): void;
  poll(): void;
  latest(): Record<string, number>;
};

export function createGpuTimer(gl: WebGL2RenderingContext): GpuTimer {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!ext) {
    return { supported: false, begin() {}, end() {}, poll() {}, latest: () => ({}) };
  }
  const pending: PendingQuery[] = [];
  const results: Record<string, number> = {};
  let active: PendingQuery | null = null;
  return {
    supported: true,
    begin(name: string) {
      const query = gl.createQuery();
      if (!query) return;
      active = { name, query };
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    poll() {
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
      for (let i = pending.length - 1; i >= 0; i--) {
        const q = pending[i];
        const available = gl.getQueryParameter(q.query, gl.QUERY_RESULT_AVAILABLE);
        if (available || disjoint) {
          if (available && !disjoint) {
            const ns = gl.getQueryParameter(q.query, gl.QUERY_RESULT) as number;
            results[q.name] = ns / 1e6;
          }
          gl.deleteQuery(q.query);
          pending.splice(i, 1);
        }
      }
    },
    latest: () => ({ ...results }),
  };
}
