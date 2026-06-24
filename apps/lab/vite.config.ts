import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const playground = mode === "playground";

  return {
    base: playground ? "/playground/" : "/",
    plugins: [tailwindcss(), react()],
    server: { port: 5174 },
    build: playground ? { outDir: "../studio/dist/playground", emptyOutDir: false } : undefined,
    test: {
      environment: "node",
    },
  };
});
