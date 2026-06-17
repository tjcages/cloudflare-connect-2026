import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: "happy-dom",
    /** `forks` (Vitest default) is much slower here with many jsdom/happy-dom workers; threads pool is ~order-of-magnitude faster for this suite. */
    pool: "threads",
    globals: true,
    setupFiles: ["./src/test/setupLocalStorage.ts", "./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "dist/**", ".worktrees/**"],
    // @ts-expect-error Vitest-only option valid at runtime; Vite `InlineConfig` typings omit it under `tsc -b`.
    environmentMatchGlobs: [
      ["src/grid/**/*.test.ts", "node"],
      ["src/lib/**/*.test.ts", "node"],
      ["src/theme/**/*.test.ts", "node"],
    ],
  },
});
