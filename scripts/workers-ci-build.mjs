import { execSync } from "node:child_process";

// Workers Builds defaults to `npx wrangler deploy` with an empty build command.
// Build the lab assets during install when running in that CI environment.
if (process.env.WORKERS_CI === "1") {
  execSync("pnpm run build", { stdio: "inherit" });
}
