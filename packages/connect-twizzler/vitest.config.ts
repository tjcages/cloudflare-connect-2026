import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: { environment: "happy-dom", pool: "threads", globals: true },
});
