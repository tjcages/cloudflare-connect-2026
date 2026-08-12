# CF-16 Twizzler — iterative exploration

**Process:** farm a wide board → you pick codes you like → next round farms around those winners → repeat until you declare a single winner.

**CF-16 stays In Progress until you say a winner.**

## Current board: Round 2

See `EXPLORE-R2.md`. Stills under `/opt/cursor/artifacts/r2-*.png`.

- Anchors: **A0** = ZA×BB · **B0** = ZB×BB
- Reply with any codes (e.g. `A7 B2 B9 X3`)

## How to farm locally

```bash
node scripts/farm-twizzler-explore-r2.mjs
# → /opt/cursor/artifacts/explore-r2/ + copies at /opt/cursor/artifacts/r2-*
```
