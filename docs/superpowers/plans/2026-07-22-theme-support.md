# Light/Dark Themed Configs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configs gain an optional `dark` key (sparse deep-partial over the light base); `StripesShader` gets a `theme` prop that resolves it live; the lab gets a Light/Dark switch with per-theme reset, themed persistence/export, and dark playground chrome.

**Architecture:** Light is the base config, unchanged. `dark` is a sparse diff resolved by new pure utilities in `packages/stripes-engine/src/config/theme.ts`. The React component resolves before `setConfig` (engine core never sees `dark`). The lab's established "replace all controls" mechanism is `stagePendingConfig()` + `window.location.reload()` (used by import/presets/reset) — the theme switch uses that same path; the `StripesShader` prop path is a live instant recolor.

**Tech Stack:** TypeScript, React, Leva (lab controls), Vitest, WebGL2 engine (untouched).

## Global Constraints

- Install deps with `pi`, run scripts with `pir` (`pir test`, `pir typecheck`, `pir lint`). Never npm/pnpm directly.
- No code comments unless stating a constraint the code can't show.
- React styles: object form only, never string styles. Prefer utilities/classes over inline style for static values.
- No `prefers-reduced-motion` handling. No animation on theme flip (instant recolor).
- Branch: `claude/theme-support` in worktree `.claude/worktrees/theme-support`. Commit after each task.
- Spec: `docs/superpowers/specs/2026-07-22-theme-support-design.md`.
- `dark` never nests another `dark`. `dark` omitted when empty everywhere (saves/exports).
- Arrays are atomic in merge and diff (whole-array replace; applies to `stripes[]`, `renderParams`, gradient stops).

---

### Task 1: Engine theme utilities (`theme.ts`)

**Files:**

- Create: `packages/stripes-engine/src/config/theme.ts`
- Create: `packages/stripes-engine/src/config/theme.test.ts`
- Modify: `packages/stripes-engine/src/index.ts` (add exports; find the existing `config` re-export block and mirror its style)

**Interfaces:**

- Produces (later tasks rely on these exact names):
  - `type ThemeName = "light" | "dark"`
  - `type DeepPartial<T>` (arrays kept whole, not element-wise partial)
  - `type ThemedEngineConfig = Partial<EngineConfig> & { dark?: DeepPartial<EngineConfig> }`
  - `resolveThemedConfig(config: ThemedEngineConfig, theme?: ThemeName): Partial<EngineConfig>`
  - `diffEngineConfig(base: EngineConfig, edited: EngineConfig): DeepPartial<EngineConfig>`
  - `sanitizeThemedConfig(input: ThemedEngineConfig): ThemedEngineConfig`

- [ ] **Step 1: Write the failing tests**

