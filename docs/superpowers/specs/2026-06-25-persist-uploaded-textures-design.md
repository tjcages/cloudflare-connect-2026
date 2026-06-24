# Persist uploaded textures in the lab — design

**Date:** 2026-06-25
**App:** `apps/lab` (lab dev tool, port 5174) + `packages/stripes-engine`
**Status:** Approved design, pending implementation plan

## Problem

When a user uploads an image/video texture in the lab, `handleFileChange`
([LabApp.tsx](../../../apps/lab/src/LabApp.tsx)) turns the file into an
`URL.createObjectURL(file)` and hands an `HTMLImageElement`/`HTMLVideoElement`
straight to `engine.setSource(...)`. The object URL and WebGL texture are
session-only, so a reload loses the upload — the user re-uploads every time.
Uploads also bypass the texture-ID / preset / per-texture-config system
entirely: they get no ID, no entry in the picker, and no saved settings.

## Goal

A **library of uploads**: each uploaded file is saved, appears in the existing
**texture list** (the Leva "Texture" dropdown) alongside the built-in presets,
remembers its own engine config, and is switchable. Uploads survive reload.
Auto-named from the filename; deletable from the texture list. (Rename is out of
scope.)

## Current architecture (what we reuse)

- The texture picker is a Leva dropdown built from the static `LAB_TEXTURES`
  array: `TEXTURE_OPTIONS = Object.fromEntries(LAB_TEXTURES.map(t => [label, id]))`
  ([levaSchema.ts:11,94](../../../apps/lab/src/controls/levaSchema.ts)).
- `textureId` is already persisted to localStorage `stripes-engine-lab-texture`
  ([persistence.ts](../../../apps/lab/src/persistence.ts)).
- Switching textures already triggers a **full page reload** so Leva re-seeds
  from the selected texture's saved config
  ([LabApp.tsx:357-364](../../../apps/lab/src/LabApp.tsx)).
- Per-texture engine config is already keyed by `textureId` in localStorage
  `stripes-engine-lab-by-texture` (`saveConfig(textureId, config)` /
  `loadInitialConfig(textureId)`).
- `loadTextureSource(preset)` resolves a preset to an `EngineSource`
  (`HTMLImageElement | HTMLVideoElement | ImageBitmap | HTMLCanvasElement`)
  ([textures.ts:38-65](../../../apps/lab/src/textures.ts)).

Consequence: if an upload has a **stable ID** and is **merged into the dropdown
options**, the reload-on-switch flow and per-texture config persistence work for
it for free. The only genuinely new piece is a blob store + a small manifest.

## Approach

Reuse the existing texture-ID + reload + per-texture-config flow; add only a
blob store. Rejected alternative: live registration of uploads without a reload
— Leva dropdown options are fixed at creation, and preset switching already
reloads, so reload-on-select stays consistent and avoids fighting Leva.

**Storage split:**

- **Manifest** (small metadata) → **localStorage** under a new key. Synchronous,
  so the dropdown is still built synchronously at hook init — no async refactor
  of Leva options.
- **Bytes** (the Blob, possibly tens of MB for video) → **IndexedDB**.
  localStorage can't hold these. Resolved async inside the already-Promise-based
  `loadTextureSource`.

## Data model

Unified texture entry (built-in presets + uploads):

```ts
interface LabTextureEntry {
  id: string;
  label: string;
  kind: "image" | "video";
  defaultScale: number;
  origin: "builtin" | "upload";
  url: string | null; // builtin only; uploads resolve bytes from IndexedDB by id
}
```

`LAB_TEXTURES` (built-in presets) become `origin: "builtin"`. The dropdown
options merge built-ins + manifest entries.

Manifest — localStorage key `stripes-engine-lab-uploads`:

```ts
type UploadManifest = {
  id: string;
  label: string; // defaults to filename
  kind: "image" | "video";
  defaultScale: number; // 1 for uploads
  createdAt: number;
}[];
```

Blob store — IndexedDB db `stripes-engine-lab`, object store `textures`:

```
key = id  →  { blob: Blob, type: string }
```

ID = `upload-${crypto.randomUUID()}`. Unique per upload; re-uploading the same
file creates a new entry (no content-hash dedup — keeps it simple).

## Flows

**Upload** (`handleFileChange` rework):

1. Generate `id`.
2. `await idb.put(id, { blob: file, type: file.type })`.
3. Append `{ id, label: file.name, kind, defaultScale: 1, createdAt }` to the
   manifest in localStorage.
4. `saveTextureId(id)`.
5. Reload. On reload the dropdown includes the new (selected) entry and the
   existing texture-load effect resolves it.

The IDB write is awaited before reload so the reload's load cannot race ahead of
the write.

**Load (startup / switch)** — `loadTextureSource` branches on `origin`:

- `builtin` → current behavior (fetch `url`).
- `upload` → `idb.get(id)` → `URL.createObjectURL(blob)` → `<img>`/`<video>` →
  return as `EngineSource`. The created object URL is tracked and revoked on the
  next switch/dispose (extends the existing `lastObjectUrlRef` cleanup). To
  support revocation, `LoadedTextureSource` carries an optional `objectUrl`.

**Delete:** A "Delete texture" button sits in the workflow-controls row next to
"Upload texture" (Leva dropdowns can't host per-row delete buttons, so deletion
acts on the **currently-selected** entry). The button is enabled only when the
selected entry is `origin: "upload"` (built-in presets are not deletable).
On click:

- Remove the manifest entry + the IDB blob + that id's per-texture config entry
  (a new `deleteConfig(id)` in persistence.ts removes the key from the
  `stripes-engine-lab-by-texture` map).
- Fall back to `DEFAULT_LAB_TEXTURE_ID` (the deleted entry was the selected one)
  and reload.

## Edge cases

- **Quota exceeded** on the IDB write → keep the live session source (don't lose
  the upload mid-session) but surface a "couldn't save this upload" notice; it
  won't survive reload.
- **Missing blob** (manifest entry present but IDB row gone) → drop the stale
  manifest entry and fall back to `DEFAULT_LAB_TEXTURE_ID`.
- **Corrupt manifest** → ignore and treat as empty (matches existing
  try/catch-and-default pattern in persistence.ts).
- Uploads default to `defaultScale: 1`; per-texture engine config still
  saves/loads by id automatically.

## Out of scope

- Inline rename of uploads (auto-name from filename + delete only).
- Content-hash dedup of identical re-uploads.
- Thumbnails / a separate uploads panel (uploads live in the existing dropdown).
- Server-side or cross-device sync.

## Files touched (anticipated)

- `apps/lab/src/textures.ts` — unified `LabTextureEntry` type, `origin`,
  upload-aware `loadTextureSource`, `objectUrl` on `LoadedTextureSource`.
- `apps/lab/src/persistence.ts` — `deleteConfig(id)`; possibly the upload
  manifest read/write helpers (or a new `uploads.ts`).
- New `apps/lab/src/textureStore.ts` (or similar) — IndexedDB blob store +
  manifest helpers.
- `apps/lab/src/controls/levaSchema.ts` — merge manifest entries into
  `TEXTURE_OPTIONS`.
- `apps/lab/src/LabApp.tsx` — rework `handleFileChange` to persist + reload; add
  a "Delete texture" button (enabled only for upload-origin selection) to the
  workflow-controls row; object-URL cleanup for upload sources.
