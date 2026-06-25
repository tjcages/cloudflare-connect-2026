import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "shared-demo"),
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist-shared-demo"),
    emptyOutDir: true,
  },
  worker: {
    format: "es",
  },
});
