import { statSync } from "node:fs";
import type { Plugin, ViteDevServer } from "vite";

const lastSeenMtime = new Map<string, number>();

function invalidateIfFileChanged(server: ViteDevServer, file: string) {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return;
  }

  const previous = lastSeenMtime.get(file);
  lastSeenMtime.set(file, mtimeMs);
  if (previous === undefined || previous === mtimeMs) return;

  for (const environment of Object.values(server.environments)) {
    const graph = environment.moduleGraph;
    for (const mod of graph.getModulesByFile(file) ?? []) {
      graph.invalidateModule(mod);
    }
  }
}

export function freshModules(): Plugin {
  return {
    name: "marketing:fresh-modules",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = request.url;
        if (
          !url ||
          url.includes("/node_modules/") ||
          url.startsWith("/_astro/")
        ) {
          next();
          return;
        }

        const path = url.split("?")[0];
        if (!path.startsWith("/src/")) {
          next();
          return;
        }

        invalidateIfFileChanged(server, `${server.config.root}${path}`);
        next();
      });
    },
  };
}
