#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
const files = process.argv.slice(3).filter((file) => {
  const relative = path.relative(process.cwd(), file).split(path.sep).join("/");
  return (
    !relative.startsWith("apps/site/") &&
    !relative.startsWith("packages/connect-twizzler/dist/")
  );
});

if (files.length === 0) process.exit(0);

const commands = {
  format: ["oxfmt", ["--write", "--no-error-on-unmatched-pattern", ...files]],
  lint: ["oxlint", ["-c", ".oxlintrc.json", "--no-error-on-unmatched-pattern", ...files]],
};

if (!(mode in commands)) {
  console.error(`Unknown lint-staged mode: ${mode}`);
  process.exit(1);
}

const [command, args] = commands[mode];
const result = spawnSync(command, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
