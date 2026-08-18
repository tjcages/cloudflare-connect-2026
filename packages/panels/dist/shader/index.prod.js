import { useState } from 'react';

// src/shader/index.prod.ts

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
        const current = slot.value;
        if (current && typeof current.set === "function") {
          current.set(value);
        } else {
          slot.value = value;
        }
        continue;
      }
      if (field.type === "vec2") {
        const tuple = value;
        const current = slot.value;
        if (current && typeof current.set === "function") {
          current.set(tuple[0], tuple[1]);
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

// src/shader/index.prod.ts
function PanelOverlay(props) {
  return props.children ?? null;
}
function createR3FBinding() {
  return { project: () => null, unproject: () => null, onFrame: () => () => {
  } };
}
function raycastSurface() {
  return null;
}
var NOOP = () => {
};
function useDragHandle(_options) {
  return {
    handleProps: {
      onPointerDown: NOOP,
      onPointerMove: NOOP,
      onPointerUp: NOOP,
      onPointerCancel: NOOP,
      style: {}
    },
    isDragging: () => false
  };
}
var DEFAULT_PANEL_PROMPTS = [];
function fillPanelPrompt(prompt, shaderName) {
  const name = shaderName?.trim() || "shader";
  return prompt.replace(/\{\{\s*shader\s*\}\}/g, name);
}
function useShaderPanel(options) {
  return useState(() => ({ ...options.defaults }));
}

export { DEFAULT_PANEL_PROMPTS, PanelOverlay, createR3FAdapter, createR3FBinding, createWebGLAdapter, fillPanelPrompt, hexToRgb01, patchShaderConfigDefaults, raycastSurface, useDragHandle, useShaderPanel };
//# sourceMappingURL=index.prod.js.map
//# sourceMappingURL=index.prod.js.map