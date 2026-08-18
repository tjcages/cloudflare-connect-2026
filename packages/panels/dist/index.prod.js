import { createContext, useContext, useState } from 'react';

// src/types.ts
function isPanelSection(field) {
  return field.type === "section";
}

// src/lib/gradient.ts
var GRADIENT_STOP_MIN = 1;
var GRADIENT_STOP_MAX = 16;
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
  const ink = color ?? nextPaletteColor(stops.map((stop) => stop.color));
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
  const format = (value) => Number(clamp012(value).toFixed(3)).toString();
  return `custom:${format(x1)},${format(y1)},${format(x2)},${format(y2)}`;
}
function parseCustomEasing(value) {
  if (!value?.startsWith("custom:")) return null;
  const parts = value.slice("custom:".length).split(",").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)))
    return null;
  return {
    x1: clamp012(parts[0] ?? DEFAULT_CUSTOM_EASING.x1),
    y1: clamp012(parts[1] ?? DEFAULT_CUSTOM_EASING.y1),
    x2: clamp012(parts[2] ?? DEFAULT_CUSTOM_EASING.x2),
    y2: clamp012(parts[3] ?? DEFAULT_CUSTOM_EASING.y2)
  };
}
function clamp012(value) {
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
    t = clamp012(t - xAtT / slope);
  }
  return sample(p1y, p2y, t);
}
function easeValue(t, easing) {
  const x = clamp012(t);
  const custom = parseCustomEasing(easing);
  if (custom)
    return clamp012(
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
  return clamp012(eased);
}

// src/lib/color-library.ts
function normalizeHex(value) {
  const raw = value.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw.toLowerCase()}` : "#000000";
}
function p3ChannelFromHex(hex, start) {
  return (Number.parseInt(hex.slice(start, start + 2), 16) / 255).toFixed(4);
}
function p3CssFromHex(hex) {
  const normalized = normalizeHex(hex).replace(/^#/, "");
  return `color(display-p3 ${p3ChannelFromHex(normalized, 0)} ${p3ChannelFromHex(normalized, 2)} ${p3ChannelFromHex(normalized, 4)})`;
}
var supportsDisplayP3Cache = null;
function supportsDisplayP3Color() {
  if (supportsDisplayP3Cache !== null) return supportsDisplayP3Cache;
  supportsDisplayP3Cache = typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("color", "color(display-p3 1 1 1)") && typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(color-gamut: p3)").matches;
  return supportsDisplayP3Cache;
}
function p3ColorForHex(hex, library) {
  const normalized = normalizeHex(hex);
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
  const normalized = normalizeHex(hex);
  return supportsDisplayP3Color() ? p3ColorForHex(normalized, library) : normalized;
}
function findLibraryColor(library, groupName, label) {
  const group = library.find((entry) => entry.name === groupName);
  if (!group) return null;
  return group.colors.find((color) => color.label === label) ?? null;
}
function findLibraryColorByHex(hex, library) {
  if (!library) return null;
  const normalized = normalizeHex(hex);
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

// src/lib/stripe-adapter.ts
function toEditable(stripes) {
  return stripes.map((s, index) => ({
    id: String(index),
    hex: `#${s.color.toString(16).padStart(6, "0")}`,
    startFrom: s.startFrom,
    width: s.width,
    opacity: s.opacity
  }));
}
function fromEditable(rows) {
  return rows.map((r) => ({
    color: parseInt(r.hex.replace(/^#/, ""), 16) || 0,
    startFrom: r.startFrom,
    width: r.width,
    opacity: r.opacity
  }));
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
function sectionsStorageKey(id) {
  return PERSIST_PREFIX + id + SECTIONS_SUFFIX;
}
function clearPersistedPanelSections(id) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(sectionsStorageKey(id));
  } catch {
  }
}

// src/index.prod.ts
function createOverlayProjector() {
  return { register: () => () => {
  }, destroy: () => {
  } };
}
var NOOP = () => {
};
var NULL_COMPONENT = () => null;
var PANEL_CSS = "";
var PANEL_STYLE_ID = "shader-dev-styles";
var PANEL_TOGGLE_EVENT = "cf-shader-dev-toggle";
function registerPanel() {
  return NOOP;
}
var unregisterPanel = NOOP;
var setActivePanel = NOOP;
function getActivePanel() {
  return null;
}
function getActivePanelId() {
  return null;
}
function getActivePanelIdForSide() {
  return null;
}
function getActivePanelForSide() {
  return null;
}
function getPanelRegistration() {
  return null;
}
var EMPTY_MAP = /* @__PURE__ */ new Map();
function getPanelRegistrations() {
  return EMPTY_MAP;
}
function getPanelRegistrationsForSide() {
  return [];
}
function getPanelRevision() {
  return 0;
}
function subscribePanelRegistration() {
  return NOOP;
}
function registerShaderCapture() {
  return NOOP;
}
function getShaderCapture() {
  return null;
}
function subscribeShaderCapture() {
  return NOOP;
}
function registerShaderRecordCanvas() {
  return NOOP;
}
function getShaderRecordCanvas() {
  return null;
}
function registerShaderRecordPrepare() {
  return NOOP;
}
function getShaderRecordPrepare() {
  return null;
}
function registerShaderRecordFrame() {
  return NOOP;
}
function getShaderRecordFrame() {
  return null;
}
function registerShaderGifExport() {
  return NOOP;
}
function getShaderGifExport() {
  return null;
}
function registerShaderVideoExport() {
  return NOOP;
}
function getShaderVideoExport() {
  return null;
}
function subscribeShaderRecording() {
  return NOOP;
}
function setShaderRecording() {
}
var PANEL_ANIMATION_STEP = 1 / 30;
var prodAnimStart = typeof performance !== "undefined" ? performance.now() : 0;
function getPanelAnimationTime() {
  return (performance.now() - prodAnimStart) / 1e3;
}
function advancePanelAnimationDelta(previousTime) {
  const nextTime = getPanelAnimationTime();
  const delta = Math.min(Math.max(0, nextTime - previousTime), 0.1);
  return { time: nextTime, delta };
}
function getPanelAnimationSnapshot() {
  return { playing: true, time: getPanelAnimationTime(), rate: 1 };
}
var playPanelAnimation = NOOP;
var pausePanelAnimation = NOOP;
var togglePanelAnimation = NOOP;
var stepPanelAnimationForward = NOOP;
var stepPanelAnimationBackward = NOOP;
var resetPanelAnimation = () => {
  prodAnimStart = performance.now();
};
var setPanelAnimationTime = NOOP;
var setPanelAnimationRate = NOOP;
function getPanelAnimationRevision() {
  return 0;
}
function subscribePanelAnimation() {
  return NOOP;
}
var initPanelAnimationClock = NOOP;
function loadPersistedPanelValues(_id, defaults) {
  return { ...defaults };
}
var persistPanelValues = NOOP;
var clearPersistedPanelValues = NOOP;
function hasPersistedPanelValues() {
  return false;
}
function loadPersistedPanelSections() {
  return {};
}
var persistPanelSections = NOOP;
var dispatchPanelToggle = NOOP;
function readPanelOpenFlag() {
  return false;
}
var writePanelOpenFlag = NOOP;
var usePanelShortcut = NOOP;
var handlePanelShortcutKeydown = NOOP;
function installPanelKeyboard() {
  return NOOP;
}
function matchPanelShortcut() {
  return false;
}
var ThemeContext = createContext("dark");
var PanelThemeProvider = ThemeContext.Provider;
function usePanelTheme() {
  return "dark";
}
function usePanelThemeContext() {
  return useContext(ThemeContext);
}
function usePanel(options) {
  return useState(() => ({ ...options.defaults }));
}
function renderPanelField() {
  return null;
}
var PanelRoot = NULL_COMPONENT;
var Panel = NULL_COMPONENT;
var FloatingPanel = NULL_COMPONENT;
var PanelHeaderSelect = NULL_COMPONENT;
var ToolShell = NULL_COMPONENT;
var ToolPanel = NULL_COMPONENT;
var PanelToolPanel = NULL_COMPONENT;
var PanelToggleButton = NULL_COMPONENT;
var EyeToggle = NULL_COMPONENT;
var ControlSlider = NULL_COMPONENT;
var ControlSection = NULL_COMPONENT;
var ControlColorInput = NULL_COMPONENT;
var ColorPopover = NULL_COMPONENT;
var colorPopoverStyles = "";
var ControlImageInput = NULL_COMPONENT;
var ControlPath = NULL_COMPONENT;
var ControlToggle = NULL_COMPONENT;
var ControlToggleGroup = NULL_COMPONENT;
var ControlSelect = NULL_COMPONENT;
var ControlVec2 = NULL_COMPONENT;
var ControlPresets = NULL_COMPONENT;
var ControlCollection = NULL_COMPONENT;
var ControlReference = NULL_COMPONENT;
var ControlAnimation = NULL_COMPONENT;
var TOOL_PANEL_WIDTH = 280;
var TOOL_PANEL_INSET = 16;
var TOOL_PANEL_FULL = 296;
var PANEL_THEME_STORAGE_KEY = "shader-dev-theme";
var applyPanelTheme = NOOP;
var ControlAction = NULL_COMPONENT;
var ControlActionGroup = NULL_COMPONENT;
var ControlDisclosure = NULL_COMPONENT;
var ControlGradientStops = NULL_COMPONENT;
var ControlHint = NULL_COMPONENT;
var ControlLibraryColor = NULL_COMPONENT;
var ControlOptionList = NULL_COMPONENT;
var ControlReadout = NULL_COMPONENT;
var ControlSearchField = NULL_COMPONENT;
var ControlStripeColorsTable = NULL_COMPONENT;
var ControlTextInput = NULL_COMPONENT;
var ControlTextarea = NULL_COMPONENT;
var ControlThemeToggle = NULL_COMPONENT;
var EasingGraph = NULL_COMPONENT;
var NativeColorSwatch = NULL_COMPONENT;
var gradientStopsStyles = "";
var stripeColorsTableStyles = "";

export { ColorPopover, ControlAction, ControlActionGroup, ControlAnimation, ControlCollection, ControlColorInput, ControlDisclosure, ControlGradientStops, ControlHint, ControlImageInput, ControlLibraryColor, ControlOptionList, ControlPath, ControlPresets, ControlReadout, ControlReference, ControlSearchField, ControlSection, ControlSelect, ControlSlider, ControlStripeColorsTable, ControlTextInput, ControlTextarea, ControlThemeToggle, ControlToggle, ControlToggleGroup, ControlVec2, DEFAULT_CUSTOM_EASING, EASING_OPTIONS, EasingGraph, EyeToggle, FloatingPanel, GRADIENT_STOP_MAX, GRADIENT_STOP_MIN, NativeColorSwatch, PANEL_ANIMATION_STEP, PANEL_CSS, PANEL_STYLE_ID, PANEL_THEME_STORAGE_KEY, PANEL_TOGGLE_EVENT, Panel, PanelHeaderSelect, PanelRoot, PanelThemeProvider, PanelToggleButton, PanelToolPanel, TOOL_PANEL_FULL, TOOL_PANEL_INSET, TOOL_PANEL_WIDTH, ToolPanel, ToolShell, addGradientStop, advancePanelAnimationDelta, applyPanelTheme, clearPersistedPanelSections, clearPersistedPanelValues, colorPopoverStyles, createOverlayProjector, cssColorForHex, defaultGradientStops, dispatchPanelToggle, easeValue, embedPngDpi, findLibraryColor, findLibraryColorByHex, formatCustomEasing, fromEditable, getActivePanel, getActivePanelForSide, getActivePanelId, getActivePanelIdForSide, getPanelAnimationRevision, getPanelAnimationSnapshot, getPanelAnimationTime, getPanelRegistration, getPanelRegistrations, getPanelRegistrationsForSide, getPanelRevision, getShaderCapture, getShaderGifExport, getShaderRecordCanvas, getShaderRecordFrame, getShaderRecordPrepare, getShaderVideoExport, gradientCss, gradientStopsStyles, handlePanelShortcutKeydown, hasPersistedPanelValues, initPanelAnimationClock, installPanelKeyboard, isPanelSection, loadPersistedPanelSections, loadPersistedPanelValues, matchPanelShortcut, moveGradientStop, moveGradientStopOffset, normalizeGradientStops, p3ColorForHex, p3CssFromHex, parseCustomEasing, pausePanelAnimation, persistPanelSections, persistPanelValues, playPanelAnimation, printMaxEdgePx, rasterizeGradientField, readPanelOpenFlag, recolorGradientStop, registerPanel, registerShaderCapture, registerShaderGifExport, registerShaderRecordCanvas, registerShaderRecordFrame, registerShaderRecordPrepare, registerShaderVideoExport, removeGradientStop, renderPanelField, resetPanelAnimation, sampleGradientRgb, serializeGradientStops, setActivePanel, setPanelAnimationRate, setPanelAnimationTime, setShaderRecording, sortGradientStops, stepPanelAnimationBackward, stepPanelAnimationForward, stripeColorsTableStyles, subscribePanelAnimation, subscribePanelRegistration, subscribeShaderCapture, subscribeShaderRecording, supportsDisplayP3Color, toEditable, togglePanelAnimation, unregisterPanel, usePanel, usePanelShortcut, usePanelTheme, usePanelThemeContext, writePanelOpenFlag };
//# sourceMappingURL=index.prod.js.map
//# sourceMappingURL=index.prod.js.map