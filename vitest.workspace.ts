import { defineConfig } from "vitest/config";

// Vitest 4 uses `test.projects` instead of the v3 `defineWorkspace` helper.
// Each entry is a path to a project's vitest/vite config file.
export default defineConfig({
  test: {
    projects: [
      "apps/lab/vite.config.ts",
      "apps/figma-plugin/vite.config.ts",
      "packages/stripes-engine/vitest.config.ts",
    ],
  },
});
