import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/",
  plugins: [tailwindcss(), react()],
  server: { port: 5174 },
  test: {
    environment: "node",
  },
});
