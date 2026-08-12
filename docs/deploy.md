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
- If you open production and don’t see Default/Advanced or the orange-wave Twizzler, wait for the latest Workers Build on `main` (dashboard deployments link above) — do not use session tunnels for handoff.

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

- Prefer the production Worker URL / dashboard versions for `connect-shader` for anything shared with the team or clients.
- Session tunnels are agent-only smoke checks and are not a substitute for the Worker.
- Dashboard deployments: https://dash.cloudflare.com/944ca70087298faa2e84783db46162c5/workers/services/view/connect-shader/production/deployments