`packages/stripes-engine/src/config/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeEngineConfig } from "./normalize";
import { diffEngineConfig, resolveThemedConfig, sanitizeThemedConfig } from "./theme";
import type { ThemedEngineConfig } from "./theme";

describe("resolveThemedConfig", () => {
  it("returns the config unchanged (minus dark) for light", () => {
    const themed: ThemedEngineConfig = { stripesEnabled: false, dark: { stripesEnabled: true } };
    expect(resolveThemedConfig(themed, "light")).toEqual({ stripesEnabled: false });
    expect(resolveThemedConfig(themed)).toEqual({ stripesEnabled: false });
  });

  it("deep-merges dark over the base without touching sibling fields", () => {
    const themed: ThemedEngineConfig = {
      background: { transparent: true, color: 0xffffff, gradient: { enabled: false } } as never,
      dark: { background: { color: 0x111111 } },
    };
    const resolved = resolveThemedConfig(themed, "dark");
    expect(resolved.background).toMatchObject({ transparent: true, color: 0x111111 });
  });

  it("replaces arrays atomically", () => {
    const themed: ThemedEngineConfig = {
      renderParams: [0.1, 0.2, 0.3, 0.4],
      dark: { renderParams: [0.9, 0.9, 0.9, 0.9] },
    };
    expect(resolveThemedConfig(themed, "dark").renderParams).toEqual([0.9, 0.9, 0.9, 0.9]);
  });

  it("does not mutate its input", () => {
    const themed: ThemedEngineConfig = { background: { color: 1 } as never, dark: { background: { color: 2 } } };
    const snapshot = JSON.stringify(themed);
    resolveThemedConfig(themed, "dark");
    expect(JSON.stringify(themed)).toBe(snapshot);
  });
});

describe("diffEngineConfig", () => {
  it("returns an empty diff for identical configs", () => {
    const base = normalizeEngineConfig();
    expect(diffEngineConfig(base, normalizeEngineConfig())).toEqual({});
  });

  it("emits only changed leaves, atomically for arrays", () => {
    const base = normalizeEngineConfig();
    const edited = normalizeEngineConfig({
      ...base,
      background: { ...base.background, color: 0x123456 },
      stripes: base.stripes.map((s, i) => (i === 0 ? { ...s, color: 0xff0000 } : s)),
    });
    const diff = diffEngineConfig(base, edited);
    expect(diff).toEqual({
      background: { color: 0x123456 },
      stripes: edited.stripes,
    });
  });

  it("round-trips: merge(base, diff(base, edited)) equals edited", () => {
    const base = normalizeEngineConfig();
    const edited = normalizeEngineConfig({
      ...base,
      stripesEnabled: false,
      renderColorA: 0xabcdef,
      colors: { ...base.colors, mode: "colors" },
      reveal: { ...base.reveal, type: "water" },
    });
    const diff = diffEngineConfig(base, edited);
    const merged = resolveThemedConfig({ ...base, dark: diff }, "dark");
    expect(normalizeEngineConfig(merged)).toEqual(edited);
  });
});

describe("sanitizeThemedConfig", () => {
  it("normalizes the base and re-derives a sparse dark diff", () => {
    const input: ThemedEngineConfig = {
      stripesEnabled: false,
      dark: { renderColorA: 0x101010, junk: true } as never,
    };
    const out = sanitizeThemedConfig(input);
    expect(out.stripesEnabled).toBe(false);
    expect(out.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("drops an empty or no-op dark entirely", () => {
    expect(sanitizeThemedConfig({ dark: {} })).not.toHaveProperty("dark");
    expect(sanitizeThemedConfig({ stripesEnabled: true, dark: { stripesEnabled: true } })).not.toHaveProperty("dark");
  });
});

describe("normalizeEngineConfig with a themed input", () => {
  it("strips dark (unknown keys never reach the engine)", () => {
    const out = normalizeEngineConfig({ dark: { stripesEnabled: false } } as never);
    expect(out).not.toHaveProperty("dark");
    expect(out.stripesEnabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pir test -- packages/stripes-engine/src/config/theme.test.ts`
Expected: FAIL — module `./theme` not found.

- [ ] **Step 3: Implement `theme.ts`**

```ts
import type { EngineConfig } from "./types";
import { normalizeEngineConfig } from "./normalize";

export type ThemeName = "light" | "dark";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type ThemedEngineConfig = Partial<EngineConfig> & { dark?: DeepPartial<EngineConfig> };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    out[key] = isPlainObject(prev) && isPlainObject(value) ? deepMerge(prev, value) : value;
  }
  return out;
}

function deepDiff(base: Record<string, unknown>, edited: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(edited)) {
    const prev = base[key];
    if (isPlainObject(prev) && isPlainObject(value)) {
      const nested = deepDiff(prev, value);
      if (Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }
    if (Array.isArray(prev) && Array.isArray(value)) {
      if (JSON.stringify(prev) !== JSON.stringify(value))
        out[key] = value.map((v) => (isPlainObject(v) ? { ...v } : v));
      continue;
    }
    if (!Object.is(prev, value)) out[key] = value;
  }
  return out;
}

export function resolveThemedConfig(config: ThemedEngineConfig, theme: ThemeName = "light"): Partial<EngineConfig> {
  const { dark, ...light } = config;
  if (theme !== "dark" || !dark) return light as Partial<EngineConfig>;
  return deepMerge(light, dark as Record<string, unknown>) as Partial<EngineConfig>;
}

export function diffEngineConfig(base: EngineConfig, edited: EngineConfig): DeepPartial<EngineConfig> {
  return deepDiff(base as unknown as Record<string, unknown>, edited as unknown as Record<string, unknown>);
}

export function sanitizeThemedConfig(input: ThemedEngineConfig): ThemedEngineConfig {
  const base = normalizeEngineConfig(resolveThemedConfig(input, "light"));
  if (!input.dark) return base;
  const dark = diffEngineConfig(base, normalizeEngineConfig(resolveThemedConfig(input, "dark")));
  return Object.keys(dark).length > 0 ? { ...base, dark } : base;
}
```

