# Persist Uploaded Textures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make textures uploaded in the lab persist across reloads as a library of entries in the existing texture picker, each remembering its own engine config, with delete.

**Architecture:** An upload becomes a first-class texture entry with a stable ID, so it rides the lab's existing texture-ID → reload → per-texture-config flow. Bytes live in IndexedDB (handles large video); a small metadata manifest lives in localStorage (synchronous, so the Leva dropdown is still built without async). Switching to / deleting an upload reloads the page, exactly like preset-switching already does.

**Tech Stack:** React 19, Leva (controls), IndexedDB (zero-dep wrapper), localStorage, `@necatikcl/stripes-engine`, Vitest 4 (node env) for unit tests, Playwright for e2e. `fake-indexeddb` (new devDep) backs the store unit test.

## Global Constraints

- Package manager: `pi` (install), `pir` (run scripts). Never `npm`/`pnpm`/`npx` directly. Add devDep with `pi add -D <name>` in the package dir.
- No code comments unless explicitly requested.
- Frontend styling: object styles only (`style={{ ... }}`), Tailwind utilities over inline style for static values, `utility-(--var)` shorthand. No string styles.
- Do NOT add `prefers-reduced-motion` handling.
- Engine runtime is WebGL2 only — not touched here, but don't regress source-upload behavior.
- Lab dev server is the user's, on **http://localhost:5174**. Never spawn a competing dev server. The Playwright config reuses an existing server.
- New runtime dependencies: none. `fake-indexeddb` is **devDependencies only**.
- Texture entry IDs for uploads: `upload-${crypto.randomUUID()}`.

## File Structure

**New files**

- `apps/lab/src/uploads.ts` — upload manifest: `UploadEntry` type, pure transforms (`addUpload`, `removeUpload`), localStorage I/O (`loadManifest`, `saveManifest`).
- `apps/lab/src/uploads.test.ts` — unit tests for the pure transforms.
- `apps/lab/src/textureStore.ts` — zero-dep IndexedDB blob store (`putTextureBlob`, `getTextureBlob`, `deleteTextureBlob`).
- `apps/lab/src/textureStore.test.ts` — unit tests (backed by `fake-indexeddb/auto`).
- `apps/lab/src/textures.test.ts` — unit tests for `buildTextureEntries` / `findTextureEntry`.
- `tests/uploaded-textures.spec.ts` — Playwright e2e: upload → reload → persist → delete.

**Modified files**

- `apps/lab/src/textures.ts` — rename `LabTexturePreset` → `LabTextureEntry`, add `origin`, add pure `buildTextureEntries`/`findTextureEntry`, make `loadTextureSource` upload-aware, add `objectUrl` to `LoadedTextureSource`, add `loadFileSource`.
- `apps/lab/src/persistence.ts` — add `deleteConfig(id)`.
- `apps/lab/src/controls/levaSchema.ts` — build dropdown options from `buildTextureEntries(loadManifest())`; validate stored id against uploads too.
- `apps/lab/src/LabApp.tsx` — rework `handleFileChange` (persist + reload), resolve selected entry via `findTextureEntry`, revoke upload object URLs, add "Delete texture" button + handler, extract `applyLoadedSource`.
- `apps/lab/package.json` — add `fake-indexeddb` devDependency (via `pi add -D`).

---

### Task 1: Upload manifest module

**Files:**

- Create: `apps/lab/src/uploads.ts`
- Test: `apps/lab/src/uploads.test.ts`

**Interfaces:**

- Consumes: `LabTextureKind` (type only) from `./textures`.
- Produces:
  - `interface UploadEntry { id: string; label: string; kind: LabTextureKind; defaultScale: number; createdAt: number }`
  - `addUpload(manifest: UploadEntry[], entry: UploadEntry): UploadEntry[]` (pure; replaces any existing entry with same id, appends)
  - `removeUpload(manifest: UploadEntry[], id: string): UploadEntry[]` (pure)
  - `loadManifest(): UploadEntry[]` (localStorage `stripes-engine-lab-uploads`, returns `[]` on missing/corrupt)
  - `saveManifest(manifest: UploadEntry[]): void`

- [ ] **Step 1: Write the failing test**

