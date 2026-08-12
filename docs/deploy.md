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
2. Settings → **Build** → Branch control → check **Builds for non-production branches** (must be an explicit checkbox — configuring “Version command” alone is not enough)
3. **Build command:** `pnpm install` (postinstall builds assets when `WORKERS_CI=1`) or `pnpm run build`
4. **Deploy command (`main`):** `npx wrangler deploy`
5. **Version / non-prod command:** `npx wrangler versions upload`
6. Push to a PR branch → GitHub check `cloudflare-workers-and-pages` must leave **queued** and show a real check run → Cloudflare comments both preview URLs on the PR

If every non-`main` commit stays **queued / 0 runs** forever, non-prod builds are not actually firing — re-toggle the Branch control checkbox, confirm no stuck build is holding the free-plan concurrent slot (limit 1), and check [Build history](https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production).

Fallback: repo secret `CLOUDFLARE_API_TOKEN` + `.github/workflows/workers-preview.yml` (`pnpm run preview:upload`).

Dashboard deployments: https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production/deployments
