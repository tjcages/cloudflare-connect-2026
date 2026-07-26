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

Two independent gates, because they answer two different questions.

**The render gate** decides whether the instance renders at all — ambient blinks, drift, the cursor
trail. It is an IntersectionObserver honoring `rootMargin` (default `"0px"`), so any on-screen pixel
renders: a visible canvas can never look frozen, and nothing offscreen burns GPU. A separate preload
gate (`preloadRootMargin`, default `"200% 0px"`) starts fetching the source far ahead of it, so the
render gate never opens onto an undecoded image.

**The reveal gate** decides whether the reveal animation's _clock advances_. It opens when either a
quarter of the element's own height **or** a quarter of the viewport height is on screen — whichever
comes first. The reveal is a one-shot animation and the viewer has to be able to see it, so it must
not be spent on a sliver at the viewport edge. The viewport-relative half of that test is what makes
the gate deadlock-proof: `intersectionRatio` is a fraction of the _target_ and is capped by
`viewport / element`, so an element taller than four viewports could never reach 0.25 on its own and
would hold its reveal forever. Between "one pixel visible" and "reveal gate open" the canvas renders
its pre-reveal state, which is empty — that is intended.

Outside the render gate the instance **pauses**; nothing is disposed, so the GL context, the loaded
source and the reveal timeline all survive. Reveal progress is banked when the reveal gate closes and
continues from there when it reopens, so scrolling a canvas out of view and back neither recompiles
programs nor replays — or restarts — the reveal. A finished reveal stays finished.

Because of that, do **not** gate the component yourself with `{inView && <StripesShader />}` — that
unmounts it, which destroys the context and replays the reveal on every re-entry. Widen or tighten
`rootMargin` instead:

```tsx
<StripesShader src="/logo.png" rootMargin="200% 0px" />         {/* keep rendering two viewports out */}
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
