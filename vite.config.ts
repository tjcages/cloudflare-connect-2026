import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
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

/**
 * Dev-only file API for the saved-shader library so the playground can persist shaders to disk
 * (committable, shareable). Reads happen via `import.meta.glob`; this only handles writes/deletes.
 * Files live in `src/playground/savedShaderLibrary/<id>.json`.
 */
function savedShaderFileApi() {
  const libraryDir = path.resolve(projectRoot, "src/playground/savedShaderLibrary");
  const apiBase = "/__playground/saved-shaders";
  const isSafeId = (id: string) => id.length > 0 && id.length <= 200 && /^[A-Za-z0-9_-]+$/.test(id);

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: Buffer) => {
        data += chunk.toString();
        if (data.length > 5_000_000) {
          reject(new Error("Saved shader payload too large."));
        }
      });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

  const sendJson = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };

  return {
    name: "saved-shader-file-api",
    configureServer(server: {
      middlewares: {
        use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0] ?? "";
        if (!pathname.startsWith(apiBase)) {
          next();
          return;
        }
        void (async () => {
          try {
            await fs.mkdir(libraryDir, { recursive: true });
            if (req.method === "POST" && (pathname === apiBase || pathname === `${apiBase}/`)) {
              const parsed = JSON.parse(await readBody(req)) as { id?: unknown };
              const id = typeof parsed.id === "string" ? parsed.id : "";
              if (!isSafeId(id)) {
                sendJson(res, 400, { ok: false, error: "Invalid shader id." });
                return;
              }
              await fs.writeFile(path.join(libraryDir, `${id}.json`), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
              sendJson(res, 200, { ok: true, id });
              return;
            }
            if (req.method === "DELETE" && pathname.startsWith(`${apiBase}/`)) {
              const id = decodeURIComponent(pathname.slice(apiBase.length + 1));
              if (!isSafeId(id)) {
                sendJson(res, 400, { ok: false, error: "Invalid shader id." });
                return;
              }
              await fs.rm(path.join(libraryDir, `${id}.json`), { force: true });
              sendJson(res, 200, { ok: true, id });
              return;
            }
            next();
          } catch (error) {
            sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unknown error." });
          }
        })();
      });
    },
    // Writing a library file should not trigger an HMR reload: the app already updated its in-memory
    // list from the POST response, and the file is picked up on the next full load.
    handleHotUpdate(ctx: { file: string }) {
      if (ctx.file.startsWith(libraryDir)) {
        return [];
      }
      return undefined;
    },
  };
}

export default defineConfig({
  plugins: [playgroundPathRedirect(), savedShaderFileApi(), tailwindcss(), react()],
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
      ["src/playground/exportParityDiagnostic.test.ts", "node"],
    ],
  },
});
