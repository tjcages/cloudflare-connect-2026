import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    // @ts-expect-error Vitest-only option valid at runtime.
    environmentMatchGlobs: [["src/colorSpace.test.ts", "node"]],
    /** `forks` (Vitest default) is much slower here with many jsdom/happy-dom workers; threads pool is ~order-of-magnitude faster for this suite. */
    pool: "threads",
    globals: true,
    // Reuse the studio's test setup files: canvas stub, localStorage shim, and jest-dom matchers.
    setupFiles: ["../../apps/studio/src/test/setupLocalStorage.ts", "../../apps/studio/src/test/setup.ts"],
  },
});
