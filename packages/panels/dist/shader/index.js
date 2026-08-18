import { createContext, useRef, useMemo, useEffect, useCallback, useState, useLayoutEffect, createElement, useSyncExternalStore, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { jsxs, jsx, Fragment } from 'react/jsx-runtime';
import { canEncodeVideo, BufferTarget, Output, Mp4OutputFormat, CanvasSource } from 'mediabunny';
import { createPortal } from 'react-dom';
import { useThree, useFrame } from '@react-three/fiber';
import { Sphere, Vector3, Plane, Vector2, Raycaster } from 'three';

// src/adapters.ts
function hexToRgb01(hex) {
  const normalized = hex.replace("#", "").trim();
  const full = normalized.length === 3 ? normalized.split("").map((c) => c + c).join("") : normalized;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  const r = (n >> 16 & 255) / 255;
  const g = (n >> 8 & 255) / 255;
  const b = (n & 255) / 255;
  return [r, g, b];
}
function uniformNameFor(key, mapping, prefix) {
  return mapping[key] ?? `${prefix}${key}`;
}
function createWebGLAdapter({
  fields,
  mapping = {},
  prefix = "u_",
  colorAs = "rgb01",
  toggleAs = "int"
}) {
  return function configToUniforms(config) {
    const out = {};
    for (const field of fields) {
      if (field.type === "section" || field.type === "action" || field.type === "presets") continue;
      const key = field.key;
      const name = uniformNameFor(key, mapping, prefix);
      const value = config[key];
      if (field.type === "color") {
        const rgb01 = hexToRgb01(value);
        out[name] = colorAs === "rgb255" ? rgb01.map((c) => Math.round(c * 255)) : rgb01;
        continue;
      }
      if (field.type === "toggle") {
        out[name] = toggleAs === "int" ? value ? 1 : 0 : Boolean(value);
        continue;
      }
      out[name] = value;
    }
    return out;
  };
}
function createR3FAdapter({
  uniforms,
  fields,
  mapping = {},
  prefix = "u_"
}) {
  return function applyConfig(config) {
    for (const field of fields) {
      if (field.type === "section" || field.type === "action" || field.type === "presets") continue;
      const key = field.key;
      const name = uniformNameFor(key, mapping, prefix);
      const slot = uniforms[name];
      if (!slot) continue;
      const value = config[key];
      if (field.type === "color") {
        const current2 = slot.value;
        if (current2 && typeof current2.set === "function") {
          current2.set(value);
        } else {
          slot.value = value;
        }
        continue;
      }
      if (field.type === "vec2") {
        const tuple = value;
        const current2 = slot.value;
        if (current2 && typeof current2.set === "function") {
          current2.set(tuple[0], tuple[1]);
        } else {
          slot.value = [tuple[0], tuple[1]];
        }
        continue;
      }
      slot.value = value;
    }
  };
}

// src/patch-config.ts
function patchShaderConfigDefaults(source, exportName, serializedDefaults) {
  const start = "// @shader-config-start";
  const end = "// @shader-config-end";
  const startIdx = source.indexOf(start);
  const endIdx = source.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error("Config file missing @shader-config markers");
  }
  const before = source.slice(0, startIdx + start.length);
  const after = source.slice(endIdx);
  return `${before}
export const ${exportName} = ${serializedDefaults} as const
${after}`;
}

// src/prompts.ts
function fillPanelPrompt(prompt, shaderName) {
  const name = shaderName?.trim() || "shader";
  return prompt.replace(/\{\{\s*shader\s*\}\}/g, name);
}
var DEFAULT_PANEL_PROMPTS = [
  {
    id: "improve-quality",
    title: "Improve visual quality",
    description: "Color space, tone mapping, dithering, AA, hash/noise, easing.",
    prompt: `Act as a senior graphics engineer. Find the {{shader}} in this project \u2014 its GLSL / fragment source \u2014 and propose concrete, high-impact changes to its visual quality. Work the list in priority order. For each change show an exact GLSL diff (before \u2192 after), one line on the visible difference, and any cost.

1. COLOR SPACE \u2014 the single most common quality bug.
   - Determine whether color math runs in sRGB or linear space. Blending, accumulation, bloom, and lighting are only correct in LINEAR space.
   - If colors are mixed/added in sRGB: linearize on read (fast \`c*c\`, or accurate \`pow(c, vec3(2.2))\`), do all math linear, then encode back at the very end with \`pow(color, vec3(1.0/2.2))\` or the accurate piecewise sRGB curve.
   - Check the renderer isn't ALSO encoding (e.g. three.js \`outputColorSpace\`) \u2014 double-encoding washes everything out.

2. TONE MAPPING \u2014 for any bright cores, bloom, or HDR-ish accumulation.
   - A bare \`clamp(c, 0.0, 1.0)\` hard-clips highlights to flat white and destroys hue. Tone-map before the sRGB encode.
   - Reinhard (cheap): \`c / (1.0 + c)\`. ACES filmic (better, ~6 mul/add): use the standard Narkowicz fit \u2014 keeps saturation in the highlights.

3. BANDING \u2014 visible 8-bit steps in smooth gradients / glows.
   - Add ordered or hash dither of about \xB10.5/255 right before output: \`color += (hash12(gl_FragCoord.xy + uTime) - 0.5) / 255.0;\`
   - Triangular-PDF (TPDF) dither is cleanest; animate the noise per-frame so it's invisible.

4. EDGE ANTI-ALIASING \u2014 kill jaggies on SDF shapes and hard cutoffs.
   - Replace \`step(edge, x)\` and sharp comparisons with derivative-aware smoothstep: \`float w = fwidth(x); v = smoothstep(edge - w, edge + w, x);\`
   - For an SDF \`d\` (0 at the edge): \`float w = fwidth(d); mask = smoothstep(w, -w, d);\` \u2014 gives a ~1px screen-space feather at any resolution / zoom.

5. HASH & NOISE QUALITY.
   - \`fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453)\` is non-portable (sin precision varies per GPU) and shows diagonal banding. Swap for an integer/bit hash (Dave Hoskins hash12/hash22, or a PCG hash) \u2014 stable and artifact-free.
   - FBM: lacunarity ~2.0, gain ~0.5. Add domain warping (\`fbm(p + k*fbm(p))\`) for organic, non-griddy structure.

6. EASING \u2014 linear interpolations read mechanical.
   - Use smoothstep, or smootherstep \`t*t*t*(t*(t*6.0-15.0)+10.0)\` (C2-continuous \u2192 velocity-continuous motion). Apply to reveal/fade/pulse curves.

Constraints: do NOT rename uniforms, restructure the render pipeline, or break existing shader-panel field bindings. Report which items you applied and which you skipped, with reasons.`
  },
  {
    id: "optimize-perf",
    title: "Optimize GPU performance",
    description: "Diagnose the bottleneck, then cut ALU / branch / precision cost.",
    prompt: `Act as a GPU performance engineer. Find the {{shader}} in this project (its GLSL source) and audit it for cost reductions that do NOT change the visual output (or change it imperceptibly). FIRST classify the likely bottleneck, then apply the matching fixes. For each finding: GLSL diff, expected saving, visual delta (none / negligible / minor), and how to verify.

STEP 0 \u2014 CLASSIFY THE BOTTLENECK
- Fragment ALU-bound: heavy math per pixel (loops, transcendentals, many octaves). Most common for fullscreen/background shaders.
- Texture/bandwidth-bound: many samples, dependent reads, large textures.
- Fill-rate / overdraw-bound: many transparent layers, large blended quads.
State which one this shader is and optimize that first.

ALU REDUCTION
- Hoist loop-invariant work out of \`for\` loops. Anything not depending on the loop index is computed once.
- Kill transcendentals in hot paths: \`pow(x, 2.0)\` \u2192 \`x*x\`; \`pow(x, 4.0)\` \u2192 \`x2=x*x; x2*x2\`. \`pow\`, \`exp\`, \`log\`, \`sin\`, \`cos\`, \`atan\`, \`acos\`, \`normalize\`, \`length\` (sqrt) are expensive \u2014 precompute, approximate, or bake into a LUT texture.
- Precompute constants the compiler can't fold (1.0/N, fixed ratios) and pass as uniforms or \`const\`.
- Move per-fragment work that's actually per-vertex into the vertex shader and let it interpolate (e.g. world-space ray setup, slow-varying gradients).

BRANCHING
- GPUs execute in warps/waves (32\u201364 lanes). A divergent branch runs BOTH sides for the whole warp. Replace cheap two-sided branches with \`mix()\`, \`step()\`, \`clamp()\`.
- Keep genuinely expensive branches only if they're coherent (all nearby pixels take the same path), e.g. a uniform-driven feature toggle.

PRECISION (big wins on mobile)
- Default heavy intermediate math and color to \`mediump\` (fp16) \u2014 often ~2\xD7 throughput on mobile GPUs. Keep \`highp\` only where it matters: positions, UV at large scale, and TIME ACCUMULATION.
- Watch mediump range (\xB165504, precision degrades well before that): a \`mediump\` time uniform visibly stutters/banding after a few minutes. Pass \`highp\` time, or feed \`mod(time, 1000.0)\`.

TEXTURES
- Avoid dependent texture reads (sample coord computed from a previous sample) inside loops \u2014 they defeat the texture cache.
- Collapse repeated samples of the same coordinate into one fetch.

MOBILE / TILER NOTES (PowerVR, Adreno, Mali)
- Avoid \`discard\` \u2014 it disables early-Z and tile hidden-surface removal and is often SLOWER than blending a zero alpha.
- Minimize varyings (each one costs bandwidth across the tile).
- Never read back the framebuffer mid-pass.

LOOPS
- Bounds should be compile-time constant so the compiler can unroll; dynamic upper bounds block unrolling on older targets. If quality scales, gate octave count behind a \`const\` or \`#define\`.

Report findings ranked by expected impact.`
  },
  {
    id: "reduce-shimmer",
    title: "Reduce shimmer / temporal aliasing",
    description: "Stop crawling, sparkle, and flicker under motion and at distance.",
    prompt: `Act as a real-time rendering engineer. The {{shader}} in this project shimmers, sparkles, crawls, or flickers when it (or the camera) moves, or when detail is small on screen. Find its GLSL source, diagnose the temporal aliasing, and fix it. Show GLSL diffs and explain the mechanism for each.

ROOT CAUSE
Temporal aliasing happens when high-frequency detail (thin lines, sharp noise, fine patterns, specular highlights) is sampled at one point per pixel without prefiltering. As the signal slides under the pixel grid it beats against it \u2192 crawl/sparkle.

FIXES, in order of preference:
1. PREFILTER WITH DERIVATIVES (analytic AA)
   - For procedural patterns/lines, fade detail toward gray as it approaches the Nyquist limit. Use \`fwidth\` to measure how fast the function changes per pixel and \`smoothstep\` the contrast down: \`float w = fwidth(pattern); value = mix(0.5, value, clamp(1.0 - w*K, 0.0, 1.0));\` (or band-limit a tiled coordinate so cells smaller than a pixel converge to their average).
   - For stripes/grids: use the analytic filtered-pattern trick \u2014 integrate the pattern over the pixel footprint rather than point-sampling.

2. NOISE / FBM
   - Drop octaves whose feature size is below ~1px: compare octave frequency to \`1.0/fwidth(p)\` and fade the last octaves out instead of letting them alias. This both fixes shimmer AND saves ALU.

3. TEXTURE DETAIL
   - Ensure mipmaps exist and trilinear/anisotropic filtering is on. If sampling an explicit LOD, don't pin it to 0 in minified regions \u2014 let the GPU pick, or bias with \`textureGrad\`/\`textureLod\` using \`fwidth\`-derived LOD.

4. SPECULAR / HIGHLIGHTS
   - Tiny moving specular dots are aliasing. Clamp roughness to a screen-space-derivative-aware minimum (Toksvig / geometric-normal-AA style) so highlights can't get sub-pixel sharp.

5. TEMPORAL SMOOTHING (last resort, if single-frame prefilter isn't enough)
   - Add a small amount of per-frame jitter to the sampling and/or low-pass the value over time via a tiny exponential moving average, so residual sparkle averages out instead of strobing.

Constraint: prefer single-frame analytic prefiltering (#1\u2013#4) over temporal accumulation (#5) \u2014 it's cheaper and has no ghosting. Report what was aliasing and which fix you used.`
  },
  {
    id: "find-bugs",
    title: "Find runtime bugs & leaks",
    description: "Context loss, GL disposal, NaN/Inf, mediump overflow, render storms.",
    prompt: `Act as a senior WebGL/React-Three-Fiber engineer doing a defect review. Audit the {{shader}} setup in this project \u2014 the React component that mounts it and its GLSL source. Report every finding as \`file:line \u2014 issue \u2014 concrete fix\`, ranked by severity.

GPU RESOURCE LEAKS (high severity \u2014 they accumulate across mounts/HMR)
- Three.js: geometries, materials, textures, and render targets each need explicit \`.dispose()\` on unmount. Removing from the scene graph does NOT free GPU memory.
- Renderer: on teardown call \`renderer.dispose()\`, and \`renderer.forceContextLoss()\` if you created the context.
- Render targets / FBOs and any ping-pong buffers must be disposed; check resize handlers don't allocate a new target every event without freeing the old one.

WEBGL CONTEXT LOSS (common production crash)
- Missing \`webglcontextlost\` listener (must \`preventDefault()\`) and \`webglcontextrestored\` to recreate GL resources. Tab backgrounding / GPU reset will otherwise blank or freeze the canvas permanently.

REACT / R3F HOT-PATH BUGS
- \`uniforms\` object re-created on every render \u2192 material recompiles or loses state. It must be created once (useMemo/useRef) and have its \`.value\` slots mutated.
- \`useFrame\` reading React state/props directly \u2192 stale closure; route through a ref updated each render.
- \`setState\` (or anything causing a React re-render) called inside \`useFrame\` \u2192 a render every frame; catastrophic. Move to refs / imperative updates.
- RAF loops, ResizeObservers, and event listeners added without a matching cleanup in the effect's return.

GLSL NUMERICAL HAZARDS (cause NaN/Inf that spread to black or white pixels)
- Division without an epsilon guard: \`a / b\` where b can be 0 \u2192 use \`a / max(b, 1e-6)\`.
- \`normalize(v)\` when v can be the zero vector \u2192 guard length first.
- Domain errors: \`sqrt(x)\`/\`log(x)\`/\`pow(x, y)\` with x<0, \`acos\`/\`asin\` with |arg|>1 \u2192 clamp inputs.
- \`mediump\` overflow / precision loss: a time or accumulator value growing unbounded in \`mediump\` wraps or quantizes after minutes \u2192 use \`highp\` or feed \`mod(time, P)\`.
- Reading mip level / using \`fwidth\`/\`dFdx\` inside non-uniform control flow (an \`if\`/loop that differs per pixel) \u2014 derivatives are undefined there.
- Unbounded or potentially non-terminating loops (\`while\`, dynamic bound) that can hang the GPU.

For each: state the trigger condition (when it actually bites) and the minimal fix.`
  },
  {
    id: "expose-missing",
    title: "Expose missing parameters",
    description: "Detect every uniform, add panel fields with smart ranges + sections.",
    prompt: `Wire every tweakable uniform of the {{shader}} in this project into its shader-panel field schema. Locate the GLSL source and the fields file (the \`ShaderDevFieldDef[]\` array) in the project.

1. PARSE \u2014 list every \`uniform\` declaration in the GLSL (vertex + fragment), with type and the JS-side literal currently passed for it (that literal is the default).

2. EXCLUDE runtime-driven uniforms \u2014 anything the app updates every frame, not the user: time, resolution, mouse/pointer, camera matrices, scroll, audio. These are NOT panel fields.

3. CROSS-REFERENCE with the existing fields array; only add what's missing. Never modify existing entries.

4. PICK THE FIELD TYPE per uniform:
   - scalar \`float\` / \`int\` \u2192 \`slider\`
   - \`vec3\`/\`vec4\` with a color-ish name (u_bg, *Color, tint, albedo) \u2192 \`color\`
   - \`vec2\` (direction, offset, anchor, scale-xy) \u2192 \`vec2\`
   - \`bool\` \u2192 \`toggle\`
   - \`int\` used as a mode/enum (blendMode, quality, variant) \u2192 \`select\` with explicit { value, label } options
   Honor any GLSL range hints in comments (e.g. \`// 0..10\`).

5. INFER min / max / step from the default's magnitude and meaning:
   - normalized factor (default ~0\u20131) \u2192 min 0, max 1, step 0.01
   - angle in radians \u2192 0 .. 6.2832, step 0.01; in degrees \u2192 0..360, step 1
   - pixel distance/radius \u2192 0 .. ~4\xD7 default, step 1
   - speed/frequency \u2192 0 .. ~4\xD7 default, fine step
   - counts \u2192 integer min/max, step 1
   Keep the current default comfortably inside the range (not at an endpoint).

6. GROUP into \`{ type: "section", title }\` headers inferred from name prefixes (bolt* \u2192 "Lightning", bloom* \u2192 "Bloom", cam*/fov \u2192 "Camera", color/bg \u2192 "Color", etc.).

7. KEEP THE CONFIG TYPE + DEFAULTS IN SYNC with the new fields. If a \`createWebGLAdapter\`/\`createR3FAdapter\` mapping exists, confirm the new keys flow through (or add mapping overrides for non \`u_\${key}\` names).

Show the diff for the fields file, the config type, and DEFAULTS.`
  },
  {
    id: "use-adapters",
    title: "Switch to shader-dev adapters",
    description: "Replace hand-rolled uniform mapping with createWebGL/R3FAdapter.",
    prompt: `Convert the {{shader}} component in this project to use \`createWebGLAdapter\` (raw WebGL / @paper-design/shaders ShaderMount) or \`createR3FAdapter\` (React Three Fiber) from shader-panel instead of its hand-rolled config\u2192uniform mapping.

Requirements:
- Match existing uniform names EXACTLY. The adapters default to \`u_\${key}\`; for any uniform that doesn't follow that, pass per-key overrides via the \`mapping\` option rather than renaming.
- Verify every field type still encodes correctly: \`color\` \u2192 hex\u2192vec3 (rgb 0\u20131) via the adapter's built-in conversion; \`vec2\` \u2192 the [x,y] tuple (or \`.set(x,y)\` on a THREE.Vector2 for R3F); \`toggle\` \u2192 int 0/1 (or bool \u2014 match what the GLSL expects); \`slider\`/\`select\` \u2192 passthrough.
- For R3F, build the adapter once (\`useMemo(() => createR3FAdapter({ uniforms, fields }), [uniforms])\`) and call \`apply(config)\` in a \`useEffect([config, apply])\`. It mutates uniform \`.value\` slots in place \u2014 no recompile, no new uniforms object.
- For ShaderMount / raw WebGL, build \`const toUniforms = createWebGLAdapter({ fields })\` once and call \`mount.setUniforms(toUniforms(config))\` on config change.
- Delete the now-dead hand-rolled mapping function and its imports.

Show the diff and confirm a visual no-op (output identical before/after).`
  }
];

// src/lib/cn.ts
function cn(...inputs) {
  return inputs.filter(Boolean).join(" ");
}

// src/hooks/animation-clock.ts
var PANEL_ANIMATION_STEP = 1 / 30;
var playing = true;
var time = 0;
var rate = 1;
var revision = 0;
var rafId = 0;
var lastRafAt = 0;
var cachedRevision = -1;
var cachedSnapshot = {
  playing: true,
  time: 0,
  rate: 1
};
var listeners = /* @__PURE__ */ new Set();
function notify() {
  revision += 1;
  for (const listener of listeners) listener();
}
function tick(now) {
  if (!playing) return;
  const dt = (now - lastRafAt) / 1e3;
  lastRafAt = now;
  if (dt > 0 && dt < 0.5) {
    time += dt * rate;
    notify();
  }
  rafId = requestAnimationFrame(tick);
}
function ensureLoop() {
  if (typeof requestAnimationFrame === "undefined") return;
  if (rafId !== 0) return;
  lastRafAt = performance.now();
  rafId = requestAnimationFrame(tick);
}
function stopLoop() {
  if (rafId !== 0) cancelAnimationFrame(rafId);
  rafId = 0;
}
function playPanelAnimation() {
  if (playing) return;
  playing = true;
  lastRafAt = performance.now();
  notify();
  ensureLoop();
}
function pausePanelAnimation() {
  if (!playing) return;
  playing = false;
  stopLoop();
  notify();
}
function stepPanelAnimationForward(step = PANEL_ANIMATION_STEP) {
  time += step;
  notify();
}
function stepPanelAnimationBackward(step = PANEL_ANIMATION_STEP) {
  time = Math.max(0, time - step);
  notify();
}
function resetPanelAnimation() {
  time = 0;
  notify();
}
function getPanelAnimationSnapshot() {
  if (revision !== cachedRevision) {
    cachedRevision = revision;
    cachedSnapshot = { playing, time, rate };
  }
  return cachedSnapshot;
}
function getPanelAnimationRevision() {
  return revision;
}
function subscribePanelAnimation(listener) {
  listeners.add(listener);
  if (playing) ensureLoop();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopLoop();
  };
}
function initPanelAnimationClock() {
  if (playing) ensureLoop();
}
function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 1e3);
  return `${whole}.${frac.toString().padStart(3, "0")}s`;
}
function ControlAnimation({
  className,
  step = PANEL_ANIMATION_STEP
}) {
  useEffect(() => {
    initPanelAnimationClock();
  }, []);
  useSyncExternalStore(
    subscribePanelAnimation,
    getPanelAnimationRevision,
    () => 0
  );
  const snapshot = getPanelAnimationSnapshot();
  const togglePlay = useCallback(() => {
    if (snapshot.playing) pausePanelAnimation();
    else playPanelAnimation();
  }, [snapshot.playing]);
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-animation", className), children: [
    /* @__PURE__ */ jsx("div", { className: "panel-animation-label", children: "Animation" }),
    /* @__PURE__ */ jsxs("div", { className: "panel-animation-row", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn",
          onClick: () => stepPanelAnimationBackward(step),
          "aria-label": "Step backward one frame",
          title: "Step back",
          children: /* @__PURE__ */ jsx(StepBackIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn panel-animation-btn-primary",
          onClick: togglePlay,
          "aria-label": snapshot.playing ? "Pause animation" : "Play animation",
          title: snapshot.playing ? "Pause" : "Play",
          children: snapshot.playing ? /* @__PURE__ */ jsx(PauseIcon, {}) : /* @__PURE__ */ jsx(PlayIcon, {})
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn",
          onClick: () => stepPanelAnimationForward(step),
          "aria-label": "Step forward one frame",
          title: "Step forward",
          children: /* @__PURE__ */ jsx(StepForwardIcon, {})
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "panel-animation-time", "aria-live": "polite", children: formatTime(snapshot.time) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-animation-btn panel-animation-btn-reset",
          onClick: resetPanelAnimation,
          "aria-label": "Reset animation time",
          title: "Reset to 0",
          children: /* @__PURE__ */ jsx(ResetIcon, {})
        }
      )
    ] })
  ] });
}
function PlayIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M5 4.98951C5 4.01835 5 3.53277 5.20249 3.2651C5.37889 3.03191 5.64852 2.88761 5.9404 2.87018C6.27544 2.85017 6.67946 3.11953 7.48752 3.65823L18.0031 10.6686C18.6708 11.1137 19.0046 11.3363 19.1209 11.6168C19.2227 11.8621 19.2227 12.1377 19.1209 12.383C19.0046 12.6635 18.6708 12.886 18.0031 13.3312L7.48752 20.3415C6.67946 20.8802 6.27544 21.1496 5.9404 21.1296C5.64852 21.1122 5.37889 20.9679 5.20249 20.7347C5 20.467 5 19.9814 5 19.0103V4.98951Z" })
    }
  );
}
function PauseIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M8 5v14" }),
        /* @__PURE__ */ jsx("path", { d: "M16 5v14" })
      ]
    }
  );
}
function StepBackIcon() {
  return /* @__PURE__ */ jsx(SkipIcon, { direction: "back" });
}
function StepForwardIcon() {
  return /* @__PURE__ */ jsx(SkipIcon, { direction: "forward" });
}
function SkipIcon({ direction }) {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      style: direction === "back" ? { transform: "scaleX(-1)" } : void 0,
      children: [
        /* @__PURE__ */ jsx("path", { d: "M13 16.437C13 17.567 13 18.1321 13.2283 18.4091C13.4266 18.6497 13.7258 18.7841 14.0374 18.7724C14.3961 18.759 14.8184 18.3836 15.663 17.6329L20.6547 13.1958C21.12 12.7822 21.3526 12.5754 21.4383 12.3312C21.5136 12.1168 21.5136 11.8831 21.4383 11.6687C21.3526 11.4245 21.12 11.2177 20.6547 10.8041L15.663 6.36706C14.8184 5.61631 14.3961 5.24093 14.0374 5.22751C13.7258 5.21584 13.4266 5.35021 13.2283 5.59086C13 5.86787 13 6.43288 13 7.56291V16.437Z" }),
        /* @__PURE__ */ jsx("path", { d: "M2 16.437C2 17.567 2 18.1321 2.22827 18.4091C2.42657 18.6497 2.72579 18.7841 3.0374 18.7724C3.39609 18.759 3.81839 18.3836 4.66298 17.6329L9.65466 13.1958C10.12 12.7822 10.3526 12.5754 10.4383 12.3312C10.5136 12.1168 10.5136 11.8831 10.4383 11.6687C10.3526 11.4245 10.12 11.2177 9.65466 10.8041L4.66298 6.36706C3.81839 5.61631 3.39609 5.24093 3.0374 5.22751C2.72579 5.21584 2.42657 5.35021 2.22827 5.59086C2 5.86787 2 6.43288 2 7.56291V16.437Z" })
      ]
    }
  );
}
function ResetIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M13 22L10 19M10 19L13 16M10 19H15C18.866 19 22 15.866 22 12C22 9.2076 20.3649 6.7971 18 5.67363M6 18.3264C3.63505 17.2029 2 14.7924 2 12C2 8.13401 5.13401 5 9 5H14M14 5L11 2M14 5L11 8" })
    }
  );
}

