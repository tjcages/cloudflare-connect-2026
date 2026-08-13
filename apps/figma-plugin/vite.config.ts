import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const enginePath = (sub: string) => fileURLToPath(new URL(`../../packages/stripes-engine/src/${sub}`, import.meta.url));

function inlinePluginUi(): Plugin {
  return {
    name: "inline-plugin-ui",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (item): item is Extract<typeof item, { type: "asset" }> => item.type === "asset" && item.fileName === "ui.html",
      );
      if (!htmlAsset || typeof htmlAsset.source !== "string") return;

      let html = htmlAsset.source;
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item === htmlAsset) continue;
        if (item.type === "chunk" && item.isEntry) {
          const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          html = html.replace(
            new RegExp(`<script[^>]+src=["'][^"']*${escaped}["'][^>]*></script>`),
            () => `<script>${item.code}</script>`,
          );
          delete bundle[fileName];
        } else if (item.type === "asset" && fileName.endsWith(".css")) {
          const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          html = html.replace(
            new RegExp(`<link[^>]+href=["'][^"']*${escaped}["'][^>]*>`),
            () => `<style>${String(item.source)}</style>`,
          );
          delete bundle[fileName];
        }
      }
      htmlAsset.source = html;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isPluginMain = mode === "plugin-main";
  return {
    plugins: isPluginMain ? [] : [react(), inlinePluginUi()],
    resolve: {
      alias: {
        "@necatikcl/stripes-engine": enginePath("index.ts"),
      },
    },
    build: isPluginMain
      ? {
          outDir: "dist",
          emptyOutDir: false,
          target: "es2020",
          minify: false,
          lib: {
            entry: fileURLToPath(new URL("./src/plugin/main.ts", import.meta.url)),
            name: "ConnectShaderPlugin",
            formats: ["iife"],
            fileName: () => "code.js",
          },
        }
      : {
          outDir: "dist",
          emptyOutDir: true,
          target: "es2020",
          rollupOptions: {
            input: fileURLToPath(new URL("./ui.html", import.meta.url)),
          },
        },
    test: {
      environment: "node",
    },
  };
});