Note the `deepMerge` inside `resolveThemedConfig` intentionally copies arrays by reference from whichever side wins — atomic replacement. `deepDiff` clones array elements so the diff doesn't alias live control state.

- [ ] **Step 4: Export from the package index**

In `packages/stripes-engine/src/index.ts`, next to the existing config exports add:

```ts
export { resolveThemedConfig, diffEngineConfig, sanitizeThemedConfig } from "./config/theme";
export type { ThemeName, ThemedEngineConfig, DeepPartial } from "./config/theme";
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pir test -- packages/stripes-engine/src/config/theme.test.ts` → PASS (all cases)
Run: `pir typecheck` → clean

- [ ] **Step 6: Commit**

```bash
git add packages/stripes-engine/src/config/theme.ts packages/stripes-engine/src/config/theme.test.ts packages/stripes-engine/src/index.ts
git commit -m "feat(engine): themed config utilities — resolve/diff/sanitize with atomic arrays"
```

---

### Task 2: `StripesShader` theme prop

**Files:**

- Modify: `packages/stripes-engine/src/react/StripesShader.tsx`
- Modify: `packages/stripes-engine/src/react/StripesShader.test.tsx`

**Interfaces:**

- Consumes: `resolveThemedConfig`, `ThemedEngineConfig`, `ThemeName` from `../config/theme`.
- Produces: `StripesShaderProps.config?: ThemedEngineConfig` and `StripesShaderProps.theme?: ThemeName` (default `"light"`).

- [ ] **Step 1: Write the failing tests**

Append to the `describe("<StripesShader>")` block in `StripesShader.test.tsx`:

```tsx
it("resolves the dark theme before calling setConfig", () => {
  const config = { stripesEnabled: false, renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
  render(<StripesShader src="logo.png" config={config} theme="dark" />);
  expect(engineStub.setConfig).toHaveBeenCalledWith({ stripesEnabled: false, renderColorA: 0x101010 });
});

it("strips dark for the default light theme", () => {
  const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
  render(<StripesShader src="logo.png" config={config} />);
  expect(engineStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x222222 });
});

it("recolors in place when the theme prop flips", () => {
  const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
  const { rerender } = render(<StripesShader src="logo.png" config={config} theme="light" />);
  engineStub.setConfig.mockClear();
  rerender(<StripesShader src="logo.png" config={config} theme="dark" />);
  expect(engineStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x101010 });
});

it("shared mode passes the resolved config to registerSharedShader and setConfig", async () => {
  const config = { renderColorA: 0x222222, dark: { renderColorA: 0x101010 } };
  render(<StripesShader src="logo.png" sharedContext config={config} theme="dark" />);
  await vi.waitFor(() => expect(registerSharedShader).toHaveBeenCalled());
  expect(registerSharedShader).toHaveBeenCalledWith(expect.objectContaining({ config: { renderColorA: 0x101010 } }));
  expect(sharedHandleStub.setConfig).toHaveBeenCalledWith({ renderColorA: 0x101010 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pir test -- packages/stripes-engine/src/react/StripesShader.test.tsx`
Expected: the four new tests FAIL (setConfig receives the raw themed object / `theme` prop is a type error).

- [ ] **Step 3: Implement**

In `StripesShader.tsx`:

1. Imports: drop the now-unused `EngineConfig` type import if nothing else uses it, add
   `import { resolveThemedConfig, type ThemedEngineConfig, type ThemeName } from "../config/theme";`
2. Props: change `config?: Partial<EngineConfig>` to `config?: ThemedEngineConfig` and add
   `theme?: ThemeName;` with doc comment `/** Which theme's config to render. Dark deep-merges \`config.dark\` over the base. \*/`
3. Destructure `theme = "light"` from props.
4. After the destructure, add:

```ts
const resolvedConfig = useMemo(() => (config ? resolveThemedConfig(config, theme) : undefined), [config, theme]);
```

5. Replace every use of `config` below that line with `resolvedConfig`:
   - the standalone effect (`engine.setConfig(config)` → `engine.setConfig(resolvedConfig)`, dep array `[sharedContext, config]` → `[sharedContext, resolvedConfig]`)
   - `configRef.current = config` → `configRef.current = resolvedConfig`
   - `registerSharedShader({ ..., config, ... })` → `config: resolvedConfig`
   - the shared setConfig effect (`if (handle && config) handle.setConfig(config)` → resolved, deps updated)

