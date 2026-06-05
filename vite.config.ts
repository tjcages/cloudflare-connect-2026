import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

function playgroundPathRedirect() {
  return {
    name: "playground-path-redirect",
    configureServer(server: {
      middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void };
    }) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/playground" || req.url === "/playground/") {
          req.url = "/playground.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [playgroundPathRedirect(), tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(projectRoot, "index.html"),
        playground: path.resolve(projectRoot, "playground.html"),
      },
    },
  },
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
      ["src/store*.test.ts", "node"],
      ["src/canvas/hitTest.test.ts", "node"],
      ["src/canvas/scrollAroundEdges.test.ts", "node"],
      ["src/canvas/selection-setup.test.ts", "node"],
      ["src/canvas/components/connector-line/**/*.test.ts", "node"],
    ],
  },
});
