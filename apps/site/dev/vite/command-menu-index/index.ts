import path from "node:path";
import type { Plugin } from "vite";
import {
  buildCommandMenuIndex,
  renderCommandMenuIndexModule,
  type CommandMenuIndex,
} from "./generate";

const virtualId = "virtual:command-menu-index";
const resolvedId = `\0${virtualId}`;
const root = process.cwd();

interface CommandMenuIndexOptions {
  blogDir?: string;
  caseStudyDir?: string;
}

export function commandMenuIndex(
  options: CommandMenuIndexOptions = {}
): Plugin {
  const blogDir = path.resolve(
    options.blogDir ?? path.join(root, "src/components/_pages/blog/content")
  );
  const caseStudyDir = path.resolve(
    options.caseStudyDir ??
      path.join(root, "src/components/_pages/case-studies/story/content")
  );
  let cache: CommandMenuIndex | null = null;

  const generate = () => buildCommandMenuIndex(blogDir, caseStudyDir);
  const get = () => {
    cache ??= generate();
    return cache;
  };
  const isSourceFile = (file: string) => {
    const resolvedFile = path.resolve(file);
    return (
      resolvedFile.endsWith(".json") &&
      (path.dirname(resolvedFile) === blogDir ||
        path.dirname(resolvedFile) === caseStudyDir)
    );
  };

  return {
    name: "vite-plugin-command-menu-index",
    buildStart() {
      cache = generate();
    },
    resolveId(id) {
      if (id === virtualId) return resolvedId;
      return null;
    },
    load(id) {
      if (id !== resolvedId) return null;
      return renderCommandMenuIndexModule(get());
    },
    configureServer(server) {
      server.watcher.add([blogDir, caseStudyDir]);
      const onChange = (file: string) => {
        if (!isSourceFile(file)) return;
        cache = null;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onChange);
      server.watcher.on("change", onChange);
      server.watcher.on("unlink", onChange);
    },
  };
}
