# Deploy — `connect-shader` Worker

**Single production target for all deploys** (local `pir deploy`, Workers Builds, branch promotes):

|                |                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker         | `connect-shader`                                                                                                                                      |
| Account        | `944ca70087298faa2e84783db46162c5`                                                                                                                    |
| Dashboard      | [Workers → connect-shader → production](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) |
| Live URL       | https://connect-shader.off-brand.workers.dev/                                                                                                         |
| Client preview | https://connect-shader.off-brand.workers.dev/ (or `/client.html`)                                                                                     |
| Full lab       | https://connect-shader.off-brand.workers.dev/lab.html                                                                                                 |

## Important: what “live” means

- **Production** (`https://connect-shader.off-brand.workers.dev/`) only updates after Workers Builds / `wrangler deploy` runs against `main`.
- **PR / cloud-agent branches do not change production** until merged to `main`.
- Hand off **Workers preview URLs** for PR review — never trycloudflare / session tunnels.

## Config

- Root: `wrangler.jsonc` → assets `apps/lab/dist`, name `connect-shader`
- Lab: `apps/lab/wrangler.jsonc` → assets `./dist`, name `connect-shader`
- Both must keep the same `name` + `account_id`. Do **not** rename the Worker or point deploys at another service.
- `workers_dev: true` and `preview_urls: true` (required for versioned + branch preview hosts).

## Commands

```bash
# From repo root (preferred) — requires `wrangler login` / API token
pir build && pir deploy
# or
pnpm run deploy

# Upload a version + aliased preview (does NOT promote production)
pnpm run preview:upload
```

Workers Builds (`WORKERS_CI=1`) runs `postinstall` → `pnpm run build`, then:

- **Production branch (`main`):** `wrangler deploy`
- **Non-production branches / PRs:** `wrangler versions upload` (preview only)

## PR preview URLs (automatic)

Cloudflare posts these on the PR when **Builds for non-production branches** is enabled:

| Kind   | Format                                                           |
| ------ | ---------------------------------------------------------------- |
| Branch | `https://<branch-slug>-connect-shader.off-brand.workers.dev/`    |
| Commit | `https://<version-prefix>-connect-shader.off-brand.workers.dev/` |

Branch slug = git branch with `/` → `-`, lowercased (e.g. `cursor/cf-17-…` → `cursor-cf-17-…`).

### Dashboard checklist (one-time)

1. [connect-shader → Settings → Domains & Routes](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production) → **Preview URLs = Enable**
2. Settings → **Build** → Branch control → check **Builds for non-production branches**
3. Non-production deploy command: `npx wrangler versions upload` (default)
4. Push to the PR branch → wait for the Cloudflare PR comment with both URLs

If the GitHub check `cloudflare-workers-and-pages` stays **queued** with **0 runs**, non-production branch builds are off — flip step 2.

Dashboard deployments: https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production/deployments
