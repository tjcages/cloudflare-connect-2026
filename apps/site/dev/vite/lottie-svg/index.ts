import path from "node:path";
import type { Plugin } from "vite";
import { buildLottieSvgRegistry, writeLottieSvgRegistry } from "./generate";
import {
  DEFAULT_CSS_PATH,
  DEFAULT_LOTTIE_DIR,
  DEFAULT_OUT_PATH,
} from "./registry";

interface LottieSvgOptions {
  cssPath?: string;
  dir?: string;
  outPath?: string;
}

export function lottieSvg(options: LottieSvgOptions = {}): Plugin {
  const dir = options.dir ?? DEFAULT_LOTTIE_DIR;
  const cssPath = options.cssPath ?? DEFAULT_CSS_PATH;
  const outPath = options.outPath ?? DEFAULT_OUT_PATH;

  const run = () => {
    writeLottieSvgRegistry(buildLottieSvgRegistry(dir, cssPath), outPath);
  };

  return {
    name: "vite-plugin-lottie-svg",
    buildStart() {
      run();
    },
    configureServer(server) {
      server.watcher.add(dir);
      const onChange = (file: string) => {
        if (path.dirname(file) !== dir) return;
        if (!file.endsWith(".json")) return;
        run();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
