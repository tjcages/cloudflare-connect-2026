import { execSync } from "node:child_process";

// Workers Builds defaults to `npx wrangler deploy` with an empty build command.
// The shader remains the default for the existing integration. The site Worker
// sets WORKERS_BUILD_APP=site in its build configuration.
if (process.env.WORKERS_CI === "1") {
  const target = process.env.WORKERS_BUILD_APP === "site" ? "site" : "shader";
  execSync(`pnpm run build:${target}`, { stdio: "inherit" });
}