Create `apps/lab/src/uploads.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addUpload, removeUpload, type UploadEntry } from "./uploads";

const entry = (id: string): UploadEntry => ({
  id,
  label: `${id}.png`,
  kind: "image",
  defaultScale: 1,
  createdAt: 0,
});

describe("upload manifest transforms", () => {
  it("addUpload appends a new entry", () => {
    const next = addUpload([entry("a")], entry("b"));
    expect(next.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("addUpload replaces an entry with the same id", () => {
    const updated = { ...entry("a"), label: "renamed.png" };
    const next = addUpload([entry("a")], updated);
    expect(next).toHaveLength(1);
    expect(next[0].label).toBe("renamed.png");
  });

  it("removeUpload drops the matching id", () => {
    const next = removeUpload([entry("a"), entry("b")], "a");
    expect(next.map((e) => e.id)).toEqual(["b"]);
  });

  it("transforms do not mutate the input array", () => {
    const input = [entry("a")];
    addUpload(input, entry("b"));
    removeUpload(input, "a");
    expect(input.map((e) => e.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- apps/lab/src/uploads.test.ts`
Expected: FAIL — cannot resolve `./uploads`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/lab/src/uploads.ts`:

```ts
import type { LabTextureKind } from "./textures";

export interface UploadEntry {
  id: string;
  label: string;
  kind: LabTextureKind;
  defaultScale: number;
  createdAt: number;
}

const MANIFEST_KEY = "stripes-engine-lab-uploads";

export function addUpload(manifest: UploadEntry[], entry: UploadEntry): UploadEntry[] {
  return [...manifest.filter((e) => e.id !== entry.id), entry];
}

export function removeUpload(manifest: UploadEntry[], id: string): UploadEntry[] {
  return manifest.filter((e) => e.id !== id);
}