// src/lib/png-dpi.ts
var PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
var crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}
function crc32(bytes) {
  const table = getCrcTable();
  let crc = 4294967295;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = table[(crc ^ bytes[i]) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
}
function readChunkType(data, offset) {
  return String.fromCharCode(
    data[offset],
    data[offset + 1],
    data[offset + 2],
    data[offset + 3]
  );
}
function isPng(data) {
  if (data.length < PNG_SIGNATURE.length) return false;
  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    if (data[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}
function createPhysChunk(dpi) {
  const ppm = Math.max(1, Math.round(dpi / 0.0254));
  const chunkData = new Uint8Array(9);
  const view = new DataView(chunkData.buffer);
  view.setUint32(0, ppm, false);
  view.setUint32(4, ppm, false);
  chunkData[8] = 1;
  const type = new TextEncoder().encode("pHYs");
  const crcInput = new Uint8Array(type.length + chunkData.length);
  crcInput.set(type, 0);
  crcInput.set(chunkData, type.length);
  const out = new Uint8Array(4 + 4 + chunkData.length + 4);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, chunkData.length, false);
  out.set(type, 4);
  out.set(chunkData, 8);
  outView.setUint32(8 + chunkData.length, crc32(crcInput), false);
  return out;
}
async function embedPngDpi(blob, dpi) {
  if (!Number.isFinite(dpi) || dpi <= 0) return blob;
  const input = new Uint8Array(await blob.arrayBuffer());
  if (!isPng(input)) return blob;
  const chunks = [];
  let offset = PNG_SIGNATURE.length;
  let inserted = false;
  while (offset + 8 <= input.length) {
    const view = new DataView(input.buffer, input.byteOffset + offset);
    const length = view.getUint32(0, false);
    const type = readChunkType(input, offset + 4);
    const total = 12 + length;
    if (offset + total > input.length) break;
    const chunk = input.slice(offset, offset + total);
    if (type === "pHYs") {
      offset += total;
      continue;
    }
    chunks.push(chunk);
    if (!inserted && type === "IHDR") {
      chunks.push(createPhysChunk(dpi));
      inserted = true;
    }
    offset += total;
  }
  if (!inserted) return blob;
  const out = new Uint8Array(
    PNG_SIGNATURE.length + chunks.reduce((sum, c) => sum + c.length, 0)
  );
  out.set(PNG_SIGNATURE, 0);
  let write = PNG_SIGNATURE.length;
  for (const chunk of chunks) {
    out.set(chunk, write);
    write += chunk.length;
  }
  return new Blob([out], { type: "image/png" });
}
function printMaxEdgePx(widthInches, heightInches, dpi) {
  return Math.max(
    Math.round(widthInches * dpi),
    Math.round(heightInches * dpi)
  );
}

// src/hooks/capture-registry.ts
var current = null;
var recording = false;
var recordingContinuous = false;
var recordingListeners = /* @__PURE__ */ new Set();
function notifyRecordingListeners(next) {
  recording = next;
  if (!next) recordingContinuous = false;
  const opts = { continuous: recordingContinuous };
  for (const listener of recordingListeners) listener(next, opts);
}
function getShaderCapture() {
  return current;
}
function setShaderRecording(active, opts) {
  const nextContinuous = active ? !!opts?.continuous : false;
  if (recording === active && recordingContinuous === nextContinuous) return;
  recordingContinuous = nextContinuous;
  notifyRecordingListeners(active);
}

// src/lib/webcodecs-mp4-recorder.ts
var TARGET_FPS = 60;
var FRAME_DURATION = 1 / TARGET_FPS;
function evenDimension(n) {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}
function bitrateForCanvas(width, height) {
  const megapixels = width * height / 1e6;
  return Math.round(
    Math.min(8e7, Math.max(24e6, megapixels * 12e6))
  );
}
async function canRecordWebCodecsMp4(width, height) {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    return await canEncodeVideo("avc", {
      width: evenDimension(width),
      height: evenDimension(height)
    });
  } catch {
    return false;
  }
}
async function startWebCodecsMp4Recording(canvas) {
  const width = evenDimension(canvas.width);
  const height = evenDimension(canvas.height);
  if (width < 2 || height < 2) {
    throw new Error("Canvas has no dimensions yet");
  }
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target
  });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    bitrate: bitrateForCanvas(width, height),
    latencyMode: "realtime",
    keyFrameInterval: 1,
    sizeChangeBehavior: "passThrough"
  });
  output.addVideoTrack(videoSource);
  await output.start();
  let lastTimestamp = -FRAME_DURATION;
  let frameCount = 0;
  let capturing = true;
  let aborted = false;
  let rafId2 = 0;
  let loopPromise = Promise.resolve();
  const startedAt = performance.now();
  const paintHostFrame = async () => {
    return;
  };
  const captureOne = async () => {
    if (aborted || !capturing) return;
    await paintHostFrame();
    if (aborted || !capturing) return;
    const timestamp = Math.max(
      lastTimestamp + FRAME_DURATION * 0.5,
      (performance.now() - startedAt) / 1e3
    );
    const duration = Math.max(FRAME_DURATION * 0.5, timestamp - lastTimestamp);
    lastTimestamp = timestamp;
    frameCount += 1;
    try {
      await videoSource.add(timestamp, duration);
    } catch {
    }
  };
  const pump = () => {
    if (!capturing || aborted) return;
    loopPromise = captureOne().finally(() => {
      if (!capturing || aborted) return;
      rafId2 = requestAnimationFrame(pump);
    });
  };
  rafId2 = requestAnimationFrame(pump);
  return {
    stop: async () => {
      if (aborted) return new Blob([], { type: "video/mp4" });
      capturing = false;
      cancelAnimationFrame(rafId2);
      await loopPromise;
      const endTimestamp = Math.max(
        lastTimestamp + FRAME_DURATION,
        (performance.now() - startedAt) / 1e3
      );
      if (frameCount === 0) {
        await paintHostFrame();
        await videoSource.add(0, Math.max(FRAME_DURATION, endTimestamp));
      } else if (endTimestamp > lastTimestamp + FRAME_DURATION * 0.25) {
        try {
          await paintHostFrame();
          await videoSource.add(
            endTimestamp,
            Math.max(FRAME_DURATION, endTimestamp - lastTimestamp)
          );
        } catch {
        }
      }
      await output.finalize();
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error("Recording was empty");
      }
      return new Blob([buffer], { type: "video/mp4" });
    },
    abort: async () => {
      aborted = true;
      capturing = false;
      cancelAnimationFrame(rafId2);
      try {
        await output.cancel();
      } catch {
      }
    }
  };
}
var EXPORT_DPI = 300;
var GIF_DURATION_OPTIONS = [2, 3, 5, 8];
var GIF_FPS_OPTIONS = [10, 12, 15];
var GIF_DEFAULT_DURATION_SEC = 3;
var GIF_DEFAULT_FPS = 12;
var GIF_RES_PRESETS = [
  { label: "720", maxEdge: 720 },
  { label: "1080", maxEdge: 1080 },
  { label: "1440", maxEdge: 1440 }
];
var GIF_DEFAULT_RES_INDEX = 0;
var SCREEN_RES_PRESETS = [
  { label: "4K", maxEdge: 3840 },
  { label: "8K", maxEdge: 7680 },
  { label: "16K", maxEdge: 15360 }
];
var PRINT_RES_PRESETS = [
  {
    label: "8\u2033",
    maxEdge: printMaxEdgePx(8, 4.5, EXPORT_DPI),
    printHint: `8\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "11\u2033",
    maxEdge: printMaxEdgePx(11, 8.5, EXPORT_DPI),
    printHint: `11\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "16\u2033",
    maxEdge: printMaxEdgePx(16, 9, EXPORT_DPI),
    printHint: `16\u2033 @ ${EXPORT_DPI}dpi`
  },
  {
    label: "24\u2033",
    maxEdge: printMaxEdgePx(24, 13.5, EXPORT_DPI),
    printHint: `24\u2033 @ ${EXPORT_DPI}dpi`
  }
];
var RES_PRESETS = [
  ...SCREEN_RES_PRESETS,
  ...PRINT_RES_PRESETS
];
async function withExportDpi(blob) {
  return embedPngDpi(blob, EXPORT_DPI);
}
function findShaderCanvas() {
  let best = null;
  let bestArea = 0;
  for (const c of Array.from(document.querySelectorAll("canvas"))) {
    const area = c.width * c.height;
    if (area > bestArea) {
      best = c;
      bestArea = area;
    }
  }
  return best;
}
async function canvasToPngBlob(canvas) {
  const w = window;
  try {
    if (typeof canvas.captureStream === "function" && w.ImageCapture) {
      const stream = canvas.captureStream();
      const track = stream.getVideoTracks()[0];
      if (track) {
        const cap = new w.ImageCapture(track);
        const bitmap = await cap.grabFrame();
        track.stop();
        const off = document.createElement("canvas");
        off.width = bitmap.width;
        off.height = bitmap.height;
        off.getContext("2d")?.drawImage(bitmap, 0, 0);
        const blob2 = await new Promise(
          (res) => off.toBlob(res, "image/png")
        );
        if (blob2 && blob2.size > 0) return blob2;
      }
    }
  } catch {
  }
  const blob = await new Promise(
    (res) => canvas.toBlob(res, "image/png")
  );
  if (!blob) throw new Error("Could not read the canvas");
  return blob;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4e3);
}
function pickMediaRecorderFormat() {
  const candidates = [
    "video/mp4;codecs=avc1.640028",
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c)) {
        return { mimeType: c, ext: c.startsWith("video/mp4") ? "mp4" : "webm" };
      }
    }
  }
  return { mimeType: "video/mp4", ext: "mp4" };
}
function videoBitrateForCanvas(canvas) {
  const megapixels = canvas.width * canvas.height / 1e6;
  return Math.round(
    Math.min(8e7, Math.max(24e6, megapixels * 12e6))
  );
}
function fileBase(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "shader";
  const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${slug}-${stamp}`;
}
function extensionForVideoBlob(blob) {
  const type = blob.type.toLowerCase();
  if (type.includes("quicktime") || type.includes("mov")) return "mov";
  if (type.includes("webm")) return "webm";
  return "mp4";
}
function presetExportLabel(preset) {
  return preset.printHint ?? preset.label;
}
async function waitForCompositeReady() {
  return new Promise((resolve) => {
    const started = performance.now();
    const tick2 = () => {
      const canvas = findShaderCanvas();
      if (canvas && (canvas.width > 2)) {
        requestAnimationFrame(
          () => requestAnimationFrame(() => resolve(canvas))
        );
        return;
      }
      if (performance.now() - started > 5e3) {
        resolve(canvas);
        return;
      }
      requestAnimationFrame(tick2);
    };
    requestAnimationFrame(tick2);
  });
}
function ControlExport({ name = "shader" }) {
  const [status, setStatus] = useState(null);
  const [recording2, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [resIndex, setResIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gifBusy, setGifBusy] = useState(false);
  const [gifDurationSec, setGifDurationSec] = useState(
    GIF_DEFAULT_DURATION_SEC
  );
  const [gifFps, setGifFps] = useState(GIF_DEFAULT_FPS);
  const [gifResIndex, setGifResIndex] = useState(GIF_DEFAULT_RES_INDEX);
  const mediaRecorderRef = useRef(null);
  const webCodecsRef = useRef(null);
  const hostVideoRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stoppingRef = useRef(false);
  const flash = useCallback((msg, ms = 2400) => {
    setStatus(msg);
    window.setTimeout(() => setStatus((s) => s === msg ? null : s), ms);
  }, []);
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  const finishUi = useCallback(() => {
    setShaderRecording(false, { continuous: false });
    clearTimer();
    setRecording(false);
    setElapsed(0);
    stoppingRef.current = false;
  }, [clearTimer]);
  const copyImage = useCallback(async () => {
    setBusy(true);
    try {
      const preset = RES_PRESETS[resIndex];
      const exportLabel = presetExportLabel(preset);
      const capture = getShaderCapture();
      if (capture) ;
      const canvas = findShaderCanvas();
      if (!canvas) return flash("No shader canvas found");
      const blob = await withExportDpi(await canvasToPngBlob(canvas));
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        flash(`Image copied (${EXPORT_DPI} DPI)`);
      } catch {
        downloadBlob(blob, `${fileBase(name)}-${EXPORT_DPI}dpi.png`);
        flash("Clipboard blocked \u2014 downloaded PNG");
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Image export failed");
    } finally {
      setBusy(false);
    }
  }, [flash, name, resIndex]);
  const saveImage = useCallback(async () => {
    setBusy(true);
    try {
      const preset = RES_PRESETS[resIndex];
      const exportLabel = presetExportLabel(preset);
      const capture = getShaderCapture();
      if (capture) ;
      const canvas = findShaderCanvas();
      if (!canvas) return flash("No shader canvas found");
      const blob = await withExportDpi(await canvasToPngBlob(canvas));
      downloadBlob(blob, `${fileBase(name)}-${EXPORT_DPI}dpi.png`);
      flash(`PNG downloaded (${EXPORT_DPI} DPI)`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Image export failed");
    } finally {
      setBusy(false);
    }
  }, [flash, name, resIndex]);
  const startMediaRecorderFallback = useCallback(
    (canvas) => {
      if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
        flash("Recording not supported here");
        setShaderRecording(false, { continuous: false });
        return;
      }
      setShaderRecording(true, { continuous: true });
      const stream = canvas.captureStream(60);
      streamRef.current = stream;
      const { mimeType, ext } = pickMediaRecorderFormat();
      const videoBitsPerSecond = videoBitrateForCanvas(canvas);
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
      } catch {
        try {
          rec = new MediaRecorder(stream, { videoBitsPerSecond });
        } catch {
          rec = new MediaRecorder(stream);
        }
      }
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        finishUi();
        if (blob.size > 0) {
          downloadBlob(blob, `${fileBase(name)}.${ext}`);
          flash(`Video saved (.${ext})`);
        } else {
          flash("Recording was empty");
        }
      };
      mediaRecorderRef.current = rec;
      rec.start(1e3);
      setRecording(true);
      const startedAt = performance.now();
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        setElapsed((performance.now() - startedAt) / 1e3);
      }, 100);
    },
    [finishUi, flash, name]
  );
  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const host = hostVideoRef.current;
    if (host) {
      hostVideoRef.current = null;
      clearTimer();
      setRecording(false);
      flash("Encoding video\u2026", 6e4);
      try {
        const blob = await host.stop();
        finishUi();
        if (blob.size > 0) {
          const ext = extensionForVideoBlob(blob);
          downloadBlob(blob, `${fileBase(name)}.${ext}`);
          flash(`Video saved (.${ext})`);
        } else {
          flash("Recording was empty");
        }
      } catch (e) {
        finishUi();
        flash(e instanceof Error ? e.message : "Video encode failed");
      }
      return;
    }
    const web = webCodecsRef.current;
    if (web) {
      webCodecsRef.current = null;
      setShaderRecording(false, { continuous: false });
      clearTimer();
      setRecording(false);
      flash("Encoding MP4\u2026", 6e4);
      try {
        const blob = await web.stop();
        finishUi();
        if (blob.size > 0) {
          downloadBlob(blob, `${fileBase(name)}.mp4`);
          flash("Video saved (.mp4)");
        } else {
          flash("Recording was empty");
        }
      } catch (e) {
        finishUi();
        flash(e instanceof Error ? e.message : "MP4 encode failed");
      }
      return;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      return;
    }
    finishUi();
  }, [clearTimer, finishUi, flash, name]);
  const startRecording = useCallback(async () => {
    setShaderRecording(true, { continuous: false });
    const canvas = await waitForCompositeReady();
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      setShaderRecording(false, { continuous: false });
      return flash("No shader canvas found");
    }
    const useWebCodecs = await canRecordWebCodecsMp4(
      canvas.width,
      canvas.height
    );
    if (useWebCodecs) {
      try {
        webCodecsRef.current = await startWebCodecsMp4Recording(canvas);
        setRecording(true);
        const startedAt = performance.now();
        setElapsed(0);
        timerRef.current = window.setInterval(() => {
          setElapsed((performance.now() - startedAt) / 1e3);
        }, 100);
        return;
      } catch (e) {
        webCodecsRef.current = null;
        flash(
          e instanceof Error ? `WebCodecs failed \u2014 falling back (${e.message})` : "WebCodecs failed \u2014 falling back",
          3200
        );
      }
    }
    startMediaRecorderFallback(canvas);
  }, [flash, startMediaRecorderFallback]);
  const exportGif = useCallback(async () => {
    {
      return flash("GIF export not available");
    }
  }, [flash, gifDurationSec, gifFps, gifResIndex, name]);
  useEffect(() => {
    return () => {
      const host = hostVideoRef.current;
      if (host) {
        hostVideoRef.current = null;
        void host.stop().catch(() => {
        });
      }
      const web = webCodecsRef.current;
      if (web) {
        webCodecsRef.current = null;
        void web.abort();
      }
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
      clearTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [clearTimer]);
  const controlsLocked = busy || gifBusy || recording2;
  return /* @__PURE__ */ jsxs("div", { className: "panel-export", children: [
    /* @__PURE__ */ jsx("div", { className: "panel-export-label", children: "Export" }),
    /* @__PURE__ */ jsxs("div", { className: "panel-export-row", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: copyImage,
          disabled: controlsLocked,
          children: "Copy image"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: saveImage,
          disabled: controlsLocked,
          children: busy ? "Rendering\u2026" : "Save PNG"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      "div",
      {
        className: "panel-export-res-group",
        role: "group",
        "aria-label": "PNG resolution",
        children: [
          /* @__PURE__ */ jsx("div", { className: "panel-export-res panel-export-res-screen", children: SCREEN_RES_PRESETS.map((preset, i) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cn(
                "panel-export-res-btn",
                i === resIndex && "panel-export-res-active"
              ),
              "aria-pressed": i === resIndex,
              title: `${preset.maxEdge}px longest edge \xB7 ${EXPORT_DPI} DPI metadata`,
              onClick: () => setResIndex(i),
              disabled: controlsLocked,
              children: preset.label
            },
            preset.label
          )) }),
          /* @__PURE__ */ jsx("div", { className: "panel-export-res panel-export-res-print", children: PRINT_RES_PRESETS.map((preset, i) => {
            const index = SCREEN_RES_PRESETS.length + i;
            return /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: cn(
                  "panel-export-res-btn",
                  index === resIndex && "panel-export-res-active"
                ),
                "aria-pressed": index === resIndex,
                title: preset.printHint ?? `${preset.maxEdge}px longest edge \xB7 ${EXPORT_DPI} DPI metadata`,
                onClick: () => setResIndex(index),
                disabled: controlsLocked,
                children: preset.label
              },
              preset.label
            );
          }) })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: cn("panel-action-btn", recording2 && "panel-export-rec"),
        onClick: recording2 ? () => void stopRecording() : () => void startRecording(),
        disabled: gifBusy || busy,
        children: recording2 ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("span", { className: "panel-export-dot" }),
          " Stop recording \xB7",
          " ",
          elapsed.toFixed(1),
          "s"
        ] }) : "Record video"
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "panel-export-gif", children: [
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-label", children: "GIF" }),
      /* @__PURE__ */ jsx(
        "div",
        {
          className: "panel-export-gif-row",
          role: "group",
          "aria-label": "GIF resolution",
          children: GIF_RES_PRESETS.map((preset, i) => /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: cn(
                "panel-export-res-btn",
                i === gifResIndex && "panel-export-res-active"
              ),
              "aria-pressed": i === gifResIndex,
              title: `${preset.maxEdge}px longest edge`,
              onClick: () => setGifResIndex(i),
              disabled: controlsLocked,
              children: preset.label
            },
            preset.label
          ))
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-row", role: "group", "aria-label": "GIF duration", children: GIF_DURATION_OPTIONS.map((sec) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: cn(
            "panel-export-res-btn",
            gifDurationSec === sec && "panel-export-res-active"
          ),
          "aria-pressed": gifDurationSec === sec,
          onClick: () => setGifDurationSec(sec),
          disabled: controlsLocked,
          children: [
            sec,
            "s"
          ]
        },
        sec
      )) }),
      /* @__PURE__ */ jsx("div", { className: "panel-export-gif-row", role: "group", "aria-label": "GIF frame rate", children: GIF_FPS_OPTIONS.map((fps) => /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: cn(
            "panel-export-res-btn",
            gifFps === fps && "panel-export-res-active"
          ),
          "aria-pressed": gifFps === fps,
          onClick: () => setGifFps(fps),
          disabled: controlsLocked,
          children: [
            fps,
            " fps"
          ]
        },
        fps
      )) }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-action-btn",
          onClick: () => void exportGif(),
          disabled: controlsLocked,
          children: gifBusy ? "Rendering GIF\u2026" : `Export GIF \xB7 ${GIF_RES_PRESETS[gifResIndex]?.label ?? "720"}p \xB7 ${gifDurationSec}s @ ${gifFps}fps`
        }
      )
    ] }),
    status ? /* @__PURE__ */ jsx("div", { className: "panel-status", children: status }) : null
  ] });
}
function ControlSection({
  title,
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  className,
  onReset
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const controlled = openProp !== void 0;
  const open = controlled ? openProp : uncontrolledOpen;
  const setOpen = (next) => {
    if (controlled) onOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  const toggle = () => setOpen(!open);
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-panel-open": open ? "true" : "false",
      className: cn("panel-section", className),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-section-header", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-button",
              onClick: toggle,
              "aria-expanded": open,
              children: /* @__PURE__ */ jsx("span", { className: "panel-section-title", children: title })
            }
          ),
          onReset ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-reset",
              onClick: onReset,
              "aria-label": `Reset ${title} to defaults`,
              title: `Reset ${title}`,
              children: /* @__PURE__ */ jsx(ResetIcon2, {})
            }
          ) : null,
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-section-caret-btn",
              onClick: toggle,
              "aria-label": open ? "Collapse section" : "Expand section",
              tabIndex: -1,
              children: /* @__PURE__ */ jsx(CaretIcon, {})
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "panel-collapse", "data-panel-open": open ? "true" : "false", children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-section-children", children }) }) })
      ]
    }
  );
}
function CaretIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-section-caret",
      fill: "none",
      stroke: "currentColor",
      viewBox: "0 0 24 24",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx(
        "path",
        {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: 2,
          d: "M19 9l-7 7-7-7"
        }
      )
    }
  );
}
function ResetIcon2() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }),
        /* @__PURE__ */ jsx("path", { d: "M3 3v5h5" })
      ]
    }
  );
}
function ControlQuickActions({
  title = "AI prompts",
  prompts,
  shaderName,
  className,
  defaultOpen = false
}) {
  const [expanded, setExpanded] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const resolved = useMemo(
    () => prompts.map((p) => ({
      ...p,
      prompt: fillPanelPrompt(p.prompt, shaderName)
    })),
    [prompts, shaderName]
  );
  const copy = useCallback((p) => {
    void navigator.clipboard.writeText(p.prompt);
    setCopiedId(p.id);
    window.setTimeout(() => {
      setCopiedId((id) => id === p.id ? null : id);
    }, 1400);
  }, []);
  if (resolved.length === 0) return null;
  return /* @__PURE__ */ jsx(
    ControlSection,
    {
      title,
      defaultOpen,
      className: cn("panel-quick-section", className),
      children: resolved.map((p) => {
        const isOpen = expanded === p.id;
        const isCopied = copiedId === p.id;
        return /* @__PURE__ */ jsx(
          PromptRow,
          {
            prompt: p,
            isOpen,
            isCopied,
            onToggle: () => setExpanded(isOpen ? null : p.id),
            onCopy: () => copy(p)
          },
          p.id
        );
      })
    }
  );
}
function PromptRow({
  prompt,
  isOpen,
  isCopied,
  onToggle,
  onCopy
}) {
  return /* @__PURE__ */ jsxs("div", { className: "panel-prompt", "data-panel-open": isOpen ? "true" : "false", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        className: "panel-prompt-toggle",
        onClick: onToggle,
        "aria-expanded": isOpen,
        children: [
          /* @__PURE__ */ jsx("span", { className: "panel-prompt-label", children: prompt.title }),
          /* @__PURE__ */ jsx(CaretIcon2, {})
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-collapse",
        "data-panel-open": isOpen ? "true" : "false",
        "aria-hidden": !isOpen,
        children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-prompt-preview", children: [
          prompt.description ? /* @__PURE__ */ jsx("div", { className: "panel-prompt-desc", children: prompt.description }) : null,
          /* @__PURE__ */ jsxs("div", { className: "panel-prompt-code-wrap", children: [
            /* @__PURE__ */ jsx("pre", { className: "panel-prompt-pre", children: prompt.prompt }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "panel-prompt-copy",
                onClick: onCopy,
                "aria-label": isCopied ? "Copied" : "Copy prompt",
                title: isCopied ? "Copied" : "Copy prompt",
                children: isCopied ? /* @__PURE__ */ jsx(CheckIcon, {}) : /* @__PURE__ */ jsx(CopyIcon, {})
              }
            )
          ] })
        ] }) })
      }
    )
  ] });
}
function CaretIcon2() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-prompt-caret",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M19 9l-7 7-7-7" })
    }
  );
}
function CopyIcon() {
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: [
        /* @__PURE__ */ jsx("rect", { x: "9", y: "9", width: "11", height: "11", rx: "2" }),
        /* @__PURE__ */ jsx("path", { d: "M5 15V5a2 2 0 0 1 2-2h10" })
      ]
    }
  );
}
function CheckIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M5 12l5 5 9-12" })
    }
  );
}
function ControlAction({
  label,
  description,
  onClick,
  disabled = false,
  variant = "default",
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-action-field", className), children: [
    description ? /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: description }) : null,
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: cn(
          "panel-action-btn",
          variant === "primary" && "panel-action-btn-primary",
          variant === "destructive" && "panel-action-btn-destructive"
        ),
        disabled,
        onClick,
        children: label
      }
    )
  ] });
}
function PanelCloseButton({
  onClick,
  ariaLabel,
  size = "md",
  disabled,
  className,
  title
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      className: cn("panel-close-btn", className),
      "data-panel-size": size,
      "aria-label": ariaLabel,
      title,
      disabled,
      onClick,
      children: /* @__PURE__ */ jsx(PanelCloseIcon, {})
    }
  );
}
function PanelCloseIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M6 6l12 12M18 6L6 18" })
    }
  );
}
function singular(label) {
  if (/ies$/i.test(label)) return label.replace(/ies$/i, "y");
  if (/ses$/i.test(label)) return label.replace(/es$/i, "");
  if (/s$/i.test(label)) return label.replace(/s$/i, "");
  return label;
}
var idCounter = 0;
function makeId() {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
  }
  idCounter += 1;
  return `item-${Date.now().toString(36)}-${idCounter}`;
}
function ControlCollection({
  field,
  items,
  onChange,
  renderContext,
  onSelect,
  className
}) {
  const multiOpen = field.multiOpen ?? false;
  const reorderable = field.reorderable ?? true;
  const canRemove = items.length > (field.min ?? 0);
  const canAdd = field.newItem != null && (field.max == null || items.length < field.max);
  const [openIds, setOpenIds] = useState(/* @__PURE__ */ new Set());
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const liveOnSelect = useRef(onSelect);
  liveOnSelect.current = onSelect;
  const setOpen = useCallback(
    (id, open) => {
      setOpenIds((prev) => {
        if (multiOpen) {
          const next2 = new Set(prev);
          if (open) next2.add(id);
          else next2.delete(id);
          return next2;
        }
        const next = open ? /* @__PURE__ */ new Set([id]) : /* @__PURE__ */ new Set();
        liveOnSelect.current?.(open ? id : null);
        return next;
      });
    },
    [multiOpen]
  );
  const replaceItem = useCallback(
    (index, nextItem) => {
      const next = items.slice();
      next[index] = nextItem;
      onChange(next);
    },
    [items, onChange]
  );
  const removeItem = useCallback(
    (index) => {
      const removed = items[index];
      const next = items.slice();
      next.splice(index, 1);
      onChange(next);
      if (removed) setOpen(removed.id, false);
    },
    [items, onChange, setOpen]
  );
  const addItem = useCallback(() => {
    if (!field.newItem) return;
    const made = field.newItem();
    const item = made && typeof made.id === "string" && made.id ? made : { ...made, id: makeId() };
    onChange([...items, item]);
    setOpen(item.id, true);
  }, [field, items, onChange, setOpen]);
  const moveItem = useCallback(
    (from, to) => {
      if (from === to || from < 0 || to < 0) return;
      const next = items.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [items, onChange]
  );
  return /* @__PURE__ */ jsxs("div", { className: `panel-collection${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-collection-header", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-collection-title", children: field.label }),
      /* @__PURE__ */ jsx("span", { className: "panel-collection-count", children: items.length }),
      field.newItem ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-collection-add",
          disabled: !canAdd,
          onClick: addItem,
          children: field.addLabel ?? `Add ${singular(field.label)}`
        }
      ) : null
    ] }),
    field.description ? /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: field.description }) : null,
    /* @__PURE__ */ jsxs("div", { className: "panel-collection-items", children: [
      items.map((item, index) => {
        const open = openIds.has(item.id);
        const title = field.itemLabel ? field.itemLabel(item, index) : `${field.label} ${index + 1}`;
        const itemFields = typeof field.itemFields === "function" ? field.itemFields(item, index) : field.itemFields;
        const setItem = (next) => replaceItem(index, next);
        const rendered = [];
        if (open) {
          for (const f of itemFields) {
            if (f.type === "section") continue;
            const out = renderPanelField(f, {
              ...renderContext,
              values: item,
              setValues: setItem
            });
            if (out) rendered.push(out);
          }
        }
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "panel-collection-row",
            "data-panel-open": open ? "true" : "false",
            "data-panel-dragging": dragIndex === index ? "true" : "false",
            "data-panel-dragover": overIndex === index ? "true" : "false",
            onDragOver: reorderable && dragIndex != null ? (e) => {
              e.preventDefault();
              setOverIndex(index);
            } : void 0,
            onDrop: reorderable && dragIndex != null ? (e) => {
              e.preventDefault();
              moveItem(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            } : void 0,
            children: [
              /* @__PURE__ */ jsxs("div", { className: "panel-collection-row-head", children: [
                reorderable ? /* @__PURE__ */ jsx(
                  "span",
                  {
                    className: "panel-collection-drag",
                    role: "button",
                    tabIndex: -1,
                    "aria-label": "Drag to reorder",
                    draggable: true,
                    onDragStart: (e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragIndex(index);
                    },
                    onDragEnd: () => {
                      setDragIndex(null);
                      setOverIndex(null);
                    },
                    children: /* @__PURE__ */ jsx(DragIcon, {})
                  }
                ) : null,
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    type: "button",
                    className: "panel-collection-row-toggle",
                    "aria-expanded": open,
                    onClick: () => setOpen(item.id, !open),
                    children: [
                      /* @__PURE__ */ jsx("span", { className: "panel-collection-row-label", children: title }),
                      /* @__PURE__ */ jsx(CaretIcon3, {})
                    ]
                  }
                ),
                /* @__PURE__ */ jsx(
                  PanelCloseButton,
                  {
                    className: "panel-collection-remove",
                    ariaLabel: "Remove",
                    size: "sm",
                    disabled: !canRemove,
                    onClick: () => removeItem(index)
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "panel-collapse",
                  "data-panel-open": open ? "true" : "false",
                  "aria-hidden": !open,
                  children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-collection-row-body", children: rendered.map((r) => /* @__PURE__ */ jsx("div", { className: "panel-field", children: r.node }, r.reactKey)) }) })
                }
              )
            ]
          },
          item.id
        );
      }),
      items.length === 0 ? /* @__PURE__ */ jsx("div", { className: "panel-collection-empty", children: "No items" }) : null
    ] })
  ] });
}
function CaretIcon3() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      className: "panel-collection-caret",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M19 9l-7 7-7-7" })
    }
  );
}
function DragIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "18", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "18", r: "1.4" })
  ] });
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function normalizeHex(value) {
  const raw = value.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return "#ffffff";
  return `#${raw.toLowerCase()}`;
}
function channelToHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}
function hexToRgb(hex) {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}
function rgbToHex({ r, g, b }) {
  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}
function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = (gn - bn) / delta % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return {
    h,
    s: max <= 0 ? 0 : delta / max * 100,
    v: max * 100
  };
}
function hsvToRgb({ h, s, v }) {
  const hue = (h % 360 + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const val = clamp(v, 0, 100) / 100;
  const chroma = val * sat;
  const x = chroma * (1 - Math.abs(hue / 60 % 2 - 1));
  const m = val - chroma;
  const [rp, gp, bp] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255
  };
}
function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}
var supportsP3Cache = null;
function supportsDisplayP3() {
  if (supportsP3Cache !== null) return supportsP3Cache;
  supportsP3Cache = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", "color(display-p3 1 1 1)") && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(color-gamut: p3)").matches;
  return supportsP3Cache;
}
function swatchColor(color) {
  return supportsDisplayP3() && color.p3 ? color.p3 : color.hex;
}
var POPOVER_WIDTH = 224;
var POPOVER_MAX_HEIGHT = 420;
var POPOVER_MIN_HEIGHT = 220;
var VIEWPORT_PADDING = 8;
var TRIGGER_GAP = 6;
function placePopover(trigger) {
  const rect = trigger.getBoundingClientRect();
  const vw2 = window.innerWidth;
  const vh2 = window.innerHeight;
  const spaceBelow = vh2 - rect.bottom - TRIGGER_GAP - VIEWPORT_PADDING;
  const spaceAbove = rect.top - TRIGGER_GAP - VIEWPORT_PADDING;
  const up = spaceBelow < POPOVER_MIN_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    POPOVER_MAX_HEIGHT,
    Math.max(POPOVER_MIN_HEIGHT, up ? spaceAbove : spaceBelow)
  );
  const left = clamp(
    rect.left,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, vw2 - POPOVER_WIDTH - VIEWPORT_PADDING)
  );
  return up ? { left, bottom: vh2 - rect.top + TRIGGER_GAP, maxHeight, up } : { left, top: rect.bottom + TRIGGER_GAP, maxHeight, up };
}
function EmbeddedPicker({
  color,
  onChange
}) {
  const hsv = useMemo(() => rgbToHsv(hexToRgb(color)), [color]);
  const saturationRef = useRef(null);
  const hueRef = useRef(null);
  const updateSaturation = useCallback(
    (clientX, clientY) => {
      const rect = saturationRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = clamp((clientX - rect.left) / Math.max(1, rect.width) * 100, 0, 100);
      const v = clamp(
        (1 - (clientY - rect.top) / Math.max(1, rect.height)) * 100,
        0,
        100
      );
      onChange(hsvToHex({ h: hsv.h, s, v }));
    },
    [hsv.h, onChange]
  );
  const updateHue = useCallback(
    (clientX) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = clamp((clientX - rect.left) / Math.max(1, rect.width) * 360, 0, 360);
      onChange(hsvToHex({ ...hsv, h }));
    },
    [hsv, onChange]
  );
  const beginPointerDrag = useCallback(
    (event, update) => {
      event.preventDefault();
      update(event.clientX, event.clientY);
      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        update(moveEvent.clientX, moveEvent.clientY);
      };
      const handleEnd = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleEnd);
        window.removeEventListener("pointercancel", handleEnd);
      };
      window.addEventListener("pointermove", handleMove, { passive: false });
      window.addEventListener("pointerup", handleEnd);
      window.addEventListener("pointercancel", handleEnd);
    },
    []
  );
  return /* @__PURE__ */ jsxs("div", { className: "panel-color-pop-canvas", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        ref: saturationRef,
        role: "slider",
        "aria-label": "Color",
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-valuenow": Math.round(hsv.v),
        "aria-valuetext": `Saturation ${Math.round(hsv.s)}%, Brightness ${Math.round(hsv.v)}%`,
        className: "panel-color-pop-sat",
        style: { backgroundColor: `hsl(${hsv.h}, 100%, 50%)` },
        onPointerDown: (event) => beginPointerDrag(event, updateSaturation),
        children: /* @__PURE__ */ jsx(
          "span",
          {
            className: "panel-color-pop-thumb",
            style: {
              left: `${hsv.s}%`,
              top: `${100 - hsv.v}%`,
              backgroundColor: normalizeHex(color)
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        ref: hueRef,
        role: "slider",
        "aria-label": "Hue",
        "aria-valuemin": 0,
        "aria-valuemax": 360,
        "aria-valuenow": Math.round(hsv.h),
        className: "panel-color-pop-hue",
        onPointerDown: (event) => beginPointerDrag(event, (clientX) => updateHue(clientX)),
        children: /* @__PURE__ */ jsx(
          "span",
          {
            className: "panel-color-pop-thumb panel-color-pop-thumb-hue",
            style: {
              left: `${hsv.h / 360 * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`
            }
          }
        )
      }
    )
  ] });
}
function ColorPopover({
  color,
  onChange,
  library,
  disabled,
  ariaLabel,
  triggerClassName,
  triggerStyle,
  children
}) {
  const hasLibrary = !!library && library.length > 0;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("library");
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const selectedItemRef = useRef(null);
  const listRef = useRef(null);
  const flatColors = useMemo(
    () => (library ?? []).flatMap((group) => group.colors),
    [library]
  );
  const groupOffsets = useMemo(() => {
    const offsets = [];
    let acc = 0;
    for (const group of library ?? []) {
      offsets.push(acc);
      acc += group.colors.length;
    }
    return offsets;
  }, [library]);
  const [highlight, setHighlight] = useState(0);
  const typeahead = useRef({ buffer: "", at: 0 });
  const normalizedColor = normalizeHex(color);
  const [draftColor, setDraftColor] = useState(normalizedColor);
  const [hexDraft, setHexDraft] = useState(normalizedColor.toUpperCase());
  const displayColor = open ? draftColor : normalizedColor;
  const pendingColor = useRef(null);
  const colorRaf = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastSentColor = useRef(normalizedColor);
  useEffect(
    () => () => {
      if (colorRaf.current != null) cancelAnimationFrame(colorRaf.current);
      const pending = pendingColor.current;
      pendingColor.current = null;
      if (pending && pending !== lastSentColor.current) {
        lastSentColor.current = pending;
        onChangeRef.current(pending);
      }
    },
    []
  );
  const updateColor = useCallback((hex) => {
    const next = normalizeHex(hex);
    setDraftColor(next);
    setHexDraft(next.toUpperCase());
    pendingColor.current = next;
    if (colorRaf.current != null) return;
    colorRaf.current = requestAnimationFrame(() => {
      colorRaf.current = null;
      const pending = pendingColor.current;
      pendingColor.current = null;
      if (!pending || pending === lastSentColor.current) return;
      lastSentColor.current = pending;
      onChangeRef.current(pending);
    });
  }, []);
  const commitHexDraft = useCallback(() => {
    const raw = hexDraft.trim().replace(/^#/, "");
    if (!/^[0-9a-fA-F]{6}$/.test(raw)) {
      setHexDraft(displayColor.toUpperCase());
      return;
    }
    updateColor(raw);
  }, [displayColor, hexDraft, updateColor]);
  const handleHexInputKeyDown = useCallback(
    (event) => {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.currentTarget.blur();
      }
      if (event.key === "Escape") {
        setHexDraft(displayColor.toUpperCase());
        event.currentTarget.blur();
      }
    },
    [displayColor]
  );
  useEffect(() => {
    if (pendingColor.current) return;
    lastSentColor.current = normalizedColor;
    setDraftColor(normalizedColor);
    setHexDraft(normalizedColor.toUpperCase());
  }, [normalizedColor]);
  useEffect(() => {
    setHexDraft(displayColor.toUpperCase());
  }, [displayColor]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const openPopover = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setTab("library");
    const selectedFlat = flatColors.findIndex(
      (c) => c.hex.toLowerCase() === normalizedColor
    );
    setHighlight(Math.max(0, selectedFlat));
    setPos(placePopover(trigger));
    setOpen(true);
  }, [flatColors, normalizedColor]);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target))
        return;
      setOpen(false);
    };
    const reposition = () => {
      const trigger = triggerRef.current;
      if (trigger) setPos(placePopover(trigger));
    };
    const onScroll = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      reposition();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);
  const updateListFades = useCallback(() => {
    const sc = listRef.current;
    if (!sc) return;
    sc.dataset.fadeTop = String(sc.scrollTop > 1);
    sc.dataset.fadeBottom = String(sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1);
  }, []);
  const keepHighlightInView = useCallback(
    (index) => {
      const list = listRef.current;
      const el = list?.querySelector(
        `[data-panel-flat-index="${index}"]`
      );
      if (!list || !el) return;
      const listRect = list.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (elRect.top < listRect.top + 8) {
        list.scrollTop += elRect.top - listRect.top - 8;
      } else if (elRect.bottom > listRect.bottom - 8) {
        list.scrollTop += elRect.bottom - listRect.bottom + 8;
      }
      updateListFades();
    },
    [updateListFades]
  );
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      const target = event.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA"))
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }
      if (hasLibrary && (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Tab")) {
        event.preventDefault();
        event.stopPropagation();
        setTab((t) => t === "library" ? "picker" : "library");
        return;
      }
      if (!hasLibrary || tab !== "library" || flatColors.length === 0) return;
      const move = (delta) => {
        const next = (highlight + delta + flatColors.length) % flatColors.length;
        setHighlight(next);
        keepHighlightInView(next);
      };
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        const picked = flatColors[highlight];
        if (picked) {
          updateColor(picked.hex);
          setOpen(false);
        }
        return;
      }
      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.stopPropagation();
        const now = Date.now();
        const t = typeahead.current;
        t.buffer = now - t.at > 500 ? event.key : t.buffer + event.key;
        t.at = now;
        const query = t.buffer.toLowerCase();
        const from = query.length === 1 ? highlight + 1 : highlight;
        for (let step = 0; step < flatColors.length; step++) {
          const i = (from + step) % flatColors.length;
          if (flatColors[i].label.toLowerCase().startsWith(query)) {
            setHighlight(i);
            keepHighlightInView(i);
            return;
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    open,
    tab,
    hasLibrary,
    flatColors,
    highlight,
    keepHighlightInView,
    updateColor
  ]);
  useLayoutEffect(() => {
    if (!open) return;
    const el = popoverRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.transformOrigin = pos?.up ? "left bottom" : "left top";
    el.animate(
      [
        { opacity: 0, transform: "scale(0.6)" },
        { opacity: 1, transform: "scale(1)" }
      ],
      { duration: 200, easing: "cubic-bezier(0.17, 1, 0.32, 1)" }
    );
  }, [open]);
  useEffect(() => {
    if (!open || disabled || tab !== "library") return;
    const frame = requestAnimationFrame(() => {
      const btn = selectedItemRef.current;
      const list = listRef.current;
      if (!btn || !list) return;
      const delta = btn.getBoundingClientRect().top - list.getBoundingClientRect().top;
      list.scrollTop += delta - (list.clientHeight - btn.clientHeight) / 2;
      updateListFades();
    });
    return () => cancelAnimationFrame(frame);
  }, [disabled, displayColor, open, tab, updateListFades]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        ref: triggerRef,
        type: "button",
        disabled,
        "aria-label": ariaLabel,
        "aria-expanded": open,
        className: triggerClassName,
        style: triggerStyle,
        onClick: () => open ? setOpen(false) : openPopover(),
        children
      }
    ),
    open && !disabled && pos ? createPortal(
      /* @__PURE__ */ jsxs(
        "div",
        {
          ref: popoverRef,
          role: "dialog",
          className: "panel-color-pop",
          style: {
            left: pos.left,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight
          },
          children: [
            hasLibrary ? /* @__PURE__ */ jsx("div", { className: "panel-color-pop-tabs", role: "tablist", children: ["library", "picker"].map((value) => /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                role: "tab",
                "aria-selected": tab === value,
                className: "panel-color-pop-tab",
                onClick: () => setTab(value),
                children: value
              },
              value
            )) }) : /* @__PURE__ */ jsx("div", { className: "panel-color-pop-spacer" }),
            !hasLibrary || tab === "picker" ? /* @__PURE__ */ jsxs("div", { className: "panel-color-pop-picker", children: [
              /* @__PURE__ */ jsx(EmbeddedPicker, { color: displayColor, onChange: updateColor }),
              /* @__PURE__ */ jsx("div", { className: "panel-color-pop-hex", children: /* @__PURE__ */ jsx(
                "input",
                {
                  value: hexDraft,
                  onChange: (event) => {
                    const withoutHash = event.target.value.trim().replace(/^#/, "");
                    if (/^[0-9a-fA-F]{0,6}$/.test(withoutHash)) {
                      setHexDraft(
                        withoutHash.length > 0 ? `#${withoutHash.toUpperCase()}` : ""
                      );
                    }
                    if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) {
                      updateColor(withoutHash);
                    }
                  },
                  onPointerDown: (event) => event.stopPropagation(),
                  onClick: (event) => event.stopPropagation(),
                  onKeyDown: handleHexInputKeyDown,
                  onBlur: commitHexDraft,
                  "aria-label": ariaLabel ? `${ariaLabel} hex value` : "Hex color value"
                }
              ) })
            ] }) : /* @__PURE__ */ jsx(
              "div",
              {
                className: "panel-color-pop-list",
                onScroll: updateListFades,
                ref: (node) => {
                  listRef.current = node;
                  if (node) updateListFades();
                },
                children: library?.map((group, groupIndex) => /* @__PURE__ */ jsxs("div", { className: "panel-color-pop-group", children: [
                  /* @__PURE__ */ jsx("span", { className: "panel-color-pop-group-label", children: group.name }),
                  group.colors.map((c, colorIndex) => {
                    const selected = c.hex.toLowerCase() === displayColor;
                    const flatIndex = groupOffsets[groupIndex] + colorIndex;
                    return /* @__PURE__ */ jsxs(
                      "button",
                      {
                        ref: selected ? selectedItemRef : void 0,
                        type: "button",
                        "aria-pressed": selected,
                        "data-panel-flat-index": flatIndex,
                        "data-panel-active": flatIndex === highlight ? "true" : "false",
                        onMouseEnter: () => setHighlight(flatIndex),
                        title: c.oklch ? `${c.oklch} / ${c.p3 ?? c.hex} / fallback ${c.hex.toUpperCase()}` : c.p3 ? `${c.p3} / fallback ${c.hex.toUpperCase()}` : c.hex.toUpperCase(),
                        onClick: () => {
                          updateColor(c.hex);
                          setOpen(false);
                        },
                        className: cn(
                          "panel-color-pop-item",
                          selected && "panel-color-pop-item-selected"
                        ),
                        children: [
                          /* @__PURE__ */ jsx(
                            "span",
                            {
                              className: "panel-color-pop-item-swatch",
                              style: { backgroundColor: swatchColor(c) }
                            }
                          ),
                          /* @__PURE__ */ jsx("span", { className: "panel-color-pop-item-label", children: c.label }),
                          /* @__PURE__ */ jsx("span", { className: "panel-color-pop-item-hex", children: c.hex })
                        ]
                      },
                      `${group.name}-${c.label}`
                    );
                  })
                ] }, group.name))
              }
            )
          ]
        }
      ),
      document.body
    ) : null
  ] });
}
var colorPopoverStyles = `
.panel-color-pop {
  position: fixed;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  width: ${POPOVER_WIDTH}px;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid #2e2e2e;
  background: #1c1c1c;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28), 0 12px 32px rgba(0, 0, 0, 0.32);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: #d4d4d4;
}

.panel-color-pop-tabs {
  display: flex;
  flex: none;
  margin: 8px;
  border-radius: 6px;
  background: #2a2a2a;
  padding: 2px;
}

.panel-color-pop-spacer {
  flex: none;
  height: 8px;
}

.panel-color-pop-tab {
  flex: 1;
  cursor: pointer;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 4px 8px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
  color: #8f8f8f;
  transition: color 150ms ease, background-color 150ms ease;
}

.panel-color-pop-tab:hover { color: #d4d4d4; }

.panel-color-pop-tab[aria-selected="true"] {
  background: #3a3a3a;
  color: #f0f0f0;
}

.panel-color-pop-picker {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: 8px;
  padding: 0 8px 8px;
}

.panel-color-pop-canvas {
  display: flex;
  width: 200px;
  flex-direction: column;
  gap: 12px;
}

.panel-color-pop-sat {
  position: relative;
  height: 164px;
  width: 200px;
  cursor: crosshair;
  touch-action: none;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  padding: 0;
  background-image: linear-gradient(0deg, #000, transparent),
    linear-gradient(90deg, #fff, rgba(255, 255, 255, 0));
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
}

.panel-color-pop-hue {
  position: relative;
  height: 24px;
  width: 200px;
  cursor: ew-resize;
  touch-action: none;
  border: 0;
  border-radius: 0 0 8px 8px;
  padding: 0;
  background: linear-gradient(90deg, red 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, red 100%);
}

.panel-color-pop-thumb {
  pointer-events: none;
  position: absolute;
  height: 28px;
  width: 28px;
  border-radius: 9999px;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  transform: translate(-50%, -50%);
}

.panel-color-pop-thumb-hue { top: 50%; }

.panel-color-pop-hex {
  display: flex;
  align-items: center;
  border: 1px solid #2e2e2e;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: #d4d4d4;
}

.panel-color-pop-hex input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
  font: inherit;
  color: inherit;
  text-transform: uppercase;
}

/* Animatable fade heights for the list's cut-off masks. */
@property --panel-color-pop-fade-top {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

@property --panel-color-pop-fade-bottom {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

/* Full-bleed scroller with its padding inside, thin scrollbar, and fades on
   whichever end is clipped (data-fade-top / data-fade-bottom are set from
   the component's scroll handler). */
.panel-color-pop-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 8px 8px;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 0.25) transparent;
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    black var(--panel-color-pop-fade-top),
    black calc(100% - var(--panel-color-pop-fade-bottom)),
    transparent 100%
  );
  transition:
    --panel-color-pop-fade-top 240ms cubic-bezier(0.22, 1, 0.36, 1),
    --panel-color-pop-fade-bottom 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.panel-color-pop-list[data-fade-top="true"] { --panel-color-pop-fade-top: 32px; }
.panel-color-pop-list[data-fade-bottom="true"] { --panel-color-pop-fade-bottom: 40px; }

.panel-color-pop-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-color-pop-group-label {
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.025em;
  text-transform: uppercase;
  color: #737373;
}

.panel-color-pop-item {
  display: flex;
  cursor: pointer;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  padding: 4px;
  text-align: left;
  font-family: inherit;
  transition: background-color 150ms ease;
}

.panel-color-pop-item:hover,
.panel-color-pop-item[data-panel-active="true"],
.panel-color-pop-item-selected { background: #2a2a2a; }

.panel-color-pop-item-swatch {
  height: 20px;
  width: 20px;
  flex: none;
  border-radius: 4px;
  border: 1px solid #3a3a3a;
}

.panel-color-pop-item-selected .panel-color-pop-item-swatch {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.panel-color-pop-item-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: #d4d4d4;
}

.panel-color-pop-item-hex {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  text-transform: uppercase;
  color: #737373;
}

@media (prefers-reduced-motion: reduce) {
  .panel-color-pop-list,
  .panel-color-pop-tab,
  .panel-color-pop-item { transition: none; }
}
`;
function ControlColorInput({
  label,
  value,
  onChange,
  library,
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-color", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-color-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-color-right", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          value: value.toUpperCase(),
          onChange: (e) => onChange(e.target.value),
          className: "panel-color-text"
        }
      ),
      /* @__PURE__ */ jsx(
        ColorPopover,
        {
          color: value,
          onChange,
          library,
          ariaLabel: `Pick color for ${label}`,
          triggerClassName: "panel-color-swatch",
          triggerStyle: { background: value }
        }
      )
    ] })
  ] });
}