- [ ] **Step 4: Run tests**

Run: `pir test -- packages/stripes-engine/src/react/StripesShader.test.tsx` → PASS (existing + 4 new)
Run: `pir typecheck` → clean

- [ ] **Step 5: Commit**

```bash
git add packages/stripes-engine/src/react/StripesShader.tsx packages/stripes-engine/src/react/StripesShader.test.tsx
git commit -m "feat(react): theme prop on StripesShader resolves light/dark before setConfig"
```

---

### Task 3: Lab persistence carries the dark diff + edit-theme flag

**Files:**

- Modify: `apps/lab/src/persistence.ts`
- Modify: `apps/lab/src/persistence.test.ts`

**Interfaces:**

- Consumes: `sanitizeThemedConfig`, `ThemedEngineConfig` from `@necatikcl/stripes-engine` (Task 1).
- Produces:
  - `type LabEditTheme = "light" | "dark"`, `loadEditTheme(): LabEditTheme`, `saveEditTheme(theme: LabEditTheme): void` (localStorage key `stripes-engine-lab-theme`; `saveEditTheme` respects `persistenceWritesEnabled`; `factoryResetSettings` clears the key)
  - `loadInitialConfig`, `saveConfig`, `stagePendingConfig`, `serializeConfigFile`, `importSettingsFile`, `importConfig` all typed on `ThemedEngineConfig` and preserving `dark`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/lab/src/persistence.test.ts` (follow the file's existing setup/mocking idiom — read it first):

```ts
describe("themed configs", () => {
  it("saveConfig/loadInitialConfig round-trips the dark diff", () => {
    const themed = { ...DEFAULT_LAB_ENGINE_CONFIG, dark: { renderColorA: 0x101010 } };
    saveConfig("tex-1", themed);
    expect(loadInitialConfig("tex-1").dark).toEqual({ renderColorA: 0x101010 });
  });

  it("serializeConfigFile embeds dark inside config and importSettingsFile preserves it", () => {
    const themed = { ...DEFAULT_LAB_ENGINE_CONFIG, dark: { renderColorA: 0x101010 } };
    const text = serializeConfigFile(themed);
    const parsed = JSON.parse(text);
    expect(parsed.config.dark).toEqual({ renderColorA: 0x101010 });
    expect(importSettingsFile(text).config.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("import sanitizes dark to a valid sparse diff and drops junk keys", () => {
    const file = serializeConfigFile({
      ...DEFAULT_LAB_ENGINE_CONFIG,
      dark: { junk: 1, renderColorA: 0x101010 },
    } as never);
    expect(importSettingsFile(file).config.dark).toEqual({ renderColorA: 0x101010 });
  });

  it("legacy and light-only files import without a dark key", () => {
    const file = serializeConfigFile(DEFAULT_LAB_ENGINE_CONFIG);
    expect(importSettingsFile(file).config).not.toHaveProperty("dark");
  });

  it("edit theme persists and defaults to light", () => {
    expect(loadEditTheme()).toBe("light");
    saveEditTheme("dark");
    expect(loadEditTheme()).toBe("dark");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pir test -- apps/lab/src/persistence.test.ts`
Expected: new tests FAIL (missing exports / dark stripped on import).

- [ ] **Step 3: Implement in `persistence.ts`**

1. Import: `import { migrateLegacyConfig, sanitizeThemedConfig } from "@necatikcl/stripes-engine";` and `import type { EngineConfig, ThemedEngineConfig } from "@necatikcl/stripes-engine";` (drop the now-unused `parseEngineConfig`).
2. Retype the themed carriers: `loadConfigMap` → `Record<string, ThemedEngineConfig>`, `loadLastConfig`/`saveLastConfig`/`readPendingConfig`/`stagePendingConfig`/`loadInitialConfig` → `ThemedEngineConfig`, `saveConfig(textureId: string, c: ThemedEngineConfig)`, `ConfigFile.config: ThemedEngineConfig`, `serializeConfigFile(c: ThemedEngineConfig, lab?)`.
3. Edit-theme flag, next to the other keys/helpers:

```ts
const EDIT_THEME_KEY = "stripes-engine-lab-theme";

export type LabEditTheme = "light" | "dark";

export function loadEditTheme(): LabEditTheme {
  try {
    return localStorage.getItem(EDIT_THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function saveEditTheme(theme: LabEditTheme): void {
  if (!persistenceWritesEnabled) return;
  try {
    localStorage.setItem(EDIT_THEME_KEY, theme);
  } catch {
    /* ignore quota errors */
  }
}
```

Add `localStorage.removeItem(EDIT_THEME_KEY);` inside `factoryResetSettings()`. 4. Rewrite `importSettingsFile` to sanitize instead of parse-strip:

```ts
export function importSettingsFile(text: string): { config: ThemedEngineConfig; lab: LabSettings | null } {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const configLike = isConfigFile(parsed) ? (parsed.config as Record<string, unknown>) : parsed;
  const looksLegacy =
    "textureAdjustments" in configLike || "sourceTransform" in configLike || "textureLuminanceMode" in configLike;
  const config = sanitizeThemedConfig(
    looksLegacy ? migrateLegacyConfig(configLike) : (configLike as ThemedEngineConfig),
  );
  return {
    config,
    lab: isConfigFile(parsed) && parsed.lab ? normalizeLabSettings(parsed.lab) : null,
  };
}
```

`sanitizeThemedConfig` normalizes the base exactly like `parseEngineConfig` did, so legacy behavior is preserved; `importConfig` needs only the return-type change.

- [ ] **Step 4: Run tests**

Run: `pir test -- apps/lab/src/persistence.test.ts` → PASS (existing + new)
Run: `pir typecheck` → expect NEW errors in `LabApp.tsx`/`levaSchema.ts` only if signatures leak; if so they are fixed in Tasks 4–5 — the persistence file itself must be clean. If typecheck cannot pass tree-wide yet, run `pir test` (all suites) and defer typecheck to Task 5's gate.

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/persistence.ts apps/lab/src/persistence.test.ts
git commit -m "feat(lab): persistence carries themed configs and the edit-theme flag"
```

---

### Task 4: Leva init resolves the active theme

**Files:**

- Modify: `apps/lab/src/controls/levaSchema.ts` (init block ~lines 386–401, result type ~line 329, return ~line 2604)

**Interfaces:**

- Consumes: `loadEditTheme`, `LabEditTheme` from `../persistence`; `resolveThemedConfig`, `DeepPartial`, `EngineConfig` from `@necatikcl/stripes-engine`.
- Produces on `EngineControlsResult`:

```ts
initialThemed: {
  editTheme: LabEditTheme;
  lightBase: Partial<EngineConfig>;
  darkDiff: DeepPartial<EngineConfig>;
}
```

- [ ] **Step 1: Implement**

In `useEngineControls`, replace the `d` memo's first line. Current:

```ts
const d = useMemo(() => {
  const loaded = normalizeEngineConfig(loadInitialConfig(initialTextureId));
```

New (single `loadInitialConfig` call — it consumes the session-staged pending config, so it must not be called twice):

```ts
const initialThemed = useMemo(() => {
  const themed = loadInitialConfig(initialTextureId);
  const editTheme = loadEditTheme();
  return {
    editTheme,
    lightBase: resolveThemedConfig(themed, "light"),
    darkDiff: (themed.dark ?? {}) as DeepPartial<EngineConfig>,
    effective: resolveThemedConfig(themed, editTheme),
  };
}, [initialTextureId]);
const d = useMemo(() => {
  const loaded = normalizeEngineConfig(initialThemed.effective);
```

with the `d` memo dep array becoming `[initialThemed]`. Everything downstream of `loaded` stays untouched. Add `initialThemed` to the `EngineControlsResult` type (typed as above, without `effective`) and to the returned object.

- [ ] **Step 2: Verify**

Run: `pir test` → all suites PASS (no behavior change for light-only stores: `dark` absent → `effective === lightBase`).
Run: `pir typecheck` → clean for this file (LabApp errors, if any, belong to Task 5).

- [ ] **Step 3: Commit**

```bash
git add apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): leva controls initialize from the active theme's effective config"
```

---

### Task 5: LabApp wiring — compose, switch, reset, UI

**Files:**

- Modify: `apps/lab/src/LabApp.tsx`
- Modify: `apps/lab/src/presets.ts` (if its `config` field is typed `Partial<EngineConfig>`, widen to `ThemedEngineConfig`)
- Modify: `apps/lab/src/playground.css` (switch styles)
- Modify: `apps/lab/src/main.tsx` (apply `data-theme` before render)

**Interfaces:**

- Consumes: `initialThemed` (Task 4); `diffEngineConfig`, `resolveThemedConfig`, `normalizeEngineConfig`, `ThemedEngineConfig`, `DeepPartial` from `@necatikcl/stripes-engine`; `loadEditTheme`, `saveEditTheme`, `LabEditTheme` (Task 3).
- Produces: `LabBottomBar` props gain `editTheme: LabEditTheme; onSelectTheme: (t: LabEditTheme) => void; onResetTheme: (t: LabEditTheme) => void`.

- [ ] **Step 1: Themed composition state in `LabInner`**

After the `useEngineControls` destructure (~line 871), add `initialThemed` to the destructure and:

```ts
const editTheme = initialThemed.editTheme;
const lightBaseRef = useRef<Partial<EngineConfig>>(initialThemed.lightBase);
const darkDiffRef = useRef<DeepPartial<EngineConfig>>(initialThemed.darkDiff);

const composeThemedConfig = useCallback((): ThemedEngineConfig => {
  const current = controlsRef.current;
  if (editTheme === "dark") {
    const base = normalizeEngineConfig(lightBaseRef.current);
    const dark = diffEngineConfig(base, current);
    darkDiffRef.current = dark;
    return Object.keys(dark).length > 0 ? { ...base, dark } : { ...base };
  }
  lightBaseRef.current = current;
  const dark = darkDiffRef.current;
  return Object.keys(dark).length > 0 ? { ...current, dark } : { ...current };
}, [editTheme]);
const composeThemedConfigRef = useRef(composeThemedConfig);
composeThemedConfigRef.current = composeThemedConfig;
```

- [ ] **Step 2: Route every persistence/export path through the themed composer**

- Save effect (~1609): replace body with

```ts
useEffect(() => {
  const id = textureIdRef.current;
  const themed = composeThemedConfig();
  const key = `${id}:${JSON.stringify(themed)}`;
  if (lastSavedConfigJsonRef.current === key) return;
  lastSavedConfigJsonRef.current = key;
  saveConfig(id, themed);
}, [controls, composeThemedConfig]);
```

- `handleExport` / `handleDownloadConfig`: `serializeConfigFile(composeThemedConfig(), fullLabSettingsSnapshot())`.
- `handleSavePreset`: `createPreset(name, composeThemedConfig(), fullLabSettingsSnapshot())`.
- `handleApplyPreset`: `stagePendingConfig(sanitizeThemedConfig(preset.config))` (import `sanitizeThemedConfig`; replaces `normalizeEngineConfig(preset.config)` which would strip `dark`).
- Upload `handleFileChange` (~1967): `stagePendingConfig(composeThemedConfigRef.current())`.
- `handleResetSettings` stays on `DEFAULT_LAB_ENGINE_CONFIG` (no dark) — unchanged.

- [ ] **Step 3: Switch + reset handlers**

```ts
function handleSelectTheme(next: LabEditTheme) {
  if (next === editTheme) return;
  const themed = composeThemedConfig();
  saveConfig(textureIdRef.current, themed);
  saveEditTheme(next);
  stagePendingConfig(themed);
  window.location.reload();
}

function handleResetTheme(target: LabEditTheme) {
  const id = textureIdRef.current;
  if (target === "dark") {
    darkDiffRef.current = {};
    const light = editTheme === "light" ? { ...controlsRef.current } : normalizeEngineConfig(lightBaseRef.current);
    lightBaseRef.current = light;
    saveConfig(id, light);
    lastSavedConfigJsonRef.current = `${id}:${JSON.stringify(light)}`;
    if (editTheme === "dark") {
      stagePendingConfig(light);
      window.location.reload();
    }
    return;
  }
  const merged = normalizeEngineConfig(resolveThemedConfig(composeThemedConfig(), "dark"));
  lightBaseRef.current = merged;
  darkDiffRef.current = {};
  saveConfig(id, merged);
  lastSavedConfigJsonRef.current = `${id}:${JSON.stringify(merged)}`;
  if (editTheme === "light") {
    stagePendingConfig(merged);
    window.location.reload();
  }
}
```

Semantics recap (from spec): reset-dark clears the diff; reset-light adopts dark's effective config as the new light and clears the diff. Reloads only when the currently-edited theme's control values must change.

- [ ] **Step 4: Bottom-bar switch UI**

`LabBottomBar` (~line 613) gains the three props and renders the switch in the left grid slot (replace the first `<div aria-hidden />` at ~line 647):

```tsx
<div className="lab-theme-switch" role="group" aria-label="Config theme">
  {(["light", "dark"] as const).map((t) => (
    <div key={t} className={`lab-theme-option${editTheme === t ? " is-active" : ""}`}>
      <button type="button" className="lab-theme-btn" onClick={() => onSelectTheme(t)}>
        {t === "light" ? "Light" : "Dark"}
      </button>
      <button
        type="button"
        className="lab-theme-reset"
        aria-label={t === "light" ? "Reset light to dark's config" : "Reset dark to light's config"}
        title={t === "light" ? "Reset light to dark's config" : "Reset dark to light's config"}
        onClick={() => onResetTheme(t)}
      >
        <RotateCcw size={11} />
      </button>
    </div>
  ))}
</div>
```

Add `RotateCcw` to the existing `lucide-react` import. Render site (~line 2459): `<LabBottomBar videoEl={videoEl} editTheme={editTheme} onSelectTheme={handleSelectTheme} onResetTheme={handleResetTheme} />`.

Styles in `playground.css` near `.lab-bottom-grid` (~1660), tokens only:

```css
.lab-theme-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-self: start;
}

.lab-theme-option {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 6px;
  padding: 2px;
}

.lab-theme-option.is-active {
  background: var(--color-builder-selected-row);
}

.lab-theme-btn,
.lab-theme-reset {
  border: none;
  background: transparent;
  color: var(--color-builder-muted);
  font: inherit;
  font-size: 11px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.lab-theme-option.is-active .lab-theme-btn {
  color: var(--color-builder-text);
}

.lab-theme-btn:hover,
.lab-theme-reset:hover {
  background: var(--color-builder-hover-surface);
  color: var(--color-builder-text);
}
```

- [ ] **Step 5: Apply `data-theme` at boot**

In `apps/lab/src/main.tsx`, before the React render call:

```ts
import { loadEditTheme } from "./persistence";

document.documentElement.dataset.theme = loadEditTheme();
```

(The switch always reloads, so boot-time application is the only place needed.)

- [ ] **Step 6: Verify**

Run: `pir test` → all suites PASS.
Run: `pir typecheck` → clean tree-wide (this task closes any Task 3/4 signature fallout).
Run: `pir lint` → clean.

- [ ] **Step 7: Commit**

```bash
git add apps/lab/src/LabApp.tsx apps/lab/src/presets.ts apps/lab/src/playground.css apps/lab/src/main.tsx
git commit -m "feat(lab): light/dark theme switch with per-theme reset and themed persistence"
```

---

### Task 6: Dark playground chrome

**Files:**

- Modify: `apps/lab/src/playground.css`
- Modify: `apps/lab/src/index.css`

**Interfaces:** none (pure CSS; relies on `data-theme` from Task 5).

- [ ] **Step 1: Tokenize the strays**

`playground.css` has ~30 hardcoded hex colors outside the `:root` token block (lines ≈124, 180, 420–440, 487, 1035–1269, 1448–1699 — grep `#[0-9a-fA-F]` to enumerate). Replace each with the nearest existing `--color-builder-*` / `--leva-*` token; where none fits, add a new descriptive token to BOTH light sets:

- `--color-builder-danger-surface: #fff0f0` / `--color-builder-danger-text: #9c1c1c` (for the ~439 error chip and the ~1063 red)
- `--color-builder-input-border: #d6d6d6` (the repeated `#d6d6d6` borders)
- `--color-builder-page: #fafafa` — and in `index.css` change `body { background: #fafafa }` to `background: var(--color-builder-page, #fafafa);`
- `#fff`/`#ffffff` surfaces → `--color-builder-surface`; `#eeeeee`/`#ededed`/`#e5e5e5`/`#e6e6e6` chips → `--leva-surface` / `--leva-surface-hover` inside `.playground-leva-panel` scopes, `--color-builder-active-surface` outside; grays `#525252`/`#3f3f3f` text → `--leva-text` in panel scopes, `--color-builder-text` outside.

No visual change yet: after this step the light lab must render pixel-identical. Verify by eye in the browser (Task 7 covers the full pass, but do a quick sanity load here).

- [ ] **Step 2: Add the dark token sets**

At the end of the `:root` block section of `playground.css`:

```css
:root[data-theme="dark"] {
  --color-builder-text: #ededed;
  --color-builder-muted: #9a9a9a;
  --color-builder-subtle: #5b5b5b;
  --color-builder-faint-label: #6f6f6f;
  --color-builder-fainter: #4a4a4a;

  --color-builder-hairline: #262626;
  --color-builder-surface: #1c1c1c;
  --color-builder-hover-row: #202020;
  --color-builder-selected-row: #2a2a2a;
  --color-builder-selected-row-hover: #2f2f2f;

  --color-builder-control: #7a7a7a;
  --color-builder-hover-surface: #232323;
  --color-builder-active-surface: #272727;

  --color-builder-rail: #565656;
  --color-builder-rail-hover: #787878;

  --color-builder-thumb-track: #3a3a3a;
  --color-builder-range-thumb: #4a4a4a;
  --color-builder-toggle-knob-off: #333333;
  --color-builder-toggle-knob-on: #d0d0d0;

  --color-builder-accent-border: #35547d;
  --color-builder-accent-fill: #1c2a3d;
  --color-builder-focus-ring: #35547d;

  --color-builder-spinner-muted: #2a2a2a;
  --color-builder-spinner-stroke: #6a6a6a;

  --color-builder-danger-surface: #3a1d1d;
  --color-builder-danger-text: #ff9d9d;
  --color-builder-input-border: #3a3a3a;
  --color-builder-page: #141414;
}

:root[data-theme="dark"] .playground-leva-panel {
  --leva-panel-bg: #1c1c1c;
  --leva-surface: #2a2a2a;
  --leva-surface-hover: #313131;
  --leva-border: #262626;
  --leva-border-subtle: #262626;
  --leva-text: #d4d4d4;
  --leva-text-muted: #a3a3a3;
  --leva-text-faint: #6f6f6f;
  --leva-accent: #a3a3a3;
  --leva-checkbox-border: #4a4a4a;
}
```

These values are starting points — the visual pass in Task 7 tunes anything that reads wrong (contrast, hierarchy inversions).

- [ ] **Step 3: Verify + commit**

Run: `pir test` → PASS. Load the lab in both themes (Task 7 does the thorough pass).

```bash
git add apps/lab/src/playground.css apps/lab/src/index.css
git commit -m "feat(lab): dark playground chrome via data-theme token sets"
```

---

### Task 7: End-to-end visual verification

**Files:** none (verification; small fix commits allowed).

- [ ] **Step 1: Start the dev server in the worktree**

`pir dev` in background Bash from the worktree root. Note the port Vite prints (concurrent sessions squat 5174+ — identity-check by fetching `/src/LabApp.tsx` and confirming it contains `lab-theme-switch` before trusting the port; never kill a squatter).

- [ ] **Step 2: Browser pass (`agent-browser open --local <url>` — standing approval for lab visuals)**

Verify, screenshotting each state:

1. Lab boots in light, identical to pre-change (chrome + canvas), switch visible below the canvas in the bottom bar.
2. Click Dark → page reloads into dark chrome; canvas identical to light (empty diff).
3. In dark, change a visible control (e.g. a stripe color or `renderColorA`) → canvas updates.
4. Copy config → JSON contains top-level light fields plus a sparse `dark` with ONLY the edited field.
5. Switch to Light → light values intact (edit didn't leak); switch back to Dark → dark edit intact.
6. Edit a DIFFERENT field in light → switch to dark → that field's new value shows through (untracked fields follow light).
7. Reset icon on Dark → diff cleared, dark renders as light, exported JSON has no `dark`.
8. Re-make a dark edit, then Reset icon on Light → light becomes the dark look, no `dark` in export.
9. Import of the step-4 JSON restores both themes.
10. Reload in dark → boots dark with no light-chrome flash.

- [ ] **Step 3: Full gates**

Run: `pir verify` (tests + typecheck + build) → clean.

- [ ] **Step 4: Report with screenshots; do not push or offer to push.**

---

## Known accepted edge

While editing dark, the legacy config upgrades applied at Leva init (`upgradeDefaultStripes`, stretch→width fit migration) act on the _effective_ config, so for a legacy-era saved config their delta could be captured into the dark diff instead of the light base. Configs saved by the current lab are already upgraded, so this only touches ancient stores; behavior degrades to "slightly larger diff", never wrong rendering. Not worth plumbing.
