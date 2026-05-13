# Project Instructions For AI Agents

## Project Summary

This is a React + TypeScript Canvas component builder. It combines a deterministic seeded grid background with component layers, SVG icon metadata, Canvas rendering, and PNG export.

Read `docs/ai-context.md` before broad architecture work.

## Architecture Boundaries

- Pure grid core: `src/grid/config.ts`, `mask.ts`, `prng.ts`, `generator.ts`, `validate.ts`, and `types.ts`. No React, DOM, Canvas, or browser APIs.
- Grid integration exceptions: `src/grid/useGeneratedGrid.ts` and `src/grid/clipboard.ts`.
- `src/canvas/`: Canvas rendering, hit testing, and PNG export. Keep editor and export drawing aligned through `drawDocument`.
- `src/components/`: reusable React UI, component registries, icon registries, and shared controls.
- `src/app/App.tsx`: app orchestration and state wiring only.

## Development Expectations

- Prefer clear, separated logic over large files or hidden coupling.
- Add new component types through the registry, canvas renderer, hit testing, sidebar UI, and tests.
- Add new SVG icons through `src/components/iconRegistry.ts` and `ComponentIcon`.
- Preserve the current minimal grayscale UI style and reuse shared CSS/classes before adding new ones.
- For UI changes, inspect the app in a browser when possible.

## Verification

- Source changes: run `npm run verify`.
- Docs/rules-only changes: verify frontmatter, links, paths, and stale references.
- Do not claim completion without fresh verification evidence.

## Safety

- Preserve user changes and avoid destructive git commands.
- Do not edit `.cursor/plans` unless explicitly requested.
- If repeated attempts fail, stop and explain observations plus options.