// src/lib/color-library.ts
function normalizeHex2(value) {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : "#000000";
}
function p3ChannelFromHex(hex, start) {
  return (Number.parseInt(hex.slice(start, start + 2), 16) / 255).toFixed(4);
}
function p3CssFromHex(hex) {
  const normalized = normalizeHex2(hex).replace(/^#/, "");
  return `color(display-p3 ${p3ChannelFromHex(normalized, 0)} ${p3ChannelFromHex(normalized, 2)} ${p3ChannelFromHex(normalized, 4)})`;
}
var supportsDisplayP3Cache = null;
function supportsDisplayP3Color() {
  if (supportsDisplayP3Cache !== null) return supportsDisplayP3Cache;
  supportsDisplayP3Cache = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", "color(display-p3 1 1 1)") && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(color-gamut: p3)").matches;
  return supportsDisplayP3Cache;
}
function p3ColorForHex(hex, library) {
  const normalized = normalizeHex2(hex);
  if (library) {
    for (const group of library) {
      for (const color of group.colors) {
        if (color.hex.toLowerCase() === normalized && color.p3) return color.p3;
      }
    }
  }
  return p3CssFromHex(normalized);
}
function cssColorForHex(hex, library) {
  const normalized = normalizeHex2(hex);
  return supportsDisplayP3Color() ? p3ColorForHex(normalized, library) : normalized;
}
function findLibraryColorByHex(hex, library) {
  if (!library) return null;
  const normalized = normalizeHex2(hex);
  for (const group of library) {
    for (const color of group.colors) {
      if (color.hex.toLowerCase() === normalized) {
        return {
          group: group.name,
          label: color.label,
          hex: color.hex,
          token: `${group.name} / ${color.label}`
        };
      }
    }
  }
  return null;
}

// src/lib/gradient.ts
var GRADIENT_STOP_MIN = 1;
var GRADIENT_STOP_MAX = 16;
var GRADIENT_HANDLE_HIT_PX = 26;
var IDW_POWER = 2;
var EPSILON = 1e-12;
var HEX_RE = /^#[0-9a-f]{6}$/i;
var DEFAULT_FAR = "#fea700";
var DEFAULT_NEAR = "#f46021";
var NEW_STOP_PALETTE = [
  "#fea700",
  "#f46021",
  "#f77720",
  "#e92e28",
  "#b33806",
  "#fa4541",
  "#ff8839",
  "#ff89a5",
  "#ffa05b",
  "#b0241f",
  "#ffbb7d",
  "#ff6967",
  "#8a2b01",
  "#ff9a96",
  "#ffb5b6",
  "#882426"
];
function nextPaletteColor(used) {
  const taken = new Set(used.map((hex) => hex.toLowerCase()));
  return NEW_STOP_PALETTE.find((hex) => !taken.has(hex)) ?? NEW_STOP_PALETTE[used.length % NEW_STOP_PALETTE.length] ?? DEFAULT_NEAR;
}
function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function sanitizeHex(value, fallback) {
  if (typeof value === "string" && HEX_RE.test(value)) return value.toLowerCase();
  if (typeof fallback === "string" && HEX_RE.test(fallback))
    return fallback.toLowerCase();
  return DEFAULT_NEAR;
}
function parseHexRgb(hex) {
  const raw = sanitizeHex(hex, DEFAULT_NEAR).slice(1);
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16)
  };
}
var stopIdCounter = 0;
function createGradientStopId() {
  stopIdCounter += 1;
  return `g${stopIdCounter.toString(36)}-${Date.now().toString(36)}`;
}
function defaultGradientStops(colorFar = DEFAULT_FAR, colorNear = DEFAULT_NEAR) {
  return [
    { id: "far", x: 0, y: 0.5, offset: 0, color: sanitizeHex(colorFar, DEFAULT_FAR) },
    { id: "near", x: 1, y: 0.5, offset: 1, color: sanitizeHex(colorNear, DEFAULT_NEAR) }
  ];
}
function sortGradientStops(stops) {
  return [...stops].sort(
    (a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id)
  );
}
function round4(value) {
  return Number(clamp01(value).toFixed(4));
}
function stopFromUnknown(value, index, fallbackColor) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  const rawX = isFiniteNumber(record.x) ? record.x : isFiniteNumber(record.offset) ? record.offset : null;
  if (rawX === null) return null;
  const x = round4(rawX);
  const y = isFiniteNumber(record.y) ? round4(record.y) : 0.5;
  return {
    id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `g${index}`,
    x,
    y,
    offset: x,
    color: sanitizeHex(record.color, fallbackColor)
  };
}
function placeStop(stop, x, y) {
  const px = round4(x);
  return { ...stop, x: px, y: round4(y), offset: px };
}
function normalizeStopList(value, colorFar, colorNear) {
  const far = sanitizeHex(colorFar, DEFAULT_FAR);
  const near = sanitizeHex(colorNear, DEFAULT_NEAR);
  const out = [];
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < value.length; i += 1) {
    const stop = stopFromUnknown(value[i], i, i === 0 ? far : near);
    if (!stop) continue;
    let id = stop.id;
    if (ids.has(id)) id = `${stop.id}-${out.length}`;
    ids.add(id);
    out.push({ ...stop, id });
    if (out.length >= GRADIENT_STOP_MAX) break;
  }
  return out.length < GRADIENT_STOP_MIN ? defaultGradientStops(far, near) : sortGradientStops(out);
}
function serializeGradientStops(stops) {
  return JSON.stringify(
    sortGradientStops(stops).map((stop) => ({
      id: stop.id,
      x: round4(stop.x),
      y: round4(stop.y),
      offset: round4(stop.offset),
      color: stop.color
    }))
  );
}
function normalizeGradientStops(value, colorFar = DEFAULT_FAR, colorNear = DEFAULT_NEAR) {
  if (Array.isArray(value)) return normalizeStopList(value, colorFar, colorNear);
  if (typeof value !== "string" || value.trim() === "")
    return defaultGradientStops(colorFar, colorNear);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeStopList(parsed, colorFar, colorNear) : defaultGradientStops(colorFar, colorNear);
  } catch {
    return defaultGradientStops(colorFar, colorNear);
  }
}
function withFallback(stops) {
  return stops.length > 0 ? [...stops] : defaultGradientStops();
}
function sampleGradientRgb(stops, x, y) {
  const list = withFallback(stops);
  const px = clamp01(x);
  const py = clamp01(y);
  if (list.length === 1) return parseHexRgb(list[0].color);
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (const stop of list) {
    const dx = px - stop.x;
    const dy = py - stop.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= EPSILON) return parseHexRgb(stop.color);
    const w = 1 / distSq ** (IDW_POWER / 2);
    const rgb = parseHexRgb(stop.color);
    r += w * rgb.r;
    g += w * rgb.g;
    b += w * rgb.b;
    weight += w;
  }
  if (weight <= 0) return parseHexRgb(list[0].color);
  return { r: r / weight, g: g / weight, b: b / weight };
}
function gradientCss(stops) {
  return `linear-gradient(90deg, ${sortGradientStops(withFallback(stops)).map((stop) => `${stop.color} ${(stop.offset * 100).toFixed(2)}%`).join(", ")})`;
}
function rasterizeGradientField(stops, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    const v = (row + 0.5) / h;
    for (let col = 0; col < w; col += 1) {
      const rgb = sampleGradientRgb(stops, (col + 0.5) / w, v);
      const at = (row * w + col) * 4;
      pixels[at] = rgb.r;
      pixels[at + 1] = rgb.g;
      pixels[at + 2] = rgb.b;
      pixels[at + 3] = 255;
    }
  }
  return pixels;
}
function openSpot(stops) {
  const candidates = [
    [0.5, 0.5],
    [0.35, 0.35],
    [0.65, 0.65],
    [0.5, 0.22],
    [0.5, 0.78],
    [0.22, 0.5],
    [0.78, 0.5],
    [0.28, 0.72],
    [0.72, 0.28]
  ];
  for (const [x, y] of candidates) {
    if (!stops.some((stop) => Math.hypot(stop.x - x, stop.y - y) < 0.08))
      return { x, y };
  }
  const n = stops.length;
  return {
    x: clamp01(0.12 + n * 0.17 % 0.76),
    y: clamp01(0.18 + n * 0.23 % 0.64)
  };
}
function addGradientStop(stops, x, y, color) {
  if (stops.length >= GRADIENT_STOP_MAX) return [...stops];
  const spot = isFiniteNumber(x) && isFiniteNumber(y) ? { x: clamp01(x), y: clamp01(y) } : openSpot(stops);
  const ink = nextPaletteColor(stops.map((stop) => stop.color));
  return [
    ...stops,
    placeStop(
      {
        id: createGradientStopId(),
        x: spot.x,
        y: spot.y,
        offset: spot.x,
        color: sanitizeHex(ink, DEFAULT_NEAR)
      },
      spot.x,
      spot.y
    )
  ];
}
function removeGradientStop(stops, id) {
  if (stops.length <= GRADIENT_STOP_MIN) return [...stops];
  const next = stops.filter((stop) => stop.id !== id);
  return next.length < GRADIENT_STOP_MIN ? [...stops] : next;
}
function moveGradientStop(stops, id, x, y) {
  return stops.map((stop) => stop.id === id ? placeStop(stop, x, y) : stop);
}
function moveGradientStopOffset(stops, id, offset) {
  return stops.map(
    (stop) => stop.id === id ? placeStop(stop, offset, stop.y) : stop
  );
}
function recolorGradientStop(stops, id, color) {
  return stops.map(
    (stop) => stop.id === id ? { ...stop, color: sanitizeHex(color, stop.color) } : stop
  );
}
function offsetFromClientX(clientX, bounds) {
  return bounds.width <= 0 ? 0 : clamp01((clientX - bounds.left) / bounds.width);
}
function gradientFieldClientPlane(bounds, viewWidth, viewHeight, pad) {
  return {
    left: bounds.left + pad / viewWidth * bounds.width,
    top: bounds.top + pad / viewHeight * bounds.height,
    width: (viewWidth - pad * 2) / viewWidth * bounds.width,
    height: (viewHeight - pad * 2) / viewHeight * bounds.height
  };
}
function nearestGradientStopIdPx(stops, clientX, clientY, plane, thresholdPx = GRADIENT_HANDLE_HIT_PX) {
  if (stops.length === 0 || plane.width <= 0 || plane.height <= 0) return null;
  let bestId = null;
  let bestDist = thresholdPx;
  for (const stop of stops) {
    const sx = plane.left + stop.x * plane.width;
    const sy = plane.top + stop.y * plane.height;
    const dist = Math.hypot(clientX - sx, clientY - sy);
    if (dist <= bestDist) {
      bestDist = dist;
      bestId = stop.id;
    }
  }
  return bestId;
}
function NativeColorSwatch({
  color,
  onChange,
  disabled,
  ariaLabel,
  triggerClassName,
  triggerStyle
}) {
  const hiddenRef = useRef(null);
  const openPicker = () => {
    const input = hiddenRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
    }
    input.click();
  };
  return /* @__PURE__ */ jsxs("span", { className: "panel-gradient-swatch-wrap", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: triggerClassName,
        style: triggerStyle,
        disabled,
        "aria-label": ariaLabel,
        onClick: openPicker
      }
    ),
    /* @__PURE__ */ jsx(
      "input",
      {
        ref: hiddenRef,
        type: "color",
        value: /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#000000",
        onChange: (e) => onChange(e.target.value),
        className: "panel-gradient-swatch-native",
        tabIndex: -1,
        "aria-hidden": "true"
      }
    )
  ] });
}
var GRAPH_WIDTH = 168;
var GRAPH_HEIGHT = 120;
var GRAPH_PAD = 12;
var FIELD_PREVIEW_WIDTH = 144;
var FIELD_PREVIEW_HEIGHT = 96;
function normalizeHexDisplay(value) {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}
function clamp012(value) {
  return Math.min(1, Math.max(0, value));
}
function graphUvFromClient(clientX, clientY, bounds) {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  const svgX = (clientX - bounds.left) / bounds.width * GRAPH_WIDTH;
  const svgY = (clientY - bounds.top) / bounds.height * GRAPH_HEIGHT;
  return {
    x: clamp012((svgX - GRAPH_PAD) / (GRAPH_WIDTH - GRAPH_PAD * 2)),
    y: clamp012((svgY - GRAPH_PAD) / (GRAPH_HEIGHT - GRAPH_PAD * 2))
  };
}
function PlusIcon() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: 11,
      height: 11,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
    }
  );
}
function CloseIcon({ size = 11 }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" })
    }
  );
}
function ControlGradientStops({
  stops,
  onChange,
  disabled = false,
  layout = "field",
  label,
  library,
  renderColorPopover,
  className
}) {
  const graphRef = useRef(null);
  const fieldRef = useRef(null);
  const dragId = useRef(null);
  const pendingStops = useRef(null);
  const rafId2 = useRef(null);
  const lastSent = useRef(null);
  const [draftStops, setDraftStops] = useState(null);
  const [selectedId, setSelectedId] = useState(
    stops[0]?.id ?? null
  );
  const displayed = draftStops ?? stops;
  const displayedIds = displayed.map((stop) => stop.id).join(",");
  useEffect(() => {
    if (selectedId && displayed.some((stop) => stop.id === selectedId)) return;
    setSelectedId(displayed[0]?.id ?? null);
  }, [displayed, displayedIds, selectedId]);
  useEffect(() => {
    if (layout !== "field") return;
    const canvas = fieldRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const pixels = rasterizeGradientField(
      displayed,
      FIELD_PREVIEW_WIDTH,
      FIELD_PREVIEW_HEIGHT
    );
    const image = context.createImageData(
      FIELD_PREVIEW_WIDTH,
      FIELD_PREVIEW_HEIGHT
    );
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }, [displayed, displayedIds, layout]);
  useEffect(
    () => () => {
      if (rafId2.current != null) cancelAnimationFrame(rafId2.current);
    },
    []
  );
  const selected = displayed.find((stop) => stop.id === selectedId) ?? displayed[0] ?? null;
  const canAdd = !disabled && displayed.length < GRADIENT_STOP_MAX;
  const canRemove = !disabled && displayed.length > GRADIENT_STOP_MIN && !!selected;
  const flush = (next) => {
    const serialized = serializeGradientStops(next);
    if (serialized === lastSent.current) return;
    lastSent.current = serialized;
    onChange(next);
  };
  const scheduleFlush = (next) => {
    pendingStops.current = next;
    if (rafId2.current != null) return;
    rafId2.current = requestAnimationFrame(() => {
      rafId2.current = null;
      const pending = pendingStops.current;
      pendingStops.current = null;
      if (pending) flush(pending);
    });
  };
  const commit = (next, immediate = false) => {
    if (dragId.current && !immediate) {
      setDraftStops(next);
      scheduleFlush(next);
      return;
    }
    setDraftStops(null);
    flush(next);
  };
  const pointerUv = (event) => {
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return graphUvFromClient(event.clientX, event.clientY, bounds);
  };
  const nearestHandleId = (event) => {
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    if (layout === "ramp") {
      let bestId = null;
      let bestDist = 14;
      for (const stop of displayed) {
        const x = bounds.left + stop.offset * bounds.width;
        const dist = Math.abs(event.clientX - x);
        if (dist <= bestDist) {
          bestDist = dist;
          bestId = stop.id;
        }
      }
      return bestId;
    }
    const plane = gradientFieldClientPlane(
      bounds,
      GRAPH_WIDTH,
      GRAPH_HEIGHT,
      GRAPH_PAD
    );
    return nearestGradientStopIdPx(
      displayed,
      event.clientX,
      event.clientY,
      plane,
      GRADIENT_HANDLE_HIT_PX
    );
  };
  const beginDrag = (event, id) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = id;
    setSelectedId(id);
    setDraftStops([...displayed]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerDown = (event) => {
    if (disabled) return;
    const nearId = nearestHandleId(event);
    if (nearId) {
      beginDrag(event, nearId);
      return;
    }
    if (!canAdd) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = graphRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const next = layout === "ramp" ? addGradientStop(
      displayed,
      offsetFromClientX(event.clientX, bounds),
      0.5
    ) : (() => {
      const uv = graphUvFromClient(event.clientX, event.clientY, bounds);
      return addGradientStop(displayed, uv.x, uv.y);
    })();
    const created = next.find(
      (stop) => !displayed.some((existing) => existing.id === stop.id)
    );
    if (created) {
      setSelectedId(created.id);
      dragId.current = created.id;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    commit(next);
  };
  const handlePointerMove = (event) => {
    if (disabled || !dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    const uv = pointerUv(event);
    if (!uv) return;
    if (layout === "ramp") {
      const bounds = graphRef.current?.getBoundingClientRect();
      if (!bounds) return;
      commit(
        moveGradientStopOffset(
          displayed,
          dragId.current,
          offsetFromClientX(event.clientX, bounds)
        )
      );
      return;
    }
    commit(moveGradientStop(displayed, dragId.current, uv.x, uv.y));
  };
  const endDrag = (event) => {
    if (!dragId.current) return;
    event.preventDefault();
    event.stopPropagation();
    dragId.current = null;
    if (rafId2.current != null) {
      cancelAnimationFrame(rafId2.current);
      rafId2.current = null;
    }
    const pending = pendingStops.current ?? draftStops;
    pendingStops.current = null;
    if (pending) commit(pending, true);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const colorMeta = selected ? (() => {
    const match = findLibraryColorByHex(selected.color, library);
    return {
      name: match?.token ?? "Custom",
      code: normalizeHexDisplay(selected.color)
    };
  })() : { name: "", code: "" };
  const popoverProps = selected ? {
    color: selected.color,
    onChange: (hex) => commit(recolorGradientStop(displayed, selected.id, hex), true),
    disabled,
    ariaLabel: layout === "ramp" ? "Selected gradient stop color" : "Selected color hotspot",
    triggerClassName: "panel-gradient-swatch",
    triggerStyle: {
      "--panel-gradient-swatch-color": cssColorForHex(
        selected.color,
        library
      )
    },
    align: "right"
  } : null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "panel-gradient-editor",
        disabled && "is-disabled",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-gradient-header", children: [
          /* @__PURE__ */ jsx("span", { className: "panel-gradient-title", children: label ?? (layout === "ramp" ? "Ramp" : "Field") }),
          /* @__PURE__ */ jsxs("div", { className: "panel-gradient-actions", children: [
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                className: "panel-gradient-action",
                disabled: !canAdd,
                "aria-label": layout === "ramp" ? "Add gradient stop" : "Add color hotspot",
                onClick: () => {
                  if (!canAdd) return;
                  const next = layout === "ramp" ? addGradientStop(displayed, 0.5, 0.5) : addGradientStop(displayed);
                  const created = next.find(
                    (stop) => !displayed.some((existing) => existing.id === stop.id)
                  );
                  if (created) setSelectedId(created.id);
                  commit(next, true);
                },
                children: [
                  /* @__PURE__ */ jsx(PlusIcon, {}),
                  "Add"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              "button",
              {
                type: "button",
                className: "panel-gradient-action",
                disabled: !canRemove,
                "aria-label": layout === "ramp" ? "Remove selected gradient stop" : "Remove selected color hotspot",
                onClick: () => {
                  if (!selected || !canRemove) return;
                  commit(removeGradientStop(displayed, selected.id), true);
                },
                children: [
                  /* @__PURE__ */ jsx(CloseIcon, {}),
                  "Remove"
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            ref: graphRef,
            className: cn(
              "panel-gradient-graph",
              layout === "ramp" && "is-ramp",
              !disabled && "is-editable"
            ),
            "aria-label": layout === "ramp" ? "Gradient color stops" : "Gradient color hotspots",
            onPointerDown: handlePointerDown,
            onPointerMove: handlePointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            children: layout === "ramp" ? /* @__PURE__ */ jsxs("div", { className: "panel-gradient-track", children: [
              /* @__PURE__ */ jsx(
                "div",
                {
                  className: "panel-gradient-fill",
                  style: { background: gradientCss(displayed) }
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "panel-gradient-baseline" }),
              displayed.map((stop) => /* @__PURE__ */ jsx(
                "div",
                {
                  className: cn(
                    "panel-gradient-handle is-ramp",
                    stop.id === selected?.id && "is-selected"
                  ),
                  style: {
                    left: `${stop.offset * 100}%`,
                    backgroundColor: stop.color
                  },
                  "aria-label": `Gradient stop at ${Math.round(stop.offset * 100)} percent`
                },
                stop.id
              ))
            ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
              /* @__PURE__ */ jsx(
                "canvas",
                {
                  ref: fieldRef,
                  className: "panel-gradient-field",
                  width: FIELD_PREVIEW_WIDTH,
                  height: FIELD_PREVIEW_HEIGHT,
                  "aria-hidden": "true"
                }
              ),
              /* @__PURE__ */ jsxs(
                "svg",
                {
                  className: "panel-gradient-plane",
                  viewBox: `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`,
                  preserveAspectRatio: "none",
                  "aria-hidden": "true",
                  children: [
                    /* @__PURE__ */ jsx(
                      "line",
                      {
                        x1: GRAPH_PAD,
                        y1: GRAPH_HEIGHT - GRAPH_PAD,
                        x2: GRAPH_WIDTH - GRAPH_PAD,
                        y2: GRAPH_HEIGHT - GRAPH_PAD
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      "line",
                      {
                        x1: GRAPH_PAD,
                        y1: GRAPH_PAD,
                        x2: GRAPH_PAD,
                        y2: GRAPH_HEIGHT - GRAPH_PAD
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsx("div", { className: "panel-gradient-handles", children: displayed.map((stop) => {
                const selectedStop = stop.id === selected?.id;
                return /* @__PURE__ */ jsx(
                  "div",
                  {
                    className: cn(
                      "panel-gradient-handle",
                      selectedStop && "is-selected"
                    ),
                    style: {
                      left: `${stop.x * 100}%`,
                      top: `${stop.y * 100}%`,
                      backgroundColor: stop.color
                    },
                    "aria-label": `Color hotspot at ${Math.round(stop.x * 100)} percent, ${Math.round(stop.y * 100)} percent`
                  },
                  stop.id
                );
              }) })
            ] })
          }
        ),
        selected && popoverProps ? /* @__PURE__ */ jsxs("div", { className: "panel-gradient-selected", children: [
          renderColorPopover ? renderColorPopover(popoverProps) : /* @__PURE__ */ jsx(NativeColorSwatch, { ...popoverProps }),
          /* @__PURE__ */ jsxs("div", { className: "panel-gradient-selected-meta", children: [
            /* @__PURE__ */ jsx("span", { className: "panel-gradient-selected-name", children: colorMeta.name }),
            /* @__PURE__ */ jsxs("span", { className: "panel-gradient-selected-code", children: [
              "[",
              colorMeta.code,
              "]"
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "panel-gradient-selected-offset", children: layout === "ramp" ? `${Math.round(selected.offset * 100)}%` : `${Math.round(selected.x * 100)}% \xB7 ${Math.round(selected.y * 100)}%` })
        ] }) : null
      ]
    }
  );
}
function displayValueForHex(hex, library) {
  if (!hex) return "";
  const match = findLibraryColorByHex(hex, library);
  return match ? match.token : hex.toUpperCase();
}
function normalizeNullableHex(value) {
  if (value === null || value === void 0 || value === "") return null;
  const raw = typeof value === "string" ? value.trim() : "";
  const withoutHash = raw.replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(withoutHash)) return `#${withoutHash.toLowerCase()}`;
  return null;
}
function ControlLibraryColor({
  label,
  value,
  onChange,
  library,
  allowClear = false,
  placeholder,
  disabled = false,
  renderColorPopover,
  className
}) {
  const color = normalizeNullableHex(value);
  const libraryMatch = color ? findLibraryColorByHex(color, library) : null;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => displayValueForHex(color, library));
  useEffect(() => {
    if (focused) return;
    setDraft(displayValueForHex(color, library));
  }, [color, focused, library]);
  const updateColor = (hex) => {
    const next = normalizeNullableHex(hex);
    if (next === null) return;
    onChange(next);
  };
  const commitDraft = () => {
    const next = normalizeNullableHex(draft);
    if (next) {
      updateColor(next);
      setFocused(false);
      setDraft(displayValueForHex(next, library));
      return;
    }
    setFocused(false);
    setDraft(displayValueForHex(color, library));
  };
  const handleInputKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(
        focused && color ? color.toUpperCase() : displayValueForHex(color, library)
      );
      event.currentTarget.blur();
    }
  };
  const swatchColor2 = color ?? "#000000";
  const popoverProps = {
    color: swatchColor2,
    onChange: updateColor,
    disabled,
    ariaLabel: `${label} color`,
    triggerClassName: "panel-gradient-swatch",
    triggerStyle: {
      "--panel-gradient-swatch-color": cssColorForHex(swatchColor2, library),
      "--panel-gradient-swatch-image": color ? "none" : "linear-gradient(45deg, #d6d6d6 25%, transparent 25%), linear-gradient(-45deg, #d6d6d6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d6d6 75%), linear-gradient(-45deg, transparent 75%, #d6d6d6 75%)"
    },
    align: "right"
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "panel-gradient-library",
        allowClear && color && "has-clear",
        className
      ),
      "aria-label": label,
      children: [
        renderColorPopover ? renderColorPopover(popoverProps) : /* @__PURE__ */ jsx(NativeColorSwatch, { ...popoverProps }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: cn(
              "panel-gradient-library-value",
              libraryMatch && !focused && "is-token"
            ),
            value: draft,
            placeholder: placeholder ?? (allowClear ? "Transparent" : "#RRGGBB"),
            disabled,
            spellCheck: false,
            inputMode: "text",
            title: color ? color.toUpperCase() : void 0,
            "aria-label": libraryMatch ? `${label} ${libraryMatch.token}` : `${label} hex value`,
            onPointerDown: (event) => event.stopPropagation(),
            onClick: (event) => event.stopPropagation(),
            onFocus: () => {
              setFocused(true);
              setDraft(color ? color.toUpperCase() : "");
            },
            onKeyDown: handleInputKeyDown,
            onChange: (event) => {
              const raw = event.target.value.trim();
              const withoutHash = raw.replace(/^#/, "");
              if (withoutHash.length === 0) {
                setDraft("");
                return;
              }
              if (!/^[0-9a-fA-F]{0,6}$/.test(withoutHash)) return;
              const nextDraft = `#${withoutHash.toUpperCase()}`;
              setDraft(nextDraft);
              if (withoutHash.length === 6) updateColor(nextDraft);
            },
            onBlur: commitDraft
          }
        ),
        allowClear && color ? /* @__PURE__ */ jsx(
          PanelCloseButton,
          {
            className: "panel-gradient-library-clear",
            ariaLabel: "Clear color",
            size: "sm",
            onClick: () => onChange(null),
            disabled
          }
        ) : null
      ]
    }
  );
}
var gradientStopsStyles = `
.panel-gradient-editor {
  display: grid;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 2px 0 6px;
  font-size: 11px;
  color: var(--panel-text);
}

.panel-gradient-editor.is-disabled {
  pointer-events: none;
  opacity: 0.45;
}

.panel-gradient-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-gradient-title {
  color: var(--panel-text-muted);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.panel-gradient-actions {
  display: flex;
  gap: 4px;
}

button.panel-gradient-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 22px;
  padding: 0 12px;
  border: 0;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-text-muted);
  font: inherit;
  font-size: 11px;
  text-align: center;
  cursor: pointer;
}

button.panel-gradient-action:not(:disabled):hover,
button.panel-gradient-action:not(:disabled):focus-visible {
  background: var(--panel-surface-active);
  color: var(--panel-text);
  outline: none;
}

button.panel-gradient-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.panel-gradient-graph {
  position: relative;
  width: 100%;
  height: 120px;
  box-sizing: border-box;
  border-radius: 4px;
  background: var(--panel-surface);
  touch-action: none;
  user-select: none;
  overflow: visible;
}

.panel-gradient-graph.is-ramp {
  height: 56px;
  padding: 8px 8px 0;
}

.panel-gradient-graph.is-editable {
  cursor: crosshair;
}

.panel-gradient-track {
  position: relative;
  width: 100%;
  height: 100%;
  touch-action: none;
}

.panel-gradient-fill {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 30px;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: inset 0 0 0 1px var(--panel-swatch-border);
}

.panel-gradient-baseline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  height: 1px;
  background: var(--panel-hash);
  pointer-events: none;
}

.panel-gradient-field {
  position: absolute;
  left: calc(12 / 168 * 100%);
  top: calc(12 / 120 * 100%);
  width: calc(144 / 168 * 100%);
  height: calc(96 / 120 * 100%);
  border-radius: 2px;
  pointer-events: none;
  image-rendering: auto;
}

.panel-gradient-plane {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.panel-gradient-graph line {
  stroke: var(--panel-hash);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.panel-gradient-handles {
  position: absolute;
  left: calc(12 / 168 * 100%);
  top: calc(12 / 120 * 100%);
  width: calc(144 / 168 * 100%);
  height: calc(96 / 120 * 100%);
  pointer-events: none;
}

.panel-gradient-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border-radius: 999px;
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgb(0 0 0 / 45%);
  transform: translate(-50%, -50%);
  cursor: grab;
}

.panel-gradient-handle.is-selected {
  width: 20px;
  height: 20px;
  border-width: 4px;
  border-color: #fff;
}

.panel-gradient-handle.is-ramp {
  top: auto;
  bottom: 4px;
  width: 12px;
  height: 12px;
  transform: translate(-50%, 0);
}

.panel-gradient-handle.is-ramp.is-selected {
  width: 14px;
  height: 14px;
  border-width: 3px;
}

.panel-gradient-selected {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.panel-gradient-selected-meta {
  display: grid;
  min-width: 0;
}

.panel-gradient-selected-name,
.panel-gradient-selected-code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-gradient-selected-name {
  color: var(--panel-text);
}

.panel-gradient-selected-code,
.panel-gradient-selected-offset {
  color: var(--panel-text-muted);
  font-variant-numeric: tabular-nums;
}

.panel-gradient-swatch-wrap {
  display: inline-flex;
  position: relative;
}

.panel-gradient-swatch-native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

button.panel-gradient-swatch {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: 1px solid var(--panel-swatch-border);
  border-radius: 4px;
  box-shadow: none;
  cursor: pointer;
  background-color: var(--panel-gradient-swatch-color, #000000);
  background-image: var(--panel-gradient-swatch-image, none);
  background-position:
    0 0,
    0 6px,
    6px -6px,
    -6px 0;
  background-size: 12px 12px;
}

.panel-gradient-library {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: 24px;
  font-size: 11px;
}

.panel-gradient-library.has-clear {
  grid-template-columns: 24px minmax(0, 1fr) 18px;
}

.panel-gradient-library-value {
  display: block;
  min-width: 0;
  width: 100%;
  height: 24px;
  border: 0;
  border-radius: 4px;
  background-color: var(--panel-surface);
  color: var(--panel-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 10px;
  line-height: 24px;
  padding: 0 8px;
  outline: none;
  box-sizing: border-box;
  text-transform: uppercase;
}

.panel-gradient-library-value.is-token {
  text-transform: none;
  font-family: inherit;
  letter-spacing: 0.01em;
}

.panel-gradient-library-value::placeholder {
  color: var(--panel-muted-icon);
  text-transform: none;
}

.panel-gradient-library-value:focus {
  box-shadow: inset 0 0 0 1px var(--panel-text-muted);
}

/* Layout only \u2014 look comes from the shared .panel-close-btn. */
.panel-gradient-library-clear {
  justify-self: end;
}
`;
function ControlImageInput({
  label,
  value,
  onChange,
  readonly = false,
  accept = "image/*",
  emptyLabel,
  className
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [aspect, setAspect] = useState(null);
  const interactive = !readonly && !!onChange;
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    onChange?.(URL.createObjectURL(file));
  };
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-image", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-image-head", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-image-label", children: label }),
      interactive ? /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-image-upload",
          onClick: () => inputRef.current?.click(),
          children: "Upload"
        }
      ) : null
    ] }),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-image-frame",
        style: value && aspect ? (
          // Frame at the image's natural aspect; the img inside renders at
          // 75% so it floats clear of the frame edges.
          { aspectRatio: `${aspect}` }
        ) : void 0,
        "data-panel-interactive": interactive ? "true" : "false",
        "data-panel-drag": dragOver ? "true" : "false",
        role: interactive ? "button" : void 0,
        tabIndex: interactive ? 0 : void 0,
        "aria-label": interactive ? `Upload image for ${label}` : label,
        onClick: interactive ? () => inputRef.current?.click() : void 0,
        onKeyDown: interactive ? (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        } : void 0,
        onDragOver: interactive ? (e) => {
          e.preventDefault();
          setDragOver(true);
        } : void 0,
        onDragLeave: interactive ? () => setDragOver(false) : void 0,
        onDrop: interactive ? (e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        } : void 0,
        children: value ? /* @__PURE__ */ jsx(
          "img",
          {
            src: value,
            alt: label,
            className: "panel-image-preview",
            draggable: false,
            onLoad: (e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setAspect(img.naturalWidth / img.naturalHeight);
              }
            }
          }
        ) : /* @__PURE__ */ jsx("span", { className: "panel-image-empty", children: emptyLabel ?? (readonly ? "\u2014" : "Click or drop an image") })
      }
    ),
    interactive ? /* @__PURE__ */ jsx(
      "input",
      {
        ref: inputRef,
        type: "file",
        accept,
        className: "panel-image-native",
        tabIndex: -1,
        "aria-hidden": "true",
        onChange: (e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }
      }
    ) : null
  ] });
}

