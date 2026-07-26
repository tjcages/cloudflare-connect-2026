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
owns its `<canvas>`; the source is fetched and decoded off the main thread. `react` and `react-dom`
are optional peer dependencies (only needed when you import the `/react` subpath).

### Shared context

`<StripesShader>` is **shared-only**. Every instance on the page renders through ONE WebGL context
owned by a worker, which draws each instance into a plain 2D canvas. Browsers cap live WebGL
contexts (~8-16 per page, oldest silently lost), so this is what lets a page carry many instances —
at one context and one program compile for all of them. Cursor/click interaction and
`onWaterActivity` are forwarded per instance.

This requires `OffscreenCanvas` + `Worker` (Chrome/Edge 69+, Firefox 105+, **Safari 16.4+**). There
is no main-thread fallback: on a browser without them the canvas stays blank.

Because the component never references the main-thread renderer, importing `/react` keeps the GL
engine out of your bundle's static graph — the worker path is loaded on demand. That is worth
roughly **70 KB gzip** on a page that only mounts `<StripesShader>`.

Need the engine on the main thread — imperative control, or `EngineHooks` (custom field/post/reveal
passes, which are functions and cannot cross the worker boundary)? Use `createStripesEngine` from
the package root directly; see [Vanilla core](#vanilla-core) below.

### Visibility

Rendering is gated on an IntersectionObserver honoring `rootMargin` (default `"200% 0px"`), with a
separate preload gate (`preloadRootMargin`) that starts fetching the source ahead of it. Outside the
render gate the instance **pauses**; nothing is disposed, so the GL context, the loaded source and
the reveal timeline all survive. Scrolling a canvas out of view and back neither recompiles programs
nor replays the reveal.

Because of that, do **not** gate the component yourself with `{inView && <StripesShader />}` — that
unmounts it, which destroys the context and replays the reveal on every re-entry. Widen or tighten
`rootMargin` instead:

```tsx
<StripesShader src="/logo.png" rootMargin="0px" />              {/* pause as soon as it leaves the viewport */}
<StripesShader src="/logo.png" preloadRootMargin="300% 0px" />  {/* fetch earlier than it renders */}
<StripesShader src="/logo.png" revealDelayMs={200} />           {/* hold the first load so the reveal is seen */}
```

A paused instance also settles: it reports `onWaterActivity(0)` so a value captured mid-hover cannot
freeze on the host while the canvas sits offscreen.

## Vanilla core

```ts
import { createStripesEngine } from "@necatikcl/stripes-engine";

const engine = createStripesEngine(canvas);
engine.setSource(imageOrVideoElement);
engine.setConfig({ stripesEnabled: true });
engine.start();
// ...offscreen: pause without losing the context, the source or the reveal
engine.stop();
engine.start();
// ...later
engine.dispose();
```

`stop()` pauses the render loop and reports `onWaterActivity(0)`; `start()` resumes where it left off
(it never restarts an in-flight reveal). `dispose()` releases the GPU resources and does not fire the
callback. Driving `renderFrame()` yourself instead? Call `settle()` when you stop calling it.

See `EngineConfig` (and `DEFAULT_ENGINE_CONFIG`) for the full configuration surface.
