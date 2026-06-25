import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const enginePath = (sub: string) => fileURLToPath(new URL(`../../packages/stripes-engine/src/${sub}`, import.meta.url));

export default defineConfig({
  base: "/",
  plugins: [tailwindcss(), react()],
  server: { port: 5174 },
  resolve: {
    alias: {
      "@necatikcl/stripes-engine/react": enginePath("react/index.ts"),
      "@necatikcl/stripes-engine": enginePath("index.ts"),
    },
  },
  optimizeDeps: { exclude: ["@necatikcl/stripes-engine"] },
  test: {
    environment: "node",
  },
});
