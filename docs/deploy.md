# Deploy — Connect 2026 Workers

This monorepo owns two independent Cloudflare Workers in account
`944ca70087298faa2e84783db46162c5`.

| App          | Workspace   | Worker              | Production URL                                           |
| ------------ | ----------- | ------------------- | -------------------------------------------------------- |
| Refresh site | `apps/site` | `connect-2026-site` | https://connect-2026-site.off-brand.workers.dev/connect/ |
| Shader tool  | `apps/lab`  | `connect-shader`    | https://connect-shader.off-brand.workers.dev/            |

## Commands

Use the repository aliases (`pi` and `pir`) rather than calling package managers directly.

```bash
pir dev:site
pir dev:shader
pir build:all
pir deploy:site
pir deploy:shader
```

`pir deploy` remains an alias for `deploy:shader` so the existing shader integration
does not unexpectedly change targets.

## Configuration ownership

- `apps/site/wrangler.jsonc` is the only deploy config for `connect-2026-site`.
- `apps/lab/wrangler.jsonc` is the app-level deploy config for `connect-shader`.
- Root `wrangler.jsonc` remains a compatibility config for the existing shader
  Workers Builds integration.

Never point either config at the other Worker name.

## Pull-request previews

The fallback GitHub workflow uploads version previews for both Workers without
promoting production:

| App          | Preview URL                                                        |
| ------------ | ------------------------------------------------------------------ |
| Refresh site | `https://<alias>-connect-2026-site.off-brand.workers.dev/connect/` |
| Shader tool  | `https://<alias>-connect-shader.off-brand.workers.dev/`            |

The workflow requires the repository secret `CLOUDFLARE_API_TOKEN`. Both Workers
must have preview URLs enabled.

For Cloudflare Workers Builds, connect this GitHub repository to each Worker and
use these settings:

### `connect-shader`

- Build command: `pnpm install` (the existing `WORKERS_CI=1` hook builds the shader)
- Production deploy command: `pnpm --filter lab exec wrangler deploy`
- Non-production command: `pnpm --filter lab exec wrangler versions upload`

### `connect-2026-site`

- Build environment variable: `WORKERS_BUILD_APP=site`
- Build command: `pnpm install`
- Production deploy command: `pnpm --filter @cloudflare-connect/site exec wrangler deploy`
- Non-production command: `pnpm --filter @cloudflare-connect/site exec wrangler versions upload`

Enable **Builds for non-production branches** for both Workers. Production only
changes from `main` or an explicit production deploy.
