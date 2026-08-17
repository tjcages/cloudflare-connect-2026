# marketing

Marketing site built with [Astro 7](https://docs.astro.build) + React islands, deployed to Cloudflare Workers.

## Getting started

```bash
pnpm install
pnpm dev      # dev server on http://localhost:4321 (plain Vite dev, not workerd)
```

`pnpm install` needs a `NODE_AUTH_TOKEN` env var (a GitHub token with `read:packages`) to pull the private `@necatikcl/stripes-engine` package. After cloning, also run `pnpm typecheck` (or just `pnpm dev`) once to generate the icon declaration files and the product icon animations.

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server (plain Vite) at localhost:4321 |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Build + preview on workerd |
| `pnpm deploy` | Build + `wrangler deploy` (manual fallback; pushes to `main` auto-deploy via Workers Builds) |
| `pnpm typecheck` | Regenerate icon types + product icon animations, then `wrangler types` + `astro check` |
| `pnpm lint` / `pnpm lint:fix` | ESLint (flat config in `eslint.config.mjs`) |
| `pnpm fmt` / `pnpm fmt:check` | Prettier format / check |
| `pnpm check` / `pnpm fix` | Prettier + ESLint combined (check / write+fix) |
| `pnpm test` | `vitest run` (covers `dev/**` and `src/**`) |
| `NAME=Foo pnpm cc` / `pnpm cct` | Scaffold React component (without/with css) |
| `NAME=Foo pnpm cca` | Scaffold Astro component |
| `pnpm compress:videos` | Compress raw video assets from `public/raw-assets` |

## Structure

```
src/
  pages/        Astro routes (static/prerendered by default; opt into on-demand rendering per route)
  layouts/      Layout.astro (fonts, meta, global css)
  components/   React islands (pixi, animated-size) + Astro components
  styles/       Tailwind v4 design tokens (globals.css + partials)
  utils/        Shared utilities
dev/            Scaffolding + asset compression CLIs, Vite plugins (icons, lottie-svg), the dev-routes Astro integration
public/         Static assets
```

## Deployment

This app is the `apps/site` workspace in the Cloudflare Connect 2026 monorepo.
Pushes to `main` deploy through Cloudflare Workers Builds; other branches receive
preview versions. Worker name: `connect-2026-site`.

Pre-merge checks (`pnpm run check`, `test`, `typecheck`, `build`) run locally. Installing `@necatikcl` scope packages requires a `NODE_AUTH_TOKEN` — a GitHub token with `read:packages` for the registry configured in `.npmrc`. Deploys are owned by Cloudflare Workers Builds.
