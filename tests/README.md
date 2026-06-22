# E2E gates (Playwright)

- `perf.spec.ts` — renders the engine at 4K and asserts a 60fps frame-time budget when a GPU timer is available; soft-skips on software renderers.
- `visual.spec.ts` — deterministic visual golden at a fixed seed/clock/DPR.

## Visual goldens are per-OS

Playwright keys screenshot baselines by platform (e.g. `*-darwin.png`, `*-linux.png`).
The committed golden was generated on macOS. A Linux CI runner will not match it — on
first Linux run, generate and commit a Linux baseline with `pir test:e2e -- --update-snapshots`.
