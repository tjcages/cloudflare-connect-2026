# Saved shader library

Each `*.json` file here is one saved shader (`{ id, label, source, createdAt, config? }`).

These files are the **committed, shareable** copy of your saved shaders: they are bundled into the
app at build time and loaded for everyone who clones or builds the project. Commit them to git to
share your shaders.

How they get written:

- While the dev server is running (`pnpm dev:playground`), saving a shader in the playground writes
  its file here automatically via a dev-only endpoint (`/__playground/saved-shaders`). The
  "Save all shaders to files" button flushes your whole library, and any browser-only shaders are
  also backed up here automatically on startup.
- In a static/deployed build there is no dev server, so saving falls back to `localStorage` only.
  Files placed here (and committed) still load everywhere.

Do not hand-edit the `id` field; the filename must stay `<id>.json` with the same id inside.
