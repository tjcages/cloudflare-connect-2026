# Shader library

Bundled ShaderToy-style sources available from the lab **Shader** dropdown.

- `nebula` (default) comes from `../defaultShaderTextureSource.ts`
- `flowing-lines` recreates the 5:1 orange sine-pack reference in `../flowingLinesShaderSource.ts`
- `comet-logo` uses a dedicated instanced WebGL2 renderer so each logo point reuses one moving comet
- `saved/*.json` were imported from the cloudflare-connect playground saved-shader library
  (`{ id, label, source, createdAt, config? }`). Only `id` / `label` / `source` are used here.