export function loadManifest(): UploadEntry[] {
  try {
    const raw = localStorage.getItem(MANIFEST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as UploadEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveManifest(manifest: UploadEntry[]): void {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    /* ignore quota errors */
  }
}
```

> Note: `LabTextureKind` is added to `./textures` in Task 3. Until then the `import type` will be a type error only; the transforms test does not exercise it. If you run typecheck before Task 3, expect the unresolved type — it resolves once Task 3 lands. (Run Task 3 immediately after if typecheck noise is a concern.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pir test -- apps/lab/src/uploads.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/lab/src/uploads.ts apps/lab/src/uploads.test.ts
git commit -m "feat(lab): upload manifest module (localStorage + pure transforms)"
```

---

### Task 2: IndexedDB blob store

**Files:**

- Create: `apps/lab/src/textureStore.ts`
- Test: `apps/lab/src/textureStore.test.ts`
- Modify: `apps/lab/package.json` (add `fake-indexeddb` devDependency)

**Interfaces:**

- Produces:
  - `putTextureBlob(id: string, blob: Blob, type: string): Promise<void>`
  - `getTextureBlob(id: string): Promise<{ blob: Blob; type: string } | undefined>`
  - `deleteTextureBlob(id: string): Promise<void>`
- Storage: IndexedDB db `stripes-engine-lab`, object store `textures` (out-of-line keys), record `{ data: ArrayBuffer; type: string }`. ArrayBuffer (not Blob) is stored for maximum IDB compatibility; `getTextureBlob` reconstructs a fresh `Blob`.

- [ ] **Step 1: Add the dev dependency**

Run: `cd apps/lab && pi add -D fake-indexeddb`
Expected: `fake-indexeddb` appears under `devDependencies` in `apps/lab/package.json`.

- [ ] **Step 2: Write the failing test**

Create `apps/lab/src/textureStore.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { putTextureBlob, getTextureBlob, deleteTextureBlob } from "./textureStore";

describe("textureStore", () => {
  it("stores and retrieves bytes by id", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await putTextureBlob("upload-a", blob, "image/png");
    const got = await getTextureBlob("upload-a");
    expect(got?.type).toBe("image/png");
    expect(new Uint8Array(await got!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns undefined for a missing id", async () => {
    expect(await getTextureBlob("missing")).toBeUndefined();
  });

  it("deletes a stored blob", async () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    await putTextureBlob("upload-b", blob, "video/mp4");
    await deleteTextureBlob("upload-b");
    expect(await getTextureBlob("upload-b")).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pir test -- apps/lab/src/textureStore.test.ts`
Expected: FAIL — cannot resolve `./textureStore`.

- [ ] **Step 4: Write minimal implementation**

Create `apps/lab/src/textureStore.ts`:

```ts
const DB_NAME = "stripes-engine-lab";
const STORE = "textures";

interface StoredTexture {
  data: ArrayBuffer;
  type: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function putTextureBlob(id: string, blob: Blob, type: string): Promise<void> {
  const data = await blob.arrayBuffer();
  const record: StoredTexture = { data, type };
  await run<IDBValidKey>("readwrite", (store) => store.put(record, id));
}

export function getTextureBlob(id: string): Promise<{ blob: Blob; type: string } | undefined> {
  return run<StoredTexture | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<StoredTexture | undefined>,
  ).then((rec) => (rec ? { blob: new Blob([rec.data], { type: rec.type }), type: rec.type } : undefined));
}

export function deleteTextureBlob(id: string): Promise<void> {
  return run<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>).then(() => undefined);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pir test -- apps/lab/src/textureStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/textureStore.ts apps/lab/src/textureStore.test.ts apps/lab/package.json pnpm-lock.yaml
git commit -m "feat(lab): zero-dep IndexedDB blob store for uploaded textures"
```

---

### Task 3: Unified texture entries + upload-aware loading

**Files:**

- Modify: `apps/lab/src/textures.ts`
- Test: `apps/lab/src/textures.test.ts`

**Interfaces:**

- Consumes: `UploadEntry` (type) from `./uploads`; `getTextureBlob` from `./textureStore`.
- Produces:
  - `type LabTextureKind = "image" | "video"` (unchanged)
  - `type LabTextureOrigin = "builtin" | "upload"`
  - `interface LabTextureEntry { id; label; url: string | null; kind: LabTextureKind; defaultScale: number; origin: LabTextureOrigin }` (replaces `LabTexturePreset`)
  - `LAB_TEXTURES: LabTextureEntry[]` (built-ins, `origin: "builtin"`)
  - `DEFAULT_LAB_TEXTURE_ID` (unchanged)
  - `buildTextureEntries(manifest: UploadEntry[]): LabTextureEntry[]` (pure: built-ins + uploads)
  - `findTextureEntry(textureId: string, manifest: UploadEntry[]): LabTextureEntry | undefined` (pure)
  - `interface LoadedTextureSource { source: EngineSource; video: HTMLVideoElement | null; objectUrl: string | null }`
  - `loadTextureSource(entry: LabTextureEntry): Promise<LoadedTextureSource>` (upload entries resolve bytes from IndexedDB)
  - `loadFileSource(file: File): Promise<LoadedTextureSource>` (live, non-persisted; used by the quota fallback in Task 5)

- [ ] **Step 1: Write the failing test**

Create `apps/lab/src/textures.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildTextureEntries, findTextureEntry, LAB_TEXTURES } from "./textures";
import type { UploadEntry } from "./uploads";

const upload: UploadEntry = {
  id: "upload-1",
  label: "mine.png",
  kind: "image",
  defaultScale: 1,
  createdAt: 0,
};

describe("texture entries", () => {
  it("buildTextureEntries lists built-ins first, then uploads", () => {
    const entries = buildTextureEntries([upload]);
    expect(entries).toHaveLength(LAB_TEXTURES.length + 1);
    expect(entries.slice(0, LAB_TEXTURES.length).every((e) => e.origin === "builtin")).toBe(true);
    const last = entries[entries.length - 1];
    expect(last.id).toBe("upload-1");
    expect(last.origin).toBe("upload");
    expect(last.url).toBeNull();
  });

  it("findTextureEntry resolves built-ins and uploads", () => {
    expect(findTextureEntry("cloudflare-footer", [upload])?.origin).toBe("builtin");
    expect(findTextureEntry("upload-1", [upload])?.label).toBe("mine.png");
    expect(findTextureEntry("nope", [upload])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pir test -- apps/lab/src/textures.test.ts`
Expected: FAIL — `buildTextureEntries`/`findTextureEntry` not exported.

- [ ] **Step 3: Rewrite `apps/lab/src/textures.ts`**

Replace the entire file with:

```ts
import type { EngineSource } from "@necatikcl/stripes-engine";
import { createTestImage } from "./testImage";
import type { UploadEntry } from "./uploads";
import { getTextureBlob } from "./textureStore";

export type LabTextureKind = "image" | "video";
export type LabTextureOrigin = "builtin" | "upload";

export interface LabTextureEntry {
  id: string;
  label: string;
  url: string | null;
  kind: LabTextureKind;
  defaultScale: number;
  origin: LabTextureOrigin;
}

export const LAB_TEXTURES: LabTextureEntry[] = [
  {
    id: "cloudflare-footer",
    label: "Footer / Cloudflare",
    url: `${import.meta.env.BASE_URL}textures/cloudflare-footer.svg`,
    kind: "image",
    defaultScale: 2,
    origin: "builtin",
  },
  {
    id: "cta",
    label: "CTA",
    url: `${import.meta.env.BASE_URL}textures/cta.mp4`,
    kind: "video",
    defaultScale: 4,
    origin: "builtin",
  },
];

export const DEFAULT_LAB_TEXTURE_ID = "cloudflare-footer";

export function buildTextureEntries(manifest: UploadEntry[]): LabTextureEntry[] {
  const uploads = manifest.map(
    (e): LabTextureEntry => ({
      id: e.id,
      label: e.label,
      url: null,
      kind: e.kind,
      defaultScale: e.defaultScale,
      origin: "upload",
    }),
  );
  return [...LAB_TEXTURES, ...uploads];
}

export function findTextureEntry(textureId: string, manifest: UploadEntry[]): LabTextureEntry | undefined {
  return buildTextureEntries(manifest).find((t) => t.id === textureId);
}

export interface LoadedTextureSource {
  source: EngineSource;
  video: HTMLVideoElement | null;
  objectUrl: string | null;
}

export function loadTextureSource(entry: LabTextureEntry): Promise<LoadedTextureSource> {
  if (entry.origin === "upload") return loadUploadSource(entry);
  if (entry.url === null) {
    return Promise.resolve({ source: createTestImage(), video: null, objectUrl: null });
  }
  return entry.kind === "video" ? loadVideoFromUrl(entry.url, null) : loadImageFromUrl(entry.url, null);
}

export function loadFileSource(file: File): Promise<LoadedTextureSource> {
  const objectUrl = URL.createObjectURL(file);
  const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
  return kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

async function loadUploadSource(entry: LabTextureEntry): Promise<LoadedTextureSource> {
  const stored = await getTextureBlob(entry.id);
  if (!stored) throw new Error(`Missing stored bytes for upload: ${entry.id}`);
  const objectUrl = URL.createObjectURL(stored.blob);
  return entry.kind === "video" ? loadVideoFromUrl(objectUrl, objectUrl) : loadImageFromUrl(objectUrl, objectUrl);
}

function loadVideoFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.onloadeddata = () => {
      video.play().catch(() => {});
      resolve({ source: video, video, objectUrl });
    };
    video.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
  });
}

function loadImageFromUrl(url: string, objectUrl: string | null): Promise<LoadedTextureSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ source: img, video: null, objectUrl });
    img.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
    img.src = url;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pir test -- apps/lab/src/textures.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the manifest test still passes (type wiring)**

Run: `pir test -- apps/lab/src/uploads.test.ts apps/lab/src/textures.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/textures.ts apps/lab/src/textures.test.ts
git commit -m "feat(lab): unified texture entries with upload-aware source loading"
```

---

### Task 4: Wire uploads into config deletion + the picker dropdown

**Files:**

- Modify: `apps/lab/src/persistence.ts`
- Modify: `apps/lab/src/controls/levaSchema.ts`

**Interfaces:**

- Consumes: `buildTextureEntries`, `findTextureEntry`, `DEFAULT_LAB_TEXTURE_ID` from `../textures`; `loadManifest` from `../uploads`.
- Produces: `deleteConfig(textureId: string): void` (removes the texture's entry from the per-texture config map).

> No node unit test: both changes are localStorage I/O (unavailable in the lab's `node` vitest env). They are verified by the e2e in Task 6. The pure functions they call (`buildTextureEntries`/`findTextureEntry`) are already covered in Task 3.

- [ ] **Step 1: Add `deleteConfig` to `apps/lab/src/persistence.ts`**

Append after `saveConfig` (after line 45):

```ts
export function deleteConfig(textureId: string): void {
  try {
    const map = loadConfigMap();
    if (textureId in map) {
      delete map[textureId];
      localStorage.setItem(MAP_KEY, JSON.stringify(map));
    }
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Merge uploads into the dropdown options in `apps/lab/src/controls/levaSchema.ts`**

Change the import on line 9 and the `TEXTURE_OPTIONS` const on line 11:

```ts
import { DEFAULT_LAB_TEXTURE_ID, buildTextureEntries, findTextureEntry } from "../textures";
import { loadManifest } from "../uploads";

const TEXTURE_OPTIONS = Object.fromEntries(buildTextureEntries(loadManifest()).map((t) => [t.label, t.id]));
```

(Remove `LAB_TEXTURES` from that import — it is no longer used in this file.)

- [ ] **Step 3: Validate the stored texture id against uploads too**

Replace the `initialTextureId` memo body (lines 35-38) so a persisted upload id is accepted:

```ts
const initialTextureId = useMemo(() => {
  const stored = loadTextureId();
  return stored && findTextureEntry(stored, loadManifest()) ? stored : DEFAULT_LAB_TEXTURE_ID;
}, []);
```

- [ ] **Step 4: Typecheck the lab**

Run: `pir --filter lab typecheck` (or from `apps/lab`: `pir typecheck`)
Expected: no type errors. If `LAB_TEXTURES` is reported unused anywhere, remove the stray import.

- [ ] **Step 5: Run the lab unit tests**

Run: `pir test -- apps/lab`
Expected: PASS (all lab unit tests).

- [ ] **Step 6: Commit**

```bash
git add apps/lab/src/persistence.ts apps/lab/src/controls/levaSchema.ts
git commit -m "feat(lab): merge uploads into texture picker + deleteConfig"
```

---

### Task 5: LabApp wiring — persist on upload, delete button, object-URL cleanup

**Files:**

- Modify: `apps/lab/src/LabApp.tsx`

**Interfaces:**

- Consumes: `findTextureEntry`, `loadTextureSource`, `loadFileSource`, `LAB_TEXTURES`, `DEFAULT_LAB_TEXTURE_ID`, `type LabTextureKind`, `type LoadedTextureSource` from `./textures`; `addUpload`, `removeUpload`, `loadManifest`, `saveManifest` from `./uploads`; `putTextureBlob`, `deleteTextureBlob` from `./textureStore`; `deleteConfig` from `./persistence`.
- Produces: user-visible behavior; validated by Task 6.

- [ ] **Step 1: Update imports**

In `apps/lab/src/LabApp.tsx`, replace the textures import (line 19) and add the new ones near the other local imports:

```ts
import { DEFAULT_LAB_TEXTURE_ID, LAB_TEXTURES, findTextureEntry, loadFileSource, loadTextureSource } from "./textures";
import type { LabTextureKind, LoadedTextureSource } from "./textures";
import { addUpload, loadManifest, removeUpload, saveManifest } from "./uploads";
import { putTextureBlob, deleteTextureBlob } from "./textureStore";
```

Add `deleteConfig` to the existing `./persistence` import. Replace line 18:

```ts
import { saveConfig, saveTextureId, importConfig } from "./persistence";
```

with:

```ts
import { saveConfig, saveTextureId, importConfig, deleteConfig } from "./persistence";
```

- [ ] **Step 2: Rename the object-URL ref**

Replace `lastObjectUrlRef` (line 177) with an upload-source URL ref:

```ts
const uploadObjectUrlRef = useRef<string | null>(null);
```

(Remove every other `lastObjectUrlRef` usage — the old one in `handleFileChange` is deleted in Step 5.)

- [ ] **Step 3: Add the `applyLoadedSource` helper inside `LabInner`**

Add this function inside the component (e.g. just above `handleExport`, after the effects). It centralizes setting the engine source + canvas size and revokes the previously-held upload object URL:

```ts
function applyLoadedSource(loaded: LoadedTextureSource) {
  const engine = engineRef.current;
  const canvas = canvasRef.current;
  if (!engine) return;
  if (uploadObjectUrlRef.current) URL.revokeObjectURL(uploadObjectUrlRef.current);
  uploadObjectUrlRef.current = loaded.objectUrl;
  engine.setSource(loaded.source);
  prevVideoRef.current = loaded.video;
  setVideoEl(loaded.video);
  if (shell) {
    let srcW = 0;
    let srcH = 0;
    if (loaded.video) {
      srcW = loaded.video.videoWidth;
      srcH = loaded.video.videoHeight;
    } else if (loaded.source instanceof HTMLImageElement) {
      srcW = loaded.source.naturalWidth;
      srcH = loaded.source.naturalHeight;
    }
    if (srcW > 0 && srcH > 0) {
      const src = { w: srcW, h: srcH };
      setSourceSize(src);
      if (canvas) applyCanvasSize(engine, canvas, src, scaleRef.current);
    }
  }
  if (manualRef.current) engine.renderFrame();
}
```

- [ ] **Step 4: Rewrite the texture-load effect to use entries + the helper**

Replace the body of the `useEffect(() => { ... }, [textureId, manual])` that loads the texture (currently lines 366-411) with:

```ts
useEffect(() => {
  if (manual) return;
  const engine = engineRef.current;
  if (!engine) return;
  let cancelled = false;
  if (prevVideoRef.current) {
    prevVideoRef.current.pause();
    prevVideoRef.current = null;
  }
  const entry = findTextureEntry(textureId, loadManifest()) ?? LAB_TEXTURES[0];
  setScale(entry.defaultScale);
  loadTextureSource(entry)
    .then((loaded) => {
      if (cancelled) {
        if (loaded.video) loaded.video.pause();
        if (loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
        return;
      }
      applyLoadedSource(loaded);
      setReady(true);
      if (revealEnabledRef.current) engine.triggerReveal();
    })
    .catch(() => {
      if (cancelled) return;
      // Stale upload (manifest entry but bytes gone): drop it and fall back.
      if (textureId !== DEFAULT_LAB_TEXTURE_ID) {
        saveManifest(removeUpload(loadManifest(), textureId));
        saveTextureId(DEFAULT_LAB_TEXTURE_ID);
        window.location.reload();
      }
    });
  return () => {
    cancelled = true;
  };
}, [textureId, manual]);
```

- [ ] **Step 5: Rewrite `handleFileChange` to persist + reload**

Replace the whole `handleFileChange` function (lines 429-480) with:

```ts
async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = "";
  const kind: LabTextureKind = file.type.startsWith("video/") ? "video" : "image";
  const id = `upload-${crypto.randomUUID()}`;
  try {
    await putTextureBlob(id, file, file.type);
  } catch {
    window.alert("Couldn't save this upload (storage full). It will show for this session but won't persist.");
    loadFileSource(file).then((loaded) => {
      if (engineRef.current) applyLoadedSource(loaded);
    });
    return;
  }
  saveManifest(addUpload(loadManifest(), { id, label: file.name, kind, defaultScale: 1, createdAt: Date.now() }));
  saveTextureId(id);
  window.location.reload();
}
```

- [ ] **Step 6: Add the delete handler + selected-entry derivation**

Add near the other derived values inside `LabInner` (after `textureIdRef` is set up, around line 207):

```ts
const selectedEntry = useMemo(() => findTextureEntry(textureId, loadManifest()), [textureId]);
const canDeleteTexture = selectedEntry?.origin === "upload";

function handleDeleteTexture() {
  const entry = findTextureEntry(textureId, loadManifest());
  if (!entry || entry.origin !== "upload") return;
  saveManifest(removeUpload(loadManifest(), entry.id));
  void deleteTextureBlob(entry.id);
  deleteConfig(entry.id);
  saveTextureId(DEFAULT_LAB_TEXTURE_ID);
  window.location.reload();
}
```

(Ensure `useMemo` is imported from `react` — it already is via the existing `useMemo` usage on line 197.)

- [ ] **Step 7: Add the "Delete texture" button to the workflow controls**

In the `playground-workflow-controls` block, immediately after the `Upload texture` `<label>` (after line 513), add:

```tsx
<button className="lab-btn" onClick={handleDeleteTexture} disabled={!canDeleteTexture}>
  Delete texture
</button>
```

- [ ] **Step 8: Revoke the upload object URL on unmount**

In the mount effect's cleanup (the `return () => { ... }` that calls `engine.dispose()`, around lines 298-304), add before/after `engine.dispose()`:

```ts
if (uploadObjectUrlRef.current) {
  URL.revokeObjectURL(uploadObjectUrlRef.current);
  uploadObjectUrlRef.current = null;
}
```

- [ ] **Step 9: Typecheck**

Run: from `apps/lab`: `pir typecheck`
Expected: no type errors. Resolve any unused-import warnings (e.g. if `LoadedTextureSource` is only used as a type, the `import type` keeps it clean).

- [ ] **Step 10: Commit**

```bash
git add apps/lab/src/LabApp.tsx
git commit -m "feat(lab): persist uploads to library, add delete, revoke object URLs"
```

---

### Task 6: End-to-end persistence test

**Files:**

- Create: `tests/uploaded-textures.spec.ts`

**Interfaces:**

- Consumes: the running lab on `http://localhost:5174` (Playwright `webServer` reuses an existing server). The hidden `input[type="file"]`, the `Delete texture` button, localStorage keys `stripes-engine-lab-uploads` / `stripes-engine-lab-texture`, and IndexedDB db `stripes-engine-lab`.

- [ ] **Step 1: Write the e2e spec**

Create `tests/uploaded-textures.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test";

const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function clearLabStorage(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        localStorage.clear();
        const req = indexedDB.deleteDatabase("stripes-engine-lab");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

test("uploaded texture persists across reload and can be deleted", async ({ page }) => {
  await page.goto("/");
  await clearLabStorage(page);
  await page.reload();

  await page.locator('input[type="file"]').setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_1x1, "base64"),
  });

  // handleFileChange persists, then reloads. Wait for the manifest to appear.
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("stripes-engine-lab-uploads");
    return !!raw && JSON.parse(raw).length === 1;
  });

  const state = await page.evaluate(() => ({
    manifest: JSON.parse(localStorage.getItem("stripes-engine-lab-uploads") || "[]"),
    selected: localStorage.getItem("stripes-engine-lab-texture"),
  }));
  expect(state.manifest).toHaveLength(1);
  expect(state.manifest[0].label).toBe("fixture.png");
  expect(state.manifest[0].kind).toBe("image");
  expect(state.selected).toBe(state.manifest[0].id);

  const id = state.manifest[0].id as string;

  // Bytes are in IndexedDB.
  const hasBlob = await page.evaluate(
    (textureId) =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open("stripes-engine-lab", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const getReq = db.transaction("textures", "readonly").objectStore("textures").get(textureId);
          getReq.onsuccess = () => {
            db.close();
            resolve(!!getReq.result);
          };
          getReq.onerror = () => {
            db.close();
            reject(getReq.error);
          };
        };
      }),
    id,
  );
  expect(hasBlob).toBe(true);

  // Survives a fresh reload: still the selected texture.
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("stripes-engine-lab-texture"))).toBe(id);

  // Delete it → falls back to the default built-in, manifest empties.
  await page.getByRole("button", { name: "Delete texture" }).click();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("stripes-engine-lab-uploads");
    return !raw || JSON.parse(raw).length === 0;
  });
  expect(await page.evaluate(() => localStorage.getItem("stripes-engine-lab-texture"))).toBe("cloudflare-footer");
});
```

- [ ] **Step 2: Ensure the dev server is up, then run the e2e**

The user runs the lab on http://localhost:5174. Confirm it is live first:

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5174`
Expected: `200`. If not live, ask the user to start it (`pir dev` in `apps/lab`) — do NOT spawn a competing server. (Playwright's config will reuse the existing server.)

Run: `pir test:e2e -- uploaded-textures`
Expected: PASS (1 test).

- [ ] **Step 3: Commit**

```bash
git add tests/uploaded-textures.spec.ts
git commit -m "test(lab): e2e for uploaded-texture persistence + delete"
```

---

## Final verification

- [ ] Run the full lab unit suite: `pir test -- apps/lab` → PASS
- [ ] Typecheck the lab: from `apps/lab`, `pir typecheck` → clean
- [ ] Manual smoke (in the user's open lab tab): upload an image → it appears selected in the Texture dropdown → reload → still there and rendering → tweak a control → reload → settings preserved → "Delete texture" → returns to Footer/Cloudflare and the entry is gone from the dropdown.

## Notes / gotchas

- **Reload UX:** uploading and switching both do a full page reload — this is the existing lab behavior for texture switching, not new.
- **Quota:** if IndexedDB write fails, the upload still shows for the session (live object URL) but is not saved; the user is alerted.
- **`crypto.randomUUID()`** requires a secure context; `localhost` qualifies.
- **Built-in presets are not deletable** — the Delete button is disabled unless the selected entry's `origin === "upload"`. Consider a `.lab-btn:disabled { opacity: .5; cursor: default }` rule in the lab CSS if the disabled state isn't already styled (optional, not required for function).
