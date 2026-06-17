import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

function bundleDts(): import("vite").Plugin {
  return {
    name: "bundle-dts",
    enforce: "post",
    apply: "build",
    async closeBundle() {
      const { Extractor, ExtractorConfig } = await import("@microsoft/api-extractor");
      const root = resolve(__dirname);
      const outDir = resolve(__dirname, "dist");
      const configObject: import("@microsoft/api-extractor").IConfigFile = {
        projectFolder: root,
        mainEntryPointFilePath: resolve(outDir, "src/public.d.ts"),
        bundledPackages: [],
        compiler: {
          tsconfigFilePath: resolve(root, "tsconfig.json"),
        },
        apiReport: { enabled: false, reportFileName: "stripes-shader.api.md" },
        docModel: { enabled: false },
        dtsRollup: {
          enabled: true,
          publicTrimmedFilePath: resolve(outDir, "index.d.ts"),
        },
        tsdocMetadata: { enabled: false },
        messages: {
          compilerMessageReporting: { default: { logLevel: "none" as const } },
          extractorMessageReporting: { default: { logLevel: "none" as const } },
        },
      };
      const config = ExtractorConfig.prepare({
        configObject,
        configObjectFullPath: resolve(root, "api-extractor.json"),
        packageJsonFullPath: resolve(root, "package.json"),
      });
      Extractor.invoke(config, { localBuild: true });
      await rm(resolve(outDir, "src"), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    dts({
      tsconfigPath: "./tsconfig.json",
      include: ["src/public.ts", "src/**/*.ts", "src/**/*.tsx"],
    }),
    bundleDts(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/public.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "pixi.js"],
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
