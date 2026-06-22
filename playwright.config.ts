import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  webServer: {
    command: "pnpm --filter lab dev --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  use: {
    baseURL: "http://localhost:5174",
    launchOptions: {
      // Force a real GPU path in headless Chromium (ANGLE). On GPU-less CI this
      // falls back to SwiftShader; the perf spec detects that and soft-skips.
      args: ["--use-gl=angle", "--use-angle=default", "--ignore-gpu-blocklist", "--enable-gpu"],
    },
  },
});
