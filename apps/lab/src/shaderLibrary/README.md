# Shader library

Bundled ShaderToy-style sources available from the lab **Shader** dropdown.

- `nebula` comes from `../defaultShaderTextureSource.ts`
- `plane-terrain` is a full-bleed plane of evenly spaced L→R fibers over hills/valleys
  (`../planeTerrainShaderSource.ts`)
- `comet-logo` uses a dedicated instanced WebGL2 renderer so each logo point reuses one moving comet
- `saved/*.json` were imported from the cloudflare-connect playground saved-shader library
  (`{ id, label, source, createdAt, config? }`). Only `id` / `label` / `source` are used here.
