#!/usr/bin/env node
/**
 * Upload a Worker version with a stable branch preview alias.
 * Does not promote production. Requires CLOUDFLARE_API_TOKEN (or wrangler login).
 *
 * Usage (repo root):
 *   pnpm run preview:upload
 *   PREVIEW_ALIAS=my-alias pnpm run preview:upload
 */
import { execSync } from "node:child_process";

function branchSlug(branch) {
  return branch
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const branch = process.env.PREVIEW_BRANCH || execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
const alias = process.env.PREVIEW_ALIAS || branchSlug(branch);

if (!alias || !/^[a-z][a-z0-9-]*$/.test(alias)) {
  console.error(`Invalid preview alias: ${JSON.stringify(alias)}`);
  process.exit(1);
}

const previewHost = `${alias}-connect-shader.off-brand.workers.dev`;
console.log(`Branch:  ${branch}`);
console.log(`Alias:   ${alias}`);
console.log(`Preview: https://${previewHost}/`);

execSync("pnpm run build", { stdio: "inherit" });
execSync(`pnpm --filter lab exec wrangler versions upload --name connect-shader --preview-alias ${alias}`, {
  stdio: "inherit",
  env: process.env,
});

console.log(`\nBranch preview URL:\nhttps://${previewHost}/`);
console.log(`https://${previewHost}/client.html`);
