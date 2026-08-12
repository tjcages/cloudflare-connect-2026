import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const enginePath = (sub: string) => fileURLToPath(new URL(`../../packages/stripes-engine/src/${sub}`, import.meta.url));

export default defineConfig({
  base: "/",
  plugins: [tailwindcss(), react()],
  server: {
    port: 5174,
    watch: { ignored: ["**/packages/stripes-engine/dist/**", "**/node_modules/.vite/**"] },
  },
  preview: {
    // Quick tunnels / Workers preview hosts for client review links.
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@necatikcl/stripes-engine/react": enginePath("react/index.ts"),
      "@necatikcl/stripes-engine": enginePath("index.ts"),
    },
  },
  optimizeDeps: { exclude: ["@necatikcl/stripes-engine"] },
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        lab: fileURLToPath(new URL("./lab.html", import.meta.url)),
        client: fileURLToPath(new URL("./client.html", import.meta.url)),
        experiments: fileURLToPath(new URL("./experiments.html", import.meta.url)),
      },
    },
  },
  test: {
    environment: "node",
  },
});
