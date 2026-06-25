# @necatikcl/stripes-engine

GPU (WebGL2) renderer that turns an image or video into an animated duotone stripe-grid. Two entry points:

- **`@necatikcl/stripes-engine`** — the framework-agnostic core (`createStripesEngine`).
- **`@necatikcl/stripes-engine/react`** — a render-only React canvas, `<StripesShader>`, for dropping into other projects with just a config (no editor UI).

## React (drop-in canvas)

```tsx
import { StripesShader } from "@necatikcl/stripes-engine/react";

export function Hero() {
  return (
    <StripesShader
      src="/logo.png"
      // mediaKind="video"   // for an mp4/webm source
      config={{
        stripesEnabled: true,
        colors: { mode: "colors", autoDetectBackground: true },
        grid: { cellWidth: 8, cellHeight: 8 },
      }}
      style={{ width: 480, height: 480 }}
    />
  );
}
```

`config` is a `Partial<EngineConfig>` — anything you don't set falls back to defaults. The component
owns its `<canvas>`, creates the engine on mount, loads the source, and disposes on unmount. `react`
and `react-dom` are optional peer dependencies (only needed when you import the `/react` subpath).

## Vanilla core

```ts
import { createStripesEngine } from "@necatikcl/stripes-engine";

const engine = createStripesEngine(canvas);
engine.setSource(imageOrVideoElement);
engine.setConfig({ stripesEnabled: true });
engine.start();
// ...later
engine.dispose();
```

See `EngineConfig` (and `DEFAULT_ENGINE_CONFIG`) for the full configuration surface.
