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

- **Production** (`connect-shader.off-brand.workers.dev`) only updates after Workers Builds / `wrangler deploy` runs against the branch Cloudflare has configured (usually `main`).
- **PR / cloud-agent branches do not change production** until merged (or until someone with Wrangler auth deploys that branch).
- If you open production and don’t see Default/Advanced or the orange-wave Twizzler, you’re on the previous ship — use the PR staging tunnel or wait for deploy.

## Config

- Root: `wrangler.jsonc` → assets `apps/lab/dist`, name `connect-shader`
- Lab: `apps/lab/wrangler.jsonc` → assets `./dist`, name `connect-shader`
- Both must keep the same `name` + `account_id`. Do **not** rename the Worker or point deploys at another service.

## Commands

```bash
# From repo root (preferred) — requires `wrangler login` / API token
pir build && pir deploy
# or
pnpm run deploy
```

Workers Builds (`WORKERS_CI=1`) runs `postinstall` → `pnpm run build`, then `wrangler deploy` against this Worker.

## Preview policy

- Prefer Workers preview versions / dashboard for `connect-shader` for anything shared with the team or clients.
- Session tunnels are OK for agent smoke checks only until production is updated.
