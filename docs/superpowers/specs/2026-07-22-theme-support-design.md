# Light/dark themed configs — design

Approved 2026-07-22.

## Summary

Configs gain optional dark-theme support. Light is the base: a config object is
exactly what it is today, plus an optional `dark` key holding a sparse deep-partial
of only the fields that differ from light. `StripesShader` gains a
`theme?: "light" | "dark"` prop (default `"light"`) that resolves the effective
config before it reaches the engine. The lab gets a Light/Dark switch (with
per-theme reset), persistence/export of the diff, and dark playground chrome.

## Config shape

```jsonc
{
  // ...every existing EngineConfig field = the light theme, unchanged
  "dark": {
    // sparse deep-partial of EngineConfig — only fields that differ from light
  },
}
```

- Old configs (no `dark`) are valid and render identically.
- `dark` never nests another `dark`.
- `dark` is omitted entirely when empty (exports stay byte-identical for
  light-only configs).

## Engine package (`packages/stripes-engine`)

New pure utilities in `src/config/` (new file, e.g. `theme.ts`):

- `resolveThemedConfig(config, theme)` — returns the effective
  `Partial<EngineConfig>`: for `"light"`, the config with `dark` stripped; for
  `"dark"`, `dark` deep-merged over the base (then stripped). Deep merge is
  plain-object recursion; **arrays are atomic** (whole-array replace, never
  per-index merge) — applies to `stripes[]`, gradient stops, letters, etc.
- `diffEngineConfig(base, edited)` — sparse deep diff with the same atomic-array
  rule. Round-trip invariant (tested):
  `merge(base, diffEngineConfig(base, edited))` deep-equals `edited`.

Type: the themed shape is `Partial<EngineConfig> & { dark?: DeepPartial<EngineConfig> }`
(exported, e.g. `ThemedEngineConfig`). `EngineConfig` itself is unchanged; the
engine core never sees `dark`.

- `normalizeEngineConfig` ignores/strips a `dark` key if handed one (defensive).
- `StripesShader` (both standalone and shared paths): new `theme` prop; the
  config effect resolves via `resolveThemedConfig(config, theme)` before
  `setConfig`. The merge MUST happen here because `engine.setConfig` is a
  shallow spread — a sparse partial would clobber sub-objects.
- Theme flip is an **instant recolor**: just a `setConfig` with the merged
  config. No reveal replay, no transition.

## Lab (`apps/lab`)

### State model

- The Leva controls remain the single live config; a `theme` mode
  (`"light" | "dark"`) and the light snapshot + dark diff live beside it.
- **Light mode** (default): controls ARE the light config, exactly as today.
  Dark diff is carried along untouched.
- **Switch light → dark:** snapshot current controls as the light config, bulk-set
  controls to `merge(light, dark)` (reuse the existing import/preset machinery
  that already bulk-replaces controls).
- **In dark mode:** on every controls change, recompute
  `dark = diffEngineConfig(light, controls)`. Untouched fields therefore keep
  tracking light automatically.
- **Switch dark → light:** bulk-set controls back to the light snapshot.
- Engine always receives the current controls (already-merged), so rendering
  needs no other change.

### Switch UI

- A Light | Dark segmented switch **below the canvas**.
- A small reset icon beside each segment:
  - **Reset on dark** → clear the diff (`dark = {}`); if currently in dark mode,
    also reset controls to the light config.
  - **Reset on light** → light := current effective dark (`merge(light, dark)`),
    then clear the diff; if currently in light mode, bulk-set controls to the
    new light config.
- No confirmation dialogs.

### Persistence & export

- The `dark` diff rides inside the config object, so the per-texture map,
  last-config, pending-config, and the JSON export/import
  (`persistence.ts` `ConfigFile`) all carry it with no format fork.
- `dark` is stripped from what the engine receives and omitted from
  saves/exports when empty.
- Import of old files → light-only, no `dark`.
- SVG/video export and the canvas-stack background CSS use the **effective**
  config for the currently selected theme.

### Playground chrome

- Dark switch sets `data-theme="dark"` on the document root.
- `index.css` and `playground.css` gain a `[data-theme="dark"]` token set for
  the existing `--color-builder-*` and `--leva-*` variables (values chosen for
  a sensible dark chrome). Everything is already variable-driven — no
  per-component styling work. No `prefers-color-scheme` media queries.

## Testing

- Unit: `resolveThemedConfig` (strip, merge, atomic arrays, missing `dark`),
  `diffEngineConfig` (sparse output, atomic arrays, empty diff, round-trip
  invariant), `normalizeEngineConfig` strips `dark`.
- Lab: persistence round-trip with `dark` present/absent; import of legacy
  files; reset semantics (both directions) as pure state-transition tests
  where feasible.
- Visual: verify in the running lab (theme switch recolors instantly, chrome
  flips, reset icons behave, export JSON contains sparse `dark`).

## Out of scope

- No auto-generated dark palettes — dark starts identical to light until the
  designer edits it.
- No reveal replay or animated transition on theme change.
- No `prefers-color-scheme` auto-detection (prop/switch driven only).