// src/lib/drawer-state.ts
var CONTROL_DRAWER_STATE_KEY = "tjcages-panels-control-drawers-v1";
function readControlDrawerState() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CONTROL_DRAWER_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function writeControlDrawerState(state) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTROL_DRAWER_STATE_KEY, JSON.stringify(state));
  } catch {
  }
}
function loadControlDrawerOpen(id, defaultOpen = false) {
  const state = readControlDrawerState();
  return typeof state[id] === "boolean" ? state[id] : defaultOpen;
}
function saveControlDrawerOpen(id, open) {
  const state = readControlDrawerState();
  state[id] = open;
  writeControlDrawerState(state);
}

// src/lib/easing.ts
var EASING_OPTIONS = {
  Linear: "linear",
  Ease: "ease",
  "Ease-in": "easeIn",
  "Ease-out": "easeOut",
  "Ease-in-out": "easeInOut",
  "Ease In Sine": "easeInSine",
  "Ease Out Sine": "easeOutSine",
  "Ease In Out Sine": "easeInOutSine",
  "Ease In Quad": "easeInQuad",
  "Ease Out Quad": "easeOutQuad",
  "Ease In Out Quad": "easeInOutQuad",
  "Ease In Cubic": "easeInCubic",
  "Ease Out Cubic": "easeOutCubic",
  "Ease In Out Cubic": "easeInOutCubic",
  "Ease In Quart": "easeInQuart",
  "Ease Out Quart": "easeOutQuart",
  "Ease In Out Quart": "easeInOutQuart",
  "Ease In Quint": "easeInQuint",
  "Ease Out Quint": "easeOutQuint",
  "Ease In Out Quint": "easeInOutQuint",
  "Ease In Expo": "easeInExpo",
  "Ease Out Expo": "easeOutExpo",
  "Ease In Out Expo": "easeInOutExpo",
  "Ease In Circ": "easeInCirc",
  "Ease Out Circ": "easeOutCirc",
  "Ease In Out Circ": "easeInOutCirc",
  "Ease In Back": "easeInBack",
  "Ease Out Back": "easeOutBack",
  "Ease In Out Back": "easeInOutBack",
  "Ease In Elastic": "easeInElastic",
  "Ease Out Elastic": "easeOutElastic",
  "Ease In Out Elastic": "easeInOutElastic",
  "Ease In Bounce": "easeInBounce",
  "Ease Out Bounce": "easeOutBounce",
  "Ease In Out Bounce": "easeInOutBounce"
};
var DEFAULT_CUSTOM_EASING = {
  x1: 0.42,
  y1: 0,
  x2: 0.58,
  y2: 1
};
function formatCustomEasing({
  x1,
  y1,
  x2,
  y2
}) {
  const format = (value) => Number(clamp013(value).toFixed(3)).toString();
  return `custom:${format(x1)},${format(y1)},${format(x2)},${format(y2)}`;
}
function parseCustomEasing(value) {
  if (!value?.startsWith("custom:")) return null;
  const parts = value.slice("custom:".length).split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return {
    x1: clamp013(parts[0] ?? DEFAULT_CUSTOM_EASING.x1),
    y1: clamp013(parts[1] ?? DEFAULT_CUSTOM_EASING.y1),
    x2: clamp013(parts[2] ?? DEFAULT_CUSTOM_EASING.x2),
    y2: clamp013(parts[3] ?? DEFAULT_CUSTOM_EASING.y2)
  };
}
function clamp013(value) {
  return Math.min(1, Math.max(0, value));
}
function cubicBezierValue(p1x, p1y, p2x, p2y, v) {
  const sample = (a1, a2, t2) => {
    const inv = 1 - t2;
    return 3 * inv * inv * t2 * a1 + 3 * inv * t2 * t2 * a2 + t2 * t2 * t2;
  };
  const derivative = (a1, a2, t2) => 3 * (1 - t2) * (1 - t2) * a1 + 6 * (1 - t2) * t2 * (a2 - a1) + 3 * t2 * t2 * (1 - a2);
  let t = v;
  for (let i = 0; i < 6; i++) {
    const xAtT = sample(p1x, p2x, t) - v;
    const slope = derivative(p1x, p2x, t);
    if (Math.abs(xAtT) < 1e-5 || slope === 0) break;
    t = clamp013(t - xAtT / slope);
  }
  return sample(p1y, p2y, t);
}
function easeValue(t, easing) {
  const x = clamp013(t);
  const custom = parseCustomEasing(easing);
  if (custom)
    return clamp013(
      cubicBezierValue(custom.x1, custom.y1, custom.x2, custom.y2, x)
    );
  const c1 = 1.70158;
  const c2 = c1 * 1.525;
  const c3 = c1 + 1;
  const c4 = 2 * Math.PI / 3;
  const c5 = 2 * Math.PI / 4.5;
  const easeOutBounce = (v) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (v < 1 / d1) return n1 * v * v;
    if (v < 2 / d1) {
      const shifted2 = v - 1.5 / d1;
      return n1 * shifted2 * shifted2 + 0.75;
    }
    if (v < 2.5 / d1) {
      const shifted2 = v - 2.25 / d1;
      return n1 * shifted2 * shifted2 + 0.9375;
    }
    const shifted = v - 2.625 / d1;
    return n1 * shifted * shifted + 0.984375;
  };
  let eased;
  switch (easing) {
    case "ease":
      eased = cubicBezierValue(0.25, 0.1, 0.25, 1, x);
      break;
    case "easeIn":
      eased = cubicBezierValue(0.42, 0, 1, 1, x);
      break;
    case "easeOut":
      eased = cubicBezierValue(0, 0, 0.58, 1, x);
      break;
    case "easeInOut":
      eased = cubicBezierValue(0.42, 0, 0.58, 1, x);
      break;
    case "easeInSine":
      eased = 1 - Math.cos(x * Math.PI / 2);
      break;
    case "easeOutSine":
      eased = Math.sin(x * Math.PI / 2);
      break;
    case "easeInOutSine":
      eased = -(Math.cos(Math.PI * x) - 1) / 2;
      break;
    case "easeInQuad":
      eased = x * x;
      break;
    case "easeOutQuad":
      eased = 1 - (1 - x) * (1 - x);
      break;
    case "easeInOutQuad":
      eased = x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
      break;
    case "easeInCubic":
      eased = x ** 3;
      break;
    case "easeOutCubic":
      eased = 1 - (1 - x) ** 3;
      break;
    case "easeInOutCubic":
      eased = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
      break;
    case "easeInQuart":
      eased = x ** 4;
      break;
    case "easeOutQuart":
      eased = 1 - (1 - x) ** 4;
      break;
    case "easeInOutQuart":
      eased = x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
      break;
    case "easeInQuint":
      eased = x ** 5;
      break;
    case "easeOutQuint":
      eased = 1 - (1 - x) ** 5;
      break;
    case "easeInOutQuint":
      eased = x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2;
      break;
    case "easeInExpo":
      eased = x === 0 ? 0 : 2 ** (10 * x - 10);
      break;
    case "easeOutExpo":
      eased = x === 1 ? 1 : 1 - 2 ** (-10 * x);
      break;
    case "easeInOutExpo":
      eased = x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
      break;
    case "easeInCirc":
      eased = 1 - Math.sqrt(1 - x * x);
      break;
    case "easeOutCirc":
      eased = Math.sqrt(1 - (x - 1) ** 2);
      break;
    case "easeInOutCirc":
      eased = x < 0.5 ? (1 - Math.sqrt(1 - (2 * x) ** 2)) / 2 : (Math.sqrt(1 - (-2 * x + 2) ** 2) + 1) / 2;
      break;
    case "easeInBack":
      eased = c3 * x ** 3 - c1 * x * x;
      break;
    case "easeOutBack":
      eased = 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
      break;
    case "easeInOutBack":
      eased = x < 0.5 ? (2 * x) ** 2 * ((c2 + 1) * 2 * x - c2) / 2 : ((2 * x - 2) ** 2 * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
      break;
    case "easeInElastic":
      eased = x === 0 ? 0 : x === 1 ? 1 : -(2 ** (10 * x - 10)) * Math.sin((x * 10 - 10.75) * c4);
      break;
    case "easeOutElastic":
      eased = x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
      break;
    case "easeInOutElastic":
      eased = x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? -(2 ** (20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2 : 2 ** (-20 * x + 10) * Math.sin((20 * x - 11.125) * c5) / 2 + 1;
      break;
    case "easeInBounce":
      eased = 1 - easeOutBounce(1 - x);
      break;
    case "easeOutBounce":
      eased = easeOutBounce(x);
      break;
    case "easeInOutBounce":
      eased = x < 0.5 ? (1 - easeOutBounce(1 - 2 * x)) / 2 : (1 + easeOutBounce(2 * x - 1)) / 2;
      break;
    default:
      eased = x;
  }
  return clamp013(eased);
}
var PANEL_THEME_STORAGE_KEY = "shader-dev-theme";
function applyPanelTheme(mode, storageKey = PANEL_THEME_STORAGE_KEY) {
  if (typeof document === "undefined") return;
  window.__themeOverride = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    sessionStorage.setItem(storageKey, mode);
  } catch {
  }
}
function detectSystemPreference() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function usePanelTheme(defaultTheme) {
  const [systemPreference, setSystemPreference] = useState(detectSystemPreference);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e) => {
      setSystemPreference(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [htmlDark, setHtmlDark] = useState(false);
  useEffect(() => {
    const root2 = document.documentElement;
    const sync = () => setHtmlDark(root2.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root2, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  if (htmlDark) return "dark";
  if (defaultTheme) return defaultTheme;
  return systemPreference;
}
var PanelThemeContext = createContext("dark");
var PanelThemeProvider = PanelThemeContext.Provider;
function usePanelThemeContext() {
  return useContext(PanelThemeContext);
}
var MENU_MAX_HEIGHT = 260;
var MENU_GAP = 6;
function ControlSelect({
  label,
  value,
  options,
  onChange,
  layout = "stacked",
  className
}) {
  const theme = usePanelThemeContext();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const selectedIndex = options.findIndex(
    (o) => String(o.value) === String(value)
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : void 0;
  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < Math.min(MENU_MAX_HEIGHT, options.length * 32) + 16;
    setPos({
      top: up ? r.top - MENU_GAP : r.bottom + MENU_GAP,
      left: r.right,
      width: Math.max(r.width, 160),
      up
    });
  }, [options.length]);
  const openMenu = useCallback(() => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    place();
    setOpen(true);
  }, [place, selectedIndex]);
  const commit = useCallback(
    (index) => {
      const opt = options[index];
      if (opt) onChange(opt.value);
      setOpen(false);
      btnRef.current?.focus();
    },
    [onChange, options]
  );
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const t = e.target;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector(`[data-panel-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  const onKeyDown = (e) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn("panel-select", className),
      "data-panel-layout": layout,
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-select-label", children: label }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            ref: btnRef,
            type: "button",
            className: "panel-select-btn",
            "aria-haspopup": "listbox",
            "aria-expanded": open,
            "aria-label": label,
            onClick: () => open ? setOpen(false) : openMenu(),
            onKeyDown,
            children: [
              /* @__PURE__ */ jsx("span", { className: "panel-select-value", children: selected?.label ?? "\u2014" }),
              /* @__PURE__ */ jsx(
                "svg",
                {
                  className: "panel-select-chevron",
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 2.4,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": "true",
                  children: /* @__PURE__ */ jsx("path", { d: "M6 9l6 6 6-6" })
                }
              )
            ]
          }
        ),
        open && pos ? createPortal(
          /* @__PURE__ */ jsx(
            "div",
            {
              "data-panel": "",
              "data-panel-theme": theme,
              className: "panel-select-layer",
              children: /* @__PURE__ */ jsx(
                "div",
                {
                  ref: menuRef,
                  role: "listbox",
                  "aria-label": label,
                  className: "panel-select-menu",
                  "data-panel-up": pos.up ? "true" : "false",
                  style: {
                    position: "fixed",
                    left: pos.left,
                    top: pos.top,
                    minWidth: pos.width,
                    maxHeight: MENU_MAX_HEIGHT,
                    transform: `translate(-100%, ${pos.up ? "-100%" : "0"})`
                  },
                  children: options.map((o, i) => {
                    const isSelected = i === selectedIndex;
                    return /* @__PURE__ */ jsxs(
                      "button",
                      {
                        type: "button",
                        role: "option",
                        "aria-selected": isSelected,
                        "data-panel-index": i,
                        "data-panel-active": i === active ? "true" : "false",
                        className: "panel-select-option",
                        onMouseEnter: () => setActive(i),
                        onClick: () => commit(i),
                        children: [
                          /* @__PURE__ */ jsx("span", { children: o.label }),
                          isSelected ? /* @__PURE__ */ jsx(
                            "svg",
                            {
                              className: "panel-select-check",
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              strokeWidth: 2.4,
                              strokeLinecap: "round",
                              strokeLinejoin: "round",
                              "aria-hidden": "true",
                              children: /* @__PURE__ */ jsx("path", { d: "M5 13l4 4L19 7" })
                            }
                          ) : null
                        ]
                      },
                      String(o.value)
                    );
                  })
                }
              )
            }
          ),
          document.body
        ) : null
      ]
    }
  );
}
function decimalsForStep(s) {
  const str = s.toString();
  const dot = str.indexOf(".");
  return dot === -1 ? 0 : str.length - dot - 1;
}
function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
var FRICTION = 0.94;
var MIN_VELOCITY = 2e-5;
var MAX_VELOCITY = 6e-3;
var THROW_VELOCITY = 12e-4;
var VELOCITY_STALE_MS = 80;
function ControlSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  className
}) {
  const trackRef = useRef(null);
  const fillRef = useRef(null);
  const handleRef = useRef(null);
  const overscrollRef = useRef(null);
  const [state, setState] = useState("idle");
  const percentage = (value - min) / (max - min) * 100;
  const decimals = decimalsForStep(step);
  const displayValue = value.toFixed(decimals);
  useEffect(() => {
    const fill = fillRef.current;
    const handle = handleRef.current;
    if (fill) fill.style.setProperty("--panel-fill-pct", `${percentage}%`);
    if (handle) handle.style.setProperty("--panel-handle-left", `${percentage}%`);
  }, [percentage]);
  const fractionToValue = useCallback(
    (frac) => {
      const clamped = Math.max(0, Math.min(1, frac));
      const raw = min + clamped * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.max(
        min,
        Math.min(max, Number.parseFloat(stepped.toFixed(decimals)))
      );
    },
    [min, max, step, decimals]
  );
  const positionToValue = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return value;
      const rect = el.getBoundingClientRect();
      return fractionToValue((clientX - rect.left) / rect.width);
    },
    [fractionToValue, value]
  );
  const onChangeRef = useRef(onChange);
  const fractionToValueRef = useRef(fractionToValue);
  const positionToValueRef = useRef(positionToValue);
  onChangeRef.current = onChange;
  fractionToValueRef.current = fractionToValue;
  positionToValueRef.current = positionToValue;
  const setOverscroll = useCallback((scale, origin) => {
    const el = overscrollRef.current;
    if (!el) return;
    el.style.setProperty("--panel-os-scale", String(scale));
    el.style.setProperty("--panel-os-origin", origin);
  }, []);
  const paintFraction = useCallback((frac) => {
    const clamped = Math.max(0, Math.min(1, frac));
    const pct = `${clamped * 100}%`;
    if (fillRef.current)
      fillRef.current.style.setProperty("--panel-fill-pct", pct);
    if (handleRef.current)
      handleRef.current.style.setProperty("--panel-handle-left", pct);
  }, []);
  const rafRef = useRef(null);
  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      const reduced = prefersReducedMotion();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setState("drag");
      onChangeRef.current(positionToValueRef.current(e.clientX));
      const overscrollEl = overscrollRef.current;
      if (overscrollEl) overscrollEl.dataset.panelRelease = "false";
      let lastFrac = 0;
      let lastT = e.timeStamp;
      let velocity = 0;
      const rawFraction = (clientX) => {
        const el = trackRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        return (clientX - rect.left) / rect.width;
      };
      lastFrac = rawFraction(e.clientX);
      const onMove = (ev) => {
        ev.preventDefault();
        const rawPct = rawFraction(ev.clientX);
        const now = ev.timeStamp;
        const dt = now - lastT;
        if (dt > 0) {
          velocity = (rawPct - lastFrac) / dt;
          lastT = now;
          lastFrac = rawPct;
        }
        if (!reduced) {
          if (rawPct < 0) {
            const d = Math.abs(rawPct);
            const v = (1 - 1 / (d * 3 + 1)) * 0.02;
            setOverscroll(1 + v, "100% 50%");
          } else if (rawPct > 1) {
            const d = rawPct - 1;
            const v = (1 - 1 / (d * 3 + 1)) * 0.02;
            setOverscroll(1 + v, "0% 50%");
          } else {
            setOverscroll(1, "50% 50%");
          }
        }
        onChangeRef.current(fractionToValueRef.current(rawPct));
      };
      const springBack = () => {
        if (!overscrollEl) return;
        overscrollEl.dataset.panelRelease = "true";
        setOverscroll(1, "50% 50%");
        const clear = () => {
          overscrollEl.dataset.panelRelease = "false";
          overscrollEl.removeEventListener("transitionend", clear);
        };
        overscrollEl.addEventListener("transitionend", clear);
      };
      const finishDrag = () => {
        setState((prev) => prev === "drag" ? "hover" : prev);
      };
      const onUp = (upEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (reduced) {
          setOverscroll(1, "50% 50%");
          finishDrag();
          return;
        }
        springBack();
        if (upEvent.timeStamp - lastT > VELOCITY_STALE_MS) velocity = 0;
        let v = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
        let frac = lastFrac;
        let last = performance.now();
        if (Math.abs(v) < THROW_VELOCITY) {
          finishDrag();
          return;
        }
        const coast = (t) => {
          const dt = t - last;
          last = t;
          frac += v * dt;
          v *= Math.pow(FRICTION, dt / 16);
          const visual = Math.max(0, Math.min(1, frac));
          paintFraction(visual);
          onChangeRef.current(fractionToValueRef.current(visual));
          const atEdge = frac <= 0 || frac >= 1;
          if (Math.abs(v) < MIN_VELOCITY || atEdge) {
            const final = fractionToValueRef.current(visual);
            onChangeRef.current(final);
            paintFraction((final - min) / (max - min));
            rafRef.current = null;
            finishDrag();
            return;
          }
          rafRef.current = requestAnimationFrame(coast);
        };
        rafRef.current = requestAnimationFrame(coast);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setOverscroll, paintFraction, min, max]
  );
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);
  const [draft, setDraft] = useState(null);
  const commitDraft = useCallback(
    (raw) => {
      setDraft(null);
      const parsed = Number.parseFloat(raw.replace(",", "."));
      if (!Number.isFinite(parsed)) return;
      const stepped = Math.round(parsed / step) * step;
      onChangeRef.current(
        Math.max(
          min,
          Math.min(max, Number.parseFloat(stepped.toFixed(decimals)))
        )
      );
    },
    [min, max, step, decimals]
  );
  const stepBy = useCallback(
    (direction, multiplier) => {
      const next = value + direction * step * multiplier;
      onChangeRef.current(
        Math.max(min, Math.min(max, Number.parseFloat(next.toFixed(decimals))))
      );
    },
    [value, min, max, step, decimals]
  );
  const discreteSteps = (max - min) / step;
  const hashCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;
  const hashMarks = Array.from({ length: hashCount }, (_, i) => {
    const pct = discreteSteps <= 10 ? (i + 1) * step / (max - min) * 100 : (i + 1) * 10;
    return /* @__PURE__ */ jsx("div", { className: "panel-slider-hash", style: { left: `${pct}%` } }, `h${pct}`);
  });
  return /* @__PURE__ */ jsxs(
    "div",
    {
      "data-panel-state": state,
      className: cn("panel-slider-row", className),
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-slider-row-label", title: label, children: label }),
        /* @__PURE__ */ jsx("div", { className: "panel-slider", children: /* @__PURE__ */ jsx("div", { ref: overscrollRef, className: "panel-slider-overscroll", children: /* @__PURE__ */ jsxs(
          "div",
          {
            ref: trackRef,
            role: "slider",
            tabIndex: 0,
            "aria-valuenow": value,
            "aria-valuemin": min,
            "aria-valuemax": max,
            "aria-label": label,
            className: "panel-slider-track",
            onPointerDown: handlePointerDown,
            onPointerEnter: () => setState((s) => s === "drag" ? s : "hover"),
            onPointerLeave: () => setState((s) => s === "drag" ? s : "idle"),
            children: [
              /* @__PURE__ */ jsx("div", { className: "panel-slider-hash-row", children: hashMarks }),
              /* @__PURE__ */ jsx(
                "div",
                {
                  ref: fillRef,
                  className: "panel-slider-fill",
                  style: { "--panel-fill-pct": `${percentage}%` }
                }
              ),
              /* @__PURE__ */ jsx(
                "div",
                {
                  ref: handleRef,
                  className: "panel-slider-handle",
                  style: {
                    "--panel-handle-left": `${percentage}%`
                  }
                }
              )
            ]
          }
        ) }) }),
        /* @__PURE__ */ jsx(
          "input",
          {
            className: "panel-slider-num",
            type: "text",
            inputMode: "decimal",
            "aria-label": `${label} value`,
            value: draft ?? displayValue,
            onFocus: (e) => {
              setDraft(displayValue);
              e.currentTarget.select();
            },
            onChange: (e) => setDraft(e.target.value),
            onBlur: (e) => commitDraft(e.target.value),
            onKeyDown: (e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                setDraft(null);
                e.currentTarget.blur();
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setDraft(null);
                stepBy(1, e.shiftKey ? 10 : 1);
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setDraft(null);
                stepBy(-1, e.shiftKey ? 10 : 1);
              }
            }
          }
        )
      ]
    }
  );
}
var STRIPE_START_FROM_MIN = 0;
var STRIPE_START_FROM_MAX = 0.8;
var STRIPE_WIDTH_MIN = 0.5;
var STRIPE_WIDTH_MAX = 64;
var CUSTOM_EASING_VALUE = "__custom";
var stripeIdCounter = 0;
function makeStripeId() {
  stripeIdCounter += 1;
  return `stripe-${Date.now().toString(36)}-${stripeIdCounter}`;
}
function normalizeHexForDisplay(value) {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toUpperCase()}` : value;
}
function getStripeColorMeta(hex, library) {
  const match = findLibraryColorByHex(hex, library);
  if (match) {
    return { name: match.token, code: normalizeHexForDisplay(match.hex) };
  }
  return { name: "Custom", code: normalizeHexForDisplay(hex) };
}
function clampRangeValue(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function GripIcon() {
  return /* @__PURE__ */ jsxs("svg", { width: 14, height: 14, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "6", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "12", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "18", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "15", cy: "18", r: "1.4" })
  ] });
}
function PlusIcon2() {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: 11,
      height: 11,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      "aria-hidden": "true",
      children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
    }
  );
}
function ChevronIcon({ open }) {
  return /* @__PURE__ */ jsx(
    "svg",
    {
      width: 13,
      height: 13,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: open ? /* @__PURE__ */ jsx("path", { d: "M6 9l6 6 6-6" }) : /* @__PURE__ */ jsx("path", { d: "M9 6l6 6-6 6" })
    }
  );
}
function EasingGraph({
  value,
  disabled = false,
  editableDefault = DEFAULT_CUSTOM_EASING,
  onChange
}) {
  const width = 168;
  const height = 88;
  const pad = 10;
  const ref = useRef(null);
  const activeHandle = useRef(null);
  const custom = parseCustomEasing(value);
  const pointX = (x) => pad + x * (width - pad * 2);
  const pointY = (y) => height - pad - y * (height - pad * 2);
  const graphX = (x) => clampRangeValue((x - pad) / (width - pad * 2), 0, 1);
  const graphY = (y) => clampRangeValue((height - pad - y) / (height - pad * 2), 0, 1);
  const editablePoints = custom ?? editableDefault;
  function updateHandle(handle, clientX, clientY) {
    if (!onChange || disabled) return;
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    const svgX = (clientX - bounds.left) / bounds.width * width;
    const svgY = (clientY - bounds.top) / bounds.height * height;
    const next = handle === "p1" ? { ...editablePoints, x1: graphX(svgX), y1: graphY(svgY) } : { ...editablePoints, x2: graphX(svgX), y2: graphY(svgY) };
    onChange(formatCustomEasing(next));
  }
  function nearestHandle(clientX, clientY) {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return "p1";
    const svgX = (clientX - bounds.left) / bounds.width * width;
    const svgY = (clientY - bounds.top) / bounds.height * height;
    const d1 = Math.hypot(
      svgX - pointX(editablePoints.x1),
      svgY - pointY(editablePoints.y1)
    );
    const d2 = Math.hypot(
      svgX - pointX(editablePoints.x2),
      svgY - pointY(editablePoints.y2)
    );
    return d1 <= d2 ? "p1" : "p2";
  }
  const points = Array.from({ length: 40 }, (_, index) => {
    const t = index / 39;
    const x = pointX(t);
    const y = pointY(easeValue(t, value || "linear"));
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return /* @__PURE__ */ jsxs(
    "svg",
    {
      ref,
      className: cn(
        "panel-stripes-easing-graph",
        onChange && !disabled ? "is-editable" : null
      ),
      viewBox: `0 0 ${width} ${height}`,
      "aria-hidden": "true",
      onPointerDown: (event) => {
        if (!onChange || disabled) return;
        event.preventDefault();
        event.stopPropagation();
        const handle = nearestHandle(event.clientX, event.clientY);
        activeHandle.current = handle;
        event.currentTarget.setPointerCapture(event.pointerId);
        updateHandle(handle, event.clientX, event.clientY);
      },
      onPointerMove: (event) => {
        if (!onChange || disabled || !activeHandle.current) return;
        event.preventDefault();
        event.stopPropagation();
        updateHandle(activeHandle.current, event.clientX, event.clientY);
      },
      onPointerUp: (event) => {
        if (!activeHandle.current) return;
        event.preventDefault();
        event.stopPropagation();
        activeHandle.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: () => {
        activeHandle.current = null;
      },
      children: [
        /* @__PURE__ */ jsx("line", { x1: pad, y1: height - pad, x2: width - pad, y2: height - pad }),
        /* @__PURE__ */ jsx("line", { x1: pad, y1: pad, x2: pad, y2: height - pad }),
        custom || onChange ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "line",
            {
              className: "panel-stripes-easing-handle-line",
              x1: pad,
              y1: height - pad,
              x2: pointX(editablePoints.x1),
              y2: pointY(editablePoints.y1)
            }
          ),
          /* @__PURE__ */ jsx(
            "line",
            {
              className: "panel-stripes-easing-handle-line",
              x1: width - pad,
              y1: pad,
              x2: pointX(editablePoints.x2),
              y2: pointY(editablePoints.y2)
            }
          )
        ] }) : null,
        /* @__PURE__ */ jsx("polyline", { points }),
        custom || onChange ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "circle",
            {
              className: "panel-stripes-easing-handle",
              cx: pointX(editablePoints.x1),
              cy: pointY(editablePoints.y1),
              r: "4.2"
            }
          ),
          /* @__PURE__ */ jsx(
            "circle",
            {
              className: "panel-stripes-easing-handle",
              cx: pointX(editablePoints.x2),
              cy: pointY(editablePoints.y2),
              r: "4.2"
            }
          )
        ] }) : null
      ]
    }
  );
}
function EasingControl({
  label,
  value,
  options,
  disabled,
  onChange
}) {
  const customValue = value?.startsWith("custom:") ? value : formatCustomEasing(DEFAULT_CUSTOM_EASING);
  const selectValue = value?.startsWith("custom:") ? CUSTOM_EASING_VALUE : value ?? "";
  return /* @__PURE__ */ jsxs("div", { className: "panel-stripes-easing-row", children: [
    /* @__PURE__ */ jsx("span", { className: "panel-stripes-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-stripes-easing-control", children: [
      /* @__PURE__ */ jsx(
        ControlSelect,
        {
          label,
          layout: "inline",
          value: selectValue,
          options: [
            ...Object.entries(options).map(([optionLabel, optionValue]) => ({
              label: optionLabel,
              value: optionValue
            })),
            { label: "Custom", value: CUSTOM_EASING_VALUE }
          ],
          onChange: (nextValue) => onChange(
            nextValue === CUSTOM_EASING_VALUE ? customValue : String(nextValue)
          )
        }
      ),
      /* @__PURE__ */ jsx(
        EasingGraph,
        {
          value,
          disabled,
          onChange: disabled ? void 0 : onChange
        }
      )
    ] })
  ] });
}
function StripeDetailRow({
  stripe,
  index,
  disabled,
  library,
  showColorControls,
  renderColorPopover,
  dragging,
  dragover,
  reorderEnabled,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onColorChange,
  onOpacityChange,
  onThresholdChange,
  onWidthChange,
  onRemove
}) {
  const colorMeta = getStripeColorMeta(stripe.hex, library);
  const opacityPercent = Math.round(stripe.opacity * 100);
  const popoverProps = {
    color: stripe.hex,
    onChange: (hex) => onColorChange(stripe.id, hex),
    disabled,
    ariaLabel: `Stripe ${index + 1} color`,
    triggerClassName: "panel-stripes-swatch",
    triggerStyle: {
      "--panel-stripes-swatch-color": cssColorForHex(stripe.hex, library)
    },
    align: "right"
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "panel-stripes-detail-row",
      "data-panel-dragging": dragging ? "true" : "false",
      "data-panel-dragover": dragover ? "true" : "false",
      onDragOver,
      onDrop,
      children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-stripes-color-header", children: [
          /* @__PURE__ */ jsx(
            "span",
            {
              className: "panel-stripes-grip",
              role: "button",
              tabIndex: -1,
              "aria-label": `Reorder Stripe ${index + 1}`,
              draggable: reorderEnabled && !disabled,
              onDragStart: (e) => {
                e.dataTransfer.effectAllowed = "move";
                onDragStart();
              },
              onDragEnd,
              children: /* @__PURE__ */ jsx(GripIcon, {})
            }
          ),
          showColorControls ? /* @__PURE__ */ jsxs(Fragment, { children: [
            renderColorPopover ? renderColorPopover(popoverProps) : /* @__PURE__ */ jsx(NativeColorSwatch, { ...popoverProps }),
            /* @__PURE__ */ jsxs("div", { className: "panel-stripes-color-meta", children: [
              /* @__PURE__ */ jsx("span", { className: "panel-stripes-color-name", children: colorMeta.name }),
              /* @__PURE__ */ jsxs("span", { className: "panel-stripes-color-code", children: [
                "[",
                colorMeta.code,
                "]"
              ] })
            ] })
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                className: "panel-stripes-swatch panel-stripes-swatch-placeholder",
                "aria-hidden": "true"
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "panel-stripes-color-meta", children: [
              /* @__PURE__ */ jsxs("span", { className: "panel-stripes-color-name", children: [
                "Level ",
                index + 1
              ] }),
              /* @__PURE__ */ jsx("span", { className: "panel-stripes-color-code", children: "[image colors]" })
            ] })
          ] }),
          /* @__PURE__ */ jsx(
            PanelCloseButton,
            {
              ariaLabel: `Remove Stripe ${index + 1}`,
              className: "panel-stripes-remove",
              size: "sm",
              disabled,
              onClick: () => onRemove(stripe.id)
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "panel-stripes-control-stack", children: [
          /* @__PURE__ */ jsx(
            ControlSlider,
            {
              label: "Opacity",
              value: opacityPercent,
              min: 0,
              max: 100,
              step: 1,
              onChange: (v) => {
                if (!disabled) onOpacityChange(stripe.id, v / 100);
              }
            }
          ),
          /* @__PURE__ */ jsx(
            ControlSlider,
            {
              label: "Threshold",
              value: stripe.startFrom,
              min: STRIPE_START_FROM_MIN,
              max: STRIPE_START_FROM_MAX,
              step: 0.01,
              onChange: (v) => {
                if (!disabled) onThresholdChange(stripe.id, v);
              }
            }
          ),
          /* @__PURE__ */ jsx(
            ControlSlider,
            {
              label: "Width",
              value: stripe.width,
              min: STRIPE_WIDTH_MIN,
              max: STRIPE_WIDTH_MAX,
              step: 0.5,
              onChange: (v) => {
                if (!disabled) onWidthChange(stripe.id, v);
              }
            }
          )
        ] })
      ]
    }
  );
}
function ControlStripeColorsTable({
  value,
  onChange,
  disabled = false,
  library,
  showRampEasing = false,
  rampEasingOptions = {},
  rampEasingValue,
  onRampEasingChange,
  thresholdEasingOptions = {},
  thresholdEasingValue,
  onThresholdEasingChange,
  showColorControls = true,
  showSavePalette = false,
  onSavePalette,
  onShufflePalette,
  onUndoShuffle,
  canUndoShuffle = false,
  renderColorPopover,
  className
}) {
  const [colorsOpen, setColorsOpen] = useState(
    () => loadControlDrawerOpen("Colors", false)
  );
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  useEffect(() => {
    if (value.every((s) => s.id)) return;
    onChange(value.map((s, i) => s.id ? s : { ...s, id: `stripe-${i}` }));
  }, [value, onChange]);
  const updateStripe = (id, patch) => {
    onChange(value.map((s) => s.id === id ? { ...s, ...patch } : s));
  };
  const moveStripe = (from, to) => {
    if (from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  const addStripe = () => {
    const last = value[value.length - 1];
    onChange([
      ...value,
      {
        id: makeStripeId(),
        hex: last?.hex ?? "#f46021",
        startFrom: Math.min(
          STRIPE_START_FROM_MAX,
          (last?.startFrom ?? 0) + 0.05
        ),
        width: last?.width ?? 4,
        opacity: last?.opacity ?? 1
      }
    ]);
  };
  const removeStripe = (id) => {
    if (value.length <= 1) return;
    onChange(value.filter((s) => s.id !== id));
  };
  const reverseColorOrder = () => {
    const hexes = value.map((s) => s.hex).reverse();
    onChange(value.map((s, i) => ({ ...s, hex: hexes[i] })));
  };
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "panel-stripes-table",
        disabled && "is-disabled",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "panel-stripes-palette-wrap", children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-stripes-palette-head", children: [
            /* @__PURE__ */ jsx("span", { className: "panel-stripes-palette-title", children: "Distribution" }),
            /* @__PURE__ */ jsxs("div", { className: "panel-stripes-palette-toolbar", children: [
              onShufflePalette ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "panel-stripes-palette-action",
                  disabled,
                  onClick: onShufflePalette,
                  children: "Shuffle"
                }
              ) : null,
              onUndoShuffle ? /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "panel-stripes-palette-action",
                  disabled: disabled || !canUndoShuffle,
                  onClick: onUndoShuffle,
                  children: "Undo"
                }
              ) : null,
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "panel-stripes-palette-action",
                  disabled: disabled || value.length < 2,
                  onClick: reverseColorOrder,
                  children: "Flip"
                }
              )
            ] })
          ] }),
          showRampEasing && onRampEasingChange ? /* @__PURE__ */ jsx(
            EasingControl,
            {
              label: "Brightness easing",
              value: rampEasingValue,
              options: rampEasingOptions,
              disabled,
              onChange: onRampEasingChange
            }
          ) : null,
          Object.keys(thresholdEasingOptions).length > 0 && onThresholdEasingChange ? /* @__PURE__ */ jsx(
            EasingControl,
            {
              label: "Threshold easing",
              value: thresholdEasingValue,
              options: thresholdEasingOptions,
              disabled,
              onChange: onThresholdEasingChange
            }
          ) : null
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            className: "panel-stripes-drawer-toggle",
            disabled,
            "aria-expanded": colorsOpen,
            onClick: () => setColorsOpen((open) => {
              const next = !open;
              saveControlDrawerOpen("Colors", next);
              return next;
            }),
            children: [
              /* @__PURE__ */ jsx(ChevronIcon, { open: colorsOpen }),
              /* @__PURE__ */ jsx("span", { children: showColorControls ? "Colors" : "Levels" }),
              /* @__PURE__ */ jsx("span", { className: "panel-stripes-drawer-count", children: value.length })
            ]
          }
        ),
        colorsOpen ? /* @__PURE__ */ jsxs("div", { className: "panel-stripes-drawer-panel", children: [
          /* @__PURE__ */ jsx("div", { className: "panel-stripes-detail-list", children: value.map((stripe, index) => /* @__PURE__ */ jsx(
            StripeDetailRow,
            {
              stripe,
              index,
              disabled,
              library,
              showColorControls,
              renderColorPopover,
              reorderEnabled: value.length > 1,
              dragging: dragIndex === index,
              dragover: overIndex === index,
              onDragStart: () => setDragIndex(index),
              onDragEnd: () => {
                setDragIndex(null);
                setOverIndex(null);
              },
              onDragOver: dragIndex != null ? (e) => {
                e.preventDefault();
                setOverIndex(index);
              } : void 0,
              onDrop: dragIndex != null ? (e) => {
                e.preventDefault();
                moveStripe(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              } : void 0,
              onColorChange: (id, hex) => updateStripe(id, { hex }),
              onOpacityChange: (id, opacity) => updateStripe(id, { opacity }),
              onThresholdChange: (id, startFrom) => updateStripe(id, { startFrom }),
              onWidthChange: (id, width) => updateStripe(id, { width }),
              onRemove: removeStripe
            },
            stripe.id
          )) }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: "panel-stripes-add",
              disabled,
              onClick: addStripe,
              children: [
                /* @__PURE__ */ jsx(PlusIcon2, {}),
                "Add stripe"
              ]
            }
          ),
          showSavePalette && onSavePalette ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-stripes-save",
              disabled,
              onClick: onSavePalette,
              children: "Save palette"
            }
          ) : null
        ] }) : null
      ]
    }
  );
}
var stripeColorsTableStyles = `
.panel-stripes-table {
  display: grid;
  width: 100%;
  min-width: 0;
  row-gap: 0;
  font-size: 11px;
  color: var(--panel-text);
}

.panel-stripes-table.is-disabled {
  pointer-events: none;
  opacity: 0.45;
}

.panel-stripes-palette-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

/* Title left, actions right \u2014 one vertically-centered 24px row. */
.panel-stripes-palette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
  min-width: 0;
}

.panel-stripes-palette-title {
  color: var(--panel-text-muted);
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.panel-stripes-palette-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

button.panel-stripes-palette-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 24px;
  padding: 0 12px;
  text-align: center;
  border: 1px solid transparent;
  border-radius: 4px;
  background-color: var(--panel-surface);
  color: var(--panel-text-muted);
  font: inherit;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}

button.panel-stripes-palette-action:not(:disabled):hover,
button.panel-stripes-palette-action:not(:disabled):focus-visible {
  background-color: var(--panel-surface-active);
  color: var(--panel-text);
  outline: none;
}

button.panel-stripes-palette-action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.panel-stripes-easing-row {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  align-items: start;
  gap: 6px;
  min-width: 0;
}

.panel-stripes-easing-control {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.panel-stripes-easing-graph {
  width: 100%;
  height: 88px;
  display: block;
  overflow: visible;
  border-radius: 4px;
  background: var(--panel-surface);
  touch-action: none;
  user-select: none;
}

.panel-stripes-easing-graph.is-editable {
  cursor: crosshair;
}

.panel-stripes-easing-graph line {
  stroke: var(--panel-hash);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.panel-stripes-easing-graph polyline {
  fill: none;
  stroke: var(--panel-text-muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.panel-stripes-easing-handle-line {
  stroke: var(--panel-hash);
  stroke-width: 1;
  stroke-dasharray: 2 2;
  vector-effect: non-scaling-stroke;
}

.panel-stripes-easing-handle {
  fill: var(--panel-text-muted);
  stroke: var(--panel-surface);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

/* Sub-section disclosure \u2014 matches the .panel-section-header language:
   transparent 20px row, chevron leading, 500-weight label, muted count. */
.panel-stripes-drawer-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  height: 20px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--panel-label);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: -0.01em;
  text-align: left;
  cursor: pointer;
}

.panel-stripes-drawer-toggle svg {
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: color 150ms ease;
}

.panel-stripes-drawer-toggle:not(:disabled):hover,
.panel-stripes-drawer-toggle:not(:disabled):focus-visible {
  color: var(--panel-label-active);
  outline: none;
}

.panel-stripes-drawer-toggle:not(:disabled):hover svg,
.panel-stripes-drawer-toggle:not(:disabled):focus-visible svg {
  color: var(--panel-label-active);
}

.panel-stripes-drawer-toggle span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.panel-stripes-drawer-count {
  margin-left: auto;
  color: var(--panel-text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.panel-stripes-drawer-panel {
  display: grid;
  row-gap: 8px;
  min-width: 0;
  padding-top: 8px;
}

.panel-stripes-detail-list {
  display: grid;
  row-gap: 8px;
  min-width: 0;
}

.panel-stripes-detail-row {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 6px 0;
  border-bottom: 1px solid var(--panel-divider);
}

.panel-stripes-detail-row:last-child {
  border-bottom: none;
}

.panel-stripes-detail-row[data-panel-dragging="true"] {
  opacity: 0.5;
}

.panel-stripes-detail-row[data-panel-dragover="true"] {
  box-shadow: 0 -1px 0 0 var(--panel-text-muted);
}

.panel-stripes-color-header {
  display: grid;
  grid-template-columns: 18px 24px minmax(0, 1fr) 16px;
  align-items: center;
  column-gap: 8px;
  min-width: 0;
}

.panel-stripes-grip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  color: var(--panel-muted-icon);
  touch-action: none;
  cursor: grab;
}

.panel-stripes-grip:active {
  cursor: grabbing;
}

.panel-stripes-detail-row:hover .panel-stripes-grip,
.panel-stripes-grip:focus-visible {
  color: var(--panel-text);
  outline: none;
}

button.panel-stripes-swatch {
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  padding: 0;
  border: 1px solid var(--panel-swatch-border);
  border-radius: 4px;
  box-shadow: none;
  cursor: pointer;
  background-color: var(--panel-stripes-swatch-color, #000000);
}

.panel-stripes-swatch-placeholder {
  width: 24px;
  height: 24px;
}

.panel-stripes-color-meta {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.panel-stripes-color-name,
.panel-stripes-color-code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.panel-stripes-color-name {
  color: var(--panel-text);
}

.panel-stripes-color-code {
  flex: 0 1 auto;
  color: var(--panel-text-muted);
  font-size: 10px;
}

/* Layout only \u2014 look comes from the shared .panel-close-btn. */
.panel-stripes-remove {
  justify-self: end;
}

.panel-stripes-control-stack {
  display: grid;
  row-gap: 6px;
  min-width: 0;
  padding-left: 26px;
}

.panel-stripes-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-weight: 400;
  color: var(--panel-text-muted);
}

button.panel-stripes-add {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 24px;
  border: 1px dashed var(--panel-swatch-border);
  border-radius: 4px;
  background-color: transparent;
  color: var(--panel-text-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

button.panel-stripes-add:not(:disabled):hover {
  border-color: var(--panel-text-muted);
  color: var(--panel-text);
}

button.panel-stripes-save {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  border: 1px solid var(--panel-swatch-border);
  border-radius: 4px;
  background-color: var(--panel-surface);
  color: var(--panel-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

button.panel-stripes-save:not(:disabled):hover,
button.panel-stripes-save:not(:disabled):focus-visible {
  border-color: var(--panel-text-muted);
  background-color: var(--panel-surface-active);
  outline: none;
}
`;
var VB = 100;
var ANCHOR_DRAG = -1;
var HIT_RADIUS_PAD = 8;
var MIN_ADD_DISTANCE = 0.06;
function ControlPath({
  label,
  value,
  onChange,
  min,
  max,
  anchor,
  onAnchorChange,
  emptyLabel,
  className
}) {
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const pendingAddRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const span = max - min || 1;
  const toPad = useCallback(
    (p) => [
      (p[0] - min) / span * VB,
      (max - p[1]) / span * VB
    ],
    [min, max, span]
  );
  const fromEvent = useCallback(
    (e) => {
      const svg = svgRef.current;
      if (!svg) return [0, 0];
      const r = svg.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      return [
        +(min + px * span).toFixed(3),
        +(max - py * span).toFixed(3)
      ];
    },
    [min, max, span]
  );
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const tooCloseToAnchor = useCallback(
    (p) => {
      if (!anchor || !onAnchorChange) return false;
      return distance(p, anchor) < MIN_ADD_DISTANCE;
    },
    [anchor, onAnchorChange]
  );
  const setPoint = (i, p) => {
    const next = value.map((pt, idx) => idx === i ? p : pt);
    onChange(next);
  };
  const addPoint = (p) => {
    if (tooCloseToAnchor(p)) return;
    for (const pt of value) {
      if (distance(p, pt) < MIN_ADD_DISTANCE) return;
    }
    onChange([...value, p]);
    setSelected(value.length);
  };
  const removePoint = (i) => {
    onChange(value.filter((_, idx) => idx !== i));
    setSelected(null);
  };
  const beginPointer = (e) => {
    pendingAddRef.current = null;
    movedRef.current = false;
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerDownPoint = (e, i) => {
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = i;
    setSelected(i);
  };
  const onPointerDownAnchor = (e) => {
    if (!onAnchorChange) return;
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = ANCHOR_DRAG;
    setSelected("anchor");
  };
  const onPointerDownBackground = (e) => {
    e.stopPropagation();
    beginPointer(e);
    dragRef.current = null;
    pendingAddRef.current = fromEvent(e);
    setSelected(null);
  };
  const onPointerMove = (e) => {
    if (dragRef.current === null && pendingAddRef.current === null) return;
    movedRef.current = true;
    const next = fromEvent(e);
    if (dragRef.current === ANCHOR_DRAG) {
      onAnchorChange?.(next);
      return;
    }
    if (dragRef.current !== null) {
      setPoint(dragRef.current, next);
    }
  };
  const onPointerUp = (e) => {
    svgRef.current?.releasePointerCapture(e.pointerId);
    if (dragRef.current !== null) {
      dragRef.current = null;
      movedRef.current = false;
      pendingAddRef.current = null;
      return;
    }
    if (pendingAddRef.current !== null && !movedRef.current) {
      addPoint(pendingAddRef.current);
    }
    dragRef.current = null;
    movedRef.current = false;
    pendingAddRef.current = null;
  };
  const chain = anchor ? [anchor, ...value] : [...value];
  const chainPad = chain.map(toPad);
  const polyline = chainPad.map(([x, y]) => `${x},${y}`).join(" ");
  const closeFrom = chainPad[chainPad.length - 1];
  const closeTo = chainPad[0];
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-path", className), children: [
    /* @__PURE__ */ jsxs("div", { className: "panel-path-head", children: [
      /* @__PURE__ */ jsx("span", { className: "panel-path-label", children: label }),
      /* @__PURE__ */ jsxs("div", { className: "panel-path-head-actions", children: [
        /* @__PURE__ */ jsx("span", { className: "panel-path-count", children: value.length === 0 ? emptyLabel ?? "click to add" : `${value.length} pt${value.length === 1 ? "" : "s"}` }),
        value.length > 0 ? /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            className: "panel-path-clear",
            onClick: () => {
              onChange([]);
              setSelected(null);
            },
            children: "Clear"
          }
        ) : null
      ] })
    ] }),
    /* @__PURE__ */ jsxs(
      "svg",
      {
        ref: svgRef,
        className: "panel-path-pad",
        viewBox: `0 0 ${VB} ${VB}`,
        preserveAspectRatio: "none",
        onPointerMove,
        onPointerUp,
        onPointerCancel: onPointerUp,
        children: [
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: "0",
              y: "0",
              width: VB,
              height: VB,
              className: "panel-path-bg",
              onPointerDown: onPointerDownBackground
            }
          ),
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: "50",
              y1: "0",
              x2: "50",
              y2: VB,
              className: "panel-path-grid",
              pointerEvents: "none"
            }
          ),
          /* @__PURE__ */ jsx(
            "line",
            {
              x1: "0",
              y1: "50",
              x2: VB,
              y2: "50",
              className: "panel-path-grid",
              pointerEvents: "none"
            }
          ),
          /* @__PURE__ */ jsx(
            "rect",
            {
              x: "0.5",
              y: "0.5",
              width: VB - 1,
              height: VB - 1,
              className: "panel-path-frame",
              pointerEvents: "none"
            }
          ),
          chain.length > 1 ? /* @__PURE__ */ jsx(
            "polyline",
            {
              points: polyline,
              className: "panel-path-line",
              pointerEvents: "none"
            }
          ) : null,
          chain.length > 1 ? /* @__PURE__ */ jsx(
            "line",
            {
              x1: closeFrom[0],
              y1: closeFrom[1],
              x2: closeTo[0],
              y2: closeTo[1],
              className: "panel-path-line-close",
              pointerEvents: "none"
            }
          ) : null,
          value.map((p, i) => {
            const [x, y] = toPad(p);
            return /* @__PURE__ */ jsxs(
              "g",
              {
                className: cn(
                  "panel-path-point",
                  selected === i && "is-selected"
                ),
                onPointerDown: (e) => onPointerDownPoint(e, i),
                onDoubleClick: (e) => {
                  e.stopPropagation();
                  removePoint(i);
                },
                children: [
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: HIT_RADIUS_PAD,
                      className: "panel-path-point-hit"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: x,
                      cy: y,
                      r: "3",
                      className: "panel-path-point-ring",
                      pointerEvents: "none"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "text",
                    {
                      x,
                      y,
                      className: "panel-path-point-num",
                      dy: "0.35em",
                      pointerEvents: "none",
                      children: i + 1
                    }
                  )
                ]
              },
              i
            );
          }),
          anchor ? (() => {
            const [ax, ay] = toPad(anchor);
            const anchorDraggable = Boolean(onAnchorChange);
            return /* @__PURE__ */ jsxs(
              "g",
              {
                className: cn(
                  "panel-path-anchor",
                  anchorDraggable && "is-draggable",
                  selected === "anchor" && "is-selected"
                ),
                style: { pointerEvents: anchorDraggable ? "auto" : "none" },
                onPointerDown: anchorDraggable ? onPointerDownAnchor : void 0,
                children: [
                  anchorDraggable ? /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: HIT_RADIUS_PAD,
                      className: "panel-path-point-hit"
                    }
                  ) : null,
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: "3.4",
                      pointerEvents: "none"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    "circle",
                    {
                      cx: ax,
                      cy: ay,
                      r: "1.1",
                      className: "panel-path-anchor-dot",
                      pointerEvents: "none"
                    }
                  )
                ]
              }
            );
          })() : null
        ]
      }
    ),
    selected === "anchor" && anchor ? /* @__PURE__ */ jsx("div", { className: "panel-path-selected", children: /* @__PURE__ */ jsxs("span", { children: [
      "Home: ",
      anchor[0].toFixed(2),
      ", ",
      anchor[1].toFixed(2)
    ] }) }) : selected !== null && typeof selected === "number" && value[selected] ? /* @__PURE__ */ jsxs("div", { className: "panel-path-selected", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        "Point ",
        selected + 1,
        ": ",
        value[selected][0].toFixed(2),
        ",",
        " ",
        value[selected][1].toFixed(2)
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-path-remove",
          onClick: () => removePoint(selected),
          children: "Remove"
        }
      )
    ] }) : /* @__PURE__ */ jsx("div", { className: "panel-path-hint", children: "Click empty space to add \xB7 drag home or waypoints to move \xB7 double-click to remove" })
  ] });
}
function ControlPresets({
  presets,
  values,
  onChange,
  label = "Preset",
  className,
  actionHandlers
}) {
  const handleChange = (e) => {
    const picked = e.target.value;
    e.target.selectedIndex = 0;
    if (!picked) return;
    const preset = presets.find((p) => p.label === picked);
    if (!preset) return;
    if (preset.actionId) {
      actionHandlers?.[preset.actionId]?.();
      return;
    }
    if (preset.values) {
      const next = typeof preset.values === "function" ? preset.values(values) : { ...values, ...preset.values };
      onChange(next);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-presets", className), children: [
    /* @__PURE__ */ jsx("label", { className: "panel-presets-label", children: label }),
    /* @__PURE__ */ jsxs(
      "select",
      {
        className: "panel-preset-select",
        defaultValue: "",
        onChange: handleChange,
        "aria-label": label,
        children: [
          /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select preset\u2026" }),
          presets.map((preset) => /* @__PURE__ */ jsx("option", { value: preset.label, children: preset.label }, preset.label))
        ]
      }
    )
  ] });
}
function ControlOptionList({
  items,
  onSelect,
  title,
  emptyLabel = "No matches",
  className
}) {
  if (items.length === 0) {
    return emptyLabel ? /* @__PURE__ */ jsx("div", { className: cn("panel-option-empty", className), children: emptyLabel }) : null;
  }
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-option-list-wrap", className), children: [
    title ? /* @__PURE__ */ jsx("div", { className: "panel-option-list-title", children: title }) : null,
    /* @__PURE__ */ jsx("div", { className: "panel-option-list", role: "listbox", "aria-label": title ?? "Options", children: items.map((item) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        role: "option",
        className: "panel-option-item",
        disabled: item.disabled,
        onClick: () => onSelect(item.id),
        children: [
          /* @__PURE__ */ jsx("span", { className: "panel-option-item-label", children: item.label }),
          item.description ? /* @__PURE__ */ jsx("span", { className: "panel-option-item-desc", children: item.description }) : null
        ]
      },
      item.id
    )) })
  ] });
}
function ControlReadout({
  label,
  value,
  emptyValue = "None",
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-readout", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-readout-label", children: label }),
    /* @__PURE__ */ jsx("span", { className: "panel-readout-value", children: value?.trim() || emptyValue })
  ] });
}
function ControlReference({
  field,
  value,
  onChange,
  rootValues,
  className
}) {
  const [open, setOpen] = useState(false);
  const target = rootValues[field.collection] ?? [];
  const labelOf = (item) => field.optionLabel ? field.optionLabel(item) : item.id;
  const selectedIds = field.multiple ? Array.isArray(value) ? value : [] : typeof value === "string" && value ? [value] : [];
  const currentLabel = selectedIds.map((id) => {
    const item = target.find((it) => it.id === id);
    return item ? labelOf(item) : id;
  }).join(", ");
  const pick = (id) => {
    if (field.multiple) {
      const set = new Set(selectedIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      onChange(Array.from(set));
    } else {
      onChange(id);
      setOpen(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: `panel-reference${className ? ` ${className}` : ""}`, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "panel-reference-trigger",
        "aria-expanded": open,
        onClick: () => setOpen((v) => !v),
        children: /* @__PURE__ */ jsx(
          ControlReadout,
          {
            label: field.label,
            value: currentLabel,
            emptyValue: field.placeholder ?? "None"
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-collapse",
        "data-panel-open": open ? "true" : "false",
        "aria-hidden": !open,
        children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsx("div", { className: "panel-reference-picker", children: /* @__PURE__ */ jsx(
          ControlOptionList,
          {
            items: target.map((item) => ({
              id: item.id,
              label: labelOf(item),
              description: selectedIds.includes(item.id) ? "Selected" : void 0
            })),
            onSelect: pick,
            emptyLabel: "No items to link"
          }
        ) }) })
      }
    )
  ] });
}
function ControlToggle({
  label,
  value,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": value,
      "aria-label": label,
      onClick: () => onChange(!value),
      className: cn("panel-toggle", className),
      "data-panel-on": value ? "true" : "false",
      children: [
        /* @__PURE__ */ jsx("span", { className: "panel-toggle-label", children: label }),
        /* @__PURE__ */ jsx("span", { className: "panel-toggle-track", children: /* @__PURE__ */ jsx("span", { className: "panel-toggle-thumb" }) })
      ]
    }
  );
}
function ControlToggleGroup({
  label,
  value,
  options,
  onChange,
  className
}) {
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-toggle-group", className), children: [
    label ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-label", children: label }) : null,
    /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-toggle-group-track",
        role: "group",
        "aria-label": label,
        children: options.map((o) => {
          const isSelected = String(o.value) === String(value);
          return /* @__PURE__ */ jsxs(
            "button",
            {
              type: "button",
              className: "panel-toggle-group-btn",
              "data-panel-active": isSelected ? "true" : "false",
              "aria-pressed": isSelected,
              "aria-label": o.label ?? String(o.value),
              title: o.label,
              onClick: () => onChange(o.value),
              children: [
                o.icon ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-icon", "aria-hidden": "true", children: o.icon }) : null,
                o.label ? /* @__PURE__ */ jsx("span", { className: "panel-toggle-group-text", children: o.label }) : null
              ]
            },
            String(o.value)
          );
        })
      }
    )
  ] });
}
function ControlVec2({
  label,
  value,
  min,
  max,
  step,
  xLabel = "X",
  yLabel = "Y",
  onChange,
  className
}) {
  const setX = useCallback(
    (x) => onChange([x, value[1]]),
    [onChange, value]
  );
  const setY = useCallback(
    (y) => onChange([value[0], y]),
    [onChange, value]
  );
  return /* @__PURE__ */ jsxs("div", { className: cn("panel-vec2", className), children: [
    /* @__PURE__ */ jsx("span", { className: "panel-vec2-label", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "panel-vec2-row", children: [
      /* @__PURE__ */ jsx(
        ControlSlider,
        {
          label: xLabel,
          value: value[0],
          min,
          max,
          step,
          onChange: setX
        }
      ),
      /* @__PURE__ */ jsx(
        ControlSlider,
        {
          label: yLabel,
          value: value[1],
          min,
          max,
          step,
          onChange: setY
        }
      )
    ] })
  ] });
}
function libraryColorPopover(library) {
  return (props) => /* @__PURE__ */ jsx(
    ColorPopover,
    {
      color: props.color,
      onChange: props.onChange,
      disabled: props.disabled,
      ariaLabel: props.ariaLabel,
      triggerClassName: props.triggerClassName,
      triggerStyle: props.triggerStyle,
      library: library ? [...library] : void 0
    }
  );
}
function renderPanelField(field, ctx) {
  const { values, setValues, rootValues, setRootValues, actionHandlers } = ctx;
  const setKey = (key, val) => {
    setValues({ ...values, [key]: val });
  };
  const withDescription = (description, node) => description ? /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "panel-field-description", children: description }),
    node
  ] }) : node;
  switch (field.type) {
    case "action": {
      if (field.when && !field.when(values)) return null;
      const handler = actionHandlers?.[field.actionId];
      return {
        reactKey: field.actionId,
        node: /* @__PURE__ */ jsx(
          ControlAction,
          {
            label: field.label,
            description: field.description,
            variant: field.variant,
            disabled: !handler,
            onClick: () => handler?.()
          }
        )
      };
    }
    case "presets": {
      return {
        reactKey: `presets-${field.presets.map((p) => p.label).join("-")}`,
        node: /* @__PURE__ */ jsx(
          ControlPresets,
          {
            label: field.label,
            presets: field.presets,
            values,
            onChange: setValues,
            actionHandlers
          }
        )
      };
    }
    case "slider":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlSlider,
            {
              label: field.label,
              value: values[field.key],
              min: field.min,
              max: field.max,
              step: field.step,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "toggle":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlToggle,
            {
              label: field.label,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "select":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlSelect,
            {
              label: field.label,
              value: values[field.key],
              options: field.options,
              layout: field.layout,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "toggle-group":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlToggleGroup,
            {
              label: field.label,
              value: values[field.key],
              options: field.options,
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "vec2":
      return {
        reactKey: field.key,
        node: /* @__PURE__ */ jsx(
          ControlVec2,
          {
            label: field.label,
            value: values[field.key],
            min: field.min,
            max: field.max,
            step: field.step,
            xLabel: field.xLabel,
            yLabel: field.yLabel,
            onChange: (v) => setKey(field.key, v)
          }
        )
      };
    case "image":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlImageInput,
            {
              label: field.label,
              value: values[field.key] ?? "",
              readonly: field.readonly,
              accept: field.accept,
              emptyLabel: field.emptyLabel,
              onChange: field.readonly ? void 0 : (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "path": {
      const anchor = field.anchorKey ? values[field.anchorKey] : void 0;
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlPath,
            {
              label: field.label,
              value: values[field.key] ?? [],
              min: field.min,
              max: field.max,
              anchor,
              onChange: (v) => setKey(field.key, v),
              onAnchorChange: field.anchorKey ? (v) => setKey(field.anchorKey, v) : void 0
            }
          )
        )
      };
    }
    case "collection": {
      const collectionField = field;
      return {
        reactKey: field.key,
        node: /* @__PURE__ */ jsx(
          ControlCollection,
          {
            field: collectionField,
            items: values[field.key] ?? [],
            onChange: (next) => setKey(field.key, next),
            renderContext: ctx,
            onSelect: ctx.onCollectionSelect ? (id) => ctx.onCollectionSelect?.(field.key, id) : void 0
          }
        )
      };
    }
    case "reference":
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlReference,
            {
              field,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v),
              rootValues,
              setRootValues
            }
          )
        )
      };
    case "color":
      if (field.library || field.persist) {
        return {
          reactKey: field.key,
          node: withDescription(
            field.description,
            /* @__PURE__ */ jsx(
              ControlLibraryColor,
              {
                label: field.label,
                value: values[field.key] ?? null,
                library: field.library,
                allowClear: field.persist === "backgroundColor",
                renderColorPopover: libraryColorPopover(field.library),
                onChange: (v) => setKey(field.key, v)
              }
            )
          )
        };
      }
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlColorInput,
            {
              label: field.label,
              value: values[field.key],
              onChange: (v) => setKey(field.key, v)
            }
          )
        )
      };
    case "gradient-stops": {
      const stops = normalizeGradientStops(values[field.key]);
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlGradientStops,
            {
              label: field.label,
              stops,
              layout: field.layout,
              library: field.library,
              renderColorPopover: libraryColorPopover(field.library),
              onChange: (next) => setKey(field.key, next)
            }
          )
        )
      };
    }
    case "stripe-table": {
      const opts = field.options ?? {};
      const rampKey = opts.rampEasingKey;
      const thresholdKey = opts.thresholdEasingKey;
      return {
        reactKey: field.key,
        node: withDescription(
          field.description,
          /* @__PURE__ */ jsx(
            ControlStripeColorsTable,
            {
              value: values[field.key] ?? [],
              library: field.library,
              renderColorPopover: libraryColorPopover(field.library),
              showRampEasing: opts.showRampEasing,
              showColorControls: opts.showColorControls,
              showSavePalette: opts.showSavePalette,
              rampEasingOptions: rampKey ? EASING_OPTIONS : void 0,
              rampEasingValue: rampKey ? values[rampKey] : void 0,
              onRampEasingChange: rampKey ? (v) => setKey(rampKey, v) : void 0,
              thresholdEasingOptions: thresholdKey ? EASING_OPTIONS : void 0,
              thresholdEasingValue: thresholdKey ? values[thresholdKey] : void 0,
              onThresholdEasingChange: thresholdKey ? (v) => setKey(thresholdKey, v) : void 0,
              onSavePalette: opts.showSavePalette ? actionHandlers?.[`${field.key}:savePalette`] : void 0,
              onChange: (next) => setKey(field.key, next)
            }
          )
        )
      };
    }
  }
}
function ControlThemeToggle({
  className,
  storageKey
}) {
  const theme = usePanelTheme();
  return /* @__PURE__ */ jsx(
    ControlToggleGroup,
    {
      className: cn("panel-theme-toggle", className),
      value: theme,
      onChange: (v) => applyPanelTheme(v, storageKey),
      options: [
        { value: "light", icon: /* @__PURE__ */ jsx(SunIcon, {}) },
        { value: "dark", icon: /* @__PURE__ */ jsx(MoonIcon, {}) }
      ]
    }
  );
}
function SunIcon() {
  return /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "4", strokeWidth: "2" }),
    /* @__PURE__ */ jsx(
      "path",
      {
        strokeWidth: "2",
        strokeLinecap: "round",
        d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      }
    )
  ] });
}
function MoonIcon() {
  return /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx(
    "path",
    {
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    }
  ) });
}
var MARGIN = 16;
var SNAP_ZONE = 0.05;
var MIN_W = 240;
var MIN_H = 200;
var PANEL_MAX_HEIGHT = 664;
var EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
var MOMENTUM = 120;
var RESIZE_DIRS = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw"
];
var HINT_SIDES = [
  "left",
  "right",
  "top",
  "bottom"
];
var clamp2 = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
var vw = () => document.documentElement.clientWidth;
var vh = () => document.documentElement.clientHeight;
var reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var pin = (el) => {
  for (const a of el.getAnimations()) {
    if (typeof CSSTransition === "undefined" || !(a instanceof CSSTransition)) {
      a.finish();
    }
  }
  const r0 = el.getBoundingClientRect();
  const z = r0.width / el.offsetWidth || 1;
  el.style.transition = "none";
  el.style.left = "0px";
  el.style.top = "0px";
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.maxWidth = `${(vw() - 2 * MARGIN) / z}px`;
  el.style.maxHeight = `${Math.min(vh() - 2 * MARGIN, PANEL_MAX_HEIGHT) / z}px`;
  const probe = el.getBoundingClientRect();
  const toStyleX = (x) => (x - probe.left) / z;
  const toStyleY = (y) => (y - probe.top) / z;
  el.style.left = `${toStyleX(r0.left)}px`;
  el.style.top = `${toStyleY(r0.top)}px`;
  const r = el.getBoundingClientRect();
  return { r, z, toStyleX, toStyleY };
};
var snapSides = (left, top, w, h) => {
  const zoneX = vw() * SNAP_ZONE;
  const zoneY = vh() * SNAP_ZONE;
  const distL = left - MARGIN;
  const distR = vw() - (left + w) - MARGIN;
  const distT = top - MARGIN;
  const distB = vh() - (top + h) - MARGIN;
  const x = Math.min(distL, distR) < zoneX ? distL <= distR ? "left" : "right" : "";
  const y = Math.min(distT, distB) < zoneY ? distT <= distB ? "top" : "bottom" : "";
  return { x, y };
};
var setHints = (el, x, y) => {
  if (el.dataset.snapX !== x) el.dataset.snapX = x;
  if (el.dataset.snapY !== y) el.dataset.snapY = y;
};
var animateTo = (el, m, left, top) => {
  const styleLeft = `${m.toStyleX(left)}px`;
  const styleTop = `${m.toStyleY(top)}px`;
  if (reducedMotion()) {
    el.style.left = styleLeft;
    el.style.top = styleTop;
    return;
  }
  el.style.transition = `left 320ms ${EASE}, top 320ms ${EASE}`;
  el.style.left = styleLeft;
  el.style.top = styleTop;
  const clear = () => {
    el.style.transition = "";
  };
  el.addEventListener("transitionend", clear, { once: true });
  window.setTimeout(clear, 400);
};
var trackPointer = (el, cursor, onMove, onDone) => {
  const prevCursor = document.body.style.cursor;
  document.body.style.cursor = cursor;
  const up = () => {
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", up, true);
    document.body.style.cursor = prevCursor;
    el.style.transition = "";
    onDone?.();
  };
  window.addEventListener("pointermove", onMove, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
};
function usePanelDragResize({
  enabled,
  collapsed,
  ready = true,
  storageKey
}) {
  const panelRef = useRef(null);
  const persistKey = storageKey ? `panels:float:${storageKey}` : null;
  const persist = useCallback(() => {
    const el = panelRef.current;
    if (!el || !persistKey) return;
    try {
      sessionStorage.setItem(persistKey, el.getAttribute("style") ?? "");
    } catch {
    }
  }, [persistKey]);
  useEffect(() => {
    if (!enabled || !ready) return;
    const el = panelRef.current;
    if (!el) return;
    let restored = false;
    if (persistKey) {
      try {
        const saved = sessionStorage.getItem(persistKey);
        if (saved) {
          el.setAttribute("style", saved);
          restored = true;
        }
      } catch {
      }
    }
    if (!restored) {
      const m = pin(el);
      const left = vw() - m.r.width - MARGIN;
      const top = vh() > PANEL_MAX_HEIGHT ? Math.max(MARGIN, Math.round((vh() - m.r.height) / 2)) : MARGIN;
      el.style.left = `${m.toStyleX(left)}px`;
      el.style.top = `${m.toStyleY(top)}px`;
      el.style.transition = "";
    }
    const reclamp = () => {
      if (!el.style.left) return;
      const m = pin(el);
      let w = m.r.width;
      let h = m.r.height;
      if (w > vw() - 2 * MARGIN) {
        w = Math.max(MIN_W, vw() - 2 * MARGIN);
        el.style.width = `${w / m.z}px`;
      }
      if (el.style.height && h > vh() - 2 * MARGIN) {
        h = Math.max(MIN_H, vh() - 2 * MARGIN);
        el.style.height = `${h / m.z}px`;
      }
      el.style.left = `${m.toStyleX(clamp2(m.r.left, MARGIN, vw() - w - MARGIN))}px`;
      el.style.top = `${m.toStyleY(clamp2(m.r.top, MARGIN, vh() - h - MARGIN))}px`;
      el.style.transition = "";
      persist();
    };
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => {
      window.removeEventListener("resize", reclamp);
      el.style.transition = "";
      persist();
    };
  }, [enabled, ready, persistKey, persist]);
  useEffect(() => {
    if (!enabled || !ready || collapsed) return;
    const el = panelRef.current;
    if (!el || reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const ox = r.left - MARGIN < 24 ? "left" : vw() - r.right - MARGIN < 24 ? "right" : "50%";
    const oy = r.top - MARGIN < 24 ? "top" : vh() - r.bottom - MARGIN < 24 ? "bottom" : "50%";
    el.style.transformOrigin = `${ox} ${oy}`;
    el.animate(
      [
        { opacity: 0, transform: "scale(0.6)" },
        { opacity: 1, transform: "scale(1)" }
      ],
      { duration: 200, easing: "cubic-bezier(0.17, 1, 0.32, 1)" }
    );
  }, [enabled, ready, collapsed]);
  const settle = useCallback(
    (el, m, vx, vy) => {
      const cur = el.getBoundingClientRect();
      const maxL = vw() - cur.width - MARGIN;
      const maxT = vh() - cur.height - MARGIN;
      let left = clamp2(cur.left + vx * MOMENTUM, MARGIN, maxL);
      let top = clamp2(cur.top + vy * MOMENTUM, MARGIN, maxT);
      const armed = snapSides(left, top, cur.width, cur.height);
      if (armed.x === "left") left = MARGIN;
      else if (armed.x === "right") left = Math.max(MARGIN, maxL);
      if (armed.y === "top") top = MARGIN;
      else if (armed.y === "bottom") top = Math.max(MARGIN, maxT);
      setHints(el, "", "");
      animateTo(el, m, left, top);
      persist();
    },
    [persist]
  );
  const onHeaderPointerDown = useCallback(
    (e) => {
      const el = panelRef.current;
      if (!enabled || !el || e.button !== 0) return;
      if (e.target.closest("button, select, input, a")) return;
      e.preventDefault();
      const m = pin(el);
      const startX = e.clientX;
      const startY = e.clientY;
      let lastX = startX;
      let lastY = startY;
      let lastT = e.timeStamp;
      let vx = 0;
      let vy = 0;
      trackPointer(
        el,
        "grabbing",
        (ev) => {
          const dt = ev.timeStamp - lastT;
          if (dt > 0) {
            vx = 0.8 * ((ev.clientX - lastX) / dt) + 0.2 * vx;
            vy = 0.8 * ((ev.clientY - lastY) / dt) + 0.2 * vy;
          }
          lastX = ev.clientX;
          lastY = ev.clientY;
          lastT = ev.timeStamp;
          const maxL = vw() - m.r.width - MARGIN;
          const maxT = vh() - m.r.height - MARGIN;
          const left = clamp2(m.r.left + ev.clientX - startX, MARGIN, maxL);
          const top = clamp2(m.r.top + ev.clientY - startY, MARGIN, maxT);
          el.style.left = `${m.toStyleX(left)}px`;
          el.style.top = `${m.toStyleY(top)}px`;
          const armed = snapSides(left, top, m.r.width, m.r.height);
          setHints(el, armed.x, armed.y);
        },
        () => settle(el, m, vx, vy)
      );
    },
    [enabled, settle]
  );
  const headerElRef = useRef(null);
  const wheelGesture = useRef(null);
  useEffect(() => {
    const header = headerElRef.current;
    if (!enabled || !ready || !header) return;
    const onWheel = (e) => {
      const el = panelRef.current;
      if (!el) return;
      e.preventDefault();
      const now = performance.now();
      let g = wheelGesture.current;
      if (!g) {
        g = { m: pin(el), vx: 0, vy: 0, lastT: now, endTimer: 0 };
        wheelGesture.current = g;
      }
      window.clearTimeout(g.endTimer);
      const dx = -e.deltaX;
      const dy = -e.deltaY;
      const dt = Math.max(1, now - g.lastT);
      g.vx = 0.8 * (dx / dt) + 0.2 * g.vx;
      g.vy = 0.8 * (dy / dt) + 0.2 * g.vy;
      g.lastT = now;
      const r = el.getBoundingClientRect();
      const maxL = vw() - r.width - MARGIN;
      const maxT = vh() - r.height - MARGIN;
      const left = clamp2(r.left + dx, MARGIN, maxL);
      const top = clamp2(r.top + dy, MARGIN, maxT);
      el.style.left = `${g.m.toStyleX(left)}px`;
      el.style.top = `${g.m.toStyleY(top)}px`;
      const armed = snapSides(left, top, r.width, r.height);
      setHints(el, armed.x, armed.y);
      g.endTimer = window.setTimeout(() => {
        const gesture = wheelGesture.current;
        wheelGesture.current = null;
        if (gesture) settle(el, gesture.m, gesture.vx, gesture.vy);
      }, 90);
    };
    header.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      header.removeEventListener("wheel", onWheel);
      if (wheelGesture.current) {
        window.clearTimeout(wheelGesture.current.endTimer);
        wheelGesture.current = null;
      }
    };
  }, [enabled, ready, settle]);
  const headerRef = useCallback((node) => {
    headerElRef.current = node;
  }, []);
  const onResizePointerDown = useCallback(
    (e, dir) => {
      const el = panelRef.current;
      if (!enabled || !el || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const m = pin(el);
      if (dir.includes("n") || dir.includes("s")) {
        el.style.height = `${m.r.height / m.z}px`;
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const right = m.r.left + m.r.width;
      const bottom = m.r.top + m.r.height;
      const cursor = getComputedStyle(e.currentTarget).cursor;
      trackPointer(
        el,
        cursor,
        (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (dir.includes("e")) {
            const w = clamp2(m.r.width + dx, MIN_W, vw() - m.r.left - MARGIN);
            el.style.width = `${w / m.z}px`;
          }
          if (dir.includes("w")) {
            const w = clamp2(m.r.width - dx, MIN_W, right - MARGIN);
            el.style.width = `${w / m.z}px`;
            el.style.left = `${m.toStyleX(right - w)}px`;
          }
          if (dir.includes("s")) {
            const h = clamp2(m.r.height + dy, MIN_H, vh() - m.r.top - MARGIN);
            el.style.height = `${h / m.z}px`;
          }
          if (dir.includes("n")) {
            const h = clamp2(m.r.height - dy, MIN_H, bottom - MARGIN);
            el.style.height = `${h / m.z}px`;
            el.style.top = `${m.toStyleY(bottom - h)}px`;
          }
        },
        persist
      );
    },
    [enabled, persist]
  );
  return { panelRef, headerRef, onHeaderPointerDown, onResizePointerDown };
}

// src/styles.ts
var PANEL_STYLE_ID = "shader-dev-styles";
var PANEL_CSS = `
[data-panel] {
  --panel-bg: #1c1c1c;
  --panel-border: #262626;
  --panel-text: #d4d4d4;
  --panel-text-muted: #737373;
  --panel-surface: #2a2a2a;
  --panel-surface-active: #313131;
  --panel-toggle-hover: #242424;
  --panel-surface-idle-fill: #333333;
  --panel-hash: rgba(255, 255, 255, 0.12);
  --panel-handle: #a3a3a3;
  --panel-label: #d4d4d4;
  --panel-label-active: #ededed;
  --panel-label-muted: #737373;
  --panel-divider: #262626;
  --panel-muted-icon: #6f6f6f;
  --panel-swatch-border: #4a4a4a;
  --panel-kbd-bg: #2a2a2a;
  --panel-action-bg: #2a2a2a;
  --panel-action-bg-hover: #313131;
  --panel-action-text: #d4d4d4;
  --panel-action-text-hover: #ededed;
  --panel-danger: #f87171;
  --panel-danger-hover: #fca5a5;
  --panel-header-border: transparent;
  --panel-close-icon: #d4d4d4;
  --panel-close-icon-hover: #ededed;
  --panel-scrollbar-thumb: rgba(255, 255, 255, 0.25);
  --panel-shadow: 0 1px 2px rgb(0 0 0 / 0.28), 0 12px 32px rgb(0 0 0 / 0.32);
}

[data-panel][data-panel-theme="light"] {
  --panel-bg: #ffffff;
  --panel-border: #f3f3f3;
  --panel-text: #525252;
  --panel-text-muted: #737373;
  --panel-surface: #eeeeee;
  --panel-surface-active: #e6e6e6;
  --panel-toggle-hover: #f3f3f3;
  --panel-surface-idle-fill: #e0e0e0;
  --panel-hash: #d4d4d4;
  --panel-handle: #8a8a8a;
  --panel-label: #525252;
  --panel-label-active: #404040;
  --panel-label-muted: #737373;
  --panel-divider: #f3f3f3;
  --panel-muted-icon: #a3a3a3;
  --panel-swatch-border: #d4d4d4;
  --panel-kbd-bg: #eeeeee;
  --panel-action-bg: #eeeeee;
  --panel-action-bg-hover: #e6e6e6;
  --panel-action-text: #525252;
  --panel-action-text-hover: #404040;
  --panel-danger: #dc2626;
  --panel-danger-hover: #b91c1c;
  --panel-header-border: transparent;
  --panel-close-icon: #737373;
  --panel-close-icon-hover: #404040;
  --panel-scrollbar-thumb: rgba(0, 0, 0, 0.25);
}

/* Animatable fade height for the body's cut-off mask. */
@property --panel-fade {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

[data-panel],
[data-panel] *,
[data-panel] *::before,
[data-panel] *::after {
  box-sizing: border-box;
}

/* Chrome elements shouldn't be selectable \u2014 labels, titles, buttons. Only
   inputs and the prompt code block opt back in via the override below. */
[data-panel] {
  -webkit-user-select: none;
  user-select: none;
}
[data-panel] input,
[data-panel] textarea,
[data-panel] .panel-prompt-pre,
[data-panel] .panel-paste-textarea,
[data-panel] .panel-text-input,
[data-panel] .panel-textarea-input,
[data-panel] .panel-search-input {
  -webkit-user-select: text;
  user-select: text;
}

[data-panel] button:not([class]) {
  background: transparent;
  border: 0;
  padding: 0;
  margin: 0;
  font-family: inherit;
  /* Intentionally NOT inheriting font-size \u2014 leaves component classes free to
     set their own without losing to specificity. */
  color: inherit;
  cursor: pointer;
}

/* All panel chrome buttons carry panel-* classes \u2014 zero host-app borders
   (Tailwind preflight, browser defaults, etc.) before component styles apply. */
[data-panel] button[class*="panel-"] {
  border: 0;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}

[data-panel] input,
[data-panel] select,
[data-panel] textarea {
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: inherit;
  border: 0;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  box-shadow: none;
}

[data-panel] input.panel-color-text {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: var(--panel-label);
}

.panel-floating {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  bottom: 16px;
  z-index: 9999;
  display: flex;
  width: 360px;
  flex-direction: column;
  opacity: 1;
  filter: blur(0);
  transition-property: transform, opacity, filter;
  transition-duration: 280ms, 200ms, 200ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1), ease-in, ease-in;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 11px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
.panel-floating[data-panel-side="left"] { left: 16px; }
.panel-floating[data-panel-side="right"] { right: 16px; }
.panel-floating[data-panel-collapsed="true"][data-panel-side="left"] { transform: translateX(calc(-100% - 16px)); }
.panel-floating[data-panel-collapsed="true"][data-panel-side="right"] { transform: translateX(calc(100% + 16px)); }
.panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) {
  opacity: 0;
  filter: blur(4px);
  pointer-events: none;
}

/* Peek preview \u2014 a scaled-down sliver slides in when the viewport edge is
   hovered while collapsed. Overrides the fully-hidden collapsed transform. */
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"] { cursor: pointer; }
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"][data-panel-side="right"] {
  transform: translateX(calc(100% - 56px)) scale(0.9);
  transform-origin: right center;
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
}
.panel-floating[data-panel-collapsed="true"][data-panel-peek="true"][data-panel-side="left"] {
  transform: translateX(calc(-100% + 56px)) scale(0.9);
  transform-origin: left center;
  opacity: 1;
  filter: blur(0);
  pointer-events: auto;
}

/* \u2500\u2500 Free-float mode \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The drag hook owns left/top inline; the stylesheet stops animating the
   frame so gestures never fight a transition. Collapse hides instantly \u2014
   the hook plays the scale-up entrance when the panel surfaces. */
.panel-floating[data-panel-float="true"] {
  bottom: auto;
  /* Cap the panel; a taller viewport centers it vertically on first open
     (see PANEL_MAX_HEIGHT in use-drag-resize). */
  max-height: min(calc(100dvh - 32px), 664px);
  transition: none;
}
.panel-floating[data-panel-float="true"][data-panel-collapsed="true"] {
  display: none;
}
.panel-floating[data-panel-float="true"] .panel-panel-header {
  cursor: grab;
  touch-action: none;
}

/* Invisible resize hit areas, inset so the rounded frame stays clean. */
.panel-resize {
  position: absolute;
  z-index: 1000;
  touch-action: none;
}
.panel-resize-n, .panel-resize-s {
  right: 12px;
  left: 12px;
  height: 5px;
  cursor: ns-resize;
}
.panel-resize-e, .panel-resize-w {
  top: 12px;
  bottom: 12px;
  width: 5px;
  cursor: ew-resize;
}
.panel-resize-n { top: 0; }
.panel-resize-s { bottom: 0; }
.panel-resize-e { right: 0; }
.panel-resize-w { left: 0; }
.panel-resize-ne, .panel-resize-nw, .panel-resize-se, .panel-resize-sw {
  width: 12px;
  height: 12px;
}
.panel-resize-ne { top: 0; right: 0; cursor: nesw-resize; }
.panel-resize-nw { top: 0; left: 0; cursor: nwse-resize; }
.panel-resize-se { right: 0; bottom: 0; cursor: nwse-resize; }
.panel-resize-sw { bottom: 0; left: 0; cursor: nesw-resize; }

/* Hovering an edge handle shows a light pill inside that edge. */
.panel-resize-n::after, .panel-resize-s::after,
.panel-resize-e::after, .panel-resize-w::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.6);
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 140ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.35, 1.55, 0.65, 1);
}
[data-panel][data-panel-theme="light"] .panel-resize-n::after,
[data-panel][data-panel-theme="light"] .panel-resize-s::after,
[data-panel][data-panel-theme="light"] .panel-resize-e::after,
[data-panel][data-panel-theme="light"] .panel-resize-w::after {
  background: rgb(0 0 0 / 0.35);
}
.panel-resize-e::after, .panel-resize-w::after {
  top: 50%;
  width: 3px;
  height: 28px;
  margin-top: -14px;
}
.panel-resize-n::after, .panel-resize-s::after {
  left: 50%;
  width: 28px;
  height: 3px;
  margin-left: -14px;
}
.panel-resize-w::after { left: 7px; }
.panel-resize-e::after { right: 7px; }
.panel-resize-n::after { top: 7px; }
.panel-resize-s::after { bottom: 7px; }
.panel-resize-n:hover::after, .panel-resize-s:hover::after,
.panel-resize-e:hover::after, .panel-resize-w:hover::after {
  opacity: 1;
  transform: scale(1);
}

/* Snap hint: a pill OUTSIDE the panel on the side it will dock to, armed
   via data-snap-x / data-snap-y while dragging near a viewport edge. */
.panel-snap-hint {
  pointer-events: none;
  position: absolute;
  z-index: 1001;
  border-radius: 999px;
  background: var(--panel-bg);
  opacity: 0;
  transition:
    opacity 140ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 220ms cubic-bezier(0.35, 1.55, 0.65, 1);
}
[data-panel][data-panel-theme="light"] .panel-snap-hint {
  border: 1px solid var(--panel-border);
}
.panel-snap-hint-left, .panel-snap-hint-right {
  top: 50%;
  width: 4px;
  height: 28px;
  transform: translateY(-50%) scale(0.4);
}
.panel-snap-hint-top, .panel-snap-hint-bottom {
  left: 50%;
  width: 28px;
  height: 4px;
  transform: translateX(-50%) scale(0.4);
}
.panel-snap-hint-left { left: -8px; }
.panel-snap-hint-right { right: -8px; }
.panel-snap-hint-top { top: -8px; }
.panel-snap-hint-bottom { bottom: -8px; }
[data-snap-x="left"] .panel-snap-hint-left,
[data-snap-x="right"] .panel-snap-hint-right {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}
[data-snap-y="top"] .panel-snap-hint-top,
[data-snap-y="bottom"] .panel-snap-hint-bottom {
  opacity: 1;
  transform: translateX(-50%) scale(1);
}
@media (prefers-reduced-motion: reduce) {
  .panel-floating { transition: none; }
  .panel-resize::after, .panel-snap-hint { transition: none; }
  .panel-panel-body { transition: none; }
  .panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) {
    opacity: 0;
    filter: none;
  }
  .panel-panel,
  .panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) .panel-panel {
    transition: none;
    opacity: 1;
    transform: none;
  }
}

.panel-panel {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--panel-text);
  box-shadow: var(--panel-shadow);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-property: opacity, transform;
  transition-duration: 220ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-floating[data-panel-collapsed="true"]:not([data-panel-peek="true"]) .panel-panel {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
  transition-timing-function: ease-in;
  transition-duration: 180ms;
}

/* Invisible hover/click strip pinned to the viewport edge \u2014 reveals the peek
   (and reopens on click) while the panel is collapsed. */
.panel-edge-sensor {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 24px;
  z-index: 9998;
  cursor: pointer;
}
.panel-edge-sensor[data-panel-side="right"] { right: 0; }
.panel-edge-sensor[data-panel-side="left"] { left: 0; }
.panel-edge-sensor[data-panel-inline="true"] { display: none; }

/* Inline panels (ToolShell) use absolute positioning within the overlay. */
.panel-floating[data-panel-inline="true"] {
  position: absolute;
  z-index: 20;
}

/* Transparent click-catcher over the peeking panel \u2014 any click opens it fully
   instead of hitting a control in the scaled-down preview. */
.panel-peek-catch {
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}

.panel-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--panel-header-border);
  padding: 8px 8px 4px 12px;
  font-size: 11px;
}
.panel-panel-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.panel-panel-title {
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* An empty title collapses so the switcher's inner padding lines its text up
   with the body content's left edge. */
.panel-panel-title:empty { display: none; }
.panel-panel-title:empty + .panel-switcher { margin-left: -8px; }
.panel-panel-header-end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}
/* Header variant of the toggle group \u2014 compact, icon-only, non-growing. */
.panel-toggle-group.panel-theme-toggle {
  width: auto;
  padding: 0;
}
.panel-toggle-group.panel-theme-toggle .panel-toggle-group-track {
  gap: 2px;
  padding: 2px;
}
[data-panel] .panel-toggle-group.panel-theme-toggle .panel-toggle-group-btn {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  padding: 0;
}
.panel-switcher {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  background: transparent;
  color: var(--panel-text);
  border-radius: 4px;
  padding: 3px 20px 3px 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 10px) 50%, calc(100% - 6px) 50%;
  background-size: 4px 4px, 4px 4px;
  background-repeat: no-repeat;
  max-width: 110px;
  text-overflow: ellipsis;
  overflow: hidden;
  transition: background-color 150ms ease;
}
.panel-switcher:hover { background-color: var(--panel-surface); }
.panel-switcher:focus { outline: none; background-color: var(--panel-surface); }

/* \u2500\u2500 Header select \u2014 custom switcher dropdown (PanelHeaderSelect) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Trigger fits its label when closed and animates its width to match the
   menu while open; the menu renders inline-absolute inside the header so it
   shares the panel's stacking. */
.panel-hselect {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}
[data-panel] .panel-hselect-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: transparent;
  color: var(--panel-text);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    width 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-hselect-trigger:hover,
[data-panel] .panel-hselect-trigger:focus-visible,
[data-panel] .panel-hselect-trigger[aria-expanded="true"] {
  outline: none;
  background-color: var(--panel-surface);
}
/* No ellipsis \u2014 the width fits the label; clip only while animating. */
.panel-hselect-value {
  min-width: 0;
  overflow: hidden;
}
.panel-hselect-chevron {
  width: 12px;
  height: 12px;
  opacity: 0.6;
  flex-shrink: 0;
}
/* Invisible natural-width mirror of the trigger \u2014 measured so the trigger's
   explicit (animatable) width can track the current label. */
.panel-hselect-sizer {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
}
.panel-hselect-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1002;
  width: max-content;
  min-width: 100%;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.28), 0 12px 32px rgb(0 0 0 / 0.32);
  scrollbar-width: thin;
  scrollbar-color: var(--panel-scrollbar-thumb) transparent;
  animation: panel-hselect-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
@keyframes panel-hselect-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
[data-panel] .panel-hselect-option {
  /* No width: 100% \u2014 a percentage here collapses the menu's max-content
     sizing to its min-width and clips every label. Block-level flex options
     stretch to the menu naturally. */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 0;
  background: transparent;
  color: var(--panel-label);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 120ms cubic-bezier(0.22, 1, 0.36, 1),
    color 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-hselect-option[data-panel-active="true"] {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-hselect-option[aria-selected="true"] {
  color: var(--panel-text);
}
.panel-hselect-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.9;
}
@media (prefers-reduced-motion: reduce) {
  [data-panel] .panel-hselect-trigger { transition: none; }
  .panel-hselect-menu { animation: none; }
  [data-panel] .panel-hselect-option { transition: none; }
}

.panel-close-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--panel-close-icon);
  transition-property: color, background-color, scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
.panel-close-btn::before {
  content: "";
  position: absolute;
  inset: -8px;
}
.panel-close-btn:active {
  scale: 0.96;
}
.panel-close-btn:hover,
.panel-close-btn:focus-visible {
  color: var(--panel-close-icon-hover);
  background: var(--panel-surface);
}
.panel-close-btn svg { width: 12px; height: 12px; }
/* Dense-row variant \u2014 same treatment, smaller footprint and hit area. */
.panel-close-btn[data-panel-size="sm"] { width: 18px; height: 18px; }
.panel-close-btn[data-panel-size="sm"]::before { inset: -4px; }
.panel-close-btn[data-panel-size="sm"] svg { width: 10px; height: 10px; }

.panel-panel-body {
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 12px 32px;
  scrollbar-width: thin;
  scrollbar-color: var(--panel-scrollbar-thumb) transparent;
  /* Content fades out at the bottom while more of it is cut off below
     (.panel-body-cut-off is toggled from the scroll/resize observer). */
  mask-image: linear-gradient(
    to bottom,
    black calc(100% - var(--panel-fade)),
    transparent 100%
  );
  transition: --panel-fade 240ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-panel-body.panel-body-cut-off {
  --panel-fade: 56px;
}

.panel-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 8px;
}

/* Animation transport \u2014 pinned at the top of the panel body. */
.panel-animation {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--panel-divider);
}
.panel-animation-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-animation-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
[data-panel] .panel-animation-btn {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--panel-action-text);
  background: var(--panel-action-bg);
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-animation-btn svg {
  width: 12px;
  height: 12px;
}
[data-panel] .panel-animation-btn:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-animation-btn-primary {
  width: 28px;
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-animation-btn-primary:hover {
  background: var(--panel-handle);
  color: var(--panel-bg);
}
[data-panel] .panel-animation-btn-reset {
  margin-left: auto;
}
.panel-animation-time {
  flex: 1;
  min-width: 0;
  padding: 0 6px;
  font-family: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
  text-align: center;
}

.panel-shortcut-hint {
  font-size: 11px;
  color: var(--panel-text-muted);
}
.panel-shortcut-hint kbd {
  border-radius: 4px;
  padding: 0 4px;
  font-family: inherit;
  background: var(--panel-kbd-bg);
}

.panel-actions {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--panel-divider);
  padding-top: 12px;
}

.panel-export-format-row {
  display: flex;
  gap: 6px;
}
.panel-export-format-row .panel-action-btn {
  flex: 1;
  min-width: 0;
}

/* Scoped under [data-panel] to beat the global button reset on
   specificity \u2014 otherwise the always-on surface fill loses. */
[data-panel] .panel-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 24px;
  padding: 0 12px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  text-align: center;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  transition-property: background-color, color, scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
[data-panel] .panel-action-btn:active:not(:disabled) {
  scale: 0.98;
}
[data-panel] .panel-action-btn:hover:not(.panel-action-btn-primary):not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
[data-panel] .panel-action-btn-primary {
  background: var(--panel-handle);
  color: var(--panel-bg);
  border-color: transparent;
}
[data-panel] .panel-action-btn-primary:hover:not(:disabled) {
  background: var(--panel-handle);
  filter: brightness(1.08);
  color: var(--panel-bg);
}
[data-panel] .panel-action-btn-destructive {
  background: color-mix(in srgb, var(--panel-danger) 10%, var(--panel-action-bg));
  color: var(--panel-danger);
}
[data-panel] .panel-action-btn-destructive:hover:not(:disabled) {
  background: color-mix(in srgb, var(--panel-danger) 16%, var(--panel-action-bg-hover));
  color: var(--panel-danger-hover);
}

.panel-action-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.panel-action-group .panel-action-field {
  min-width: 0;
}
.panel-action-group .panel-action-btn {
  width: 100%;
  padding-left: 8px;
  padding-right: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-action-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.panel-status {
  padding: 0 4px;
  font-size: 11px;
  color: var(--panel-text-muted);
}

/* Export group \u2014 pinned at the top of the actions block, separated from the
   JSON/reset buttons by a hairline divider. */
.panel-export {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--panel-divider);
}
.panel-export-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-row {
  display: flex;
  gap: 6px;
}
.panel-export-row .panel-action-btn {
  flex: 1;
}
.panel-export-hint {
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-gif {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid var(--panel-divider);
}
.panel-export-gif-label {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
  padding: 0 2px;
}
.panel-export-gif-row {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border-radius: 4px;
  background: var(--panel-surface);
}
[data-panel] .panel-export-gif-row .panel-export-res-btn {
  flex: 1 1 0;
  min-width: 0;
}

/* Segmented resolution selector for the hi-res PNG. */
.panel-export-res-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.panel-export-res {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 2px;
  border-radius: 4px;
  background: var(--panel-surface);
}
[data-panel] .panel-export-res-screen .panel-export-res-btn,
[data-panel] .panel-export-res-print .panel-export-res-btn {
  flex: 1 1 0;
  min-width: 0;
}
[data-panel] .panel-export-res-btn {
  min-width: 2.5rem;
  height: 20px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: var(--panel-text-muted);
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-export-res-btn:hover {
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-export-res-active,
[data-panel] .panel-export-res-active:hover {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-export-rec,
[data-panel] .panel-export-rec:hover {
  background: #e5484d;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.panel-export-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ffffff;
  animation: panel-export-pulse 1s ease-in-out infinite;
}
@keyframes panel-export-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .panel-export-dot { animation: none; }
}

/* Auto-height animation via CSS Grid: parent transitions
   grid-template-rows between 0fr and 1fr, child clips overflow. */
.panel-collapse {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition: grid-template-rows 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.panel-collapse[data-panel-open="true"] {
  grid-template-rows: 1fr;
  overflow: visible;
}
.panel-collapse-inner {
  /* Vertical clipping only \u2014 height animation still collapses, but horizontal
     overshoot (slider overscroll spring, toggle row full-bleed hover) is not
     cropped. inset(-16px 0) regressed toggle hovers (white side gutters). */
  clip-path: inset(0 -9999px);
  min-height: 0;
  min-width: 0;
  opacity: 0;
  transition: opacity 200ms ease;
}
.panel-collapse[data-panel-open="true"] > .panel-collapse-inner {
  opacity: 1;
  transition: opacity 200ms ease 80ms;
}

.panel-saved-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 4px 2px;
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-text-muted);
}
.panel-saved-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);
  flex-shrink: 0;
}

.panel-paste {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}
/* Scoped under [data-panel] to beat the global textarea reset on
   specificity \u2014 otherwise the explicit small font-size loses. */
[data-panel] .panel-paste-textarea {
  width: 100%;
  min-height: 96px;
  resize: vertical;
  padding: 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-text);
  border: 0;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.5;
  outline: none;
  transition: background-color 150ms ease;
}
[data-panel] .panel-paste-textarea:focus {
  background: var(--panel-surface-active);
}
[data-panel] .panel-paste-textarea::placeholder {
  color: var(--panel-muted-icon);
}
.panel-paste-error {
  padding: 0 4px;
  font-size: 11px;
  color: #ef4444;
}

.panel-empty {
  pointer-events: auto;
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9998;
  max-width: 280px;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  padding: 12px;
  font-size: 11px;
  box-shadow: var(--panel-shadow);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.panel-empty-close {
  margin-top: 8px;
  display: block;
  width: 100%;
  border-radius: 4px;
  padding: 6px 8px;
  background: var(--panel-action-bg);
  color: var(--panel-text);
  font-size: 11px;
}
.panel-empty-close:hover { background: var(--panel-action-bg-hover); }

.panel-section {
  border-top: 1px solid var(--panel-divider);
}
.panel-section:first-child { border-top: 0; }
.panel-section-header {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  padding: 10px 0 6px;
}
.panel-section:first-child .panel-section-header { padding-top: 2px; }
.panel-section-button {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  height: 20px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--panel-text);
  text-align: left;
}
.panel-section-button:hover { color: var(--panel-label-active); }
.panel-section-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-section-caret-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--panel-muted-icon);
  flex-shrink: 0;
  transition: color 150ms ease, background-color 150ms ease;
}
.panel-section-caret-btn:hover { color: var(--panel-label-active); background: var(--panel-surface); }
.panel-section-caret {
  width: 12px;
  height: 12px;
  transition: transform 200ms ease;
}
.panel-section[data-panel-open="true"] .panel-section-caret { transform: rotate(180deg); }
.panel-section-reset {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--panel-muted-icon);
  opacity: 0;
  transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease;
  flex-shrink: 0;
}
.panel-section-reset svg { width: 12px; height: 12px; }
.panel-section-header:hover .panel-section-reset,
.panel-section-reset:focus-visible { opacity: 1; }
.panel-section-reset:hover {
  color: var(--panel-label-active);
  background: var(--panel-surface);
}
.panel-section-children {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 10px;
  overflow: visible;
}

.panel-field {
  min-width: 0;
  overflow: visible;
}

.panel-field-description {
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-label-muted);
  padding: 4px 4px 2px;
  letter-spacing: 0.01em;
}

/* Slider row, between the old full-row fill and leva's grid:
   label | stretchy fill track | editable value box. */
.panel-slider-row {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.4fr) 52px;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.panel-slider-row-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 150ms ease;
}
.panel-slider-row[data-panel-state="hover"] .panel-slider-row-label,
.panel-slider-row[data-panel-state="drag"] .panel-slider-row-label {
  color: var(--panel-label-active);
}
[data-panel] .panel-slider-num {
  width: 100%;
  height: 20px;
  border: 0;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-text);
  font-family: inherit;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: none;
  transition: background-color 150ms ease;
}
[data-panel] .panel-slider-num:hover { background: var(--panel-surface-active); }
[data-panel] .panel-slider-num:focus {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-slider {
  position: relative;
  height: 18px;
  width: 100%;
  margin: 0;
  overflow: visible;
  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
.panel-slider-row[data-panel-state="hover"] .panel-slider { transform: scale(1.01); }
.panel-slider-row[data-panel-state="drag"] .panel-slider { transform: scale(1.018); }

.panel-slider-overscroll {
  position: absolute;
  inset: 0;
  transform: scaleX(var(--panel-os-scale, 1));
  transform-origin: var(--panel-os-origin, 50% 50%);
}
.panel-slider-overscroll[data-panel-release="true"] {
  transition: transform 320ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
@media (prefers-reduced-motion: reduce) {
  .panel-slider-overscroll[data-panel-release="true"] { transition: none; }
  [data-panel] .panel-slider { transition: none; }
  [data-panel] .panel-slider-num { transition: none; }
}

.panel-slider-track {
  position: absolute;
  inset: 0;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  touch-action: none;
  border-radius: 4px;
  background: var(--panel-surface);
}

.panel-slider-hash-row {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.panel-slider-hash {
  position: absolute;
  top: 50%;
  height: 6px;
  width: 1px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: transparent;
  transition: background-color 200ms ease;
}
.panel-slider-row[data-panel-state="hover"] .panel-slider-hash,
.panel-slider-row[data-panel-state="drag"] .panel-slider-hash { background: var(--panel-hash); }

.panel-slider-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: var(--panel-fill-pct, 0%);
  pointer-events: none;
  background: var(--panel-surface-idle-fill);
  transition: background-color 150ms ease, width 220ms cubic-bezier(0.2, 0, 0, 1);
}
.panel-slider-row[data-panel-state="drag"] .panel-slider-fill {
  transition: background-color 150ms ease, width 0ms;
  background: var(--panel-surface-active);
}
.panel-slider-row[data-panel-state="hover"] .panel-slider-fill { background: var(--panel-surface-active); }

.panel-slider-handle {
  position: absolute;
  top: 50%;
  height: 12px;
  width: 3px;
  left: var(--panel-handle-left, 0%);
  border-radius: 999px;
  pointer-events: none;
  background: var(--panel-handle);
  opacity: 0;
  transform: translate(-1.5px, -50%) scaleY(1);
  transform-origin: center center;
  transition:
    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    left 220ms cubic-bezier(0.2, 0, 0, 1);
}
.panel-slider-row[data-panel-state="hover"] .panel-slider-handle { opacity: 0.5; }
.panel-slider-row[data-panel-state="drag"] .panel-slider-handle {
  opacity: 0.9;
  transform: translate(-1.5px, -50%) scaleY(1.3);
  transition:
    opacity 200ms cubic-bezier(0.32, 0.72, 0, 1),
    transform 200ms cubic-bezier(0.32, 0.72, 0, 1),
    left 0ms;
}

.panel-color {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-radius: 4px;
  padding: 0 8px;
  background: var(--panel-surface);
}
.panel-color-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
}
.panel-color-right {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-color-text {
  width: 7ch;
  background: transparent;
  border: 0;
  outline: 0;
  text-align: right;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  text-transform: uppercase;
}
.panel-color-swatch {
  height: 16px;
  width: 16px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--panel-swatch-border);
  transition: transform 150ms ease;
}
.panel-color-swatch:hover { transform: scale(1.1); }

.panel-path {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-path-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-path-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
}
.panel-path-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-path-count {
  font-size: 11px;
  color: var(--panel-muted-icon);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
[data-panel] .panel-path-clear {
  font-size: 11px;
  font-weight: 400;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-path-clear:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-path-pad {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
  touch-action: none;
  cursor: crosshair;
  overflow: visible;
}
.panel-path-bg {
  fill: transparent;
  cursor: crosshair;
}
.panel-path-grid {
  stroke: var(--panel-divider);
  stroke-width: 0.5;
}
.panel-path-frame {
  fill: none;
  stroke: var(--panel-border);
  stroke-width: 0.5;
}
.panel-path-line {
  fill: none;
  stroke: var(--panel-handle);
  stroke-width: 1;
  stroke-linejoin: round;
  stroke-linecap: round;
  opacity: 0.55;
}
.panel-path-line-close {
  stroke: var(--panel-handle);
  stroke-width: 0.8;
  stroke-dasharray: 2 2;
  opacity: 0.3;
}
.panel-path-anchor circle {
  fill: none;
  stroke: var(--panel-handle);
  stroke-width: 1;
  opacity: 0.7;
}
.panel-path-anchor.is-draggable {
  cursor: grab;
}
.panel-path-anchor.is-draggable .panel-path-point-hit {
  cursor: grab;
}
.panel-path-anchor.is-draggable:active {
  cursor: grabbing;
}
.panel-path-anchor.is-selected circle:not(.panel-path-point-hit) {
  stroke-width: 1.4;
  opacity: 1;
}
.panel-path-anchor .panel-path-anchor-dot {
  fill: var(--panel-handle);
  stroke: none;
  opacity: 0.9;
}
.panel-path-point {
  cursor: grab;
}
.panel-path-point:active {
  cursor: grabbing;
}
.panel-path-point-hit {
  fill: transparent;
}
.panel-path-point-ring {
  fill: var(--panel-bg);
  stroke: var(--panel-handle);
  stroke-width: 1.2;
  transition: r 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-path-point.is-selected .panel-path-point-ring {
  fill: var(--panel-handle);
}
.panel-path-point-num {
  fill: var(--panel-label);
  font-size: 3.4px;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  text-anchor: middle;
  pointer-events: none;
  user-select: none;
}
.panel-path-point.is-selected .panel-path-point-num {
  fill: var(--panel-bg);
}
.panel-path-selected {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--panel-text-muted);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
}
[data-panel] .panel-path-remove {
  font-size: 11px;
  font-weight: 400;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-path-remove:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-path-hint {
  font-size: 11px;
  color: var(--panel-muted-icon);
  text-align: center;
}

.panel-image {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-image-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.panel-image-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
}
.panel-image-upload {
  font-size: 11px;
  font-weight: 400;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
.panel-image-upload:hover {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
.panel-image-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  border-radius: 4px;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
  overflow: hidden;
  transition: border-color 150ms ease, background-color 150ms ease;
}
.panel-image-frame[data-panel-interactive="true"] { cursor: pointer; }
.panel-image-frame[data-panel-interactive="true"]:hover,
.panel-image-frame[data-panel-drag="true"] {
  border-color: var(--panel-handle);
  background: var(--panel-surface-active);
}
.panel-image-preview {
  display: block;
  width: 75%;
  height: auto;
  border-radius: 4px;
}
.panel-image-empty {
  font-size: 11px;
  color: var(--panel-muted-icon);
  padding: 14px 0;
}
.panel-image-native {
  position: absolute;
  height: 0;
  width: 0;
  opacity: 0;
  pointer-events: none;
}

/* Scoped under [data-panel] so it beats the global button reset
   (which zeroes padding/background). The negative margin + matching padding
   full-bleeds the hover highlight ~8px past the label on each side, so the
   label stays aligned with the other rows but the highlight never touches its
   left edge. */
[data-panel] .panel-toggle {
  display: flex;
  height: 24px;
  width: calc(100% + 16px);
  margin: 0 -8px;
  align-items: center;
  justify-content: space-between;
  border-radius: 4px;
  padding: 0 8px;
  background: transparent;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-toggle:hover { background: var(--panel-toggle-hover); }
.panel-toggle-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
}
.panel-toggle-track {
  position: relative;
  width: 26px;
  height: 14px;
  border-radius: 999px;
  background: var(--panel-surface-idle-fill);
  transition: background-color 200ms cubic-bezier(0.32, 0.72, 0, 1);
  flex-shrink: 0;
}
.panel-toggle[data-panel-on="true"] .panel-toggle-track {
  background: var(--panel-handle);
}
.panel-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--panel-bg);
  transition: transform 220ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
.panel-toggle[data-panel-on="false"] .panel-toggle-thumb {
  background: var(--panel-handle);
}
.panel-toggle[data-panel-on="true"] .panel-toggle-thumb {
  transform: translateX(12px);
}

/* Segmented single-select \u2014 optional label, then option buttons sharing a
   surface track. Selected uses the panel surface tokens, not a heavy fill. */
.panel-toggle-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  padding: 4px 0;
}
/* With a label the group shares the slider rows' two-column grid. */
.panel-toggle-group:has(> .panel-toggle-group-label) {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
.panel-toggle-group-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-toggle-group-track {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 2px;
  border-radius: 4px;
  background: var(--panel-surface);
}
[data-panel] .panel-toggle-group-btn {
  display: inline-flex;
  flex: 1 1 0;
  min-width: 0;
  height: 20px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 2px;
  padding: 0 8px;
  color: var(--panel-text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  cursor: pointer;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-toggle-group-icon {
  display: inline-flex;
  flex-shrink: 0;
}
.panel-toggle-group-icon svg {
  width: 12px;
  height: 12px;
  display: block;
}
.panel-toggle-group-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[data-panel] .panel-toggle-group-btn:hover {
  color: var(--panel-action-text-hover);
  background: var(--panel-toggle-hover);
}
[data-panel] .panel-toggle-group-btn:focus-visible {
  outline: 1px solid var(--panel-handle);
  outline-offset: -1px;
}
[data-panel] .panel-toggle-group-btn[data-panel-active="true"] {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-toggle-group-btn:active { transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  [data-panel] .panel-toggle-group-btn { transition: none; }
  [data-panel] .panel-toggle-group-btn:active { transform: none; }
}

.panel-select {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
}
.panel-select[data-panel-layout="inline"] {
  min-height: 24px;
  height: 24px;
  border-radius: 4px;
  padding: 0 8px;
  background: var(--panel-surface);
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-select[data-panel-layout="inline"]:hover {
  background: var(--panel-surface-active);
}
/* Stacked selects share the slider rows' label column (0.9fr @ 8px gap) so
   labels align down the panel; the control spans the track+input width. */
.panel-select[data-panel-layout="stacked"] {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 24px;
  height: auto;
  padding: 0;
  background: transparent;
}
.panel-select-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  min-width: 0;
  line-height: 1.35;
}
.panel-select[data-panel-layout="stacked"] .panel-select-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-select[data-panel-layout="inline"] .panel-select-label {
  flex: 1 1 auto;
  white-space: normal;
}
[data-panel] .panel-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
  border: 0;
  outline: 0;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 400;
  line-height: normal;
  cursor: pointer;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  overflow: visible;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-select[data-panel-layout="stacked"] .panel-select-btn {
  align-self: stretch;
  width: 100%;
  max-width: none;
  justify-content: space-between;
}
.panel-select[data-panel-layout="inline"] .panel-select-btn {
  align-self: center;
  flex: 1 1 auto;
  max-width: none;
  height: 100%;
  justify-content: flex-end;
  padding: 0;
  background: transparent;
  border-radius: 0;
}
.panel-select[data-panel-layout="inline"] .panel-select-btn:hover,
.panel-select[data-panel-layout="inline"] .panel-select-btn:focus-visible {
  background: transparent;
}
/* Ellipsis horizontally only \u2014 vertical overflow clips descenders in custom fonts. */
.panel-select-value {
  min-width: 0;
  overflow-x: hidden;
  overflow-y: visible;
  white-space: nowrap;
  text-overflow: ellipsis;
  line-height: 1.35;
}
[data-panel] .panel-select-btn:hover {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-select-btn:focus-visible {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
  outline: 1px solid var(--panel-handle);
  outline-offset: 1px;
}
[data-panel] .panel-select-btn:active { transform: none; }
.panel-select[data-panel-layout="stacked"] .panel-select-btn:active {
  transform: none;
}
.panel-select-chevron {
  width: 12px;
  height: 12px;
  opacity: 0.6;
  flex-shrink: 0;
}
.panel-select-layer {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}
.panel-select-menu {
  pointer-events: auto;
  overflow-y: auto;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.28), 0 12px 32px rgb(0 0 0 / 0.32);
  scrollbar-width: thin;
  scrollbar-color: var(--panel-scrollbar-thumb) transparent;
  animation: panel-menu-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-select-menu[data-panel-up="true"] {
  animation-name: panel-menu-in-up;
}
@keyframes panel-menu-in {
  from {
    opacity: 0;
    transform: translate(-100%, 0) translateY(-4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate(-100%, 0) translateY(0);
    filter: blur(0);
  }
}
@keyframes panel-menu-in-up {
  from {
    opacity: 0;
    transform: translate(-100%, -100%) translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate(-100%, -100%) translateY(0);
    filter: blur(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .panel-select-menu { animation: none; }
}
[data-panel] .panel-select-option {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border: 0;
  background: transparent;
  color: var(--panel-label);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 120ms cubic-bezier(0.22, 1, 0.36, 1),
    color 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-select-option[data-panel-active="true"] {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
}
[data-panel] .panel-select-option[aria-selected="true"] {
  color: var(--panel-text);
}
.panel-select-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.9;
}

.panel-prompt {
  display: flex;
  flex-direction: column;
}
/* Bumped under [data-panel] so it ties the button reset on specificity
   and wins on source order \u2014 the reset sets padding: 0 globally. */
[data-panel] .panel-prompt-toggle {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 11px;
  font-weight: 400;
  text-align: left;
  transition: color 150ms ease;
}
[data-panel] .panel-prompt-toggle:hover,
.panel-prompt[data-panel-open="true"] .panel-prompt-toggle {
  color: var(--panel-label-active);
}
.panel-prompt-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.panel-prompt-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms ease;
}
.panel-prompt[data-panel-open="true"] .panel-prompt-caret { transform: rotate(180deg); }

.panel-prompt-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 2px;
}
.panel-prompt-desc {
  font-size: 11px;
  color: var(--panel-text-muted);
  line-height: 1.4;
  padding: 0 4px;
}
.panel-prompt-code-wrap {
  position: relative;
}
.panel-prompt-pre {
  margin: 0;
  padding: 8px 8px 20px;
  background: var(--panel-surface);
  color: var(--panel-text);
  border: 0;
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--panel-scrollbar-thumb) transparent;
  -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);
  mask-image: linear-gradient(to bottom, black calc(100% - 22px), transparent);
}
.panel-prompt-pre::-webkit-scrollbar { width: 6px; }
.panel-prompt-pre::-webkit-scrollbar-thumb { background: var(--panel-scrollbar-thumb); border-radius: 999px; }
/* Scoped under [data-panel] to beat the global button reset
   (background: transparent) on specificity \u2014 otherwise the button is
   transparent and the prompt text shows through behind the icon. */
[data-panel] .panel-prompt-copy {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-bg);
  color: var(--panel-label);
  border: 1px solid var(--panel-border);
  transition: color 150ms ease, transform 200ms cubic-bezier(0.34, 1.16, 0.64, 1);
}
.panel-prompt-copy svg { width: 12px; height: 12px; }
[data-panel] .panel-prompt-copy:hover {
  background: var(--panel-surface-active);
  color: var(--panel-label-active);
  transform: scale(1.05);
}

.panel-vec2 {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-vec2-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  padding: 0 8px;
}
.panel-vec2-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

/* \u2500\u2500 Preset selector \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-presets {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 0 2px;
}
.panel-presets-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-panel] .panel-preset-select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 24px;
  border: 0;
  border-radius: 4px;
  padding: 0 24px 0 8px;
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  color: var(--panel-label);
  background:
    linear-gradient(45deg, transparent 50%, var(--panel-muted-icon) 50%),
    linear-gradient(135deg, var(--panel-muted-icon) 50%, transparent 50%),
    var(--panel-surface);
  background-position: calc(100% - 12px) 50%, calc(100% - 8px) 50%, 0 0;
  background-size: 4px 4px, 4px 4px, auto;
  background-repeat: no-repeat;
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-preset-select:hover {
  color: var(--panel-label-active);
  background-color: var(--panel-surface-active);
}
[data-panel] .panel-preset-select:focus-visible {
  outline: 1px solid var(--panel-handle);
  outline-offset: 1px;
}

/* \u2500\u2500 ToolShell layout \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-tool-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.panel-tool-viewport {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.panel-tool-overlay {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 20;
  transition: opacity 500ms ease;
}
.panel-tool-overlay[data-panel-ui-visible="false"] {
  opacity: 0;
}
.panel-tool-topbar {
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  padding-bottom: 16px;
  transition: padding 300ms ease;
}
.panel-tool-topbar > * {
  pointer-events: auto;
}
.panel-tool-panels {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.panel-panel-toggle {
  pointer-events: auto;
  position: absolute;
  bottom: 20px;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  box-shadow: var(--panel-shadow);
  transition: left 300ms ease, right 300ms ease, background 150ms ease, color 150ms ease;
}
.panel-panel-toggle:hover {
  background: var(--panel-surface);
  color: var(--panel-text);
}
.panel-panel-toggle-icon {
  width: 16px;
  height: 16px;
  transition: transform 300ms ease;
}

/* \u2500\u2500 Canvas overlay projector (OFF-138) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* A single layer pinned over the canvas. Click-through by default so it never
   eats canvas pointer events; individual overlay items opt back in if needed.
   overflow: visible so items projected near the edges are not clipped. */
.panel-overlay-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: visible;
}
/* Each projected node. Positioned via transform only (translate \u2192 the screen
   point, then -50%/-50% to center). will-change hints the compositor; no
   layout-thrashing properties are ever written. */
.panel-overlay-item {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.panel-eye-toggle {
  pointer-events: auto;
  position: absolute;
  bottom: 20px;
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--panel-text-muted);
  box-shadow: var(--panel-shadow);
  transform: translateX(-50%);
  transition: background 150ms ease, color 500ms ease, opacity 500ms ease;
}
.panel-eye-toggle[data-panel-visible="false"] {
  color: color-mix(in srgb, var(--panel-text-muted) 30%, transparent);
}
.panel-eye-toggle:hover {
  background: var(--panel-surface);
  color: var(--panel-text);
}
.panel-eye-toggle svg {
  width: 16px;
  height: 16px;
}

/* \u2500\u2500 Disclosure rows (POI / caption editors) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-disclosure {
  display: flex;
  flex-direction: column;
}
.panel-disclosure[data-panel-open="true"] {
  margin-bottom: 10px;
}
.panel-disclosure[data-panel-dimmed="true"] {
  opacity: 0.38;
  pointer-events: none;
}
.panel-disclosure[data-panel-highlight="true"] .panel-disclosure-toggle {
  box-shadow: inset 0 0 0 1px var(--panel-handle);
  color: var(--panel-label-active);
}
[data-panel] .panel-disclosure-toggle {
  display: flex;
  height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 11px;
  font-weight: 400;
  text-align: left;
  transition: color 150ms ease, background-color 150ms ease;
}
[data-panel] .panel-disclosure-toggle:hover,
.panel-disclosure[data-panel-open="true"] .panel-disclosure-toggle {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
.panel-disclosure-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.panel-disclosure-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms ease;
}
.panel-disclosure[data-panel-open="true"] .panel-disclosure-caret {
  transform: rotate(180deg);
}
.panel-disclosure-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0 12px;
}
/* Nested editors \u2014 damp hover scale so sliders don't spill past inset padding. */
[data-panel] .panel-disclosure-body .panel-slider,
[data-panel] .panel-vec2-row .panel-slider {
  width: 100%;
  margin: 0;
}
[data-panel] .panel-disclosure-body .panel-slider[data-panel-state="hover"],
[data-panel] .panel-vec2-row .panel-slider[data-panel-state="hover"] {
  transform: none;
}
[data-panel] .panel-disclosure-body .panel-slider[data-panel-state="drag"],
[data-panel] .panel-vec2-row .panel-slider[data-panel-state="drag"] {
  transform: scale(1.008);
}
[data-panel] .panel-disclosure-body .panel-toggle {
  width: 100%;
  margin: 0;
}

/* \u2500\u2500 Collection \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-collection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.panel-collection-header {
  display: flex;
  height: 24px;
  align-items: center;
  gap: 8px;
}
.panel-collection-title {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--panel-text);
}
.panel-collection-count {
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--panel-surface);
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
}
[data-panel] .panel-collection-add {
  margin-left: auto;
  height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  font-size: 11px;
  font-weight: 400;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-collection-add:hover:not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-collection-add:active:not(:disabled) {
  transform: scale(0.98);
}
[data-panel] .panel-collection-add:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.panel-collection-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-collection-empty {
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  font-size: 11px;
  color: var(--panel-text-muted);
}
.panel-collection-row {
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  transition: opacity 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-dragging="true"] {
  opacity: 0.5;
}
.panel-collection-row[data-panel-dragover="true"] {
  box-shadow: inset 0 0 0 1px var(--panel-handle);
}
.panel-collection-row-head {
  display: flex;
  height: 24px;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  background: var(--panel-surface);
  padding: 0 4px 0 6px;
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-open="true"] .panel-collection-row-head {
  background: var(--panel-surface-active);
}
.panel-collection-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  cursor: grab;
}
.panel-collection-drag:active {
  cursor: grabbing;
}
.panel-collection-drag svg {
  width: 12px;
  height: 12px;
}
[data-panel] .panel-collection-row-toggle {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
  background: transparent;
  color: var(--panel-label);
  font-size: 11px;
  font-weight: 400;
  text-align: left;
  transition: color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-collection-row-toggle:hover,
.panel-collection-row[data-panel-open="true"] .panel-collection-row-toggle {
  color: var(--panel-label-active);
}
.panel-collection-row-label {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-collection-caret {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--panel-muted-icon);
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}
.panel-collection-row[data-panel-open="true"] .panel-collection-caret {
  transform: rotate(180deg);
}
/* Layout only \u2014 look comes from the shared .panel-close-btn. */
.panel-collection-remove {
  flex-shrink: 0;
}
.panel-collection-row-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px 10px;
}

/* \u2500\u2500 Reference \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-reference {
  display: flex;
  flex-direction: column;
}
[data-panel] .panel-reference-trigger {
  display: block;
  width: 100%;
  padding: 0;
  background: transparent;
  text-align: left;
  transition: transform 120ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-reference-trigger:active {
  transform: scale(0.98);
}
[data-panel] .panel-reference-trigger .panel-readout {
  transition: background-color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
[data-panel] .panel-reference-trigger:hover .panel-readout {
  background: var(--panel-surface-active);
}
.panel-reference-picker {
  padding-top: 6px;
}

@media (prefers-reduced-motion: reduce) {
  .panel-collection-add,
  .panel-collection-remove,
  .panel-collection-caret,
  .panel-collection-row,
  .panel-collection-row-head,
  .panel-collection-row-toggle,
  .panel-reference-trigger,
  .panel-reference-trigger .panel-readout {
    transition: none;
  }
}

/* \u2500\u2500 Text input \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-text {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-text[data-panel-layout="inline"] {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-surface);
}
.panel-text-label,
.panel-search-label,
.panel-textarea-label {
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
  padding: 0;
  line-height: 1.35;
}
.panel-text[data-panel-layout="inline"] .panel-text-label {
  padding: 0;
  flex-shrink: 0;
}
[data-panel] .panel-text-input {
  width: 100%;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  transition: background-color 150ms ease, color 150ms ease;
}
.panel-text[data-panel-layout="inline"] .panel-text-input {
  flex: 1;
  min-width: 0;
  padding: 0;
  height: 100%;
  background: transparent;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-text[data-panel-layout="inline"] .panel-text-input:focus {
  background: transparent;
}
[data-panel] .panel-text-input[data-panel-mono="true"] {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
}
[data-panel] .panel-text-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-text-input::placeholder {
  color: var(--panel-muted-icon);
  text-transform: none;
}

/* \u2500\u2500 Textarea \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-textarea {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
[data-panel] .panel-textarea-input {
  width: 100%;
  min-height: 72px;
  resize: vertical;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-family: inherit;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.45;
  outline: none;
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-textarea-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-textarea-input::placeholder {
  color: var(--panel-muted-icon);
}

.panel-search {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-search-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
}
[data-panel] .panel-search-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  color: var(--panel-label);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.2;
  transition: background-color 150ms ease, color 150ms ease;
}
[data-panel] .panel-search-input:focus {
  color: var(--panel-label-active);
  background: var(--panel-surface-active);
}
[data-panel] .panel-search-input::placeholder {
  color: var(--panel-muted-icon);
}
[data-panel] .panel-search-btn {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--panel-action-bg);
  color: var(--panel-action-text);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  transition: background-color 150ms ease, color 150ms ease, transform 120ms ease;
}
[data-panel] .panel-search-btn:hover:not(:disabled) {
  background: var(--panel-action-bg-hover);
  color: var(--panel-action-text-hover);
}
[data-panel] .panel-search-btn:active:not(:disabled) {
  transform: scale(0.98);
}
[data-panel] .panel-search-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.panel-search-error {
  padding: 0 8px;
  font-size: 11px;
  line-height: 1.35;
  color: #ef4444;
}

/* \u2500\u2500 Readout row \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-readout {
  display: flex;
  min-height: 24px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--panel-surface);
}
.panel-readout-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 400;
  color: var(--panel-label);
}
.panel-readout-value {
  min-width: 0;
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--panel-text-muted);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* \u2500\u2500 Option list (search results, pickers) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-option-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-option-list-title {
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--panel-text-muted);
}
.panel-option-list {
  display: flex;
  max-height: 168px;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  scrollbar-width: thin;
  scrollbar-color: var(--panel-scrollbar-thumb) transparent;
}
.panel-option-list::-webkit-scrollbar {
  width: 6px;
}
.panel-option-list::-webkit-scrollbar-thumb {
  background: var(--panel-scrollbar-thumb);
  border-radius: 999px;
}
[data-panel] .panel-option-item {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 4px;
  background: transparent;
  color: var(--panel-label);
  text-align: left;
  transition: background-color 120ms ease, color 120ms ease;
}
[data-panel] .panel-option-item:hover:not(:disabled) {
  background: var(--panel-surface);
  color: var(--panel-label-active);
}
[data-panel] .panel-option-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.panel-option-item-label {
  width: 100%;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  color: inherit;
}
.panel-option-item-desc {
  width: 100%;
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.panel-option-empty {
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--panel-surface);
  font-size: 11px;
  line-height: 1.35;
  color: var(--panel-text-muted);
}

/* \u2500\u2500 Hint copy \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.panel-hint {
  margin: 0;
  padding: 0 8px 2px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--panel-text-muted);
}
`;

// src/hooks/use-inject-styles.ts
var FULL_CSS = PANEL_CSS + colorPopoverStyles + gradientStopsStyles + stripeColorsTableStyles;
var injectedCss = null;
function useInjectPanelStyles() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (injectedCss === FULL_CSS) return;
    let style = document.getElementById(PANEL_STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = PANEL_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = FULL_CSS;
    injectedCss = FULL_CSS;
  }, []);
}
function FloatingPanel({
  side,
  collapsed,
  onToggle,
  onOpen,
  title,
  titleSlot,
  children,
  className,
  defaultTheme,
  themeStorageKey,
  showThemeToggle = true,
  container: container2,
  inline = false,
  peek = true,
  float = false,
  floatStorageKey
}) {
  const open = onOpen ?? onToggle;
  useInjectPanelStyles();
  const theme = usePanelTheme(defaultTheme);
  const [mounted, setMounted] = useState(false);
  const floating = float && !inline;
  const { panelRef, headerRef, onHeaderPointerDown, onResizePointerDown } = usePanelDragResize({
    enabled: floating,
    collapsed,
    ready: mounted,
    storageKey: floatStorageKey
  });
  const showPeek = peek && !inline && !floating;
  const [hoverSensor, setHoverSensor] = useState(false);
  const [hoverPanel, setHoverPanel] = useState(false);
  const peeking = showPeek && collapsed && (hoverSensor || hoverPanel);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!collapsed) {
      setHoverSensor(false);
      setHoverPanel(false);
    }
  }, [collapsed]);
  const bodyRef = useRef(null);
  useEffect(() => {
    const sc = bodyRef.current;
    if (!sc) return;
    const update = () => sc.classList.toggle(
      "panel-body-cut-off",
      sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1
    );
    update();
    sc.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(sc);
    if (sc.firstElementChild) ro.observe(sc.firstElementChild);
    return () => {
      sc.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [mounted]);
  if (!mounted) return null;
  const panel = /* @__PURE__ */ jsxs(PanelThemeProvider, { value: theme, children: [
    showPeek && collapsed ? /* @__PURE__ */ jsx(
      "div",
      {
        className: "panel-edge-sensor",
        "data-panel-side": side,
        "data-panel-inline": inline ? "true" : "false",
        onMouseEnter: () => setHoverSensor(true),
        onMouseLeave: () => setHoverSensor(false),
        onClick: open,
        "aria-hidden": "true"
      }
    ) : null,
    /* @__PURE__ */ jsxs(
      "div",
      {
        "data-panel": "",
        "data-panel-theme": theme,
        "data-panel-side": side,
        "data-panel-collapsed": collapsed ? "true" : "false",
        "data-panel-peek": peeking ? "true" : "false",
        "data-panel-inline": inline ? "true" : "false",
        "data-panel-float": floating ? "true" : "false",
        className: cn("panel-floating", className),
        onMouseEnter: () => setHoverPanel(true),
        onMouseLeave: () => setHoverPanel(false),
        ref: panelRef,
        children: [
          floating ? RESIZE_DIRS.map((dir) => /* @__PURE__ */ jsx(
            "div",
            {
              className: `panel-resize panel-resize-${dir}`,
              onPointerDown: (e) => onResizePointerDown(e, dir)
            },
            dir
          )) : null,
          floating ? HINT_SIDES.map((hintSide) => /* @__PURE__ */ jsx(
            "div",
            {
              "aria-hidden": "true",
              className: `panel-snap-hint panel-snap-hint-${hintSide}`
            },
            hintSide
          )) : null,
          /* @__PURE__ */ jsxs("div", { className: "panel-panel", children: [
            /* @__PURE__ */ jsxs(
              "div",
              {
                className: "panel-panel-header",
                onPointerDown: floating ? onHeaderPointerDown : void 0,
                ref: floating ? headerRef : void 0,
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "panel-panel-title-row", children: [
                    /* @__PURE__ */ jsx("span", { className: "panel-panel-title", children: title }),
                    titleSlot
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "panel-panel-header-end", children: [
                    showThemeToggle ? /* @__PURE__ */ jsx(ControlThemeToggle, { storageKey: themeStorageKey }) : null,
                    /* @__PURE__ */ jsx(PanelCloseButton, { onClick: onToggle, ariaLabel: "Close panel" })
                  ] })
                ]
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "panel-panel-body", ref: bodyRef, children })
          ] }),
          peeking ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "panel-peek-catch",
              onClick: open,
              "aria-label": "Open panel"
            }
          ) : null
        ]
      }
    )
  ] });
  if (inline) return panel;
  const target = container2 ?? (typeof document !== "undefined" ? document.body : null);
  if (!target) return null;
  return createPortal(panel, target);
}

