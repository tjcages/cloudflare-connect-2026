import path from "node:path";
import type { Plugin } from "vite";
import { generateIconRegistry, writeIconDts } from "./generate";
import {
  DEFAULT_CSS_PATH,
  DEFAULT_DTS_PATH,
  DEFAULT_SVG_DIR,
  type Registry,
  renderModule,
} from "./registry";

const VIRTUAL_ID = "virtual:icons";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

interface IconsOptions {
  cssPath?: string;
  dtsPath?: string;
  svgDir?: string;
}

export function icons(options: IconsOptions = {}): Plugin {
  const svgDir = options.svgDir ?? DEFAULT_SVG_DIR;
  const cssPath = options.cssPath ?? DEFAULT_CSS_PATH;
  const dtsPath = options.dtsPath ?? DEFAULT_DTS_PATH;
  const ambientDtsPath = dtsPath.replace(/\.d\.ts$/, ".ambient.d.ts");

  let cache: Registry | null = null;

  const generate = (): Registry => generateIconRegistry(svgDir, cssPath);

  const get = (): Registry => {
    cache ??= generate();
    return cache;
  };

  const writeDts = (registry: Registry) => {
    writeIconDts(registry, dtsPath, ambientDtsPath);
  };

  return {
    name: "vite-plugin-icons",
    buildStart() {
      cache = generate();
      writeDts(cache);
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return renderModule(get());
    },
    configureServer(server) {
      server.watcher.add(svgDir);
      const svgDirPrefix = svgDir.endsWith(path.sep)
        ? svgDir
        : svgDir + path.sep;
      const onChange = (file: string) => {
        if (!file.startsWith(svgDirPrefix)) {
          return;
        }
        cache = generate();
        writeDts(cache);
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
        }
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