// src/persist.ts
var PERSIST_PREFIX = "panels:";
var SECTIONS_SUFFIX = ":sections";
function storage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function loadPersistedPanelValues(id, defaults) {
  const s = storage();
  if (!s) return { ...defaults };
  try {
    const raw = s.getItem(PERSIST_PREFIX + id);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...defaults };
    const next = { ...defaults };
    for (const key of Object.keys(defaults)) {
      if (key in parsed && parsed[key] !== void 0) {
        next[key] = parsed[key];
      }
    }
    return next;
  } catch {
    return { ...defaults };
  }
}
function persistPanelValues(id, values) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PERSIST_PREFIX + id, JSON.stringify(values));
  } catch {
  }
}
function clearPersistedPanelValues(id) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(PERSIST_PREFIX + id);
  } catch {
  }
}
function hasPersistedPanelValues(id) {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(PERSIST_PREFIX + id) !== null;
  } catch {
    return false;
  }
}
function sectionsStorageKey(id) {
  return PERSIST_PREFIX + id + SECTIONS_SUFFIX;
}
function loadPersistedPanelSections(id) {
  const s = storage();
  if (!s) return {};
  try {
    const raw = s.getItem(sectionsStorageKey(id));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out = {};
    for (const [title, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[title] = value;
    }
    return out;
  } catch {
    return {};
  }
}
function persistPanelSections(id, sections) {
  const s = storage();
  if (!s) return;
  try {
    if (Object.keys(sections).length === 0) {
      s.removeItem(sectionsStorageKey(id));
      return;
    }
    s.setItem(sectionsStorageKey(id), JSON.stringify(sections));
  } catch {
  }
}
function clearPersistedPanelSections(id) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(sectionsStorageKey(id));
  } catch {
  }
}
var EMPTY_PROMPTS = [];
function Panel({
  id,
  title,
  titleSlot,
  side = "right",
  open,
  onClose,
  onOpen,
  values,
  defaults,
  fields,
  onChange,
  onWriteConfig,
  writeLabel = "Write config file",
  shortcutHint = false,
  prompts = EMPTY_PROMPTS,
  persist = true,
  defaultTheme,
  themeStorageKey,
  showThemeToggle,
  actionHandlers,
  container: container2,
  inline = false,
  peek,
  showAnimation = true,
  showExport = true,
  onSelect
}) {
  const [writing, setWriting] = useState(false);
  const [status, setStatus] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState(null);
  const [sectionOpen, setSectionOpen] = useState({});
  const pasteTextareaRef = useRef(null);
  useEffect(() => {
    if (!pasteOpen) return;
    const id2 = window.setTimeout(() => {
      const el = pasteTextareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 150);
    return () => window.clearTimeout(id2);
  }, [pasteOpen]);
  const imageKeys = useMemo(() => {
    const keys = /* @__PURE__ */ new Set();
    for (const f of fields) {
      if (f.type === "image") keys.add(f.key);
    }
    return keys;
  }, [fields]);
  const collectionMigrations = useMemo(() => {
    const out = /* @__PURE__ */ new Map();
    for (const f of fields) {
      if (f.type === "collection" && f.migrate) {
        out.set(f.key, f.migrate);
      }
    }
    return out;
  }, [fields]);
  const stripImages = useCallback(
    (obj) => {
      if (imageKeys.size === 0) return obj;
      const out = { ...obj };
      for (const k of imageKeys) delete out[k];
      return out;
    },
    [imageKeys]
  );
  const valuesJson = useMemo(
    () => JSON.stringify(stripImages(values)),
    [values, stripImages]
  );
  const defaultsJson = useMemo(
    () => JSON.stringify(stripImages(defaults)),
    [defaults, stripImages]
  );
  const isModified = valuesJson !== defaultsJson;
  const persistKey = persist && id ? id : null;
  const sectionsKey = id ?? null;
  const liveRef = useRef({ onChange, defaults, values, valuesJson, stripImages });
  liveRef.current = { onChange, defaults, values, valuesJson, stripImages };
  const hydratedIdRef = useRef(null);
  useEffect(() => {
    if (!persistKey) return;
    if (hydratedIdRef.current === persistKey) return;
    hydratedIdRef.current = persistKey;
    if (!hasPersistedPanelValues(persistKey)) return;
    const live = liveRef.current;
    const saved = loadPersistedPanelValues(persistKey, live.defaults);
    for (const k of imageKeys) {
      if (k in live.values) {
        saved[k] = live.values[k];
      }
    }
    for (const [k, migrate] of collectionMigrations) {
      const arr = saved[k];
      if (Array.isArray(arr)) {
        saved[k] = migrate(
          arr
        );
      }
    }
    if (JSON.stringify(live.stripImages(saved)) !== live.valuesJson) {
      live.onChange(saved);
    }
  }, [persistKey, imageKeys, collectionMigrations]);
  const skipNextPersistRef = useRef(true);
  useEffect(() => {
    if (!persistKey) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (isModified) {
      persistPanelValues(persistKey, JSON.parse(valuesJson));
    } else {
      clearPersistedPanelValues(persistKey);
    }
  }, [persistKey, valuesJson, isModified]);
  const sectionHydratedIdRef = useRef(null);
  useEffect(() => {
    if (!sectionsKey) return;
    if (sectionHydratedIdRef.current === sectionsKey) return;
    sectionHydratedIdRef.current = sectionsKey;
    setSectionOpen(loadPersistedPanelSections(sectionsKey));
  }, [sectionsKey]);
  const setSectionOpenState = useCallback((title2, open2) => {
    setSectionOpen((prev) => ({ ...prev, [title2]: open2 }));
  }, []);
  const skipNextSectionPersistRef = useRef(true);
  useEffect(() => {
    if (!sectionsKey) return;
    if (skipNextSectionPersistRef.current) {
      skipNextSectionPersistRef.current = false;
      return;
    }
    persistPanelSections(sectionsKey, sectionOpen);
  }, [sectionsKey, sectionOpen]);
  const resetAll = useCallback(() => {
    onChange({ ...defaults });
    if (persistKey) clearPersistedPanelValues(persistKey);
    if (sectionsKey) clearPersistedPanelSections(sectionsKey);
    setSectionOpen({});
    setStatus(null);
  }, [defaults, onChange, persistKey, sectionsKey]);
  const handleApplyPaste = useCallback(() => {
    try {
      const parsed = JSON.parse(pasteText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object");
      }
      const next = { ...values };
      let applied = 0;
      for (const key of Object.keys(defaults)) {
        if (key in parsed && parsed[key] !== void 0) {
          next[key] = parsed[key];
          applied += 1;
        }
      }
      if (applied === 0) {
        throw new Error("No known keys found");
      }
      onChange(next);
      setPasteOpen(false);
      setPasteText("");
      setPasteError(null);
      setStatus(`Applied ${applied} key${applied === 1 ? "" : "s"}`);
      setTimeout(() => setStatus(null), 2e3);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }, [defaults, onChange, pasteText, values]);
  const configJson = useMemo(
    () => JSON.stringify(stripImages(values), null, 2),
    [values, stripImages]
  );
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(configJson);
    setStatus("Copied JSON to clipboard");
    setTimeout(() => setStatus(null), 2e3);
  }, [configJson]);
  const handleWrite = useCallback(async () => {
    if (!onWriteConfig) return;
    setWriting(true);
    setStatus(null);
    try {
      const result = await onWriteConfig(values);
      setStatus(result.message);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Write failed");
    } finally {
      setWriting(false);
    }
  }, [onWriteConfig, values]);
  const resetKeys = useCallback(
    (keys) => {
      const next = { ...values };
      for (const k of keys) {
        next[k] = defaults[k];
      }
      onChange(next);
    },
    [defaults, onChange, values]
  );
  const sections = useMemo(() => {
    const out = [];
    let current2 = null;
    const ensureCurrent = () => {
      if (!current2) {
        current2 = { title: "Parameters", children: [], keys: [] };
        out.push(current2);
      }
      return current2;
    };
    const rootValues = values;
    const setRootValues = (next) => onChange(next);
    for (const field of fields) {
      if (field.type === "section") {
        current2 = { title: field.title, children: [], keys: [] };
        out.push(current2);
        continue;
      }
      const rendered = renderPanelField(field, {
        values: rootValues,
        setValues: setRootValues,
        rootValues,
        setRootValues,
        actionHandlers,
        onCollectionSelect: onSelect
      });
      if (!rendered) continue;
      const group = ensureCurrent();
      group.children.push(
        /* @__PURE__ */ jsx("div", { className: "panel-field", children: rendered.node }, rendered.reactKey)
      );
      if ("key" in field) group.keys.push(field.key);
    }
    return out;
  }, [actionHandlers, fields, onChange, onSelect, values]);
  const resolvedPeek = peek ?? !inline;
  return /* @__PURE__ */ jsx(
    FloatingPanel,
    {
      side,
      collapsed: !open,
      onToggle: onClose,
      onOpen,
      title,
      titleSlot,
      defaultTheme,
      themeStorageKey,
      showThemeToggle,
      container: container2,
      inline,
      peek: resolvedPeek,
      children: /* @__PURE__ */ jsxs("div", { className: "panel-fields", children: [
        showAnimation ? /* @__PURE__ */ jsx(ControlAnimation, {}) : null,
        prompts.length > 0 ? /* @__PURE__ */ jsx(ControlQuickActions, { prompts, shaderName: title }) : null,
        shortcutHint ? /* @__PURE__ */ jsxs("div", { className: "panel-shortcut-hint", children: [
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u2325D" }),
          " to toggle \xB7 ",
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u21E7`" }),
          " / ",
          /* @__PURE__ */ jsx("kbd", { children: "\u2318\u21E7D" }),
          " also work"
        ] }) : null,
        sections.map((section) => /* @__PURE__ */ jsx(
          ControlSection,
          {
            title: section.title,
            open: sectionOpen[section.title] ?? true,
            onOpenChange: (open2) => setSectionOpenState(section.title, open2),
            onReset: section.keys.length > 0 ? () => resetKeys(section.keys) : void 0,
            children: section.children
          },
          section.title
        )),
        /* @__PURE__ */ jsxs("div", { className: "panel-actions", children: [
          showExport ? /* @__PURE__ */ jsx(ControlExport, { name: title }) : null,
          /* @__PURE__ */ jsx("button", { type: "button", onClick: resetAll, className: "panel-action-btn", children: "Reset to defaults" }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: handleCopy, className: "panel-action-btn", children: "Copy JSON" }),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => {
                setPasteOpen((v) => !v);
                setPasteError(null);
              },
              className: "panel-action-btn",
              "aria-expanded": pasteOpen,
              children: pasteOpen ? "Cancel paste" : "Paste JSON"
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-collapse",
              "data-panel-open": persistKey && isModified ? "true" : "false",
              "aria-hidden": !(persistKey && isModified),
              children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-saved-indicator", "aria-live": "polite", children: [
                /* @__PURE__ */ jsx("span", { className: "panel-saved-dot" }),
                " Edits saved locally"
              ] }) })
            }
          ),
          /* @__PURE__ */ jsx(
            "div",
            {
              className: "panel-collapse",
              "data-panel-open": pasteOpen ? "true" : "false",
              "aria-hidden": !pasteOpen,
              children: /* @__PURE__ */ jsx("div", { className: "panel-collapse-inner", children: /* @__PURE__ */ jsxs("div", { className: "panel-paste", children: [
                /* @__PURE__ */ jsx(
                  "textarea",
                  {
                    ref: pasteTextareaRef,
                    className: "panel-paste-textarea",
                    value: pasteText,
                    onChange: (e) => {
                      setPasteText(e.target.value);
                      if (pasteError) setPasteError(null);
                    },
                    placeholder: '{ "speed": 1.0, "bgColor": "#ff0000" }',
                    spellCheck: false,
                    rows: 5
                  }
                ),
                pasteError ? /* @__PURE__ */ jsx("div", { className: "panel-paste-error", children: pasteError }) : null,
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: handleApplyPaste,
                    disabled: pasteText.trim().length === 0,
                    className: "panel-action-btn",
                    children: "Apply"
                  }
                )
              ] }) })
            }
          ),
          onWriteConfig ? /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              disabled: writing,
              onClick: () => void handleWrite(),
              className: "panel-action-btn",
              children: writing ? "Writing\u2026" : writeLabel
            }
          ) : null,
          status ? /* @__PURE__ */ jsx("div", { className: "panel-status", children: status }) : null
        ] })
      ] })
    }
  );
}

// src/store.ts
var registrations = /* @__PURE__ */ new Map();
var activeLeftId = null;
var activeRightId = null;
var lastRegisteredId = null;
var listeners2 = /* @__PURE__ */ new Set();
var snapshotRevision = 0;
function registrationSide(reg) {
  return reg.side ?? "right";
}
function notify2() {
  snapshotRevision += 1;
  for (const listener of listeners2) listener();
}
function promoteActiveForSide(side) {
  const remaining = Array.from(registrations.values()).filter(
    (reg) => registrationSide(reg) === side
  );
  const nextId = remaining.length ? remaining[remaining.length - 1].id : null;
  if (side === "left") activeLeftId = nextId;
  else activeRightId = nextId;
}
function registerPanel(next) {
  if (next === null) {
    if (lastRegisteredId !== null) {
      unregisterPanel(lastRegisteredId);
    }
    return () => {
    };
  }
  const reg = next;
  const side = registrationSide(reg);
  registrations.set(reg.id, reg);
  lastRegisteredId = reg.id;
  if (side === "left") {
    if (activeLeftId === null || !registrations.has(activeLeftId)) {
      activeLeftId = reg.id;
    }
  } else if (activeRightId === null || !registrations.has(activeRightId)) {
    activeRightId = reg.id;
  }
  notify2();
  return () => unregisterPanel(reg.id);
}
function unregisterPanel(id) {
  const reg = registrations.get(id);
  const had = registrations.delete(id);
  if (!had || !reg) return;
  if (lastRegisteredId === id) lastRegisteredId = null;
  const side = registrationSide(reg);
  if (side === "left" && activeLeftId === id) promoteActiveForSide("left");
  if (side === "right" && activeRightId === id) promoteActiveForSide("right");
  notify2();
}
function setActivePanel(id) {
  const reg = registrations.get(id);
  if (!reg) return;
  const side = registrationSide(reg);
  if (side === "left") {
    if (activeLeftId === id) return;
    activeLeftId = id;
  } else {
    if (activeRightId === id) return;
    activeRightId = id;
  }
  notify2();
}
function getActivePanelIdForSide(side) {
  return side === "left" ? activeLeftId : activeRightId;
}
function getActivePanelForSide(side) {
  const id = getActivePanelIdForSide(side);
  return id ? registrations.get(id) ?? null : null;
}
function getPanelRegistrationsForSide(side) {
  return Array.from(registrations.values()).filter(
    (reg) => registrationSide(reg) === side
  );
}
function getPanelRevision() {
  return snapshotRevision;
}
function subscribePanelRegistration(listener) {
  listeners2.add(listener);
  return () => {
    listeners2.delete(listener);
  };
}
var PANEL_TOGGLE_EVENT = "cf-shader-dev-toggle";
var PANEL_OPEN_KEY = "cf-accent-shader-dev-open";
var PANEL_OPEN_LEFT_KEY = "cf-accent-shader-dev-open-left";
function openKeyForSide(side) {
  return side === "left" ? PANEL_OPEN_LEFT_KEY : PANEL_OPEN_KEY;
}
function readPanelOpenFlag(side = "right") {
  try {
    return sessionStorage.getItem(openKeyForSide(side)) === "true";
  } catch {
    return false;
  }
}
function writePanelOpenFlag(open, side = "right") {
  try {
    sessionStorage.setItem(openKeyForSide(side), open ? "true" : "false");
  } catch {
  }
}
function initPanelOpenFlag(defaultOpen, side = "right") {
  try {
    const key = openKeyForSide(side);
    const raw = sessionStorage.getItem(key);
    if (raw === null) {
      sessionStorage.setItem(key, defaultOpen ? "true" : "false");
      return defaultOpen;
    }
    return raw === "true";
  } catch {
    return defaultOpen;
  }
}
function dispatchPanelToggle(side = "right") {
  writePanelOpenFlag(!readPanelOpenFlag(side), side);
  window.dispatchEvent(new CustomEvent(PANEL_TOGGLE_EVENT, { detail: { side } }));
}

// src/hooks/keyboard.ts
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  return target.isContentEditable;
}
function matchPanelShortcut(e) {
  if (isEditableTarget(e.target)) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return false;
  if (!e.shiftKey && e.altKey && e.code === "KeyD") {
    return true;
  }
  if (e.shiftKey && !e.altKey && (e.key === "`" || e.key === "~" || e.code === "Backquote")) {
    return true;
  }
  if (e.shiftKey && !e.altKey && (e.key === "d" || e.key === "D" || e.code === "KeyD")) {
    return true;
  }
  return false;
}
var keyboardInstalled = false;
function handlePanelShortcutKeydown(e) {
  if (!matchPanelShortcut(e)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  dispatchPanelToggle();
}
function installPanelKeyboard() {
  if (typeof document === "undefined") return () => {
  };
  if (keyboardInstalled) return () => {
  };
  keyboardInstalled = true;
  const onKeyDown = (e) => handlePanelShortcutKeydown(e);
  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    keyboardInstalled = false;
  };
}
function subscribeSideOpen(side, listener) {
  const onToggle = () => listener();
  window.addEventListener(PANEL_TOGGLE_EVENT, onToggle);
  return () => window.removeEventListener(PANEL_TOGGLE_EVENT, onToggle);
}
function getSideOpenSnapshot(side) {
  return readPanelOpenFlag(side);
}
function useSideOpen(side) {
  const subscribe = useCallback(
    (listener) => subscribeSideOpen(side, listener),
    [side]
  );
  return useSyncExternalStore(
    subscribe,
    () => getSideOpenSnapshot(side),
    () => false
  );
}
var primaryClaimed = false;
function PanelRoot({
  emptyMessage = "No shader registered on this page.",
  defaultTheme,
  themeStorageKey,
  defaultLeftOpen = false,
  defaultRightOpen,
  showThemeToggle = true
} = {}) {
  const [isPrimary, setIsPrimary] = useState(false);
  useEffect(() => {
    if (primaryClaimed) return;
    primaryClaimed = true;
    setIsPrimary(true);
    initPanelOpenFlag(defaultLeftOpen, "left");
    if (defaultRightOpen !== void 0) {
      initPanelOpenFlag(defaultRightOpen, "right");
    }
    return () => {
      primaryClaimed = false;
    };
  }, [defaultLeftOpen, defaultRightOpen]);
  useInjectPanelStyles();
  const theme = usePanelTheme(defaultTheme);
  const leftOpen = useSideOpen("left");
  const rightOpen = useSideOpen("right");
  useSyncExternalStore(
    subscribePanelRegistration,
    getPanelRevision,
    () => 0
  );
  const leftRegistration = getActivePanelForSide("left");
  const rightRegistration = getActivePanelForSide("right");
  const leftRegistrations = getPanelRegistrationsForSide("left");
  const rightRegistrations = getPanelRegistrationsForSide("right");
  useEffect(() => installPanelKeyboard(), []);
  const setSideOpen = useCallback((side, next) => {
    writePanelOpenFlag(next, side);
    window.dispatchEvent(new CustomEvent(PANEL_TOGGLE_EVENT, { detail: { side } }));
  }, []);
  if (!isPrimary) return null;
  const hasAnyRegistration = leftRegistration ?? rightRegistration;
  const anyOpen = leftOpen || rightOpen;
  if (!hasAnyRegistration) {
    return anyOpen ? /* @__PURE__ */ jsxs("div", { "data-panel": "", "data-panel-theme": theme, className: "panel-empty", children: [
      emptyMessage,
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "panel-empty-close",
          onClick: () => {
            setSideOpen("left", false);
            setSideOpen("right", false);
          },
          children: "Close"
        }
      )
    ] }) : null;
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    leftRegistration ? /* @__PURE__ */ jsx(
      RegisteredSidePanel,
      {
        side: "left",
        registration: leftRegistration,
        activeId: getActivePanelIdForSide("left"),
        allRegistrations: leftRegistrations,
        open: leftOpen,
        onClose: () => setSideOpen("left", false),
        onOpen: () => setSideOpen("left", true),
        defaultTheme,
        themeStorageKey,
        showThemeToggle
      }
    ) : null,
    rightRegistration ? /* @__PURE__ */ jsx(
      RegisteredSidePanel,
      {
        side: "right",
        registration: rightRegistration,
        activeId: getActivePanelIdForSide("right"),
        allRegistrations: rightRegistrations,
        open: rightOpen,
        onClose: () => setSideOpen("right", false),
        onOpen: () => setSideOpen("right", true),
        defaultTheme,
        themeStorageKey,
        showThemeToggle: false
      }
    ) : null
  ] });
}
function RegisteredSidePanel({
  side,
  registration,
  activeId,
  allRegistrations,
  open,
  onClose,
  onOpen,
  defaultTheme,
  themeStorageKey,
  showThemeToggle
}) {
  const switcher = allRegistrations.length > 1 ? /* @__PURE__ */ jsx(
    ShaderSwitcher,
    {
      activeId,
      registrations: allRegistrations,
      onSelect: setActivePanel
    }
  ) : null;
  return /* @__PURE__ */ jsx(
    Panel,
    {
      id: registration.id,
      side,
      title: registration.title,
      titleSlot: switcher,
      open,
      onClose,
      onOpen,
      values: registration.values,
      defaults: registration.defaults,
      fields: registration.fields,
      onChange: registration.onChange,
      onWriteConfig: registration.onWriteConfig,
      writeLabel: registration.writeLabel,
      prompts: registration.prompts,
      persist: registration.persist,
      defaultTheme,
      themeStorageKey,
      showThemeToggle,
      actionHandlers: registration.actionHandlers
    }
  );
}
function ShaderSwitcher({
  activeId,
  registrations: registrations2,
  onSelect
}) {
  return /* @__PURE__ */ jsx(
    "select",
    {
      className: "panel-switcher",
      value: activeId ?? "",
      onChange: (e) => onSelect(e.target.value),
      "aria-label": "Active shader",
      children: registrations2.map((reg) => /* @__PURE__ */ jsx("option", { value: reg.id, children: reg.title }, reg.id))
    }
  );
}

// src/panel/auto-overlay.ts
var Root = PanelRoot;
var root = null;
var container = null;
var refCount = 0;
var mountedTheme;
function mountPanelOverlay(defaultTheme, defaultOpen) {
  if (typeof document === "undefined") return;
  refCount += 1;
  if (root) return;
  if (defaultOpen !== void 0) initPanelOpenFlag(defaultOpen, "right");
  initPanelOpenFlag(false, "left");
  mountedTheme = defaultTheme;
  container = document.createElement("div");
  container.setAttribute("data-shader-dev-overlay", "");
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(createElement(Root, { defaultTheme: mountedTheme }));
}
function unmountPanelOverlay() {
  if (typeof document === "undefined") return;
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  const toUnmount = root;
  const toRemove = container;
  root = null;
  container = null;
  queueMicrotask(() => {
    toUnmount?.unmount();
    toRemove?.remove();
  });
}

// src/hooks/use-panel.ts
function usePanel(options) {
  const {
    id,
    defaults,
    persist,
    autoMount = true,
    defaultTheme,
    defaultOpen
  } = options;
  const [values, setValues] = useState(
    () => persist === false ? { ...defaults } : loadPersistedPanelValues(id, defaults)
  );
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useLayoutEffect(() => {
    const o = optionsRef.current;
    registerPanel({
      ...o,
      values,
      onChange: setValues
    });
  });
  useEffect(() => {
    if (autoMount) mountPanelOverlay(defaultTheme, defaultOpen);
    return () => {
      unregisterPanel(optionsRef.current.id);
      if (autoMount) unmountPanelOverlay();
    };
  }, []);
  return [values, setValues];
}

// src/shader/use-shader-panel.ts
function useShaderPanel(options) {
  return usePanel({ prompts: DEFAULT_PANEL_PROMPTS, ...options });
}
function isPlane(v) {
  return v?.isPlane === true;
}
function isSphereSurface(v) {
  return typeof v === "object" && v !== null && "radius" in v;
}
function ensureOverlayLayer(container2) {
  const existing = container2.querySelector(
    ":scope > .panel-overlay-layer"
  );
  if (existing) return existing;
  const layer = document.createElement("div");
  layer.className = "panel-overlay-layer";
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.overflow = "visible";
  container2.appendChild(layer);
  return layer;
}
function projectWorld(world, camera, rect) {
  const ndc = world.project(camera);
  const visible = ndc.z <= 1;
  return {
    x: (ndc.x * 0.5 + 0.5) * rect.width,
    y: (ndc.y * -0.5 + 0.5) * rect.height,
    visible
  };
}
function isObject3D(v) {
  return typeof v === "object" && v !== null && v.isObject3D === true;
}
function raycastSurface(screen, camera, rect, surface, scratch) {
  const { raycaster, ndc, hit, plane, normal } = scratch;
  if (!rect.width || !rect.height) return null;
  ndc.set(screen.x / rect.width * 2 - 1, -(screen.y / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (isObject3D(surface)) {
    const hits = raycaster.intersectObject(surface, true);
    if (hits.length === 0) return null;
    const p2 = hits[0].point;
    return [p2.x, p2.y, p2.z];
  }
  if (isSphereSurface(surface)) {
    const c = surface.center;
    const sphere = new Sphere(
      c ? new Vector3(c[0], c[1], c[2]) : new Vector3(0, 0, 0),
      surface.radius
    );
    const p2 = raycaster.ray.intersectSphere(sphere, hit);
    if (!p2) return null;
    return [p2.x, p2.y, p2.z];
  }
  if (isPlane(surface)) {
    plane.copy(surface);
  } else {
    const pt = surface?.point ?? [0, 0, 0];
    if (surface?.normal) {
      normal.set(surface.normal[0], surface.normal[1], surface.normal[2]);
    } else {
      camera.getWorldDirection(normal).negate();
    }
    normal.normalize();
    hit.set(pt[0], pt[1], pt[2]);
    plane.setFromNormalAndCoplanarPoint(normal, hit);
  }
  const p = raycaster.ray.intersectPlane(plane, hit);
  if (!p) return null;
  return [p.x, p.y, p.z];
}
function createR3FBinding(opts) {
  const scratch = new Vector3();
  const rayScratch = {
    raycaster: new Raycaster(),
    ndc: new Vector2(),
    hit: new Vector3(),
    plane: new Plane(),
    normal: new Vector3()
  };
  return {
    project: (world) => {
      const rect = opts.canvas.getBoundingClientRect();
      scratch.set(world[0], world[1], world[2]);
      return projectWorld(scratch, opts.camera, rect);
    },
    unproject: (screen) => {
      const rect = opts.canvas.getBoundingClientRect();
      return raycastSurface(
        screen,
        opts.camera,
        { width: rect.width, height: rect.height },
        opts.surface,
        rayScratch
      );
    },
    onFrame: opts.onFrame
  };
}
function PanelOverlay({
  anchor,
  visible = true,
  children
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const nodeRef = useRef(null);
  const lastVisibleRef = useRef(false);
  const scratch = useRef(new Vector3());
  const layer = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = gl.domElement;
    const container2 = canvas.parentElement ?? document.body;
    return ensureOverlayLayer(container2);
  }, [gl]);
  const node = useMemo(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.className = "panel-overlay-item";
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";
    el.style.willChange = "transform";
    el.style.visibility = "hidden";
    return el;
  }, []);
  useEffect(() => {
    if (!layer || !node) return;
    layer.appendChild(node);
    nodeRef.current = node;
    return () => {
      if (node.parentNode === layer) layer.removeChild(node);
      nodeRef.current = null;
    };
  }, [layer, node]);
  useFrame(() => {
    const el = nodeRef.current;
    if (!el) return;
    if (!visible) {
      if (lastVisibleRef.current) {
        el.style.visibility = "hidden";
        lastVisibleRef.current = false;
      }
      return;
    }
    const world = scratch.current;
    if (isObject3D(anchor)) {
      anchor.getWorldPosition(world);
    } else {
      world.set(anchor[0], anchor[1], anchor[2]);
    }
    const canvas = gl.domElement;
    const rect = canvas.getBoundingClientRect();
    const projected = projectWorld(world, camera, {
      width: rect.width || size.width,
      height: rect.height || size.height
    });
    if (!projected || !projected.visible) {
      if (lastVisibleRef.current) {
        el.style.visibility = "hidden";
        lastVisibleRef.current = false;
      }
      return;
    }
    const x = Math.round(projected.x);
    const y = Math.round(projected.y);
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    if (!lastVisibleRef.current) {
      el.style.visibility = "visible";
      lastVisibleRef.current = true;
    }
  });
  if (!node) return null;
  return createPortal(children, node);
}
function useDragHandle(options) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const optsRef = useRef(options);
  optsRef.current = options;
  const draggingRef = useRef(false);
  const rayScratch = useMemo(
    () => ({
      raycaster: new Raycaster(),
      ndc: new Vector2(),
      hit: new Vector3(),
      plane: new Plane(),
      normal: new Vector3()
    }),
    []
  );
  const worldAt = useCallback(
    (clientX, clientY) => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      return raycastSurface(
        { x: clientX - rect.left, y: clientY - rect.top },
        camera,
        { width: rect.width, height: rect.height },
        optsRef.current.surface,
        rayScratch
      );
    },
    [gl, camera, rayScratch]
  );
  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.stopPropagation();
      const world = worldAt(e.clientX, e.clientY);
      optsRef.current.onDragStart?.(world);
    },
    [worldAt]
  );
  const onPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      e.stopPropagation();
      const world = worldAt(e.clientX, e.clientY);
      if (world) optsRef.current.onDrag(world);
    },
    [worldAt]
  );
  const endDrag = useCallback(
    (e) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      e.stopPropagation();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      const world = worldAt(e.clientX, e.clientY);
      optsRef.current.onDragEnd?.(world);
    },
    [worldAt]
  );
  const handleProps = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      style: {
        // The overlay layer is pointer-events: none; opt this handle back in.
        pointerEvents: "auto",
        // Suppress native touch scrolling/panning while dragging the handle so
        // it doesn't fight the page or canvas — the handle owns the gesture.
        touchAction: "none",
        cursor: "grab"
      }
    }),
    [onPointerDown, onPointerMove, endDrag]
  );
  const isDragging = useCallback(() => draggingRef.current, []);
  return { handleProps, isDragging };
}

export { DEFAULT_PANEL_PROMPTS, PanelOverlay, createR3FAdapter, createR3FBinding, createWebGLAdapter, fillPanelPrompt, hexToRgb01, patchShaderConfigDefaults, raycastSurface, useDragHandle, useShaderPanel };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map