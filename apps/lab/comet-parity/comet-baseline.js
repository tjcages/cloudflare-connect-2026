import { C as e, D as t, E as n, S as r, T as i, _ as a, a as o, b as s, c, d as l, f as u, g as d, h as f, i as p, l as m, m as h, n as g, o as _, p as v, r as y, s as b, t as x, u as S, v as C, w, x as T, y as E } from "./theme-DBVlIHQt.js";
import { subscribeStripesStats as D } from "./stats.js";
//#region src/core/clock.ts
function O() {
	return { now: () => performance.now() };
}
function k(e = 0) {
	let t = e;
	return {
		now: () => t,
		set: (e) => {
			t = e;
		},
		advance: (e) => {
			t += e;
		}
	};
}
//#endregion
//#region src/core/engineLifecycle.ts
function A(e) {
	let t = 0, n = () => {
		e.frame(), t = requestAnimationFrame(n);
	}, r = () => {
		t &&= (cancelAnimationFrame(t), 0);
	};
	return {
		start() {
			!e.supportsRaf || t || (e.onStart(), t = requestAnimationFrame(n));
		},
		stop() {
			r(), e.settle();
		},
		settle() {
			e.settle();
		},
		dispose() {
			r(), e.teardown();
		}
	};
}
//#endregion
//#region src/core/frameCap.ts
function ee() {
	return { lastRenderMs: 0 };
}
function j(e, t, n) {
	if (!(t > 0)) return !0;
	let r = 1e3 / t;
	return n - e.lastRenderMs < r - 1 ? !1 : (e.lastRenderMs += r, n - e.lastRenderMs >= r && (e.lastRenderMs = n), !0);
}
//#endregion
//#region src/gl/context.ts
var te = {
	alpha: !0,
	premultipliedAlpha: !0,
	antialias: !1,
	depth: !1,
	stencil: !1,
	preserveDrawingBuffer: !1,
	powerPreference: "high-performance"
};
function M() {
	return typeof window > "u" || !("matchMedia" in window) ? !1 : window.matchMedia("(color-gamut: p3)").matches;
}
function ne(e) {
	let t = e.getContext("webgl2", te);
	if (!t) throw Error("WebGL2 is required but not available");
	t.getExtension("EXT_color_buffer_float");
	let n = !1;
	if (M()) {
		let e = t;
		"drawingBufferColorSpace" in t && (e.drawingBufferColorSpace = "display-p3"), "unpackColorSpace" in t && (e.unpackColorSpace = "display-p3"), n = (e.drawingBufferColorSpace ?? "srgb") === "display-p3";
	}
	let r = t.getParameter(t.MAX_TEXTURE_SIZE);
	return {
		gl: t,
		isP3: n,
		maxTextureSize: r
	};
}
//#endregion
//#region src/gl/renderSurface.ts
function re(e, t) {
	let n = null, r = null;
	return {
		acquireContext() {
			return ne(e);
		},
		getDpr() {
			return t === void 0 ? ((typeof window < "u" ? window.devicePixelRatio : 1) ?? 1) * (e.currentCSSZoom ?? 1) : t;
		},
		setDpr(e) {
			t = e;
		},
		applyOutputSize(t, n) {
			e.width !== t && (e.width = t), e.height !== n && (e.height = n);
		},
		attachContextLossListeners(t, i) {
			n = t, r = i, e.addEventListener("webglcontextlost", t, !1), e.addEventListener("webglcontextrestored", i, !1);
		},
		detachContextLossListeners() {
			n && e.removeEventListener("webglcontextlost", n), r && e.removeEventListener("webglcontextrestored", r), n = null, r = null;
		},
		supportsRaf: !0
	};
}
function ie(e, t) {
	let n = t;
	return {
		acquireContext() {
			return e;
		},
		getDpr() {
			return n;
		},
		setDpr(e) {
			n = e;
		},
		applyOutputSize() {},
		attachContextLossListeners() {},
		detachContextLossListeners() {},
		supportsRaf: !1
	};
}
//#endregion
//#region src/gl/program.ts
function N(e, t, n) {
	let r = e.createShader(t);
	if (!r) throw Error("Failed to create shader");
	if (e.shaderSource(r, n), e.compileShader(r), !e.getShaderParameter(r, e.COMPILE_STATUS)) {
		let n = e.getShaderInfoLog(r);
		e.deleteShader(r);
		let i = t === e.VERTEX_SHADER ? "vertex" : "fragment";
		throw Error(`Shader compile failed (${i}):\n${n ?? "(no log)"}`);
	}
	return r;
}
function P(e, t, n) {
	let r = e.createProgram();
	if (!r) throw Error("Failed to create program");
	let i = N(e, e.VERTEX_SHADER, t), a = N(e, e.FRAGMENT_SHADER, n);
	if (e.attachShader(r, i), e.attachShader(r, a), e.linkProgram(r), e.deleteShader(i), e.deleteShader(a), !e.getProgramParameter(r, e.LINK_STATUS)) {
		let t = e.getProgramInfoLog(r);
		throw e.deleteProgram(r), Error(`Program link failed:\n${t ?? "(no log)"}`);
	}
	return r;
}
function ae(e) {
	let t = e.createVertexArray();
	if (!t) throw Error("Failed to create VAO");
	return {
		draw() {
			e.bindVertexArray(t), e.drawArrays(e.TRIANGLES, 0, 3), e.bindVertexArray(null);
		},
		dispose() {
			e.deleteVertexArray(t);
		}
	};
}
//#endregion
//#region src/gl/resolution.ts
function oe(e, t) {
	let n = Math.max(e.width, e.height);
	if (n <= t) return {
		width: Math.max(1, Math.round(e.width)),
		height: Math.max(1, Math.round(e.height))
	};
	let r = t / n;
	return {
		width: Math.max(1, Math.round(e.width * r)),
		height: Math.max(1, Math.round(e.height * r))
	};
}
function se(e, t, n, r) {
	return oe({
		width: e * n,
		height: t * n
	}, r);
}
function ce(e, t) {
	return {
		width: Math.max(1, Math.floor(e.width * t)),
		height: Math.max(1, Math.floor(e.height * t))
	};
}
function F(e, t, n, r) {
	return {
		width: Math.max(1, Math.min(e.width, Math.ceil(t * r))),
		height: Math.max(1, Math.min(e.height, Math.ceil(n * r)))
	};
}
var le = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform vec2 uGridCount;   // cols, rows\nout vec4 finalColor;\nconst int TAPS = 4;\nvoid main() {\n  vec2 cell = floor(vUv * uGridCount);\n  vec2 cellUv0 = cell / uGridCount;\n  vec2 cellSpan = 1.0 / uGridCount;\n  float sum = 0.0;\n  for (int y = 0; y < TAPS; y++) {\n    for (int x = 0; x < TAPS; x++) {\n      vec2 t = (vec2(float(x), float(y)) + 0.5) / float(TAPS);\n      sum += texture(uField, cellUv0 + t * cellSpan).r;\n    }\n  }\n  finalColor = vec4(vec3(sum / float(TAPS * TAPS)), 1.0);\n}\n", I = !1, L = null, ue = [];
function de() {
	I && (L = null, ue = []);
}
function fe(e) {
	I && (L = {
		name: e,
		width: 0,
		height: 0,
		dispatches: 0,
		pixels: 0
	});
}
function pe() {
	!I || !L || (L.dispatches > 0 && ue.push(L), L = null);
}
function me(e, t) {
	!I || !L || (L.width = e, L.height = t, L.dispatches += 1, L.pixels += e * t);
}
function he() {
	return ue;
}
//#endregion
//#region src/gl/renderTarget.ts
function ge(e, t, n, r, i, a) {
	e.bindTexture(e.TEXTURE_2D, t);
	let o = a ? e.RGBA32F : i ? e.RGBA16F : e.RGBA8, s = a ? e.FLOAT : i ? e.HALF_FLOAT : e.UNSIGNED_BYTE;
	e.texImage2D(e.TEXTURE_2D, 0, o, n, r, 0, e.RGBA, s, null);
}
function R(e, t, n, r = {}) {
	let i = e.createTexture(), a = e.createFramebuffer();
	if (!i || !a) throw i && e.deleteTexture(i), a && e.deleteFramebuffer(a), Error("Failed to create render target");
	e.bindTexture(e.TEXTURE_2D, i);
	let o = r.linear ? e.LINEAR : e.NEAREST;
	e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, o), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, o), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), ge(e, i, t, n, !!r.float, !!r.float32), e.bindFramebuffer(e.FRAMEBUFFER, a), e.framebufferTexture2D(e.FRAMEBUFFER, e.COLOR_ATTACHMENT0, e.TEXTURE_2D, i, 0);
	let s = e.checkFramebufferStatus(e.FRAMEBUFFER);
	if (e.bindFramebuffer(e.FRAMEBUFFER, null), s !== e.FRAMEBUFFER_COMPLETE) throw Error(`Framebuffer incomplete: 0x${s.toString(16)}`);
	return {
		fbo: a,
		texture: i,
		width: t,
		height: n,
		float: !!r.float,
		float32: !!r.float32
	};
}
function _e(e, t, n, r) {
	t.width === n && t.height === r || (ge(e, t.texture, n, r, t.float ?? !1, t.float32 ?? !1), t.width = n, t.height = r);
}
function ve(e, t) {
	e.deleteFramebuffer(t.fbo), e.deleteTexture(t.texture);
}
function z(e, t) {
	e.bindFramebuffer(e.FRAMEBUFFER, t ? t.fbo : null), t && (e.viewport(0, 0, t.width, t.height), me(t.width, t.height));
}
function ye(e) {
	let t = e.createFramebuffer();
	if (!t) throw Error("Failed to create MRT framebuffer");
	return {
		fbo: t,
		dispose() {
			e.deleteFramebuffer(t);
		}
	};
}
function be(e, t, n) {
	e.bindFramebuffer(e.FRAMEBUFFER, t.fbo);
	let r = [];
	for (let t = 0; t < n.length; t++) {
		let i = e.COLOR_ATTACHMENT0 + t;
		e.framebufferTexture2D(e.FRAMEBUFFER, i, e.TEXTURE_2D, n[t].texture, 0), r.push(i);
	}
	e.drawBuffers(r);
	let i = e.checkFramebufferStatus(e.FRAMEBUFFER);
	if (i !== e.FRAMEBUFFER_COMPLETE) throw Error(`MRT framebuffer incomplete: 0x${i.toString(16)}`);
	e.viewport(0, 0, n[0].width, n[0].height);
	for (let e of n) me(e.width, e.height);
}
//#endregion
//#region src/shaders/fullscreen.vert.ts
var B = "#version 300 es\nprecision highp float;\nout vec2 vUv;\nvoid main() {\n  // Fullscreen triangle from gl_VertexID (0,1,2)\n  vec2 p = vec2((gl_VertexID == 2) ? 3.0 : -1.0, (gl_VertexID == 1) ? 3.0 : -1.0);\n  vUv = (p + 1.0) * 0.5;\n  gl_Position = vec4(p, 0.0, 1.0);\n}\n", xe = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uSource;\nuniform vec4 uSrcRect;        // u0,v0,u1,v1\nuniform vec2 uTexel;          // 1/sourceW, 1/sourceH\nuniform vec3 uBg;             // background rgb 0..1\nuniform float uBlur, uSharpen;\nuniform float uBlack, uWhite, uGamma, uExposure, uContrast, uBrightThresh;\nuniform float uInvert, uPosterize, uNoise;\nuniform sampler2D uWater;     // rg = height, velocity; unused while uWaterGain is 0\nuniform float uWaterGain;\nuniform vec2 uWaterTexel;     // 1/simW, 1/simH\nout vec4 finalColor;\n\nvec3 sampleBox(vec2 uv, float radius) {\n  int r = int(radius + 0.5);\n  if (r <= 0) return texture(uSource, uv).rgb;\n  vec3 sum = vec3(0.0); float n = 0.0;\n  for (int y = -4; y <= 4; y++) {\n    if (y < -r || y > r) continue;\n    for (int x = -4; x <= 4; x++) {\n      if (x < -r || x > r) continue;\n      sum += texture(uSource, uv + vec2(float(x), float(y)) * uTexel).rgb; n += 1.0;\n    }\n  }\n  return sum / max(1.0, n);\n}\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n\nvoid main() {\n  vec2 uv = mix(uSrcRect.xy, uSrcRect.zw, vUv);\n  // Displace the source along the water gradient, so surface motion drags the\n  // texture itself rather than only painting highlights over it.\n  if (uWaterGain > 0.0) {\n    vec2 rspan = uSrcRect.zw - uSrcRect.xy;\n    float phL = texture(uWater, vUv - vec2(uWaterTexel.x, 0.0)).r;\n    float phR = texture(uWater, vUv + vec2(uWaterTexel.x, 0.0)).r;\n    float phT = texture(uWater, vUv + vec2(0.0, uWaterTexel.y)).r;\n    float phB = texture(uWater, vUv - vec2(0.0, uWaterTexel.y)).r;\n    vec2 pgrad = vec2(phR - phL, phT - phB);\n    vec2 poff = clamp(pgrad * 0.045 * rspan, -0.015 * rspan, 0.015 * rspan);\n    uv = clamp(uv + poff, uSrcRect.xy, uSrcRect.zw);\n  }\n  vec3 col;\n  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {\n    col = uBg;\n  } else {\n    col = sampleBox(uv, uBlur);\n    if (uSharpen > 0.0) col = col + (col - sampleBox(uv, max(1.0, uBlur))) * uSharpen;\n  }\n  // levels\n  col = clamp((col - uBlack) / max(1e-4, uWhite - uBlack), 0.0, 1.0);\n  col = pow(col, vec3(uGamma));\n  col *= exp2(uExposure);\n  col = (col - 0.5) * uContrast + 0.5;\n  col += vec3(uBrightThresh);\n  if (uInvert > 0.5) col = 1.0 - col;\n  if (uPosterize >= 2.0) col = floor(col * uPosterize) / max(1.0, uPosterize - 1.0);\n  if (uNoise > 0.0) col += vec3((hash(vUv * 4096.0) - 0.5) * uNoise);\n  col = clamp(col, 0.0, 1.0);\n  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));\n  // Signed height brightens crests and darkens troughs. The soft-knee keeps\n  // large amplitudes from blowing out; troughs are scaled down (0.65) so the\n  // stripes never collapse to black under a fast stroke.\n  float wH = texture(uWater, vUv).r;\n  float wC = wH / (1.0 + abs(wH) * 0.5);\n  float wT = sign(wC) * max(0.0, abs(wC) - 0.1) * 1.25;\n  float wS = (wT > 0.0 ? wT : wT * 0.65) * uWaterGain;\n  luma = clamp(luma * (1.0 + wS) + wS * 0.15, 0.0, 1.0);\n  finalColor = vec4(vec3(luma), 1.0);\n}\n";
//#endregion
//#region src/colors/colorMath.ts
function V(e) {
	return [
		(e >> 16 & 255) / 255,
		(e >> 8 & 255) / 255,
		(e & 255) / 255
	];
}
function Se(e, t, n) {
	return (.2126 * e + .7152 * t + .0722 * n) / 255;
}
function Ce(e, t, n) {
	let r = e / 255, i = t / 255, a = n / 255, o = Math.max(r, i, a);
	return o <= 0 ? 0 : (o - Math.min(r, i, a)) / o;
}
//#endregion
//#region src/passes/sourceFieldPass.ts
function we(e, t) {
	let n = P(e, B, xe), r = (t) => e.getUniformLocation(n, t), i = {
		src: r("uSource"),
		rect: r("uSrcRect"),
		texel: r("uTexel"),
		bg: r("uBg"),
		blur: r("uBlur"),
		sharpen: r("uSharpen"),
		black: r("uBlack"),
		white: r("uWhite"),
		gamma: r("uGamma"),
		exposure: r("uExposure"),
		contrast: r("uContrast"),
		brightThresh: r("uBrightThresh"),
		invert: r("uInvert"),
		posterize: r("uPosterize"),
		noise: r("uNoise"),
		water: r("uWater"),
		waterGain: r("uWaterGain"),
		waterTexel: r("uWaterTexel")
	};
	return {
		render(r, a, o) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.src, 0), e.uniform4f(i.rect, o.srcRect.u0, o.srcRect.v0, o.srcRect.u1, o.srcRect.v1), e.uniform2f(i.texel, o.sourceTexelW, o.sourceTexelH);
			let s = o.adjustments;
			e.uniform3f(i.bg, ...V(o.background)), e.uniform1f(i.blur, s.blurRadius), e.uniform1f(i.sharpen, s.sharpenAmount), e.uniform1f(i.black, s.blackPoint), e.uniform1f(i.white, s.whitePoint), e.uniform1f(i.gamma, s.gamma), e.uniform1f(i.exposure, s.exposure), e.uniform1f(i.contrast, s.contrast), e.uniform1f(i.brightThresh, s.brightness + s.thresholdBias), e.uniform1f(i.invert, +!!s.invert), e.uniform1f(i.posterize, s.posterizeLevels), e.uniform1f(i.noise, s.noiseAmount), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, o.water ? o.water.texture : a), e.uniform1i(i.water, 1), e.uniform1f(i.waterGain, o.water ? o.water.gain : 0), e.uniform2f(i.waterTexel, o.water ? o.water.texelX : 1, o.water ? o.water.texelY : 1), e.activeTexture(e.TEXTURE0), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/colorAdjust.glsl.ts
var H = "\nuniform sampler2D uSource;\nuniform vec4 uSrcRect;        // u0,v0,u1,v1\nuniform vec2 uTexel;          // 1/sourceW, 1/sourceH\nuniform vec3 uBg;             // out-of-rect fill rgb 0..1\nuniform vec3 uColorBg;        // distance reference background rgb 0..1\nuniform float uBlur, uSharpen;\nuniform float uBlack, uWhite, uGamma, uExposure, uContrast, uBrightThresh;\nuniform float uInvert, uPosterize, uNoise;\n\nvec3 sampleBox(vec2 uv, float radius) {\n  int r = int(radius + 0.5);\n  if (r <= 0) return texture(uSource, uv).rgb;\n  vec3 sum = vec3(0.0); float n = 0.0;\n  for (int y = -4; y <= 4; y++) {\n    if (y < -r || y > r) continue;\n    for (int x = -4; x <= 4; x++) {\n      if (x < -r || x > r) continue;\n      sum += texture(uSource, uv + vec2(float(x), float(y)) * uTexel).rgb; n += 1.0;\n    }\n  }\n  return sum / max(1.0, n);\n}\nfloat hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n\nvec3 adjustedColor(vec2 vUv) {\n  vec2 uv = mix(uSrcRect.xy, uSrcRect.zw, vUv);\n  vec3 col;\n  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {\n    col = uBg;\n  } else {\n    col = sampleBox(uv, uBlur);\n    if (uSharpen > 0.0) col = col + (col - sampleBox(uv, max(1.0, uBlur))) * uSharpen;\n  }\n  col = clamp((col - uBlack) / max(1e-4, uWhite - uBlack), 0.0, 1.0);\n  col = pow(col, vec3(uGamma));\n  col *= exp2(uExposure);\n  col = (col - 0.5) * uContrast + 0.5;\n  col += vec3(uBrightThresh);\n  if (uInvert > 0.5) col = 1.0 - col;\n  if (uPosterize >= 2.0) col = floor(col * uPosterize) / max(1.0, uPosterize - 1.0);\n  if (uNoise > 0.0) col += vec3((hash(vUv * 4096.0) - 0.5) * uNoise);\n  col = clamp(col, 0.0, 1.0);\n  return col;\n}\n", U = `#version 300 es
precision highp float;
in vec2 vUv;
uniform float uMaxColorDist;  // largest in-texture distance from uColorBg (0..sqrt(3))
layout(location=0) out vec4 oField;
layout(location=1) out vec4 oColor;
${H}
void main() {
  vec3 col = adjustedColor(vUv);
  float presence = min(1.0, length(col - uColorBg) / max(uMaxColorDist, 1e-4));
  oField = vec4(vec3(presence), 1.0);
  oColor = vec4(col, presence);
}
`;
//#endregion
//#region src/passes/sourceFieldColorPass.ts
function Te(e, t) {
	let n = P(e, B, U), r = (t) => e.getUniformLocation(n, t), i = {
		src: r("uSource"),
		rect: r("uSrcRect"),
		texel: r("uTexel"),
		bg: r("uBg"),
		colorBg: r("uColorBg"),
		maxColorDist: r("uMaxColorDist"),
		blur: r("uBlur"),
		sharpen: r("uSharpen"),
		black: r("uBlack"),
		white: r("uWhite"),
		gamma: r("uGamma"),
		exposure: r("uExposure"),
		contrast: r("uContrast"),
		brightThresh: r("uBrightThresh"),
		invert: r("uInvert"),
		posterize: r("uPosterize"),
		noise: r("uNoise")
	};
	return {
		render(r, a, o, s, c) {
			be(e, r, [a, o]), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(i.src, 0), e.uniform4f(i.rect, c.srcRect.u0, c.srcRect.v0, c.srcRect.u1, c.srcRect.v1), e.uniform2f(i.texel, c.sourceTexelW, c.sourceTexelH);
			let l = c.adjustments;
			e.uniform3f(i.bg, ...V(c.background)), e.uniform3f(i.colorBg, ...V(c.colorBackground)), e.uniform1f(i.maxColorDist, c.maxColorDist), e.uniform1f(i.blur, l.blurRadius), e.uniform1f(i.sharpen, l.sharpenAmount), e.uniform1f(i.black, l.blackPoint), e.uniform1f(i.white, l.whitePoint), e.uniform1f(i.gamma, l.gamma), e.uniform1f(i.exposure, l.exposure), e.uniform1f(i.contrast, l.contrast), e.uniform1f(i.brightThresh, l.brightness + l.thresholdBias), e.uniform1f(i.invert, +!!l.invert), e.uniform1f(i.posterize, l.posterizeLevels), e.uniform1f(i.noise, l.noiseAmount), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/edgeMask.glsl.ts
var Ee = "\nuniform float uEdgeMaskEnabled;\nuniform float uEdgeMaskStart;\nuniform float uEdgeMaskEnd;\nuniform float uEdgeMaskPower;\nuniform vec4 uEdgeMaskSides;\n\nfloat edgeMaskRamp(float inset, float side) {\n  float t = clamp((inset - uEdgeMaskStart) / (uEdgeMaskEnd - uEdgeMaskStart), 0.0, 1.0);\n  return mix(1.0, pow(t, uEdgeMaskPower), side);\n}\n\nfloat edgeMaskAlpha(vec2 uv) {\n  if (uEdgeMaskEnabled < 0.5) return 1.0;\n  vec4 insets = vec4(uv.x, 1.0 - uv.x, uv.y, 1.0 - uv.y);\n  return\n    edgeMaskRamp(insets.x, uEdgeMaskSides.x) *\n    edgeMaskRamp(insets.y, uEdgeMaskSides.y) *\n    edgeMaskRamp(insets.z, uEdgeMaskSides.z) *\n    edgeMaskRamp(insets.w, uEdgeMaskSides.w);\n}\n", De = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uField;
${Ee}
out vec4 finalColor;
void main() {
  finalColor = vec4(texture(uField, vUv).rgb, 1.0) * edgeMaskAlpha(vUv);
}
`;
//#endregion
//#region src/passes/presentPass.ts
function Oe(e, t) {
	let n = P(e, B, De), r = e.getUniformLocation(n, "uField"), i = e.getUniformLocation(n, "uEdgeMaskEnabled"), a = e.getUniformLocation(n, "uEdgeMaskStart"), o = e.getUniformLocation(n, "uEdgeMaskEnd"), s = e.getUniformLocation(n, "uEdgeMaskPower"), c = e.getUniformLocation(n, "uEdgeMaskSides");
	return {
		render(l, u, d, f, p, m = 0, h = 0) {
			e.bindFramebuffer(e.FRAMEBUFFER, null), e.viewport(m, h, u, d), me(u, d), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, l), e.uniform1i(r, 0), e.uniform1f(i, +!!p), e.uniform1f(a, f.start), e.uniform1f(o, f.end), e.uniform1f(s, f.power), e.uniform4f(c, +!!f.sides.left, +!!f.sides.right, +!!f.sides.bottom, +!!f.sides.top), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/passes/downsamplePass.ts
function ke(e, t) {
	let n = P(e, B, le), r = e.getUniformLocation(n, "uField"), i = e.getUniformLocation(n, "uGridCount");
	return {
		render(a, o, s, c) {
			z(e, a), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(r, 0), e.uniform2f(i, s, c), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/downsampleColor.frag.ts
var Ae = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform vec2 uGridCount;   // cols, rows\nout vec4 finalColor;\nconst int TAPS = 4;\nvoid main() {\n  vec2 cell = floor(vUv * uGridCount);\n  vec2 cellUv0 = cell / uGridCount;\n  vec2 cellSpan = 1.0 / uGridCount;\n  vec4 sum = vec4(0.0);\n  for (int y = 0; y < TAPS; y++) {\n    for (int x = 0; x < TAPS; x++) {\n      vec2 t = (vec2(float(x), float(y)) + 0.5) / float(TAPS);\n      sum += texture(uField, cellUv0 + t * cellSpan);\n    }\n  }\n  finalColor = sum / float(TAPS * TAPS);\n}\n";
//#endregion
//#region src/passes/downsampleColorPass.ts
function je(e, t) {
	let n = P(e, B, Ae), r = e.getUniformLocation(n, "uField"), i = e.getUniformLocation(n, "uGridCount");
	return {
		render(a, o, s, c) {
			z(e, a), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(r, 0), e.uniform2f(i, s, c), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/reveal.frag.ts
var Me = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform vec2 uGridCount;\nuniform float uRevealMode;\nuniform vec2 uOrigin;\nuniform float uMaxDist;\nuniform float uProgress;\nuniform float uSoftness;\nuniform float uWaviness;\nuniform float uBandRamp;\nout vec4 finalColor;\n\nhighp float cellNoise(highp float col, highp float row) {\n  highp float px = floor(col / 0.1);\n  highp float py = floor(row / 0.1);\n  highp float p3x = fract(px * 0.1031);\n  highp float p3y = fract(py * 0.103);\n  highp float p3z = fract(px * 0.0973);\n  highp float d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);\n  p3x += d;\n  p3y += d;\n  p3z += d;\n  return fract((p3x + p3y) * p3z);\n}\n\nvoid main() {\n  float v = texture(uField, vUv).r;\n  float mask = 1.0;\n  if (uRevealMode > 0.5) {\n    vec2 cell = floor(vUv * uGridCount);\n    vec2 cellCenterUv = (cell + 0.5) / uGridCount;\n    float dist = length(cellCenterUv - uOrigin) / max(uMaxDist, 1e-4);\n    float n = (cellNoise(cell.x, cell.y) - 0.5) * uWaviness;\n    mask = smoothstep(dist - max(uSoftness, 0.0), dist + max(uSoftness, 0.0) + uBandRamp, max(uProgress, 0.0) + n);\n  }\n  finalColor = vec4(vec3(v * mask), 1.0);\n}\n";
//#endregion
//#region src/passes/revealPass.ts
function Ne(e, t) {
	let n = P(e, B, Me), r = (t) => e.getUniformLocation(n, t), i = {
		field: r("uField"),
		grid: r("uGridCount"),
		mode: r("uRevealMode"),
		origin: r("uOrigin"),
		maxDist: r("uMaxDist"),
		progress: r("uProgress"),
		softness: r("uSoftness"),
		waviness: r("uWaviness"),
		bandRamp: r("uBandRamp")
	};
	return {
		render(r, a, o, s, c) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.field, 0), e.uniform2f(i.grid, o, s), e.uniform1f(i.mode, c.revealMode), e.uniform2f(i.origin, c.origin[0], c.origin[1]), e.uniform1f(i.maxDist, c.maxDist), e.uniform1f(i.progress, c.progress), e.uniform1f(i.softness, c.softness), e.uniform1f(i.waviness, c.waviness), e.uniform1f(i.bandRamp, c.bandRamp), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/assemblyScatter.vert.ts
var Pe = "#version 300 es\nprecision highp float;\nuniform vec2 uBlockGrid;\nuniform float uProgress;\nuniform float uSpread;\nuniform float uFlight;\nuniform float uSpawnDist;\nuniform vec2 uScatter;\nuniform float uAngleJitter;\nuniform vec2 uSigmaUv;\nuniform float uBlurStart;\nout vec2 vSampleUv;\nflat out highp float vBlurAmount;\nflat out vec2 vRectMin;\nflat out vec2 vRectMax;\n\nhighp float fract1(highp float v) {\n  return v - floor(v);\n}\n\nhighp float cellNoise(highp float col, highp float row, highp float scale) {\n  highp float s = max(0.1, scale);\n  highp float px = floor(col / s);\n  highp float py = floor(row / s);\n  highp float p3x = fract1(px * 0.1031);\n  highp float p3y = fract1(py * 0.103);\n  highp float p3z = fract1(px * 0.0973);\n  highp float d = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);\n  p3x += d;\n  p3y += d;\n  p3z += d;\n  return fract1((p3x + p3y) * p3z);\n}\n\nhighp float bezierAxis(highp float a1, highp float a2, highp float s) {\n  highp float c = 3.0 * a1;\n  highp float b = 3.0 * (a2 - a1) - c;\n  highp float a = 1.0 - c - b;\n  return ((a * s + b) * s + c) * s;\n}\n\nhighp float bezierSlope(highp float a1, highp float a2, highp float s) {\n  highp float c = 3.0 * a1;\n  highp float b = 3.0 * (a2 - a1) - c;\n  highp float a = 1.0 - c - b;\n  return (3.0 * a * s + 2.0 * b) * s + c;\n}\n\nhighp float cubicBezier(highp float t, highp float x1, highp float y1, highp float x2, highp float y2) {\n  highp float s = t;\n  for (int i = 0; i < 5; i++) {\n    highp float dx = bezierAxis(x1, x2, s) - t;\n    highp float d = bezierSlope(x1, x2, s);\n    if (abs(d) < 0.00001) break;\n    s = clamp(s - dx / d, 0.0, 1.0);\n  }\n  return bezierAxis(y1, y2, s);\n}\n\nhighp float orderNorm(highp float col, highp float row, highp float cols, highp float rows) {\n  highp float cx = cols <= 1.0 ? 0.5 : (col + 0.5) / cols;\n  highp float cy = rows <= 1.0 ? 0.5 : (row + 0.5) / rows;\n  return length(vec2(cx - 0.5, cy - 0.5)) / 0.70710678;\n}\n\nvoid main() {\n  highp float bCols = uBlockGrid.x;\n  highp float instance = float(gl_InstanceID);\n  highp float bx = mod(instance, bCols);\n  highp float by = floor(instance / bCols);\n\n  vec2 uv0 = vec2(bx / uBlockGrid.x, by / uBlockGrid.y);\n  vec2 uv1 = vec2(min(1.0, (bx + 1.0) / uBlockGrid.x), min(1.0, (by + 1.0) / uBlockGrid.y));\n  vec2 blockCenterUv = 0.5 * (uv0 + uv1);\n  vec2 halfExt = 0.5 * (uv1 - uv0);\n\n  highp float orderKey = orderNorm(bx, by, uBlockGrid.x, uBlockGrid.y);\n  highp float f = clamp((uProgress - uSpread * orderKey) / max(uFlight, 1e-4), 0.0, 1.0);\n\n  int vid = gl_VertexID;\n  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;\n  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;\n\n  if (f <= 0.0) {\n    vSampleUv = blockCenterUv;\n    vBlurAmount = 1.0;\n    vRectMin = uv0;\n    vRectMax = uv1;\n    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);\n    return;\n  }\n\n  highp float dL = blockCenterUv.x;\n  highp float dR = 1.0 - blockCenterUv.x;\n  highp float dT = blockCenterUv.y;\n  highp float dB = 1.0 - blockCenterUv.y;\n  vec2 edgeDir;\n  highp float edgeDistTo;\n  if (dL <= dR && dL <= dT && dL <= dB) { edgeDir = vec2(-1.0, 0.0); edgeDistTo = dL; }\n  else if (dR <= dT && dR <= dB) { edgeDir = vec2(1.0, 0.0); edgeDistTo = dR; }\n  else if (dT <= dB) { edgeDir = vec2(0.0, -1.0); edgeDistTo = dT; }\n  else { edgeDir = vec2(0.0, 1.0); edgeDistTo = dB; }\n\n  highp float ang = (cellNoise(bx + 17.0, by + 23.0, 1.0) - 0.5) * 2.0 * uAngleJitter;\n  highp float ca = cos(ang);\n  highp float sa = sin(ang);\n  edgeDir = vec2(edgeDir.x * ca - edgeDir.y * sa, edgeDir.x * sa + edgeDir.y * ca);\n\n  highp float offMargin = 0.06 + 0.16 * cellNoise(bx, by, 1.0);\n  vec2 perp = vec2(-edgeDir.y, edgeDir.x);\n  highp float spr = (cellNoise(by + 11.0, bx + 5.0, 1.0) - 0.5) * 0.18;\n  vec2 spawnOffset = edgeDir * (edgeDistTo + offMargin) + perp * spr;\n  vec2 jitter = vec2(cellNoise(bx + 3.0, by + 7.0, 1.0), cellNoise(bx + 31.0, by + 13.0, 1.0)) - 0.5;\n  spawnOffset += jitter * 2.0 * uScatter;\n\n  highp float ease = cubicBezier(f, 0.25, 0.1, 0.25, 1.0);\n  vec2 offset = (1.0 - ease) * spawnOffset;\n\n  highp float fBlur = clamp((f - uBlurStart) / max(1.0 - uBlurStart, 1e-4), 0.0, 1.0);\n  highp float blurAmount = 1.0 - cubicBezier(fBlur, 0.25, 0.1, 0.25, 1.0);\n  vec2 ext = blurAmount * uSigmaUv * 2.0;\n  vec2 cornerUv = vec2(mix(uv0.x - ext.x, uv1.x + ext.x, qx), mix(uv0.y - ext.y, uv1.y + ext.y, qy));\n  vSampleUv = cornerUv;\n  vBlurAmount = blurAmount;\n  vRectMin = uv0;\n  vRectMax = uv1;\n\n  vec2 posUv = cornerUv + offset;\n  gl_Position = vec4(posUv * 2.0 - 1.0, 0.0, 1.0);\n}\n", Fe = "#version 300 es\nprecision highp float;\nin vec2 vSampleUv;\nflat in highp float vBlurAmount;\nflat in vec2 vRectMin;\nflat in vec2 vRectMax;\nuniform sampler2D uField;\nuniform sampler2D uBlurQuarter;\nuniform sampler2D uBlurHalf;\nuniform sampler2D uBlurFull;\nuniform vec2 uSigmaUv;\nout vec4 finalColor;\n\nvoid main() {\n  float s = vBlurAmount;\n  vec2 suv = clamp(vSampleUv, vRectMin, vRectMax);\n  float v;\n  if (s <= 0.0) {\n    v = texture(uField, suv).r;\n  } else if (s <= 0.25) {\n    v = mix(texture(uField, suv).r, texture(uBlurQuarter, suv).r, s * 4.0);\n  } else if (s <= 0.5) {\n    v = mix(texture(uBlurQuarter, suv).r, texture(uBlurHalf, suv).r, (s - 0.25) * 4.0);\n  } else {\n    v = mix(texture(uBlurHalf, suv).r, texture(uBlurFull, suv).r, (s - 0.5) * 2.0);\n  }\n  vec2 r = max(s * uSigmaUv, vec2(1e-6));\n  float cov = smoothstep(vRectMin.x - r.x, vRectMin.x + r.x, vSampleUv.x) *\n    (1.0 - smoothstep(vRectMax.x - r.x, vRectMax.x + r.x, vSampleUv.x)) *\n    smoothstep(vRectMin.y - r.y, vRectMin.y + r.y, vSampleUv.y) *\n    (1.0 - smoothstep(vRectMax.y - r.y, vRectMax.y + r.y, vSampleUv.y));\n  finalColor = vec4(vec3(v * cov), 1.0);\n}\n";
//#endregion
//#region src/passes/assemblyScatterPass.ts
function Ie(e) {
	let t = P(e, Pe, Fe), n = e.createVertexArray();
	if (!n) throw Error("Failed to create VAO");
	let r = (n) => e.getUniformLocation(t, n), i = {
		field: r("uField"),
		blurQuarter: r("uBlurQuarter"),
		blurHalf: r("uBlurHalf"),
		blurFull: r("uBlurFull"),
		blockGrid: r("uBlockGrid"),
		progress: r("uProgress"),
		spread: r("uSpread"),
		flight: r("uFlight"),
		spawnDist: r("uSpawnDist"),
		scatter: r("uScatter"),
		angleJitter: r("uAngleJitter"),
		sigmaUv: r("uSigmaUv"),
		blurStart: r("uBlurStart")
	};
	return {
		render(r, a, o, s, c, l) {
			z(e, r), e.clearColor(0, 0, 0, 1), e.clear(e.COLOR_BUFFER_BIT), e.useProgram(t), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.field, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(i.blurQuarter, 1), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(i.blurHalf, 2), e.activeTexture(e.TEXTURE3), e.bindTexture(e.TEXTURE_2D, c), e.uniform1i(i.blurFull, 3), e.activeTexture(e.TEXTURE0), e.uniform2f(i.blockGrid, l.blockCols, l.blockRows), e.uniform1f(i.progress, l.progress), e.uniform1f(i.spread, l.spread), e.uniform1f(i.flight, l.flight), e.uniform1f(i.spawnDist, l.spawnDist), e.uniform2f(i.scatter, l.scatter[0], l.scatter[1]), e.uniform1f(i.angleJitter, l.angleJitter), e.uniform2f(i.sigmaUv, l.sigmaUv[0], l.sigmaUv[1]), e.uniform1f(i.blurStart, l.blurStart), e.enable(e.BLEND), e.blendEquation(e.MAX), e.bindVertexArray(n), e.drawArraysInstanced(e.TRIANGLES, 0, 6, l.blockCols * l.blockRows), e.bindVertexArray(null), e.blendEquation(e.FUNC_ADD), e.disable(e.BLEND);
		},
		dispose() {
			e.deleteProgram(t), e.deleteVertexArray(n);
		}
	};
}
//#endregion
//#region src/shaders/energyWarp.frag.ts
var Le = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform int uMode;\nuniform float uProgress;\nuniform float uSpread;\nuniform float uFlight;\nuniform float uIntensity;\nuniform float uDetail;\nuniform float uGlow;\nout vec4 finalColor;\n\nhighp float vhash(vec2 q) {\n  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453123);\n}\n\nhighp float vnoise(vec2 q) {\n  vec2 i = floor(q);\n  vec2 fr = fract(q);\n  vec2 u = fr * fr * (3.0 - 2.0 * fr);\n  highp float a = vhash(i);\n  highp float b = vhash(i + vec2(1.0, 0.0));\n  highp float c = vhash(i + vec2(0.0, 1.0));\n  highp float d = vhash(i + vec2(1.0, 1.0));\n  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);\n}\n\nhighp float fbm2(vec2 q) {\n  return 0.62 * vnoise(q) + 0.38 * vnoise(q * 2.73 + 13.7);\n}\n\nvoid main() {\n  highp float p = max(uProgress, 0.0);\n  highp float freq = mix(2.0, 10.0, uDetail);\n\n  highp float n;\n  if (uMode == 0) {\n    highp float n0 = fbm2(vUv * mix(4.0, 14.0, uDetail) + 7.3);\n    highp float n1 = vhash(floor(vUv * mix(8.0, 26.0, uDetail)) * 0.173 + 3.7);\n    n = clamp(mix(n0, n1, 0.55), 0.0, 1.0);\n  } else {\n    highp float rows = mix(14.0, 60.0, uDetail);\n    n = vhash(vec2(floor(vUv.y * rows) * 0.57, 12.3));\n  }\n\n  highp float f = clamp((p - uSpread * n) / max(uFlight, 1e-4), 0.0, 1.0);\n  if (f >= 1.0) {\n    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);\n    return;\n  }\n  highp float ease = 1.0 - pow(1.0 - f, 3.0);\n\n  if (uMode == 0) {\n    highp float sOff = (fbm2(vUv * 5.0 + 21.7) - 0.5) * 0.24;\n    highp float s = smoothstep(0.5 + sOff, 1.0, f);\n    highp float settle = s * s * (3.0 - 2.0 * s);\n    highp float decay = 1.0 - settle;\n    highp float emerge = smoothstep(0.0, 0.22, f);\n    vec2 flow = vec2(p * 0.9, -p * 0.6);\n    vec2 q1 = vUv * freq + flow + 2.1;\n    vec2 q2 = vUv * freq * 2.6 + flow * 1.8 + 17.3;\n    highp float e = 0.09;\n    vec2 c1 = vec2(fbm2(q1 + vec2(0.0, e)) - fbm2(q1 - vec2(0.0, e)), fbm2(q1 - vec2(e, 0.0)) - fbm2(q1 + vec2(e, 0.0))) / (2.0 * e);\n    vec2 c2 = vec2(fbm2(q2 + vec2(0.0, e)) - fbm2(q2 - vec2(0.0, e)), fbm2(q2 - vec2(e, 0.0)) - fbm2(q2 + vec2(e, 0.0))) / (2.0 * e);\n    vec2 curlV = c1 * 0.75 + c2 * 0.35;\n    highp float vort = 0.55 + 0.9 * decay;\n    vec2 disp = curlV * 0.09 * vort * uIntensity * decay;\n    highp float acc = 0.0;\n    for (int t = 0; t < 5; t++) {\n      highp float w = 0.55 + 0.225 * float(t);\n      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;\n    }\n    highp float v = acc * 0.2;\n    highp float gain = 1.0 + uGlow * 1.2 * min(1.0, length(disp) * 8.0) * decay + uGlow * 1.6 * emerge * (1.0 - emerge);\n    finalColor = vec4(vec3(v * gain * emerge), 1.0);\n    return;\n  }\n\n  if (uMode == 1) {\n    highp float inten = smoothstep(0.0, 0.75, f);\n    inten *= inten;\n    highp float masterDecay = 1.0 - smoothstep(0.82, 0.95, f);\n    highp float emerge = smoothstep(0.0, 0.1, f) * (0.45 + 0.55 * smoothstep(0.3, 0.9, f));\n    highp float rows = mix(14.0, 60.0, uDetail);\n    highp float rowC = floor(vUv.y * rows);\n    highp float stp = floor(p * 46.0);\n    highp float duty = mix(0.92, 0.3, inten);\n    highp float act = step(duty, vhash(vec2(rowC * 0.53 + stp * 1.71, 6.1)));\n    highp float h = vhash(vec2(rowC * 0.37 + stp * 1.13, 4.2));\n    vec2 disp = vec2((h - 0.5) * (0.25 + 0.45 * inten), (vhash(vec2(rowC * 0.71 + stp * 1.31, 2.6)) - 0.5) * 0.05 * inten) * act * masterDecay * uIntensity;\n    highp float acc = 0.0;\n    for (int t = 0; t < 5; t++) {\n      highp float w = 0.55 + 0.225 * float(t);\n      acc += texture(uField, clamp(vUv + disp * w, 0.0, 1.0)).r;\n    }\n    highp float v = acc * 0.2;\n    highp float white = smoothstep(0.78, 0.86, f) * (1.0 - smoothstep(0.88, 0.97, f));\n    highp float gain = 1.0 + uGlow * 0.6 * act * inten * masterDecay + uGlow * 0.5 * inten * masterDecay * (vhash(vec2(stp, 3.7)) - 0.5) * 2.0;\n    finalColor = vec4(vec3(v * max(gain, 0.0) * emerge + white * uGlow * 1.6), 1.0);\n    return;\n  }\n\n  finalColor = vec4(vec3(texture(uField, vUv).r * smoothstep(0.0, 0.2, f)), 1.0);\n}\n";
//#endregion
//#region src/passes/energyWarpPass.ts
function Re(e, t) {
	let n = P(e, B, Le), r = (t) => e.getUniformLocation(n, t), i = {
		field: r("uField"),
		mode: r("uMode"),
		progress: r("uProgress"),
		spread: r("uSpread"),
		flight: r("uFlight"),
		intensity: r("uIntensity"),
		detail: r("uDetail"),
		glow: r("uGlow")
	};
	return {
		render(r, a, o) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.field, 0), e.uniform1i(i.mode, o.mode), e.uniform1f(i.progress, o.progress), e.uniform1f(i.spread, o.spread), e.uniform1f(i.flight, o.flight), e.uniform1f(i.intensity, o.intensity), e.uniform1f(i.detail, o.detail), e.uniform1f(i.glow, o.glow), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/vortexCore.frag.ts
var ze = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform float uProgress;\nuniform float uSpread;\nuniform float uFlight;\nuniform vec2 uGrid;\nuniform float uGlow;\nuniform float uAspect;\nout vec4 finalColor;\n\nhighp uint pcg(highp uint v) {\n  v = v * 747796405u + 2891336453u;\n  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;\n  return (s >> 22) ^ s;\n}\n\nhighp float hashLane(highp uint i, highp uint salt) {\n  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);\n}\n\nvoid main() {\n  highp float p = max(uProgress, 0.0);\n  if (p >= uSpread * 1.12 + uFlight * 1.25) {\n    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);\n    return;\n  }\n  vec2 cid = floor(vUv * uGrid);\n  highp uint cellIndex = uint(cid.y * uGrid.x + cid.x);\n  vec2 cellCenter = (cid + 0.5) / uGrid;\n  vec2 asp = vec2(uAspect, 1.0);\n  highp float dn = length((cellCenter - 0.5) * asp) / (length(asp) * 0.5);\n  highp float o = (dn * 0.7 + (hashLane(cellIndex, 1u) - 0.5) * 0.5 + 0.25) / 1.2;\n  o = o < 0.5 ? sqrt(0.5 * o) : 1.0 - sqrt(0.5 * (1.0 - o));\n  highp float blockV = texture(uField, cellCenter).r;\n  highp float fullV = texture(uField, vUv).r;\n  highp float accFrac = 0.0;\n  highp float lastRaw = 0.0;\n  for (uint k = 0u; k < 3u; k++) {\n    highp float ok = o + float(k) * 0.04 + hashLane(cellIndex * 3u + k, 4u) * 0.02;\n    highp float fr = (p - uSpread * ok) / max(uFlight, 1e-4);\n    accFrac += step(1.0, fr) / 3.0;\n    if (k == 2u) {\n      lastRaw = fr;\n    }\n  }\n  highp float refine = smoothstep(1.0, 1.2, lastRaw);\n  highp float flash = step(1.0, lastRaw) * (1.0 - smoothstep(1.0, 1.1, lastRaw));\n  highp float v = mix(blockV * accFrac, fullV, refine);\n  finalColor = vec4(vec3(v * (1.0 + 0.3 * uGlow * flash)), 1.0);\n}\n", Be = "#version 300 es\nprecision highp float;\nuniform float uProgress;\nuniform float uSpread;\nuniform float uFlight;\nuniform vec2 uGrid;\nuniform float uGlow;\nuniform float uIntensity;\nuniform float uSwirl;\nuniform float uAspect;\nuniform sampler2D uField;\nout vec2 vQuad;\nflat out highp float vVal;\n\nhighp uint pcg(highp uint v) {\n  v = v * 747796405u + 2891336453u;\n  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;\n  return (s >> 22) ^ s;\n}\n\nhighp float hashLane(highp uint i, highp uint salt) {\n  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);\n}\n\nvec2 vortexPos(vec2 sUv, vec2 tUv, vec2 asp, highp float total, highp float blend, highp float e) {\n  vec2 straight = mix(sUv, tUv, e);\n  if (blend <= 0.001) {\n    return straight;\n  }\n  vec2 sv = (sUv - 0.5) * asp;\n  vec2 tv = (tUv - 0.5) * asp;\n  highp float rt = length(tv);\n  highp float aT = rt > 1e-5 ? atan(tv.y, tv.x) : 0.0;\n  highp float rMax = length(asp) * 0.5;\n  highp float rStart = max(length(sv), rMax * 1.02);\n  highp float ang = aT - total * (1.0 - e);\n  highp float rr = mix(rStart, rt, e);\n  vec2 spiral = 0.5 + (vec2(cos(ang), sin(ang)) * rr) / asp;\n  return mix(straight, spiral, blend);\n}\n\nvoid main() {\n  highp uint id = uint(gl_InstanceID);\n  highp uint cellIndex = id / 3u;\n  highp uint k = id - cellIndex * 3u;\n  highp float gx = uGrid.x;\n  vec2 cell = vec2(mod(float(cellIndex), gx), floor(float(cellIndex) / gx));\n  vec2 targetUv = (cell + 0.5) / uGrid;\n  vec2 asp = vec2(uAspect, 1.0);\n  highp float dn = length((targetUv - 0.5) * asp) / (length(asp) * 0.5);\n  highp float o = (dn * 0.7 + (hashLane(cellIndex, 1u) - 0.5) * 0.5 + 0.25) / 1.2;\n  o = o < 0.5 ? sqrt(0.5 * o) : 1.0 - sqrt(0.5 * (1.0 - o));\n  o = o + float(k) * 0.04 + hashLane(id, 4u) * 0.02;\n  highp float p = max(uProgress, 0.0);\n  highp float f = (p - uSpread * o) / max(uFlight, 1e-4);\n  highp float blockV = texture(uField, targetUv).r;\n  if (f <= 0.0 || f >= 1.0 || blockV < 0.02) {\n    vQuad = vec2(0.0);\n    vVal = 0.0;\n    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);\n    return;\n  }\n  highp float dL = targetUv.x;\n  highp float dR = 1.0 - targetUv.x;\n  highp float dT = targetUv.y;\n  highp float dB = 1.0 - targetUv.y;\n  highp float jit = (hashLane(id, 2u) - 0.5) * 0.3;\n  highp float depth = 0.04 + 0.18 * hashLane(id, 3u);\n  vec2 startUv;\n  if (dL <= dR && dL <= dT && dL <= dB) {\n    startUv = vec2(-depth, targetUv.y + jit);\n  } else if (dR <= dT && dR <= dB) {\n    startUv = vec2(1.0 + depth, targetUv.y + jit);\n  } else if (dT <= dB) {\n    startUv = vec2(targetUv.x + jit, -depth);\n  } else {\n    startUv = vec2(targetUv.x + jit, 1.0 + depth);\n  }\n  highp float ease = 1.0 - pow(1.0 - f, 3.0);\n  highp float swirlTotal = uSwirl * 2.0 * (0.8 + 0.4 * hashLane(id, 5u));\n  highp float swirlBlend = min(uSwirl, 1.0);\n  vec2 posUv = vortexPos(startUv, targetUv, asp, swirlTotal, swirlBlend, ease);\n  highp float f2 = min(f + 0.03, 1.0);\n  highp float ease2 = 1.0 - pow(1.0 - f2, 3.0);\n  vec2 vel = (vortexPos(startUv, targetUv, asp, swirlTotal, swirlBlend, ease2) - posUv) * asp;\n  highp float vlen = length(vel);\n  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);\n  highp float stretch = 1.0 + min(3.5, vlen * 40.0) * uIntensity;\n  highp float halfA = 0.5 * (1.0 / uGrid.y) * mix(1.2, 1.0, ease);\n  int vid = gl_VertexID;\n  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;\n  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;\n  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfA * vec2(stretch, 1.0);\n  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);\n  vec2 uvPos = posUv + rot / asp;\n  vQuad = vec2(qx, qy);\n  highp float fadeIn = smoothstep(0.0, 0.08, f);\n  vVal = blockV * (float(k) + 1.0) / 3.0 * (1.0 + 0.25 * uGlow * (1.0 - f)) * fadeIn;\n  gl_Position = vec4(uvPos * 2.0 - 1.0, 0.0, 1.0);\n}\n", W = "#version 300 es\nprecision highp float;\nin vec2 vQuad;\nflat in highp float vVal;\nout vec4 finalColor;\nvoid main() {\n  finalColor = vec4(vec3(vVal), 1.0);\n}\n";
//#endregion
//#region src/passes/vortexPass.ts
function Ve(e, t) {
	let n = P(e, B, ze), r = P(e, Be, W), i = e.createVertexArray();
	if (!i) throw Error("Failed to create VAO");
	let a = (t) => e.getUniformLocation(n, t), o = {
		field: a("uField"),
		progress: a("uProgress"),
		spread: a("uSpread"),
		flight: a("uFlight"),
		grid: a("uGrid"),
		glow: a("uGlow"),
		aspect: a("uAspect")
	}, s = (t) => e.getUniformLocation(r, t), c = {
		field: s("uField"),
		progress: s("uProgress"),
		spread: s("uSpread"),
		flight: s("uFlight"),
		grid: s("uGrid"),
		glow: s("uGlow"),
		intensity: s("uIntensity"),
		swirl: s("uSwirl"),
		aspect: s("uAspect")
	};
	return {
		render(a, s, l) {
			z(e, a), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.useProgram(n), e.uniform1i(o.field, 0), e.uniform1f(o.progress, l.progress), e.uniform1f(o.spread, l.spread), e.uniform1f(o.flight, l.flight), e.uniform2f(o.grid, l.gridX, l.gridY), e.uniform1f(o.glow, l.glow), e.uniform1f(o.aspect, l.aspect), t.draw(), l.progress < l.spread + l.flight && (e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(c.field, 0), e.uniform1f(c.progress, l.progress), e.uniform1f(c.spread, l.spread), e.uniform1f(c.flight, l.flight), e.uniform2f(c.grid, l.gridX, l.gridY), e.uniform1f(c.glow, l.glow), e.uniform1f(c.intensity, l.intensity), e.uniform1f(c.swirl, l.swirl), e.uniform1f(c.aspect, l.aspect), e.enable(e.BLEND), e.blendEquation(e.MAX), e.bindVertexArray(i), e.drawArraysInstanced(e.TRIANGLES, 0, 6, Math.max(1, Math.floor(l.count))), e.bindVertexArray(null), e.blendEquation(e.FUNC_ADD), e.disable(e.BLEND));
		},
		dispose() {
			e.deleteProgram(n), e.deleteProgram(r), e.deleteVertexArray(i);
		}
	};
}
//#endregion
//#region src/shaders/blackholeCore.frag.ts
var He = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform float uProgress;\nuniform float uForm;\nuniform float uSpread;\nuniform float uFlightMin;\nuniform float uFlightMax;\nuniform float uCollapse;\nuniform vec2 uGrid;\nuniform float uGlow;\nuniform float uSwirl;\nuniform float uArms;\nuniform float uLens;\nuniform float uHorizon;\nuniform float uAspect;\nout vec4 finalColor;\n\nhighp uint pcg(highp uint v) {\n  v = v * 747796405u + 2891336453u;\n  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;\n  return (s >> 22) ^ s;\n}\n\nhighp float hashLane(highp uint i, highp uint salt) {\n  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);\n}\n\nvoid main() {\n  highp float p = max(uProgress, 0.0);\n  if (p >= 1.0) {\n    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);\n    return;\n  }\n  vec2 asp = vec2(uAspect, 1.0);\n  highp float cornerR = length(asp) * 0.5;\n  vec2 q = (vUv - 0.5) * asp;\n  highp float r = length(q);\n  highp float ang = atan(q.y, q.x);\n\n  highp float formT = uForm > 1e-4 ? clamp(p / uForm, 0.0, 1.0) : 1.0;\n  highp float collapseT = uCollapse > 1e-4 ? clamp((p - (1.0 - uCollapse)) / uCollapse, 0.0, 1.0) : 0.0;\n\n  highp float s1 = formT - 1.0;\n  highp float grow = 1.0 + 2.70158 * s1 * s1 * s1 + 1.70158 * s1 * s1;\n  highp float shrink = pow(1.0 - collapseT, 1.7);\n  highp float paintT = clamp((p - uForm) / max(1.0 - uForm - uCollapse, 1e-4), 0.0, 1.0);\n  highp float decay = pow(1.0 - smoothstep(0.06, 1.0, paintT), 1.3);\n  highp float R = max(uHorizon * grow * shrink * decay, 0.0);\n\n  vec2 cid = floor(vUv * uGrid);\n  highp uint cellIndex = uint(cid.y * uGrid.x + cid.x);\n  vec2 cellCenter = (cid + 0.5) / uGrid;\n  vec2 cq = (cellCenter - 0.5) * asp;\n  highp float dn = length(cq) / cornerR;\n  highp float cang = atan(cq.y, cq.x);\n  highp float armW = 0.5 + 0.5 * sin(cang * uArms - dn * (5.0 + 3.0 * uSwirl));\n  highp float o = clamp(dn * 0.58 + armW * 0.34 + (hashLane(cellIndex, 1u) - 0.5) * 0.08 + 0.02, 0.0, 1.0);\n\n  highp float blockV = texture(uField, cellCenter).r;\n  highp float accFrac = 0.0;\n  highp float lastRaw = 0.0;\n  for (uint k = 0u; k < 3u; k++) {\n    highp float ok = o + float(k) * 0.04 + hashLane(cellIndex * 3u + k, 4u) * 0.02;\n    highp float fl = mix(uFlightMin, uFlightMax, hashLane(cellIndex * 3u + k, 6u));\n    highp float fr = (p - uForm - uSpread * ok) / max(fl, 1e-4);\n    accFrac += step(1.0, fr) / 3.0;\n    if (k == 2u) {\n      lastRaw = fr;\n    }\n  }\n  highp float refine = smoothstep(1.0, 1.18, lastRaw);\n  highp float flash = step(1.0, lastRaw) * (1.0 - smoothstep(1.0, 1.12, lastRaw));\n\n  highp float lensEnv = formT * formT;\n  highp float bendBase = pow(R / (r + R + 1e-5), 2.0);\n  highp float angLens = uLens * lensEnv * bendBase * 1.5;\n  highp float rPull = uLens * lensEnv * bendBase * r * 0.45;\n  highp float R2 = uHorizon * 2.5;\n  highp float twistEnv = (1.0 - smoothstep(1.0, 1.35, lastRaw)) * (1.0 - collapseT);\n  highp float angTwist = uSwirl * 1.4 * twistEnv * (R2 / (r + R2));\n  highp float A = ang + angLens + angTwist;\n  highp float rr = max(r - rPull, R * 0.9);\n  vec2 warpedUv = 0.5 + (vec2(cos(A), sin(A)) * rr) / asp;\n  highp float fullV = texture(uField, warpedUv).r;\n\n  highp float v = mix(blockV * accFrac, fullV, refine) * (1.0 + 0.35 * uGlow * flash);\n  v *= smoothstep(R * 0.98, R * 1.03, r);\n\n  highp float ringEnv = formT * formT * (1.0 - collapseT * collapseT);\n  highp float photon = exp(-pow((r - R * 1.06) / max(R * 0.045, 1e-4), 2.0));\n  highp float einstein = exp(-pow((r - R * 1.32) / max(R * 0.09, 1e-4), 2.0)) * 0.45;\n  highp float ringV = (photon + einstein) * uGlow * ringEnv * (0.94 + 0.06 * sin(ang * uArms * 2.0 + p * 70.0));\n\n  highp float diskR = (r - R * 1.45) / max(R * 1.15, 1e-4);\n  highp float diskBody = exp(-diskR * diskR) * smoothstep(R * 1.1, R * 1.3, r);\n  highp float bands = 0.4 + 0.6 * sin(r / max(R, 1e-4) * 13.0 - p * 70.0);\n  highp float turb = 0.6 + 0.4 * sin(ang * 9.0 - r / max(R, 1e-4) * 7.0 + p * 95.0);\n  highp float disk = uGlow * 0.75 * formT * (1.0 - collapseT) * diskBody * bands * bands * turb;\n\n  highp float redshift = smoothstep(R * 0.995, R * 1.06, r);\n  v = max(v, (ringV + disk) * redshift);\n  finalColor = vec4(vec3(v), 1.0);\n}\n", Ue = "#version 300 es\nprecision highp float;\nuniform sampler2D uField;\nuniform float uProgress;\nuniform float uForm;\nuniform float uSpread;\nuniform float uFlightMin;\nuniform float uFlightMax;\nuniform float uCollapse;\nuniform vec2 uGrid;\nuniform float uGlow;\nuniform float uSwirl;\nuniform float uArms;\nuniform float uHorizon;\nuniform float uIntensity;\nuniform float uAspect;\nuniform float uDiskCount;\nout vec2 vQuad;\nflat out highp float vVal;\nflat out highp float vSoft;\n\nhighp uint pcg(highp uint v) {\n  v = v * 747796405u + 2891336453u;\n  highp uint s = ((v >> ((v >> 28) + 4u)) ^ v) * 277803737u;\n  return (s >> 22) ^ s;\n}\n\nhighp float hashLane(highp uint i, highp uint salt) {\n  return float(pcg(i * 747796405u + salt)) * (1.0 / 4294967296.0);\n}\n\nvoid cull(out vec2 q, out highp float val, out highp float soft) {\n  q = vec2(0.0);\n  val = 0.0;\n  soft = 0.0;\n  gl_Position = vec4(0.0, 0.0, 2.0, 1.0);\n}\n\nvoid emitQuad(vec2 posUv, vec2 dirN, highp float halfA, highp float stretch, vec2 asp) {\n  int vid = gl_VertexID;\n  highp float qx = (vid == 1 || vid == 2 || vid == 4) ? 1.0 : 0.0;\n  highp float qy = (vid == 2 || vid == 4 || vid == 5) ? 1.0 : 0.0;\n  vec2 corner0 = (vec2(qx, qy) - 0.5) * 2.0 * halfA * vec2(stretch, 1.0);\n  vec2 rot = vec2(corner0.x * dirN.x - corner0.y * dirN.y, corner0.x * dirN.y + corner0.y * dirN.x);\n  vQuad = vec2(qx, qy);\n  gl_Position = vec4((posUv + rot / asp) * 2.0 - 1.0, 0.0, 1.0);\n}\n\nvoid main() {\n  highp uint id = uint(gl_InstanceID);\n  highp float p = max(uProgress, 0.0);\n  vec2 asp = vec2(uAspect, 1.0);\n  highp float cornerR = length(asp) * 0.5;\n\n  highp float formT = uForm > 1e-4 ? clamp(p / uForm, 0.0, 1.0) : 1.0;\n  highp float collapseT = uCollapse > 1e-4 ? clamp((p - (1.0 - uCollapse)) / uCollapse, 0.0, 1.0) : 0.0;\n  highp float s1 = formT - 1.0;\n  highp float grow = 1.0 + 2.70158 * s1 * s1 * s1 + 1.70158 * s1 * s1;\n  highp float shrink = pow(1.0 - collapseT, 1.7);\n  highp float paintT = clamp((p - uForm) / max(1.0 - uForm - uCollapse, 1e-4), 0.0, 1.0);\n  highp float decay = pow(1.0 - smoothstep(0.06, 1.0, paintT), 1.3);\n  highp float R = max(uHorizon * grow * shrink * decay, 0.0);\n\n  if (float(id) < uDiskCount) {\n    highp float h1 = hashLane(id, 11u);\n    highp float h2 = hashLane(id, 12u);\n    highp float h3 = hashLane(id, 13u);\n    highp float h5 = hashLane(id, 15u);\n    highp float rBase = R * (1.12 + 2.1 * h1 * h1);\n    highp float gap = 0.55 + 0.45 * sin(rBase / max(uHorizon, 1e-4) * 11.0);\n    highp float infall = smoothstep(0.0, 1.0, formT * formT);\n    highp float spiralIn = 1.0 - 0.12 * fract(h3 * 3.7 + p * 0.5);\n    highp float rOrb = mix(rBase * 3.2, rBase * spiralIn, infall);\n    highp float w = 76.0 / pow(max(rBase / max(uHorizon, 1e-4), 0.5), 1.5);\n    highp float angD = h2 * 6.2831853 + w * p;\n    highp float env = smoothstep(0.0, 0.6, formT) * pow(1.0 - collapseT, 1.5);\n    highp float bright = uGlow * (0.25 + 0.75 * h3) * env * gap;\n    if (bright < 0.01 || R < 1e-4) {\n      cull(vQuad, vVal, vSoft);\n      return;\n    }\n    vec2 dirN = vec2(-sin(angD), cos(angD));\n    vec2 posUv = 0.5 + (vec2(cos(angD), sin(angD)) * rOrb) / asp;\n    highp float halfA = (0.5 / uGrid.y) * (0.5 + 0.8 * h5) * (0.6 + 0.7 * h1);\n    emitQuad(posUv, dirN, halfA, 2.5 + 6.0 * h1 * (1.0 - h1 * 0.5), asp);\n    vVal = bright;\n    vSoft = 1.0;\n    return;\n  }\n\n  highp uint eid = id - uint(uDiskCount);\n  highp uint cellIndex = eid / 3u;\n  highp uint k = eid - cellIndex * 3u;\n  highp float gx = uGrid.x;\n  vec2 cell = vec2(mod(float(cellIndex), gx), floor(float(cellIndex) / gx));\n  vec2 targetUv = (cell + 0.5) / uGrid;\n  vec2 tq = (targetUv - 0.5) * asp;\n  highp float dn = length(tq) / cornerR;\n  highp float tang = atan(tq.y, tq.x);\n  highp float armW = 0.5 + 0.5 * sin(tang * uArms - dn * (5.0 + 3.0 * uSwirl));\n  highp float o = clamp(dn * 0.58 + armW * 0.34 + (hashLane(cellIndex, 1u) - 0.5) * 0.08 + 0.02, 0.0, 1.0);\n  highp float ok = o + float(k) * 0.04 + hashLane(eid, 4u) * 0.02;\n  highp float fl = max(mix(uFlightMin, uFlightMax, hashLane(eid, 6u)), 1e-4);\n  highp float f = (p - uForm - uSpread * ok) / fl;\n  highp float blockV = texture(uField, targetUv).r;\n  if (f <= 0.0 || f >= 1.0 || blockV < 0.02) {\n    cull(vQuad, vVal, vSoft);\n    return;\n  }\n  highp float rT = length(tq);\n  highp float rS = R * 1.05;\n  highp float swirlTotal = uSwirl * (5.8 + 2.6 * hashLane(eid, 5u));\n  highp float e = 1.0 - pow(1.0 - f, 3.0);\n  highp float A1 = tang + swirlTotal * (1.0 - e);\n  highp float r1 = mix(rS, rT, e);\n  vec2 posUv = 0.5 + (vec2(cos(A1), sin(A1)) * r1) / asp;\n  highp float f2 = min(f + 0.03, 1.0);\n  highp float e2 = 1.0 - pow(1.0 - f2, 3.0);\n  highp float A2 = tang + swirlTotal * (1.0 - e2);\n  highp float r2 = mix(rS, rT, e2);\n  vec2 vel = (0.5 + (vec2(cos(A2), sin(A2)) * r2) / asp - posUv) * asp;\n  highp float vlen = length(vel);\n  vec2 dirN = vlen > 1e-5 ? vel / vlen : vec2(1.0, 0.0);\n  highp float stretch = 1.0 + min(3.5, vlen * 40.0) * uIntensity;\n  highp float halfA = 0.5 * (1.0 / uGrid.y) * mix(1.2, 1.0, e);\n  emitQuad(posUv, dirN, halfA, stretch, asp);\n  highp float fadeIn = smoothstep(0.0, 0.08, f);\n  vVal = blockV * (float(k) + 1.0) / 3.0 * (1.0 + 0.25 * uGlow * (1.0 - f)) * fadeIn;\n  vSoft = 0.0;\n}\n", We = "#version 300 es\nprecision highp float;\nin vec2 vQuad;\nflat in highp float vVal;\nflat in highp float vSoft;\nout vec4 finalColor;\nvoid main() {\n  highp float sx = smoothstep(0.0, 0.3, vQuad.x) * smoothstep(1.0, 0.7, vQuad.x);\n  highp float sy = smoothstep(0.0, 0.3, vQuad.y) * smoothstep(1.0, 0.7, vQuad.y);\n  finalColor = vec4(vec3(vVal * mix(1.0, sx * sy, vSoft)), 1.0);\n}\n";
//#endregion
//#region src/passes/blackholePass.ts
function Ge(e, t) {
	let n = P(e, B, He), r = P(e, Ue, We), i = e.createVertexArray();
	if (!i) throw Error("Failed to create VAO");
	let a = (t) => e.getUniformLocation(n, t), o = {
		field: a("uField"),
		progress: a("uProgress"),
		form: a("uForm"),
		spread: a("uSpread"),
		flightMin: a("uFlightMin"),
		flightMax: a("uFlightMax"),
		collapse: a("uCollapse"),
		grid: a("uGrid"),
		glow: a("uGlow"),
		swirl: a("uSwirl"),
		arms: a("uArms"),
		lens: a("uLens"),
		horizon: a("uHorizon"),
		aspect: a("uAspect")
	}, s = (t) => e.getUniformLocation(r, t), c = {
		field: s("uField"),
		progress: s("uProgress"),
		form: s("uForm"),
		spread: s("uSpread"),
		flightMin: s("uFlightMin"),
		flightMax: s("uFlightMax"),
		collapse: s("uCollapse"),
		grid: s("uGrid"),
		glow: s("uGlow"),
		swirl: s("uSwirl"),
		arms: s("uArms"),
		horizon: s("uHorizon"),
		intensity: s("uIntensity"),
		aspect: s("uAspect"),
		diskCount: s("uDiskCount")
	};
	return {
		render(a, s, l) {
			z(e, a), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.useProgram(n), e.uniform1i(o.field, 0), e.uniform1f(o.progress, l.progress), e.uniform1f(o.form, l.form), e.uniform1f(o.spread, l.spread), e.uniform1f(o.flightMin, l.flightMin), e.uniform1f(o.flightMax, l.flightMax), e.uniform1f(o.collapse, l.collapse), e.uniform2f(o.grid, l.gridX, l.gridY), e.uniform1f(o.glow, l.glow), e.uniform1f(o.swirl, l.swirl), e.uniform1f(o.arms, l.arms), e.uniform1f(o.lens, l.lensing), e.uniform1f(o.horizon, l.horizon), e.uniform1f(o.aspect, l.aspect), t.draw(), l.progress < 1 && (e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(c.field, 0), e.uniform1f(c.progress, l.progress), e.uniform1f(c.form, l.form), e.uniform1f(c.spread, l.spread), e.uniform1f(c.flightMin, l.flightMin), e.uniform1f(c.flightMax, l.flightMax), e.uniform1f(c.collapse, l.collapse), e.uniform2f(c.grid, l.gridX, l.gridY), e.uniform1f(c.glow, l.glow), e.uniform1f(c.swirl, l.swirl), e.uniform1f(c.arms, l.arms), e.uniform1f(c.horizon, l.horizon), e.uniform1f(c.intensity, l.intensity), e.uniform1f(c.aspect, l.aspect), e.uniform1f(c.diskCount, l.diskCount), e.enable(e.BLEND), e.blendEquation(e.MAX), e.bindVertexArray(i), e.drawArraysInstanced(e.TRIANGLES, 0, 6, Math.max(1, Math.floor(l.count))), e.bindVertexArray(null), e.blendEquation(e.FUNC_ADD), e.disable(e.BLEND));
		},
		dispose() {
			e.deleteProgram(n), e.deleteProgram(r), e.deleteVertexArray(i);
		}
	};
}
//#endregion
//#region src/shaders/whirlpoolReveal.frag.ts
var G = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform float uProgress;\nuniform float uTurns;\nuniform float uTightness;\nuniform float uStreak;\nuniform float uGlow;\nuniform float uAspect;\nout vec4 finalColor;\n\nconst highp float TAU = 6.2831853;\nconst highp float ARMS = 4.0;\n/* Angular speed never drops to nothing at the rim, or the outer ring could not complete a\n   turn inside the animation and would have no moment to lock on. */\nconst highp float SPEED = 37.7;\n\nvec2 mirrorUv(vec2 uv) {\n  vec2 m = mod(uv, 2.0);\n  return mix(m, 2.0 - m, step(1.0, m));\n}\n\nhighp float sampleSwirl(highp float r, highp float ang, highp float theta, vec2 asp) {\n  highp float A = ang + theta;\n  return texture(uField, mirrorUv(0.5 + (vec2(cos(A), sin(A)) * r) / asp)).r;\n}\n\nhighp float envelopeWobble(highp float r, highp float ang) {\n  return 0.5 * sin(ang * 4.0 + r * 9.0) + 0.3 * sin(ang * 8.0 - r * 15.0 + 1.3);\n}\n\nvoid main() {\n  highp float p = clamp(uProgress, 0.0, 1.0);\n  highp float sharp = texture(uField, vUv).r;\n  if (p >= 1.0) {\n    finalColor = vec4(vec3(sharp), 1.0);\n    return;\n  }\n  vec2 asp = vec2(uAspect, 1.0);\n  vec2 q = (vUv - 0.5) * asp;\n  highp float r = length(q);\n  highp float ang = atan(q.y, q.x);\n  highp float maxR = length(asp) * 0.5;\n  highp float rn = clamp(r / max(maxR, 1e-4), 0.0, 1.0);\n  highp float falloff = uTightness / (r + uTightness);\n\n  /* Pure differential rotation: wound at the start, spinning faster toward the centre. */\n  highp float wound = uTurns * TAU * falloff;\n  highp float omega = SPEED * (0.35 + 0.65 * falloff);\n  highp float theta = wound + omega * p;\n\n  /* Eligibility spreads outward and along the arms; the lock still happens only on a whole\n     turn, so arms differ by exactly one revolution. */\n  highp float eligible = mix(0.22, 0.6, rn)\n    + (0.5 - 0.5 * cos(ang * ARMS + wound)) * 0.05\n    + envelopeWobble(r, ang) * 0.012;\n\n  /* A whole turn means the rotated sample lands back on this very texel: cover == image, so\n     locking it in is seamless. The reveal IS the rotation completing. */\n  highp float thetaAtEligible = wound + omega * eligible;\n  highp float arrival = eligible + mod(-thetaAtEligible, TAU) / omega;\n  highp float locked = smoothstep(arrival, arrival + 0.02, p);\n\n  /* Motion blur has to vanish as the lock approaches, otherwise the cover is smeared at the\n     exact moment it is supposed to match the image. */\n  highp float toLock = clamp((arrival - p) / 0.25, 0.0, 1.0);\n  highp float arc = omega * 0.016 * (0.5 + 3.5 * uStreak) * toLock;\n\n  highp float cover = 0.0;\n  for (int i = 0; i < 5; i++) {\n    cover += sampleSwirl(r, ang, theta + arc * ((float(i) - 2.0) / 2.0), asp) * 0.2;\n  }\n  cover *= smoothstep(0.0, 0.06, p);\n\n  highp float v = mix(cover, sharp, locked);\n  highp float rim = locked * (1.0 - locked) * 4.0;\n  v *= 1.0 + uGlow * 0.25 * rim * rim;\n  finalColor = vec4(vec3(v), 1.0);\n}\n";
//#endregion
//#region src/passes/whirlpoolPass.ts
function Ke(e, t) {
	let n = P(e, B, G), r = (t) => e.getUniformLocation(n, t), i = {
		field: r("uField"),
		progress: r("uProgress"),
		turns: r("uTurns"),
		tightness: r("uTightness"),
		streak: r("uStreak"),
		glow: r("uGlow"),
		aspect: r("uAspect")
	};
	return {
		render(r, a, o) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.field, 0), e.uniform1f(i.progress, o.progress), e.uniform1f(i.turns, o.turns), e.uniform1f(i.tightness, o.tightness), e.uniform1f(i.streak, o.streak), e.uniform1f(i.glow, o.glow), e.uniform1f(i.aspect, o.aspect), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/waterReveal.frag.ts
var qe = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform sampler2D uCover;\nuniform sampler2D uHeight;\nuniform vec2 uHeightTexel;\nuniform float uRefraction;\nuniform float uWhiteK;\nuniform float uGlow;\nuniform float uActive;\nuniform float uFade;\nout vec4 finalColor;\n\n// Water alpha compresses instead of clipping: crest/(crest+K) approaches 1 but\n// never reaches it, so a strong splat stays a gradient rather than flattening\n// into a solid white plateau. Must match the same curve in waterRevealAccum.\nfloat waterAlpha(float crest, float k) {\n  return crest / (crest + k);\n}\n\nvoid main() {\n  if (uActive < 0.5) {\n    finalColor = vec4(vec3(texture(uField, vUv).r), 1.0);\n    return;\n  }\n  float hL = texture(uHeight, vUv - vec2(uHeightTexel.x, 0.0)).r;\n  float hR = texture(uHeight, vUv + vec2(uHeightTexel.x, 0.0)).r;\n  float hT = texture(uHeight, vUv + vec2(0.0, uHeightTexel.y)).r;\n  float hB = texture(uHeight, vUv - vec2(0.0, uHeightTexel.y)).r;\n  vec2 grad = vec2(hR - hL, hT - hB);\n  vec2 uv = clamp(vUv - grad * uRefraction * 0.04 * uFade, 0.0, 1.0);\n  float v = texture(uField, uv).r;\n  float crest = max(texture(uHeight, vUv).r, 0.0);\n  v = clamp(v + waterAlpha(crest, uWhiteK) * uGlow * uFade, 0.0, 1.0);\n  float cover = mix(1.0, texture(uCover, vUv).r, uFade);\n  finalColor = vec4(vec3(v * cover), 1.0);\n}\n";
//#endregion
//#region src/passes/waterRevealPass.ts
function Je(e, t) {
	let n = P(e, B, qe), r = (t) => e.getUniformLocation(n, t), i = {
		field: r("uField"),
		cover: r("uCover"),
		height: r("uHeight"),
		heightTexel: r("uHeightTexel"),
		refraction: r("uRefraction"),
		whiteK: r("uWhiteK"),
		glow: r("uGlow"),
		active: r("uActive"),
		fade: r("uFade")
	};
	return {
		render(r, a, o, s) {
			if (z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.field, 0), !o) {
				e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.cover, 1), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.height, 2), e.uniform1f(i.active, 0), t.draw(), e.bindFramebuffer(e.FRAMEBUFFER, null);
				return;
			}
			e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, o.cover), e.uniform1i(i.cover, 1), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, o.height), e.uniform1i(i.height, 2), e.uniform2f(i.heightTexel, o.texelX, o.texelY), e.uniform1f(i.refraction, s.refraction), e.uniform1f(i.whiteK, s.whiteK), e.uniform1f(i.glow, s.glow), e.uniform1f(i.fade, s.fade), e.uniform1f(i.active, 1), t.draw(), e.bindFramebuffer(e.FRAMEBUFFER, null);
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/blur.frag.ts
var Ye = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uTex;\nuniform vec2 uStep;\nout vec4 finalColor;\n\nvoid main() {\n  float w0 = 0.22702703;\n  float w1 = 0.19459460;\n  float w2 = 0.12162162;\n  float w3 = 0.05405405;\n  float w4 = 0.01621622;\n  vec4 c =\n    texture(uTex, vUv + uStep * -4.0) * w4 +\n    texture(uTex, vUv + uStep * -3.0) * w3 +\n    texture(uTex, vUv + uStep * -2.0) * w2 +\n    texture(uTex, vUv + uStep * -1.0) * w1 +\n    texture(uTex, vUv              ) * w0 +\n    texture(uTex, vUv + uStep *  1.0) * w1 +\n    texture(uTex, vUv + uStep *  2.0) * w2 +\n    texture(uTex, vUv + uStep *  3.0) * w3 +\n    texture(uTex, vUv + uStep *  4.0) * w4;\n  finalColor = c;\n}\n";
//#endregion
//#region src/passes/blurPass.ts
function Xe(e, t) {
	let n = P(e, B, Ye), r = e.getUniformLocation(n, "uTex"), i = e.getUniformLocation(n, "uStep");
	function a(a, o, s, c) {
		z(e, o), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(r, 0), e.uniform2f(i, s, c), t.draw();
	}
	return {
		render(e, t, n, r, i) {
			let o = r / i.width / 4, s = r / i.height / 4;
			a(e, t, o, 0), a(t.texture, n, 0, s);
		},
		copy(e, t) {
			a(e, t, 0, 0);
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/stripeCell.glsl.ts
var Ze = "\nuniform sampler2D uCell;\nuniform sampler2D uLut;\nuniform sampler2D uOpacityLut;\nuniform sampler2D uCellColor;\nuniform vec2 uGridCount;\nuniform vec2 uCellPx;\nuniform float uCellMin;\nuniform float uCellMax;\nuniform float uTimeSec;\nuniform float uGapEnabled;\nuniform float uGapCoverage;\nuniform float uGapPeriodMin;\nuniform float uGapPeriodMax;\nuniform float uStripeSparkleEnabled;\nuniform float uStripeSparkleCoverage;\nuniform float uStripeSparkleMaxBrightness;\nuniform float uStripeSparkleSpeed;\nuniform float uStripeSparkleMinWidthPx;\nuniform float uStripeSparkleHueDriftDeg;\nuniform float uStripeSparkleSaturationBoost;\nuniform float uShuffleEnabled;\nuniform float uShuffleCoverage;\nuniform float uShufflePeriodMin;\nuniform float uShufflePeriodMax;\nuniform float uShuffleSwingPx;\nuniform float uMotionEnabled;\nuniform float uMotionAmplitudePx;\nuniform float uMotionStaggerPx;\nuniform float uMotionMaxOffsetPx;\nuniform float uMotionSpeed;\nuniform float uUseCellColors;\nuniform float uImageColorLightness;\nuniform float uImageColorDensity;\nuniform float uGradientEnabled;\nuniform float uGradientDirection;\nuniform float uGradientStopCount;\nuniform vec3 uGradientStop0;\nuniform vec3 uGradientStop1;\nuniform vec3 uGradientStop2;\nuniform vec3 uGradientStop3;\nuniform float uGradientHueDriftDeg;\nuniform float uGradientSaturationBoost;\n\nfloat sparkleHash(float px, float py) {\n  float p3x = fract(px * 0.1031);\n  float p3y = fract(py * 0.103);\n  float p3z = fract(px * 0.0973);\n  float dotVal = p3x * (p3y + 33.33) + p3y * (p3z + 33.33) + p3z * (p3x + 33.33);\n  p3x = fract(p3x + dotVal);\n  p3y = fract(p3y + dotVal);\n  p3z = fract(p3z + dotVal);\n  return fract((p3x + p3y) * p3z);\n}\n\nfloat phaseHash(float col, float row) {\n  return sparkleHash(col + 53.0, row + 71.0);\n}\n\nfloat periodHash(float col, float row) {\n  return sparkleHash(col + 89.0, row + 113.0);\n}\n\nfloat cellSeed(float col, float row) {\n  return sparkleHash(col + 17.0, row + 31.0);\n}\n\nfloat altHash(float col, float row, float pulseIndex) {\n  return sparkleHash(col + 53.0 + pulseIndex * 61.0, row + 71.0 + pulseIndex * 101.0);\n}\n\nstruct CellPulse {\n  float localTime;\n  float period;\n  float cycleIndex;\n};\n\nCellPulse cellPulse(float col, float row, float timeSec, float coverage, float periodMin, float periodMax) {\n  float periodSpan = periodMax - periodMin;\n  float period = periodMin + periodHash(col, row) * periodSpan;\n  float cyclePeriod = period / max(coverage, 0.001);\n  float phaseOffset = phaseHash(col, row) * cyclePeriod;\n  float scheduledTime = timeSec + phaseOffset;\n  float cycleIndex = floor(scheduledTime / cyclePeriod);\n  float localTime = scheduledTime - cycleIndex * cyclePeriod;\n  CellPulse p;\n  p.localTime = localTime;\n  p.period = period;\n  p.cycleIndex = cycleIndex;\n  return p;\n}\n\nbool isGapped(float col, float row) {\n  if (uGapCoverage <= 0.0) return false;\n  CellPulse p = cellPulse(col, row, uTimeSec, uGapCoverage, uGapPeriodMin, uGapPeriodMax);\n  return p.localTime < p.period;\n}\n\nfloat pulseEnvelope(float localT) {\n  if (localT < 0.0 || localT > 1.0) return 0.0;\n  float cosine = 0.5 - 0.5 * cos(2.0 * 3.141592653589793 * localT);\n  float c = clamp(cosine, 0.0, 1.0);\n  return c * c * (3.0 - 2.0 * c);\n}\n\nfloat shuffledWidth(float col, float row, float defaultWidth) {\n  if (defaultWidth <= 0.0) return defaultWidth;\n  if (cellSeed(col, row) >= uShuffleCoverage) return defaultWidth;\n  CellPulse p = cellPulse(col, row, uTimeSec, uShuffleCoverage, uShufflePeriodMin, uShufflePeriodMax);\n  if (p.localTime >= p.period) return defaultWidth;\n  float localT = p.localTime / p.period;\n  float h = altHash(col, row, p.cycleIndex);\n  float maxWidth = min(255.0, max(uCellPx.x, uCellPx.y));\n  float tw = clamp(defaultWidth + (h * 2.0 - 1.0) * max(uShuffleSwingPx, 0.0), 1.0, maxWidth);\n  float envelope = pulseEnvelope(localT);\n  return defaultWidth + (tw - defaultWidth) * envelope;\n}\n\nfloat randomColumnMotionTarget(float col, float cycleIndex) {\n  float patternSeed = uMotionStaggerPx * 0.61803398875;\n  return sparkleHash(col + patternSeed + 307.0, cycleIndex + patternSeed + 401.0) * 2.0 - 1.0;\n}\n\nfloat randomColumnMotionOffset(float col) {\n  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return 0.0;\n  float patternSeed = uMotionStaggerPx * 0.61803398875;\n  float columnRate = mix(0.65, 1.35, sparkleHash(col + patternSeed + 89.0, patternSeed + 113.0));\n  float columnPhase = sparkleHash(col + patternSeed + 179.0, patternSeed + 233.0) * 7.0;\n  float randomTime = uTimeSec * max(uMotionSpeed, 0.05) * columnRate + columnPhase;\n  float cycleIndex = floor(randomTime);\n  float cycleT = fract(randomTime);\n  float easedT = cycleT * cycleT * (3.0 - 2.0 * cycleT);\n  float wave = mix(\n    randomColumnMotionTarget(col, cycleIndex),\n    randomColumnMotionTarget(col, cycleIndex + 1.0),\n    easedT\n  );\n  float amplitude = min(max(uMotionAmplitudePx, 0.0), max(uMotionMaxOffsetPx, 0.0));\n  return wave * amplitude;\n}\n\nfloat colorLightness(vec3 c) {\n  float hi = max(max(c.r, c.g), c.b);\n  float lo = min(min(c.r, c.g), c.b);\n  return (hi + lo) * 0.5;\n}\n\nvec3 withLightness(vec3 base, float targetLightness) {\n  float currentLightness = colorLightness(base);\n  float target = clamp(targetLightness, 0.0, 1.0);\n  if (currentLightness < 0.0001 || currentLightness > 0.9999) return vec3(target);\n  if (target < currentLightness) {\n    return clamp(base * (target / currentLightness), 0.0, 1.0);\n  }\n  return clamp(1.0 - (1.0 - base) * ((1.0 - target) / (1.0 - currentLightness)), 0.0, 1.0);\n}\n\nvec3 rgbToHsl(vec3 c) {\n  float maxc = max(max(c.r, c.g), c.b);\n  float minc = min(min(c.r, c.g), c.b);\n  float l = (maxc + minc) * 0.5;\n  float h = 0.0;\n  float s = 0.0;\n  float d = maxc - minc;\n  if (d > 0.00001) {\n    s = l > 0.5 ? d / (2.0 - maxc - minc) : d / (maxc + minc);\n    if (maxc == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);\n    else if (maxc == c.g) h = (c.b - c.r) / d + 2.0;\n    else h = (c.r - c.g) / d + 4.0;\n    h /= 6.0;\n  }\n  return vec3(h, s, l);\n}\n\nfloat hueToRgb(float p, float q, float t) {\n  if (t < 0.0) t += 1.0;\n  if (t > 1.0) t -= 1.0;\n  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;\n  if (t < 1.0 / 2.0) return q;\n  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;\n  return p;\n}\n\nvec3 hslToRgb(vec3 hsl) {\n  float h = fract(hsl.x);\n  float s = clamp(hsl.y, 0.0, 1.0);\n  float l = clamp(hsl.z, 0.0, 1.0);\n  if (s <= 0.00001) return vec3(l);\n  float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;\n  float p = 2.0 * l - q;\n  return vec3(\n    hueToRgb(p, q, h + 1.0 / 3.0),\n    hueToRgb(p, q, h),\n    hueToRgb(p, q, h - 1.0 / 3.0)\n  );\n}\n\nvec3 applyStripeSparkleTone(vec3 color, float amount) {\n  vec3 hsl = rgbToHsl(color);\n  if (hsl.y <= 0.0001) return color;\n  hsl.y = clamp(hsl.y * (1.0 + clamp(uStripeSparkleSaturationBoost, 0.0, 1.0) * amount), 0.0, 1.0);\n  return hslToRgb(hsl);\n}\n\nfloat stripeSparkleAmount(float col, float row) {\n  if (uStripeSparkleEnabled <= 0.5) return 0.0;\n  float coverage = clamp(uStripeSparkleCoverage, 0.0, 1.0);\n  if (coverage <= 0.0) return 0.0;\n  if (cellSeed(col, row) >= coverage) return 0.0;\n  float speed = max(uStripeSparkleSpeed, 0.05);\n  float periodMin = 0.18 / speed;\n  float periodMax = 0.85 / speed;\n  CellPulse p = cellPulse(col + 179.0, row + 233.0, uTimeSec, coverage, periodMin, periodMax);\n  if (p.localTime >= p.period) return 0.0;\n  return pulseEnvelope(p.localTime / p.period) * clamp(uStripeSparkleMaxBrightness, 0.0, 1.0);\n}\n\nvec3 applyStripeSparkle(vec3 color, vec2 cell, float widthPx, float opacity) {\n  if (uStripeSparkleEnabled <= 0.5) return color;\n  if (widthPx < uStripeSparkleMinWidthPx || opacity <= 0.001) return color;\n  float amount = stripeSparkleAmount(cell.x, cell.y);\n  vec3 brightened = withLightness(color, colorLightness(color) + amount);\n  return applyStripeSparkleTone(brightened, amount);\n}\n\nfloat gradientPosition(vec2 uv, float direction) {\n  float t = 1.0 - uv.y;\n  if (direction > 0.5 && direction < 1.5) t = uv.x;\n  else if (direction > 1.5 && direction < 2.5) t = 1.0 - uv.x;\n  else if (direction > 2.5) t = uv.y;\n  return clamp(t, 0.0, 1.0);\n}\n\nvec3 gradientRamp(vec2 uv, float direction, float stopCount, vec3 stop0, vec3 stop1, vec3 stop2, vec3 stop3) {\n  float t = gradientPosition(uv, direction);\n\n  if (stopCount < 2.5) {\n    return mix(stop0, stop1, t);\n  }\n  if (stopCount < 3.5) {\n    if (t < 0.5) return mix(stop0, stop1, t / 0.5);\n    return mix(stop1, stop2, (t - 0.5) / 0.5);\n  }\n  if (t < 0.3333333) return mix(stop0, stop1, t / 0.3333333);\n  if (t < 0.6666667) return mix(stop1, stop2, (t - 0.3333333) / 0.3333334);\n  return mix(stop2, stop3, (t - 0.6666667) / 0.3333333);\n}\n\nvec3 gradientColor(vec2 uv) {\n  return gradientRamp(uv, uGradientDirection, uGradientStopCount, uGradientStop0, uGradientStop1, uGradientStop2, uGradientStop3);\n}\n\nvec3 gradientAverageColor() {\n  if (uGradientStopCount < 2.5) return (uGradientStop0 + uGradientStop1) * 0.5;\n  if (uGradientStopCount < 3.5) return (uGradientStop0 + uGradientStop1 + uGradientStop2) / 3.0;\n  return (uGradientStop0 + uGradientStop1 + uGradientStop2 + uGradientStop3) * 0.25;\n}\n\nvec3 gradientColorWithRampLightness(vec2 uv, vec3 rampColor, float rampT) {\n  vec3 localColor = gradientColor(uv);\n  vec3 hsl = rgbToHsl(localColor);\n  float t = clamp(rampT, 0.0, 1.0);\n  if (hsl.y > 0.0001) {\n    hsl.x = fract(hsl.x + (uGradientHueDriftDeg * t) / 360.0);\n    float satLift = clamp(uGradientSaturationBoost, 0.0, 1.0) * sin(t * 3.141592653589793 * 0.85);\n    hsl.y = clamp(hsl.y * (1.0 + satLift), 0.0, 1.0);\n    localColor = hslToRgb(hsl);\n  }\n  float baseLightness = colorLightness(gradientAverageColor());\n  float lightnessLift = max(0.0, colorLightness(rampColor) - baseLightness);\n  return withLightness(localColor, colorLightness(localColor) + lightnessLift);\n}\n\nvec3 applyImageColorLightness(vec3 color) {\n  float amount = clamp(uImageColorLightness, -1.0, 1.0);\n  return amount >= 0.0 ? mix(color, vec3(1.0), amount) : mix(color, vec3(0.0), -amount);\n}\n\nvec3 cellImageColor(vec2 uv) {\n  vec2 colorCell = clamp(floor(uv * uGridCount), vec2(0.0), max(vec2(0.0), uGridCount - 1.0));\n  vec2 colorUv = (colorCell + 0.5) / uGridCount;\n  vec3 color = texture(uCellColor, colorUv).rgb;\n  return applyImageColorLightness(color);\n}\n\nbool imageColorDensityVisible(vec2 cell) {\n  float density = clamp(uImageColorDensity, 0.0, 1.0);\n  if (density >= 0.999) return true;\n  if (density <= 0.001) return false;\n  float col = clamp(floor(cell.x), 0.0, max(0.0, uGridCount.x - 1.0));\n  float row = clamp(floor(cell.y), 0.0, max(0.0, uGridCount.y - 1.0));\n  float chunk = floor(row / 20.0);\n  float localRow = row - chunk * 20.0;\n  float splitRow = 5.0 + floor(sparkleHash(col + 421.0, chunk + 17.0) * 11.0);\n  float side = localRow < splitRow ? 0.0 : 1.0;\n  float cluster = col * 4096.0 + chunk * 2.0 + side;\n  return sparkleHash(cluster + 197.0, 313.0) <= density;\n}\n\nfloat normalizedCellValue(vec2 uv) {\n  float raw = texture(uCell, uv).r;\n  return clamp((raw - uCellMin) / max(0.0001, uCellMax - uCellMin), 0.0, 1.0);\n}\n\n/**\n * Per-cell stripe state, before the width shuffle. A negative `widthPx` means\n * the cell is already hidden (gap pulse, or an image colour cell thinned out by\n * density); `shuffledWidth` passes it through untouched, so callers need one\n * `< 0.5` test to cover both that and a sub-pixel stripe.\n */\nstruct CellData {\n  vec3 color;\n  float widthPx;\n  float opacity;\n  float rampT;\n  float dotEligible;\n};\n\nCellData cellData(vec2 cell) {\n  vec2 sourceCell = clamp(cell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));\n  vec2 sourceUv = (sourceCell + 0.5) / uGridCount;\n  float v = normalizedCellValue(sourceUv);\n  vec2 lutUv = vec2((v * 255.0 + 0.5) / 256.0, 0.5);\n  vec4 lut = texture(uLut, lutUv);\n  vec4 opacityMeta = texture(uOpacityLut, lutUv);\n\n  CellData d;\n  d.color = lut.rgb;\n  d.widthPx = (lut.a * 255.0) * 0.5;\n  d.opacity = opacityMeta.r;\n  d.rampT = opacityMeta.g;\n  d.dotEligible = opacityMeta.b;\n\n  if (uUseCellColors > 0.5) {\n    d.color = cellImageColor(sourceUv);\n  }\n  if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {\n    d.color = gradientColorWithRampLightness(sourceUv, d.color, d.rampT);\n  }\n  d.color = applyStripeSparkle(d.color, sourceCell, d.widthPx, d.opacity);\n\n  bool hidden = false;\n  if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(cell.x, cell.y)) hidden = true;\n  if (uUseCellColors > 0.5 && !imageColorDensityVisible(sourceCell)) hidden = true;\n  if (hidden) d.widthPx = -1.0;\n  return d;\n}\n", Qe = `#version 300 es
precision highp float;
in vec2 vUv;
${Ze}
${Ee}
uniform sampler2D uCellDataA;
uniform sampler2D uCellDataB;
uniform float uUseCellData;
uniform vec2 uGridGapPx;
uniform float uCorner;
uniform float uOrient;
uniform float uAngleDeg;
uniform float uRotationMode;
uniform vec3 uBg;
uniform float uBgAlpha;
uniform float uTransparent;
uniform float uBgGradientEnabled;
uniform float uBgGradientDirection;
uniform float uBgGradientStopCount;
uniform vec3 uBgGradientStop0;
uniform vec3 uBgGradientStop1;
uniform vec3 uBgGradientStop2;
uniform vec3 uBgGradientStop3;
uniform float uBgGridEnabled;
uniform vec2 uBgGridCellPx;
uniform vec2 uBgGridGapPx;
uniform float uBgGridCorner;
uniform vec3 uBgGridColor;
uniform float uBgGridOpacity;
uniform vec2 uDisplayPx;
uniform float uDpr;
uniform float uStripeDotsEnabled;
uniform float uStripeDotsSizePx;
uniform float uStripeDotsRandomVisibility;
uniform float uStripeDotsBrightness;
uniform float uStripeDotsHueDriftDeg;
uniform float uStripeDotsSaturationBoost;
uniform float uStripeBorderEnabled;
uniform float uStripeBorderMinWidthPx;
uniform float uStripeBorderDensity;
uniform float uGridLinesEnabled;
uniform float uGridLinesBrightness;
uniform float uGridLinesDensity;
uniform float uLettersEnabled;
uniform sampler2D uGlyphData;
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;
uniform float uLetterSizeScale;
uniform float uOverlapAmount;
uniform float uStreamGapWaveEnabled;
uniform float uStreamGapWaveSqueeze;
uniform float uStreamGapWaveWavelengthCells;
uniform float uStreamGapWaveSpeed;
uniform float uStreamGapWavePhaseDeg;
uniform vec3 uLetterColor;
uniform float uBlendMode;
out vec4 finalColor;

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

float streamGapWaveOffset(float stackIndex, float stackCellPx) {
  if (uStreamGapWaveEnabled <= 0.5 || uStreamGapWaveSqueeze <= 0.0) return 0.0;
  float tau = 6.283185307179586;
  float stepPhase = tau / max(uStreamGapWaveWavelengthCells, 2.0);
  float denominator = max(2.0 * sin(stepPhase * 0.5), 0.001);
  float amplitude = clamp(uStreamGapWaveSqueeze, 0.0, 1.0) * stackCellPx / denominator;
  float timePhase = uTimeSec * uStreamGapWaveSpeed * tau + radians(uStreamGapWavePhaseDeg);
  return sin(stackIndex * stepPhase + timePhase) * amplitude;
}

struct MotionCell {
  vec2 cell;
  vec2 local;
};

/**
 * Every row of a column shifts by the same offset, so the shifted grid is a
 * pure translation: the covering row is \`floor((yPx - offset) / cellPx.y)\`
 * clamped into the grid. The three candidates around it keep the original
 * scan's exact scoring and tie-break while dropping the rest of the sweep —
 * rows further out always score above 100 (they miss the cell outright).
 */
MotionCell resolveMotionCell(vec2 cellF, float offset) {
  MotionCell result;
  result.cell = floor(cellF);
  result.local = fract(cellF);
  if (uMotionEnabled <= 0.5 || uMotionAmplitudePx <= 0.0 || uMotionMaxOffsetPx <= 0.0) return result;

  float yPx = cellF.y * uCellPx.y;
  float maxRow = max(0.0, uGridCount.y - 1.0);
  float coveringRow = floor((yPx - offset) / uCellPx.y);
  float bestScore = 100000.0;
  vec2 bestCell = result.cell;
  vec2 bestLocal = result.local;

  for (int i = -1; i <= 1; i++) {
    float row = clamp(coveringRow + float(i), 0.0, maxRow);
    float localY = (yPx - (row * uCellPx.y + offset)) / uCellPx.y;
    float outside = max(max(-localY, localY - 1.0), 0.0);
    float centerDist = abs(localY - 0.5);
    float score = outside * 100.0 + centerDist;
    if (score < bestScore) {
      bestScore = score;
      bestCell = vec2(result.cell.x, row);
      bestLocal = vec2(result.local.x, clamp(localY, 0.0, 1.0));
    }
  }

  result.cell = bestCell;
  result.local = bestLocal;
  return result;
}

float stripeAlpha(vec2 p, vec2 halfExt, float r, float w) {
  float d = sdRoundBox(p, halfExt, r);
  return clamp(0.5 - d / w, 0.0, 1.0);
}

vec3 backgroundGradientColor(vec2 uv) {
  return gradientRamp(
    uv,
    uBgGradientDirection,
    uBgGradientStopCount,
    uBgGradientStop0,
    uBgGradientStop1,
    uBgGradientStop2,
    uBgGradientStop3
  );
}

vec4 backgroundColor(vec2 uv) {
  if (uTransparent > 0.5) return vec4(0.0);
  vec3 bgRgb = uBgGradientEnabled > 0.5 ? backgroundGradientColor(uv) : uBg;
  vec4 bg = vec4(bgRgb, clamp(uBgAlpha, 0.0, 1.0));
  vec2 displayPx = max(vec2(1.0), uDisplayPx);
  vec2 pixel = uv * displayPx;
  float w = max(1.0 / uDpr, 1e-4);

  if (uBgGridEnabled > 0.5 && uBgGridOpacity > 0.0) {
    vec2 cellPx = max(vec2(1.0), uBgGridCellPx);
    vec2 local = fract(pixel / cellPx);
    vec2 drawablePx = max(vec2(0.0001), cellPx - clamp(uBgGridGapPx, vec2(0.0), cellPx));
    vec2 p = (local - 0.5) * cellPx;
    vec2 halfSize = drawablePx * 0.5;
    float r = min(uBgGridCorner, min(halfSize.x, halfSize.y));
    float d = sdRoundBox(p, halfSize, r);
    float alpha = clamp(0.5 - d / w, 0.0, 1.0) * clamp(uBgGridOpacity, 0.0, 1.0);
    bg = mix(bg, vec4(uBgGridColor, 1.0), alpha);
  }

  return bg;
}

vec3 blendStripeColor(vec3 base, vec3 source) {
  if (uBlendMode < 0.5) return source;
  if (uBlendMode < 1.5) return base * source;
  if (uBlendMode < 2.5) return 1.0 - (1.0 - base) * (1.0 - source);
  if (uBlendMode < 3.5) {
    return mix(
      2.0 * base * source,
      1.0 - 2.0 * (1.0 - base) * (1.0 - source),
      step(vec3(0.5), base)
    );
  }
  if (uBlendMode < 4.5) return min(base, source);
  if (uBlendMode < 5.5) return max(base, source);
  if (uBlendMode < 6.5) return abs(base - source);
  return base + source - 2.0 * base * source;
}

float stripeDotAlpha(
  vec2 centeredP,
  vec2 stripeCell,
  float eligible,
  float widthPx,
  float opacity,
  float aaWidth
) {
  if (uStripeDotsEnabled <= 0.5 || eligible < 0.5 || widthPx < 2.0 || opacity <= 0.001) return 0.0;
  float visibility = clamp(uStripeDotsRandomVisibility, 0.0, 1.0);
  if (sparkleHash(stripeCell.x + 137.0, stripeCell.y + 174.0) >= visibility) return 0.0;
  float radius = clamp(uStripeDotsSizePx, 1.0, 2.0) * 0.5;
  return clamp(0.5 - (length(centeredP) - radius) / aaWidth, 0.0, 1.0);
}

vec3 stripeBrightnessColor(vec3 stripeColor, float brightness) {
  float lightnessLift = clamp(brightness, 0.0, 1.0);
  if (lightnessLift <= 0.0001) return stripeColor;
  vec3 stripeHsl = rgbToHsl(stripeColor);
  stripeHsl.z = clamp(stripeHsl.z + lightnessLift, 0.0, 1.0);
  return hslToRgb(stripeHsl);
}

vec3 stripeDotColor(vec3 stripeColor, float rampT) {
  vec3 hsl = rgbToHsl(stripeColor);
  hsl.z = clamp(hsl.z + clamp(uStripeDotsBrightness, 0.0, 1.0), 0.0, 1.0);
  if (hsl.y <= 0.0001) return vec3(hsl.z);
  float t = clamp(rampT, 0.0, 1.0);
  hsl.x = fract(hsl.x + (uStripeDotsHueDriftDeg * t) / 360.0);
  float satLift = clamp(uStripeDotsSaturationBoost, 0.0, 1.0) * sin(t * 3.141592653589793 * 0.85);
  hsl.y = clamp(hsl.y * (1.0 + satLift), 0.0, 1.0);
  return hslToRgb(hsl);
}

vec3 dottedStripeColor(vec3 stripeColor, float rampT, float dotAlpha) {
  if (dotAlpha <= 0.0) return stripeColor;
  return mix(stripeColor, stripeDotColor(stripeColor, rampT), dotAlpha);
}

float stripeShapeAlpha(
  vec2 centeredP,
  vec2 halfExt,
  vec2 borderHalfExt,
  float cornerRadius,
  float geometryAlpha,
  float widthPx,
  float aaWidth,
  vec2 stripeCell
) {
  if (uStripeBorderEnabled <= 0.5 || widthPx < uStripeBorderMinWidthPx) return geometryAlpha;
  float density = clamp(uStripeBorderDensity, 0.0, 1.0);
  if (density <= 0.001 || (density < 0.999 && cellSeed(stripeCell.x, stripeCell.y) > density)) {
    return geometryAlpha;
  }
  float inset = 1.0;
  vec2 outerHalfExt = min(halfExt, borderHalfExt);
  float outerRadius = min(cornerRadius, min(outerHalfExt.x, outerHalfExt.y));
  float outerAlpha = stripeAlpha(centeredP, outerHalfExt, outerRadius, aaWidth);
  vec2 innerHalfExt = max(outerHalfExt - vec2(inset), vec2(0.0));
  float innerRadius = max(0.0, outerRadius - inset);
  float innerAlpha = stripeAlpha(centeredP, innerHalfExt, innerRadius, aaWidth);
  return max(0.0, outerAlpha - innerAlpha);
}

bool gridLineCellVisible(vec2 cell, float density, bool allowOutsideGrid) {
  if (!allowOutsideGrid && (any(lessThan(cell, vec2(0.0))) || any(greaterThanEqual(cell, uGridCount)))) return false;
  return density >= 0.999 || cellSeed(cell.x + 211.0, cell.y + 307.0) <= density;
}

float gridLineAlpha(vec2 rawCellF, float aaWidth, bool allowOutsideGrid) {
  if (uGridLinesEnabled <= 0.5) return 0.0;
  float density = clamp(uGridLinesDensity, 0.0, 1.0);
  if (density <= 0.001) return 0.0;

  vec2 rawCell = floor(rawCellF);
  vec2 rawLocal = fract(rawCellF);
  vec2 edgeDistancePx = min(rawLocal, 1.0 - rawLocal) * uCellPx;
  float verticalAlpha = clamp(0.5 - (edgeDistancePx.x - 0.5) / aaWidth, 0.0, 1.0);
  float horizontalAlpha = clamp(0.5 - (edgeDistancePx.y - 0.5) / aaWidth, 0.0, 1.0);
  bool currentVisible = gridLineCellVisible(rawCell, density, allowOutsideGrid);
  float xSide = rawLocal.x < 0.5 ? -1.0 : 1.0;
  float ySide = rawLocal.y < 0.5 ? -1.0 : 1.0;
  vec2 verticalNeighbor = rawCell + vec2(xSide, 0.0);
  vec2 horizontalNeighbor = rawCell + vec2(0.0, ySide);
  vec2 diagonalNeighbor = rawCell + vec2(xSide, ySide);
  bool verticalCellVisible = currentVisible || gridLineCellVisible(verticalNeighbor, density, allowOutsideGrid);
  bool horizontalCellVisible = currentVisible || gridLineCellVisible(horizontalNeighbor, density, allowOutsideGrid);
  bool cornerCellVisible =
    verticalCellVisible ||
    horizontalCellVisible ||
    gridLineCellVisible(diagonalNeighbor, density, allowOutsideGrid);
  float verticalVisible = verticalCellVisible ? 1.0 : 0.0;
  float horizontalVisible = horizontalCellVisible ? 1.0 : 0.0;
  float squareCornerAlpha = cornerCellVisible ? min(verticalAlpha, horizontalAlpha) : 0.0;
  verticalAlpha *= verticalVisible;
  horizontalAlpha *= horizontalVisible;
  return max(max(verticalAlpha, horizontalAlpha), squareCornerAlpha);
}

CellData fetchCellData(vec2 cell) {
  ivec2 texel = ivec2(cell);
  vec4 packedA = texelFetch(uCellDataA, texel, 0);
  vec4 packedB = texelFetch(uCellDataB, texel, 0);
  CellData d;
  d.color = packedA.rgb;
  d.widthPx = packedA.a;
  d.opacity = packedB.r;
  d.rampT = packedB.g;
  d.dotEligible = packedB.b;
  return d;
}

void main() {
  vec4 bgColor = backgroundColor(vUv);
  float angleRad = radians(uAngleDeg);
  vec2 renderUv = vUv;

  vec2 cellF = renderUv * uGridCount;
  float motionOffset = 0.0;
  if (uMotionEnabled > 0.5 && uMotionAmplitudePx > 0.0 && uMotionMaxOffsetPx > 0.0) {
    motionOffset = uUseCellData > 0.5
      ? texelFetch(uCellDataB, ivec2(int(floor(cellF.x)), 0), 0).a
      : randomColumnMotionOffset(floor(cellF.x));
  }
  MotionCell motionCell = resolveMotionCell(cellF, motionOffset);
  vec2 cell = motionCell.cell;
  vec2 local = motionCell.local;
  vec2 sourceCell = clamp(cell, vec2(0.0), max(vec2(0.0), uGridCount - 1.0));
  CellData cellState;
  if (uUseCellData > 0.5) cellState = fetchCellData(sourceCell);
  else cellState = cellData(cell);
  vec3 barColor = cellState.color;
  float barOpacity = cellState.opacity;
  float barRampT = cellState.rampT;
  float barDotEligible = cellState.dotEligible;
  float barWidthPx = cellState.widthPx;
  if (uShuffleEnabled > 0.5) barWidthPx = shuffledWidth(cell.x, cell.y, barWidthPx);
  bool cellHidden = barWidthPx < 0.5;
  barWidthPx = max(barWidthPx, 0.0);

  float earlyAngleNorm = mod(abs(uAngleDeg), 180.0);
  bool willUseNeighborRotation = abs(earlyAngleNorm) > 0.001 && abs(earlyAngleNorm - 90.0) > 0.001;
  bool baseStripeVisible = willUseNeighborRotation || !cellHidden;

  vec2 drawablePx = max(vec2(0.0001), uCellPx - clamp(uGridGapPx, vec2(0.0), uCellPx));
  vec2 p = (local - 0.5) * uCellPx;
  float w = max(1.0 / uDpr, 1e-4);
  float cellAngleRad = angleRad;
  vec2 axis = vec2(sin(cellAngleRad), cos(cellAngleRad));
  vec2 normal = vec2(cos(cellAngleRad), -sin(cellAngleRad));
  float angleNorm = mod(abs(uAngleDeg), 180.0);
  bool arbitraryAngle = abs(angleNorm) > 0.001 && abs(angleNorm - 90.0) > 0.001;
  bool overlapRotation = uRotationMode > 1.5;
  float overlapAmount = overlapRotation ? clamp(uOverlapAmount, 0.0, 4.0) : 1.0;
  float extendY = (uGridGapPx.y <= 0.0001) ? w : 0.0;
  float extendX = (uGridGapPx.x <= 0.0001) ? w : 0.0;
  float noGapExtend = max(extendX, extendY);
  vec2 gridLineCellF = cellF;
  if (arbitraryAngle) {
    vec2 displayPx = max(vec2(1.0), uDisplayPx);
    vec2 centeredPixel = vUv * displayPx - displayPx * 0.5;
    float normalCoord = dot(centeredPixel, normal);
    float axisCoord = dot(centeredPixel, axis);
    if (uOrient > 0.5) {
      gridLineCellF = vec2(
        (axisCoord + displayPx.x * 0.5) / max(uCellPx.x, 0.0001),
        (normalCoord + displayPx.y * 0.5) / max(uCellPx.y, 0.0001)
      );
    } else {
      gridLineCellF = vec2(
        (normalCoord + displayPx.x * 0.5) / max(uCellPx.x, 0.0001),
        (axisCoord + displayPx.y * 0.5) / max(uCellPx.y, 0.0001)
      );
    }
  }

  if (arbitraryAngle) {
    vec2 displayPx = max(vec2(1.0), uDisplayPx);
    vec2 pixel = vUv * displayPx;
    vec2 displayCenter = displayPx * 0.5;
    vec2 centeredPixel = pixel - displayCenter;
    bool horizontalStacks = uOrient > 0.5;
    float stackCellPx = max(0.0001, horizontalStacks ? uCellPx.y : uCellPx.x);
    float axisCellPx = max(0.0001, horizontalStacks ? uCellPx.x : uCellPx.y);
    float stackGapPx = max(0.0, horizontalStacks ? uGridGapPx.y : uGridGapPx.x);
    float axisGapPx = max(0.0, horizontalStacks ? uGridGapPx.x : uGridGapPx.y);
    float stackSpanPx = max(1.0, horizontalStacks ? displayPx.y : displayPx.x);
    float axisSpanPx = max(1.0, horizontalStacks ? displayPx.x : displayPx.y);
    float stackCoord = dot(centeredPixel, normal) + stackSpanPx * 0.5;
    float axisCoord = dot(centeredPixel, axis) + axisSpanPx * 0.5;
    float baseStack = floor(stackCoord / stackCellPx);
    float baseAxis = floor(axisCoord / axisCellPx);
    float drawableStackPx = max(0.0001, stackCellPx - min(stackGapPx, stackCellPx));
    float drawableAxisPx = max(0.0001, axisCellPx - min(axisGapPx, axisCellPx));
    float groupNoGapExtend = axisGapPx <= 0.0001 ? w : 0.0;
    float motionReach = uMotionEnabled > 0.5
      ? min(max(uMotionAmplitudePx, 0.0), max(uMotionMaxOffsetPx, 0.0))
      : 0.0;
    float maxNormalReach = drawableStackPx * 0.5 + abs(normal.y) * motionReach + w;
    float maxAxisReach =
      drawableAxisPx * 0.5 +
      drawableStackPx * 0.5 * overlapAmount +
      abs(axis.y) * motionReach +
      groupNoGapExtend +
      w * 2.0;
    float bestAlpha = 0.0;
    vec3 bestColor = barColor;
    float bestDepth = -1.0;
    vec4 overlapColor = bgColor;

    float gapWaveStep = 6.283185307179586 / max(uStreamGapWaveWavelengthCells, 2.0);
    float gapWaveAmplitude = uStreamGapWaveEnabled > 0.5
      ? clamp(uStreamGapWaveSqueeze, 0.0, 1.0) * stackCellPx / max(2.0 * sin(gapWaveStep * 0.5), 0.001)
      : 0.0;
    float stackSearch = max(
      uStreamGapWaveEnabled > 0.5 ? ceil(gapWaveAmplitude / stackCellPx) + 2.0 : 1.0,
      ceil(abs(normal.y) * motionReach / stackCellPx) + 2.0
    );
    float axisSearch = ceil(abs(axis.y) * motionReach / axisCellPx) + 2.0;
    int stackSpan = int(min(stackSearch, 20.0));
    int axisSpan = int(min(axisSearch, 20.0));
    for (int ss = -stackSpan; ss <= stackSpan; ss++) {
      float stackIndex = baseStack + float(ss);
      float stackCenter = (stackIndex + 0.5) * stackCellPx + streamGapWaveOffset(stackIndex, stackCellPx);

      for (int aa = -axisSpan; aa <= axisSpan; aa++) {
        float axisIndex = baseAxis + float(aa);
        float axisCenter = (axisIndex + 0.5) * axisCellPx;
        float normalDist = stackCoord - stackCenter;
        float axisDist = axisCoord - axisCenter;
        if (abs(normalDist) > maxNormalReach) continue;
        if (abs(axisDist) > maxAxisReach) continue;

        vec2 candidateCell = horizontalStacks ? vec2(axisIndex, stackIndex) : vec2(stackIndex, axisIndex);
        vec2 candidateBaseCenterPixel =
          displayCenter +
          normal * (stackCenter - stackSpanPx * 0.5) +
          axis * (axisCenter - axisSpanPx * 0.5);
        vec2 candidateUv = clamp(candidateBaseCenterPixel / displayPx, vec2(0.0), vec2(1.0));

        float candidateValue = normalizedCellValue(candidateUv);
        vec2 candidateLutUv = vec2((candidateValue * 255.0 + 0.5) / 256.0, 0.5);
        vec4 candidateLut = texture(uLut, candidateLutUv);
        float candidateWidthPx = (candidateLut.a * 255.0) * 0.5;

        if (uShuffleEnabled > 0.5) candidateWidthPx = shuffledWidth(candidateCell.x, candidateCell.y, candidateWidthPx);
        if (uUseCellColors > 0.5 && !imageColorDensityVisible(candidateCell)) continue;
        if (candidateWidthPx < 0.5) continue;
        if (uGapEnabled > 0.5 && uGapCoverage > 0.0 && isGapped(candidateCell.x, candidateCell.y)) continue;

        vec2 candidateCenterPixel = candidateBaseCenterPixel;
        candidateCenterPixel.y += randomColumnMotionOffset(candidateCell.x);
        vec2 candidateDelta = pixel - candidateCenterPixel;
        vec2 candidateRotatedP = vec2(dot(candidateDelta, normal), dot(candidateDelta, axis));
        float candidateHalfW = min(candidateWidthPx, drawableStackPx) * 0.5;
        float candidateHalfH = drawableAxisPx * 0.5 + groupNoGapExtend + candidateHalfW * overlapAmount + w;
        float candidateR = min(uCorner, min(candidateHalfW, candidateHalfH));
        float candidateGeometryAlpha = stripeAlpha(candidateRotatedP, vec2(candidateHalfW, candidateHalfH), candidateR, w);
        if (candidateGeometryAlpha <= 0.001) continue;

        vec4 candidateOpacityMeta = texture(uOpacityLut, candidateLutUv);
        float candidateOpacity = candidateOpacityMeta.r;
        float candidateRampT = candidateOpacityMeta.g;
        float candidateDotEligible = candidateOpacityMeta.b;
        float candidateShapeAlpha = stripeShapeAlpha(
          candidateRotatedP,
          vec2(candidateHalfW, candidateHalfH),
          vec2(candidateHalfW, drawableAxisPx * 0.5),
          candidateR,
          candidateGeometryAlpha,
          candidateWidthPx,
          w,
          candidateCell
        );
        float candidateDotAlpha = stripeDotAlpha(
          candidateRotatedP,
          candidateCell,
          candidateDotEligible,
          candidateWidthPx,
          candidateOpacity,
          w
        );
        float candidateAlpha = max(candidateShapeAlpha, candidateDotAlpha) * candidateOpacity;
        if (candidateAlpha > 0.001) {
          vec3 candidateColor = candidateLut.rgb;
          if (uUseCellColors > 0.5) {
            candidateColor = cellImageColor(candidateUv);
          }
          if (uGradientEnabled > 0.5 && uUseCellColors < 0.5) {
            candidateColor = gradientColorWithRampLightness(candidateUv, candidateColor, candidateRampT);
          }
          candidateColor = applyStripeSparkle(candidateColor, candidateCell, candidateWidthPx, candidateOpacity);
          candidateColor = dottedStripeColor(candidateColor, candidateRampT, candidateDotAlpha);

          if (overlapRotation) {
            vec3 blendedCandidateColor = bgColor.a <= 0.0001 ? candidateColor : blendStripeColor(bgColor.rgb, candidateColor);
            overlapColor = mix(overlapColor, vec4(blendedCandidateColor, 1.0), candidateAlpha);
            continue;
          }

          if (
            candidateValue <= bestDepth + 0.0001 &&
            (abs(candidateValue - bestDepth) > 0.0001 || candidateAlpha <= bestAlpha)
          ) {
            continue;
          }

          bestAlpha = candidateAlpha;
          bestColor = candidateColor;
          bestDepth = candidateValue;
        }
      }
    }

    if (overlapRotation) {
      finalColor = overlapColor;
    } else {
      vec3 blendedBestColor = bgColor.a <= 0.0001 ? bestColor : blendStripeColor(bgColor.rgb, bestColor);
      finalColor = mix(bgColor, vec4(blendedBestColor, 1.0), bestAlpha);
    }
  } else {
    if (!baseStripeVisible) {
      finalColor = bgColor;
    } else {
      vec2 rotatedP = vec2(dot(p, normal), dot(p, axis));
      float halfW = min(barWidthPx, max(drawablePx.x, drawablePx.y)) * 0.5;
      float halfH = length(drawablePx) * 0.5;
      float r = min(uCorner, min(halfW, halfH));
      vec2 halfExt = vec2(halfW, halfH + noGapExtend + r);
      float geometryAlpha = stripeAlpha(rotatedP, halfExt, r, w);
      float borderHalfH = max(w, dot(abs(axis), drawablePx) * 0.5);
      float shapeAlpha = stripeShapeAlpha(
        rotatedP,
        halfExt,
        vec2(halfW, borderHalfH),
        r,
        geometryAlpha,
        barWidthPx,
        w,
        sourceCell
      );
      float dotAlpha = stripeDotAlpha(rotatedP, sourceCell, barDotEligible, barWidthPx, barOpacity, w) * geometryAlpha;
      float effectiveAlpha = max(shapeAlpha, dotAlpha) * barOpacity;
      vec3 dottedBarColor = dottedStripeColor(barColor, barRampT, dotAlpha);
      vec3 blendedBarColor = bgColor.a <= 0.0001 ? dottedBarColor : blendStripeColor(bgColor.rgb, dottedBarColor);
      finalColor = mix(bgColor, vec4(blendedBarColor, 1.0), effectiveAlpha);
    }
  }

  float lineAlpha = gridLineAlpha(gridLineCellF, w, arbitraryAngle);
  if (lineAlpha > 0.001) {
    vec3 lineColor = stripeBrightnessColor(barColor, uGridLinesBrightness);
    vec3 blendedLineColor = finalColor.a <= 0.0001 ? lineColor : blendStripeColor(finalColor.rgb, lineColor);
    finalColor = mix(finalColor, vec4(blendedLineColor, 1.0), lineAlpha);
  }

  if (uLettersEnabled > 0.5) {
    float data = texture(uGlyphData, (cell + 0.5) / uGridCount).r * 255.0;
    if (data >= 0.5) {
      float gi = floor(data + 0.5) - 1.0;
      vec2 gpos = (local - 0.5) / max(uLetterSizeScale, 0.001) + 0.5;
      if (all(greaterThanEqual(gpos, vec2(0.0))) && all(lessThanEqual(gpos, vec2(1.0)))) {
        float gcol = mod(gi, uAtlasGrid.x);
        float grow = floor(gi / uAtlasGrid.x);
        vec2 atlasUv = (vec2(gcol, grow) + vec2(gpos.x, 1.0 - gpos.y)) / uAtlasGrid;
        float cov = texture(uAtlas, atlasUv).r;
        if (uTransparent > 0.5) finalColor *= 1.0 - cov;
        else finalColor.rgb = mix(finalColor.rgb, uLetterColor, cov);
      }
    }
  }

  // Final alpha mask. The canvas is premultiplied (premultipliedAlpha: true),
  // so scaling the whole vec4 is exactly a * mask — scaling only .a would leave
  // the colour un-darkened and read as a halo.
  finalColor *= edgeMaskAlpha(vUv);
}
`;
//#endregion
//#region src/edgeMask/edgeMaskPlacement.ts
function $e(e) {
	return e.edgeMask.enabled ? e.colors.mode === "colors" ? "output" : "field" : "none";
}
function et(e, t) {
	let n = (n) => e.getUniformLocation(t, n);
	return {
		cell: n("uCell"),
		lut: n("uLut"),
		opacityLut: n("uOpacityLut"),
		cellColor: n("uCellColor"),
		grid: n("uGridCount"),
		cellPx: n("uCellPx"),
		cellMin: n("uCellMin"),
		cellMax: n("uCellMax"),
		timeSec: n("uTimeSec"),
		gapEnabled: n("uGapEnabled"),
		gapCoverage: n("uGapCoverage"),
		gapPeriodMin: n("uGapPeriodMin"),
		gapPeriodMax: n("uGapPeriodMax"),
		stripeSparkleEnabled: n("uStripeSparkleEnabled"),
		stripeSparkleCoverage: n("uStripeSparkleCoverage"),
		stripeSparkleMaxBrightness: n("uStripeSparkleMaxBrightness"),
		stripeSparkleSpeed: n("uStripeSparkleSpeed"),
		stripeSparkleMinWidthPx: n("uStripeSparkleMinWidthPx"),
		stripeSparkleHueDriftDeg: n("uStripeSparkleHueDriftDeg"),
		stripeSparkleSaturationBoost: n("uStripeSparkleSaturationBoost"),
		shuffleEnabled: n("uShuffleEnabled"),
		shuffleCoverage: n("uShuffleCoverage"),
		shufflePeriodMin: n("uShufflePeriodMin"),
		shufflePeriodMax: n("uShufflePeriodMax"),
		shuffleSwingPx: n("uShuffleSwingPx"),
		motionEnabled: n("uMotionEnabled"),
		motionAmplitudePx: n("uMotionAmplitudePx"),
		motionStaggerPx: n("uMotionStaggerPx"),
		motionMaxOffsetPx: n("uMotionMaxOffsetPx"),
		motionSpeed: n("uMotionSpeed"),
		useCellColors: n("uUseCellColors"),
		imageColorLightness: n("uImageColorLightness"),
		imageColorDensity: n("uImageColorDensity"),
		gradientEnabled: n("uGradientEnabled"),
		gradientDirection: n("uGradientDirection"),
		gradientStopCount: n("uGradientStopCount"),
		gradientStop0: n("uGradientStop0"),
		gradientStop1: n("uGradientStop1"),
		gradientStop2: n("uGradientStop2"),
		gradientStop3: n("uGradientStop3"),
		gradientHueDriftDeg: n("uGradientHueDriftDeg"),
		gradientSaturationBoost: n("uGradientSaturationBoost")
	};
}
function tt(e, t, n, r, i) {
	e.activeTexture(e.TEXTURE0 + 0), e.bindTexture(e.TEXTURE_2D, r), e.uniform1i(t.cell, 0), e.activeTexture(e.TEXTURE0 + 1), e.bindTexture(e.TEXTURE_2D, i), e.uniform1i(t.lut, 1), e.activeTexture(e.TEXTURE0 + 5), e.bindTexture(e.TEXTURE_2D, n.opacityTex), e.uniform1i(t.opacityLut, 5), e.activeTexture(e.TEXTURE0 + 4), e.bindTexture(e.TEXTURE_2D, n.cellColorTex), e.uniform1i(t.cellColor, 4), e.uniform2f(t.grid, n.cols, n.rows), e.uniform2f(t.cellPx, n.cellW, n.cellH), e.uniform1f(t.cellMin, n.cellMin), e.uniform1f(t.cellMax, n.cellMax), e.uniform1f(t.timeSec, n.timeSec), e.uniform1f(t.gapEnabled, +!!n.gapEnabled), e.uniform1f(t.gapCoverage, n.gapCoverage), e.uniform1f(t.gapPeriodMin, n.gapPeriodMin), e.uniform1f(t.gapPeriodMax, n.gapPeriodMax), e.uniform1f(t.stripeSparkleEnabled, +!!n.stripeSparkleEnabled), e.uniform1f(t.stripeSparkleCoverage, n.stripeSparkleCoverage), e.uniform1f(t.stripeSparkleMaxBrightness, n.stripeSparkleMaxBrightness), e.uniform1f(t.stripeSparkleSpeed, n.stripeSparkleSpeed), e.uniform1f(t.stripeSparkleMinWidthPx, n.stripeSparkleMinWidthPx), e.uniform1f(t.stripeSparkleHueDriftDeg, n.stripeSparkleHueDriftDeg), e.uniform1f(t.stripeSparkleSaturationBoost, n.stripeSparkleSaturationBoost), e.uniform1f(t.shuffleEnabled, +!!n.shuffleEnabled), e.uniform1f(t.shuffleCoverage, n.shuffleCoverage), e.uniform1f(t.shufflePeriodMin, n.shufflePeriodMin), e.uniform1f(t.shufflePeriodMax, n.shufflePeriodMax), e.uniform1f(t.shuffleSwingPx, n.shuffleSwingPx), e.uniform1f(t.motionEnabled, +!!n.motionEnabled), e.uniform1f(t.motionAmplitudePx, n.motionAmplitudePx), e.uniform1f(t.motionStaggerPx, n.motionStaggerPx), e.uniform1f(t.motionMaxOffsetPx, n.motionMaxOffsetPx), e.uniform1f(t.motionSpeed, n.motionSpeed), e.uniform1f(t.useCellColors, +!!n.useCellColors), e.uniform1f(t.imageColorLightness, n.imageColorLightness), e.uniform1f(t.imageColorDensity, n.imageColorDensity), e.uniform1f(t.gradientEnabled, +!!n.gradientEnabled), e.uniform1f(t.gradientDirection, n.gradientDirection), e.uniform1f(t.gradientStopCount, n.gradientStopCount), e.uniform3f(t.gradientStop0, ...V(n.gradientStops[0])), e.uniform3f(t.gradientStop1, ...V(n.gradientStops[1])), e.uniform3f(t.gradientStop2, ...V(n.gradientStops[2])), e.uniform3f(t.gradientStop3, ...V(n.gradientStops[3])), e.uniform1f(t.gradientHueDriftDeg, n.gradientHueDriftDeg), e.uniform1f(t.gradientSaturationBoost, n.gradientSaturationBoost);
}
//#endregion
//#region src/passes/stripePass.ts
function nt(e, t) {
	let n = Math.max(.05, e.sparkle.gaps.speed);
	return {
		cellW: e.grid.cellWidth,
		cellH: e.grid.cellHeight,
		gapX: e.grid.gapX,
		gapY: e.grid.gapY,
		cornerRadius: e.grid.cornerRadius,
		orientation: +(e.grid.orientation === "horizontal"),
		angleDeg: e.grid.angleDeg,
		rotationMode: e.grid.rotationMode === "overlap" ? 2 : 0,
		overlapAmount: e.grid.overlapAmount,
		streamGapWaveEnabled: e.grid.streamGapWave.enabled,
		streamGapWaveSqueeze: e.grid.streamGapWave.squeeze,
		streamGapWaveWavelengthCells: e.grid.streamGapWave.wavelengthCells,
		streamGapWaveSpeed: e.grid.streamGapWave.speed,
		streamGapWavePhaseDeg: e.grid.streamGapWave.phaseDeg,
		cellMin: 0,
		cellMax: 1,
		cols: t.cols,
		rows: t.rows,
		background: e.background.color,
		backgroundAlpha: +!e.background.transparent,
		transparent: e.background.transparent,
		backgroundGradientEnabled: !e.background.transparent && e.background.gradient.enabled,
		backgroundGradientDirection: d(e.background.gradient.direction),
		backgroundGradientStopCount: e.background.gradient.stopCount,
		backgroundGradientStops: e.background.gradient.stops,
		backgroundGridEnabled: !e.background.transparent && e.background.grid.enabled,
		backgroundGridCellW: e.background.grid.cellWidth,
		backgroundGridCellH: e.background.grid.cellHeight,
		backgroundGridGapX: e.background.grid.gapX,
		backgroundGridGapY: e.background.grid.gapY,
		backgroundGridCornerRadius: e.background.grid.cornerRadius,
		backgroundGridColor: e.background.grid.color,
		backgroundGridOpacity: e.background.grid.opacity,
		displayW: t.displayW,
		displayH: t.displayH,
		dpr: t.dpr,
		timeSec: t.timeSec,
		gapEnabled: e.sparkle.gaps.enabled,
		gapCoverage: e.sparkle.gaps.coverage,
		gapPeriodMin: .21 / n,
		gapPeriodMax: .55 / n,
		stripeSparkleEnabled: e.sparkle.stripe.enabled,
		stripeSparkleCoverage: e.sparkle.stripe.coverage,
		stripeSparkleMaxBrightness: e.sparkle.stripe.maxBrightness,
		stripeSparkleSpeed: e.sparkle.stripe.speed,
		stripeSparkleMinWidthPx: (() => {
			let t = Array.from(new Set(e.stripes.filter((e) => e.opacity > .001 && e.width >= .5).map((e) => Math.round(e.width * 1e3) / 1e3))).sort((e, t) => t - e);
			if (t.length === 0) return 1e6;
			let n = Math.max(1, Math.round(e.sparkle.stripe.thickestCount));
			return t[Math.min(n - 1, t.length - 1)];
		})(),
		stripeSparkleHueDriftDeg: e.sparkle.stripe.hueDriftDeg,
		stripeSparkleSaturationBoost: e.sparkle.stripe.saturationBoost,
		stripeDotsEnabled: e.stripeDots.enabled,
		stripeDotsSizePx: e.stripeDots.sizePx,
		stripeDotsRandomVisibility: e.stripeDots.randomVisibility,
		stripeDotsBrightness: e.stripeDots.brightness,
		stripeDotsHueDriftDeg: e.stripeDots.hueDriftDeg,
		stripeDotsSaturationBoost: e.stripeDots.saturationBoost,
		stripeBorderEnabled: e.stripeBorder.enabled,
		stripeBorderMinWidthPx: e.stripeBorder.minWidthPx,
		stripeBorderDensity: e.stripeBorder.density,
		gridLinesEnabled: e.gridLines.enabled,
		gridLinesBrightness: e.gridLines.brightness,
		gridLinesDensity: e.gridLines.density,
		edgeMaskEnabled: $e(e) === "output",
		edgeMaskStart: e.edgeMask.start,
		edgeMaskEnd: e.edgeMask.end,
		edgeMaskPower: e.edgeMask.power,
		edgeMaskSides: [
			+!!e.edgeMask.sides.left,
			+!!e.edgeMask.sides.right,
			+!!e.edgeMask.sides.bottom,
			+!!e.edgeMask.sides.top
		],
		shuffleEnabled: e.sparkle.width.enabled,
		shuffleCoverage: e.sparkle.width.coverage,
		shufflePeriodMin: e.sparkle.width.swingPeriodMin,
		shufflePeriodMax: e.sparkle.width.swingPeriodMax,
		shuffleSwingPx: e.sparkle.width.swingPx,
		motionEnabled: e.sparkle.motion.enabled,
		motionAmplitudePx: e.sparkle.motion.amplitudePx,
		motionStaggerPx: e.sparkle.motion.staggerPx,
		motionMaxOffsetPx: e.sparkle.motion.maxOffsetPx,
		motionSpeed: e.sparkle.motion.speed,
		lettersEnabled: t.lettersEnabled,
		glyphDataTex: t.glyphDataTex,
		atlasTex: t.atlasTex,
		atlasGrid: t.atlasGrid,
		letterSizeScale: e.letters.sizeScale,
		letterColor: e.letters.color,
		useCellColors: t.colorsMode,
		cellColorTex: t.cellColorTex,
		imageColorLightness: e.colors.imageColorLightness,
		imageColorDensity: e.colors.imageColorDensity,
		opacityTex: t.opacityTex,
		cellDataA: t.cellDataA,
		cellDataB: t.cellDataB,
		blendMode: f[e.colors.stripeBlendMode],
		gradientEnabled: e.colors.gradient.enabled,
		gradientDirection: d(e.colors.gradient.direction),
		gradientStopCount: e.colors.gradient.stopCount,
		gradientStops: e.colors.gradient.stops,
		gradientHueDriftDeg: e.colors.gradient.hueDriftDeg,
		gradientSaturationBoost: e.colors.gradient.saturationBoost
	};
}
function rt(e, t) {
	let n = P(e, B, Qe), r = (t) => e.getUniformLocation(n, t), i = et(e, n), a = {
		cellDataA: r("uCellDataA"),
		cellDataB: r("uCellDataB"),
		useCellData: r("uUseCellData"),
		gridGap: r("uGridGapPx"),
		corner: r("uCorner"),
		orient: r("uOrient"),
		angleDeg: r("uAngleDeg"),
		rotationMode: r("uRotationMode"),
		overlapAmount: r("uOverlapAmount"),
		streamGapWaveEnabled: r("uStreamGapWaveEnabled"),
		streamGapWaveSqueeze: r("uStreamGapWaveSqueeze"),
		streamGapWaveWavelengthCells: r("uStreamGapWaveWavelengthCells"),
		streamGapWaveSpeed: r("uStreamGapWaveSpeed"),
		streamGapWavePhaseDeg: r("uStreamGapWavePhaseDeg"),
		bg: r("uBg"),
		bgAlpha: r("uBgAlpha"),
		transparent: r("uTransparent"),
		bgGradientEnabled: r("uBgGradientEnabled"),
		bgGradientDirection: r("uBgGradientDirection"),
		bgGradientStopCount: r("uBgGradientStopCount"),
		bgGradientStop0: r("uBgGradientStop0"),
		bgGradientStop1: r("uBgGradientStop1"),
		bgGradientStop2: r("uBgGradientStop2"),
		bgGradientStop3: r("uBgGradientStop3"),
		bgGridEnabled: r("uBgGridEnabled"),
		bgGridCellPx: r("uBgGridCellPx"),
		bgGridGapPx: r("uBgGridGapPx"),
		bgGridCorner: r("uBgGridCorner"),
		bgGridColor: r("uBgGridColor"),
		bgGridOpacity: r("uBgGridOpacity"),
		displayPx: r("uDisplayPx"),
		dpr: r("uDpr"),
		stripeDotsEnabled: r("uStripeDotsEnabled"),
		stripeDotsSizePx: r("uStripeDotsSizePx"),
		stripeDotsRandomVisibility: r("uStripeDotsRandomVisibility"),
		stripeDotsBrightness: r("uStripeDotsBrightness"),
		stripeDotsHueDriftDeg: r("uStripeDotsHueDriftDeg"),
		stripeDotsSaturationBoost: r("uStripeDotsSaturationBoost"),
		stripeBorderEnabled: r("uStripeBorderEnabled"),
		stripeBorderMinWidthPx: r("uStripeBorderMinWidthPx"),
		stripeBorderDensity: r("uStripeBorderDensity"),
		gridLinesEnabled: r("uGridLinesEnabled"),
		gridLinesBrightness: r("uGridLinesBrightness"),
		gridLinesDensity: r("uGridLinesDensity"),
		edgeMaskEnabled: r("uEdgeMaskEnabled"),
		edgeMaskStart: r("uEdgeMaskStart"),
		edgeMaskEnd: r("uEdgeMaskEnd"),
		edgeMaskPower: r("uEdgeMaskPower"),
		edgeMaskSides: r("uEdgeMaskSides"),
		lettersEnabled: r("uLettersEnabled"),
		glyphData: r("uGlyphData"),
		atlas: r("uAtlas"),
		atlasGrid: r("uAtlasGrid"),
		letterSizeScale: r("uLetterSizeScale"),
		letterColor: r("uLetterColor"),
		blendMode: r("uBlendMode")
	}, o = (t, n) => e.uniform3f(t, ...V(n));
	return {
		render(r, s, c, l, u, d = null, f = 0, p = 0) {
			d ? z(e, d) : (e.bindFramebuffer(e.FRAMEBUFFER, null), e.viewport(f, p, l, u), me(l, u)), e.useProgram(n), tt(e, i, c, r, s);
			let m = !!c.cellDataA && !!c.cellDataB;
			e.uniform1f(a.useCellData, +!!m), m && (e.activeTexture(e.TEXTURE6), e.bindTexture(e.TEXTURE_2D, c.cellDataA), e.uniform1i(a.cellDataA, 6), e.activeTexture(e.TEXTURE7), e.bindTexture(e.TEXTURE_2D, c.cellDataB), e.uniform1i(a.cellDataB, 7)), e.uniform2f(a.gridGap, c.gapX, c.gapY), e.uniform1f(a.corner, c.cornerRadius), e.uniform1f(a.orient, c.orientation), e.uniform1f(a.angleDeg, c.angleDeg), e.uniform1f(a.rotationMode, c.rotationMode), e.uniform1f(a.overlapAmount, c.overlapAmount), e.uniform1f(a.streamGapWaveEnabled, +!!c.streamGapWaveEnabled), e.uniform1f(a.streamGapWaveSqueeze, c.streamGapWaveSqueeze), e.uniform1f(a.streamGapWaveWavelengthCells, c.streamGapWaveWavelengthCells), e.uniform1f(a.streamGapWaveSpeed, c.streamGapWaveSpeed), e.uniform1f(a.streamGapWavePhaseDeg, c.streamGapWavePhaseDeg), o(a.bg, c.background), e.uniform1f(a.bgAlpha, c.backgroundAlpha), e.uniform1f(a.transparent, +!!c.transparent), e.uniform1f(a.bgGradientEnabled, +!!c.backgroundGradientEnabled), e.uniform1f(a.bgGradientDirection, c.backgroundGradientDirection), e.uniform1f(a.bgGradientStopCount, c.backgroundGradientStopCount), o(a.bgGradientStop0, c.backgroundGradientStops[0]), o(a.bgGradientStop1, c.backgroundGradientStops[1]), o(a.bgGradientStop2, c.backgroundGradientStops[2]), o(a.bgGradientStop3, c.backgroundGradientStops[3]), e.uniform1f(a.bgGridEnabled, +!!c.backgroundGridEnabled), e.uniform2f(a.bgGridCellPx, c.backgroundGridCellW, c.backgroundGridCellH), e.uniform2f(a.bgGridGapPx, c.backgroundGridGapX, c.backgroundGridGapY), e.uniform1f(a.bgGridCorner, c.backgroundGridCornerRadius), o(a.bgGridColor, c.backgroundGridColor), e.uniform1f(a.bgGridOpacity, c.backgroundGridOpacity), e.uniform2f(a.displayPx, c.displayW, c.displayH), e.uniform1f(a.dpr, c.dpr), e.uniform1f(a.stripeDotsEnabled, +!!c.stripeDotsEnabled), e.uniform1f(a.stripeDotsSizePx, c.stripeDotsSizePx), e.uniform1f(a.stripeDotsRandomVisibility, c.stripeDotsRandomVisibility), e.uniform1f(a.stripeDotsBrightness, c.stripeDotsBrightness), e.uniform1f(a.stripeDotsHueDriftDeg, c.stripeDotsHueDriftDeg), e.uniform1f(a.stripeDotsSaturationBoost, c.stripeDotsSaturationBoost), e.uniform1f(a.stripeBorderEnabled, +!!c.stripeBorderEnabled), e.uniform1f(a.stripeBorderMinWidthPx, c.stripeBorderMinWidthPx), e.uniform1f(a.stripeBorderDensity, c.stripeBorderDensity), e.uniform1f(a.gridLinesEnabled, +!!c.gridLinesEnabled), e.uniform1f(a.gridLinesBrightness, c.gridLinesBrightness), e.uniform1f(a.gridLinesDensity, c.gridLinesDensity), e.uniform1f(a.edgeMaskEnabled, +!!c.edgeMaskEnabled), e.uniform1f(a.edgeMaskStart, c.edgeMaskStart), e.uniform1f(a.edgeMaskEnd, c.edgeMaskEnd), e.uniform1f(a.edgeMaskPower, c.edgeMaskPower), e.uniform4f(a.edgeMaskSides, ...c.edgeMaskSides), e.uniform1f(a.lettersEnabled, +!!c.lettersEnabled), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, c.glyphDataTex), e.uniform1i(a.glyphData, 2), e.activeTexture(e.TEXTURE3), e.bindTexture(e.TEXTURE_2D, c.atlasTex), e.uniform1i(a.atlas, 3), e.uniform2f(a.atlasGrid, c.atlasGrid[0], c.atlasGrid[1]), e.uniform1f(a.letterSizeScale, c.letterSizeScale), o(a.letterColor, c.letterColor), e.uniform1f(a.blendMode, c.blendMode), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/stripeCell.frag.ts
var it = `#version 300 es
precision highp float;
in vec2 vUv;
${Ze}
layout(location = 0) out vec4 outCellA;
layout(location = 1) out vec4 outCellB;

void main() {
  vec2 cell = floor(vUv * uGridCount);
  CellData d = cellData(cell);
  outCellA = vec4(d.color, d.widthPx);
  outCellB = vec4(d.opacity, d.rampT, d.dotEligible, randomColumnMotionOffset(cell.x));
}
`;
//#endregion
//#region src/passes/stripeCellPass.ts
function at(e, t) {
	let n = P(e, B, it), r = et(e, n);
	return {
		render(i, a, o, s, c, l) {
			be(e, i, [a, o]), e.useProgram(n), tt(e, r, l, s, c), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/stylize/common.ts
var K = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uTex;\nuniform sampler2D uStripes;\nuniform vec3 uColorA;\nuniform vec3 uColorB;\nuniform float uTime;\nuniform float uIntensity;\nuniform vec2 uResolution;\nuniform float uDpr;\nuniform vec4 uParams;\nout vec4 fragColor;\n\nfloat hash21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }\nfloat vnoise(vec2 p){\n  vec2 i = floor(p), f = fract(p);\n  f = f * f * (3.0 - 2.0 * f);\n  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));\n  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));\n  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);\n}\nfloat fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.0; a *= 0.5; } return s; }\nvec2 warp(vec2 uv, vec2 freq, float scale, float t){\n  float nx = fbm(uv * freq + vec2(0.0, t));\n  float ny = fbm(uv * freq + vec2(5.2, 1.3) - vec2(t, 0.0));\n  return uv + (vec2(nx, ny) - 0.5) * scale;\n}\nfloat grain(vec2 uv, float t){ return hash21(uv * uResolution + t); }\nfloat luma(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }\nvec3 blurTex(vec2 uv, float px){\n  vec2 o = px / uResolution;\n  vec3 s = texture(uTex, uv).rgb * 0.4;\n  s += texture(uTex, uv + vec2(o.x, 0.0)).rgb * 0.15;\n  s += texture(uTex, uv - vec2(o.x, 0.0)).rgb * 0.15;\n  s += texture(uTex, uv + vec2(0.0, o.y)).rgb * 0.15;\n  s += texture(uTex, uv - vec2(0.0, o.y)).rgb * 0.15;\n  return s;\n}\n", ot = K + "\nvoid main(){\n  float amp = mix(1.5, 10.0, uParams.x) * uDpr;\n  float grainAmt = uParams.y;\n  float freq = mix(3.0, 14.0, uParams.z);\n  float colW = 7.0 * uDpr;\n  float colId = floor(vUv.x * uResolution.x / colW);\n  float dur = mix(0.6, 3.0, hash21(vec2(colId, 1.0)));\n  float tick = floor(uTime / dur + hash21(vec2(colId, 2.0)) * 13.0);\n  float seed = hash21(vec2(colId, tick)) * 30.0;\n  float dx = (fbm(vec2(vUv.y * freq + seed, seed * 0.7)) - 0.5) * amp;\n  float dy = (fbm(vec2(vUv.x * 10.0, vUv.y * freq * 0.5 + seed)) - 0.5) * amp * 0.4;\n  vec2 uv = vUv + vec2(dx, dy) / uResolution;\n  vec3 c = texture(uStripes, uv).rgb;\n  float paper = mix(fbm(vUv * uResolution / 3.0), hash21(floor(vUv * uResolution / 1.5)), 0.5);\n  c *= mix(1.0, 0.8 + 0.4 * paper, grainAmt * 0.5);\n  fragColor = vec4(mix(texture(uStripes, vUv).rgb, c, uIntensity), 1.0);\n}\n", st = K + "\nvoid main(){\n  float t = uTime * 0.25;\n  float grainAmt = uParams.x;\n  float smudgeAmt = uParams.y;\n  float dark = mix(0.3, 0.9, uParams.z);\n  vec2 uv = warp(vUv, vec2(50.0, 70.0), 0.025 * uIntensity, t);\n  vec3 c = texture(uTex, uv).rgb;\n  float grit = mix(fbm(vUv * uResolution / 2.5), hash21(floor(vUv * uResolution / 1.2)), 0.6);\n  c *= mix(1.0, (1.0 - dark) + (dark + 0.2) * grit, grainAmt * uIntensity);\n  float smear = fbm(vec2(vUv.x * 40.0, vUv.y * 8.0) + t);\n  c *= mix(1.0, 0.7 + 0.4 * smear, smudgeAmt * 0.4 * uIntensity);\n  fragColor = vec4(c, 1.0);\n}\n", ct = K + "\nvoid main(){\n  vec2 pp = vUv * uResolution;\n  float density = mix(0.25, 0.7, uParams.x);\n  float pressure = uParams.y;\n  float paperAmt = uParams.z;\n  vec3 tone = vec3(0.0);\n  for (int i = -2; i <= 2; i++) {\n    for (int j = -2; j <= 2; j++) {\n      tone += texture(uTex, vUv + vec2(float(i), float(j)) * 3.0 / uResolution).rgb;\n    }\n  }\n  tone /= 25.0;\n  float ink = clamp((1.0 - luma(tone)) * (0.7 + 0.8 * pressure), 0.0, 1.0);\n  float l = luma(texture(uTex, vUv).rgb);\n  float lx = luma(texture(uTex, vUv + vec2(2.5, 0.0) / uResolution).rgb);\n  float ly = luma(texture(uTex, vUv + vec2(0.0, 2.5) / uResolution).rgb);\n  float wob = fbm(vUv * 40.0) - 0.5;\n  float edge = abs(l - lx) + abs(l - ly);\n  float outline = smoothstep(0.12, 0.3, edge + wob * 0.05);\n  float freq = mix(0.1, 0.26, density);\n  float hw = fbm(vUv * 24.0) * 1.4;\n  float h1 = smoothstep(0.42, 0.3, abs(sin((pp.x * 0.7 + pp.y * 0.7) * freq + hw)));\n  float h2 = smoothstep(0.42, 0.3, abs(sin((pp.x * 0.7 - pp.y * 0.7) * freq + hw)));\n  float hatch = h1 * step(0.32, ink);\n  hatch = max(hatch, h2 * step(0.6, ink));\n  hatch *= smoothstep(0.05, 0.25, ink);\n  float cover = max(outline, hatch * 0.75);\n  float grain = hash21(floor(pp / 1.5));\n  cover *= mix(1.0, 0.55 + 0.45 * grain, paperAmt);\n  vec3 outc = mix(uColorB, uColorA, clamp(cover, 0.0, 1.0));\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);\n}\n", lt = K + "\nvoid main(){\n  float strokeAmt = uParams.x;\n  float bristleAmt = uParams.y;\n  float impasto = uParams.z;\n  float strokeLen = mix(0.5, 16.0, strokeAmt) * uDpr;\n  float ang = (fbm(vUv * 2.5) - 0.5) * 3.14159;\n  vec2 dir = vec2(cos(ang), sin(ang));\n  vec2 perp = vec2(-dir.y, dir.x);\n  vec3 col = vec3(0.0);\n  float wsum = 0.0;\n  for (int i = -5; i <= 5; i++) {\n    float w = 1.0 - abs(float(i)) / 6.0;\n    col += texture(uTex, vUv + dir * float(i) * strokeLen / uResolution).rgb * w;\n    wsum += w;\n  }\n  col /= wsum;\n  vec2 sp = vUv * uResolution;\n  float bristle = fbm(vec2(dot(sp, perp) * 0.5, dot(sp, dir) * 0.04));\n  col *= mix(1.0, 0.72 + 0.45 * bristle, bristleAmt);\n  col += smoothstep(0.72, 1.0, bristle) * impasto * 0.22;\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, col, uIntensity), 1.0);\n}\n", ut = K + "\nvoid main(){\n  vec3 here = texture(uTex, vUv).rgb;\n  float cell = mix(2.0, 22.0, uParams.x) * uDpr;\n  float square = uParams.y;\n  vec2 cells = uResolution / cell;\n  vec2 gp = vUv * cells;\n  vec2 cellOrigin = floor(gp);\n  vec3 src = vec3(0.0);\n  for (int sx = 0; sx < 4; sx++) {\n    for (int sy = 0; sy < 4; sy++) {\n      vec2 s = (cellOrigin + (vec2(float(sx), float(sy)) + 0.5) / 4.0) / cells;\n      src += texture(uTex, s).rgb;\n    }\n  }\n  src /= 16.0;\n  float ink = clamp((1.0 - luma(src)) * 1.3, 0.0, 1.0);\n  float rad = sqrt(ink) * 0.85;\n  vec2 f = abs(fract(gp) - 0.5);\n  float d = mix(length(f), max(f.x, f.y), square);\n  float dotm = smoothstep(rad + 0.06, rad - 0.06, d);\n  vec3 outc = mix(vec3(0.97), src, dotm);\n  fragColor = vec4(mix(here, outc, uIntensity), 1.0);\n}\n", dt = K + "\nvoid main(){\n  float t = uTime * 0.3;\n  float mis = mix(2.0, 12.0, uParams.x);\n  float hue = uParams.y;\n  float cell = 3.0 * uDpr;\n  vec2 cells = uResolution / cell;\n  vec2 o = (vec2(mis, mis * 0.8) / uResolution) * (1.0 + 0.5 * sin(t * 2.0));\n  vec3 a = texture(uTex, (floor((vUv - o) * cells) + 0.5) / cells).rgb;\n  vec3 b = texture(uTex, (floor((vUv + o) * cells) + 0.5) / cells).rgb;\n  vec3 ink2col = mix(vec3(0.1, 0.5, 0.9), vec3(0.2, 0.8, 0.4), hue);\n  vec3 ink1 = mix(vec3(1.0), vec3(1.0, 0.45, 0.1), 1.0 - luma(a));\n  vec3 ink2 = mix(vec3(1.0), ink2col, 1.0 - luma(b));\n  vec3 c = ink1 * ink2;\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);\n}\n", ft = K + "\nvoid main(){\n  float cellSize = mix(6.0, 60.0, uParams.x) * uDpr;\n  float lead = mix(0.30, 0.46, uParams.y);\n  float sat = mix(1.0, 2.2, uParams.z);\n  float gridOp = uParams.w;\n  vec2 cells = uResolution / cellSize;\n  vec2 gp = vUv * cells;\n  vec2 jit = vec2(fbm(floor(gp) * 1.3), fbm(floor(gp) * 2.1)) * 0.3;\n  vec2 center = (floor(gp + jit) + 0.5) / cells;\n  vec3 col = texture(uTex, center).rgb;\n  float l = luma(col);\n  col = mix(vec3(l), col, sat);\n  vec2 f = abs(fract(gp + jit) - 0.5);\n  float pane = smoothstep(0.5, 0.5 - lead * 0.3, max(f.x, f.y));\n  vec3 leaded = mix(vec3(0.02), col, pane);\n  vec3 outc = mix(col, leaded, gridOp);\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);\n}\n", pt = K + "\nvoid main(){\n  float t = uTime * 0.2;\n  float shadowAmt = uParams.x;\n  float levels = mix(3.0, 8.0, uParams.y);\n  float rough = uParams.z;\n  vec2 uv = warp(vUv, vec2(40.0, 60.0), mix(0.004, 0.014, rough) * uIntensity, t);\n  float cell = 4.0 * uDpr;\n  vec2 cells = uResolution / cell;\n  vec3 c = texture(uTex, (floor(uv * cells) + 0.5) / cells).rgb;\n  vec2 sh = vec2(8.0, 8.0) / uResolution;\n  float hereInk = 1.0 - luma(c);\n  float overInk = 1.0 - luma(texture(uTex, (floor((uv - sh) * cells) + 0.5) / cells).rgb);\n  float shadow = clamp(overInk - hereInk, 0.0, 1.0);\n  c = mix(c, c * 0.4, shadow * shadowAmt * uIntensity);\n  vec3 post = floor(c * levels + 0.5) / levels;\n  c = mix(c, post, uIntensity);\n  fragColor = vec4(c, 1.0);\n}\n", mt = K + "\nvoid main(){\n  float t = uTime;\n  vec2 px = vUv * uResolution;\n  float scanAmt = uParams.x;\n  float ab = mix(0.0, 30.0, uParams.y);\n  float bloomAmt = uParams.z;\n  float sp = ab / uResolution.x;\n  vec3 c;\n  c.r = texture(uTex, vUv + vec2(sp, 0.0)).r;\n  c.g = texture(uTex, vUv).g;\n  c.b = texture(uTex, vUv - vec2(sp, 0.0)).b;\n  float scan = 0.5 + 0.5 * sin((px.y / 1.6 - t * 3.0) * 6.28318);\n  c *= mix(1.0, 0.35 + 0.65 * scan, scanAmt * uIntensity);\n  float col = mod(floor(px.x / (1.5 * uDpr)), 3.0);\n  vec3 mask = vec3(0.7);\n  if (col < 0.5) mask.r = 1.0; else if (col < 1.5) mask.g = 1.0; else mask.b = 1.0;\n  c *= mix(vec3(1.0), mask, 0.5 * uIntensity);\n  vec3 bloom = blurTex(vUv, 2.5 * uDpr);\n  c += bloom * bloomAmt * 0.3 * uIntensity;\n  vec2 q = vUv - 0.5;\n  c *= 1.0 - dot(q, q) * (0.6 * uIntensity);\n  fragColor = vec4(c, 1.0);\n}\n", ht = K + "\nvoid main(){\n  float t = uTime;\n  float slipAmt = mix(0.05, 0.35, uParams.x);\n  float splitAmt = mix(4.0, 40.0, uParams.y);\n  float freq = mix(0.3, 0.85, uParams.z);\n  float tt = floor(t * 12.0);\n  float band = floor(vUv.y * 20.0);\n  float a = step(1.0 - freq, hash21(vec2(band, tt)));\n  float slip = (hash21(vec2(band * 3.1, tt)) - 0.5) * slipAmt * a;\n  float band2 = floor(vUv.y * 90.0);\n  float a2 = step(0.85, hash21(vec2(band2, tt + 5.0)));\n  slip += (hash21(vec2(band2, tt)) - 0.5) * 0.05 * a2;\n  vec2 uv = vUv + vec2(slip, 0.0);\n  float sp = (splitAmt * (0.5 + a)) / uResolution.x;\n  vec3 c;\n  c.r = texture(uTex, uv + vec2(sp, 0.0)).r;\n  c.g = texture(uTex, uv - vec2(sp * 0.3, 0.0)).g;\n  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;\n  if (a > 0.5 && hash21(vec2(band, tt + 9.0)) > 0.6) { c = c.gbr; }\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);\n}\n", gt = K + "\nvoid main(){\n  float t = uTime;\n  float track = mix(0.01, 0.06, uParams.x);\n  float chroma = mix(2.0, 12.0, uParams.y);\n  float wob = (fbm(vec2(vUv.y * 40.0, t * 1.5)) - 0.5) * track;\n  float bandShift = 0.0;\n  float bandBright = 0.0;\n  for (int i = 0; i < 5; i++) {\n    float fi = float(i);\n    float by = fract(hash21(vec2(fi, 3.0)) + t * (0.02 + 0.025 * fi));\n    float bh = mix(0.006, 0.05, hash21(vec2(fi, 7.0)));\n    float b = smoothstep(bh, 0.0, abs(vUv.y - by));\n    bandShift += b * (hash21(vec2(fi, 11.0)) - 0.5) * 0.05;\n    bandBright += b;\n  }\n  vec2 uv = vUv + vec2(wob + bandShift, 0.0);\n  float sp = chroma / uResolution.x;\n  vec3 c;\n  c.r = texture(uTex, uv + vec2(sp * 1.5, 0.0)).r;\n  c.g = texture(uTex, uv).g;\n  c.b = texture(uTex, uv - vec2(sp, 0.0)).b;\n  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 2.2 * 6.28318 - t * 8.0);\n  c *= mix(1.0, 0.84 + 0.16 * scan, 0.5);\n  c += clamp(bandBright, 0.0, 1.0) * 0.12;\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, c, uIntensity), 1.0);\n}\n", _t = K + "\nvoid main(){\n  float t = uTime;\n  float glowAmt = uParams.x;\n  float scanAmt = uParams.y;\n  float bright = mix(0.7, 1.4, uParams.z);\n  float cell = mix(2.0, 16.0, uParams.w) * uDpr;\n  vec2 cells = uResolution / cell;\n  vec3 src = texture(uTex, (floor(vUv * cells) + 0.5) / cells).rgb;\n  float l = luma(src);\n  float lit = 1.0 - l;\n  vec3 amber = uColorA * lit;\n  float bl = 0.0;\n  vec2 o = 3.0 / uResolution;\n  for (int i = -3; i <= 3; i++){ bl += (1.0 - luma(texture(uTex, vUv + vec2(float(i) * o.x, 0.0)).rgb)); }\n  amber += uColorA * (bl / 7.0) * glowAmt;\n  float scan = 0.5 + 0.5 * sin(vUv.y * uResolution.y / 1.8 * 6.28318 - t * 4.0);\n  vec3 screen = uColorB + amber * bright * mix(1.0 - scanAmt * 0.5, 1.0, scan);\n  fragColor = vec4(mix(src, screen, uIntensity), 1.0);\n}\n", vt = K + "\nvoid main(){\n  float cell = mix(6.0, 48.0, uParams.x) * uDpr;\n  float glossAmt = uParams.y;\n  float sat = mix(1.0, 2.0, uParams.z);\n  vec2 cells = uResolution / cell;\n  vec2 gp = vUv * cells;\n  vec2 center = (floor(gp) + 0.5) / cells;\n  vec3 c = texture(uTex, center).rgb;\n  float l = luma(c);\n  c = mix(vec3(l), c, sat);\n  vec2 f = fract(gp) - 0.5;\n  float dist = length(f);\n  float rc = smoothstep(0.5, 0.4, dist);\n  float gloss = smoothstep(0.32, 0.0, length(f - vec2(-0.15, -0.18)));\n  float rim = smoothstep(0.5, 0.46, dist) - smoothstep(0.46, 0.4, dist);\n  float present = smoothstep(0.05, 0.3, 1.0 - l);\n  vec3 outc = mix(vec3(0.97), c, rc * present);\n  outc += gloss * glossAmt * 0.7 * present;\n  outc += rim * 0.2 * present;\n  fragColor = vec4(mix(texture(uTex, vUv).rgb, outc, uIntensity), 1.0);\n}\n", yt = K + "\nvoid main(){ fragColor = vec4(texture(uTex, vUv).rgb, 1.0); }\n", bt = {
	abstract: ot,
	charcoal: st,
	pencil: ct,
	brush: lt,
	halftone: ut,
	risograph: dt,
	stainedGlass: ft,
	paperCutout: pt,
	crt: mt,
	glitch: ht,
	vhs: gt,
	amber: _t,
	gummy: vt
};
//#endregion
//#region src/passes/stylizePass.ts
function xt(e, t) {
	let n = /* @__PURE__ */ new Map();
	function r(t) {
		let r = n.get(t);
		if (r) return r;
		let i = P(e, B, bt[t] ?? yt), a = {
			program: i,
			uTex: e.getUniformLocation(i, "uTex"),
			uStripes: e.getUniformLocation(i, "uStripes"),
			uTime: e.getUniformLocation(i, "uTime"),
			uIntensity: e.getUniformLocation(i, "uIntensity"),
			uResolution: e.getUniformLocation(i, "uResolution"),
			uDpr: e.getUniformLocation(i, "uDpr"),
			uParams: e.getUniformLocation(i, "uParams"),
			uColorA: e.getUniformLocation(i, "uColorA"),
			uColorB: e.getUniformLocation(i, "uColorB")
		};
		return n.set(t, a), a;
	}
	return {
		render(n, i, a, o, s = 0, c = 0) {
			let l = r(o.mode);
			z(e, n), n || (e.viewport(s, c, o.resolution[0], o.resolution[1]), me(o.resolution[0], o.resolution[1])), e.useProgram(l.program), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, i), e.uniform1i(l.uTex, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(l.uStripes, 1), e.uniform1f(l.uTime, o.time), e.uniform1f(l.uIntensity, o.intensity), e.uniform2f(l.uResolution, o.resolution[0], o.resolution[1]), e.uniform1f(l.uDpr, o.dpr), e.uniform4f(l.uParams, o.params[0], o.params[1], o.params[2], o.params[3]), e.uniform3f(l.uColorA, ...V(o.colorA)), e.uniform3f(l.uColorB, ...V(o.colorB)), t.draw();
		},
		dispose() {
			for (let t of n.values()) e.deleteProgram(t.program);
			n.clear();
		}
	};
}
//#endregion
//#region src/shaders/logoFill.frag.ts
var St = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uTex;\nuniform vec2 uResolution;\nuniform vec3 uBg;\nout vec4 fragColor;\nvoid main(){\n  vec3 here = texture(uTex, vUv).rgb;\n  if (distance(here, uBg) > 0.12) { fragColor = vec4(here, 1.0); return; }\n  float st = 1.5 / uResolution.x;\n  vec3 leftCol = uBg; float leftDist = 999.0;\n  vec3 rightCol = uBg; float rightDist = 999.0;\n  for (int i = 1; i <= 14; i++) {\n    if (leftDist > 900.0) {\n      vec3 s = texture(uTex, vUv - vec2(float(i) * st, 0.0)).rgb;\n      if (distance(s, uBg) > 0.12) { leftCol = s; leftDist = float(i); }\n    }\n    if (rightDist > 900.0) {\n      vec3 s = texture(uTex, vUv + vec2(float(i) * st, 0.0)).rgb;\n      if (distance(s, uBg) > 0.12) { rightCol = s; rightDist = float(i); }\n    }\n  }\n  if (leftDist < 900.0 && rightDist < 900.0) {\n    fragColor = vec4(mix(leftCol, rightCol, leftDist / (leftDist + rightDist)), 1.0);\n  } else {\n    fragColor = vec4(here, 1.0);\n  }\n}\n";
//#endregion
//#region src/passes/logoFillPass.ts
function Ct(e, t) {
	let n = P(e, B, St), r = e.getUniformLocation(n, "uTex"), i = e.getUniformLocation(n, "uResolution"), a = e.getUniformLocation(n, "uBg");
	return {
		render(o, s, c) {
			z(e, o), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(r, 0), e.uniform2f(i, c.resolution[0], c.resolution[1]), e.uniform3f(a, ...V(c.bg)), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/letterData.frag.ts
var wt = "#version 300 es\nprecision highp float;\n\nin vec2 vUv;\n\nuniform sampler2D uCell;\nuniform vec2 uGridSize;\nuniform float uTopBandThreshold;\nuniform float uCoverage;\nuniform float uTimeSec;\nuniform float uCharsetLen;\nuniform float uShuffleSpeed;\nuniform vec2 uPosition;\nuniform vec2 uArea;\n\nout vec4 finalColor;\n\nconst float BASE_DELAY_SEC = 0.25;\nconst float JITTER_SEC = 0.3;\nconst float BURST_SEC = 0.18;\nconst float STEP_SEC = 0.045;\nconst float K1 = 137.0;\nconst float K2 = 61.0;\n\nfloat cellHash(float col, float row, float salt) {\n  float x = sin(col * 12.9898 + row * 78.233 + salt * 43.7381) * 43758.5453;\n  return fract(x);\n}\n\nfloat letterBaseGlyph(float col, float row) {\n  float h = cellHash(col, row, 2.0);\n  return min(floor(h * uCharsetLen), uCharsetLen - 1.0);\n}\n\nfloat letterGlyphAt(float col, float row) {\n  float speed = max(uShuffleSpeed, 0.05);\n  float jitter = cellHash(col, row, 3.0);\n  float cycleLen = (BASE_DELAY_SEC + jitter * JITTER_SEC) / speed;\n  float burstDur = BURST_SEC / speed;\n  float stepDur = STEP_SEC / speed;\n\n  float cycleIndex = floor(uTimeSec / cycleLen);\n  float localTime = uTimeSec - cycleIndex * cycleLen;\n\n  if (localTime >= burstDur) {\n    return letterBaseGlyph(col, row);\n  }\n\n  float stepIndex = floor(localTime / stepDur);\n  float h = cellHash(col + K1 * cycleIndex + K2 * stepIndex, row + K1 * stepIndex + K2 * cycleIndex, 5.0);\n  return min(floor(h * uCharsetLen), uCharsetLen - 1.0);\n}\n\nvoid main() {\n  float cols = uGridSize.x;\n  float rows = uGridSize.y;\n  float col = floor(vUv.x * cols);\n  float row = floor(vUv.y * rows);\n\n  float luma = texture(uCell, vUv).r;\n  vec2 cellCenter = (vec2(col, row) + 0.5) / uGridSize;\n  vec2 halfArea = max(uArea * 0.5, vec2(0.0001));\n  bool insideArea = all(lessThanEqual(abs(cellCenter - uPosition), halfArea));\n\n  bool present = insideArea && (uCoverage > 0.0) && (luma >= uTopBandThreshold) && (cellHash(col, row, 1.0) < uCoverage);\n  float gi = letterGlyphAt(col, row);\n\n  finalColor = vec4((present ? (gi + 1.0) : 0.0) / 255.0, 0.0, 0.0, 1.0);\n}\n";
//#endregion
//#region src/passes/letterDataPass.ts
function Tt(e, t) {
	let n = P(e, B, wt), r = e.getUniformLocation(n, "uCell"), i = e.getUniformLocation(n, "uGridSize"), a = e.getUniformLocation(n, "uTopBandThreshold"), o = e.getUniformLocation(n, "uCoverage"), s = e.getUniformLocation(n, "uTimeSec"), c = e.getUniformLocation(n, "uCharsetLen"), l = e.getUniformLocation(n, "uShuffleSpeed"), u = e.getUniformLocation(n, "uPosition"), d = e.getUniformLocation(n, "uArea");
	return {
		render(f, p, m) {
			z(e, f), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, p), e.uniform1i(r, 0), e.uniform2f(i, m.cols, m.rows), e.uniform1f(a, m.topBandThreshold), e.uniform1f(o, m.coverage), e.uniform1f(s, m.timeSec), e.uniform1f(c, m.charsetLen), e.uniform1f(l, m.shuffleSpeed), e.uniform2f(u, m.positionX, m.positionY), e.uniform2f(d, m.areaWidth, m.areaHeight), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/letters/charset.ts
var q = [
	..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
	..."abcdefghijklmnopqrstuvwxyz",
	..."0123456789",
	..."!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~"
], Et = q.length;
//#endregion
//#region src/letters/letterAtlas.ts
function Dt(e = {}) {
	let t = e.fontPx ?? 6, n = e.rasterScale ?? 8, r = e.fontFamily ?? "monospace", i = t * n, a = q.length, o = Math.ceil(Math.sqrt(a)), s = o, c = o, l = o * i, u = o * i, d = null;
	if (typeof document < "u" && typeof document.createElement == "function") {
		let e = document.createElement("canvas");
		e.width = l, e.height = u, d = e.getContext("2d");
	} else typeof OffscreenCanvas < "u" && (d = new OffscreenCanvas(l, u).getContext("2d"));
	if (!d) return {
		data: new Uint8Array(l * u),
		width: l,
		height: u,
		gridCols: s,
		gridRows: c,
		glyphPx: i
	};
	d.clearRect(0, 0, l, u), d.font = `${t * n}px ${r}`, d.fillStyle = "#ffffff", d.textBaseline = "top", d.textAlign = "left";
	for (let e = 0; e < a; e++) {
		let t = e % o, n = Math.floor(e / o), r = t * i, a = n * i;
		d.fillText(q[e], r, a);
	}
	let f = d.getImageData(0, 0, l, u).data, p = new Uint8Array(l * u);
	for (let e = 0; e < p.length; e++) p[e] = f[e * 4 + 3];
	return {
		data: p,
		width: l,
		height: u,
		gridCols: s,
		gridRows: c,
		glyphPx: i
	};
}
function Ot(e, t) {
	let n = e.createTexture();
	if (!n) throw Error("Failed to create letter atlas texture");
	return e.bindTexture(e.TEXTURE_2D, n), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), e.texImage2D(e.TEXTURE_2D, 0, e.R8, t.width, t.height, 0, e.RED, e.UNSIGNED_BYTE, t.data), n;
}
//#endregion
//#region src/core/rng.ts
function kt(e) {
	let t = e >>> 0;
	return function() {
		t |= 0, t = t + 1831565813 | 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
function At(e) {
	let t = e >>> 0;
	return function() {
		t = t + 1831565813 >>> 0;
		let e = Math.imul(t ^ t >>> 15, 1 | t);
		return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
}
//#endregion
//#region src/letters/textGlyphMap.ts
var jt = new Map(q.map((e, t) => [e, t])), Mt = {
	ç: "c",
	Ç: "C",
	ğ: "g",
	Ğ: "G",
	ı: "i",
	İ: "I",
	ö: "o",
	Ö: "O",
	ş: "s",
	Ş: "S",
	ü: "u",
	Ü: "U"
};
function Nt(e) {
	let t = jt.get(e);
	if (t !== void 0) return t;
	let n = Mt[e];
	return n ? jt.get(n) ?? -1 : -1;
}
function Pt(e) {
	let t = 2166136261;
	for (let n = 0; n < e.length; n++) t ^= e.charCodeAt(n), t = Math.imul(t, 16777619);
	return t >>> 0;
}
function Ft(e, t, n, r, i) {
	return [
		e,
		t,
		n,
		r,
		i
	].join("|");
}
function It(e, t, n, r, i) {
	let a = new Uint8Array(e * t * 4), o = new Uint8Array(e * t), s = r.replace(/\r/g, "").split("\n"), c = s.reduce((e, t) => Math.max(e, [...t].length), 0), l = [], u = 0, d = 0;
	if (s.forEach((e, t) => {
		let r = 0;
		for (let i of e) {
			let e = i === " " ? -1 : Nt(i), a = n === "horizontal" ? r : t, o = n === "horizontal" ? t : c - 1 - r;
			u = Math.max(u, a + 1), d = Math.max(d, o + 1), e >= 0 && l.push({
				col: a,
				row: o,
				glyphIndex: e
			}), r++;
		}
		e.length === 0 && (u = Math.max(u, n === "horizontal" ? 0 : t + 1), d = Math.max(d, n === "horizontal" ? t + 1 : 0));
	}), l.length > 0 && u > 0 && d > 0 && u <= e && d <= t) {
		let s = [];
		for (let n = 0; n <= t - d; n++) for (let t = 0; t <= e - u; t++) s.push({
			col: t,
			row: n
		});
		let c = At(Pt(Ft(e, t, n, i, r)));
		for (let e = s.length - 1; e > 0; e--) {
			let t = Math.floor(c() * (e + 1)), n = s[e];
			s[e] = s[t], s[t] = n;
		}
		let f = 0;
		for (let t of s) {
			if (f >= i) break;
			let n = !0;
			for (let r of l) if (o[(t.row + r.row) * e + t.col + r.col]) {
				n = !1;
				break;
			}
			if (n) {
				for (let n of l) {
					let r = t.col + n.col, i = (t.row + n.row) * e + r, s = i * 4;
					a[s] = n.glyphIndex + 1, a[s + 3] = 255, o[i] = 1;
				}
				f++;
			}
		}
	}
	return a;
}
//#endregion
//#region src/gl/dataTexture.ts
function Lt(e, t, n, r, i) {
	e.bindTexture(e.TEXTURE_2D, t), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA8, r, i, 0, e.RGBA, e.UNSIGNED_BYTE, n);
}
function Rt(e, t, n, r) {
	let i = e.createTexture();
	if (!i) throw Error("Failed to create data texture");
	return e.bindTexture(e.TEXTURE_2D, i), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), Lt(e, i, t, n, r), i;
}
function zt(e, t, n, r, i) {
	Lt(e, t, n, r, i);
}
//#endregion
//#region src/letters/letterResources.ts
function Bt(e) {
	let t = null, n = [1, 1], r = "", i = null, a = null, o = "";
	return {
		get atlasTex() {
			return t;
		},
		get atlasGrid() {
			return n;
		},
		get dummyTex() {
			return i;
		},
		ensureAtlas(a) {
			if (!t || r !== a) {
				t && e.deleteTexture(t);
				let i = Dt({ fontFamily: a });
				t = Ot(e, i), n = [i.gridCols, i.gridRows], r = a;
			}
			i ||= Rt(e, new Uint8Array(4), 1, 1);
		},
		ensureTextMap(t, n, r, i, s) {
			let c = Ft(t, n, r, s, i);
			if (a && o === c) return a;
			let l = It(t, n, r, i, s);
			return a ? zt(e, a, l, t, n) : a = Rt(e, l, t, n), o = c, a;
		},
		reset(n) {
			e = n, t = null, r = "", i = null, a = null, o = "";
		},
		dispose() {
			t &&= (e.deleteTexture(t), null), i &&= (e.deleteTexture(i), null), a &&= (e.deleteTexture(a), null);
		}
	};
}
//#endregion
//#region src/shaders/flames.vert.ts
var Vt = "#version 300 es\nprecision highp float;\nin vec4 aRect;\nin float aOpacity;\nin float aRot;\nuniform vec2 uCanvas;\nuniform float uVertical;\nout float vCross;\nout float vOpacity;\nvoid main() {\n  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));\n  vec2 halfSize = aRect.zw * 0.5;\n  vec2 local = (corner - 0.5) * aRect.zw;\n  float cs = cos(aRot);\n  float sn = sin(aRot);\n  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);\n  vec2 worldPx = aRect.xy + halfSize + rotated;\n  vec2 uv = worldPx / uCanvas;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);\n  vCross = (uVertical > 0.5) ? corner.x : corner.y;\n  vOpacity = aOpacity;\n}\n", Ht = "#version 300 es\nprecision highp float;\nin vec4 aRect;\nin float aOpacity;\nin float aRot;\nin vec3 aColor;\nuniform vec2 uCanvas;\nuniform float uVertical;\nout float vCross;\nout float vOpacity;\nout vec3 vColor;\nvoid main() {\n  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));\n  vec2 halfSize = aRect.zw * 0.5;\n  vec2 local = (corner - 0.5) * aRect.zw;\n  float cs = cos(aRot);\n  float sn = sin(aRot);\n  vec2 rotated = vec2(local.x * cs - local.y * sn, local.x * sn + local.y * cs);\n  vec2 worldPx = aRect.xy + halfSize + rotated;\n  vec2 uv = worldPx / uCanvas;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);\n  vCross = (uVertical > 0.5) ? corner.x : corner.y;\n  vOpacity = aOpacity;\n  vColor = aColor;\n}\n", Ut = "#version 300 es\nprecision highp float;\nin float vCross;\nin float vOpacity;\nuniform float uInner;\nuniform float uOuter;\nout vec4 finalColor;\nvoid main() {\n  float ramp = min(vCross / uInner, (1.0 - vCross) / (1.0 - uOuter));\n  float a = vOpacity * clamp(ramp, 0.0, 1.0);\n  finalColor = vec4(vec3(a), 1.0);\n}\n", Wt = "#version 300 es\nprecision highp float;\nin float vCross;\nin float vOpacity;\nin vec3 vColor;\nuniform float uInner;\nuniform float uOuter;\nout vec4 finalColor;\nvoid main() {\n  float ramp = min(vCross / uInner, (1.0 - vCross) / (1.0 - uOuter));\n  float a = vOpacity * clamp(ramp, 0.0, 1.0);\n  finalColor = vec4(vColor * a, a);\n}\n", Gt = 6, Kt = Gt * 4, qt = 9, Jt = qt * 4;
function Yt(e) {
	let t = P(e, Vt, Ut), n = P(e, Ht, Wt), r = e.createVertexArray(), i = e.createVertexArray(), a = e.createBuffer(), o = e.createBuffer();
	if (!r || !i || !a || !o) throw Error("Failed to create flames GL objects");
	let s = Kt;
	e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a);
	{
		let n = e.getAttribLocation(t, "aRect"), r = e.getAttribLocation(t, "aOpacity");
		e.enableVertexAttribArray(n), e.vertexAttribPointer(n, 4, e.FLOAT, !1, s, 0), e.vertexAttribDivisor(n, 1), e.enableVertexAttribArray(r), e.vertexAttribPointer(r, 1, e.FLOAT, !1, s, 16), e.vertexAttribDivisor(r, 1);
		let i = e.getAttribLocation(t, "aRot");
		e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 1, e.FLOAT, !1, s, 20), e.vertexAttribDivisor(i, 1);
	}
	let c = Jt;
	e.bindVertexArray(i), e.bindBuffer(e.ARRAY_BUFFER, o);
	{
		let t = e.getAttribLocation(n, "aRect"), r = e.getAttribLocation(n, "aOpacity"), i = e.getAttribLocation(n, "aColor");
		e.enableVertexAttribArray(t), e.vertexAttribPointer(t, 4, e.FLOAT, !1, c, 0), e.vertexAttribDivisor(t, 1), e.enableVertexAttribArray(r), e.vertexAttribPointer(r, 1, e.FLOAT, !1, c, 16), e.vertexAttribDivisor(r, 1);
		let a = e.getAttribLocation(n, "aRot");
		e.enableVertexAttribArray(a), e.vertexAttribPointer(a, 1, e.FLOAT, !1, c, 20), e.vertexAttribDivisor(a, 1), e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 3, e.FLOAT, !1, c, 24), e.vertexAttribDivisor(i, 1);
	}
	e.bindVertexArray(null), e.bindBuffer(e.ARRAY_BUFFER, null);
	let l = e.getUniformLocation(t, "uCanvas"), u = e.getUniformLocation(t, "uVertical"), d = e.getUniformLocation(t, "uInner"), f = e.getUniformLocation(t, "uOuter"), p = e.getUniformLocation(n, "uCanvas"), m = e.getUniformLocation(n, "uVertical"), h = e.getUniformLocation(n, "uInner"), g = e.getUniformLocation(n, "uOuter"), _ = new Float32Array(), v = new Float32Array();
	function y(e) {
		let t = e.length * Gt;
		_.length < t && (_ = new Float32Array(t));
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = t * Gt;
			_[r] = n.x, _[r + 1] = n.y, _[r + 2] = n.width, _[r + 3] = n.height, _[r + 4] = n.opacity, _[r + 5] = n.rot;
		}
		return t;
	}
	return {
		render(n, i, o) {
			if (i.length === 0) return;
			let s = y(i);
			z(e, n), e.useProgram(t), e.uniform2f(l, o.canvasW, o.canvasH), e.uniform1f(u, +!!o.vertical), e.uniform1f(d, o.inner), e.uniform1f(f, o.outer), e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a), e.bufferData(e.ARRAY_BUFFER, _.subarray(0, s), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, i.length), e.disable(e.BLEND), e.bindVertexArray(null);
		},
		renderColors(s, c, b, x, S) {
			if (b.length === 0) return;
			let C = Math.max(1, x.length), w = y(b);
			z(e, s), e.useProgram(t), e.uniform2f(l, S.canvasW, S.canvasH), e.uniform1f(u, +!!S.vertical), e.uniform1f(d, S.inner), e.uniform1f(f, S.outer), e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a), e.bufferData(e.ARRAY_BUFFER, _.subarray(0, w), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, b.length), e.bindVertexArray(null);
			let T = b.length * qt;
			v.length < T && (v = new Float32Array(T));
			for (let e = 0; e < b.length; e++) {
				let t = b[e], n = e * qt, r = x[Math.min(C - 1, Math.floor(t.colorSeed * C))];
				v[n] = t.x, v[n + 1] = t.y, v[n + 2] = t.width, v[n + 3] = t.height, v[n + 4] = t.opacity, v[n + 5] = t.rot, v[n + 6] = r.r / 255, v[n + 7] = r.g / 255, v[n + 8] = r.b / 255;
			}
			z(e, c), e.useProgram(n), e.uniform2f(p, S.canvasW, S.canvasH), e.uniform1f(m, +!!S.vertical), e.uniform1f(h, S.inner), e.uniform1f(g, S.outer), e.bindVertexArray(i), e.bindBuffer(e.ARRAY_BUFFER, o), e.bufferData(e.ARRAY_BUFFER, v.subarray(0, T), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.drawArraysInstanced(e.TRIANGLES, 0, 6, b.length), e.blendFunc(e.ONE, e.ONE), e.disable(e.BLEND), e.bindVertexArray(null);
		},
		dispose() {
			e.deleteProgram(t), e.deleteProgram(n), e.deleteVertexArray(r), e.deleteVertexArray(i), e.deleteBuffer(a), e.deleteBuffer(o);
		}
	};
}
//#endregion
//#region src/shaders/stars.vert.ts
var Xt = "#version 300 es\nprecision highp float;\nin vec4 aRect;\nin float aOpacity;\nin float aTilt;\nuniform vec2 uCanvas;\nout vec2 vLocal;\nout float vOpacity;\nout float vTilt;\nvoid main() {\n  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));\n  vec2 worldPx = aRect.xy + corner * aRect.zw;\n  vec2 uv = worldPx / uCanvas;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);\n  vLocal = corner;\n  vOpacity = aOpacity;\n  vTilt = aTilt;\n}\n", Zt = "#version 300 es\nprecision highp float;\nin vec4 aRect;\nin float aOpacity;\nin float aTilt;\nin vec3 aColor;\nuniform vec2 uCanvas;\nout vec2 vLocal;\nout float vOpacity;\nout float vTilt;\nout vec3 vColor;\nvoid main() {\n  vec2 corner = vec2(float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5), float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5));\n  vec2 worldPx = aRect.xy + corner * aRect.zw;\n  vec2 uv = worldPx / uCanvas;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);\n  vLocal = corner;\n  vOpacity = aOpacity;\n  vTilt = aTilt;\n  vColor = aColor;\n}\n", Qt = "float starShape(vec2 local) {\n  vec2 p = local * 2.0 - 1.0;\n  float shear = tan(clamp(vTilt, -1.35, 1.35));\n  p.x -= p.y * shear;\n  float dist = length(p);\n  float core = smoothstep(0.24, 0.0, dist);\n  float hRay = exp(-abs(p.y) * 34.0) * smoothstep(1.0, 0.0, abs(p.x));\n  float vRay = exp(-abs(p.x) * 34.0) * smoothstep(1.0, 0.0, abs(p.y));\n  float diamond = smoothstep(0.58, 0.0, abs(p.x) + abs(p.y));\n  return clamp(max(core, max(hRay, vRay) * 0.88 + diamond * 0.42), 0.0, 1.0);\n}", $t = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vOpacity;
in float vTilt;
out vec4 finalColor;

${Qt}

void main() {
  float a = clamp(starShape(vLocal) * vOpacity, 0.0, 1.0);
  finalColor = vec4(vec3(a), 1.0);
}
`, en = `#version 300 es
precision highp float;
in vec2 vLocal;
in float vOpacity;
in float vTilt;
in vec3 vColor;
out vec4 finalColor;

${Qt}

void main() {
  float a = clamp(starShape(vLocal) * vOpacity, 0.0, 1.0);
  finalColor = vec4(vColor * a, a);
}
`, tn = 8, nn = 6, rn = nn * 4, an = 9, on = an * 4;
function sn(e) {
	let t = P(e, Xt, $t), n = P(e, Zt, en), r = e.createVertexArray(), i = e.createVertexArray(), a = e.createBuffer(), o = e.createBuffer();
	if (!r || !i || !a || !o) throw Error("Failed to create background stars GL objects");
	let s = rn;
	e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a);
	{
		let n = e.getAttribLocation(t, "aRect"), r = e.getAttribLocation(t, "aOpacity"), i = e.getAttribLocation(t, "aTilt");
		e.enableVertexAttribArray(n), e.vertexAttribPointer(n, 4, e.FLOAT, !1, s, 0), e.vertexAttribDivisor(n, 1), e.enableVertexAttribArray(r), e.vertexAttribPointer(r, 1, e.FLOAT, !1, s, 16), e.vertexAttribDivisor(r, 1), e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 1, e.FLOAT, !1, s, 20), e.vertexAttribDivisor(i, 1);
	}
	let c = on;
	e.bindVertexArray(i), e.bindBuffer(e.ARRAY_BUFFER, o);
	{
		let t = e.getAttribLocation(n, "aRect"), r = e.getAttribLocation(n, "aOpacity"), i = e.getAttribLocation(n, "aTilt"), a = e.getAttribLocation(n, "aColor");
		e.enableVertexAttribArray(t), e.vertexAttribPointer(t, 4, e.FLOAT, !1, c, 0), e.vertexAttribDivisor(t, 1), e.enableVertexAttribArray(r), e.vertexAttribPointer(r, 1, e.FLOAT, !1, c, 16), e.vertexAttribDivisor(r, 1), e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 1, e.FLOAT, !1, c, 20), e.vertexAttribDivisor(i, 1), e.enableVertexAttribArray(a), e.vertexAttribPointer(a, 3, e.FLOAT, !1, c, 24), e.vertexAttribDivisor(a, 1);
	}
	e.bindVertexArray(null), e.bindBuffer(e.ARRAY_BUFFER, null);
	let l = e.getUniformLocation(t, "uCanvas"), u = e.getUniformLocation(n, "uCanvas"), d = new Float32Array(), f = new Float32Array();
	function p(e) {
		let t = e.length * nn;
		d.length < t && (d = new Float32Array(t));
		for (let t = 0; t < e.length; t++) {
			let n = e[t], r = Math.max(.001, n.sizePx * n.scale * tn), i = t * nn;
			d[i] = n.x - r * .5, d[i + 1] = n.y - r * .5, d[i + 2] = r, d[i + 3] = r, d[i + 4] = n.opacity, d[i + 5] = n.tiltRad;
		}
		return t;
	}
	return {
		render(n, i, o) {
			if (i.length === 0) return;
			let s = p(i);
			z(e, n), e.useProgram(t), e.uniform2f(l, o.canvasW, o.canvasH), e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a), e.bufferData(e.ARRAY_BUFFER, d.subarray(0, s), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, i.length), e.disable(e.BLEND), e.bindVertexArray(null);
		},
		renderColors(s, c, m, h, g) {
			if (m.length === 0) return;
			let _ = Math.max(1, h.length), v = p(m);
			z(e, s), e.useProgram(t), e.uniform2f(l, g.canvasW, g.canvasH), e.bindVertexArray(r), e.bindBuffer(e.ARRAY_BUFFER, a), e.bufferData(e.ARRAY_BUFFER, d.subarray(0, v), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, m.length), e.bindVertexArray(null);
			let y = m.length * an;
			f.length < y && (f = new Float32Array(y));
			let [b, x, S] = V(g.color);
			for (let e = 0; e < m.length; e++) {
				let t = m[e], n = Math.max(.001, t.sizePx * t.scale * tn), r = e * an, i = h[Math.min(_ - 1, Math.floor(t.colorSeed * _))];
				f[r] = t.x - n * .5, f[r + 1] = t.y - n * .5, f[r + 2] = n, f[r + 3] = n, f[r + 4] = t.opacity, f[r + 5] = t.tiltRad, f[r + 6] = i ? i.r / 255 : b, f[r + 7] = i ? i.g / 255 : x, f[r + 8] = i ? i.b / 255 : S;
			}
			z(e, c), e.useProgram(n), e.uniform2f(u, g.canvasW, g.canvasH), e.bindVertexArray(i), e.bindBuffer(e.ARRAY_BUFFER, o), e.bufferData(e.ARRAY_BUFFER, f.subarray(0, y), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE_MINUS_SRC_ALPHA), e.drawArraysInstanced(e.TRIANGLES, 0, 6, m.length), e.blendFunc(e.ONE, e.ONE), e.disable(e.BLEND), e.bindVertexArray(null);
		},
		dispose() {
			e.deleteProgram(t), e.deleteProgram(n), e.deleteVertexArray(r), e.deleteVertexArray(i), e.deleteBuffer(a), e.deleteBuffer(o);
		}
	};
}
//#endregion
//#region src/passes/particleFieldPass.ts
function cn(e) {
	return {
		name: e.name,
		render: () => {
			let { particles: t, opts: n } = e.step(), r = e.getFieldRT();
			e.colorsMode ? e.pass.renderColors(r, e.getFieldColorRT(), t, e.getPalette(), n) : e.pass.render(r, t, n);
		},
		dispose: () => e.pass.dispose()
	};
}
//#endregion
//#region src/core/math.ts
function J(e, t, n) {
	return e + (t - e) * n;
}
function ln(e, t, n) {
	let r = Math.min(1, Math.max(0, (n - e) / (t - e)));
	return r * r * (3 - 2 * r);
}
//#endregion
//#region src/stars/starsSim.ts
function un(e) {
	return {
		stars: [],
		lastStepMs: 0,
		random: e
	};
}
function dn(e, t) {
	let n = Math.min(100, Math.max(0, e.density)) / 100;
	if (!e.enabled || n <= 0 || e.opacity <= 0 || e.sizePx <= 0) return 0;
	let r = Math.max(1, t.width * t.height / 8e3);
	return Math.min(360, Math.max(1, Math.round((4 + r * 1.9) * n)));
}
function fn(e, t, n, r, i) {
	let a = Math.min(1, Math.max(0, t.sizeRandomness)), o = J(1 - a, 1 + a, e.random()), s = Math.max(.05, t.twinkleSpeed), c = J(750, 2200, e.random()) / s, l = i ? r - e.random() * c : r;
	return {
		x: e.random() * n.width,
		y: e.random() * n.height,
		sizePx: Math.max(.25, t.sizePx * Math.max(.12, o)),
		scale: 0,
		tiltRad: 0,
		bornMs: l,
		lifeMs: c,
		phase: e.random() * Math.PI * 2,
		colorSeed: e.random(),
		baseOpacity: J(.55, 1, e.random()),
		opacity: 0
	};
}
function pn(e, t, n) {
	let r = n - e.bornMs;
	if (r < 0 || r >= e.lifeMs) return !1;
	let i = r / e.lifeMs, a = ln(0, .28, i) * (1 - ln(.62, 1, i)), o = ln(0, .18, i) * (1 - ln(.72, 1, i)), s = Math.max(0, t.twinkleSpeed), c = .5 + .5 * Math.sin(n / 1e3 * s * Math.PI * 2 + e.phase), l = Math.min(1, Math.max(0, t.twinkleAmount)), u = J(1, .78 + .22 * c, l), d = J(1, .65 + .35 * c, l), f = Math.min(89, Math.max(-89, t.tiltAngleDeg)) * Math.PI / 180;
	return e.scale = Math.min(1, Math.max(0, a * u)), e.tiltRad = f, e.opacity = Math.min(1, Math.max(0, t.opacity * e.baseOpacity * o * d)), e.scale > .001 && e.opacity > .001 || i < .96;
}
function mn(e, t, n, r) {
	if (!t.enabled || n.width <= 0 || n.height <= 0) {
		e.stars.length = 0, e.lastStepMs = r;
		return;
	}
	let i = dn(t, n);
	if (i <= 0) {
		e.stars.length = 0, e.lastStepMs = r;
		return;
	}
	let a = e.lastStepMs <= 0;
	for (e.lastStepMs = r, e.stars = e.stars.filter((e) => pn(e, t, r)), e.stars.length > i && (e.stars.length = i); e.stars.length < i;) {
		let i = fn(e, t, n, r, a);
		pn(i, t, r), e.stars.push(i);
	}
}
//#endregion
//#region src/shaders/edgeMask.frag.ts
var hn = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform float uStart;\nuniform float uEnd;\nuniform float uPower;\nuniform vec4 uSides;\nout vec4 finalColor;\n\nfloat ramp(float inset, float side) {\n  float t = clamp((inset - uStart) / (uEnd - uStart), 0.0, 1.0);\n  return mix(1.0, pow(t, uPower), side);\n}\n\nvoid main() {\n  vec4 insets = vec4(vUv.x, 1.0 - vUv.x, vUv.y, 1.0 - vUv.y);\n  float a =\n    ramp(insets.x, uSides.x) *\n    ramp(insets.y, uSides.y) *\n    ramp(insets.z, uSides.z) *\n    ramp(insets.w, uSides.w);\n  finalColor = vec4(texture(uField, vUv).rgb * a, 1.0);\n}\n";
//#endregion
//#region src/passes/edgeMaskPass.ts
function gn(e, t) {
	let n = P(e, B, hn), r = e.getUniformLocation(n, "uField"), i = e.getUniformLocation(n, "uStart"), a = e.getUniformLocation(n, "uEnd"), o = e.getUniformLocation(n, "uPower"), s = e.getUniformLocation(n, "uSides");
	return {
		render(c, l, u) {
			z(e, c), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, l), e.uniform1i(r, 0), e.uniform1f(i, u.start), e.uniform1f(a, u.end), e.uniform1f(o, u.power), e.uniform4f(s, +!!u.sides.left, +!!u.sides.right, +!!u.sides.bottom, +!!u.sides.top), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/cursorSplat.vert.ts
var _n = "#version 300 es\nprecision highp float;\nin vec2 aCenterCell;\nin float aBrightenRadiusCell;\nin vec2 aPushCenterCell;\nin float aPushRadiusCell;\nin float aAlpha;\nin float aProgress;\nin float aSeed;\nuniform vec2 uGridSize;\nout vec2 vCenterCell;\nout float vBrightenRadiusCell;\nout vec2 vPushCenterCell;\nout float vPushRadiusCell;\nout float vAlpha;\nout float vProgress;\nout float vSeed;\nvoid main() {\n  vec2 corner = vec2(\n    float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5),\n    float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5)\n  );\n  float reachCell = max(aBrightenRadiusCell, aPushRadiusCell) + 1.0;\n  vec2 quadOriginCell = aCenterCell - reachCell;\n  vec2 quadSizeCell = vec2(reachCell * 2.0);\n  vec2 cell = quadOriginCell + corner * quadSizeCell;\n  vec2 uv = cell / uGridSize;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);\n  vCenterCell = aCenterCell;\n  vBrightenRadiusCell = aBrightenRadiusCell;\n  vPushCenterCell = aPushCenterCell;\n  vPushRadiusCell = aPushRadiusCell;\n  vAlpha = aAlpha;\n  vProgress = aProgress;\n  vSeed = aSeed;\n}\n", vn = "#version 300 es\nprecision highp float;\nin vec2 vCenterCell;\nin float vBrightenRadiusCell;\nin vec2 vPushCenterCell;\nin float vPushRadiusCell;\nin float vAlpha;\nin float vProgress;\nin float vSeed;\nuniform vec2 uGridSize;\nuniform float uPushScale;\nout vec4 finalColor;\n\nfloat falloff(float distance, float radius) {\n  if (radius <= 0.0 || distance >= radius) {\n    return 0.0;\n  }\n  float t = 1.0 - distance / radius;\n  return t * t * (3.0 - 2.0 * t);\n}\n\nfloat clickSeededUnit(float seed, float salt) {\n  float x = sin(seed * 12.9898 + salt * 78.233) * 43758.5453;\n  return x - floor(x);\n}\n\nfloat clickDissolveProgress(float waveProgress) {\n  float t = clamp((waveProgress - 0.4) / 0.6, 0.0, 1.0);\n  return t * t * (3.0 - 2.0 * t);\n}\n\nbool clickCellDissolved(float seed, float cellIdx, float dissolve) {\n  return dissolve > 0.0 && clickSeededUnit(seed, cellIdx * 7.13 + 3.7) < dissolve;\n}\n\nvoid main() {\n  vec2 cell = floor(gl_FragCoord.xy);\n  float cellIdx = cell.y * uGridSize.x + cell.x;\n\n  float dissolve = clickDissolveProgress(vProgress);\n  if (clickCellDissolved(vSeed, cellIdx, dissolve)) {\n    discard;\n  }\n\n  float distC = length(cell - vCenterCell);\n  float brighten = vAlpha * falloff(distC, vBrightenRadiusCell);\n\n  vec2 toCell = cell - vPushCenterCell;\n  float distP = length(toCell);\n  float pushX = 0.0;\n  float pushY = 0.0;\n  if (distP > 0.0 && distP < vPushRadiusCell) {\n    float force = uPushScale * vAlpha * falloff(distP, vPushRadiusCell);\n    vec2 dir = toCell / distP;\n    pushX = force * dir.x;\n    pushY = force * dir.y;\n  }\n\n  if (brighten <= 0.0 && pushX == 0.0 && pushY == 0.0) {\n    discard;\n  }\n\n  finalColor = vec4(brighten, pushX, pushY, 0.0);\n}\n", yn = 9, bn = yn * 4;
function xn(e) {
	return Math.max(0, Math.min(1, e));
}
function Sn(e) {
	let t = P(e, _n, vn), n = e.createVertexArray();
	if (!n) throw Error("Failed to create VAO");
	let r = e.createBuffer();
	if (!r) throw Error("Failed to create instance buffer");
	let i = e.getAttribLocation(t, "aCenterCell"), a = e.getAttribLocation(t, "aBrightenRadiusCell"), o = e.getAttribLocation(t, "aPushCenterCell"), s = e.getAttribLocation(t, "aPushRadiusCell"), c = e.getAttribLocation(t, "aAlpha"), l = e.getAttribLocation(t, "aProgress"), u = e.getAttribLocation(t, "aSeed"), d = e.getUniformLocation(t, "uGridSize"), f = e.getUniformLocation(t, "uPushScale");
	e.bindVertexArray(n), e.bindBuffer(e.ARRAY_BUFFER, r), e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 2, e.FLOAT, !1, bn, 0), e.vertexAttribDivisor(i, 1), e.enableVertexAttribArray(a), e.vertexAttribPointer(a, 1, e.FLOAT, !1, bn, 8), e.vertexAttribDivisor(a, 1), e.enableVertexAttribArray(o), e.vertexAttribPointer(o, 2, e.FLOAT, !1, bn, 12), e.vertexAttribDivisor(o, 1), e.enableVertexAttribArray(s), e.vertexAttribPointer(s, 1, e.FLOAT, !1, bn, 20), e.vertexAttribDivisor(s, 1), e.enableVertexAttribArray(c), e.vertexAttribPointer(c, 1, e.FLOAT, !1, bn, 24), e.vertexAttribDivisor(c, 1), e.enableVertexAttribArray(l), e.vertexAttribPointer(l, 1, e.FLOAT, !1, bn, 28), e.vertexAttribDivisor(l, 1), e.enableVertexAttribArray(u), e.vertexAttribPointer(u, 1, e.FLOAT, !1, bn, 32), e.vertexAttribDivisor(u, 1), e.bindVertexArray(null), e.bindBuffer(e.ARRAY_BUFFER, null);
	let p = new Float32Array();
	return {
		render(i, a, o) {
			if (z(e, i), e.clearColor(0, 0, 0, 0), e.clear(e.COLOR_BUFFER_BIT), a.length === 0) return;
			let s = o.displayWidth > 0 ? o.cols / o.displayWidth : 1, c = o.displayHeight > 0 ? o.rows / o.displayHeight : 1, l = o.displayWidth > 0 ? o.cols / o.displayWidth : 1, u = a.length * yn;
			p.length < u && (p = new Float32Array(u));
			let m = 0;
			for (let e = 0; e < a.length; e++) {
				let t = a[e], n = xn(t.alpha);
				if (n <= 0) continue;
				let r = Math.max(1, t.radius * l), i = Math.max(1, t.radius * o.pushRadiusScale * l), u = m * yn;
				p[u] = t.x * s, p[u + 1] = t.y * c, p[u + 2] = r, p[u + 3] = t.pushX * s, p[u + 4] = t.pushY * c, p[u + 5] = i, p[u + 6] = n, p[u + 7] = t.progress, p[u + 8] = t.seed, m++;
			}
			e.useProgram(t), e.uniform2f(d, o.cols, o.rows), e.uniform1f(f, o.pushScale), e.bindVertexArray(n), e.bindBuffer(e.ARRAY_BUFFER, r), e.bufferData(e.ARRAY_BUFFER, p.subarray(0, m * yn), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, m), e.disable(e.BLEND), e.bindVertexArray(null);
		},
		dispose() {
			e.deleteProgram(t), e.deleteVertexArray(n), e.deleteBuffer(r);
		}
	};
}
//#endregion
//#region src/shaders/cursorTear.frag.ts
var Cn = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uAccum;\nuniform vec2 uTexel;\nuniform float uTearStrength;\nuniform float uPushCap;\nout vec4 finalColor;\n\nvec2 capPush(vec2 p, float cap) {\n  float L = length(p);\n  return L > cap ? p * (cap / L) : p;\n}\n\nvoid main() {\n  vec2 pushRight = capPush(texture(uAccum, vUv + vec2(uTexel.x, 0.0)).gb, uPushCap);\n  vec2 pushLeft = capPush(texture(uAccum, vUv - vec2(uTexel.x, 0.0)).gb, uPushCap);\n  vec2 pushDown = capPush(texture(uAccum, vUv + vec2(0.0, uTexel.y)).gb, uPushCap);\n  vec2 pushUp = capPush(texture(uAccum, vUv - vec2(0.0, uTexel.y)).gb, uPushCap);\n\n  float divergence = (pushRight.x - pushLeft.x) + (pushDown.y - pushUp.y);\n  float tear = clamp(uTearStrength * max(0.0, divergence), 0.0, 1.0);\n\n  finalColor = vec4(tear, 0.0, 0.0, 1.0);\n}\n", wn = .6;
function Tn(e, t) {
	let n = P(e, B, Cn), r = e.getUniformLocation(n, "uAccum"), i = e.getUniformLocation(n, "uTexel"), a = e.getUniformLocation(n, "uTearStrength"), o = e.getUniformLocation(n, "uPushCap");
	return {
		render(s, c, l) {
			z(e, s), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, c), e.uniform1i(r, 0), e.uniform2f(i, l.cols > 0 ? 1 / l.cols : 0, l.rows > 0 ? 1 / l.rows : 0), e.uniform1f(a, wn), e.uniform1f(o, l.pushCap), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/cursorWarp.frag.ts
var En = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uField;\nuniform sampler2D uAccum;\nuniform sampler2D uTear;\nuniform vec2 uPixelSize;\nuniform vec2 uCellSize;\nuniform vec2 uGridSize;\nuniform float uPushCap;\nout vec4 finalColor;\n\nvec2 capPush(vec2 p, float cap) {\n  float L = length(p);\n  return L > cap ? p * (cap / L) : p;\n}\n\nvoid main() {\n  vec2 pixelCoord = vec2(vUv.x, 1.0 - vUv.y) * uPixelSize;\n  float colIndex = floor(pixelCoord.x / max(uCellSize.x, 1.0));\n  float rowIndex = floor(pixelCoord.y / max(uCellSize.y, 1.0));\n  vec2 cuv = vec2((colIndex + 0.5) / max(uGridSize.x, 1.0), (rowIndex + 0.5) / max(uGridSize.y, 1.0));\n\n  vec4 accum = texture(uAccum, cuv);\n  float brighten = accum.r;\n  vec2 pushCells = capPush(accum.gb, uPushCap);\n  float tear = texture(uTear, cuv).r;\n\n  vec2 offsetUv = pushCells * uCellSize / uPixelSize;\n  offsetUv.y = -offsetUv.y;\n  float field = texture(uField, vUv - offsetUv).r;\n  field *= (1.0 - tear);\n  field += (1.0 - field) * brighten;\n\n  finalColor = vec4(vec3(clamp(field, 0.0, 1.0)), 1.0);\n}\n", Dn = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uFieldColor;\nuniform sampler2D uAccum;\nuniform sampler2D uTear;\nuniform vec2 uPixelSize;\nuniform vec2 uCellSize;\nuniform vec2 uGridSize;\nuniform float uPushCap;\nuniform vec3 uTrailColor;\nout vec4 finalColor;\n\nvec2 capPush(vec2 p, float cap) {\n  float L = length(p);\n  return L > cap ? p * (cap / L) : p;\n}\n\nvoid main() {\n  vec2 pixelCoord = vec2(vUv.x, 1.0 - vUv.y) * uPixelSize;\n  float colIndex = floor(pixelCoord.x / max(uCellSize.x, 1.0));\n  float rowIndex = floor(pixelCoord.y / max(uCellSize.y, 1.0));\n  vec2 cuv = vec2((colIndex + 0.5) / max(uGridSize.x, 1.0), (rowIndex + 0.5) / max(uGridSize.y, 1.0));\n\n  vec4 accum = texture(uAccum, cuv);\n  float brighten = clamp(accum.r, 0.0, 1.0);\n  vec2 pushCells = capPush(accum.gb, uPushCap);\n  float tear = texture(uTear, cuv).r;\n\n  vec2 offsetUv = pushCells * uCellSize / uPixelSize;\n  offsetUv.y = -offsetUv.y;\n  vec4 c = texture(uFieldColor, vUv - offsetUv);\n  float cov = c.a * (1.0 - tear);\n  cov += (1.0 - cov) * brighten;\n  vec3 rgb = mix(c.rgb, uTrailColor, brighten);\n  finalColor = vec4(rgb, clamp(cov, 0.0, 1.0));\n}\n";
//#endregion
//#region src/passes/cursorWarpPass.ts
function On(e, t) {
	let n = P(e, B, En), r = e.getUniformLocation(n, "uField"), i = e.getUniformLocation(n, "uAccum"), a = e.getUniformLocation(n, "uTear"), o = e.getUniformLocation(n, "uPixelSize"), s = e.getUniformLocation(n, "uCellSize"), c = e.getUniformLocation(n, "uGridSize"), l = e.getUniformLocation(n, "uPushCap"), u = P(e, B, Dn), d = e.getUniformLocation(u, "uFieldColor"), f = e.getUniformLocation(u, "uAccum"), p = e.getUniformLocation(u, "uTear"), m = e.getUniformLocation(u, "uPixelSize"), h = e.getUniformLocation(u, "uCellSize"), g = e.getUniformLocation(u, "uGridSize"), _ = e.getUniformLocation(u, "uPushCap"), v = e.getUniformLocation(u, "uTrailColor");
	function y(n, r, i, a, o, s, c, l) {
		z(e, i), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(r.field, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(r.accum, 1), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, s), e.uniform1i(r.tear, 2), e.uniform2f(r.pixelSize, c.pixelW, c.pixelH), e.uniform2f(r.cellSize, c.cellW, c.cellH), e.uniform2f(r.gridSize, c.cols, c.rows), e.uniform1f(r.pushCap, c.pushCap), l && r.trailColor && e.uniform3f(r.trailColor, l[0], l[1], l[2]), t.draw(), e.activeTexture(e.TEXTURE0);
	}
	return {
		render(e, t, u, d, f) {
			y(n, {
				field: r,
				accum: i,
				tear: a,
				pixelSize: o,
				cellSize: s,
				gridSize: c,
				pushCap: l
			}, e, t, u, d, f);
		},
		renderColor(e, t, n, r, i, a) {
			y(u, {
				field: d,
				accum: f,
				tear: p,
				pixelSize: m,
				cellSize: h,
				gridSize: g,
				pushCap: _,
				trailColor: v
			}, e, t, n, r, i, a);
		},
		dispose() {
			e.deleteProgram(n), e.deleteProgram(u);
		}
	};
}
//#endregion
//#region src/shaders/clickSplat.vert.ts
var kn = "#version 300 es\nprecision highp float;\nin vec2 aCenterCell;\nin float aRadiusCell;\nin float aHalfStrokeCell;\nin float aPushBandCell;\nin float aPushPeak;\nin float aWhiteAmt;\nin float aProgress;\nin float aSeed;\nuniform vec2 uGridSize;\nout vec2 vCenterCell;\nout float vRadiusCell;\nout float vHalfStrokeCell;\nout float vPushBandCell;\nout float vPushPeak;\nout float vWhiteAmt;\nout float vProgress;\nout float vSeed;\nout float vWobbleAmplitude;\nvoid main() {\n  vec2 corner = vec2(\n    float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5),\n    float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5)\n  );\n  float wobbleAmplitude = max(1.0, aRadiusCell * 0.18);\n  float reachCell = aRadiusCell + max(aHalfStrokeCell, aPushBandCell) + wobbleAmplitude + 1.0;\n  vec2 quadOriginCell = aCenterCell - reachCell;\n  vec2 quadSizeCell = vec2(reachCell * 2.0);\n  vec2 cell = quadOriginCell + corner * quadSizeCell;\n  vec2 uv = cell / uGridSize;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, uv.y * 2.0 - 1.0, 0.0, 1.0);\n  vCenterCell = aCenterCell;\n  vRadiusCell = aRadiusCell;\n  vHalfStrokeCell = aHalfStrokeCell;\n  vPushBandCell = aPushBandCell;\n  vPushPeak = aPushPeak;\n  vWhiteAmt = aWhiteAmt;\n  vProgress = aProgress;\n  vSeed = aSeed;\n  vWobbleAmplitude = wobbleAmplitude;\n}\n", An = "#version 300 es\nprecision highp float;\nin vec2 vCenterCell;\nin float vRadiusCell;\nin float vHalfStrokeCell;\nin float vPushBandCell;\nin float vPushPeak;\nin float vWhiteAmt;\nin float vProgress;\nin float vSeed;\nin float vWobbleAmplitude;\nuniform vec2 uGridSize;\nout vec4 finalColor;\n\nfloat clamp01(float v) {\n  return clamp(v, 0.0, 1.0);\n}\n\nfloat falloff(float distance, float radius) {\n  if (radius <= 0.0 || distance >= radius) {\n    return 0.0;\n  }\n  float t = 1.0 - distance / radius;\n  return t * t * (3.0 - 2.0 * t);\n}\n\nfloat clickSeededUnit(float seed, float salt) {\n  float x = sin(seed * 12.9898 + salt * 78.233) * 43758.5453;\n  return x - floor(x);\n}\n\nfloat clickRadiusWobble(float seed, float angle, float progress, float amplitude) {\n  float spin = progress * 6.28318530718;\n  return amplitude * (\n    sin(angle * 3.0 + seed * 0.71 + spin * 0.35) * 0.38 +\n    sin(angle * 6.0 + seed * 1.19 - spin * 0.55) * 0.32 +\n    sin(angle * 11.0 + seed * 2.07 + spin) * 0.22\n  );\n}\n\nfloat clickStrengthBreakup(float seed, float x, float y, float jitter) {\n  if (jitter <= 0.0) {\n    return 1.0;\n  }\n  float n1 = clickSeededUnit(seed, x * 0.17 + y * 0.23);\n  float n2 = clickSeededUnit(seed, x * 0.41 + y * 0.09 + seed * 0.13);\n  float density = n1 * n2;\n  return 1.0 - jitter * (1.0 - density);\n}\n\nfloat clickFade(float waveProgress) {\n  float t = clamp((waveProgress - 0.8) / 0.2, 0.0, 1.0);\n  return 1.0 - t * t * (3.0 - 2.0 * t);\n}\n\nconst float CLICK_BREAKUP_JITTER = 0.25;\nconst float CLICK_INTERIOR_FILL = 0.5;\n\nvoid main() {\n  vec2 cell = floor(gl_FragCoord.xy);\n  float waveFade = clickFade(vProgress);\n\n  float dx = cell.x - vCenterCell.x;\n  float dy = cell.y - vCenterCell.y;\n  float distance = sqrt(dx * dx + dy * dy);\n  float angle = atan(dy, dx);\n\n  float brighten = 0.0;\n  if (vWhiteAmt > 0.0 && vRadiusCell > 0.0) {\n    float frontRadius = vRadiusCell + clickRadiusWobble(vSeed, angle, vProgress, vWobbleAmplitude);\n    float breakup = clickStrengthBreakup(vSeed, cell.x, cell.y, CLICK_BREAKUP_JITTER);\n    float fromFront = distance - frontRadius;\n    float radial;\n    if (fromFront > vHalfStrokeCell) {\n      radial = 0.0;\n    } else if (fromFront > 0.0) {\n      radial = falloff(fromFront, vHalfStrokeCell);\n    } else {\n      float interiorT = clamp01(distance / max(0.0001, frontRadius));\n      radial = CLICK_INTERIOR_FILL + (1.0 - CLICK_INTERIOR_FILL) * interiorT;\n    }\n    brighten = clamp01(vWhiteAmt * waveFade * breakup * radial);\n  }\n\n  float pushX = 0.0;\n  float pushY = 0.0;\n  if (vPushPeak > 0.0 && vRadiusCell > 0.0 && distance > 0.0) {\n    float reach = vRadiusCell + vWobbleAmplitude + vPushBandCell;\n    if (distance < reach) {\n      float frontRadius = max(0.5, vRadiusCell + clickRadiusWobble(vSeed, angle, vProgress, vWobbleAmplitude));\n      float w;\n      if (distance <= frontRadius) {\n        float t = distance / frontRadius;\n        w = t * t * (3.0 - 2.0 * t);\n      } else {\n        w = falloff(distance - frontRadius, vPushBandCell);\n      }\n      float force = vPushPeak * waveFade * w;\n      if (force > 0.0) {\n        pushX = (dx / distance) * force;\n        pushY = (dy / distance) * force;\n      }\n    }\n  }\n\n  if (brighten <= 0.0 && pushX == 0.0 && pushY == 0.0) {\n    discard;\n  }\n\n  finalColor = vec4(brighten, pushX, pushY, 0.0);\n}\n", jn = 9, Y = jn * 4;
function Mn(e) {
	let t = P(e, kn, An), n = e.createVertexArray();
	if (!n) throw Error("Failed to create VAO");
	let r = e.createBuffer();
	if (!r) throw Error("Failed to create instance buffer");
	let i = e.getAttribLocation(t, "aCenterCell"), a = e.getAttribLocation(t, "aRadiusCell"), o = e.getAttribLocation(t, "aHalfStrokeCell"), s = e.getAttribLocation(t, "aPushBandCell"), c = e.getAttribLocation(t, "aPushPeak"), l = e.getAttribLocation(t, "aWhiteAmt"), u = e.getAttribLocation(t, "aProgress"), d = e.getAttribLocation(t, "aSeed"), f = e.getUniformLocation(t, "uGridSize");
	e.bindVertexArray(n), e.bindBuffer(e.ARRAY_BUFFER, r), e.enableVertexAttribArray(i), e.vertexAttribPointer(i, 2, e.FLOAT, !1, Y, 0), e.vertexAttribDivisor(i, 1), e.enableVertexAttribArray(a), e.vertexAttribPointer(a, 1, e.FLOAT, !1, Y, 8), e.vertexAttribDivisor(a, 1), e.enableVertexAttribArray(o), e.vertexAttribPointer(o, 1, e.FLOAT, !1, Y, 12), e.vertexAttribDivisor(o, 1), e.enableVertexAttribArray(s), e.vertexAttribPointer(s, 1, e.FLOAT, !1, Y, 16), e.vertexAttribDivisor(s, 1), e.enableVertexAttribArray(c), e.vertexAttribPointer(c, 1, e.FLOAT, !1, Y, 20), e.vertexAttribDivisor(c, 1), e.enableVertexAttribArray(l), e.vertexAttribPointer(l, 1, e.FLOAT, !1, Y, 24), e.vertexAttribDivisor(l, 1), e.enableVertexAttribArray(u), e.vertexAttribPointer(u, 1, e.FLOAT, !1, Y, 28), e.vertexAttribDivisor(u, 1), e.enableVertexAttribArray(d), e.vertexAttribPointer(d, 1, e.FLOAT, !1, Y, 32), e.vertexAttribDivisor(d, 1), e.bindVertexArray(null), e.bindBuffer(e.ARRAY_BUFFER, null);
	let p = new Float32Array();
	return {
		render(i, a, o) {
			if (a.length === 0) return;
			let s = o.displayWidth > 0 ? o.cols / o.displayWidth : 1, c = o.displayHeight > 0 ? o.rows / o.displayHeight : 1, l = o.displayWidth > 0 ? o.cols / o.displayWidth : 1, u = a.length * jn;
			p.length < u && (p = new Float32Array(u));
			let d = 0;
			for (let e = 0; e < a.length; e++) {
				let t = a[e], n = Math.max(0, t.radius * l);
				if (n <= 0) continue;
				let r = t.whitePower * o.stripeWhiteAlpha, i = o.pushScale * t.pushPower;
				if (r <= 0 && i <= 0) continue;
				let u = Math.max(.5, t.strokeWidth * .5 * l), f = Math.max(.5, u * o.pushBandScale), m = d * jn;
				p[m] = t.x * s, p[m + 1] = t.y * c, p[m + 2] = n, p[m + 3] = u, p[m + 4] = f, p[m + 5] = i, p[m + 6] = r, p[m + 7] = t.waveProgress, p[m + 8] = t.seed, d++;
			}
			d !== 0 && (z(e, i), e.useProgram(t), e.uniform2f(f, o.cols, o.rows), e.bindVertexArray(n), e.bindBuffer(e.ARRAY_BUFFER, r), e.bufferData(e.ARRAY_BUFFER, p.subarray(0, d * jn), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, d), e.disable(e.BLEND), e.bindVertexArray(null));
		},
		dispose() {
			e.deleteProgram(t), e.deleteVertexArray(n), e.deleteBuffer(r);
		}
	};
}
var Nn = 1861, Pn = 3, Fn = 620, In = 62, Ln = .28, Rn = 70, zn = 260, Bn = 380, Vn = .5, Hn = .8, Un = 1500, Wn = 2200, Gn = .62, Kn = .18, qn = 128, Jn = 5, Yn = .22;
function Xn(e) {
	let t = Math.max(4, Math.round(e.maxLinks));
	return {
		maxStars: Math.max(4, Math.round(e.maxStars)),
		maxLinks: t,
		maxPulses: Math.min(24, Math.max(4, Math.round(t * .42)))
	};
}
function Zn(e) {
	return {
		caps: e,
		starCount: 0,
		starBytes: new Uint8Array(e.maxStars * 4),
		starsX: new Float32Array(e.maxStars),
		starsY: new Float32Array(e.maxStars),
		starsDirty: !0,
		starFxBytes: new Uint8Array(e.maxStars * 4),
		graph: null,
		cssW: 0,
		cssH: 0,
		linkRadius: 0,
		pairDist: 0,
		builtPairDist: 0,
		smoothX: 0,
		smoothY: 0,
		hasSmooth: !1,
		cursorFade: 0,
		lastNow: -1,
		lastFlashGlobal: -1e9,
		pulses: [],
		pending: [],
		flareStart: new Float32Array(e.maxStars).fill(-1e9),
		starAct: new Float32Array(e.maxStars),
		starFlare: new Float32Array(e.maxStars),
		starPeak: new Float32Array(e.maxStars),
		starSum: new Float32Array(e.maxStars),
		segData: new Float32Array(e.maxLinks * 4),
		fxData: new Float32Array(e.maxLinks * 2),
		pulseSegData: new Float32Array(e.maxPulses * 4),
		pulseFxData: new Float32Array(e.maxPulses * 2),
		lineCount: 0,
		pulseCount: 0
	};
}
function Qn(e) {
	let t = Math.min(1, Math.max(0, e));
	return t * t * (3 - 2 * t);
}
function $n(e) {
	if (e <= 0) return 0;
	if (e >= 1) return 1;
	let t = e;
	for (let n = 0; n < 5; n++) {
		let n = 1 - t, r = 1.8 * t * n * n + t * t * t, i = 1.8 * n * (1 - 3 * t) + 3 * t * t;
		if (i < 1e-4) break;
		t -= (r - e) / i, t < 0 && (t = 0), t > 1 && (t = 1);
	}
	let n = 1 - t;
	return 1.8 * t * n * n + 3 * t * t * n + t * t * t;
}
function er(e, t) {
	let n = Math.round(44 * e.starDensity);
	return Math.min(t.maxStars, Math.max(3, n));
}
function tr(e, t) {
	let n = kt(Nn);
	e.starBytes.fill(0);
	for (let r = 0; r < t; r++) {
		let t = .5, i = .5, a = -1;
		for (let o = 0; o < 40; o++) {
			let o = .055 + n() * .89, s = .085 + n() * .83, c = Infinity;
			for (let t = 0; t < r; t++) {
				let n = Math.hypot((o - e.starsX[t]) * 1.6, s - e.starsY[t]);
				n < c && (c = n);
			}
			if (c > a && (a = c, t = o, i = s), c >= .115) break;
		}
		let o = Math.round(t * 255), s = Math.round(i * 255);
		e.starsX[r] = o / 255, e.starsY[r] = s / 255, e.starBytes[r * 4] = o, e.starBytes[r * 4 + 1] = s, e.starBytes[r * 4 + 2] = Math.round(n() * 255), e.starBytes[r * 4 + 3] = Math.round(n() * 255);
	}
	e.starCount = t, e.starsDirty = !0, e.flareStart.fill(-1e9), e.starAct.fill(0), e.starFlare.fill(0);
}
function nr(e, t, n, r) {
	let i = e.starCount, a = new Float32Array(i), o = new Float32Array(i);
	for (let r = 0; r < i; r++) a[r] = e.starsX[r] * t, o[r] = e.starsY[r] * n;
	let s = /* @__PURE__ */ new Set();
	for (let e = 0; e < i; e++) {
		let t = [];
		for (let n = 0; n < i; n++) {
			if (n === e) continue;
			let i = Math.hypot(a[n] - a[e], o[n] - o[e]);
			i < r && t.push({
				j: n,
				d: i
			});
		}
		t.sort((e, t) => e.d - t.d);
		let n = Math.min(Pn, t.length);
		for (let r = 0; r < n; r++) {
			let n = t[r].j;
			s.add(e < n ? e * 1024 + n : n * 1024 + e);
		}
	}
	let c = Array.from({ length: i }, () => /* @__PURE__ */ new Set());
	for (let e of s) {
		let t = Math.floor(e / 1024), n = e % 1024;
		c[t].add(n), c[n].add(t);
	}
	let l = [];
	for (let e = 0; e < i; e++) for (let t = e + 1; t < i; t++) {
		if (c[e].has(t)) continue;
		let n = Math.hypot(a[t] - a[e], o[t] - o[e]);
		if (n >= r) continue;
		let i = !1;
		for (let n of c[e]) if (c[t].has(n)) {
			i = !0;
			break;
		}
		i && l.push({
			key: e * 1024 + t,
			d: n
		});
	}
	l.sort((e, t) => e.d - t.d);
	let u = Math.ceil(s.size * Yn);
	for (let e = 0; e < Math.min(u, l.length); e++) s.add(l[e].key);
	let d = [...s].sort((e, t) => e - t).map((e) => ({
		a: Math.floor(e / 1024),
		b: e % 1024,
		stagger: (e * 2654435761 >>> 0) / 4294967296 * 90,
		phase: 0,
		prevPhase: 0,
		env: 0,
		activeSince: -1,
		holdUntil: 0,
		flashStart: -1e9,
		lastPulse: -1e9
	})), f = /* @__PURE__ */ new Map(), p = Array.from({ length: i }, () => []);
	d.forEach((e, t) => {
		f.set(e.a * 1024 + e.b, t), p[e.a].push(t), p[e.b].push(t);
	});
	let m = Array.from({ length: i }, () => /* @__PURE__ */ new Set());
	for (let e of d) m[e.a].add(e.b), m[e.b].add(e.a);
	let h = (e, t) => f.get(e < t ? e * 1024 + t : t * 1024 + e), g = [], _ = /* @__PURE__ */ new Set(), v = (e) => {
		let t = [];
		for (let n = 0; n < e.length; n++) {
			let r = h(e[n], e[(n + 1) % e.length]);
			if (r === void 0) return;
			t.push(r);
		}
		let n = [...t].sort((e, t) => e - t).join(",");
		_.has(n) || (_.add(n), g.push({
			edges: t,
			lastFlash: -1e9,
			complete: !1
		}));
	}, y = [], b = new Uint8Array(i), x = (e, t) => {
		for (let n of m[t]) {
			if (g.length >= qn) return;
			if (n === e) {
				y.length >= 3 && v([...y]);
				continue;
			}
			n < e || b[n] || y.length >= Jn || (y.push(n), b[n] = 1, x(e, n), y.pop(), b[n] = 0);
		}
	};
	for (let e = 0; e < i && (y.length = 0, y.push(e), b[e] = 1, x(e, e), b[e] = 0, !(g.length >= qn)); e++);
	return {
		sx: a,
		sy: o,
		edges: d,
		incident: p,
		polygons: g
	};
}
function rr(e, t) {
	return Math.hypot(e.sx[t.b] - e.sx[t.a], e.sy[t.b] - e.sy[t.a]);
}
function ir(e, t, n, r, i, a, o) {
	if (e.pulses.length >= e.caps.maxPulses) return;
	let s = n.edges[r];
	if (a - s.lastPulse < t.pulseCooldownMs * Hn) return;
	s.lastPulse = a;
	let c = rr(n, s) / Math.max(1, e.pairDist), l = t.pulseDurationMs * (.571 + .429 * Math.min(1, Math.max(0, c)));
	e.pulses.push({
		edge: r,
		from: i,
		start: a,
		duration: l,
		hops: o
	});
}
function ar(e, t, n, r, i, a, o) {
	if (o > t.pulseRelayHops) return;
	let s = t.pulseCooldownMs * Hn;
	n.incident[r].filter((e) => e !== i).filter((e) => n.edges[e].phase >= .42 && a - n.edges[e].lastPulse > s).sort((e, t) => n.edges[t].phase - n.edges[e].phase).slice(0, 2).forEach((t, n) => {
		e.pending.push({
			edge: t,
			from: r,
			at: a + 70 + n * 55,
			hops: o
		});
	});
}
function or(e, t, n) {
	let r = Math.max(1, t.flareMs);
	for (let t = 0; t < e.starCount; t++) {
		let i = (n - e.flareStart[t]) / r;
		e.starFlare[t] = i >= 0 && i < 1 ? i < .14 ? Qn(i / .14) : 1 - $n((i - .14) / .86) : 0;
	}
}
function sr(e, t, n, r) {
	n.edges.forEach((i, a) => {
		i.phase < Vn || i.prevPhase >= Vn || r - i.lastPulse < t.pulseCooldownMs || ir(e, t, n, a, Math.hypot(n.sx[i.a] - e.smoothX, n.sy[i.a] - e.smoothY) <= Math.hypot(n.sx[i.b] - e.smoothX, n.sy[i.b] - e.smoothY) ? i.a : i.b, r, 1);
	});
	for (let i = e.pending.length - 1; i >= 0; i--) {
		let a = e.pending[i];
		r < a.at || (e.pending.splice(i, 1), n.edges[a.edge].phase >= .3 && ir(e, t, n, a.edge, a.from, r, a.hops));
	}
	for (let i = e.pulses.length - 1; i >= 0; i--) {
		let a = e.pulses[i], o = n.edges[a.edge];
		if ((r - a.start) / a.duration >= 1) {
			e.pulses.splice(i, 1);
			let s = a.from === o.a ? o.b : o.a;
			o.phase >= .2 && (e.flareStart[s] = r, ar(e, t, n, s, a.edge, r, a.hops + 1));
			continue;
		}
		o.phase <= .05 && e.pulses.splice(i, 1);
	}
}
function cr(e, t, n) {
	let r = 0;
	for (let i of e.pulses) {
		if (r >= e.caps.maxPulses) break;
		let a = t.edges[i.edge], o = Math.min(1, Math.max(0, (n - i.start) / i.duration)), s = i.from === a.a ? o : 1 - o, c = Qn(o / .12) * (1 - $n(Math.max(0, (o - .82) / .18))) * Math.min(1, a.phase * 1.4) * (i.hops > 1 ? .82 : 1);
		if (c < .01) continue;
		let l = r * 4, u = r * 2;
		e.pulseSegData[l] = e.starsX[a.a], e.pulseSegData[l + 1] = e.starsY[a.a], e.pulseSegData[l + 2] = e.starsX[a.b], e.pulseSegData[l + 3] = e.starsY[a.b], e.pulseFxData[u] = s, e.pulseFxData[u + 1] = c, r++;
	}
	e.pulseCount = r;
}
function lr(e, t) {
	let n = 1 - Math.exp(-t / In);
	for (let t = 0; t < e.starCount; t++) {
		let r = e.starPeak[t], i = Math.min(1, Math.max(0, (e.starSum[t] - r) * .5)), a = Math.min(1, r * (1 + Ln * i));
		e.starAct[t] += (a - e.starAct[t]) * n;
	}
}
function ur(e) {
	for (let t = 0; t < e.caps.maxStars; t++) {
		let n = t < e.starCount ? e.starAct[t] : 0, r = t < e.starCount ? e.starFlare[t] : 0;
		e.starFxBytes[t * 4] = Math.round(Math.min(1, Math.max(0, n)) * 255), e.starFxBytes[t * 4 + 1] = Math.round(Math.min(1, Math.max(0, r)) * 255);
	}
}
function dr(e, t, n, r, i, a) {
	let o = e.lastNow < 0 ? 16 : Math.min(50, Math.max(0, a - e.lastNow));
	e.lastNow = a;
	let s = er(t, e.caps);
	s !== e.starCount && (tr(e, s), e.graph = null);
	let c = Math.min(r, i);
	e.linkRadius = t.radiusScale * c, e.pairDist = t.linkMaxDistScale * c;
	let l = Math.abs(r - e.cssW) > .5 || Math.abs(i - e.cssH) > .5, u = Math.abs(e.pairDist - e.builtPairDist) > .5;
	r > 1 && (l || u || !e.graph) && (e.cssW = r, e.cssH = i, e.builtPairDist = e.pairDist, e.graph = nr(e, r, i, e.pairDist), e.pulses.length = 0, e.pending.length = 0);
	let d = e.graph;
	if (!d) {
		e.lineCount = 0, e.pulseCount = 0, e.starPeak.fill(0), e.starSum.fill(0), lr(e, o), or(e, t, a), ur(e);
		return;
	}
	if (n) {
		if (e.hasSmooth) {
			let t = 1 - Math.exp(-o / Rn);
			e.smoothX += (n.x - e.smoothX) * t, e.smoothY += (n.y - e.smoothY) * t;
		} else e.smoothX = n.x, e.smoothY = n.y, e.hasSmooth = !0;
		e.cursorFade = Math.min(1, e.cursorFade + o / zn);
	} else e.cursorFade = Math.max(0, e.cursorFade - o / Bn), e.cursorFade === 0 && (e.hasSmooth = !1);
	let f = Math.max(1, e.linkRadius), p = Math.max(1, t.linkFormMs), m = Math.max(1, t.linkDissolveMs);
	for (let r of d.edges) {
		let i = 0;
		if (n && e.hasSmooth) {
			let t = d.sx[r.a], n = d.sy[r.a], a = d.sx[r.b] - t, o = d.sy[r.b] - n, s = Math.max(a * a + o * o, 1e-4), c = Math.min(1, Math.max(0, ((e.smoothX - t) * a + (e.smoothY - n) * o) / s)), l = Math.hypot(t + a * c - e.smoothX, n + o * c - e.smoothY) / f;
			l < 1 && (i = Qn((1 - l) / .65));
		}
		r.prevPhase = r.phase, i > .02 ? (r.activeSince < 0 && (r.activeSince = a), r.env = i, a - r.activeSince > r.stagger && (r.phase = Math.min(1, r.phase + o / p))) : (r.activeSince >= 0 && (r.activeSince = -1, r.holdUntil = a + t.linkHoldMs), a >= r.holdUntil && (r.phase = Math.max(0, r.phase - o / m), r.phase === 0 && (r.env = 0)));
	}
	if (t.pulseEnabled ? sr(e, t, d, a) : (e.pulses.length = 0, e.pending.length = 0), t.polygonFlashEnabled) for (let t of d.polygons) {
		let n = !0;
		for (let e of t.edges) {
			let t = d.edges[e];
			if (t.phase < Gn || t.env < Kn) {
				n = !1;
				break;
			}
		}
		if (n && a - e.lastFlashGlobal > Un && a - t.lastFlash > Wn) {
			e.lastFlashGlobal = a, t.lastFlash = a;
			for (let n of t.edges) {
				let t = d.edges[n];
				t.flashStart = a, e.flareStart[t.a] = a, e.flareStart[t.b] = a;
			}
		}
		t.complete = n;
	}
	e.starPeak.fill(0), e.starSum.fill(0);
	for (let t of d.edges) {
		let n = $n(t.phase) * (.55 + .45 * t.env);
		n <= .01 || (e.starSum[t.a] += n, e.starSum[t.b] += n, n > e.starPeak[t.a] && (e.starPeak[t.a] = n), n > e.starPeak[t.b] && (e.starPeak[t.b] = n));
	}
	lr(e, o), or(e, t, a), ur(e);
	let h = 0;
	for (let t of d.edges) {
		if (h >= e.caps.maxLinks) break;
		let n = $n(t.phase) * (.62 + .38 * t.env);
		if (n < .008) continue;
		let r = (a - t.flashStart) / Fn, i = r >= 0 && r < 1 ? r < .16 ? Qn(r / .16) : 1 - $n((r - .16) / .84) : 0, o = h * 4, s = h * 2;
		e.segData[o] = e.starsX[t.a], e.segData[o + 1] = e.starsY[t.a], e.segData[o + 2] = e.starsX[t.b], e.segData[o + 3] = e.starsY[t.b], e.fxData[s] = n, e.fxData[s + 1] = i, h++;
	}
	e.lineCount = h, t.pulseEnabled ? cr(e, d, a) : e.pulseCount = 0;
}
//#endregion
//#region src/shaders/constellation.frag.ts
function fr(e, t, n) {
	return `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uStars;
uniform sampler2D uStarFx;
uniform vec2 uCssSize;
uniform vec2 uCursor;
uniform float uCursorFade;
uniform float uLinkRadius;
uniform float uTime;
uniform int uStarCount;
uniform int uLineCount;
uniform int uPulseCount;
uniform vec4 uLineStyle;
uniform vec4 uStarStyle;
uniform vec3 uStarExtra;
uniform vec3 uPulseStyle;
uniform float uFlashStrength;
uniform vec4 uLineSeg[${t}];
uniform vec2 uLineFx[${t}];
uniform vec4 uPulseSeg[${n}];
uniform vec2 uPulseFx[${n}];

in vec2 vUv;
out vec4 outColor;

const float TAU = 6.2831853;

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.6, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  vec2 warp = vec2(0.0);
  float add = 0.0;
  float dim = 0.0;

  for (int i = 0; i < ${t}; i++) {
    if (i >= uLineCount) break;
    vec4 seg = uLineSeg[i];
    vec2 fx = uLineFx[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 pa = pos - a;
    vec2 ba = b - a;
    float len2 = max(dot(ba, ba), 1e-4);
    float h = clamp(dot(pa, ba) / len2, 0.0, 1.0);
    vec2 off = pa - ba * h;
    float d = length(off);
    float flash = fx.y * uFlashStrength;
    float lw = uLineStyle.x * (1.0 + 1.15 * flash) * sc;
    float reach = lw * 6.4;
    if (d > reach) continue;
    float alpha = fx.x * smoothstep(0.0, 0.05, h) * smoothstep(1.0, 0.95, h);
    if (alpha < 0.004) continue;
    vec2 tng = ba * inversesqrt(len2);
    vec2 nrm = vec2(-tng.y, tng.x);
    float side = dot(off, nrm) >= 0.0 ? 1.0 : -1.0;
    float t = d / reach;
    float prof = exp(-t * t * 2.4);
    float amp = uLineStyle.w * (1.0 + 1.15 * flash) * sc * alpha;
    warp += (nrm * 1.05 + tng * 0.3) * side * amp * prof;
    float shimmer = 0.94 + 0.06 * sin(uTime * 1.7 + (a.x + b.y) * 0.045);
    float core = smoothstep(lw * 0.92, lw * 0.1, d);
    float halo = smoothstep(lw * 2.1, lw * 0.85, d) * (1.0 - core);
    add += (core * (1.55 + 2.7 * flash) + halo * (0.4 + 0.55 * flash)) * alpha * shimmer * uLineStyle.y;
    float groove = smoothstep(lw * 4.6, lw * 1.6, d) * (1.0 - core) * (1.0 - 0.45 * halo);
    dim += groove * alpha * (1.05 + 0.8 * flash) * uLineStyle.z;
  }

  for (int i = 0; i < ${n}; i++) {
    if (i >= uPulseCount) break;
    vec4 seg = uPulseSeg[i];
    vec2 fx = uPulseFx[i];
    vec2 a = seg.xy * uCssSize;
    vec2 b = seg.zw * uCssSize;
    vec2 ba = b - a;
    float len = max(length(ba), 1e-3);
    vec2 tng = ba / len;
    vec2 nrm = vec2(-tng.y, tng.x);
    vec2 pa = pos - a;
    float along = dot(pa, tng);
    float perp = dot(pa, nrm);
    float wid = 3.0 * sc;
    if (abs(perp) > wid * 6.0) continue;
    float coreLen = uPulseStyle.x * sc;
    float tailLen = uPulseStyle.y * sc;
    float s = along - fx.x * len;
    if (s > coreLen * 3.0 || s < -tailLen * 1.7) continue;
    if (along < -coreLen * 2.0 || along > len + coreLen * 2.0) continue;
    float lateral = exp(-(perp * perp) / (wid * wid));
    float core = exp(-(s * s) / (coreLen * coreLen));
    float tail = s < 0.0 ? exp(s / tailLen) * (1.0 - core) : 0.0;
    add += (core * 2.1 + tail * 0.6) * lateral * fx.y * uPulseStyle.z;
    float side = perp >= 0.0 ? 1.0 : -1.0;
    float spread = exp(-(perp * perp) / (wid * wid * 22.0));
    float push = (core + 0.45 * tail) * spread * fx.y;
    warp += (nrm * side * 1.15 + tng * 0.22) * push * 15.5 * sc;
    dim += smoothstep(wid * 5.5, wid * 1.5, abs(perp)) * (core + 0.55 * tail) * fx.y * 0.72;
  }

  for (int i = 0; i < ${e}; i++) {
    if (i >= uStarCount) break;
    vec4 s = texelFetch(uStars, ivec2(i, 0), 0);
    vec2 fx = texelFetch(uStarFx, ivec2(i, 0), 0).rg;
    vec2 sp = s.xy * uCssSize;
    vec2 q = pos - sp;
    float d = length(q);
    float near = smoothstep(uLinkRadius, uLinkRadius * 0.25, distance(sp, uCursor)) * uCursorFade;
    float speed = (0.6 + fract(s.z * 13.71 + s.w * 3.93) * 1.7) * uStarExtra.y;
    float tw = (1.0 - uStarExtra.x) + uStarExtra.x * sin(uTime * speed + s.w * TAU);
    float grow = clamp(fx.x, 0.0, 1.0);
    float flare = clamp(fx.y, 0.0, 1.0);
    float rcBase = uStarStyle.x * (1.0 + uStarStyle.y * s.z) * sc * (1.0 + 0.22 * near) * (0.95 + 0.05 * tw);
    float reach = rcBase * 4.4 * (1.0 + 0.6 * flare);
    if (d > reach) continue;
    vec2 dir = d > 1e-4 ? q / d : vec2(0.0);
    float t = d / reach;
    float push = uStarStyle.z * (1.0 + 0.79 * s.z) * sc * (1.0 + 0.55 * near + 1.1 * flare);
    warp += dir * push * 3.3 * t * exp(-t * t * 2.0);
    float rc = rcBase * (1.0 + uStarStyle.w * grow + uStarExtra.z * flare);
    add += smoothstep(rc, rc * mix(0.28, 0.6, max(grow, flare)), d) * (0.92 + 0.16 * tw) * (1.0 + 0.55 * flare);
    float spikeX = exp(-abs(q.y) / (rc * 0.16)) * exp(-abs(q.x) / (rc * 1.35));
    float spikeY = exp(-abs(q.x) / (rc * 0.16)) * exp(-abs(q.y) / (rc * 1.35));
    add += (spikeX + spikeY) * tw * (0.24 + 0.22 * near + 0.62 * flare);
    float ring = smoothstep(rcBase * 2.9, rcBase * 1.5, d) * smoothstep(rcBase * 0.95, rcBase * 1.3, d);
    dim += ring * (0.42 + 0.14 * near + 0.3 * flare);
  }

  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = clamp(base * (1.0 - min(dim, 0.9)) + add, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
//#endregion
//#region src/passes/constellationPass.ts
function pr(e, t, n) {
	let r = P(e, B, fr(n.maxStars, n.maxLinks, n.maxPulses)), i = Zn(n), a = Rt(e, i.starBytes, n.maxStars, 1), o = Rt(e, i.starFxBytes, n.maxStars, 1), s = e.getUniformLocation(r, "uField"), c = e.getUniformLocation(r, "uStars"), l = e.getUniformLocation(r, "uStarFx"), u = e.getUniformLocation(r, "uCssSize"), d = e.getUniformLocation(r, "uCursor"), f = e.getUniformLocation(r, "uCursorFade"), p = e.getUniformLocation(r, "uLinkRadius"), m = e.getUniformLocation(r, "uTime"), h = e.getUniformLocation(r, "uStarCount"), g = e.getUniformLocation(r, "uLineCount"), _ = e.getUniformLocation(r, "uPulseCount"), v = e.getUniformLocation(r, "uLineStyle"), y = e.getUniformLocation(r, "uStarStyle"), b = e.getUniformLocation(r, "uStarExtra"), x = e.getUniformLocation(r, "uPulseStyle"), S = e.getUniformLocation(r, "uFlashStrength"), C = e.getUniformLocation(r, "uLineSeg"), w = e.getUniformLocation(r, "uLineFx"), T = e.getUniformLocation(r, "uPulseSeg"), E = e.getUniformLocation(r, "uPulseFx");
	return {
		render(D, O, k) {
			let A = k.config;
			dr(i, A, k.cursor, k.cssW, k.cssH, k.now), i.starsDirty &&= (zt(e, a, i.starBytes, n.maxStars, 1), !1), zt(e, o, i.starFxBytes, n.maxStars, 1), z(e, D), e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, O), e.uniform1i(s, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(c, 1), e.activeTexture(e.TEXTURE2), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(l, 2), e.uniform2f(u, k.cssW, k.cssH), e.uniform2f(d, i.hasSmooth ? i.smoothX : -1e5, i.hasSmooth ? i.smoothY : -1e5), e.uniform1f(f, i.cursorFade), e.uniform1f(p, Math.max(1, i.linkRadius)), e.uniform1f(m, k.timeSec), e.uniform1i(h, i.starCount), e.uniform1i(g, i.lineCount), e.uniform1i(_, i.pulseCount), e.uniform4f(v, A.linkThicknessPx, A.linkBrightness, A.linkGrooveDepth, A.linkShearPx), e.uniform4f(y, A.starSizePx, A.starSizeRandomness, A.starPushPx, A.starGrowScale), e.uniform3f(b, A.twinkleAmount, A.twinkleSpeed, A.flareScale), e.uniform3f(x, A.pulseCoreLenPx, A.pulseTailLenPx, A.pulseBrightness), e.uniform1f(S, A.polygonFlashEnabled ? A.polygonFlashStrength : 0), e.uniform4fv(C, i.segData), e.uniform2fv(w, i.fxData), e.uniform4fv(T, i.pulseSegData), e.uniform2fv(E, i.pulseFxData), t.draw();
		},
		dispose() {
			e.deleteProgram(r), e.deleteTexture(a), e.deleteTexture(o);
		}
	};
}
var mr = 300, hr = .5, gr = 2.5, _r = 1 / 240, vr = 12, yr = .7, br = 1.16, xr = .42, Sr = 1.22, Cr = 10, wr = 22, Tr = 12, Er = 130, Dr = .6, Or = 5, kr = 70, Ar = 19 / 15, jr = 3.2 / 2.6, Mr = 7, Nr = 34, Pr = 760, Fr = .12, Ir = .4, Lr = 4.3 / 2.9, Rr = 10, zr = .14, Br = 8, Vr = .618033988749895, Hr = Math.PI * 2, Ur = 50, Wr = .5, Gr = 16.7;
function Kr(e) {
	return {
		nodeCount: Math.max(2, Math.round(e.nodeCount)),
		maxEmbers: Math.max(1, Math.round(e.emberMaxCount))
	};
}
function qr(e, t) {
	let n = Math.min(e, t) / mr;
	return n < hr ? hr : n > gr ? gr : n;
}
function Jr(e, t) {
	let n = kt(t >>> 0);
	return {
		caps: e,
		random: n,
		px: new Float32Array(e.nodeCount),
		py: new Float32Array(e.nodeCount),
		vx: new Float32Array(e.nodeCount),
		vy: new Float32Array(e.nodeCount),
		nodeData: new Float32Array(e.nodeCount * 2),
		radiusData: new Float32Array(e.nodeCount),
		emberState: new Float32Array(e.maxEmbers * Mr),
		emberData: new Float32Array(e.maxEmbers * 4),
		emberCount: 0,
		emitAccum: 0,
		lifePhase: n(),
		x: 0,
		y: 0,
		velX: 0,
		velY: 0,
		presence: 0,
		core: 0,
		wasActive: !1,
		lastNow: -1
	};
}
function Yr(e) {
	return e < 0 ? 0 : e > 1 ? 1 : e;
}
function Xr(e, t, n) {
	for (let r = 0; r < e.caps.nodeCount; r++) e.px[r] = t, e.py[r] = n, e.vx[r] = 0, e.vy[r] = 0;
}
function Zr(e, t, n, r, i, a) {
	let { px: o, py: s, vx: c, vy: l } = e, u = e.caps.nodeCount;
	c[0] += (t.headStiffness * (r - o[0]) - t.headDamping * c[0]) * n, l[0] += (t.headStiffness * (i - s[0]) - t.headDamping * l[0]) * n, o[0] += c[0] * n, s[0] += l[0] * n;
	for (let e = 1; e < u; e++) {
		c[e] += (t.chainStiffness * (o[e - 1] - o[e]) - t.chainDamping * c[e]) * n, l[e] += (t.chainStiffness * (s[e - 1] - s[e]) - t.chainDamping * l[e]) * n, o[e] += c[e] * n, s[e] += l[e] * n;
		let r = o[e] - o[e - 1], i = s[e] - s[e - 1], u = Math.hypot(r, i);
		if (u > a && u > 1e-4) {
			let t = r / u, n = i / u;
			o[e] = o[e - 1] + t * a, s[e] = s[e - 1] + n * a;
			let d = c[e] * t + l[e] * n;
			d > 0 && (c[e] -= t * d * yr, l[e] -= n * d * yr);
		}
	}
}
function Qr(e, t, n) {
	let { px: r, py: i, nodeData: a, radiusData: o } = e, s = e.caps.nodeCount, c = s - 1;
	for (let e = 0; e < s; e++) a[e * 2] = r[e], a[e * 2 + 1] = i[e];
	for (let e = 0; e < s; e++) {
		let a = e === 0 ? 0 : e - 1, s = e === c ? c : e + 1, l = Math.hypot(r[s] - r[a], i[s] - i[a]) / (s - a || 1), u = c > 0 ? e / c : 0, d = (t.headRadiusPx + (t.tailRadiusPx - t.headRadiusPx) * u) * n, f = br - t.stretchThinning * l / (Cr * n);
		o[e] = d * (f < xr ? xr : f > Sr ? Sr : f);
	}
}
function $r(e, t, n, r, i, a, o, s, c) {
	if (e.emberCount >= e.caps.maxEmbers) return;
	let l = e.random, u = e.emberCount * Mr;
	e.emberCount += 1;
	let d = l(), f = (c > Br ? Math.atan2(-s, -o) : l() * Hr) + (l() - .5) * 2 * t.emberSpreadRad, p = t.emberSpeedMinPxPerSec + l() * (t.emberSpeedMaxPxPerSec - t.emberSpeedMinPxPerSec);
	e.lifePhase = (e.lifePhase + Vr) % 1;
	let m = (e.lifePhase + l() * zr) % 1;
	e.emberState[u] = n + (i - n) * d + (l() - .5) * Rr, e.emberState[u + 1] = r + (a - r) * d + (l() - .5) * Rr, e.emberState[u + 2] = Math.cos(f) * p, e.emberState[u + 3] = Math.sin(f) * p, e.emberState[u + 4] = 0, e.emberState[u + 5] = t.emberLifetimeMinMs + m * (t.emberLifetimeMaxMs - t.emberLifetimeMinMs), e.emberState[u + 6] = t.emberSizePx * (1 + l() * Lr);
}
function ei(e, t, n, r, i, a, o, s, c, l) {
	let u = Yr((c - Nr) / Pr);
	if (u <= 0) {
		e.emitAccum > Ir && (e.emitAccum = Ir);
		return;
	}
	for (e.emitAccum += (Fr + (1 - Fr) * u) * t.emberRatePerSec * l; e.emitAccum >= 1;) --e.emitAccum, $r(e, t, n, r, i, a, o, s, c);
}
function ti(e, t) {
	let n = t / 1e3, r = e.emberState, i = 0;
	for (; i < e.emberCount;) {
		let a = i * Mr, o = r[a + 4] + t;
		if (o >= r[a + 5]) {
			--e.emberCount;
			let t = e.emberCount * Mr;
			t !== a && r.copyWithin(a, t, t + Mr);
			continue;
		}
		r[a + 4] = o, r[a] += r[a + 2] * n, r[a + 1] += r[a + 3] * n, i += 1;
	}
}
function ni(e) {
	let t = e.emberState;
	for (let n = 0; n < e.emberCount; n++) {
		let r = n * Mr, i = n * 4;
		e.emberData[i] = t[r], e.emberData[i + 1] = t[r + 1], e.emberData[i + 2] = t[r + 6], e.emberData[i + 3] = t[r + 4] / t[r + 5];
	}
}
function ri(e, t, n, r, i, a) {
	let o = e.lastNow < 0 ? Gr : a - e.lastNow, s = o < Wr ? Wr : o > Ur ? Ur : o;
	e.lastNow = a;
	let c = s / 1e3, l = qr(r, i), u = n !== null;
	n && !e.wasActive && (e.x = n.x, e.y = n.y, e.velX = 0, e.velY = 0, Xr(e, n.x, n.y));
	let d = e.x, f = e.y;
	n && (e.x = n.x, e.y = n.y);
	let p = (e.x - d) / c, m = (e.y - f) / c, h = Math.hypot(p, m), g = 1 - Math.exp(-c * wr);
	e.velX += (p - e.velX) * g, e.velY += (m - e.velY) * g;
	let _ = Math.hypot(e.velX, e.velY), v = Yr((_ - Tr) / Er), y = u ? v ** +Dr : 0, b = y > e.presence ? t.presenceRiseRate : t.presenceFallRate;
	e.presence += (y - e.presence) * (1 - Math.exp(-c * b));
	let x = Yr((_ - Or) / kr), S = u ? x ** +Dr : 0, C = S > e.core ? t.presenceRiseRate * Ar : t.presenceFallRate * jr;
	e.core += (S - e.core) * (1 - Math.exp(-c * C)), u && e.wasActive && t.embersEnabled && ei(e, t, d, f, e.x, e.y, p, m, h, c), e.wasActive = u, ti(e, s), ni(e);
	let w = Math.min(vr, Math.max(1, Math.ceil(c / _r))), T = c / w, E = t.maxLinkPx * l;
	for (let n = 0; n < w; n++) Zr(e, t, T, e.x, e.y, E);
	Qr(e, t, l);
}
//#endregion
//#region src/shaders/comet.frag.ts
function ii(e) {
	return `#version 300 es
precision highp float;

uniform sampler2D uField;
uniform sampler2D uHeat;
uniform vec2 uCssSize;
uniform vec2 uNode[${e}];
uniform float uNodeR[${e}];
uniform float uPresence;
uniform float uCore;
uniform float uTime;
uniform float uSmoothUnionPx;
uniform vec4 uStyle;

in vec2 vUv;
out vec4 outColor;

float smoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float bodyDist(vec2 p, float sc) {
  float k = max(uSmoothUnionPx * sc, 1e-3);
  float d = 1e5;
  for (int i = 0; i < ${Math.max(1, e - 1)}; i++) {
    vec2 a = uNode[i];
    vec2 b = uNode[i + 1];
    vec2 ab = b - a;
    float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float r = mix(uNodeR[i], uNodeR[i + 1], t);
    float seg = length(p - (a + ab * t)) - r;
    d = i == 0 ? seg : smoothUnion(d, seg, k);
  }
  return d;
}

float bodyCore(float d, float sc) {
  return 1.0 - smoothstep(-1.15 * sc, 0.15 * sc, d);
}

float bodyRing(float d, float sc) {
  return smoothstep(-0.25 * sc, 1.15 * sc, d) * (1.0 - smoothstep(0.35 * sc, 4.4 * sc, d));
}

float bodyPush(vec2 p, float sc) {
  return (1.0 - smoothstep(-1.5 * sc, 5.0 * sc, bodyDist(p, sc))) * 0.52;
}

float headBulge(vec2 p) {
  float r = max(uNodeR[0] * 1.12, 1.0);
  return 1.0 - smoothstep(0.34, 1.0, length(p - uNode[0]) / r);
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;

  float e = 2.0 * sc;
  float gx = bodyPush(p + vec2(e, 0.0), sc) - bodyPush(p - vec2(e, 0.0), sc);
  float gy = bodyPush(p + vec2(0.0, e), sc) - bodyPush(p - vec2(0.0, e), sc);
  vec2 push = vec2(gx, gy) / (2.0 * e) * 340.0 * sc * uPresence;
  float mag = length(push);
  float maxPush = uStyle.z * sc;
  if (mag > maxPush) push *= maxPush / max(mag, 1e-5);

  vec2 uv = clamp(vUv + vec2(push.x / uCssSize.x, -push.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float ember = clamp(texture(uHeat, vUv).g * uStyle.w, 0.0, 1.0);
  float dc = bodyDist(p, sc);
  float core = bodyCore(dc, sc) * uPresence;
  float flick = 0.9 + 0.1 * sin(uTime * 11.3 + sin(uTime * 27.1) * 1.7);
  float head = clamp(headBulge(p) * uCore * uPresence * flick, 0.0, 1.0);

  float aura = bodyRing(dc, sc) * uPresence;
  float dim = clamp(aura * 0.74 * uStyle.y, 0.0, 0.84);

  float lit = base * (1.0 - dim);
  float lum = clamp(mix(0.93, 1.0, head) * uStyle.x, 0.0, 1.0);
  float value = clamp(mix(mix(lit, lum, core), 1.0, ember), 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
//#endregion
//#region src/shaders/cometEmber.frag.ts
var ai = "#version 300 es\nprecision highp float;\n\nin vec2 vLocal;\nin float vT;\nuniform float uFadeIn;\nout vec4 outColor;\n\nvoid main() {\n  float r = length(vLocal);\n  float disc = 1.0 - smoothstep(0.46, 0.58, r);\n  float t = clamp(vT, 0.0, 1.0);\n  float amp = smoothstep(0.0, max(uFadeIn, 1e-3), t) * (1.0 - smoothstep(0.58, 1.0, t));\n  outColor = vec4(0.0, disc * amp, 0.0, 1.0);\n}\n", oi = "#version 300 es\nprecision highp float;\n\nin vec4 aEmber;\nuniform vec2 uCanvas;\nout vec2 vLocal;\nout float vT;\n\nvoid main() {\n  vec2 corner = vec2(\n    float(gl_VertexID == 1 || gl_VertexID == 4 || gl_VertexID == 5),\n    float(gl_VertexID == 2 || gl_VertexID == 3 || gl_VertexID == 5)\n  );\n  vec2 local = (corner - 0.5) * 2.0;\n  vec2 worldPx = aEmber.xy + local * aEmber.z * 3.2;\n  vec2 uv = worldPx / uCanvas;\n  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);\n  vLocal = local * 3.2;\n  vT = aEmber.w;\n}\n";
//#endregion
//#region src/passes/cometPass.ts
function si(e, t, n) {
	let r = P(e, B, ii(n.nodeCount)), i = P(e, oi, ai), a = e.createVertexArray(), o = e.createBuffer();
	if (!a || !o) throw e.deleteProgram(r), e.deleteProgram(i), a && e.deleteVertexArray(a), o && e.deleteBuffer(o), Error("Failed to create comet trail GL objects");
	e.bindVertexArray(a), e.bindBuffer(e.ARRAY_BUFFER, o);
	let s = e.getAttribLocation(i, "aEmber");
	e.enableVertexAttribArray(s), e.vertexAttribPointer(s, 4, e.FLOAT, !1, 16, 0), e.vertexAttribDivisor(s, 1), e.bindVertexArray(null), e.bindBuffer(e.ARRAY_BUFFER, null);
	let c = e.getUniformLocation(r, "uField"), l = e.getUniformLocation(r, "uHeat"), u = e.getUniformLocation(r, "uCssSize"), d = e.getUniformLocation(r, "uNode[0]"), f = e.getUniformLocation(r, "uNodeR[0]"), p = e.getUniformLocation(r, "uPresence"), m = e.getUniformLocation(r, "uCore"), h = e.getUniformLocation(r, "uTime"), g = e.getUniformLocation(r, "uSmoothUnionPx"), _ = e.getUniformLocation(r, "uStyle"), v = e.getUniformLocation(i, "uCanvas"), y = e.getUniformLocation(i, "uFadeIn"), b = null, x = -1, S = null;
	return {
		render(s, C, w) {
			let T = w.config;
			(!b || T.seed !== x) && (x = T.seed, b = Jr(n, x)), ri(b, T, w.cursor, w.cssW, w.cssH, w.now), S ? _e(e, S, s.width, s.height) : S = R(e, s.width, s.height, { linear: !0 }), z(e, S), e.clearColor(0, 0, 0, 1), e.clear(e.COLOR_BUFFER_BIT), T.embersEnabled && b.emberCount > 0 && (e.useProgram(i), e.uniform2f(v, Math.max(1, w.cssW), Math.max(1, w.cssH)), e.uniform1f(y, T.emberFadeInFraction), e.bindVertexArray(a), e.bindBuffer(e.ARRAY_BUFFER, o), e.bufferData(e.ARRAY_BUFFER, b.emberData.subarray(0, b.emberCount * 4), e.DYNAMIC_DRAW), e.bindBuffer(e.ARRAY_BUFFER, null), e.enable(e.BLEND), e.blendFunc(e.ONE, e.ONE), e.drawArraysInstanced(e.TRIANGLES, 0, 6, b.emberCount), e.disable(e.BLEND), e.bindVertexArray(null)), z(e, s), e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, C), e.uniform1i(c, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, S.texture), e.uniform1i(l, 1), e.activeTexture(e.TEXTURE0), e.uniform2f(u, Math.max(1, w.cssW), Math.max(1, w.cssH)), e.uniform2fv(d, b.nodeData), e.uniform1fv(f, b.radiusData), e.uniform1f(p, b.presence), e.uniform1f(m, b.core), e.uniform1f(h, w.timeSec), e.uniform1f(g, T.smoothUnionPx), e.uniform4f(_, T.bodyBrightness, T.auraStrength, T.bodyPushPx, T.emberBrightness), t.draw();
		},
		dispose() {
			e.deleteProgram(r), e.deleteProgram(i), e.deleteVertexArray(a), e.deleteBuffer(o), S &&= (ve(e, S), null), b = null;
		}
	};
}
//#endregion
//#region src/meteors/meteorsSim.ts
var ci = 1835365477, li = .15, ui = 11, di = 1.5, fi = 12, pi = .08;
function mi(e) {
	return { maxActive: Math.max(1, Math.round(e.maxActive)) };
}
function hi(e, t) {
	return {
		caps: e,
		random: kt((t ^ ci) >>> 0),
		meteors: [],
		nextArrivalSec: 0,
		hasArrival: !1,
		spawnCount: 0,
		count: 0,
		originData: new Float32Array(e.maxActive * 4),
		shapeData: new Float32Array(e.maxActive * 4)
	};
}
function gi(e, t, n) {
	return t + (n - t) * e();
}
function _i(e) {
	let t = e < 0 ? 0 : e > 1 ? 1 : e;
	return t * t * (3 - 2 * t);
}
function vi(e, t) {
	let n = 1 / Math.max(.02, t), r = Math.min(.999999, Math.max(1e-6, e.random())), i = -Math.log(1 - r) * n, a = n * li, o = n * ui;
	return i < a ? a : i > o ? o : i;
}
function yi(e, t, n, r) {
	if (e < 0 || e > t) return 0;
	let i = n > 0 ? _i(e / n) : 1, a = Math.min(r, t), o = i * (a > 0 ? 1 - _i((e - (t - a)) / a) : 1);
	return o < 0 ? 0 : o > 1 ? 1 : o;
}
function bi(e, t, n, r, i) {
	let a = e.random;
	if (e.meteors.length >= e.caps.maxActive) {
		let t = 0;
		for (let n = 1; n < e.meteors.length; n++) e.meteors[n].bornAtSec < e.meteors[t].bornAtSec && (t = n);
		e.meteors.splice(t, 1);
	}
	let o = t.radiantAngleDeg * Math.PI / 180, s = Math.cos(o), c = Math.sin(o), l = Math.abs(s) * Math.max(1, r), u = Math.abs(c) * Math.max(1, n), d = a() * (l + u) < u, f, p;
	d ? (p = c > 0 ? -(pi + a() * .32) : 1.08 + a() * .32, f = (s > 0 ? -.45 : -.05) + a() * 1.5) : (f = s > 0 ? -(pi + a() * .34) : 1.08 + a() * .34, p = (c > 0 ? -.05 : .3) + a() * .75);
	let m = t.angleJitterDeg * Math.PI / 180;
	e.meteors.push({
		spawnX: f,
		spawnY: p,
		bornAtSec: i,
		lifetimeSec: gi(a, t.lifetimeMinMs, t.lifetimeMaxMs) / 1e3,
		angleOffset: gi(a, -m, m),
		speedMul: t.speedScale * gi(a, 1 - t.speedVariation, 1 + t.speedVariation),
		lengthMul: t.tailLengthScale * gi(a, 1 - t.tailLengthVariation, 1 + t.tailLengthVariation),
		thicknessMul: t.thicknessScale * gi(a, 1 - t.thicknessVariation, 1 + t.thicknessVariation)
	}), e.spawnCount++;
}
function xi(e, t, n, r, i) {
	for (let t = e.meteors.length - 1; t >= 0; t--) {
		let n = e.meteors[t];
		i - n.bornAtSec > n.lifetimeSec && e.meteors.splice(t, 1);
	}
	e.hasArrival ||= (e.nextArrivalSec = i + vi(e, t.ratePerSec) * .35, !0), i - e.nextArrivalSec > di && (e.nextArrivalSec = i);
	let a = 0;
	for (; i >= e.nextArrivalSec && a < fi;) bi(e, t, n, r, e.nextArrivalSec), e.nextArrivalSec += vi(e, t.ratePerSec), a++;
	let o = t.fadeInMs / 1e3, s = t.fadeOutMs / 1e3;
	e.originData.fill(0), e.shapeData.fill(0);
	let c = 0;
	for (let t of e.meteors) {
		if (c >= e.caps.maxActive) break;
		let n = i - t.bornAtSec, r = yi(n, t.lifetimeSec, o, s);
		if (r <= 0) continue;
		let a = c * 4;
		e.originData[a] = t.spawnX, e.originData[a + 1] = t.spawnY, e.originData[a + 2] = n, e.originData[a + 3] = r, e.shapeData[a] = t.angleOffset, e.shapeData[a + 1] = t.speedMul, e.shapeData[a + 2] = t.lengthMul, e.shapeData[a + 3] = t.thicknessMul, c++;
	}
	e.count = c;
}
//#endregion
//#region src/shaders/meteors.frag.ts
function Si(e) {
	return `#version 300 es
precision highp float;

const int MAX_METEORS = ${e};
const float PUSH_PEAK = 1.1658;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform vec2 uRadiant;
uniform vec4 uStyle;
uniform int uMeteorCount;
uniform vec4 uMeteorOrigin[MAX_METEORS];
uniform vec4 uMeteorShape[MAX_METEORS];

in vec2 vUv;
out vec4 outColor;

vec2 rotateVector(vec2 value, float angle) {
  float cosine = cos(angle);
  float sine = sin(angle);
  return vec2(cosine * value.x - sine * value.y, sine * value.x + cosine * value.y);
}

float pushProfile(float radius, float width) {
  float normalized = radius / max(width, 0.001);
  return normalized * exp(1.0 - normalized * normalized);
}

void meteorContribution(
  vec2 point,
  vec4 origin,
  vec4 shape,
  float diagonal,
  float scale,
  inout vec2 warp,
  inout float light,
  inout float carve
) {
  float age = origin.z;
  float envelope = origin.w;
  if (envelope <= 0.0) return;

  vec2 direction = rotateVector(normalize(uRadiant), shape.x);
  float speed = diagonal * 0.807 * shape.y;
  float tailLength = diagonal * 0.38 * shape.z;
  float bulk = max(0.05, shape.w) * scale;

  vec2 head = origin.xy * uCssSize + direction * speed * age;
  vec2 relative = point - head;
  float visibleTail = min(tailLength, speed * age);
  float behind = clamp(-dot(relative, direction), 0.0, visibleTail);
  vec2 closest = head - direction * behind;
  vec2 offset = point - closest;
  float axisDistance = length(offset);
  float progress = behind / max(1.0, tailLength);
  float taper = pow(1.0 - clamp(progress, 0.0, 1.0), 0.6);

  float channelWidth = (5.5125 + 9.8 * taper) * bulk;
  float pushWidth = max(0.5, channelWidth * uStyle.w);
  float amount = (pushProfile(axisDistance, pushWidth) / PUSH_PEAK) * uStyle.z * envelope * taper;
  vec2 pushDirection = axisDistance > 0.0001 ? offset / axisDistance : vec2(-direction.y, direction.x);
  warp -= pushDirection * amount;

  float drag = exp(-axisDistance / max(1.0, pushWidth * 1.1)) * envelope * taper * uStyle.z * 1.12;
  warp -= direction * drag;

  float coreWidth = (1.8375 + 4.41 * taper) * bulk;
  carve = max(carve, exp(-(axisDistance * axisDistance) / (coreWidth * coreWidth * 4.0)) * envelope * taper);

  float streak = 1.0 - smoothstep(coreWidth * 0.35, coreWidth * 1.5, axisDistance);
  light = max(light, streak * envelope * (0.55 + 0.45 * taper) * uStyle.x);

  float headDistance = length(relative);
  float headRadius = 11.6375 * bulk;
  light = max(light, (1.0 - smoothstep(headRadius * 0.2, headRadius, headDistance)) * envelope * uStyle.y);

  float bow = (pushProfile(headDistance, max(0.5, headRadius * 1.2 * uStyle.w)) / PUSH_PEAK) * uStyle.z * 0.9 * envelope;
  vec2 bowDirection = headDistance > 0.0001 ? relative / headDistance : direction;
  warp -= bowDirection * bow;
}

void main() {
  vec2 point = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float diagonal = length(uCssSize);
  float scale = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.55, 2.4);

  vec2 warp = vec2(0.0);
  float light = 0.0;
  float carve = 0.0;
  for (int index = 0; index < MAX_METEORS; index++) {
    if (index >= uMeteorCount) break;
    meteorContribution(point, uMeteorOrigin[index], uMeteorShape[index], diagonal, scale, warp, light, carve);
  }

  vec2 uv = clamp(vUv + vec2(warp.x, -warp.y) / uCssSize, 0.0, 1.0);
  float base = texture(uField, uv).r;
  float value = base * (1.0 - carve * 0.85);
  value = clamp(value + light, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
//#endregion
//#region src/passes/meteorsPass.ts
function Ci(e, t, n) {
	let r = P(e, B, Si(n.maxActive)), i = null, a = -1, o = e.getUniformLocation(r, "uField"), s = e.getUniformLocation(r, "uCssSize"), c = e.getUniformLocation(r, "uRadiant"), l = e.getUniformLocation(r, "uStyle"), u = e.getUniformLocation(r, "uMeteorCount"), d = e.getUniformLocation(r, "uMeteorOrigin[0]"), f = e.getUniformLocation(r, "uMeteorShape[0]");
	return {
		render(p, m, h) {
			let g = h.config;
			(!i || g.seed !== a) && (a = g.seed, i = hi(n, a)), xi(i, g, h.cssW, h.cssH, h.timeSec);
			let _ = g.radiantAngleDeg * Math.PI / 180;
			z(e, p), e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, m), e.uniform1i(o, 0), e.uniform2f(s, Math.max(1, h.cssW), Math.max(1, h.cssH)), e.uniform2f(c, Math.cos(_), Math.sin(_)), e.uniform4f(l, g.brightness, g.headGlow, g.pushPx, g.pushFalloffScale), e.uniform1i(u, i.count), e.uniform4fv(d, i.originData), e.uniform4fv(f, i.shapeData), t.draw();
		},
		dispose() {
			e.deleteProgram(r);
		}
	};
}
//#endregion
//#region src/detonation/detonationSim.ts
var wi = 1684370543, Ti = 96, Ei = 22;
function Di(e) {
	return {
		maxConcurrent: Math.max(1, Math.round(e.maxConcurrent)),
		debrisCount: Math.max(0, Math.round(e.debrisCount))
	};
}
function Oi(e, t) {
	return {
		caps: e,
		random: kt((t ^ wi) >>> 0),
		detonations: [],
		count: 0,
		spawnCount: 0,
		centerData: new Float32Array(e.maxConcurrent * 2),
		lifeData: new Float32Array(e.maxConcurrent * 4)
	};
}
function ki(e) {
	let t = e.debrisLifetimeMs / 1e3 * (1 + e.debrisLifetimeVariation), n = e.ringDurationMs / 1e3, r = e.craterLifeMs / 1e3;
	return Math.max(t, n, r);
}
function Ai(e) {
	return 3 * e * (1 - e) * (1 - e) * .6 + e * e * e;
}
function ji(e) {
	return 3 * e * (1 - e) * (1 - e) * .6 + 3 * e * e * (1 - e) + e * e * e;
}
function Mi(e) {
	if (e <= 0) return 0;
	if (e >= 1) return 1;
	let t = 0, n = 1, r = e;
	for (let i = 0; i < Ei; i++) r = (t + n) * .5, Ai(r) < e ? t = r : n = r;
	return ji(r);
}
function Ni(e, t, n, r, i) {
	let a = Math.max(1, Math.min(e.caps.maxConcurrent, Math.round(t.maxConcurrent)));
	e.detonations.length >= a && e.detonations.splice(0, e.detonations.length - a + 1), e.detonations.push({
		x: n,
		y: r,
		seed: 1 + e.random() * Ti,
		bornAtSec: i
	}), e.spawnCount++;
}
function Pi(e, t, n) {
	let r = ki(t);
	for (let t = e.detonations.length - 1; t >= 0; t--) n - e.detonations[t].bornAtSec > r && e.detonations.splice(t, 1);
	let i = t.flashDurationMs / 1e3;
	e.centerData.fill(0), e.lifeData.fill(0);
	let a = 0;
	for (let t of e.detonations) {
		if (a >= e.caps.maxConcurrent) break;
		let r = Math.max(0, n - t.bornAtSec);
		e.centerData[a * 2] = t.x, e.centerData[a * 2 + 1] = t.y;
		let o = a * 4;
		e.lifeData[o] = r, e.lifeData[o + 1] = t.seed, e.lifeData[o + 2] = Mi(i > 0 ? Math.min(1, r / i) : 1), e.lifeData[o + 3] = 1, a++;
	}
	e.count = a;
}
//#endregion
//#region src/shaders/detonation.frag.ts
function Fi(e, t) {
	return `#version 300 es
precision highp float;

const int MAX_DETONATIONS = ${e};
const int DEBRIS_COUNT = ${t};
const float TAU = 6.2831853;
const float CRATER_PUNCH = 0.12;
const float CRATER_RIM = 0.4;
const float FLASH_GROW = 1.75;
const float FLASH_GLOW_SCALE = 2.9167;
const float FLASH_GLOW_AMOUNT = 0.6;
const float FLASH_GLOW_DECAY = 14.0;
const float RING_END_THICKNESS_RATIO = 0.375;
const float RING_LENS_THICKNESS = 1.0833;
const float RING_LENS_RATIO = 0.5;
const float CRATER_WARP_SCALE = 0.18;
const float CRATER_BAND_SCALE = 0.8;
const float DEBRIS_SIZE_SPREAD = 1.0;
const float DEBRIS_DRAG_SPREAD = 0.1935;
const float DEBRIS_STREAK_SEC = 0.045;
const float DEBRIS_REACH_MARGIN = 1.1;

uniform sampler2D uField;
uniform vec2 uCssSize;
uniform int uDetCount;
uniform vec2 uDetCenter[MAX_DETONATIONS];
uniform vec4 uDetLife[MAX_DETONATIONS];
uniform vec4 uRing;
uniform vec4 uFlash;
uniform vec4 uDebrisA;
uniform vec4 uDebrisB;
uniform vec4 uCrater;
uniform vec4 uCraterExtra;

in vec2 vUv;
out vec4 outColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float shockRadius(float ts, float sc) {
  return uRing.x * sc * pow(ts, 0.42);
}

float shockWobble(float ang, float seed, float ts) {
  return (sin(ang * 5.0 + seed * 11.0) + 0.6 * sin(ang * 9.0 - seed * 7.0) + 0.4 * sin(ang * 13.0 + seed * 3.0)) *
    3.4 * ts;
}

float craterPower(float seed) {
  return 0.86 + 0.3 * hash11(seed * 1.73 + 5.11);
}

float craterAmp(float t) {
  float life = uCraterExtra.x;
  if (t < 0.0 || t > life) return 0.0;
  float punch = 1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6);
  float d = max(t - CRATER_PUNCH, 0.0);
  float fast = exp(-d / max(1e-4, uCrater.z));
  float slow = exp(-d / max(1e-4, uCrater.w));
  float tail = smoothstep(life, life * 0.7, t);
  float defer = mix(0.42, 1.0, smoothstep(0.1, 0.58, t));
  return punch * (0.64 * slow + 0.36 * fast) * tail * defer;
}

float craterRadius(float t, float sc, float seed, float ang) {
  float rim = uCraterExtra.y;
  float grow = 0.34 + 0.66 * (1.0 - pow(1.0 - clamp(t / CRATER_PUNCH, 0.0, 1.0), 2.6));
  float over = 1.0 + 0.12 * rim * sin(3.14159265 * clamp((t - CRATER_PUNCH) / CRATER_RIM, 0.0, 1.0));
  float wob = 1.0 + 0.055 * sin(ang * 3.0 + seed * 7.0) + 0.03 * sin(ang * 5.0 - seed * 3.7);
  float settle = 1.0 - 0.06 * smoothstep(CRATER_PUNCH + CRATER_RIM, uCraterExtra.x * 0.8, t);
  return uCrater.x * sc * grow * over * wob * settle;
}

float craterProfile(float u) {
  float bowl = u * exp(0.5 - 0.5 * u * u);
  float lobe = -0.24 * exp(-pow((u - 1.72) * 1.5, 2.0));
  return bowl + lobe;
}

float craterBands(float u) {
  float rim = exp(-pow((u - 1.0) / 0.32, 2.0));
  float bowl = exp(-pow(u / 0.66, 2.0));
  return (0.26 * rim - 0.2 * bowl) * uCraterExtra.y;
}

void main() {
  float sc = clamp(min(uCssSize.x, uCssSize.y) / 300.0, 0.5, 2.5);
  vec2 pos = vec2(vUv.x, 1.0 - vUv.y) * uCssSize;
  float ringSec = max(1e-4, uRing.y);
  float debrisSec = max(1e-4, uDebrisB.x);
  float debrisDrag = max(0.05, uDebrisA.z);
  float debrisSpan = debrisSec * (1.0 + uDebrisB.y);
  float debrisReach =
    (uDebrisA.x * (1.0 + uDebrisA.y) / debrisDrag + uDebrisA.w * debrisSpan / debrisDrag + uDebrisB.z * 2.0) *
    DEBRIS_REACH_MARGIN;

  vec2 warp = vec2(0.0);
  float craterDelta = 0.0;
  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float t = uDetLife[i].x;
    if (t > uCraterExtra.x) continue;
    float amp = craterAmp(t);
    if (amp <= 0.0) continue;
    float seed = uDetLife[i].y;
    float power = craterPower(seed);
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = craterRadius(t, sc, seed, ang) * power;
    float u = r / R;
    warp -= dir * craterProfile(u) * amp * power * CRATER_WARP_SCALE * uCrater.y * R;
    craterDelta += craterBands(u) * amp * power * CRATER_BAND_SCALE;
  }

  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float ts = uDetLife[i].x / ringSec;
    if (ts >= 1.0) continue;
    float seed = uDetLife[i].y;
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    vec2 dir = d / r;
    float ang = atan(d.y, d.x);
    float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
    float th = mix(uRing.z, uRing.z * RING_END_THICKNESS_RATIO, ts) * sc;
    float band = (r - R) / th;
    float g = exp(-band * band);
    float w = pow(1.0 - ts, 0.85);
    warp += dir * band * g * uRing.w * sc * w;

    float lensTh = th * RING_LENS_THICKNESS;
    float lensBand = (r - R) / lensTh;
    float lensG = exp(-lensBand * lensBand);
    float lensW = pow(1.0 - ts, 0.9);
    warp += dir * lensBand * lensG * uRing.w * RING_LENS_RATIO * sc * lensW;
  }
  vec2 uv = clamp(vUv + vec2(warp.x / uCssSize.x, -warp.y / uCssSize.y), 0.0, 1.0);
  float base = texture(uField, uv).r;

  float add = 0.0;
  float dim = 0.0;
  for (int i = 0; i < MAX_DETONATIONS; i++) {
    if (i >= uDetCount) break;
    float age = uDetLife[i].x;
    float seed = uDetLife[i].y;
    vec2 d = pos - uDetCenter[i];
    float r = max(length(d), 1e-3);
    float ang = atan(d.y, d.x);

    float f = uDetLife[i].z;
    if (f < 1.0) {
      float coreR = mix(uFlash.x, uFlash.x * FLASH_GROW, f) * sc;
      add += smoothstep(coreR, coreR * 0.25, r) * (1.0 - f) * uFlash.y;
    }
    add += exp(-r / (uFlash.x * FLASH_GLOW_SCALE * sc)) * exp(-age * FLASH_GLOW_DECAY) * FLASH_GLOW_AMOUNT * uFlash.y;

    float ts = age / ringSec;
    if (ts < 1.0) {
      float R = shockRadius(ts, sc) + shockWobble(ang, seed, ts) * sc;
      float th = mix(uRing.z, uRing.z * RING_END_THICKNESS_RATIO, ts) * sc;
      float band = (r - R) / th;
      float g = exp(-band * band);
      float w = pow(1.0 - ts, 0.85);
      float grain = 0.82 + 0.18 * sin(ang * 23.0 + seed * 29.0 + ts * 9.0);
      add += g * w * 0.8 * grain;
      float behind = (r - (R - th * 1.9)) / (th * 1.4);
      dim += exp(-behind * behind) * w * 0.24 * smoothstep(0.08, 0.4, ts);
    }

    if (DEBRIS_COUNT > 0 && age < debrisSpan && r < debrisReach * sc) {
      for (int j = 0; j < DEBRIS_COUNT; j++) {
        float fj = float(j);
        float h1 = hash11(seed + fj * 7.13);
        float h2 = hash11(seed + fj * 3.71 + 11.7);
        float h3 = hash11(seed + fj * 5.39 + 29.3);
        float h4 = hash11(seed + fj * 9.02 + 47.9);
        float h5 = hash11(seed + fj * 1.97 + 71.3);
        float life = debrisSec * (1.0 + uDebrisB.y * h3);
        float tt = age / life;
        if (tt >= 1.0) continue;
        float angJ = (fj + (h1 - 0.5) * 0.9) * (TAU / float(DEBRIS_COUNT));
        vec2 dirJ = vec2(cos(angJ), sin(angJ));
        float v0 = uDebrisA.x * (1.0 + uDebrisA.y * h2 * h2) * sc;
        float k = uDebrisA.z * (1.0 + DEBRIS_DRAG_SPREAD * h4);
        float ds = (1.0 - exp(-k * age)) / k;
        float grav = uDebrisA.w * sc;
        vec2 pPos = uDetCenter[i] + dirJ * v0 * ds + vec2(0.0, grav * (age - ds) / k);
        vec2 vel = dirJ * v0 * exp(-k * age) + vec2(0.0, grav * (1.0 - exp(-k * age)) / k);
        vec2 seg = -vel * DEBRIS_STREAK_SEC;
        float segLen2 = max(dot(seg, seg), 1e-4);
        float proj = clamp(dot(pos - pPos, seg) / segLen2, 0.0, 1.0);
        float distSeg = length(pos - (pPos + seg * proj));
        float size = uDebrisB.z * (1.0 + DEBRIS_SIZE_SPREAD * h5) * sc * (1.0 - 0.45 * tt);
        float cool = pow(1.0 - tt, 1.4);
        float flicker = mix(1.0, 0.55 + 0.45 * sin(age * 34.0 + fj * 9.7 + seed), smoothstep(0.35, 0.9, tt));
        add += smoothstep(size, size * 0.15, distSeg) * cool * flicker * uDebrisB.w;
      }
    }
  }

  float value = clamp(base * (1.0 - min(dim, 0.6)) + add + craterDelta, 0.0, 1.0);
  outColor = vec4(vec3(value), 1.0);
}
`;
}
//#endregion
//#region src/passes/detonationPass.ts
function Ii(e, t, n) {
	let r = P(e, B, Fi(n.maxConcurrent, n.debrisCount)), i = e.getUniformLocation(r, "uField"), a = e.getUniformLocation(r, "uCssSize"), o = e.getUniformLocation(r, "uDetCount"), s = e.getUniformLocation(r, "uDetCenter[0]"), c = e.getUniformLocation(r, "uDetLife[0]"), l = e.getUniformLocation(r, "uRing"), u = e.getUniformLocation(r, "uFlash"), d = e.getUniformLocation(r, "uDebrisA"), f = e.getUniformLocation(r, "uDebrisB"), p = e.getUniformLocation(r, "uCrater"), m = e.getUniformLocation(r, "uCraterExtra");
	return {
		render(n, h, g) {
			let _ = g.config, v = g.state;
			Pi(v, _, g.timeSec), z(e, n), e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, h), e.uniform1i(i, 0), e.uniform2f(a, Math.max(1, g.cssW), Math.max(1, g.cssH)), e.uniform1i(o, v.count), e.uniform2fv(s, v.centerData), e.uniform4fv(c, v.lifeData), e.uniform4f(l, _.ringReachPx, _.ringDurationMs / 1e3, _.ringThicknessPx, _.ringRefractionPx), e.uniform4f(u, _.flashRadiusPx, _.flashBrightness, _.flashDurationMs / 1e3, 0), e.uniform4f(d, _.debrisSpeedPxPerSec, _.debrisSpeedVariation, _.debrisDrag, _.debrisGravityPxPerSec2), e.uniform4f(f, _.debrisLifetimeMs / 1e3, _.debrisLifetimeVariation, _.debrisSizePx, _.debrisBrightness), e.uniform4f(p, _.craterRadiusPx, _.craterDepth, _.craterRelaxFastMs / 1e3, _.craterRelaxSlowMs / 1e3), e.uniform4f(m, _.craterLifeMs / 1e3, _.craterRimStrength, 0, 0), t.draw();
		},
		dispose() {
			e.deleteProgram(r);
		}
	};
}
var Li = 16.67;
function Ri(e, t) {
	let n = Math.sin(e * 12.9898 + t * 78.233) * 43758.5453;
	return n - Math.floor(n);
}
function zi(e, t) {
	let n = Math.hypot(e.vx, e.vy), r = n > 0 ? -e.vx / n * t.pushLagPx : 0, i = n > 0 ? -e.vy / n * t.pushLagPx : 0, a = Math.cos(e.seed * 1.37 + e.ageMs * .01) * t.pushWobblePx, o = Math.sin(e.seed * 1.91 + e.ageMs * .012) * t.pushWobblePx;
	return {
		x: e.x + r + a,
		y: e.y + i + o
	};
}
function Bi(e, t, n, r, i) {
	let a = e.nextSeed++, o = Ri(a, 1) * Math.PI * 2, s = i.spreadMinPx + Ri(a, 2) * (i.spreadMaxPx - i.spreadMinPx), c = r > 0 ? {
		x: -n.y / r,
		y: n.x / r
	} : {
		x: 0,
		y: 0
	}, l = Ri(a, 3) * 2 - 1;
	return {
		x: t.x + Math.cos(o) * s,
		y: t.y + Math.sin(o) * s,
		vx: n.x * i.particleVelocityScale + c.x * l * i.particleTangentVelocity,
		vy: n.y * i.particleVelocityScale + c.y * l * i.particleTangentVelocity,
		ageMs: 0,
		lifeMs: i.particleLifeMs + Ri(a, 4) * i.particleLifeJitterMs,
		radius: i.particleRadius * (.75 + Ri(a, 5) * .8),
		spin: (Ri(a, 6) * 2 - 1) * i.spinStrength,
		seed: a
	};
}
function Vi() {
	return {
		current: {
			x: 0,
			y: 0
		},
		velocity: {
			x: 0,
			y: 0
		},
		target: null,
		drops: [],
		hasPointer: !1,
		clearFramesRemaining: 0,
		emitRemainder: 0,
		lastEmit: null,
		nextSeed: 1
	};
}
function Hi(e, t) {
	if (e.target = t, !t) {
		e.hasPointer = !1;
		return;
	}
	e.hasPointer || (e.current = { ...t }, e.velocity = {
		x: 0,
		y: 0
	}, e.lastEmit = { ...t }), e.hasPointer = !0;
}
function Ui(e, t, n = b) {
	let r = T(n), i = Math.max(0, Math.min(48, t || 16.67)), a = e.drops.length > 0, o = i / Li;
	if (!r.enabled) {
		e.drops = [], e.emitRemainder = 0, a && (e.clearFramesRemaining = 10);
		let t = e.clearFramesRemaining > 0;
		return t && e.clearFramesRemaining--, {
			samples: [],
			changed: t
		};
	}
	if (e.target) {
		let t = e.current;
		e.current = { ...e.target };
		let n = {
			x: (e.current.x - t.x) / o,
			y: (e.current.y - t.y) / o
		}, i = r.emitterVelocitySmoothing ** +o;
		e.velocity = {
			x: e.velocity.x * i + n.x * (1 - i),
			y: e.velocity.y * i + n.y * (1 - i)
		};
		let a = Math.hypot(e.velocity.x, e.velocity.y), s = e.lastEmit ?? e.current, c = Math.hypot(e.current.x - s.x, e.current.y - s.y) / r.particleSpacingPx + o + e.emitRemainder, l = Math.min(Math.max(1, Math.round(r.maxEmitPerTick * o)), Math.floor(c));
		e.emitRemainder = c % 1;
		for (let t = 0; t < l; t++) {
			let n = l <= 1 ? 1 : t / (l - 1), i = {
				x: s.x + (e.current.x - s.x) * n,
				y: s.y + (e.current.y - s.y) * n
			};
			e.drops.push(Bi(e, i, e.velocity, a, r));
		}
		e.lastEmit = { ...e.current };
	}
	let s = r.particleDamping ** +o, c = [], l = [];
	for (let t of e.drops) {
		let e = t.ageMs + i;
		if (e >= t.lifeMs) continue;
		let n = 1 - e / t.lifeMs, a = Math.sin(t.x * .017 + t.y * .013 + t.seed) * t.spin * o, u = (t.vx - t.vy * a) * s, d = (t.vy + t.vx * a) * s, f = {
			...t,
			ageMs: e,
			vx: u,
			vy: d,
			x: t.x + u * o,
			y: t.y + d * o
		}, p = zi(f, r);
		l.push(f), c.push({
			x: f.x,
			y: f.y,
			pushX: p.x,
			pushY: p.y,
			radius: f.radius * (r.densityRadiusMinScale + n * r.densityRadiusLifeScale),
			alpha: r.particleAlpha * n * n,
			progress: 1 - n,
			seed: t.seed
		});
	}
	e.drops = l, a && l.length === 0 && (e.clearFramesRemaining = 10);
	let u = c.length === 0 && e.clearFramesRemaining > 0;
	return u && e.clearFramesRemaining--, {
		samples: c,
		changed: c.length > 0 || u
	};
}
//#endregion
//#region src/cursorTrail/clickWaveSim.ts
var Wi = 10, Gi = 48;
function Ki(e) {
	return Math.max(0, Math.min(1, e));
}
function qi(e) {
	let t = 1 - Ki(e);
	return 1 - t * t * t * t;
}
function Ji(e) {
	return Math.max(0, 1 - e) ** .45;
}
function Yi(e, t) {
	let n = 1.35 - .35 * t;
	return Ji(e) * n;
}
function Xi() {
	return {
		waves: [],
		clearFramesRemaining: 0,
		nextSeed: 1
	};
}
function Zi(e, t, n) {
	e.waves.push({
		x: t.x,
		y: t.y,
		ageMs: 0,
		lifeMs: Math.max(1, n),
		seed: e.nextSeed++
	});
}
function Qi(e, t, n = o) {
	let r = E(n), i = Math.max(0, Math.min(Gi, t || 16.67)), a = e.waves.length > 0;
	if (!r.enabled) {
		e.waves = [], a && (e.clearFramesRemaining = Wi);
		let t = e.clearFramesRemaining > 0;
		return t && e.clearFramesRemaining--, {
			samples: [],
			changed: t
		};
	}
	e.waves.length > r.maxWaves && e.waves.splice(0, e.waves.length - r.maxWaves);
	let s = [], c = [];
	for (let t of e.waves) {
		let e = t.ageMs + i;
		if (e >= t.lifeMs) continue;
		let n = e / t.lifeMs, a = qi(n), o = r.startRadiusPx + (r.maxRadiusPx - r.startRadiusPx) * a, l = r.startStrokeWidthPx + (r.endStrokeWidthPx - r.startStrokeWidthPx) * n, u = 1 - n;
		c.push({
			...t,
			ageMs: e
		}), s.push({
			x: t.x,
			y: t.y,
			radius: o,
			strokeWidth: Math.max(r.endStrokeWidthPx, l),
			waveProgress: n,
			pushPower: u * u * (3 - 2 * u),
			whitePower: Yi(n, a),
			seed: t.seed
		});
	}
	e.waves = c, a && c.length === 0 && (e.clearFramesRemaining = Wi);
	let l = s.length === 0 && e.clearFramesRemaining > 0;
	return l && e.clearFramesRemaining--, {
		samples: s,
		changed: s.length > 0 || l
	};
}
//#endregion
//#region src/cursorTrail/waterActivityReporter.ts
var $i = .01;
function ea(e) {
	let t = 0;
	return {
		report(n) {
			Math.abs(n - t) <= $i || (t = n, e?.(n));
		},
		settle() {
			t !== 0 && (t = 0, e?.(0));
		}
	};
}
//#endregion
//#region src/core/simSteps.ts
var ta = 30, na = 1 / ta;
ta * 15;
var ra = .1;
Math.round(ra * 450);
function ia(e = 450) {
	let t = Math.round(ra * e), n = 0;
	return { take(r) {
		if (!(r > 0)) return 0;
		n += Math.min(r, ra) * e;
		let i = Math.min(Math.floor(n + 1e-6), t);
		return i <= 0 ? 0 : (n = Math.max(0, n - i), i);
	} };
}
//#endregion
//#region src/cursorTrail/waterStroke.ts
var aa = .12, oa = 400, sa = .45;
function ca() {
	let e = ia(), t = !1, n = 0, r = 0, i = 0, a = -Infinity, o = 0, s = 0;
	return { advance(c, l, u) {
		let d = e.take(l), f = 0, p = 0, m = 0, h = 0, g = 0;
		if (u) {
			h = u.x, g = u.y, t ||= (n = h, r = g, i = 0, !0), p = n, m = r, i += l;
			let e = i > 0 ? Math.hypot(h - p, g - m) / i * na : 0;
			f = Math.min(1, e * aa), d > 0 && (n = h, r = g, i = 0);
		} else {
			t && (a = c, o = n, s = r), t = !1, i = 0;
			let e = (c - a) / oa;
			if (e >= 0 && e < 1) {
				let t = 1 - e;
				f = sa * t * t, p = h = o, m = g = s;
			}
		}
		return {
			substeps: d,
			ax: p,
			ay: m,
			bx: h,
			by: g,
			amp: f
		};
	} };
}
//#endregion
//#region src/gl/pingPong.ts
function la(e, t, n, r = {}) {
	let i = R(e, t, n, r), a = R(e, t, n, r);
	return {
		read: () => i,
		write: () => a,
		swap: () => {
			let e = i;
			i = a, a = e;
		},
		resize: (t, n) => {
			_e(e, i, t, n), _e(e, a, t, n);
		},
		dispose: () => {
			ve(e, i), ve(e, a);
		}
	};
}
//#endregion
//#region src/shaders/waterSim.frag.ts
var ua = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uPrev;      // rg = height, velocity\nuniform vec2 uTexel;          // 1/simW, 1/simH\nuniform vec2 uSplatA;         // segment start, sim pixels\nuniform vec2 uSplatB;         // segment end, sim pixels\nuniform float uSplatAmp;\nuniform float uSplatRadius;\nout vec4 outColor;\n\n// Spring-coupled heightfield. CLAMP_TO_EDGE sampling makes the borders\n// reflect softly, so waves bounce off the canvas walls.\nvoid main() {\n  vec2 hv = texture(uPrev, vUv).rg;\n  float hL = texture(uPrev, vUv - vec2(uTexel.x, 0.0)).r;\n  float hR = texture(uPrev, vUv + vec2(uTexel.x, 0.0)).r;\n  float hT = texture(uPrev, vUv + vec2(0.0, uTexel.y)).r;\n  float hB = texture(uPrev, vUv - vec2(0.0, uTexel.y)).r;\n  float lap = (hL + hR + hT + hB) * 0.25 - hv.r;\n\n  // Value noise breaks the stiffness up so wavefronts stay irregular\n  // instead of collapsing into perfect circles.\n  vec2 np = vUv / uTexel * 0.02;\n  vec2 ni = floor(np);\n  vec2 nf = fract(np);\n  float n00 = fract(sin(dot(ni, vec2(127.1, 311.7))) * 43758.5453);\n  float n10 = fract(sin(dot(ni + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);\n  float n01 = fract(sin(dot(ni + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);\n  float n11 = fract(sin(dot(ni + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);\n  vec2 sf = nf * nf * (3.0 - 2.0 * nf);\n  float wn = mix(mix(n00, n10, sf.x), mix(n01, n11, sf.x), sf.y);\n\n  float vel = (hv.g + lap * (0.45 * (0.80 + 0.30 * wn))) * 0.98555;\n  float h = (hv.r + vel) * 0.9956;\n  h = mix(h, (hL + hR + hT + hB) * 0.25, 0.06); // viscosity\n\n  if (uSplatAmp != 0.0) {\n    vec2 pos = vUv / uTexel;\n    vec2 ba = uSplatB - uSplatA;\n    float bl = length(ba);\n    float rr = uSplatRadius;\n    if (bl > 0.5) {\n      // Swept segment: a capsule crest anchored on the cursor path, with a\n      // weaker trailing lobe behind it so the stroke reads as a dipole wake.\n      vec2 nd = ba / bl;\n      vec2 offs = nd * rr * 1.4;\n      float angS = atan(pos.y - uSplatA.y, pos.x - uSplatA.x);\n      float wobS = 1.0 + 0.24 * sin(angS * 3.0 + wn * 6.2831);\n      vec2 paF = pos - uSplatA;\n      float ttF = clamp(dot(paF, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);\n      vec2 dpF = paF - ba * ttF;\n      vec2 paB = pos - (uSplatA - offs);\n      float ttB = clamp(dot(paB, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);\n      vec2 dpB = paB - ba * ttB;\n      h += uSplatAmp * (exp(-dot(dpF, dpF) / (2.0 * rr * rr * wobS))\n                       - 0.45 * exp(-dot(dpB, dpB) / (2.0 * rr * rr * wobS)));\n    } else {\n      vec2 dp = pos - uSplatA;\n      float ang = atan(dp.y, dp.x);\n      float wob = 1.0 + 0.30 * sin(ang * 3.0 + wn * 6.2831) + 0.18 * sin(ang * 5.0 - wn * 4.0);\n      h += uSplatAmp * exp(-dot(dp, dp) / (2.0 * rr * rr * wob));\n    }\n  }\n\n  outColor = vec4(h, vel, 0.0, 1.0);\n}\n";
//#endregion
//#region src/passes/waterSimPass.ts
function da(e, t) {
	let n = P(e, B, ua), r = (t) => e.getUniformLocation(n, t), i = {
		prev: r("uPrev"),
		texel: r("uTexel"),
		splatA: r("uSplatA"),
		splatB: r("uSplatB"),
		amp: r("uSplatAmp"),
		radius: r("uSplatRadius")
	};
	return {
		render(r, a, o) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a.texture), e.uniform1i(i.prev, 0), e.uniform2f(i.texel, o.texelX, o.texelY), e.uniform2f(i.splatA, o.ax, o.ay), e.uniform2f(i.splatB, o.bx, o.by), e.uniform1f(i.amp, o.amp), e.uniform1f(i.radius, o.radius), t.draw(), e.bindFramebuffer(e.FRAMEBUFFER, null);
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/cursorTrail/waterSim.ts
var fa = 2, pa = 420, ma = 7, ha = .5, ga = 6e3, _a = 1.65, va = .5;
function ya(e, t) {
	let n = da(e, t), r = ca(), i = null, a = 0, o = 0, s = null, c = !1, l = -Infinity, u = 0, d = -1;
	function f() {
		if (i) {
			for (let t of [i.read(), i.write()]) z(e, t), e.clearColor(0, 0, 0, 1), e.clear(e.COLOR_BUFFER_BIT);
			e.bindFramebuffer(e.FRAMEBUFFER, null);
		}
	}
	function p(t, r, u, d) {
		let { ax: p, ay: m, bx: h, by: g, amp: _, substeps: v } = r;
		if (c) {
			s = null;
			return;
		}
		if (_ !== 0 && (l = t), t - l > ga) {
			s = null;
			return;
		}
		let y = Math.max(1, Math.round(u / fa)), b = Math.max(1, Math.round(d / fa)), x = Math.max(y, b);
		if (x > pa) {
			let e = pa / x;
			y = Math.max(1, Math.round(y * e)), b = Math.max(1, Math.round(b * e));
		}
		try {
			if (i) (y !== a || b !== o) && (i.resize(y, b), a = y, o = b, f());
			else {
				if (!e.getExtension("EXT_color_buffer_float")) throw Error("EXT_color_buffer_float unavailable");
				i = la(e, y, b, {
					float: !0,
					linear: !0
				}), a = y, o = b, f();
			}
			let t = _ === 0 ? 0 : p / Math.max(1, u) * y, r = _ === 0 ? 0 : (d - m) / Math.max(1, d) * b, c = _ === 0 ? 0 : h / Math.max(1, u) * y, l = _ === 0 ? 0 : (d - g) / Math.max(1, d) * b;
			for (let e = 0; e < v; e++) {
				let a = e / v, o = (e + 1) / v;
				n.render(i.write(), i.read(), {
					texelX: 1 / y,
					texelY: 1 / b,
					ax: t + (c - t) * a,
					ay: r + (l - r) * a,
					bx: t + (c - t) * o,
					by: r + (l - r) * o,
					amp: _ * ha,
					radius: ma
				}), i.swap();
			}
			s = i.read().texture;
		} catch (e) {
			c = !0, s = null, console.warn("[stripes-engine] water sim disabled:", e);
		}
	}
	return {
		tick(e, t, n, i) {
			let a = d < 0 ? 0 : Math.max(0, Math.min(ra, (e - d) / 1e3));
			d = e;
			let o = r.advance(e, a, t), s = o.amp === 0 ? 0 : Math.min(1, Math.abs(o.amp) * 3.2);
			u += (s - u) * (1 - Math.exp(-a / va)), p(e, o, n, i);
		},
		current() {
			return !s || a === 0 || o === 0 ? null : {
				texture: s,
				gain: _a,
				texelX: 1 / a,
				texelY: 1 / o
			};
		},
		resetActivity() {
			u = 0;
		},
		activity() {
			return u;
		},
		dispose() {
			n.dispose(), i?.dispose(), i = null, s = null;
		}
	};
}
//#endregion
//#region src/flames/vortexSingular.ts
var ba = 1.35, xa = .35, Sa = .45, Ca = 600, wa = 700, Ta = 250, Ea = 3, Da = .2, Oa = 1.618;
function ka(e) {
	let t = Math.min(1, Math.max(0, e));
	return t * t * (3 - 2 * t);
}
function Aa(e, t) {
	if (t <= 0) return 0;
	let n = Math.min(Ca, t * .25);
	return ka((t - e) / n);
}
function ja(e, t) {
	return t.segCount * t.segSpacingPx / Math.max(1, e) * 1e3;
}
function Ma(e, t) {
	if (e.hidden) return 0;
	let n = ka((t - e.shownAtMs) / Ta), r = ka((e.phaseEndMs - t) / wa);
	return Math.min(n, r);
}
function Na(e, t, n) {
	let r = Math.sin(t * e.turnFreq1 + e.turnPhase1) + .6 * Math.sin(t * e.turnFreq2 + e.turnPhase2);
	return n.turnRate * e.turnDir * (1 + n.turnVariation * r);
}
function Pa(e, t, n, r) {
	if (r <= 0) return 0;
	let i = Math.min(e.x, e.y, t - e.x, n - e.y);
	if (i >= r) return 0;
	let a = Math.min(1, (r - i) / r), o = Math.atan2(n * .5 - e.y, t * .5 - e.x), s = Math.atan2(Math.sin(o - e.heading), Math.cos(o - e.heading));
	return a * a * Ea * s;
}
function Fa(e, t, n, r, i) {
	let a = t.vortexSingular, o = t.baseSpeedPxPerSec * .5 * t.speedVariation, s = J(Math.max(1, t.baseSpeedPxPerSec - o), t.baseSpeedPxPerSec + o, e()), c = J(a.lifeMinMs, a.lifeMaxMs, e()), l = ja(s, a), u = J(a.visibleMinMs, a.visibleMaxMs, e()), d = e() * n.width, f = e() * n.height;
	return {
		x: d,
		y: f,
		heading: e() * Math.PI * 2,
		speedPxPerSec: s,
		thickness: Math.max(1, J(t.minWidthRatio, t.maxWidthRatio, e()) * n.width),
		turnDir: e() < .5 ? -1 : 1,
		turnFreq1: J(.15, .4, e()),
		turnFreq2: J(.15, .4, e()) * Oa,
		turnPhase1: e() * Math.PI * 2,
		turnPhase2: e() * Math.PI * 2,
		bornMs: i ? r - e() * c * .8 : r,
		lifeMs: c,
		baseOpacity: J(t.opacityMin, t.opacityMax, e()),
		colorSeed: e(),
		hidden: !1,
		phaseEndMs: r + (i ? e() * (l + u) : l + u),
		shownAtMs: r,
		trailX: [d],
		trailY: [f]
	};
}
function Ia(e, t) {
	let n = t.segCount * t.segSpacingPx * 1.25 + 40, r = e.trailX, i = e.trailY, a = 0;
	for (let e = r.length - 1; e > 0; e--) if (a += Math.hypot(r[e] - r[e - 1], i[e] - i[e - 1]), a > n) {
		e > 1 && (r.splice(0, e - 1), i.splice(0, e - 1));
		return;
	}
}
function La(e, t, n, r) {
	let i = t.trailX, a = t.trailY, o = n.segSpacingPx * ba, s = 0, c = 0;
	for (let l = i.length - 1; l > 0 && s < n.segCount; l--) {
		let u = i[l], d = a[l], f = i[l - 1], p = a[l - 1], m = Math.hypot(f - u, p - d);
		if (m <= 0) continue;
		let h = Math.atan2(d - p, u - f);
		for (; s < n.segCount && s * n.segSpacingPx <= c + m;) {
			let i = (s * n.segSpacingPx - c) / m, a = 1 - s / n.segCount, l = Math.max(1, t.thickness * (xa + (1 - xa) * a));
			e.push({
				x: J(u, f, i) - o * .5,
				y: J(d, p, i) - l * .5,
				width: o,
				height: l,
				speedPxPerSec: t.speedPxPerSec,
				opacity: t.baseOpacity * (Sa + (1 - Sa) * a) * r,
				colorSeed: t.colorSeed,
				direction: "vortexSingular",
				rot: h
			}), s++;
		}
		c += m;
	}
}
function Ra(e, t, n) {
	let r = t.vortexSingular, i = [];
	for (let t of e.tails) {
		Ia(t, r);
		let e = Aa(n - t.bornMs, t.lifeMs) * Ma(t, n);
		e <= .001 || La(i, t, r, e);
	}
	e.flames = i;
}
function za(e, t, n, r) {
	let i = t.vortexSingular;
	if (e.lastStepMs <= 0) {
		e.lastStepMs = r, e.lastSpawnMs = r, e.tails = [];
		for (let i = 0; i < t.maxActive; i++) e.tails.push(Fa(e.random, t, n, r, !0));
		Ra(e, t, r);
		return;
	}
	let a = Math.min(.1, Math.max(0, (r - e.lastStepMs) / 1e3));
	for (e.lastStepMs = r; e.tails.length < t.maxActive;) e.tails.push(Fa(e.random, t, n, r, !1));
	e.tails.length > t.maxActive && (e.tails.length = t.maxActive);
	let o = i.edgeMarginRatio * Math.min(n.width, n.height);
	for (let s = 0; s < e.tails.length; s++) {
		let c = e.tails[s];
		r - c.bornMs >= c.lifeMs && (c = Fa(e.random, t, n, r, !1), e.tails[s] = c), !c.hidden && r >= c.phaseEndMs ? (c.hidden = !0, c.phaseEndMs = r + J(i.hiddenMinMs, i.hiddenMaxMs, e.random())) : c.hidden && r >= c.phaseEndMs && (c.hidden = !1, c.shownAtMs = r, c.phaseEndMs = r + ja(c.speedPxPerSec, i) + J(i.visibleMinMs, i.visibleMaxMs, e.random()), c.trailX = [c.x], c.trailY = [c.y]);
		let l = (r - c.bornMs) / 1e3, u = Na(c, l, i) + Pa(c, n.width, n.height, o);
		c.heading += u * a, c.x += Math.cos(c.heading) * c.speedPxPerSec * a, c.y += Math.sin(c.heading) * c.speedPxPerSec * a;
		let d = c.trailX.length - 1;
		Math.hypot(c.x - c.trailX[d], c.y - c.trailY[d]) >= Da && (c.trailX.push(c.x), c.trailY.push(c.y));
	}
	Ra(e, t, r);
}
//#endregion
//#region src/flames/flamesSim.ts
function Ba(e) {
	return {
		flames: [],
		tails: [],
		lastSpawnMs: 0,
		lastStepMs: 0,
		random: e
	};
}
function Va(e, t, n) {
	return J(t, n, e());
}
function Ha(e, t, n, r) {
	return Va(e, t * n, t * r);
}
function Ua(e, t, n) {
	return Va(e, 0, Math.max(0, t - n));
}
function Wa(e) {
	return e === "up" || e === "down" || e === "upDown";
}
function Ga(e) {
	switch (e) {
		case "upDown": return ["up", "down"];
		case "leftRight": return ["left", "right"];
		default: return [e];
	}
}
function Ka(e, t) {
	let n = Ga(t);
	return n[Math.floor(e.random() * n.length) % n.length];
}
function qa(e) {
	let t = .4 + -.34 * Math.min(1, Math.max(0, e));
	return {
		inner: .5 - t,
		outer: .5 + t
	};
}
function Ja(e) {
	let t = e.baseSpeedPxPerSec * .5 * e.speedVariation;
	return {
		minPxPerSec: Math.max(1, e.baseSpeedPxPerSec - t),
		maxPxPerSec: e.baseSpeedPxPerSec + t
	};
}
function Ya(e, t, n, r) {
	let i = Math.imul(Math.round(e * 977) ^ 2654435769, 2246822507);
	return i = Math.imul(i ^ Math.round(t * 1013), 3266489909), i = Math.imul(i ^ Math.round(n * 131), 668265263), i = Math.imul(i ^ Math.round(r * 100003), 374761393), i ^= i >>> 15, (i >>> 0) / 4294967296;
}
function Xa(e, t, n, r, i) {
	let a = Ha(e.random, n, t.minWidthRatio, t.maxWidthRatio), o = Ha(e.random, r, t.minHeightRatio, t.maxHeightRatio), s = Ja(t), c = Va(e.random, s.minPxPerSec, s.maxPxPerSec), l = Va(e.random, t.opacityMin, t.opacityMax), u = {
		width: a,
		height: o,
		speedPxPerSec: c,
		opacity: l,
		colorSeed: Ya(a, o, c, l),
		direction: i,
		rot: 0
	};
	return Wa(i) ? {
		...u,
		x: Ua(e.random, n, a),
		y: 0
	} : {
		...u,
		x: 0,
		y: Ua(e.random, r, o)
	};
}
function Za(e, t, n, r) {
	switch (t) {
		case "up":
			e.y = r;
			break;
		case "down":
			e.y = -e.height;
			break;
		case "left":
			e.x = n;
			break;
		case "right":
			e.x = -e.width;
			break;
	}
}
function Qa(e, t, n, r, i) {
	if (Wa(t)) {
		e.y = Va(i, -e.height, r);
		return;
	}
	e.x = Va(i, -e.width, n);
}
function $a(e, t, n, r) {
	let i = Xa(e, t, n, r, Ka(e, t.direction));
	return Za(i, i.direction, n, r), i;
}
function eo(e, t, n, r) {
	if (!(!t.enabled || e.flames.length > 0 || n <= 0 || r <= 0)) for (let i = 0; i < t.maxActive; i++) {
		let i = Xa(e, t, n, r, Ka(e, t.direction));
		Qa(i, i.direction, n, r, e.random), e.flames.push(i);
	}
}
function to(e, t) {
	switch (e.direction) {
		case "up": return e.y + e.height >= 0;
		case "down": return e.y <= t.height;
		case "left": return e.x + e.width >= 0;
		case "right": return e.x <= t.width;
		default: return !1;
	}
}
function no(e, t, n, r) {
	if (!t.enabled || n.width <= 0 || n.height <= 0) return;
	if (t.direction === "vortexSingular") {
		za(e, t, n, r);
		return;
	}
	if (e.lastStepMs <= 0) {
		e.lastStepMs = r, e.lastSpawnMs = r, eo(e, t, n.width, n.height);
		return;
	}
	let i = Math.max(0, (r - e.lastStepMs) / 1e3);
	e.lastStepMs = r;
	for (let t of e.flames) switch (t.direction) {
		case "up":
			t.y -= t.speedPxPerSec * i;
			break;
		case "down":
			t.y += t.speedPxPerSec * i;
			break;
		case "left":
			t.x -= t.speedPxPerSec * i;
			break;
		case "right":
			t.x += t.speedPxPerSec * i;
			break;
	}
	e.flames = e.flames.filter((e) => to(e, n)), e.flames.length > t.maxActive && (e.flames.length = t.maxActive);
	let a = t.spawnIntervalMs + Va(e.random, -t.spawnJitterMs, t.spawnJitterMs);
	!(e.flames.length >= t.maxActive) && r - e.lastSpawnMs >= a && (e.flames.push($a(e, t, n.width, n.height)), e.lastSpawnMs = r);
}
//#endregion
//#region src/perf/gpuTimer.ts
function ro(e, t = !0) {
	let n = t ? e.getExtension("EXT_disjoint_timer_query_webgl2") : null;
	if (!n) return {
		supported: !1,
		begin() {},
		end() {},
		poll() {},
		latest: () => ({})
	};
	let r = [], i = {}, a = null;
	return {
		supported: !0,
		begin(t) {
			a &&= (e.endQuery(n.TIME_ELAPSED_EXT), r.push(a), null);
			let i = e.createQuery();
			i && (a = {
				name: t,
				query: i
			}, e.beginQuery(n.TIME_ELAPSED_EXT, i));
		},
		end() {
			a &&= (e.endQuery(n.TIME_ELAPSED_EXT), r.push(a), null);
		},
		poll() {
			let t = e.getParameter(n.GPU_DISJOINT_EXT);
			for (let n = r.length - 1; n >= 0; n--) {
				let a = r[n], o = e.getQueryParameter(a.query, e.QUERY_RESULT_AVAILABLE);
				if (o || t) {
					if (o && !t) {
						let t = e.getQueryParameter(a.query, e.QUERY_RESULT);
						i[a.name] = t / 1e6;
					}
					e.deleteQuery(a.query), r.splice(n, 1);
				}
			}
		},
		latest: () => ({ ...i })
	};
}
//#endregion
//#region src/perf/percentiles.ts
function io(e, t) {
	if (e.length === 0) return 0;
	let n = [...e].sort((e, t) => e - t), r = Math.ceil(t * n.length);
	return n[Math.min(n.length - 1, Math.max(0, r - 1))];
}
//#endregion
//#region src/perf/perfCollector.ts
function ao(e = 240) {
	let t = [], n = {};
	return {
		recordFrame(n) {
			t.push(n), t.length > e && t.shift();
		},
		recordPasses(e) {
			n = e;
		},
		reset() {
			t.length = 0, n = {};
		},
		snapshot() {
			let e = io(t, .5);
			return {
				fps: e > 0 ? 1e3 / e : 0,
				frameMs: {
					p50: e,
					p95: io(t, .95),
					p99: io(t, .99)
				},
				passMs: { ...n },
				sampleCount: t.length
			};
		}
	};
}
//#endregion
//#region src/pipeline/rtPool.ts
function oo(e) {
	let t = /* @__PURE__ */ new Map();
	return {
		get(n, r, i, a) {
			let o = t.get(n);
			if (o) return _e(e, o, r, i), o;
			let s = R(e, r, i, a);
			return t.set(n, s), s;
		},
		dispose() {
			for (let n of t.values()) ve(e, n);
			t.clear();
		}
	};
}
//#endregion
//#region src/pipeline/pipeline.ts
function so(e, t) {
	for (let n of e) {
		t.begin(n.name), fe(n.name);
		try {
			n.render();
		} finally {
			t.end(), pe();
		}
	}
}
//#endregion
//#region src/source/sourceTexture.ts
function co(e) {
	return typeof HTMLVideoElement < "u" && e instanceof HTMLVideoElement;
}
function lo(e) {
	return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement;
}
function uo(e) {
	return typeof VideoFrame < "u" && e instanceof VideoFrame;
}
function fo(e) {
	return co(e) ? {
		width: e.videoWidth || 1,
		height: e.videoHeight || 1
	} : lo(e) ? {
		width: e.naturalWidth || 1,
		height: e.naturalHeight || 1
	} : uo(e) ? {
		width: e.displayWidth || 1,
		height: e.displayHeight || 1
	} : {
		width: e.width || 1,
		height: e.height || 1
	};
}
function po(e, t) {
	let n = e.createTexture();
	if (!n) throw Error("Failed to create source texture");
	let r = co(t), { width: i, height: a } = fo(t);
	function o(t) {
		e.bindTexture(e.TEXTURE_2D, n), e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, !0), e.texImage2D(e.TEXTURE_2D, 0, e.RGBA, e.RGBA, e.UNSIGNED_BYTE, t), e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL, !1);
	}
	return e.bindTexture(e.TEXTURE_2D, n), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE), e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE), o(t), {
		texture: n,
		get width() {
			return i;
		},
		get height() {
			return a;
		},
		isVideo: r,
		update() {
			if (!r) return;
			let e = t;
			e.readyState < 2 || (i = e.videoWidth || i, a = e.videoHeight || a, o(t));
		},
		uploadFrame(e) {
			let t = fo(e);
			i = t.width || i, a = t.height || a, o(e);
		},
		dispose() {
			e.deleteTexture(n);
		}
	};
}
//#endregion
//#region src/source/fit.ts
function mo(e, t, n, r, i, a, o, s) {
	if (t <= 0 || r <= 0 || e <= 0 || n <= 0 || a <= 0) return {
		u0: 0,
		v0: 0,
		u1: 1,
		v1: 1
	};
	let c = 1, l = 1, u = e / t, d = n / r;
	i === "width" ? l = u / d : i === "height" ? c = d / u : i !== "stretch" && (i === "cover" ? u > d ? c = d / u : l = u / d : u > d ? l = u / d : c = d / u), c /= a, l /= a;
	let f = .5 + o * c * .5, p = .5 + s * l * .5;
	return {
		u0: f - c / 2,
		v0: p - l / 2,
		u1: f + c / 2,
		v1: p + l / 2
	};
}
//#endregion
//#region src/config/cellGrid.ts
function ho(e, t, n, r) {
	return {
		cols: Math.max(1, Math.ceil(e / n)),
		rows: Math.max(1, Math.ceil(t / r))
	};
}
function go(e, t) {
	let n = -1;
	for (let r = 0; r < e.length; r++) e[r].startFrom <= t && (n = r);
	return n;
}
function _o(e) {
	let t = new Uint8Array(256 * 4);
	if (e.length === 0) return t;
	let n = [...e].sort((e, t) => e.startFrom - t.startFrom);
	for (let e = 0; e < 256; e++) {
		let r = go(n, e / 255), i = e * 4;
		if (r < 0) {
			t[i] = t[i + 1] = t[i + 2] = t[i + 3] = 0;
			continue;
		}
		let a = n[r];
		t[i] = a.color >> 16 & 255, t[i + 1] = a.color >> 8 & 255, t[i + 2] = a.color & 255, t[i + 3] = Math.max(0, Math.min(255, Math.round(a.width * 2)));
	}
	return t;
}
function vo(e, t) {
	let n = [...e].sort((e, t) => e.startFrom - t.startFrom), r = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 0, i = n.map((e, t) => ({
		band: t,
		stripe: e
	})).filter(({ stripe: e }) => e.width >= 2 && e.opacity > .001).sort((e, t) => t.stripe.startFrom - e.stripe.startFrom || t.band - e.band), a = r <= 0 ? 0 : Math.ceil(i.length * r), o = new Set(i.slice(0, a).map(({ band: e }) => e));
	return n.map((e, t) => o.has(t));
}
function yo(e, t = 1) {
	let n = new Uint8Array(256 * 4);
	if (e.length === 0) return n;
	let r = [...e].sort((e, t) => e.startFrom - t.startFrom), i = vo(r, t);
	for (let e = 0; e < 256; e++) {
		let t = go(r, e / 255), a = e * 4, o = t < 0 ? 0 : Math.max(0, Math.min(255, Math.round(r[t].opacity * 255))), s = t < 0 ? 0 : r.length <= 1 ? 1 : t / (r.length - 1);
		n[a] = o, n[a + 1] = Math.max(0, Math.min(255, Math.round(s * 255))), n[a + 2] = t >= 0 && i[t] ? 255 : 0, n[a + 3] = 255;
	}
	return n;
}
function bo(e) {
	return e.map((e) => `${e.color}:${e.startFrom}:${e.width}:${e.opacity}`).join("|");
}
//#endregion
//#region src/field/imageColorDensity.ts
function xo(e) {
	return e < 0 ? 0 : e > 1 ? 1 : e;
}
function So(e, t, n) {
	let r = xo((n - e) / Math.max(1e-5, t - e));
	return r * r * (3 - 2 * r);
}
function Co(e, t, n) {
	let r = xo(t), i = Math.max(0, n);
	if (r <= 0 && i <= 0) return e;
	let a = e.filter((e) => e.startFrom >= r);
	return (a.length > 0 ? a : e.slice(-1)).map((e) => {
		let t = So(.45, 1, e.startFrom), n = Math.max(r, e.startFrom - t * i * .12), a = Math.round(e.width * (1 + t * i));
		return {
			...e,
			startFrom: n,
			width: Math.max(1, Math.min(64, a))
		};
	});
}
function wo(e) {
	return e.colors.mode === "colors" ? Co(e.stripes, e.colors.imageColorRemoveThin, e.colors.imageColorBoostThick) : e.stripes;
}
//#endregion
//#region src/colors/backgroundDetect.ts
var To = 240;
function Eo(e, t, n) {
	if (t <= 0 || n <= 0 || e.length < t * n * 4) return 0;
	let r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = (n, s) => {
		let c = (s * t + n) * 4, l = e[c] & To, u = e[c + 1] & To, d = e[c + 2] & To, f = l << 16 | u << 8 | d;
		r.set(f, (r.get(f) ?? 0) + 1), i.set(f, (i.get(f) ?? 0) + e[c]), a.set(f, (a.get(f) ?? 0) + e[c + 1]), o.set(f, (o.get(f) ?? 0) + e[c + 2]);
	};
	for (let e = 0; e < t; e++) s(e, 0), s(e, n - 1);
	for (let e = 1; e < n - 1; e++) s(0, e), s(t - 1, e);
	let c = 0, l = 0;
	for (let [e, t] of r) t > l && (l = t, c = e);
	if (l === 0) return 0;
	let u = l, d = Math.round((i.get(c) ?? 0) / u), f = Math.round((a.get(c) ?? 0) / u), p = Math.round((o.get(c) ?? 0) / u);
	return (d & 255) << 16 | (f & 255) << 8 | p & 255;
}
//#endregion
//#region src/colors/vibrantPalette.ts
var Do = 24, Oo = 6, ko = 32;
function Ao(e) {
	return Math.min(255, Math.max(0, Math.round(e)));
}
function jo(e, t, n) {
	let r = Ce(e, t, n);
	if (r <= 0) return 0;
	let i = Se(e, t, n), a = 1 - Math.abs(i - .5) * 2;
	return r * Math.max(0, a);
}
function Mo(e, t) {
	let n = e.r - t.r, r = e.g - t.g, i = e.b - t.b;
	return Math.sqrt(n * n + r * r + i * i);
}
function No(e, t) {
	let n = [];
	for (let r of e) n.every((e) => Mo(e, r) >= t) && n.push(r);
	return n;
}
function Po(e, t, n) {
	let r = (e % 360 + 360) % 360, i = (1 - Math.abs(2 * n - 1)) * t, a = i * (1 - Math.abs(r / 60 % 2 - 1)), o = n - i / 2, s = 0, c = 0, l = 0;
	return r < 60 ? (s = i, c = a) : r < 120 ? (s = a, c = i) : r < 180 ? (c = i, l = a) : r < 240 ? (c = a, l = i) : r < 300 ? (s = a, l = i) : (s = i, l = a), {
		r: Ao((s + o) * 255),
		g: Ao((c + o) * 255),
		b: Ao((l + o) * 255)
	};
}
function Fo(e = 8) {
	let t = [];
	for (let n = 0; n < e; n++) t.push(Po(360 / e * n, .85, .55));
	return t;
}
function Io(e, t, n, r = {}) {
	if (t <= 0 || n <= 0 || e.length < t * n * 4) return Fo();
	let i = r.maxColors ?? Do, a = Math.max(1, r.stride ?? Oo), o = r.dedupeDistance ?? ko, s = [];
	for (let r = 0; r < n; r += a) for (let n = 0; n < t; n += a) {
		let i = (r * t + n) * 4, a = e[i] ?? 0, o = e[i + 1] ?? 0, c = e[i + 2] ?? 0, l = jo(a, o, c);
		l <= 0 || s.push({
			color: {
				r: a,
				g: o,
				b: c
			},
			score: l
		});
	}
	if (s.length === 0) return Fo();
	s.sort((e, t) => t.score - e.score);
	let c = No(s.slice(0, i * 3).map((e) => e.color), o);
	return c.length === 0 ? Fo() : c.slice(0, i);
}
//#endregion
//#region src/shaders/colorDist.frag.ts
var Lo = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 finalColor;
${H}
void main() {
  vec3 col = adjustedColor(vUv);
  float d = clamp(length(col - uColorBg) / sqrt(3.0), 0.0, 1.0);
  finalColor = vec4(d, 0.0, 0.0, 1.0);
}
`;
//#endregion
//#region src/passes/colorDistPass.ts
function Ro(e, t) {
	let n = P(e, B, Lo), r = (t) => e.getUniformLocation(n, t), i = {
		src: r("uSource"),
		rect: r("uSrcRect"),
		texel: r("uTexel"),
		bg: r("uBg"),
		colorBg: r("uColorBg"),
		blur: r("uBlur"),
		sharpen: r("uSharpen"),
		black: r("uBlack"),
		white: r("uWhite"),
		gamma: r("uGamma"),
		exposure: r("uExposure"),
		contrast: r("uContrast"),
		brightThresh: r("uBrightThresh"),
		invert: r("uInvert"),
		posterize: r("uPosterize"),
		noise: r("uNoise")
	};
	return {
		render(r, a, o) {
			z(e, r), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, a), e.uniform1i(i.src, 0), e.uniform4f(i.rect, o.srcRect.u0, o.srcRect.v0, o.srcRect.u1, o.srcRect.v1), e.uniform2f(i.texel, o.sourceTexelW, o.sourceTexelH);
			let s = o.adjustments;
			e.uniform3f(i.bg, ...V(o.background)), e.uniform3f(i.colorBg, ...V(o.colorBackground)), e.uniform1f(i.blur, s.blurRadius), e.uniform1f(i.sharpen, s.sharpenAmount), e.uniform1f(i.black, s.blackPoint), e.uniform1f(i.white, s.whitePoint), e.uniform1f(i.gamma, s.gamma), e.uniform1f(i.exposure, s.exposure), e.uniform1f(i.contrast, s.contrast), e.uniform1f(i.brightThresh, s.brightness + s.thresholdBias), e.uniform1f(i.invert, +!!s.invert), e.uniform1f(i.posterize, s.posterizeLevels), e.uniform1f(i.noise, s.noiseAmount), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/shaders/maxReduce.frag.ts
var zo = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uTex;\nuniform vec2 uSrcSize;\nout vec4 finalColor;\nvoid main() {\n  vec2 srcStart = floor(gl_FragCoord.xy) * 4.0;\n  float m = 0.0;\n  for (int y = 0; y < 4; y++) {\n    for (int x = 0; x < 4; x++) {\n      vec2 p = (srcStart + vec2(float(x), float(y)) + 0.5) / uSrcSize;\n      m = max(m, texture(uTex, p).r);\n    }\n  }\n  finalColor = vec4(m, 0.0, 0.0, 1.0);\n}\n";
//#endregion
//#region src/passes/maxReducePass.ts
function Bo(e, t) {
	let n = P(e, B, zo), r = e.getUniformLocation(n, "uTex"), i = e.getUniformLocation(n, "uSrcSize");
	return {
		render(a, o, s, c) {
			z(e, a), e.useProgram(n), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, o), e.uniform1i(r, 0), e.uniform2f(i, s, c), t.draw();
		},
		dispose() {
			e.deleteProgram(n);
		}
	};
}
//#endregion
//#region src/reveal/revealMath.ts
function Vo(e) {
	let [t, n] = e === "center" ? ["center", "center"] : e.split(" ");
	return [t === "left" ? 0 : t === "right" ? 1 : .5, n === "top" ? 0 : n === "bottom" ? 1 : .5];
}
function X(e) {
	if (e.type === "wave" || e.type === "custom") return e.wave.durationMs;
	if (e.type === "whirlpool") return e.whirlpool.durationMs;
	if (e.type === "water") return e.water.durationMs + e.water.settleMs;
	if (e.type === "blackhole") {
		let t = e.blackhole;
		return t.formMs + t.staggerMs + t.speedMaxMs + t.collapseMs;
	}
	let t = e.type === "assembly" ? e.assembly : e[e.type];
	return t.staggerMs + t.speedMaxMs;
}
function Ho(e) {
	return Math.min(.4, Math.max(.04, 330 / e));
}
function Uo(e, t, n) {
	let r = Math.max(1, Math.round(t)), i = Math.min(1, Math.max(0, e)), a = i, o = Math.min(a, 1 - a), s = i * r, c = Math.min(r - 1, Math.floor(s)), l = s - c, u = l * l * (3 - 2 * l), d = c % 2 == 0 ? u * 2 - 1 : 1 - u * 2, f = Math.sin(i * Math.PI * 2 * r * 1.5) * n * .05, p = d * o + f;
	return {
		x: Math.min(1, Math.max(0, a + p)),
		y: Math.min(1, Math.max(0, a - p))
	};
}
//#endregion
//#region src/reveal/revealClock.ts
function Wo(e) {
	let t = 0, n = -1, r = 0, i = 0, a = !0;
	function o() {
		return a ? i + (e.now() - r) : i;
	}
	return {
		elapsedMs() {
			return n !== t && (n = t, r = e.now(), i = 0), o();
		},
		animating(e) {
			return a ? n === t ? o() < e : !0 : !1;
		},
		trigger() {
			t++;
		},
		setGate(o) {
			o !== a && (o ? r = e.now() : n === t && (i += e.now() - r), a = o);
		},
		get gateOpen() {
			return a;
		}
	};
}
var Go = 1 / 60;
function Ko() {
	let e = ia(900), t = -1, n = !1, r = 0, i = 0;
	return {
		reset() {
			e = ia(900), t = -1, n = !1, r = 0, i = 0;
		},
		advance(a, o, s, c, l) {
			let u = t < 0 ? Go : Math.max(0, Math.min(ra, (a - t) / 1e3));
			t = a;
			let d = e.take(u), f = r, p = i, m = 0;
			if (o < 1) {
				let e = Uo(o, s, c);
				f = e.x, p = 1 - e.y, m = l;
			}
			n ||= (r = f, i = p, !0);
			let h = {
				substeps: d,
				ax: r,
				ay: i,
				bx: f,
				by: p,
				amp: m,
				soakScale: u / Go
			};
			return d > 0 && (r = f, i = p), h;
		}
	};
}
//#endregion
//#region src/shaders/waterRevealAccum.frag.ts
var qo = "#version 300 es\nprecision highp float;\nin vec2 vUv;\nuniform sampler2D uPrevCover;\nuniform sampler2D uHeight;\nuniform float uRevealK;\nuniform float uGamma;\nuniform float uSoak;\nout vec4 outColor;\n\n// Cover is driven only by the water that touches each pixel — there is no global\n// end-of-animation fill, so a pixel the water never reaches stays hidden.\n// Two ways water reveals, both local:\n//   peak  — the whitest water that ever hit it, immediate\n//   soak  — water that keeps washing over it finishes it off\n// Soak is what completes the image: the weakest pixels only ever see a crest of\n// ~0.1, so peak alone cannot reach 1 and the reveal would pop at the end.\nvoid main() {\n  float prev = texture(uPrevCover, vUv).r;\n  float h = max(texture(uHeight, vUv).r, 0.0);\n  float a = pow(h / (h + uRevealK), uGamma);\n  float cover = min(1.0, max(prev, a) + a * uSoak);\n  outColor = vec4(cover, 0.0, 0.0, 1.0);\n}\n", Jo = 2, Yo = 420, Xo = .5, Zo = .72, Qo = .3, $o = .045;
function es(e, t) {
	let n = da(e, t), r = P(e, B, qo), i = (t) => e.getUniformLocation(r, t), a = {
		prevCover: i("uPrevCover"),
		height: i("uHeight"),
		revealK: i("uRevealK"),
		gamma: i("uGamma"),
		soak: i("uSoak")
	}, o = null, s = null, c = 0, l = 0, u = !1, d = !1, f = Ko(), p = -Infinity;
	function m(t) {
		z(e, t), e.clearColor(0, 0, 0, 1), e.clear(e.COLOR_BUFFER_BIT);
	}
	function h() {
		o && (m(o.read()), m(o.write()), e.bindFramebuffer(e.FRAMEBUFFER, null));
	}
	function g() {
		s && (m(s.read()), m(s.write()), e.bindFramebuffer(e.FRAMEBUFFER, null));
	}
	function _() {
		h(), g();
	}
	function v(n, i) {
		if (!o || !s) return;
		let c = .8 - .45 * Math.min(1, Math.max(0, n));
		z(e, s.write()), e.useProgram(r), e.activeTexture(e.TEXTURE0), e.bindTexture(e.TEXTURE_2D, s.read().texture), e.uniform1i(a.prevCover, 0), e.activeTexture(e.TEXTURE1), e.bindTexture(e.TEXTURE_2D, o.read().texture), e.uniform1i(a.height, 1), e.uniform1f(a.revealK, Qo), e.uniform1f(a.gamma, c), e.uniform1f(a.soak, $o * i), t.draw(), e.bindFramebuffer(e.FRAMEBUFFER, null), s.swap();
	}
	return {
		tick(t) {
			if (u) return;
			t.sweepT < p && (_(), f.reset()), p = t.sweepT;
			let r = Math.max(1, Math.round(t.displayWidth / Jo)), i = Math.max(1, Math.round(t.displayHeight / Jo)), a = Math.max(r, i);
			if (a > Yo) {
				let e = Yo / a;
				r = Math.max(1, Math.round(r * e)), i = Math.max(1, Math.round(i * e));
			}
			try {
				if (!o || !s) {
					if (!e.getExtension("EXT_color_buffer_float")) throw Error("EXT_color_buffer_float unavailable");
					o = la(e, r, i, {
						float: !0,
						linear: !0
					}), s = la(e, r, i, { linear: !0 }), c = r, l = i, _();
				} else (r !== c || i !== l) && (o.resize(r, i), c = r, l = i, h());
				let a = f.advance(t.elapsedMs, t.sweepT, t.rows, t.wobble, t.intensity), u = a.ax * r, p = a.ay * i, m = a.bx * r, g = a.by * i, y = a.amp * Xo, b = Math.max(3, i / (Math.max(1, t.rows) * 2.6));
				for (let e = 0; e < a.substeps; e++) {
					let t = e / a.substeps, s = (e + 1) / a.substeps;
					n.render(o.write(), o.read(), {
						texelX: 1 / r,
						texelY: 1 / i,
						ax: u + (m - u) * t,
						ay: p + (g - p) * t,
						bx: u + (m - u) * s,
						by: p + (g - p) * s,
						amp: y,
						radius: b
					}), o.swap();
				}
				v(t.softness, a.soakScale), d = !0;
			} catch (e) {
				u = !0, console.warn("[stripes-engine] water reveal sim disabled:", e);
			}
		},
		current() {
			return u || !d || !o || !s ? null : {
				height: o.read().texture,
				cover: s.read().texture,
				texelX: 1 / c,
				texelY: 1 / l
			};
		},
		release() {
			o?.dispose(), s?.dispose(), o = null, s = null, c = 0, l = 0, d = !1, p = -Infinity, f.reset();
		},
		dispose() {
			n.dispose(), e.deleteProgram(r), o?.dispose(), s?.dispose(), o = null, s = null;
		}
	};
}
//#endregion
//#region src/engine.ts
var ts = 2, ns = 6, rs = 173516199, is = {
	turbulence: 0,
	glitch: 1
};
function as(e) {
	return e === "turbulence" || e === "glitch";
}
function os(e, t = {}) {
	return cs(re(e, t.dpr), {
		clock: t.clock,
		seed: t.seed,
		fieldScale: t.fieldScale,
		hooks: t.hooks,
		onWaterActivity: t.onWaterActivity,
		cssWidth: e.clientWidth || 800,
		cssHeight: e.clientHeight || 600
	});
}
function ss(e) {
	return cs(ie(e.context, e.dpr), {
		clock: e.clock,
		seed: e.seed,
		fieldScale: e.fieldScale,
		onWaterActivity: e.onWaterActivity,
		cssWidth: e.width,
		cssHeight: e.height,
		gpuTimings: !1
	});
}
function cs(t, n) {
	let r = n.clock ?? O(), i = n.hooks, a = r.now(), o = n.cssWidth, s = n.cssHeight, { gl: c, isP3: l, maxTextureSize: d } = t.acquireContext(), f = {
		width: 0,
		height: 0
	}, p = {
		width: 2,
		height: 2
	}, m = {
		width: 2,
		height: 2
	}, h = {
		cols: 1,
		rows: 1
	}, g = [], _ = n.gpuTimings !== !1, v = 0, y = 0, b = ae(c), x = oo(c), S = [], C = ro(c, _), w = ao(), T = null, E = e({ fieldScale: n.fieldScale }), D = null, k = null, te = "", M = Bt(c), ne = r.now(), re = r.now() / 1e3, ie = ee(), N = !1, P = E.stripesEnabled, oe = () => E.reveal.enabled ? E.reveal.type === "wave" ? "wave" : E.reveal.type === "assembly" ? "scatter" : E.reveal.type === "vortex" ? "vortex" : E.reveal.type === "blackhole" ? "blackhole" : E.reveal.type === "whirlpool" ? "whirlpool" : E.reveal.type === "water" ? "water" : E.reveal.type === "custom" ? i?.customReveal ? "custom" : "wave" : "warp" : "none", le = oe(), I = E.flames.enabled, L = E.flames.direction, ue = $e(E) === "field", me = E.renderMode, ge = E.cursorTrail.enabled, R = E.clickWave.enabled, _e = E.clickWave.type, ve = E.letters.enabled, be = E.colors.mode, B = E.background.stars.enabled, xe = Wo(r);
	function V() {
		return xe.elapsedMs();
	}
	function Se() {
		return E.reveal.enabled ? xe.animating(X(E.reveal)) : !1;
	}
	let Ce = E.colors.backgroundColor, H = null, U = null, Ee = Fo(), De = Math.sqrt(3), Ae = null, Me = null, Pe = "", Fe = (n.seed ?? 1) >>> 0, Le = Ba(At(Fe)), ze = (Fe ^ rs) >>> 0, Be = un(At(ze)), W = Vi(), He = Xi(), Ue = r.now(), We = () => W.target, G = null, qe = E.cursorTrail.type, Ye = ea(n.onWaterActivity), Ze = () => E.cursorTrail.enabled && E.cursorTrail.type === "constellation", Qe = () => {
		if (!Ze()) return "off";
		let e = Xn(E.cursorTrail.constellation);
		return `${e.maxStars}|${e.maxLinks}|${e.maxPulses}`;
	}, et = Qe(), tt = () => E.cursorTrail.enabled && E.cursorTrail.type === "comet", it = () => {
		if (!tt()) return "off";
		let e = Kr(E.cursorTrail.comet);
		return `${e.nodeCount}|${e.maxEmbers}`;
	}, K = it(), ot = () => E.background.meteors.enabled ? String(mi(E.background.meteors).maxActive) : "off", st = ot(), ct = () => E.clickWave.enabled && E.clickWave.type === "detonation", lt = () => {
		if (!ct()) return "off";
		let e = Di(E.clickWave.detonation);
		return `${e.maxConcurrent}|${e.debrisCount}`;
	}, ut = lt(), dt = null, ft = "", pt = () => {
		let e = Di(E.clickWave.detonation), t = `${e.maxConcurrent}|${e.debrisCount}|${E.clickWave.detonation.seed}`;
		return (!dt || t !== ft) && (dt = Oi(e, E.clickWave.detonation.seed), ft = t), dt;
	};
	function mt() {
		return E.cursorTrail.enabled && E.cursorTrail.type === "wave";
	}
	function ht() {
		if (!mt()) {
			G && (G.dispose(), G = null, Ye.settle());
			return;
		}
		G ??= ya(c, b), G.tick(r.now(), W.target, o, s), Ye.report(G.activity());
	}
	function gt() {
		G?.resetActivity(), Ye.settle();
	}
	function _t() {
		return t.getDpr();
	}
	function vt(e) {
		return typeof HTMLImageElement < "u" && e instanceof HTMLImageElement || typeof ImageBitmap < "u" && e instanceof ImageBitmap || typeof HTMLCanvasElement < "u" && e instanceof HTMLCanvasElement || typeof OffscreenCanvas < "u" && e instanceof OffscreenCanvas || typeof HTMLVideoElement < "u" && e instanceof HTMLVideoElement;
	}
	function yt(e, t) {
		if (!vt(e)) return null;
		let n = 1, r = 1;
		typeof HTMLVideoElement < "u" && e instanceof HTMLVideoElement ? (n = e.videoWidth || 1, r = e.videoHeight || 1) : typeof HTMLImageElement < "u" && e instanceof HTMLImageElement ? (n = e.naturalWidth || e.width || 1, r = e.naturalHeight || e.height || 1) : (n = e.width || 1, r = e.height || 1);
		let i = Math.min(1, t / Math.max(n, r)), a = Math.max(1, Math.round(n * i)), o = Math.max(1, Math.round(r * i)), s = null;
		if (typeof document < "u" && typeof document.createElement == "function") {
			let e = document.createElement("canvas");
			e.width = a, e.height = o, s = e.getContext("2d", { willReadFrequently: !0 });
		} else typeof OffscreenCanvas < "u" && (s = new OffscreenCanvas(a, o).getContext("2d", { willReadFrequently: !0 }));
		return s ? (s.drawImage(e, 0, 0, a, o), {
			data: s.getImageData(0, 0, a, o).data,
			w: a,
			h: o
		}) : null;
	}
	function bt(e) {
		try {
			let t = yt(e, 64);
			return t ? Eo(t.data, t.w, t.h) : E.colors.backgroundColor;
		} catch {
			return E.colors.backgroundColor;
		}
	}
	function St(e) {
		let t = null;
		try {
			t = e ? yt(e, 96) : null;
		} catch {
			t = null;
		}
		Ee = t ? Io(t.data, t.w, t.h) : Fo();
	}
	function wt() {
		return E.colors.autoDetectBackground ? Ce : E.colors.backgroundColor;
	}
	function q() {
		let e = E.adjustments, t = E.transform;
		return [
			E.colors.mode,
			wt(),
			E.background.color,
			e.blackPoint,
			e.whitePoint,
			e.gamma,
			e.exposure,
			e.contrast,
			e.brightness,
			e.thresholdBias,
			+!!e.invert,
			e.posterizeLevels,
			e.noiseAmount,
			e.blurRadius,
			e.sharpenAmount,
			t.fit,
			t.zoom,
			t.panX,
			t.panY,
			m.width,
			m.height,
			f.width,
			f.height
		].join("|");
	}
	function Dt() {
		if (Pe = q(), !T || E.colors.mode !== "colors" || !Ae || !Me) {
			De = Math.sqrt(3);
			return;
		}
		T.update();
		let e = mo(T.width, T.height, f.width, f.height, E.transform.fit, E.transform.zoom, E.transform.panX, E.transform.panY), t = x.get("colorDistFull", m.width, m.height);
		Ae.render(t, T.texture, {
			srcRect: e,
			adjustments: E.adjustments,
			background: E.background.color,
			colorBackground: wt(),
			sourceTexelW: 1 / T.width,
			sourceTexelH: 1 / T.height
		});
		let n = m.width, r = m.height, i = t.texture, a = t, o = 0;
		for (; n > 1 || r > 1;) {
			let e = Math.max(1, Math.ceil(n / 4)), t = Math.max(1, Math.ceil(r / 4)), s = x.get(`colorMaxReduce${o}`, e, t);
			Me.render(s, i, n, r), i = s.texture, a = s, n = e, r = t, o++;
		}
		let s = new Uint8Array(4);
		c.bindFramebuffer(c.FRAMEBUFFER, a.fbo), c.readPixels(0, 0, 1, 1, c.RGBA, c.UNSIGNED_BYTE, s), c.bindFramebuffer(c.FRAMEBUFFER, null);
		let l = s[0] / 255 * Math.sqrt(3);
		De = l > 1e-4 ? l : Math.sqrt(3);
	}
	function Ot() {
		let e = wo(E), t = `${bo(e)}|stripeDotsDensity:${E.stripeDots.density}`;
		if (t !== te) {
			let n = _o(e), r = yo(e, E.stripeDots.density);
			D ? zt(c, D, n, 256, 1) : D = Rt(c, n, 256, 1), k ? zt(c, k, r, 256, 1) : k = Rt(c, r, 256, 1), te = t;
		}
	}
	function kt(e, t) {
		return M.ensureTextMap(e, t, E.grid.orientation, E.letters.text, E.letters.textCopies);
	}
	function jt() {
		for (let e of S) e.dispose();
		H &&= (H.dispose(), null), U &&= (U.dispose(), null);
		let e = E.colors.mode === "colors", t;
		if (e) {
			let e = Te(c, b), n = ye(c);
			H = n, t = {
				name: "field",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), r = x.get("fieldColor", p.width, p.height, { linear: !0 });
					if (T) {
						T.update();
						let i = mo(T.width, T.height, f.width, f.height, E.transform.fit, E.transform.zoom, E.transform.panX, E.transform.panY);
						e.render(n, t, r, T.texture, {
							srcRect: i,
							adjustments: E.adjustments,
							background: E.background.color,
							colorBackground: wt(),
							maxColorDist: De,
							sourceTexelW: 1 / T.width,
							sourceTexelH: 1 / T.height
						});
					} else c.bindFramebuffer(c.FRAMEBUFFER, t.fbo), c.clearColor(0, 0, 0, 1), c.clear(c.COLOR_BUFFER_BIT), c.bindFramebuffer(c.FRAMEBUFFER, r.fbo), c.clearColor(0, 0, 0, 0), c.clear(c.COLOR_BUFFER_BIT);
				},
				dispose: () => e.dispose()
			};
		} else {
			let e = we(c, b);
			t = {
				name: "field",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 });
					if (T) {
						T.update();
						let n = mo(T.width, T.height, f.width, f.height, E.transform.fit, E.transform.zoom, E.transform.panX, E.transform.panY);
						e.render(t, T.texture, {
							srcRect: n,
							adjustments: E.adjustments,
							background: E.background.color,
							sourceTexelW: 1 / T.width,
							sourceTexelH: 1 / T.height,
							water: G?.current() ?? null
						});
					} else c.bindFramebuffer(c.FRAMEBUFFER, t.fbo), c.clearColor(0, 0, 0, 1), c.clear(c.COLOR_BUFFER_BIT);
				},
				dispose: () => e.dispose()
			};
		}
		let n = {
			colorsMode: e,
			getFieldRT: () => x.get("field", p.width, p.height, { linear: !0 }),
			getFieldColorRT: () => x.get("fieldColor", p.width, p.height, { linear: !0 }),
			getPalette: () => Ee
		}, l = [];
		E.background.stars.enabled && l.push(cn({
			...n,
			name: "backgroundStarsField",
			pass: sn(c),
			step: () => (mn(Be, E.background.stars, {
				width: o,
				height: s
			}, r.now()), {
				particles: Be.stars,
				opts: {
					canvasW: o,
					canvasH: s,
					color: E.background.stars.color
				}
			})
		}));
		let d = [];
		E.flames.enabled && d.push(cn({
			...n,
			name: "flamesField",
			pass: Yt(c),
			step: () => {
				no(Le, E.flames, {
					width: o,
					height: s
				}, r.now());
				let { inner: e, outer: t } = qa(E.flames.edgeSharpness);
				return {
					particles: Le.flames,
					opts: {
						canvasW: o,
						canvasH: s,
						vertical: Wa(E.flames.direction),
						inner: e,
						outer: t
					}
				};
			}
		}));
		let m = E.reveal.enabled, g = [], _ = (e) => {
			for (let t = e - 1; t >= 0; t--) {
				let e = g[t];
				if (e.active()) return e.field;
			}
			return "field";
		}, C = (e) => {
			for (let t = e - 1; t >= 0; t--) {
				let e = g[t];
				if (e.color !== null && e.active()) return e.color;
			}
			return "fieldColor";
		}, w = () => _(g.length), O = () => C(g.length), A = () => !0, ee = A, j = [];
		if (m && E.reveal.type === "vortex") {
			let e = Ve(c, b);
			j.push({
				name: "vortexField",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), n = x.get("revealedField", p.width, p.height, { linear: !0 }), r = E.reveal.vortex, i = X(E.reveal), a = V() / i, c = Math.max(1, r.staggerMs + r.speedMaxMs), l = Math.max(0, r.speedMinMs), u = Math.max(l, r.speedMaxMs), d = Math.min(.98, Math.max(.05, (l + u) / 2 / c)), f = r.staggerMs / c, m = Math.round(280 + 280 * r.detail), h = Math.max(2, Math.round(m * s / Math.max(1, o)));
					e.render(n, t.texture, {
						progress: a,
						spread: f,
						flight: d,
						gridX: m,
						gridY: h,
						glow: r.glow,
						intensity: r.intensity,
						swirl: r.swirl,
						aspect: o / Math.max(1, s),
						count: m * h * 3
					});
				},
				dispose: () => e.dispose()
			});
		} else if (m && E.reveal.type === "blackhole") {
			let e = Ge(c, b);
			j.push({
				name: "blackholeField",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), n = x.get("revealedField", p.width, p.height, { linear: !0 }), r = E.reveal.blackhole, i = X(E.reveal), a = Math.max(1, i), c = V() / a, l = Math.max(1, r.speedMinMs), u = Math.max(l, r.speedMaxMs), d = Math.round(280 + 280 * r.detail), f = Math.max(2, Math.round(d * s / Math.max(1, o))), m = 4200;
					e.render(n, t.texture, {
						progress: c,
						form: r.formMs / a,
						spread: r.staggerMs / a,
						flightMin: l / a,
						flightMax: u / a,
						collapse: r.collapseMs / a,
						gridX: d,
						gridY: f,
						glow: r.glow,
						swirl: r.swirl,
						arms: r.arms,
						lensing: r.lensing,
						horizon: r.horizon,
						intensity: r.intensity,
						aspect: o / Math.max(1, s),
						diskCount: m,
						count: d * f * 3 + m
					});
				},
				dispose: () => e.dispose()
			});
		} else if (m && E.reveal.type === "whirlpool") {
			let e = Ke(c, b);
			j.push({
				name: "whirlpoolField",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), n = x.get("revealedField", p.width, p.height, { linear: !0 }), r = E.reveal.whirlpool, i = Math.max(1, X(E.reveal)), a = V() / i;
					e.render(n, t.texture, {
						progress: a,
						turns: r.turns,
						tightness: r.tightness,
						streak: r.streak,
						glow: r.glow,
						aspect: o / Math.max(1, s)
					});
				},
				dispose: () => e.dispose()
			});
		} else if (m && as(E.reveal.type)) {
			let e = Re(c, b);
			j.push({
				name: "energyWarpField",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), n = x.get("revealedField", p.width, p.height, { linear: !0 });
					if (!as(E.reveal.type)) return;
					let r = E.reveal.type, i = E.reveal[r], a = X(E.reveal), o = V() / a, s = Math.max(1, i.staggerMs + i.speedMaxMs), c = Math.max(0, i.speedMinMs), l = Math.max(c, i.speedMaxMs), u = Math.min(.98, Math.max(.05, (c + l) / 2 / s)), d = i.staggerMs / s;
					e.render(n, t.texture, {
						mode: is[r] ?? 0,
						progress: o,
						spread: d,
						flight: u,
						intensity: i.intensity,
						detail: i.detail,
						glow: i.glow
					});
				},
				dispose: () => e.dispose()
			});
		} else if (m && E.reveal.type === "assembly") {
			let e = Ie(c), t = Xe(c, b);
			j.push({
				name: "assemblyScatterField",
				render: () => {
					let n = x.get("field", p.width, p.height, { linear: !0 }), r = x.get("revealedField", p.width, p.height, { linear: !0 }), i = E.reveal.assembly, a = i.blurPx ?? u.assembly.blurPx ?? 0, c = i.blurStart ?? u.assembly.blurStart ?? 0, l = X(E.reveal), d = V() / l, f = Math.max(0, Math.min(1, d)), m = Math.max(1, i.staggerMs + i.speedMaxMs), h = Math.max(0, i.speedMinMs), g = Math.max(h, i.speedMaxMs), _ = Math.min(.98, Math.max(.05, (h + g) / 2 / m)), v = i.staggerMs / m, y = Math.max(1, i.sliceSizePx), b = Math.max(1, Math.ceil(o / y)), S = Math.max(1, Math.ceil(s / y)), C = Math.min(1, v + _), w = n.texture, T = n.texture, D = n.texture;
					if (f < C && a > 0) {
						let e = {
							width: Math.max(1, Math.round(p.width / 2)),
							height: Math.max(1, Math.round(p.height / 2))
						}, r = x.get("assemblyBlurQuarter", e.width, e.height, { linear: !0 }), i = x.get("assemblyBlurHalf", e.width, e.height, { linear: !0 }), s = x.get("assemblyBlurFull", e.width, e.height, { linear: !0 }), c = x.get("assemblyBlurTemp", e.width, e.height, { linear: !0 }), l = a * e.width / Math.max(1, o);
						t.copy(n.texture, r), t.render(r.texture, c, r, l * .25 / .45, e), t.render(r.texture, c, i, Math.sqrt(3) / 4 * l / .45, e);
						let u = l * (Math.sqrt(3) / 2 / Math.SQRT2) / .45;
						t.render(i.texture, c, s, u, e), t.render(s.texture, c, s, u, e), w = r.texture, T = i.texture, D = s.texture;
					}
					e.render(r, n.texture, w, T, D, {
						blockCols: b,
						blockRows: S,
						progress: d,
						spread: v,
						flight: _,
						spawnDist: 1.6,
						scatter: [i.scatterPx / Math.max(1, o), i.scatterPx / Math.max(1, s)],
						angleJitter: i.angleJitterDeg * Math.PI / 180,
						sigmaUv: [a / Math.max(1, o), a / Math.max(1, s)],
						blurStart: c
					});
				},
				dispose: () => {
					e.dispose(), t.dispose();
				}
			});
		} else if (m && E.reveal.type === "water") {
			let e = es(c, b), t = Je(c, b), n = !1, r = !1;
			ee = () => r, j.push({
				name: "waterRevealField",
				render: () => {
					let i = E.reveal.water, a = Math.max(1, i.durationMs), c = Math.max(0, i.settleMs), l = V(), u = Math.min(1, Math.max(0, l / a)), d = c <= 0 ? +(u >= 1) : Math.min(1, Math.max(0, (l - a) / c));
					if (u >= 1 && d >= 1) {
						n ||= (e.release(), !0), r = !1;
						return;
					}
					r = !0;
					let f = x.get("field", p.width, p.height, { linear: !0 }), m = x.get("revealedField", p.width, p.height, { linear: !0 }), h = 1 - d * d * (3 - 2 * d);
					n = !1, e.tick({
						elapsedMs: l,
						sweepT: u,
						displayWidth: o,
						displayHeight: s,
						rows: i.rows,
						wobble: i.wobble,
						intensity: i.intensity,
						softness: i.softness
					}), t.render(m, f.texture, e.current(), {
						refraction: i.refraction,
						whiteK: 3,
						glow: Zo,
						fade: h
					});
				},
				dispose: () => {
					e.dispose(), t.dispose();
				}
			});
		} else if (m && E.reveal.type === "custom" && i?.customReveal) {
			let e = i.customReveal({
				gl: c,
				quad: b,
				pool: x
			});
			j.push({
				name: "customRevealField",
				render: () => {
					let t = x.get("field", p.width, p.height, { linear: !0 }), n = x.get("revealedField", p.width, p.height, { linear: !0 }), i = X(E.reveal), a = V() / i;
					e.render({
						field: t,
						revealed: n,
						progress: a,
						fieldSize: p,
						cssW: o,
						cssH: s,
						now: r.now()
					});
				},
				dispose: () => e.dispose()
			});
		} else if (m) {
			let e = Ne(c, b), t = !1;
			ee = () => t, j.push({
				name: "revealField",
				render: () => {
					let { cols: n, rows: r } = h, i = X(E.reveal), a = V() / i, o = Ho(E.reveal.wave.durationMs);
					if (a >= 1 + Math.max(0, E.reveal.wave.softness) + o + E.reveal.wave.waviness * .5 + .001) {
						t = !1;
						return;
					}
					t = !0;
					let s = x.get("field", p.width, p.height, { linear: !0 }), c = x.get("revealedField", p.width, p.height, { linear: !0 }), [l, u] = Vo(E.reveal.wave.position), d = Math.max(Math.hypot(l, u), Math.hypot(1 - l, u), Math.hypot(l, 1 - u), Math.hypot(1 - l, 1 - u), 1e-4);
					e.render(c, s.texture, n, r, {
						revealMode: 1,
						origin: [l, u],
						maxDist: d,
						progress: a,
						softness: E.reveal.wave.softness,
						waviness: E.reveal.wave.waviness,
						bandRamp: o
					});
				},
				dispose: () => e.dispose()
			});
		}
		j.length > 0 && g.push({
			field: "revealedField",
			color: null,
			active: ee
		});
		let te = [];
		if (i?.fieldPass) {
			let e = i.fieldPass({
				gl: c,
				quad: b,
				pool: x
			}), t = g.length;
			te.push({
				name: "hookField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }), i = x.get("hookField", p.width, p.height, { linear: !0 });
					e.render({
						input: n,
						output: i,
						fieldSize: p,
						cssW: o,
						cssH: s,
						now: r.now(),
						elapsed: r.now() - a,
						cursor: We
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "hookField",
				color: null,
				active: A
			});
		}
		let ne = [];
		if ($e(E) === "field") {
			let e = gn(c, b), t = g.length;
			ne.push({
				name: "edgeMaskField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }).texture, r = x.get("maskedField", p.width, p.height, { linear: !0 });
					e.render(r, n, {
						start: E.edgeMask.start,
						end: E.edgeMask.end,
						power: E.edgeMask.power,
						sides: E.edgeMask.sides
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "maskedField",
				color: null,
				active: A
			});
		}
		let ie = [], N = E.cursorTrail.enabled && E.cursorTrail.type === "default", P = E.clickWave.enabled && E.clickWave.type === "default";
		if (N || P) {
			let t = N, n = P, i = t ? Sn(c) : null, a = n ? Mn(c) : null, l = Tn(c, b), u = On(c, b), d = g.length, f = !1, m = () => !t && He.waves.length === 0 && He.clearFramesRemaining === 0;
			ie.push({
				name: "cursorField",
				render: () => {
					let g = r.now() - Ue;
					if (Ue = r.now(), m()) {
						f = !1;
						return;
					}
					f = !0;
					let { cols: v, rows: y } = h, b = v / Math.max(1, o), S = t ? Math.min(ts, E.cursorTrail.pushStrengthPx * b) : 0, w = n ? Math.min(ns, E.clickWave.pushStrengthPx * b) : 0, T = Math.max(S, w), D = x.get("cursorAccum", v, y, { float: !0 });
					if (z(c, D), c.clearColor(0, 0, 0, 0), c.clear(c.COLOR_BUFFER_BIT), i) {
						let { samples: e } = Ui(W, g, E.cursorTrail), t = E.cursorTrail.pushStrengthPx * v / Math.max(1, o);
						i.render(D, e, {
							cols: v,
							rows: y,
							displayWidth: o,
							displayHeight: s,
							pushRadiusScale: E.cursorTrail.pushRadiusScale,
							pushScale: t
						});
					}
					if (a) {
						let { samples: e } = Qi(He, g, E.clickWave), t = E.clickWave.pushStrengthPx * v / Math.max(1, o);
						a.render(D, e, {
							cols: v,
							rows: y,
							displayWidth: o,
							displayHeight: s,
							pushScale: t,
							pushBandScale: E.clickWave.pushBandScale,
							stripeWhiteAlpha: E.clickWave.stripeWhiteAlpha
						});
					}
					let O = x.get("cursorTear", v, y);
					l.render(O, D.texture, {
						cols: v,
						rows: y,
						pushCap: T
					});
					let k = {
						cols: v,
						rows: y,
						cellW: o / Math.max(1, v),
						cellH: s / Math.max(1, y),
						pixelW: o,
						pixelH: s,
						pushCap: T
					}, A = x.get(_(d), p.width, p.height, { linear: !0 }).texture, ee = x.get("cursorField", p.width, p.height, { linear: !0 });
					if (u.render(ee, A, D.texture, O.texture, k), e) {
						let e = x.get(C(d), p.width, p.height, { linear: !0 }).texture, t = x.get("cursorFieldColor", p.width, p.height, { linear: !0 }), n = Ee[0], r = n ? [
							n.r / 255,
							n.g / 255,
							n.b / 255
						] : [
							1,
							.5,
							.2
						];
						u.renderColor(t, e, D.texture, O.texture, k, r);
					}
				},
				dispose: () => {
					i?.dispose(), a?.dispose(), l.dispose(), u.dispose();
				}
			}), g.push({
				field: "cursorField",
				color: e ? "cursorFieldColor" : null,
				active: () => f
			});
		}
		let ae = [];
		if (Ze()) {
			let e = pr(c, b, Xn(E.cursorTrail.constellation)), t = g.length;
			ae.push({
				name: "constellationField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }).texture, i = x.get("constellationField", p.width, p.height, { linear: !0 });
					e.render(i, n, {
						config: E.cursorTrail.constellation,
						cursor: W.target,
						cssW: o,
						cssH: s,
						now: r.now(),
						timeSec: (r.now() - a) * .001
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "constellationField",
				color: null,
				active: A
			});
		}
		let oe = [];
		if (tt()) {
			let e = si(c, b, Kr(E.cursorTrail.comet)), t = g.length;
			oe.push({
				name: "cometField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }).texture, i = x.get("cometField", p.width, p.height, { linear: !0 });
					e.render(i, n, {
						config: E.cursorTrail.comet,
						cursor: W.target,
						cssW: o,
						cssH: s,
						now: r.now(),
						timeSec: (r.now() - a) * .001
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "cometField",
				color: null,
				active: A
			});
		}
		let se = [];
		if (E.background.meteors.enabled) {
			let e = Ci(c, b, mi(E.background.meteors)), t = g.length;
			se.push({
				name: "meteorsField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }).texture, i = x.get("meteorsField", p.width, p.height, { linear: !0 });
					e.render(i, n, {
						config: E.background.meteors,
						cssW: o,
						cssH: s,
						timeSec: (r.now() - a) * .001
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "meteorsField",
				color: null,
				active: A
			});
		}
		let ce = [];
		if (ct()) {
			let e = Ii(c, b, Di(E.clickWave.detonation)), t = g.length;
			ce.push({
				name: "detonationField",
				render: () => {
					let n = x.get(_(t), p.width, p.height, { linear: !0 }).texture, i = x.get("detonationField", p.width, p.height, { linear: !0 });
					e.render(i, n, {
						config: E.clickWave.detonation,
						state: pt(),
						cssW: o,
						cssH: s,
						timeSec: (r.now() - a) * .001
					});
				},
				dispose: () => e.dispose()
			}), g.push({
				field: "detonationField",
				color: null,
				active: A
			});
		}
		let F = i?.postPass ? i.postPass({
			gl: c,
			quad: b,
			pool: x
		}) : null, le = () => ({
			outputWidth: f.width,
			outputHeight: f.height,
			cssW: o,
			cssH: s,
			now: r.now(),
			elapsed: r.now() - a,
			cursor: We
		}), I = E.colors.mode === "colors";
		if (E.stripesEnabled) {
			let e = ke(c, b), n = I ? je(c, b) : null, i = n ? [{
				name: "downsampleColor",
				render: () => {
					let { cols: e, rows: t } = h, r = x.get(O(), p.width, p.height, { linear: !0 }), i = x.get("cellColor", e, t);
					n.render(i, r.texture, e, t);
				},
				dispose: () => n.dispose()
			}] : [], a = rt(c, b), u = E.renderMode === "sharp" ? null : xt(c, b), m = u ? Ct(c, b) : null, g = E.letters.enabled, _ = g ? Tt(c, b) : null, C = _ ? [{
				name: "letterData",
				render: () => {
					let { cols: e, rows: t } = h;
					if (E.letters.mode === "text") {
						kt(e, t);
						return;
					}
					let n = x.get("cell", e, t), i = x.get("glyphData", e, t), a = Math.max(...wo(E).map((e) => e.startFrom));
					_.render(i, n.texture, {
						cols: e,
						rows: t,
						topBandThreshold: a,
						coverage: E.letters.coverage,
						timeSec: r.now() / 1e3,
						charsetLen: Et,
						shuffleSpeed: E.letters.shuffleSpeed,
						positionX: E.letters.positionX,
						positionY: E.letters.positionY,
						areaWidth: E.letters.areaWidth,
						areaHeight: E.letters.areaHeight
					});
				},
				dispose: () => _.dispose()
			}] : [], T = (e, t, n) => {
				let { cols: r, rows: i } = h, a = g && E.letters.mode === "text" ? kt(r, i) : g ? x.get("glyphData", r, i).texture : M.dummyTex;
				return {
					cols: r,
					rows: i,
					displayW: o,
					displayH: s,
					dpr: _t(),
					timeSec: e,
					lettersEnabled: g,
					colorsMode: I,
					glyphDataTex: a,
					atlasTex: M.atlasTex,
					atlasGrid: M.atlasGrid,
					cellColorTex: I ? x.get("cellColor", r, i).texture : M.dummyTex,
					opacityTex: k,
					cellDataA: t,
					cellDataB: n
				};
			}, A = c.getExtension("EXT_color_buffer_float") ? at(c, b) : null;
			A && (U = ye(c));
			let ee = () => {
				let { cols: e, rows: t } = h;
				return [x.get("cellDataA", e, t, { float32: !0 }), x.get("cellDataB", e, t, { float32: !0 })];
			}, N = A ? [{
				name: "stripeCell",
				render: () => {
					let { cols: e, rows: t } = h, [n, r] = ee();
					A.render(U, n, r, x.get("cell", e, t).texture, D, nt(E, T(re, null, null)));
				},
				dispose: () => A.dispose()
			}] : [];
			S = [
				t,
				...l,
				...d,
				...j,
				...te,
				...ne,
				...ie,
				...ae,
				...oe,
				...se,
				...ce,
				{
					name: "downsample",
					render: () => {
						let { cols: t, rows: n } = h, r = x.get(w(), p.width, p.height, { linear: !0 }), i = x.get("cell", t, n);
						e.render(i, r.texture, t, n);
					},
					dispose: () => e.dispose()
				},
				...i,
				...C,
				...N,
				{
					name: "stripe",
					render: () => {
						let { cols: e, rows: t } = h, n = x.get("cell", e, t), r = A ? ee() : null;
						a.render(n.texture, D, nt(E, T(re, r ? r[0].texture : null, r ? r[1].texture : null)), f.width, f.height, u || F ? x.get("stripeOut", f.width, f.height, { linear: !0 }) : null, v, y);
					},
					dispose: () => a.dispose()
				},
				...u ? [{
					name: "logoFill",
					render: () => {
						let e = x.get("stripeOut", f.width, f.height, { linear: !0 }), t = x.get("solidOut", f.width, f.height, { linear: !0 });
						m.render(t, e.texture, {
							resolution: [f.width, f.height],
							bg: E.background.color
						});
					},
					dispose: () => m.dispose()
				}] : [],
				...u ? [{
					name: "stylize",
					render: () => {
						let e = x.get("solidOut", f.width, f.height, { linear: !0 }), t = x.get("stripeOut", f.width, f.height, { linear: !0 }), n = F ? x.get("postSrc", f.width, f.height, { linear: !0 }) : null;
						u.render(n, e.texture, t.texture, {
							mode: E.renderMode,
							time: r.now() / 1e3,
							intensity: E.renderIntensity,
							resolution: [f.width, f.height],
							dpr: _t(),
							params: E.renderParams,
							colorA: E.renderColorA,
							colorB: E.renderColorB
						}, v, y);
					},
					dispose: () => u.dispose()
				}] : [],
				...F ? [{
					name: "hookPost",
					render: () => {
						let e = u ? "postSrc" : "stripeOut", t = x.get(e, f.width, f.height, { linear: !0 });
						F.render(t.texture, null, le());
					},
					dispose: () => F.dispose()
				}] : []
			];
		} else {
			let n = F ? null : Oe(c, b);
			S = [
				t,
				...l,
				...d,
				...j,
				...te,
				...ne,
				...ie,
				...ae,
				...oe,
				...se,
				...ce,
				{
					name: F ? "hookPost" : "present",
					render: () => {
						let t = e ? O() : w(), r = x.get(t, p.width, p.height, { linear: !0 }).texture;
						F ? F.render(r, null, le()) : n.render(r, f.width, f.height, E.edgeMask, $e(E) === "output", v, y);
					},
					dispose: () => {
						n?.dispose(), F?.dispose();
					}
				}
			];
		}
	}
	function Mt() {
		let e = _t();
		if (f = se(o, s, e, d), t.applyOutputSize(f.width, f.height), h = ho(o, s, E.grid.cellWidth, E.grid.cellHeight), m = ce(f, E.fieldScale), p = E.stripesEnabled && !i?.fieldPass ? F(m, h.cols, h.rows, 4) : m, x.get("field", p.width, p.height, { linear: !0 }), x.get("cell", h.cols, h.rows), E.renderMode !== "sharp" && (x.get("stripeOut", f.width, f.height, { linear: !0 }), x.get("solidOut", f.width, f.height, { linear: !0 })), E.reveal.enabled && (x.get("revealedField", p.width, p.height, { linear: !0 }), E.reveal.type === "assembly")) {
			let e = Math.max(1, Math.round(p.width / 2)), t = Math.max(1, Math.round(p.height / 2));
			x.get("assemblyBlurQuarter", e, t, { linear: !0 }), x.get("assemblyBlurHalf", e, t, { linear: !0 }), x.get("assemblyBlurFull", e, t, { linear: !0 }), x.get("assemblyBlurTemp", e, t, { linear: !0 });
		}
	}
	function Nt(e) {
		let n = e ?? t.acquireContext();
		c = n.gl, l = n.isP3, d = n.maxTextureSize, b = ae(c), x = oo(c), C = ro(c, _), T = null, D = null, k = null, te = "", M.reset(c), H = null, U = null, Ae = Ro(c, b), Me = Bo(c, b), Le = Ba(At(Fe)), Be = un(At(ze)), W = Vi(), He = Xi(), dt = null, ft = "", G = null, Ue = r.now(), Ot(), M.ensureAtlas(E.letters.fontFamily), jt(), Mt();
	}
	function Pt(e) {
		e.preventDefault(), N = !0;
	}
	function Ft() {
		N = !1, Nt();
	}
	t.attachContextLossListeners(Pt, Ft), Ae = Ro(c, b), Me = Bo(c, b), Ot(), M.ensureAtlas(E.letters.fontFamily), jt(), Mt();
	function It() {
		if (N) return;
		let e = r.now();
		re = e / 1e3, C.poll(), de(), fe("cursorWaveSim"), ht(), pe(), so(S, C), g = he(), c.flush();
		let t = r.now() - ne;
		ne = e, w.recordFrame(t), w.recordPasses(C.latest());
	}
	let Lt = A({
		supportsRaf: t.supportsRaf,
		frame: () => {
			(j(ie, E.maxFps, r.now()) || Se()) && It();
		},
		onStart: () => {
			ne = r.now();
		},
		settle: gt,
		teardown: () => {
			t.detachContextLossListeners();
			for (let e of S) e.dispose();
			H &&= (H.dispose(), null), U &&= (U.dispose(), null), Ae?.dispose(), Me?.dispose(), G?.dispose(), G = null, x.dispose(), b.dispose(), T?.dispose(), D &&= (c.deleteTexture(D), null), k &&= (c.deleteTexture(k), null), M.dispose();
		}
	});
	return {
		get isP3() {
			return l;
		},
		get maxFps() {
			return E.maxFps;
		},
		get outputWidth() {
			return f.width;
		},
		get outputHeight() {
			return f.height;
		},
		get fieldWidth() {
			return p.width;
		},
		get fieldHeight() {
			return p.height;
		},
		get fieldScale() {
			return E.fieldScale;
		},
		get passFill() {
			return g;
		},
		resize(e, t) {
			o = e, s = t, Mt(), E.colors.mode === "colors" && q() !== Pe && Dt();
		},
		setDpr(e) {
			t.setDpr(e), Mt(), E.colors.mode === "colors" && q() !== Pe && Dt();
		},
		rebuild(e) {
			N = !1, Nt(e);
		},
		setFieldScale(e) {
			this.setConfig({ fieldScale: e });
		},
		setSource(e) {
			let t = T !== null;
			T?.dispose(), T = e ? po(c, e) : null, T && !t && xe.trigger(), Ce = e ? bt(e) : E.colors.backgroundColor, St(e), Dt(), E.colors.mode === "colors" && jt();
		},
		updateSourceFrame(e) {
			if (!N) {
				if (!T) {
					this.setSource(e);
					return;
				}
				T.uploadFrame(e);
			}
		},
		setConfig(t) {
			E = e({
				...E,
				...t
			}), Ot(), M.ensureAtlas(E.letters.fontFamily), Mt(), E.colors.mode === "colors" && q() !== Pe && Dt(), E.flames.enabled && (!I || E.flames.direction !== L) && (Le = Ba(At(Fe))), L = E.flames.direction, (E.stripesEnabled !== P || oe() !== le || E.flames.enabled !== I || $e(E) === "field" !== ue || E.renderMode !== me || E.cursorTrail.enabled !== ge || E.cursorTrail.type !== qe || Qe() !== et || it() !== K || E.clickWave.enabled !== R || E.clickWave.type !== _e || lt() !== ut || E.letters.enabled !== ve || E.colors.mode !== be || E.background.stars.enabled !== B || ot() !== st) && (E.background.stars.enabled && !B && (Be = un(At(ze))), E.cursorTrail.enabled && !ge && (W = Vi(), Ue = r.now()), E.clickWave.enabled && !R && (He = Xi(), dt = null, ft = "", Ue = r.now()), jt(), P = E.stripesEnabled, le = oe(), I = E.flames.enabled, ue = $e(E) === "field", me = E.renderMode, ge = E.cursorTrail.enabled, qe = E.cursorTrail.type, et = Qe(), K = it(), R = E.clickWave.enabled, _e = E.clickWave.type, ut = lt(), ve = E.letters.enabled, be = E.colors.mode, B = E.background.stars.enabled, st = ot());
		},
		setCursor(e, t) {
			e === null ? Hi(W, null) : Hi(W, {
				x: e,
				y: t ?? 0
			});
		},
		click(e, t) {
			if (ct()) {
				Ni(pt(), E.clickWave.detonation, e, t ?? 0, (r.now() - a) * .001);
				return;
			}
			Zi(He, {
				x: e,
				y: t ?? 0
			}, E.clickWave.lifeMs);
		},
		triggerReveal() {
			xe.trigger();
		},
		setRevealGate(e) {
			xe.setGate(e);
		},
		renderFrame: It,
		setPresentOrigin(e, t) {
			v = e, y = t;
		},
		start: Lt.start,
		stop: Lt.stop,
		settle: Lt.settle,
		readOutputPixels() {
			let e = new Uint8Array(f.width * f.height * 4);
			return c.bindFramebuffer(c.FRAMEBUFFER, null), c.readPixels(0, 0, f.width, f.height, c.RGBA, c.UNSIGNED_BYTE, e), e;
		},
		readCellGrid() {
			let { cols: e, rows: t } = h, n = x.get("cell", e, t), r = new Uint8Array(e * t * 4);
			c.bindFramebuffer(c.FRAMEBUFFER, n.fbo), c.readPixels(0, 0, e, t, c.RGBA, c.UNSIGNED_BYTE, r);
			let i = new Uint8Array(e * t);
			for (let n = 0; n < e * t; n++) i[n] = r[n * 4];
			let a = null;
			if (E.colors.mode === "colors") {
				let n = x.get("cellColor", e, t);
				a = new Uint8Array(e * t * 4), c.bindFramebuffer(c.FRAMEBUFFER, n.fbo), c.readPixels(0, 0, e, t, c.RGBA, c.UNSIGNED_BYTE, a);
			}
			return c.bindFramebuffer(c.FRAMEBUFFER, null), {
				cols: e,
				rows: t,
				values: i,
				colors: a
			};
		},
		getPerf() {
			return w.snapshot();
		},
		getWaterActivity() {
			return G?.activity() ?? 0;
		},
		dispose: Lt.dispose
	};
}
//#endregion
//#region src/field/cellBand.ts
function ls(e, t) {
	if (t.length === 0) return 0;
	let n = [...t].sort((e, t) => e.startFrom - t.startFrom), r = -1;
	for (let t = 0; t < n.length; t++) n[t].startFrom <= e && (r = t);
	return r + 1;
}
//#endregion
//#region src/config/types.ts
var us = [
	"default",
	"wave",
	"constellation",
	"comet"
], ds = ["default", "detonation"];
//#endregion
//#region src/config/serialize.ts
function fs(e) {
	return JSON.stringify(e);
}
function ps(t) {
	return e(JSON.parse(t));
}
//#endregion
//#region src/config/production.ts
function ms(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function hs(e, t) {
	if (!e.enabled) return t ? { enabled: !1 } : void 0;
	let n = {
		enabled: !0,
		type: e.type
	};
	return e.type === "wave" ? {
		...n,
		wave: { ...e.wave }
	} : e.type === "assembly" ? {
		...n,
		assembly: { ...e.assembly }
	} : e.type === "turbulence" ? {
		...n,
		turbulence: { ...e.turbulence }
	} : e.type === "glitch" ? {
		...n,
		glitch: { ...e.glitch }
	} : e.type === "vortex" ? {
		...n,
		vortex: { ...e.vortex }
	} : e.type === "blackhole" ? {
		...n,
		blackhole: { ...e.blackhole }
	} : e.type === "whirlpool" ? {
		...n,
		whirlpool: { ...e.whirlpool }
	} : e.type === "water" ? {
		...n,
		water: { ...e.water }
	} : n;
}
function gs(e, t) {
	let n = e.stripesEnabled, r = {
		color: e.background.color,
		transparent: e.background.transparent
	};
	n && !e.background.transparent && (e.background.gradient.enabled ? r.gradient = {
		...e.background.gradient,
		stops: [...e.background.gradient.stops]
	} : t && (r.gradient = { enabled: !1 }), e.background.grid.enabled ? r.grid = { ...e.background.grid } : t && (r.grid = { enabled: !1 })), e.background.stars.enabled ? r.stars = { ...e.background.stars } : t && (r.stars = { enabled: !1 }), e.background.meteors.enabled ? r.meteors = { ...e.background.meteors } : t && (r.meteors = { enabled: !1 });
	let i = {
		transform: { ...e.transform },
		adjustments: { ...e.adjustments },
		background: r,
		stripesEnabled: e.stripesEnabled,
		fieldScale: e.fieldScale,
		maxFps: e.maxFps
	};
	if (n) {
		let { streamGapWave: n, ...r } = e.grid;
		i.grid = {
			...r,
			...n.enabled ? { streamGapWave: { ...n } } : t ? { streamGapWave: { enabled: !1 } } : {}
		}, i.stripes = e.stripes.map((e) => ({ ...e }));
		let a = {};
		for (let n of [
			"gaps",
			"width",
			"stripe",
			"motion"
		]) {
			let r = e.sparkle[n];
			r.enabled ? a[n] = { ...r } : t && (a[n] = { enabled: !1 });
		}
		Object.keys(a).length > 0 && (i.sparkle = a), e.stripeDots.enabled ? i.stripeDots = { ...e.stripeDots } : t && (i.stripeDots = { enabled: !1 }), e.stripeBorder.enabled ? i.stripeBorder = { ...e.stripeBorder } : t && (i.stripeBorder = { enabled: !1 }), e.gridLines.enabled ? i.gridLines = { ...e.gridLines } : t && (i.gridLines = { enabled: !1 }), e.letters.enabled ? i.letters = { ...e.letters } : t && (i.letters = { enabled: !1 }), e.renderMode === "sharp" ? t && (i.renderMode = "sharp") : (i.renderMode = e.renderMode, i.renderIntensity = e.renderIntensity, i.renderParams = [...e.renderParams], i.renderColorA = e.renderColorA, i.renderColorB = e.renderColorB);
	}
	let a = hs(e.reveal, t);
	if (a && (i.reveal = a), e.flames.enabled) {
		let { vortexSingular: t, ...n } = e.flames;
		i.flames = e.flames.direction === "vortexSingular" ? {
			...n,
			vortexSingular: { ...t }
		} : n;
	} else t && (i.flames = { enabled: !1 });
	if (e.edgeMask.enabled ? i.edgeMask = {
		...e.edgeMask,
		sides: { ...e.edgeMask.sides }
	} : t && (i.edgeMask = { enabled: !1 }), e.cursorTrail.enabled) {
		let { constellation: t, comet: n, ...r } = e.cursorTrail;
		e.cursorTrail.type === "default" ? i.cursorTrail = r : e.cursorTrail.type === "constellation" ? i.cursorTrail = {
			enabled: !0,
			type: "constellation",
			constellation: { ...t }
		} : e.cursorTrail.type === "comet" ? i.cursorTrail = {
			enabled: !0,
			type: "comet",
			comet: { ...n }
		} : i.cursorTrail = {
			enabled: !0,
			type: "wave"
		};
	} else t && (i.cursorTrail = { enabled: !1 });
	if (e.clickWave.enabled) {
		let { detonation: t, ...n } = e.clickWave;
		i.clickWave = e.clickWave.type === "detonation" ? {
			enabled: !0,
			type: "detonation",
			detonation: { ...t }
		} : n;
	} else t && (i.clickWave = { enabled: !1 });
	if (e.colors.mode === "colors") {
		let { gradient: r, ...a } = e.colors;
		i.colors = {
			...a,
			...n && r.enabled ? { gradient: {
				...r,
				stops: [...r.stops]
			} } : t && n ? { gradient: { enabled: !1 } } : {}
		};
	} else t && (i.colors = { mode: "luminance" });
	return i;
}
function _s(e, t) {
	if (!ms(e) || !ms(t)) return e;
	let n = {};
	for (let r of Object.keys(t)) {
		if (!(r in e)) continue;
		let i = e[r], a = t[r], o = ms(i) && ms(a) ? _s(i, a) : i;
		(!ms(o) || Object.keys(o).length > 0) && (n[r] = o);
	}
	return n;
}
function vs(t) {
	let n = gs(e(g(t, "light")), !1);
	if (!t.dark) return n;
	let r = e(g(t, "dark")), i = _s(x(e(n), r), gs(r, !0));
	return Object.keys(i).length > 0 ? {
		...n,
		dark: i
	} : n;
}
function ys(e) {
	return `${JSON.stringify(vs(e), null, 2)}\n`;
}
//#endregion
//#region src/legacy/migrateLegacyConfig.ts
function bs(e) {
	return e && typeof e == "object" && !Array.isArray(e) ? e : null;
}
function xs(e) {
	return parseInt(e.replace(/^#/, ""), 16) || 0;
}
function Ss(e) {
	return {
		color: typeof e.color == "number" ? e.color : typeof e.hex == "string" ? xs(e.hex) : 0,
		startFrom: typeof e.startFrom == "number" ? e.startFrom : 0,
		width: typeof e.width == "number" ? e.width : 1,
		opacity: 1
	};
}
function Cs(e) {
	let t = e.wave ?? {}, n = e.assembly ?? {};
	return {
		enabled: typeof e.enabled == "boolean" ? e.enabled : !1,
		type: e.type === "assembly" ? "assembly" : "wave",
		wave: {
			position: t.position ?? "center",
			durationMs: typeof t.durationMs == "number" ? t.durationMs : 1200,
			softness: typeof t.softness == "number" ? t.softness : .22,
			waviness: typeof t.waviness == "number" ? t.waviness : .11
		},
		assembly: {
			sliceSizePx: 40,
			speedMinMs: typeof n.speedMinMs == "number" ? n.speedMinMs : 300,
			speedMaxMs: typeof n.speedMaxMs == "number" ? n.speedMaxMs : 1600,
			staggerMs: typeof n.staggerMs == "number" ? n.staggerMs : 900,
			scatterPx: 50,
			angleJitterDeg: 22,
			blurPx: 8,
			blurStart: 0
		},
		turbulence: { ...u.turbulence },
		glitch: { ...u.glitch },
		vortex: { ...u.vortex },
		blackhole: { ...u.blackhole },
		whirlpool: { ...u.whirlpool },
		water: { ...u.water }
	};
}
function ws(e) {
	let t = bs(e);
	if (!t) return {};
	let n = {};
	return bs(t.textureAdjustments) && (n.adjustments = t.textureAdjustments), bs(t.sourceTransform) && (n.transform = t.sourceTransform), bs(t.grid) && (n.grid = t.grid), typeof t.backgroundColor == "number" && (n.background = a({
		color: t.backgroundColor,
		transparent: !1
	})), Array.isArray(t.stripes) && (n.stripes = t.stripes.map(Ss)), typeof t.stripesEnabled == "boolean" && (n.stripesEnabled = t.stripesEnabled), bs(t.reveal) && (n.reveal = Cs(t.reveal)), n;
}
//#endregion
//#region src/cometLogo/animation.ts
var Ts = 1.1, Es = 1.1, Ds = .1, Os = 1.18, ks = .45;
function As(e) {
	return e * .85;
}
function js(e = 0) {
	return {
		fieldTimeSec: e,
		formation: 0,
		formationVelocity: 0,
		mode: "field",
		rejoinProgress: 0,
		rejoinStartFieldTimeSec: e,
		rejoinStartFormation: 0,
		rejoinStartFormationVelocity: 0,
		hovered: !1,
		lastTimeSec: null
	};
}
function Ms(e, t, n, r = Ts, i = Es, m = 1) {
	if (e.lastTimeSec === null) return {
		fieldTimeSec: t,
		formation: e.formation,
		formationVelocity: 0,
		mode: n ? "forming" : e.mode,
		rejoinProgress: e.rejoinProgress,
		rejoinStartFieldTimeSec: e.rejoinStartFieldTimeSec,
		rejoinStartFormation: e.rejoinStartFormation,
		rejoinStartFormationVelocity: e.rejoinStartFormationVelocity,
		hovered: n,
		lastTimeSec: t
	};
	if (t < e.lastTimeSec) return {
		fieldTimeSec: t,
		formation: 0,
		formationVelocity: 0,
		mode: n ? "forming" : "field",
		rejoinProgress: 0,
		rejoinStartFieldTimeSec: t,
		rejoinStartFormation: 0,
		rejoinStartFormationVelocity: 0,
		hovered: n,
		lastTimeSec: t
	};
	let a = Math.max(0, Math.min(.1, t - e.lastTimeSec)), o = e.mode, s = e.formation, c = 0, l = e.rejoinProgress, u = e.rejoinStartFieldTimeSec, d = e.rejoinStartFormation, f = e.rejoinStartFormationVelocity;
	if (o === "field" && n && (o = "forming"), o === "forming") !n && s <= Ds ? (o = "field", s = 0, c = 0, l = 0, u = t, d = 0, f = 0) : !n && s > 0 ? (o = "rejoining", l = 0, u = t, d = s, f = e.formationVelocity) : (s = Math.min(1, s + a / Math.max(r, .001)), s > .999999 && (s = 1), c = a > 0 ? (s - e.formation) / a : 0, s === 1 && (o = "logo"));
	else if (o === "logo" && !n) o = "rejoining", l = 0, u = t, d = 1, f = 0;
	else if (o === "rejoining") {
		let e = As(Math.max(i, .001));
		if (n && m === 0) o = "forming", s = 0, c = 0, l = 0;
		else if (n && m === 1) {
			u += 5 * a;
			let p = t - u;
			p <= 0 ? (o = "forming", s = Math.max(0, Math.min(1, d)), c = 0, l = 0, u = t) : l = Math.min(1, p / e);
		} else l = Math.min(1, Math.max(0, t - u) / e), l > .999999 && (l = 1), l === 1 && (s = 0, c = 0, l = 0, o = n ? "forming" : "field");
	}
	return {
		fieldTimeSec: t,
		formation: s,
		formationVelocity: c,
		mode: o,
		rejoinProgress: l,
		rejoinStartFieldTimeSec: u,
		rejoinStartFormation: d,
		rejoinStartFormationVelocity: f,
		hovered: n,
		lastTimeSec: t
	};
}
//#endregion
//#region src/cometLogo/points.ts
var Z = [
	[.70846, .1109],
	[.7797, .10436],
	[.84864, .08538],
	[.9131, .0544],
	[.97098, .01237],
	[1.02035, -.0394],
	[1.05977, -.09907],
	[1.08794, -.1648],
	[1.10398, -.2345],
	[1.10719, -.30598],
	[1.09768, -.37688],
	[1.0756, -.44492],
	[1.03048, -.48776],
	[.95885, -.48776],
	[.88722, -.48776],
	[.81559, -.48776],
	[.74396, -.48776],
	[.67233, -.48776],
	[.60069, -.48776],
	[.52906, -.48776],
	[.47223, -.47794],
	[.50003, -.41192],
	[.53126, -.3476],
	[.57775, -.29338],
	[.63607, -.2521],
	[.70271, -.22639],
	[.77376, -.21803],
	[.84518, -.21254],
	[.91551, -.20349],
	[.87366, -.17114],
	[.80226, -.16535],
	[.73117, -.15737],
	[.66909, -.12349],
	[.63731, -.06056],
	[.64244, .01031],
	[.65954, .07987],
	[.13193, .4878],
	[.20307, .4829],
	[.27299, .46886],
	[.34029, .44528],
	[.40386, .41299],
	[.46259, .37254],
	[.51526, .32447],
	[.56119, .26992],
	[.59947, .20975],
	[.62918, .14493],
	[.61211, .07865],
	[.5854, .01247],
	[.55084, -.04966],
	[.50022, -.09968],
	[.43856, -.13522],
	[.3696, -.15252],
	[.29827, -.15469],
	[.22692, -.15645],
	[.15557, -.15821],
	[.08422, -.15996],
	[.01287, -.16172],
	[-.05848, -.16348],
	[-.12983, -.16524],
	[-.20118, -.16699],
	[-.27253, -.16875],
	[-.34387, -.17051],
	[-.41522, -.17226],
	[-.48657, -.17402],
	[-.55149, -.18834],
	[-.49281, -.2087],
	[-.42146, -.21049],
	[-.35012, -.21228],
	[-.27877, -.21406],
	[-.20742, -.21585],
	[-.13607, -.21763],
	[-.06472, -.21942],
	[.00663, -.2212],
	[.07797, -.22299],
	[.14932, -.22477],
	[.22067, -.22656],
	[.29202, -.22834],
	[.36312, -.23302],
	[.42534, -.26588],
	[.45592, -.32894],
	[.44843, -.39935],
	[.43027, -.46837],
	[.37388, -.4878],
	[.30251, -.4878],
	[.23114, -.4878],
	[.15977, -.4878],
	[.0884, -.4878],
	[.01703, -.4878],
	[-.05434, -.4878],
	[-.12571, -.4878],
	[-.19708, -.4878],
	[-.26845, -.4878],
	[-.33982, -.4878],
	[-.41119, -.4878],
	[-.48256, -.4878],
	[-.55393, -.4878],
	[-.6253, -.4878],
	[-.69668, -.4878],
	[-.76805, -.4878],
	[-.83942, -.4878],
	[-.91079, -.4878],
	[-.98216, -.4878],
	[-1.05353, -.4878],
	[-1.10685, -.46667],
	[-1.10878, -.39545],
	[-1.09655, -.32525],
	[-1.07042, -.25897],
	[-1.03153, -.19928],
	[-.98156, -.14852],
	[-.92251, -.10869],
	[-.85668, -.08149],
	[-.78673, -.06809],
	[-.73273, -.05092],
	[-.72489, .0198],
	[-.69867, .08592],
	[-.65586, .14275],
	[-.59953, .18622],
	[-.53367, .21314],
	[-.46303, .22169],
	[-.39264, .21127],
	[-.33561, .20977],
	[-.29736, .26996],
	[-.25144, .32452],
	[-.19868, .37249],
	[-.14, .413],
	[-.07644, .4453],
	[-.0091, .46877],
	[.06077, .48298]
], Ns = Z.length, Ps = Z.filter((e, t) => t <= 20 || t >= 36 && t <= 46 || t >= 79), Fs = 64, Is = 64, Ls = Ns + 160, Rs = Ns + 160, zs = Rs + 96, Bs = 3, Vs = 2, Q = {
	version: 2,
	fieldSpeed: 1.62,
	fieldDepth: 6.51,
	fieldSpread: 2.18,
	centerClearRadius: 200,
  centerClearAspect: 1,
  centerClearSquareness: 2,
  centerClearLeak: 0,
  centerClearFalloff: 1,
  fieldAlign: 0,
  formationDirectness: 0,
  formationMaxTravel: 0,
  formationEase: 0,
  formationWiggle: 0,
  formationInterrupt: 1,
  formationSpawnRadius: 0,
  formationMode: 0,
  formationParamA: 0.5,
  formationParamB: 0.5,
	fieldTrailLength: 1,
	fieldParticleSize: 1,
	logoScale: .85,
	logoParticleSize: 1,
  logoDensity: 1,
	logoTrailLength: 1,
	logoMotion: 1,
	formationDuration: 1.1,
	rejoinDuration: 1.1,
	formationStagger: .1,
	centerPreference: .78,
	sparkFrequency: 1,
	sparkSize: 1,
	sparkBrightness: 1,
	sparkTrailLength: 1,
	burstProbability: .62,
	waveProbability: .28,
	surfaceEffects: 1,
	fireScale: 1,
	fireIntensity: 1,
	fireSpeed: 1,
	fireTurbulence: 1,
	flameHeight: 1,
	weatherSpeed: 1,
	weatherVariation: 1,
	coronaMist: 1,
	curlingWisps: 1,
	hotRim: 1,
	eruptionFrequency: .08,
	eruptionScale: 1,
	eruptionIntensity: 1,
	eruptionParticles: 1,
	eruptionCycleSpeed: 1
};
function $(e, t, n, r) {
	return typeof e == "number" && Number.isFinite(e) ? Math.max(n, Math.min(r, e)) : t;
}
function Hs(e) {
	let t = e && typeof e == "object" ? e : {}, n = t.version !== 2 && t.formationDuration === 1.8 ? Q.formationDuration : t.formationDuration;
	return {
		version: 2,
		fieldSpeed: $(t.fieldSpeed, Q.fieldSpeed, 0, 4),
		fieldDepth: $(t.fieldDepth, Q.fieldDepth, 2, 12),
		fieldSpread: $(t.fieldSpread, Q.fieldSpread, .5, 5),
		centerClearRadius: $(t.centerClearRadius, Q.centerClearRadius, 0, 400),
    centerClearAspect: $(t.centerClearAspect, Q.centerClearAspect, 0.25, 4),
    centerClearSquareness: $(t.centerClearSquareness, Q.centerClearSquareness, 2, 12),
    centerClearLeak: $(t.centerClearLeak, Q.centerClearLeak, 0, 0.5),
    centerClearFalloff: $(t.centerClearFalloff, Q.centerClearFalloff, 0.05, 8),
    fieldAlign: $(t.fieldAlign, Q.fieldAlign, 0, 1),
    formationDirectness: $(t.formationDirectness, Q.formationDirectness, 0, 1),
    formationMaxTravel: $(t.formationMaxTravel, Q.formationMaxTravel, 0, 8),
    formationEase: $(t.formationEase, Q.formationEase, 0, 4),
    formationWiggle: $(t.formationWiggle, Q.formationWiggle, 0, 3),
    formationSpawnRadius: $(t.formationSpawnRadius, Q.formationSpawnRadius, 0, 3),
    formationMode: $(t.formationMode, Q.formationMode, 0, 15),
    formationParamA: $(t.formationParamA, Q.formationParamA, 0, 4),
    formationParamB: $(t.formationParamB, Q.formationParamB, 0, 4),
    formationInterrupt: $(t.formationInterrupt, Q.formationInterrupt, 0, 2),
		fieldTrailLength: $(t.fieldTrailLength, Q.fieldTrailLength, 0, 3),
		fieldParticleSize: $(t.fieldParticleSize, Q.fieldParticleSize, .25, 3),
		logoScale: $(t.logoScale, Q.logoScale, .35, 1.5),
		logoParticleSize: $(t.logoParticleSize, Q.logoParticleSize, .25, 3),
    logoDensity: $(t.logoDensity, Q.logoDensity, 1, 5),
		logoTrailLength: $(t.logoTrailLength, Q.logoTrailLength, 0, 3),
		logoMotion: $(t.logoMotion, Q.logoMotion, 0, 3),
		formationDuration: $(n, Q.formationDuration, .2, 6),
		rejoinDuration: $(t.rejoinDuration, Q.rejoinDuration, .2, 6),
		formationStagger: $(t.formationStagger, Q.formationStagger, 0, .9),
		centerPreference: $(t.centerPreference, Q.centerPreference, 0, 1),
		sparkFrequency: $(t.sparkFrequency, Q.sparkFrequency, .1, 4),
		sparkSize: $(t.sparkSize, Q.sparkSize, .2, 3),
		sparkBrightness: $(t.sparkBrightness, Q.sparkBrightness, 0, 3),
		sparkTrailLength: $(t.sparkTrailLength, Q.sparkTrailLength, 0, 3),
		burstProbability: $(t.burstProbability, Q.burstProbability, 0, 1),
		waveProbability: $(t.waveProbability, Q.waveProbability, 0, 1),
		surfaceEffects: $(t.surfaceEffects, Q.surfaceEffects, 0, 3),
		fireScale: $(t.fireScale, Q.fireScale, .25, 3),
		fireIntensity: $(t.fireIntensity, Q.fireIntensity, 0, 3),
		fireSpeed: $(t.fireSpeed, Q.fireSpeed, 0, 3),
		fireTurbulence: $(t.fireTurbulence, Q.fireTurbulence, 0, 3),
		flameHeight: $(t.flameHeight, Q.flameHeight, .2, 3),
		weatherSpeed: $(t.weatherSpeed, Q.weatherSpeed, 0, 3),
		weatherVariation: $(t.weatherVariation, Q.weatherVariation, 0, 2),
		coronaMist: $(t.coronaMist, Q.coronaMist, 0, 3),
		curlingWisps: $(t.curlingWisps, Q.curlingWisps, 0, 3),
		hotRim: $(t.hotRim, Q.hotRim, 0, 3),
		eruptionFrequency: $(t.eruptionFrequency, Q.eruptionFrequency, 0, 1),
		eruptionScale: $(t.eruptionScale, Q.eruptionScale, .2, 3),
		eruptionIntensity: $(t.eruptionIntensity, Q.eruptionIntensity, 0, 3),
		eruptionParticles: $(t.eruptionParticles, Q.eruptionParticles, 0, 3),
		eruptionCycleSpeed: $(t.eruptionCycleSpeed, Q.eruptionCycleSpeed, .1, 4)
	};
}
//#endregion
//#region src/cometLogo/shaders.ts
var Us = Z.map(([e, t]) => `vec2(${e.toFixed(5)}, ${t.toFixed(5)})`).join(",\n  "), Ws = Ps.map(([e, t]) => `vec2(${e.toFixed(5)}, ${t.toFixed(5)})`).join(",\n  "), Gs = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uFieldTime;
uniform float uFormation;
uniform float uRejoining;
uniform float uRejoinProgress;
uniform float uRejoinElapsed;
uniform float uRejoinStartFieldTime;
uniform float uRejoinStartFormation;
uniform float uRejoinDuration;
uniform vec2 uFormationOrigin;
uniform float uFormationStartFieldTime;
uniform float uFieldSpeed;
uniform float uFieldDepth;
uniform float uFieldSpread;
uniform float uCenterClearRadius;
uniform float uCenterClearAspect;
uniform float uCenterClearSquareness;
uniform float uCenterClearLeak;
uniform float uCenterClearFalloff;
uniform float uFieldAlign;
uniform float uFormationDirectness;
uniform float uFormationMaxTravel;
uniform float uFormationEase;
uniform float uFormationWiggle;
uniform float uFormationSpawnRadius;
uniform float uFormationMode;
uniform float uFormationParamA;
uniform float uFormationParamB;
uniform float uFieldTrailLength;
uniform float uFieldParticleSize;
uniform float uLogoScale;
uniform float uLogoParticleSize;
uniform float uLogoTrailLength;
uniform float uLogoMotion;
uniform float uFormationDuration;
uniform float uFormationStagger;
uniform float uCenterPreference;
uniform float uSparkFrequency;
uniform float uSparkSize;
uniform float uSparkTrailLength;
uniform float uBurstProbability;
uniform float uWaveProbability;
uniform float uFireScale;
uniform float uFireSpeed;
uniform float uWeatherSpeed;
uniform float uWeatherVariation;
uniform float uEruptionFrequency;
uniform float uEruptionScale;
uniform float uEruptionCycleSpeed;

out vec2 vLocalPx;
flat out float vLengthPx;
flat out float vRadiusPx;
flat out float vOpacity;
flat out float vTrailProgressStart;
flat out float vIsHead;
flat out float vIsSpark;
flat out float vSparkKind;
flat out float vSparkFlicker;
flat out float vIsSurfaceEffect;
flat out float vEffectProgress;
flat out vec2 vEffectOutward;
flat out float vEffectRadiusPx;
flat out float vEffectSeed;

const float SEED = 57383.0;
const float FIELD_TRAIL_SAMPLE_TIME = 0.14;
const float LOGO_TRAIL_SAMPLE_TIME = 0.42;
const float NEEDLE_TRAIL_SAMPLE_TIME = 0.16;
const float BURST_TRAIL_SAMPLE_TIME = 0.11;
const float WAVE_TRAIL_SAMPLE_TIME = 0.055;
const float LOGO_RADIUS_MIN_PX = 2.0;
const float LOGO_RADIUS_SCALE = 0.006;
const float SPARK_KIND_NEEDLE = 0.0;
const float SPARK_KIND_BURST = 1.0;
const float SPARK_KIND_WAVE = 2.0;
const float EVENT_SPARK_START = ${48 .toFixed(1)};
const float EVENT_GROUP_SIZE = ${(48 / 8).toFixed(1)};
const float FORMATION_STARTER_SHARE = 0.12;
const float FIELD_SPAWN_TIME = 0.62;
const float FIELD_RETIRE_TIME = 0.34;
const float FIELD_SPAWN_RADIUS_SCALE = 0.24;
const int REJOIN_CANDIDATE_COUNT = 3;
const float REJOIN_CANDIDATES[REJOIN_CANDIDATE_COUNT] = float[REJOIN_CANDIDATE_COUNT](
  0.85, 1.0, 1.18
);
const float MAX_TRAIL_WORLD = 0.22;
const float LOGO_MAX_TRAIL_WORLD = 0.2;
const float TAU = 6.28318530718;
const int TRAIL_SEGMENT_COUNT = 8;
const vec2 LOGO_POINTS[${Z.length}] = vec2[${Z.length}](
  ${Us}
);
const vec2 SPARK_ANCHOR_POINTS[${Ps.length}] = vec2[${Ps.length}](
  ${Ws}
);
const vec2 QUAD[6] = vec2[6](
  vec2(0.0, -1.0),
  vec2(1.0, -1.0),
  vec2(1.0, 1.0),
  vec2(0.0, -1.0),
  vec2(1.0, 1.0),
  vec2(0.0, 1.0)
);

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// 0 = the shipped direct-flight formation, 1 = scanline, 2 = shatter,
// 3 = columns, 4 = growth, 5 = inspiral, 6 = outflow, 7 = ignition,
// 8 = collapse, 9 = nova, 10 = flare, 11 = lightning, 12 = recombination,
// 13 = phasechange, 14 = fusion, 15 = aurora.
// Uniform-valued, so every trail sample of every particle in a frame takes the
// same branch.
int formationMode() {
  return int(uFormationMode + 0.5);
}

float temporalNoise(float seed, float time) {
  float cell = floor(time);
  float local = fract(time);
  float blend = local * local * (3.0 - 2.0 * local);
  return mix(
    hash11(seed + cell * 17.17),
    hash11(seed + (cell + 1.0) * 17.17),
    blend
  );
}

// Cubic ease with explicit endpoint slopes. The old t(2-t) was this with
// startSlope 2, which spent a comet's whole speed budget in the first ~15% of
// the trip: a yank, then a flat plateau, then decay. A gentler startSlope moves
// the speed peak to the middle and gives a natural bell instead. The departure
// tangent is scaled by 1/startSlope, so the departure speed still equals the
// field velocity exactly no matter which slope is chosen.
float travelEase(float t, float startSlope, float endSlope) {
  float progress = clamp(t, 0.0, 1.0);
  float squared = progress * progress;
  float cubed = squared * progress;
  return (3.0 * squared - 2.0 * cubed)
    + startSlope * (cubed - 2.0 * squared + progress)
    + endSlope * (cubed - squared);
}

float formationStartSlope(float id) {
  return mix(0.65, 0.95, hash11(id * 83.9));
}

float formationTravelEase(float t, float id) {
  int easeMode = int(uFormationEase + 0.5);
  if (easeMode == 1) return travelEase(t, 0.0, 0.0);
  if (easeMode == 2) return travelEase(t, 1.6, 0.0);
  if (easeMode == 3) return clamp(t, 0.0, 1.0);
  if (easeMode == 4) return travelEase(t, 0.0, 1.4);
  return travelEase(t, 0.35, 0.0);
}

float rejoinTravelEase(float t) {
  return travelEase(t, 0.0, 1.0);
}

float historicalFormation(float time, float maximumFormation) {
  float elapsed = time - uFormationStartFieldTime;
  return min(
    maximumFormation,
    clamp(elapsed / max(uFormationDuration, 0.001), 0.0, 1.0)
  );
}

// Lateral swing added to a steered path. The 16e²(1-e)² shape is zero in both
// value and slope at e=0 and e=1, so it bends the trajectory without disturbing
// the velocity match at either end. Sign varies per comet so they swing both ways.
vec2 formationSettleWiggle(float id, float local, vec2 direction, float span) {
  if (uFormationWiggle <= 0.0) return vec2(0.0);
  vec2 normal = vec2(-direction.y, direction.x);
  float frequency = mix(2.1, 3.6, hash11(id * 53.71));
  float phase = hash11(id * 17.93) * TAU;
  float ring = sin(local * frequency * TAU + phase) * exp(-4.2 * local);
  float onset = smoothstep(0.0, 0.22, local);
  return normal * ring * onset * span * 0.05 * uFormationWiggle;
}

vec2 trajectoryBow(float id, vec2 direction, float span, float ease) {
  vec2 normal = vec2(-direction.y, direction.x);
  float swing = hash11(id * 61.7) < 0.5 ? -1.0 : 1.0;
  float amount = swing * mix(0.18, 0.38, hash11(id * 71.3)) * span
    * (1.0 - clamp(uFormationDirectness, 0.0, 1.0));
  float inverse = 1.0 - ease;
  // Triple root at both ends: zero value, slope AND curvature there. The
  // earlier 16e²(1-e)² was only a double root, so it handed the path a lateral
  // acceleration kick right where it rejoins the field — read as a kink even
  // though position and velocity matched exactly.
  return normal * amount * 64.0 * ease * ease * ease * inverse * inverse * inverse;
}

// Matches position, velocity AND acceleration at both ends. Velocity alone
// leaves a curvature discontinuity where the return path meets the field, which
// reads as a kink even though the comet never jumps or changes speed.
vec2 quinticHermite(
  vec2 start,
  vec2 startVelocity,
  vec2 startAcceleration,
  vec2 end,
  vec2 endVelocity,
  vec2 endAcceleration,
  float t
) {
  float t2 = t * t;
  float t3 = t2 * t;
  float t4 = t3 * t;
  float t5 = t4 * t;
  return (1.0 - 10.0 * t3 + 15.0 * t4 - 6.0 * t5) * start
    + (t - 6.0 * t3 + 8.0 * t4 - 3.0 * t5) * startVelocity
    + (0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5) * startAcceleration
    + (10.0 * t3 - 15.0 * t4 + 6.0 * t5) * end
    + (-4.0 * t3 + 7.0 * t4 - 3.0 * t5) * endVelocity
    + (0.5 * t3 - t4 + 0.5 * t5) * endAcceleration;
}

vec2 cubicHermite(vec2 start, vec2 startTangent, vec2 end, vec2 endTangent, float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return (2.0 * t3 - 3.0 * t2 + 1.0) * start
    + (t3 - 2.0 * t2 + t) * startTangent
    + (-2.0 * t3 + 3.0 * t2) * end
    + (t3 - t2) * endTangent;
}

vec2 fieldDirection(float id) {
  vec2 direction = vec2(hash11(id * 2.71), hash11(id * 4.93)) * 2.0 - 1.0;
  int alignIndex = int(floor(id - SEED * 17.173 + 0.5));
  if (uFieldAlign > 0.0 && alignIndex >= 0 && alignIndex < ${Z.length}) {
    vec2 anchor = LOGO_POINTS[alignIndex];
    float anchorLength = length(anchor);
    float directionLength = length(direction);
    if (anchorLength > 0.0001 && directionLength > 0.0001) {
      vec2 mixed = mix(direction / directionLength, anchor / anchorLength, uFieldAlign);
      float mixedLength = length(mixed);
      direction = (mixedLength > 0.0001 ? mixed / mixedLength : anchor / anchorLength)
        * directionLength;
    }
  }
  direction *= mix(0.58, 1.35, hash11(id * 8.11)) * uFieldSpread;
  float magnitude = length(direction);
  return direction / max(magnitude, 0.00001) * max(magnitude, 0.46 * uFieldSpread);
}

float centerClearWorld(vec2 outward, float id) {
  float base = uCenterClearRadius / max(0.5 * uResolution.y, 1.0);
  float a = base * max(uCenterClearAspect, 0.0001);
  float b = base;
  float c = outward.x;
  float s = outward.y;
  float n = max(uCenterClearSquareness, 2.0);
  float k = pow(pow(abs(c) / a, n) + pow(abs(s) / b, n), 1.0 / n);
  float radius = 1.0 / max(k, 0.00001);
  float leakSeed = hash11(id * 2.71);
  float leaks = uCenterClearLeak > 0.0
    ? step(hash11(leakSeed * 613.1 + 7.3), uCenterClearLeak)
    : 0.0;
  float inward = mix(
    0.3,
    1.0,
    pow(hash11(leakSeed * 771.7 + 19.1), 1.0 / max(uCenterClearFalloff, 0.001))
  );
  return radius * mix(1.0, inward, leaks);
}

void fieldCycleBounds(float id, float time, out float age, out float remaining) {
  float speed = max(uFieldSpeed, 0.0001);
  float phase = hash11(id * 1.37) * uFieldDepth;
  float cycle = floor((phase - time * speed) / uFieldDepth);
  age = time - (phase - (cycle + 1.0) * uFieldDepth) / speed;
  remaining = (phase - cycle * uFieldDepth) / speed - time;
}

float fieldSpawnGrowth(float id, float time) {
  float age;
  float remaining;
  fieldCycleBounds(id, time, age, remaining);
  return smoothstep(0.0, FIELD_SPAWN_TIME, age);
}

float fieldLife(float id, float time) {
  float age;
  float remaining;
  fieldCycleBounds(id, time, age, remaining);
  return smoothstep(0.0, FIELD_SPAWN_TIME, age)
    * smoothstep(0.0, FIELD_RETIRE_TIME, remaining);
}

void fieldPoint(
  float id,
  float time,
  out vec2 head,
  out float radiusPx,
  out vec2 velocity
) {
  float z = mod(hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed, uFieldDepth) + 0.24;
  vec2 direction = fieldDirection(id);
  float magnitude = length(direction);
  vec2 outward = direction / max(magnitude, 0.00001);
  float travelled = magnitude / z - magnitude / (uFieldDepth + 0.24);
  head = outward * (centerClearWorld(outward, id) + travelled);
  velocity = direction * uFieldSpeed / (z * z);
  float perspective = mix(0.28, 1.42, 1.0 - z / (uFieldDepth + 0.24));
  radiusPx = max(1.25, uResolution.y * 0.004 * perspective)
    * uFieldParticleSize
    * mix(FIELD_SPAWN_RADIUS_SCALE, 1.0, fieldSpawnGrowth(id, time));
}

// d²/dt² of the field path: z falls linearly, and head goes as 1/z, so this is
// 2·direction·speed²/z³. Cheap and exact, which is what lets the return path
// arrive with the field's curvature and not just its velocity.
vec2 fieldAcceleration(float id, float time) {
  float z = mod(hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed, uFieldDepth) + 0.24;
  return fieldDirection(id) * (2.0 * uFieldSpeed * uFieldSpeed / (z * z * z));
}

float fieldCycleIndex(float id, float time) {
  return floor((hash11(id * 1.37) * uFieldDepth - time * uFieldSpeed) / uFieldDepth);
}

float formationOrder(float id) {
  vec2 startHead;
  float startRadiusPx;
  vec2 startVelocity;
  fieldPoint(id, uFormationStartFieldTime, startHead, startRadiusPx, startVelocity);
  vec2 originWorld = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  float centerOrder = smoothstep(0.04, 1.62, length(startHead));
  float pointerOrder = smoothstep(0.04, 2.1, distance(startHead, originWorld));
  float preferredOrder = mix(pointerOrder, centerOrder, uCenterPreference);
  float starterAdjustedOrder = max(
    0.0,
    (preferredOrder - FORMATION_STARTER_SHARE) / (1.0 - FORMATION_STARTER_SHARE)
  );
  float evenOrder = mix(starterAdjustedOrder, hash11(id * 7.71), 0.4);
  evenOrder = pow(clamp(evenOrder, 0.0, 1.0), 1.7);
  return clamp(
    evenOrder + mix(-0.05, 0.05, hash11(id * 19.31)),
    0.0,
    1.0
  );
}

float localFormation(float id, float formation) {
  float delay = formationOrder(id) * uFormationStagger;
  return clamp((formation - delay) / (1.0 - uFormationStagger), 0.0, 1.0);
}

float formationDepartTime(float id) {
  return uFormationStartFieldTime
    + formationOrder(id) * uFormationStagger * uFormationDuration;
}

float formationTravelTime() {
  return max(uFormationDuration * (1.0 - uFormationStagger), 0.001);
}

vec2 logoContourTangent(int index) {
  int previousIndex = max(0, index - 1);
  int nextIndex = min(${Z.length - 1}, index + 1);
  vec2 contour = LOGO_POINTS[nextIndex] - LOGO_POINTS[previousIndex];
  return contour / max(length(contour), 0.00001);
}

float sparkGroupSeed(float sparkId) {
  if (sparkId < EVENT_SPARK_START) return sparkId + 1.0;
  return floor((sparkId - EVENT_SPARK_START) / EVENT_GROUP_SIZE) + 61.0;
}

float sparkCycleDuration(float sparkId, float groupSeed) {
  if (sparkId < EVENT_SPARK_START) {
    return mix(1.0, 1.8, hash11(groupSeed * 3.17)) / uSparkFrequency;
  }
  return mix(1.3, 2.2, hash11(groupSeed * 3.17)) / uSparkFrequency;
}

float sparkCycleValue(float sparkId, float time) {
  float groupSeed = sparkGroupSeed(sparkId);
  float duration = sparkCycleDuration(sparkId, groupSeed);
  return time / duration + hash11(groupSeed * 5.83);
}

float sparkCyclePhase(float sparkId, float time) {
  return fract(sparkCycleValue(sparkId, time));
}

float sparkCycleRandom(float sparkId, float time, float salt) {
  float groupSeed = sparkGroupSeed(sparkId);
  float cycleIndex = floor(sparkCycleValue(sparkId, time));
  return hash11(groupSeed * 1.91 + cycleIndex * 7.13 + salt);
}

float sparkKind(float sparkId, float time) {
  if (sparkId < EVENT_SPARK_START) return SPARK_KIND_NEEDLE;
  float choice = sparkCycleRandom(sparkId, time, 11.7);
  float eventProbability = min(1.0, uBurstProbability + uWaveProbability);
  float needleProbability = 1.0 - eventProbability;
  float normalizedBurstProbability = eventProbability
    * uBurstProbability
    / max(uBurstProbability + uWaveProbability, 0.0001);
  if (choice < needleProbability) return SPARK_KIND_NEEDLE;
  if (choice < needleProbability + normalizedBurstProbability) return SPARK_KIND_BURST;
  return SPARK_KIND_WAVE;
}

float sparkActiveShare(float kind) {
  if (kind < 0.5) return 0.4;
  if (kind < 1.5) return 0.36;
  return 0.44;
}

float sparkEventVisibility(float sparkId, float time) {
  float threshold = sparkId < EVENT_SPARK_START ? 0.22 : 0.02;
  return step(threshold, sparkCycleRandom(sparkId, time, 23.4));
}

float sparkSizeScale(float sparkId, float time) {
  float randomSize = sparkCycleRandom(sparkId, time, 37.2);
  return mix(0.68, 1.42, pow(randomSize, 1.25)) * uSparkSize;
}

int sparkAnchorIndex(float sparkId, float time) {
  float groupSeed = sparkGroupSeed(sparkId);
  float cycleIndex = floor(sparkCycleValue(sparkId, time));
  float anchor = mod(groupSeed * 29.0 + cycleIndex * 17.0, float(${Ps.length}));
  return int(floor(anchor));
}

vec2 sparkHead(float sparkId, float time, out float radiusPx) {
  float kind = sparkKind(sparkId, time);
  float groupSeed = sparkGroupSeed(sparkId);
  float sizeScale = sparkSizeScale(sparkId, time);
  int anchorIndex = sparkAnchorIndex(sparkId, time);
  vec2 origin = SPARK_ANCHOR_POINTS[anchorIndex] * uLogoScale;
  vec2 outward = origin / max(length(origin), 0.00001);
  vec2 tangent = vec2(-outward.y, outward.x);
  float progress = clamp(sparkCyclePhase(sparkId, time) / sparkActiveShare(kind), 0.0, 1.0);
  float travelEase = 1.0 - (1.0 - progress) * (1.0 - progress);

  if (kind < 0.5) {
    float spread = mix(-0.34, 0.34, hash11(sparkId * 7.19 + 1.0));
    vec2 direction = normalize(outward + tangent * spread);
    float travelRandom = mix(
      hash11(sparkId * 11.57 + 2.0),
      sparkCycleRandom(sparkId, time, 41.9),
      0.58
    );
    float travel = mix(0.09, 0.32, travelRandom) * travelEase * mix(0.82, 1.12, sizeScale);
    float arc = sin(progress * 3.14159265) * mix(-0.018, 0.018, hash11(sparkId * 13.23 + 3.0));
    float gravity = mix(0.008, 0.032, hash11(sparkId * 17.41 + 4.0)) * progress * progress;
    radiusPx = max(0.82, uResolution.y * 0.0019 * mix(0.72, 1.12, hash11(sparkId * 19.13 + 5.0)))
      * sizeScale;
    return origin + direction * travel + tangent * arc + vec2(0.0, -gravity);
  }

  if (kind < 1.5) {
    float member = mod(sparkId - EVENT_SPARK_START, EVENT_GROUP_SIZE);
    float memberProgress = member / (EVENT_GROUP_SIZE - 1.0);
    float spread = mix(-0.78, 0.78, memberProgress)
      + mix(-0.08, 0.08, hash11(sparkId * 7.31 + 6.0));
    vec2 direction = normalize(outward + tangent * spread);
    float travel = mix(0.08, 0.27, sparkCycleRandom(sparkId, time, 43.6))
      * travelEase
      * mix(0.86, 1.14, sizeScale);
    float gravity = mix(0.012, 0.04, hash11(sparkId * 13.91 + 7.0)) * progress * progress;
    origin += tangent * mix(-0.007, 0.007, hash11(sparkId * 17.17 + 8.0));
    radiusPx = max(0.88, uResolution.y * 0.002 * mix(0.76, 1.12, hash11(sparkId * 19.61 + 9.0)))
      * sizeScale;
    return origin + direction * travel + vec2(0.0, -gravity);
  }

  float member = mod(sparkId - EVENT_SPARK_START, EVENT_GROUP_SIZE);
  float centeredMember = member / (EVENT_GROUP_SIZE - 1.0) * 2.0 - 1.0;
  origin += tangent * centeredMember * 0.055 * mix(0.82, 1.18, sizeScale);
  vec2 direction = normalize(outward + tangent * centeredMember * 0.18);
  float travel = 0.03
    + mix(0.15, 0.24, sparkCycleRandom(sparkId, time, 47.3))
      * travelEase
      * mix(0.86, 1.12, sizeScale);
  float bow = (1.0 - centeredMember * centeredMember)
    * sin(progress * 3.14159265)
    * 0.018;
  radiusPx = max(0.82, uResolution.y * 0.00185 * mix(0.84, 1.08, hash11(groupSeed * 13.37)))
    * sizeScale;
  return origin + direction * travel + outward * bow;
}

float sparkOpacity(float sparkId, float time) {
  float kind = sparkKind(sparkId, time);
  float progress = sparkCyclePhase(sparkId, time) / sparkActiveShare(kind);
  float fadeInEnd = kind < 0.5 ? 0.08 : kind < 1.5 ? 0.14 : 0.12;
  float fadeOutStart = kind < 0.5 ? 0.62 : kind < 1.5 ? 0.48 : 0.55;
  float life = smoothstep(0.0, fadeInEnd, progress)
    * (1.0 - smoothstep(fadeOutStart, 1.0, progress))
    * sparkEventVisibility(sparkId, time);
  float formationVisibility = smoothstep(0.62, 0.92, uFormation);
  if (uRejoining > 0.5) {
    formationVisibility *= 1.0 - smoothstep(0.0, 0.28, uRejoinProgress);
  }
  return life * formationVisibility;
}

vec2 livingLogoOffset(int index, float id, float time) {
  vec2 tangent = logoContourTangent(index);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float phase = time * mix(3.8, 6.0, hash11(id * 41.7))
    + float(index) * 0.38
    + hash11(id * 47.3) * TAU;
  float crawl = sin(phase) + 0.42 * sin(phase * 1.91 + id);
  float squirm = sin(phase * 0.73 + id * 0.17) + 0.36 * cos(phase * 1.37);
  return (tangent * crawl * 0.015 + normal * squirm * 0.0095) * uLogoMotion;
}

float gLogoBlend = 0.0;

vec2 logoAnchor(int index) {
  vec2 a = LOGO_POINTS[index];
  if (gLogoBlend <= 0.0) return a;
  return mix(a, LOGO_POINTS[(index + 1) % ${Z.length}], gLogoBlend);
}

float formationTravelSpan(int index, float id) {
  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);
  return length(logoAnchor(index) * uLogoScale - departHead);
}

float formationCrossFade(int index, float id, float local) {
  if (uFormationSpawnRadius <= 0.0) return 1.0;
  // The travel-cap / spawn-radius cross fade belongs to the direct-flight path.
  // Modes 1-4 never take those branches, so the fade would only dim them for
  // no reason.
  if (formationMode() != 0) return 1.0;
  if (uFormationMaxTravel <= 0.0) return 1.0;
  if (formationTravelSpan(index, id) <= uFormationMaxTravel) return 1.0;
  if (uFormationSpawnRadius > 0.0) return min(
    smoothstep(0.34, 0.04, local) + smoothstep(0.36, 0.62, local),
    1.0
  );
  return min(
    smoothstep(0.5, 0.28, local) + smoothstep(0.5, 0.72, local),
    1.0
  );
}

// ---------------------------------------------------------------------------
// Formation mechanics, dispatched on uFormationMode. Mode 0 is the shipped
// direct-flight path and is untouched below.
//
// Every mechanic is a pure function of (index, time, formation). steeredHead is
// called once per trail segment per particle per frame, each call with its own
// 'time' and its own historical 'formation', so any quantity that is allowed to
// differ between two samples of the SAME particle draws a streak across the
// canvas. Consequences enforced throughout this block:
//   * per-particle randomness is seeded from float(index), never from 'id'
//     (hash11 degenerates to ~16-32 distinct values at id-sized inputs);
//   * partitions (shard cell, column, growth arm) depend on 'index' alone;
//   * once a particle is captured it never reads the LIVE field again —
//     fieldPoint wraps depth with mod(), which is a teleport. Captured
//     particles continue a frozen entry sample's own motion instead.
// ---------------------------------------------------------------------------

const float SCAN_LEAD_MAX = 1.60;
const float SCAN_EXTENT = 1.25;
const float SCAN_HEAT = 0.02;
const float SCAN_HEAT_RATE = 9.0;
const float SCAN_SHOCK = 0.07;
const float SCAN_DRIFT = 0.22;

const float SHATTER_SHARD_SIZE = 0.42;
const float SHATTER_WARP = 0.06;
const float SHATTER_EXPAND = 1.55;
const float SHATTER_BLAST_FLAT = 0.45;
const float SHATTER_RADIAL = 0.72;
const float SHATTER_CAPTURE = 0.30;
const float SHATTER_HOLD = 0.36;
const float SHATTER_SHARD_STAGGER = 0.26;
const float SHATTER_LEAD_CAP = 0.22;
const float SHATTER_FLASH = 0.5;

const float COLUMN_COUNT = 13.0;
const float COLUMN_HALF_WIDTH = 1.10880;
const float COLUMN_RULE_SHARE = 0.26;
const float COLUMN_SNAP = 1.6;
const float COLUMN_SHUFFLE = 0.15;
const float COLUMN_DRIFT = 0.22;

const int GROWTH_SPLIT = 36;
const int GROWTH_CLOUD_COUNT = 92;
const int GROWTH_SWOOSH_SEED = 20;
const int GROWTH_CLOUD_SEED = 45;
const float GROWTH_SWOOSH_ARM = 18.0;
const float GROWTH_CLOUD_ARM = 46.0;
const float GROWTH_STEP = 0.0702;
const float GROWTH_APPROACH = 0.18;
const float GROWTH_CARRY_JITTER = 0.65;
const float GROWTH_SPROUT = 0.05;
const float GROWTH_BUD = 1.0;
const float GROWTH_TIP_HEAT = 0.55;
const float GROWTH_PUSH = 0.14;
const float GROWTH_PUSH_RADIUS = 0.30;

float scanWidth() { return clamp(uFormationParamA, 0.15, 1.4); }
float scanRide() { return clamp(uFormationParamB, 0.0, 1.0); }
float shatterBlast() { return clamp(uFormationParamA, 0.0, 1.0); }
float shatterSpin() { return clamp(uFormationParamB, 0.0, 1.2); }
float columnGap() { return clamp(uFormationParamA, 0.0, 1.4); }
float columnStagger() { return clamp(uFormationParamB, 0.0, 0.85); }
float growthCarryLength() { return clamp(uFormationParamA, 0.0, 2.0); }
float growthCling() { return clamp(uFormationParamB, 0.03, 0.8); }

// --- 1 · scanline ----------------------------------------------------------
// A hot bar crosses the canvas. A particle the bar reaches snaps to its own
// slot ROW while its position ALONG the sweep axis is the LINE's, so every
// in-flight particle is collinear and the bar's density profile is the logo's
// cross-section at that x. Finished logo is extruded behind it.

vec2 scanAxis() { return vec2(1.0, 0.0); }

// Capture-band width, a function of 'index' and uniforms only — never of time
// or formation, so the band geometry is identical across every trail sample.
float scanBandWidth(int index) {
  float slotReach = length(LOGO_POINTS[index]) * uLogoScale;
  float widen = mix(0.80, SCAN_LEAD_MAX, smoothstep(0.30, 1.15, slotReach));
  float jitter = mix(0.90, 1.10, hash11(float(index) * 12.79 + 3.17));
  return max(scanWidth() * widen * jitter, 0.02);
}

float scanFar() { return SCAN_EXTENT * uLogoScale; }
float scanStart() { return -(scanFar() + scanWidth() * SCAN_LEAD_MAX * 1.12); }

// The line is driven by 'formation', never by uFieldTime: historicalFormation
// is monotone in time, so the line can never sit in two places for one instant.
float scanLine(float formation) {
  return mix(scanStart(), scanFar(), clamp(formation, 0.0, 1.0));
}

float scanProgress(int index, float formation) {
  float slotU = dot(LOGO_POINTS[index] * uLogoScale, scanAxis());
  float band = scanBandWidth(index);
  return clamp((scanLine(formation) - (slotU - band)) / band, 0.0, 1.0);
}

float scanEntryFormation(int index) {
  float slotU = dot(LOGO_POINTS[index] * uLogoScale, scanAxis());
  return clamp(
    (slotU - scanBandWidth(index) - scanStart()) / max(scanFar() - scanStart(), 0.0001),
    0.0,
    1.0
  );
}

// Exact inverse of scanLine: the field time at which the line entered this
// particle's band. Constant per particle.
float scanEntryTime(int index) {
  return uFormationStartFieldTime + scanEntryFormation(index) * uFormationDuration;
}

vec2 scanlineHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 axis = scanAxis();
  vec2 perp = vec2(-axis.y, axis.x);
  vec2 target = LOGO_POINTS[index] * uLogoScale;
  float slotU = dot(target, axis);
  float slotV = dot(target, perp);

  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);

  float band = scanBandWidth(index);
  float lineU = scanLine(formation);
  float p = clamp((lineU - (slotU - band)) / band, 0.0, 1.0);
  // w(0)=0, w'(0)=0, w(1)=1, w'(1)=0 — the path peels off the starfield and
  // parks on the slot matching position AND velocity at both handoffs.
  float w = p * p * (3.0 - 2.0 * p);

  vec2 base = freeHead;
  if (p > 0.0) {
    // Captured: continue the field's own motion from the frozen entry sample.
    // Matches position and velocity at p == 0 exactly, is C-infinity forever
    // after, and can never hit fieldPoint's depth wrap.
    float entryTime = scanEntryTime(index);
    vec2 anchorHead;
    vec2 anchorVelocity;
    float anchorRadiusPx;
    fieldPoint(id, entryTime, anchorHead, anchorRadiusPx, anchorVelocity);
    float window = max(SCAN_DRIFT, 0.001);
    float anchorSpeed = min(length(anchorVelocity), 2.4);
    vec2 anchorDir = anchorVelocity / max(length(anchorVelocity), 0.00001);
    base = anchorHead
      + anchorDir * anchorSpeed * window
        * (1.0 - exp(-max(time - entryTime, 0.0) / window));
    radiusPx = mix(radiusPx, anchorRadiusPx, w);
  }

  // Bow shock: the front shoves un-captured field ahead of it and drags a wake
  // behind, so the line is visible even where it crosses empty starfield.
  // -2.33*q*exp(-q*q) is odd and C-infinity, and it is applied identically on
  // both sides of the p > 0 branch so the branch still agrees at p == 0.
  float shockWidth = max(0.5 * band, 0.0001);
  float q = (lineU - dot(base, axis)) / shockWidth;
  float shockAmount = -2.33 * q * exp(-q * q) * SCAN_SHOCK * (1.0 - w);
  float splay = clamp(dot(base, perp) * 2.5, -1.0, 1.0);
  base += axis * shockAmount + perp * (shockAmount * 0.4 * splay);

  // slotU - lineU == band * (1 - p) identically, so axisU -> slotU at p == 1
  // with ZERO derivative for any e with e(1) == 1: the particle decelerates
  // into its slot instead of being released at line speed.
  float e = pow(p, mix(1.0, 5.0, scanRide()));
  float axisU = mix(lineU, slotU, e);

  // Front heat. Double root at both p = 0 and p = 1, so it perturbs neither
  // handoff in value or slope.
  float heatEnvelope = 16.0 * p * p * (1.0 - p) * (1.0 - p);
  float heatPhase = time * SCAN_HEAT_RATE + hash11(float(index) * 7.31) * TAU;
  float heat = SCAN_HEAT * heatEnvelope
    * (sin(heatPhase) + 0.45 * sin(heatPhase * 1.87 + float(index) * 0.37));

  vec2 linePoint = axis * (axisU + heat) + perp * slotV;

  return mix(base, linePoint, w)
    + livingLogoOffset(index, id, time) * smoothstep(0.55, 1.0, p);
}

// --- 2 · shatter -----------------------------------------------------------
// Comets fly onto an oversized broken shell of the mark — about a dozen rigid
// shards, each kicked outward and rotated off-axis — which then spins level,
// shrinks and slams home one shard at a time.

// The partition is a function of 'index' ALONE: no time, no formation, no
// branch. A particle can never change shard mid-trail.
vec2 shatterCell(int index) {
  vec2 point = LOGO_POINTS[index];
  vec2 warped = point + SHATTER_WARP * vec2(
    sin(point.y * 6.10 + 1.70) + 0.55 * sin(point.x * 3.30 + 0.40),
    sin(point.x * 5.30 - 0.90) + 0.55 * sin(point.y * 4.10 + 2.20)
  );
  return floor(warped / SHATTER_SHARD_SIZE);
}

// Collapse is driven by the shard-uniform 'formation', NEVER by the
// per-particle 'local' — that is what keeps a shard rigid. 'hold' is raised to
// the formation value at which the last possible member finishes capture, so
// the shell is always complete before any shard starts moving.
float shatterCollapse(int index, float formation) {
  vec2 cell = shatterCell(index);
  float shardB = hash11(dot(cell, vec2(57.0, 23.0)) + 71.90);
  float captureEnd = uFormationStagger + SHATTER_CAPTURE * (1.0 - uFormationStagger);
  float hold = min(max(SHATTER_HOLD, captureEnd), 0.82);
  float room = 1.0 - hold;
  float shardStagger = clamp(SHATTER_SHARD_STAGGER, 0.0, room * 0.8);
  return travelEase(
    clamp((formation - hold - shardB * shardStagger) / (room - shardStagger), 0.0, 1.0),
    0.30,
    0.0
  );
}

vec2 shatterHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  vec2 point = LOGO_POINTS[index];
  vec2 cell = shatterCell(index);
  vec2 pivot = (cell + 0.5) * SHATTER_SHARD_SIZE;
  // cell components stay inside about [-6, 6], so these hash inputs are < 500 —
  // nowhere near the range where hash11 degenerates.
  float shardA = hash11(dot(cell, vec2(37.0, 91.0)) + 11.30);
  float shardC = hash11(dot(cell, vec2(17.0, 43.0)) + 3.70);
  float collapse = shatterCollapse(index, formation);

  // One uniform dilation of the whole mark plus a per-shard kick and spin about
  // the shard pivot. All three are shard-uniform, so the members undergo one
  // similarity transform, and all three decay to identity — at collapse == 1
  // this is exactly LOGO_POINTS[index] * uLogoScale.
  float dilation = mix(max(SHATTER_EXPAND, 1.0), 1.0, collapse);
  vec2 outward = pivot / max(length(pivot), 0.0001);
  float kickAngle = shardA * TAU;
  vec2 kickBlend = mix(
    vec2(cos(kickAngle), sin(kickAngle)),
    outward,
    SHATTER_RADIAL
  );
  vec2 kick = kickBlend / max(length(kickBlend), 0.0001)
    * shatterBlast()
    * mix(0.68, 1.32, shardC)
    * vec2(1.0, SHATTER_BLAST_FLAT)
    * (1.0 - collapse);
  float spin = (shardC * 2.0 - 1.0) * shatterSpin() * (1.0 - collapse);
  float spinCos = cos(spin);
  float spinSin = sin(spin);
  vec2 arm = (point - pivot) * dilation;
  vec2 pose = (
    pivot * dilation
    + kick
    + vec2(arm.x * spinCos - arm.y * spinSin, arm.x * spinSin + arm.y * spinCos)
  ) * uLogoScale;

  // Capture. 'lead' is the field path's own tangent ray, saturating at
  // SHATTER_LEAD_CAP so a near-plane comet cannot shoot off; it is a straight
  // ray from a frozen sample, never the recycling field path. smoothstep gives
  // w(0) == 0 AND w'(0) == 0, so at local == 0 this returns departHead with
  // velocity departVelocity — an exact match with the free-field branch.
  float w = smoothstep(0.0, SHATTER_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * SHATTER_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / SHATTER_LEAD_CAP));

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx, w);

  return mix(lead, pose, w)
    + livingLogoOffset(index, id, time) * smoothstep(0.08, 0.72, local) * collapse;
}

// --- 3 · columns -----------------------------------------------------------
// The starfield is ruled into vertical wires at the logo's own x positions,
// each wire packs into that column's y-profile parked one gap above or below
// the logo (alternating by column parity), and the finished columns are then
// driven home one at a time, left to right, overshooting into the seam.

float columnIndexFor(int index) {
  float halfSpan = COLUMN_HALF_WIDTH * uLogoScale;
  float colWidth = 2.0 * halfSpan / COLUMN_COUNT;
  return clamp(
    floor((LOGO_POINTS[index].x * uLogoScale + halfSpan) / max(colWidth, 0.00001)),
    0.0,
    COLUMN_COUNT - 1.0
  );
}

float columnOrderFor(int index) {
  float col = columnIndexFor(index);
  return clamp(
    mix(
      col / max(COLUMN_COUNT - 1.0, 1.0),
      hash11(col * 4.113 + 1.7),
      COLUMN_SHUFFLE
    ),
    0.0,
    1.0
  );
}

// This column's own progress. Used in place of localFormation for radius,
// trail and opacity so particle size cannot lock canvas-wide while the columns
// rack in one at a time.
float columnProgress(int index, float id, float formation) {
  float g = localFormation(id, formation);
  float stagger = columnStagger();
  return clamp((g - columnOrderFor(index) * stagger) / max(1.0 - stagger, 0.05), 0.0, 1.0);
}

vec2 columnsHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float g = localFormation(id, formation);
  if (g <= 0.0) return freeHead;

  float departTime = formationDepartTime(id);
  vec2 anchorHead;
  vec2 anchorVelocity;
  float anchorRadiusPx;
  fieldPoint(id, departTime, anchorHead, anchorRadiusPx, anchorVelocity);
  radiusPx = anchorRadiusPx;

  // The hold beat. The original design read the LIVE field for the first 9% of
  // the timeline, which exposes fieldPoint's mod() depth wrap: a trail spanning
  // the wrap has one free sample and one captured one, the engine's
  // fieldRecycled guard never fires, and a full-canvas streak is drawn. So the
  // live read is gone — this continues the frozen departure sample's own motion
  // and coasts it to rest, which equals freeHead at g == 0 in both position and
  // velocity and can never wrap.
  float window = max(COLUMN_DRIFT, 0.001);
  float anchorSpeed = min(length(anchorVelocity), 2.4);
  vec2 anchorDir = anchorVelocity / max(length(anchorVelocity), 0.00001);
  vec2 base = anchorHead
    + anchorDir * anchorSpeed * window
      * (1.0 - exp(-max(time - departTime, 0.0) / window));

  vec2 target = LOGO_POINTS[index] * uLogoScale;
  float col = columnIndexFor(index);
  float side = mod(col, 2.0) < 0.5 ? 1.0 : -1.0;

  float rule = smoothstep(0.0, COLUMN_RULE_SHARE, g);
  float c = columnProgress(index, id, formation);
  float pack = smoothstep(0.10, 0.62, c);
  float drive = clamp((c - 0.62) / 0.38, 0.0, 1.0);
  float du = drive - 1.0;
  float driveEase = 1.0 + du * du * ((COLUMN_SNAP + 1.0) * du + COLUMN_SNAP);

  float ruledX = mix(base.x, target.x, rule);

  float idlePhase = time * mix(1.9, 3.1, hash11(float(index) * 3.17))
    + hash11(float(index) * 7.91) * TAU;
  float wireY = base.y + sin(idlePhase) * 0.05 * rule * (1.0 - pack);
  // pack reaches 1 at c = 0.62 and drive is still 0 there, so when the drive
  // starts every member of the column sits at exactly target.y + side * gap and
  // the last beat is a pure rigid translation.
  wireY = mix(wireY, target.y + side * columnGap(), pack);
  wireY = mix(wireY, target.y, driveEase);

  return vec2(ruledX, wireY) + livingLogoOffset(index, id, time) * smoothstep(0.55, 0.95, c);
}

// --- 4 · growth ------------------------------------------------------------
// One seed where the swoosh touches the cloud sprouts four growth fronts that
// crawl around the two closed outlines; each comet flies in and latches onto
// the moving front a fixed arclength behind its own slot, rides it along the
// shape, then peels off and locks as the front passes its slot.
//
// Measured from LOGO_POINTS: two closed, contour-ordered loops, swoosh [0,36)
// closing at 0.058 and cloud [36,128) closing at 0.071; the only inter-point
// step above 0.09 is 35 -> 36, the gap between the loops. Step length is near
// constant, so "arclength from the seed" == "index offset from the seed" and no
// arclength table or 128-iteration loop is needed. The loops touch at index 20
// and index 81 (0.043 apart), which is the single visible seed.

struct GrowthArm {
  int base;
  int count;
  int seed;
  float dir;
  float slot;
  float ignite;
};

// Index units of front travel per unit of formation. Chosen so the front is at
// the seed at formation == GROWTH_APPROACH and has fully locked the farthest
// particle exactly at formation == 1.
float growthFrontSpeed() {
  float clingIdx = growthCling() / GROWTH_STEP;
  return (GROWTH_CLOUD_ARM + clingIdx) / max(1.0 - GROWTH_APPROACH, 0.12);
}

float growthIgnite(int base) {
  // GROWTH_BUD delays the short loop so both loops finish together at the same
  // pen speed — it reads as a second shoot budding from the same seed later.
  return base == 0
    ? (GROWTH_CLOUD_ARM - GROWTH_SWOOSH_ARM) / growthFrontSpeed() * GROWTH_BUD
    : 0.0;
}

GrowthArm growthArmOf(int base, int count, int seed, float dir) {
  GrowthArm a;
  a.base = base;
  a.count = count;
  a.seed = seed;
  a.dir = dir;
  a.slot = 0.0;
  a.ignite = growthIgnite(base);
  return a;
}

GrowthArm growthArm(int index) {
  bool swoosh = index < GROWTH_SPLIT;
  int base = swoosh ? 0 : GROWTH_SPLIT;
  int count = swoosh ? GROWTH_SPLIT : GROWTH_CLOUD_COUNT;
  int seed = swoosh ? GROWTH_SWOOSH_SEED : GROWTH_CLOUD_SEED;
  float off = float(index - base - seed);
  off -= float(count) * floor(off / float(count) + 0.5);
  GrowthArm a = growthArmOf(base, count, seed, off < 0.0 ? -1.0 : 1.0);
  a.slot = abs(off);
  return a;
}

// Point on this arm, 'coord' index units from the seed. Continuous across the
// array wrap because each loop is geometrically closed.
vec2 growthContour(GrowthArm a, float coord) {
  float f = float(a.seed) + a.dir * coord;
  float wrapped = f - float(a.count) * floor(f / float(a.count));
  int i0 = clamp(int(floor(wrapped)), 0, a.count - 1);
  int i1 = i0 + 1 == a.count ? 0 : i0 + 1;
  return mix(LOGO_POINTS[a.base + i0], LOGO_POINTS[a.base + i1], wrapped - float(i0))
    * uLogoScale;
}

// C1 smooth minimum (iq). Exactly == a once b >= a + k, exactly == b once
// b <= a - k.
float growthSmoothMin(float a, float b, float k) {
  k = max(k, 0.0001);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// How far behind its own slot this particle latches onto the front, in index
// units. Seeded from float(index), never from 'id'. Clamped to 0.5 * slot so
// particles near the seed still launch at staggered times.
float growthCarry(int index, float slot) {
  float carry = (growthCarryLength() / GROWTH_STEP)
    * mix(1.0 - 0.6 * GROWTH_CARRY_JITTER, 1.0, hash11(float(index) * 3.71 + 0.13));
  return min(carry, 0.5 * slot);
}

// The rail: where this particle sits when attached to the front, as a pure
// function of the front position. Evaluating it at the per-particle-CONSTANT
// arrival front gives the flight's landing anchor for free, which is what makes
// the hand-off exact rather than approximate.
vec2 growthRail(int index, GrowthArm a, float front) {
  float clingIdx = growthCling() / GROWTH_STEP;
  float coord = growthSmoothMin(a.slot, front, clingIdx);
  vec2 point = growthContour(a, coord);
  vec2 ahead = growthContour(a, coord + 1.0);
  vec2 behind = growthContour(a, coord - 1.0);
  vec2 tangent = (ahead - behind) / max(length(ahead - behind), 0.00001);
  vec2 normal = vec2(-tangent.y, tangent.x);
  float lock = smoothstep(-clingIdx, clingIdx, front - a.slot);
  float wobble = sin(coord * 0.9 + hash11(float(index) * 7.13 + 0.29) * TAU);
  // The bud thickens sideways off the outline while riding and is exactly zero
  // once locked, so the settled shape is pixel-exact on LOGO_POINTS.
  return point + normal * (GROWTH_SPROUT * uLogoScale * (1.0 - lock) * wobble);
}

float growthLaunch(int index, GrowthArm a) {
  return a.ignite + (a.slot - growthCarry(index, a.slot)) / growthFrontSpeed();
}

float growthFront(GrowthArm a, float formation) {
  return growthFrontSpeed() * (clamp(formation, 0.0, 1.0) - GROWTH_APPROACH - a.ignite);
}

float growthFlight(int index, GrowthArm a, float formation) {
  return clamp(
    (clamp(formation, 0.0, 1.0) - growthLaunch(index, a)) / max(GROWTH_APPROACH, 0.02),
    0.0,
    1.0
  );
}

// 0 = still free-drifting, 1 = locked into its slot.
float growthLocal(int index, float formation) {
  GrowthArm a = growthArm(index);
  float clingIdx = growthCling() / GROWTH_STEP;
  float lock = smoothstep(-clingIdx, clingIdx, growthFront(a, formation) - a.slot);
  return growthFlight(index, a, formation) * mix(0.5, 1.0, lock);
}

vec2 growthHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);

  GrowthArm arm = growthArm(index);
  float launch = growthLaunch(index, arm);
  float flight = growthFlight(index, arm, formation);
  if (flight <= 0.0) return freeHead;

  // historicalFormation is the linear map g = (time - start) / duration, so
  // this is the exact wall-clock instant at which flight crosses 0, and
  // cubicHermite at t == 0 returns departHead — the same point the free branch
  // returns at that instant. The seam has zero length.
  float departTime = uFormationStartFieldTime + launch * uFormationDuration;
  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, departTime, departHead, departRadiusPx, departVelocity);
  radiusPx = departRadiusPx;

  float clingIdx = growthCling() / GROWTH_STEP;
  float front = growthFront(arm, formation);

  // Per-particle CONSTANT: by construction front == arriveFront exactly when
  // flight == 1, so the flight lands on the live rail with no seam and no blend.
  float arriveFront = arm.slot - growthCarry(index, arm.slot);
  vec2 anchor = growthRail(index, arm, arriveFront);
  vec2 rail = growthRail(index, arm, front);

  vec2 toAnchor = anchor - departHead;
  float span = max(length(toAnchor), 0.00001);
  float travel = max(GROWTH_APPROACH * uFormationDuration, 0.001);

  float startSlope = mix(0.65, 0.95, hash11(float(index) * 0.317 + 0.11));
  float departSpeed = length(departVelocity);
  vec2 startTangent = departVelocity / max(departSpeed, 0.00001)
    * min(departSpeed * travel / startSlope, span * 0.62);

  // Arrive travelling at the front's own velocity: travelEase's end slope is
  // 1.0 and endTangent is the contour direction times the rail speed times the
  // flight time, so dP/dt at hand-off equals the rail's dP/dt exactly — the
  // comet is picked up, it never brakes. Taken from growthContour rather than
  // growthRail so it cannot degenerate where the smooth-min saturates.
  float anchorCoord = growthSmoothMin(arm.slot, arriveFront, clingIdx);
  vec2 railAhead = growthContour(arm, anchorCoord + 0.6);
  vec2 railBehind = growthContour(arm, anchorCoord - 0.6);
  vec2 railDirection = (railAhead - railBehind)
    / max(length(railAhead - railBehind), 0.00001);
  float railSpeed = growthFrontSpeed() * GROWTH_STEP * uLogoScale
    / max(uFormationDuration, 0.001);
  vec2 endTangent = railDirection * railSpeed * travel;
  float endLength = length(endTangent);
  if (endLength > span * 0.75) endTangent *= span * 0.75 / endLength;

  float ease = travelEase(flight, startSlope, 1.0);
  float lock = smoothstep(-clingIdx, clingIdx, front - arm.slot);

  // step(1.0, flight) is the only hard switch in the mechanic, and it
  // multiplies (rail - anchor), which is identically zero at the switch point:
  // anchor and rail are the SAME function of one scalar, and the flight window
  // is defined so that front == arriveFront exactly when flight == 1.
  float carried = step(1.0, flight);

  return cubicHermite(departHead, startTangent, anchor, endTangent, ease)
    + trajectoryBow(float(index) * 0.4271 + 0.13, toAnchor / span, span, ease)
    + (rail - anchor) * carried
    + livingLogoOffset(index, id, time) * lock * flight;
}

// A smooth vector field pushing field comets away from one growth tip. d times
// a gaussian, so it is zero AT the tip and C-infinity everywhere.
vec2 growthTipPush(vec2 head, GrowthArm a, float armLength, float formation) {
  float front = growthFront(a, formation);
  float envelope = smoothstep(0.0, 2.0, front)
    * (1.0 - smoothstep(armLength - 3.0, armLength + 1.0, front));
  vec2 tip = growthContour(a, clamp(front, 0.0, armLength));
  vec2 offset = head - tip;
  float radius = GROWTH_PUSH_RADIUS;
  return offset
    * (GROWTH_PUSH / radius)
    * exp(-dot(offset, offset) / (radius * radius))
    * envelope;
}

// --- 5 · inspiral ----------------------------------------------------------
// Keplerian accretion. A captured comet keeps the outward drift it already had,
// a viscous torque spins it up, and from there it ORBITS: angular momentum is
// conserved, so as the guiding-centre radius collapses the sweep runs away as
// 1/R^2. Every comet completes at least one full revolution before its orbit
// circularises onto its slot, so at no instant is it travelling toward a
// target. The mark appears because a differentially-rotating disc runs out of
// radius. No blend, no frozen-sample coast, no step() anywhere.

const float INSPIRAL_EPI_RATE = 5.81;
const float INSPIRAL_EPI_DAMP = 1.35;
const float INSPIRAL_EPI_SPREAD = 0.34;
const float INSPIRAL_DRIFT_SLOPE = 1.0;
const float INSPIRAL_TURN_MIN = 0.85;
const float INSPIRAL_TURN_MAX = 2.10;
const float INSPIRAL_SHEAR = 0.18;
// Overflow guard on the inherited drift, NOT a taming knob. Anything it clips
// loses the exact velocity match at the capture seam — the whole point of the
// mechanic — so it is deliberately set above the fastest departure the shipped
// field config can produce (measured max ~30 world/s at fieldSpread 2.18,
// fieldSpeed 0.9). Lower it and the comets it binds visibly BRAKE at capture.
const float INSPIRAL_SPEED_CAP = 40.0;
const float INSPIRAL_CHURN_GAIN = 5.6;
const float INSPIRAL_CHURN_DAMP = 2.2;
const float INSPIRAL_MIN_RADIUS = 0.03;
const float INSPIRAL_FIELD_SWIRL = 0.55;
const float INSPIRAL_COOL = 0.42;
const float INSPIRAL_FLASH = 0.85;

float inspiralWinding() { return clamp(uFormationParamA, 0.25, 3.0); }
float inspiralChurn() { return clamp(uFormationParamB, 0.0, 1.6); }

// Every field here is a function of (index, id) and FRAME-CONSTANT uniforms
// only — formationDepartTime is fixed for the whole formation, so 'depart',
// 'delta' and therefore 'sweep' cannot differ between two trail samples of the
// same comet, nor between two frames of one formation.
struct Inspiral {
  vec2 slotDir;
  float r0;
  float rs;
  float sweep;
  float epi;
  float epiRate;
};

Inspiral inspiralOrbit(int index, float id, out vec2 depart, out float departRadiusPx) {
  Inspiral o;
  vec2 slot = LOGO_POINTS[index] * uLogoScale;
  vec2 departVelocity;
  fieldPoint(id, formationDepartTime(id), depart, departRadiusPx, departVelocity);

  o.r0 = max(length(depart), 0.02);
  o.rs = length(slot);
  vec2 departDir = depart / o.r0;
  // Rebuilding the endpoint by ROTATING the slot vector (rather than by
  // cos/sin of an angle) is what makes the landing bit-exact.
  o.slotDir = o.rs > 0.001 ? slot / o.rs : departDir;

  // Signed angle from the capture ray to the slot ray, lifted into [0, TAU) so
  // the whole disc turns ONE way.
  float side = depart.x * slot.y - depart.y * slot.x;
  float along = depart.x * slot.x + depart.y * slot.y;
  float delta = atan(side, along + 1.0e-9);
  if (delta < 0.0) delta += TAU;

  // Kepler: a slot deeper in the potential well is swept more before it
  // circularises. floor(x + 0.5) lands the winding on the NEAREST whole turn
  // plus delta, so the orbit closes exactly on the slot with no corrective
  // term anywhere in the path — and max(1.0, ...) guarantees every comet
  // completes at least one full revolution, which is what makes its landing
  // angle unreadable from its early motion.
  float desired = TAU * inspiralWinding()
    * mix(INSPIRAL_TURN_MIN, INSPIRAL_TURN_MAX, smoothstep(1.15, 0.16, o.rs))
    * mix(1.0 - INSPIRAL_SHEAR, 1.0 + INSPIRAL_SHEAR,
          hash11(float(index) * 5.113 + 0.71));
  o.sweep = delta + TAU * max(1.0, floor((desired - delta) / TAU + 0.5));

  o.epiRate = INSPIRAL_EPI_RATE * mix(
    1.0 - INSPIRAL_EPI_SPREAD,
    1.0 + INSPIRAL_EPI_SPREAD,
    hash11(float(index) * 9.173 + 0.31)
  );

  // Eccentricity is INHERITED, not authored. Solve the epicycle amplitude so
  // that dr/dg at capture equals the field comet's own outward speed:
  //   dr/dp(0) = (rs - r0) + epi * epiRate,  dr/dg(0) = dr/dp(0) * slope
  //   => epi = (speed * travelTime / slope + (r0 - rs)) / epiRate
  // The comet therefore leaves the starfield without changing speed at all.
  float departSpeed = min(length(departVelocity), INSPIRAL_SPEED_CAP);
  o.epi = (departSpeed * formationTravelTime() / INSPIRAL_DRIFT_SLOPE + (o.r0 - o.rs))
    / o.epiRate;
  return o;
}

// Ease with an explicit start slope and a DOUBLE zero at the end:
//   p(g) = 1 - (1-g)^3 * (1 + (3 - s) g),  p'(g) = (1-g)^2 (s + 4(3-s) g)
// p(0)=0, p(1)=1, p'(0)=s, p'(1)=p''(1)=0 for ANY s, and p' >= 0 for s in
// [0, 3]. The double zero at g == 1 is the brake that lets the disc lock.
float inspiralEase(float g, float startSlope) {
  float t = clamp(g, 0.0, 1.0);
  float inv = 1.0 - t;
  return 1.0 - inv * inv * inv * (1.0 + (3.0 - startSlope) * t);
}

float inspiralGuide(Inspiral o, float p) {
  return o.r0 + (o.rs - o.r0) * p;
}

// Fraction of the total sweep completed. R is LINEAR in p, which is the whole
// reason this closes in elementary functions:
//   int_0^p dq / R(q)^2 = p / (r0 * R(p))      int_0^1 = 1 / (r0 * rs)
// so the ratio is p * rs / R(p): exactly Kepler's equal-areas law, no
// integrator, no per-frame state, and 0 at p=0 / 1 at p=1 by construction.
float inspiralSwept(Inspiral o, float p) {
  return p * o.rs / max(inspiralGuide(o, p), 0.0001);
}

// Damped radial oscillation about the guiding centre — the epicycle. The
// (1-p)^2 factor is zero in value AND slope at p = 1, so the landing stays
// exact for any amplitude or rate; the exp() is the circularisation.
float inspiralEpicycle(Inspiral o, float p) {
  float fade = 1.0 - p;
  return o.epi * sin(o.epiRate * p) * exp(-INSPIRAL_EPI_DAMP * p) * fade * fade;
}

// Turbulence that DAMPS as the disc compresses. Double roots at both ends, so
// it perturbs neither the capture handoff nor the final slot. Seeded from
// float(index) — never from 'id', which hash11 cannot resolve at ~985000.
vec2 inspiralChurnOffset(int index, float p) {
  float amount = inspiralChurn();
  if (amount <= 0.0) return vec2(0.0);
  float fade = 1.0 - p;
  float envelope = p * p * fade * fade * exp(-INSPIRAL_CHURN_DAMP * p);
  return vec2(
      sin(mix(4.4, 9.8, hash11(float(index) * 2.113 + 0.37)) * p
        + hash11(float(index) * 11.71 + 0.53) * TAU),
      sin(mix(3.1, 7.7, hash11(float(index) * 6.317 + 0.91)) * p
        + hash11(float(index) * 15.29 + 0.17) * TAU)
    ) * amount * INSPIRAL_CHURN_GAIN * envelope;
}

vec2 inspiralRotate(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

// 222.7 * g^10 * (1-g)^2 — peaks at exactly 1.0 at g = 0.8333, with a tenth
// root at 0 (invisible for the whole inflow) and a double root at 1 (the
// settled mark is left at plain opacity, never a permanent hot offset).
float inspiralIgnition(float g) {
  float t = clamp(g, 0.0, 1.0);
  float rise = t * t * t * t * t;
  float fall = 1.0 - t;
  return 222.7 * rise * rise * fall * fall;
}

vec2 inspiralHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float g = localFormation(id, formation);
  if (g <= 0.0) return freeHead;

  vec2 depart;
  float departRadiusPx;
  Inspiral o = inspiralOrbit(index, id, depart, departRadiusPx);
  radiusPx = departRadiusPx;

  // TWO eases of the SAME progress. The radius keeps the drift it arrived with
  // (start slope 1.0); the angle starts from a zero rate because the field has
  // no tangential velocity at all — the torque ramps in instead of being
  // applied as a kick. Both are exactly 1 with exactly zero slope at g == 1.
  float pr = inspiralEase(g, INSPIRAL_DRIFT_SLOPE);
  float pa = inspiralEase(g, 0.0);

  // max() is a safety floor for the rare comet captured well inside its own
  // slot radius; it is C0, so it can never draw a streak.
  float radius = max(inspiralGuide(o, pr) + inspiralEpicycle(o, pr), INSPIRAL_MIN_RADIUS);
  float phase = -o.sweep * (1.0 - inspiralSwept(o, pa));

  // At g == 0: phase == -sweep == -delta (mod TAU), so radial == departDir and
  // this returns departDir * r0 == fieldPoint(id, departTime) — the SAME point
  // the free-field branch returns at that instant, with the same velocity.
  // At g == 1: phase == 0, radius == rs, churn == 0, so this returns
  // slotDir * rs == LOGO_POINTS[index] * uLogoScale, at rest.
  vec2 radial = inspiralRotate(o.slotDir, phase);
  vec2 tangent = vec2(-radial.y, radial.x);
  vec2 churn = inspiralChurnOffset(index, pr);

  return radial * (radius + churn.x)
    + tangent * churn.y
    + livingLogoOffset(index, id, time) * smoothstep(0.62, 1.0, g);
}

// --- 6 · outflow -----------------------------------------------------------
// A cloud with net angular momentum condenses. It cannot fall straight in, so
// it flattens into a differentially-rotating disk that drains inward while the
// core vents angular momentum through two polar jets. Nothing is aimed at a
// slot: the mark is the END STATE of the disk. Every non-disk term (jet, clump,
// turbulence) carries a factor that is exactly 0 at tau == 1, so the settled
// frame is LOGO_POINTS[index] * uLogoScale.
//
// The disk frame is the mark's own geometry: the logo is 2.27 : 0.98 in world
// units, so a face-on disk foreshortened by OUT_SQUASH = 0.44 IS the logo's
// bounding ellipse, and the jets fire along the short axis — vertically.

const float OUT_TILT = 0.15;
const float OUT_SQUASH = 0.44;
const float OUT_SPIN_SENSE = 1.0;
const float OUT_TURNS_MIN = 0.18;
const float OUT_TURNS_MAX = 0.40;
const float OUT_DIFFERENTIAL = 2.00;
const float OUT_R1_INNER = 0.40;
const float OUT_R1_OUTER = 1.90;
const float OUT_CLOUD_PUFF = 1.18;
const float OUT_R0_MAX = 4.20;
const float OUT_CAPTURE = 0.26;
const float OUT_LEAD_CAP = 0.24;

const float OUT_JET_SHARE = 0.46;
const float OUT_JET_T0 = 0.04;
const float OUT_JET_T1 = 0.40;
const float OUT_JET_TOF0 = 0.34;
const float OUT_JET_TOF1 = 0.54;
const float OUT_JET_REACH = 1.10;
const float OUT_JET_FLARE = 0.18;
const float OUT_JET_PINCH = 0.16;
const float OUT_JET_SWIRL = 0.45;
const float OUT_JET_GLOW = 1.15;

const float OUT_TURB = 0.115;
const float OUT_TURB_RATE = 1.85;
const float OUT_CLUMP_COUNT = 9.0;
const float OUT_SUPER_COUNT = 3.0;
const float OUT_CLUMP_PULL = 0.66;
const float OUT_CLUMP_WINDOW = 0.86;
const float OUT_MERGE_T0 = 0.30;
const float OUT_MERGE_T1 = 0.75;

const float OUT_IGNITE = 2.35;
const float OUT_SWEEP = 0.30;
const float OUT_SWEEP_BEAM = 0.42;
const float OUT_SWEEP_SCALE = 0.85;

vec2 outflowPolarAxis() { return vec2(sin(OUT_TILT), cos(OUT_TILT)); }
vec2 outflowPlaneAxis() { vec2 p = outflowPolarAxis(); return vec2(p.y, -p.x); }

// The two are an orthonormal basis, so outflowFromDisk(outflowToDisk(w)) == w
// exactly. That identity is what guarantees the landing.
vec2 outflowToDisk(vec2 world) {
  return vec2(
    dot(world, outflowPlaneAxis()),
    dot(world, outflowPolarAxis()) / OUT_SQUASH
  );
}

vec2 outflowFromDisk(vec2 disk) {
  return outflowPlaneAxis() * disk.x + outflowPolarAxis() * (disk.y * OUT_SQUASH);
}

// Both are monotone on [0,1] with f(0) = 0, f(1) = 1 and ZERO slope at both
// ends. Deliberately mismatched peaks: the radius plunges (rate peaks at
// t = 2/3) AHEAD of the wind-down (rate peaks at t = 3/4), so a comet does most
// of its turning after it has already fallen in.
float outflowCollapse(float t) { return t * t * t * (4.0 - 3.0 * t); }
float outflowSpin(float t) { return t * t * t * t * (5.0 - 4.0 * t); }

// 6.75 s (1-s)^2 : zero at s = 0 and s = 1, peak exactly 1.0 at s = 1/3, zero
// slope on the way back down. The slope at s = 0 is deliberately NON-zero — a
// jet launch is impulsive. That is a velocity kink, never a position jump.
float outflowBallistic(int index, float tau) {
  float fi = float(index);
  float gate = step(hash11(fi * 7.19 + 2.27), OUT_JET_SHARE);
  float launch = mix(OUT_JET_T0, OUT_JET_T1, hash11(fi * 13.77 + 6.11));
  float tof = mix(OUT_JET_TOF0, OUT_JET_TOF1, hash11(fi * 17.53 + 8.29));
  float s = clamp((tau - launch) / tof, 0.0, 1.0);
  return 6.75 * s * (1.0 - s) * (1.0 - s) * gate;
}

// A clump's own orbit — it inspirals and shears with the same eases, so knots
// are visibly part of the same flow.
vec2 outflowClumpCentre(float seed, float t, float spread) {
  float a = hash11(seed * 4.71 + 0.93) * TAU;
  float rc = mix(0.55, 1.70, hash11(seed * 8.13 + 3.17)) * spread;
  float rr = mix(rc, rc * 0.34, outflowCollapse(t));
  float pa = a - OUT_SPIN_SENSE * (0.9 + 1.1 / max(rc, 0.35)) * outflowSpin(t);
  return outflowFromDisk(vec2(rr * cos(pa), rr * sin(pa)));
}

vec2 outflowHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float tau = localFormation(id, formation);
  if (tau <= 0.0) return freeHead;

  // Frozen departure sample. Every uniform it reads is constant for the whole
  // formation, so departHead / r0 / phi0 / wind are per-particle CONSTANTS
  // shared by every trail sample. After this the live field is never read
  // again — fieldPoint wraps depth with mod(), which is a teleport.
  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float fi = float(index);
  vec2 slot = LOGO_POINTS[index] * uLogoScale;

  vec2 slotDisk = outflowToDisk(slot);
  float r1 = max(length(slotDisk), 0.02);
  float phi1 = atan(slotDisk.y, slotDisk.x + 1.0e-6);

  vec2 cloudDisk = outflowToDisk(departHead);
  float r0 = clamp(length(cloudDisk) * OUT_CLOUD_PUFF, r1 * 1.15, OUT_R0_MAX);
  float phi0 = atan(cloudDisk.y, cloudDisk.x + 1.0e-6);

  // Whole turns still owed, scaled by the slot's OWN disk radius so inner
  // material sweeps far more than outer: differential rotation, i.e. shear.
  float turns = mix(OUT_TURNS_MIN, OUT_TURNS_MAX, hash11(fi * 5.77 + 1.83))
    * mix(1.0, OUT_DIFFERENTIAL, 1.0 - smoothstep(OUT_R1_INNER, OUT_R1_OUTER, r1));

  // Wrap into ONE hemisphere of sense rather than to the shortest angle: a disk
  // rotates one way, so every comet must unwind with the same sign. delta is
  // built from two per-particle constants, so the floor() can never straddle a
  // boundary between two trail samples.
  float delta = phi0 - phi1;
  delta = delta - TAU * floor(delta / TAU);
  delta = OUT_SPIN_SENSE > 0.0 ? delta : delta - TAU;
  float wind = delta + OUT_SPIN_SENSE * turns * TAU;

  float cE = outflowCollapse(tau);
  float sE = outflowSpin(tau);
  float ball = outflowBallistic(index, tau);

  float jetSign = hash11(fi * 11.31 + 4.63) < 0.5 ? -1.0 : 1.0;
  float reach = OUT_JET_REACH
    * mix(0.55, 1.0, hash11(fi * 19.61 + 10.7))
    * clamp(uFormationParamA, 0.0, 2.0);

  // Disk position. A launched comet is pulled to the launch radius WHILE it is
  // out, so the jet leaves the core rather than wherever the comet happened to
  // be; it returns to whatever the disk has become by the time it falls back.
  float rr = mix(r0, r1, cE) * mix(1.0, OUT_JET_PINCH, ball);
  float phi = phi1 + wind * (1.0 - sE) + OUT_SPIN_SENSE * OUT_JET_SWIRL * TAU * ball;
  vec2 pose = outflowFromDisk(vec2(rr * cos(phi), rr * sin(phi)));

  // Hierarchical clumping. Nine knots gather, the knots THEMSELVES migrate into
  // three super-knots, then the disk takes over. 16u^2(1-u)^2 is zero in value
  // and slope at both ends of the window. Gated by (1 - ball) so a comet in the
  // jet is not fighting an attractor.
  float cSeed = floor(hash11(fi * 29.31 + 14.3) * OUT_CLUMP_COUNT) + 1.0;
  float sSeed = floor(hash11(cSeed * 6.53 + 2.90) * OUT_SUPER_COUNT) + 41.0;
  float u = clamp(tau / OUT_CLUMP_WINDOW, 0.0, 1.0);
  float clumpPull = OUT_CLUMP_PULL * clamp(uFormationParamB, 0.0, 2.0)
    * 16.0 * u * u * (1.0 - u) * (1.0 - u);
  vec2 knot = mix(
    outflowClumpCentre(cSeed, tau, 1.0),
    outflowClumpCentre(sSeed, tau, 0.72),
    smoothstep(OUT_MERGE_T0, OUT_MERGE_T1, tau)
  );
  pose = mix(pose, knot, clamp(clumpPull, 0.0, 0.9) * (1.0 - ball));

  // Polar excursion, plus the beam's slow opening with height.
  pose += outflowPolarAxis() * (jetSign * reach * ball)
    + outflowPlaneAxis() * (reach * OUT_JET_FLARE * ball * ball
      * (2.0 * hash11(fi * 23.17 + 12.9) - 1.0));

  // Turbulence, damped as the density it sits in rises. pow(0.0, 1.7) == 0, so
  // this is exactly zero at tau == 1.
  float turb = OUT_TURB * pow(1.0 - cE, 1.7)
    * mix(0.6, 1.4, hash11(fi * 31.7 + 16.1))
    * clamp(uFormationParamB, 0.0, 2.0);
  pose += vec2(
    sin(time * OUT_TURB_RATE + fi * 2.39)
      + 0.55 * sin(time * OUT_TURB_RATE * 1.73 + fi * 5.11),
    cos(time * OUT_TURB_RATE * 0.87 + fi * 3.77)
      + 0.55 * cos(time * OUT_TURB_RATE * 1.31 + fi * 7.53)
  ) * turb;

  // Capture. smoothstep gives w(0) == 0 AND w'(0) == 0, so at tau == 0 this
  // returns the frozen departure ray with exactly departVelocity. 'lead' is a
  // straight ray from a frozen sample that saturates at OUT_LEAD_CAP, never the
  // recycling field path.
  float w = smoothstep(0.0, OUT_CAPTURE, tau);
  float departSpeed = length(departVelocity);
  float elapsed = tau * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * OUT_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / OUT_LEAD_CAP));

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx, w) * mix(1.0, 0.70, ball);

  return mix(lead, pose, w)
    + livingLogoOffset(index, id, time) * smoothstep(0.55, 1.0, tau);
}

// --- 7 · ignition ----------------------------------------------------------
// A cold cloud contracts almost invisibly for most of the run, then crosses a
// threshold and ignites: the mark precipitates out of the cloud in one bloom.
// Terminal values are EXACT: at g == 1 structure == 1, dilation == 1,
// unwind == 1, merge == 1 and every disorder amplitude is identically 0.

const float IGN_CAPTURE = 0.26;
const float IGN_LEAD_CAP = 0.22;
const float IGN_INFALL_SWIRL = 1.15;
const float IGN_CLUMPS = 9.0;
const float IGN_CLUMP_REACH = 1.02;
const float IGN_KNOT = 0.19;
const float IGN_DILATE = 1.85;
const float IGN_WIND = 2.30;
const float IGN_ORBIT = 1.35;
const float IGN_TURB = 0.090;
const float IGN_TURB_RATE = 2.60;
const float IGN_STRUCT_LEAK = 0.14;
const float IGN_COLD_DIM = 0.30;
const float IGN_COLD_SIZE = 0.55;
const float IGN_SWELL = 0.7;
const float IGN_FLASH = 0.6;
const float IGN_SHOCK = 0.30;
const float IGN_SQUEEZE = 0.085;

float ignThreshold() { return clamp(uFormationParamA, 0.35, 0.92); }
float ignChaos() { return clamp(uFormationParamB, 0.0, 2.0); }

// Ignition clock. Exactly 0 for the whole quiet phase, 0 -> 1 across the
// threshold. Uniform across every particle: ignition is ONE event, not 128.
float ignClock(float g) {
  float h = ignThreshold();
  return clamp((clamp(g, 0.0, 1.0) - h) / max(1.0 - h, 0.06), 0.0, 1.0);
}

// Quintic smootherstep. f(0)=0, f(1)=1, f'=f''=0 at both ends.
float ignEmerge(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Damped second-order settle with ONE visible overshoot (~5%). The (1-t)^2
// factor makes it exactly 0 at t == 0 and exactly 1 at t == 1, both with zero
// slope. c is chosen so f'(0) == 0: the collapse starts from rest.
float ignSettle(float t) {
  float a = 6.0;
  float w = 9.0;
  float c = (2.0 + a) / w;
  float d = 1.0 - t;
  return 1.0 - d * d * exp(-a * t) * (cos(w * t) + c * sin(w * t));
}

// Flash spike: 0 at t == 0 with a steep rise, peak exactly 1.0 at t == 1/3,
// double root at t == 1 so it cannot pop at the end of the formation.
float ignFlare(float t) {
  float d = 1.0 - t;
  return 6.75 * t * d * d;
}

// How much of the mark's structure has precipitated. ~0.01 at g == 0.3 — this
// single number is what makes a particle's destination unknowable.
float ignStructure(float g) {
  float e = ignEmerge(ignClock(g));
  return clamp(IGN_STRUCT_LEAK * g * g * (1.0 - e) + e, 0.0, 1.0);
}

// Overall contraction. Creeps 24% of the way over the quiet phase, then the
// collapse finishes it, compressing ~4% past the mark and ringing back.
float ignDilate(float g) {
  float s = ignSettle(ignClock(g));
  return mix(IGN_DILATE, 1.0, 0.24 * g * g * (1.0 - s) + s);
}

// Hierarchical merge: clumps spiral into the core.
float ignMerge(float g) {
  float e = ignEmerge(ignClock(g));
  return clamp(0.55 * smoothstep(0.10, ignThreshold(), g) * (1.0 - e) + e, 0.0, 1.0);
}

// Fraction of the differential wind-up that has unwound. Deliberately unclamped
// above 1 so the rotation slightly overshoots and returns with the settle.
float ignUnwind(float g) {
  float s = ignSettle(ignClock(g));
  return 0.76 * g * g * (1.0 - s) + s;
}

// Radians of wind-up this particle carries at g == 0. Inner material has swept
// far more than outer — differential rotation. Seeded from float(index).
float ignWind(int index, float slotRadius) {
  return IGN_WIND / (0.30 + slotRadius)
    * mix(0.82, 1.22, hash11(float(index) * 9.17 + 2.31));
}

// Particle radius multiplier: small and cold, then a hard swell at ignition.
float ignSize(float g) {
  float t = ignClock(g);
  return mix(IGN_COLD_SIZE, 1.0, t * t) + IGN_SWELL * ignFlare(t);
}

// Clump membership: a hash of 'index' alone. Deliberately UNCORRELATED with the
// slot, so a knot is a random subset of the mark and no fragment of the logo is
// ever legible. A particle can never change clump mid-trail.
float ignClumpOf(int index) {
  return min(floor(hash11(float(index) * 17.31 + 5.13) * IGN_CLUMPS), IGN_CLUMPS - 1.0);
}

// Clump core: an inward spiral whose sweep steepens as the orbit tightens.
// Exactly vec2(0.0) at g == 1.
vec2 ignClumpOffset(float c, float g) {
  float reach = mix(0.58, 1.0, hash11(c * 7.77 + 1.90)) * IGN_CLUMP_REACH * ignChaos();
  float phase = hash11(c * 3.13 + 11.70) * TAU;
  float rate = mix(0.72, 1.28, hash11(c * 5.51 + 23.30));
  float m = ignMerge(g);
  float ang = phase + IGN_ORBIT * rate * (g + 1.70 * m * m);
  return vec2(cos(ang), sin(ang)) * reach * (1.0 - m);
}

// Where the particle sits inside its own knot.
vec2 ignKnotOffset(int index, float c, float g) {
  float rr = sqrt(hash11(float(index) * 6.71 + 3.29));
  float m = ignMerge(g);
  float ang = hash11(float(index) * 4.13 + 0.77) * TAU
    + hash11(c * 2.19 + 7.70) * TAU
    + (0.90 + 0.50 * rr) * IGN_ORBIT * (g + 1.70 * m * m);
  return vec2(cos(ang), sin(ang))
    * rr * IGN_KNOT * ignChaos() * (1.0 - ignStructure(g)) * mix(1.0, 0.45, m);
}

// Turbulence that DAMPS as density rises: amplitude is (1 - structure)^2, so it
// churns freely in the cold cloud and is identically zero once ignited.
vec2 ignTurbulence(int index, float g, float time) {
  float damp = 1.0 - ignStructure(g);
  damp *= damp;
  float p1 = time * IGN_TURB_RATE + hash11(float(index) * 3.71 + 0.19) * TAU;
  float p2 = time * IGN_TURB_RATE * 1.63 + hash11(float(index) * 8.53 + 4.41) * TAU;
  float p3 = time * IGN_TURB_RATE * 0.71 + hash11(float(index) * 5.29 + 9.13) * TAU;
  return vec2(
    sin(p1) + 0.55 * sin(p2) + 0.30 * sin(p3),
    cos(p1 * 1.19) + 0.55 * cos(p2 * 0.83) + 0.30 * cos(p3 * 1.41)
  ) * IGN_TURB * ignChaos() * damp;
}

// The cloud. frame == the mark, wound up by differential rotation, dilated, and
// scaled by how much structure has precipitated (near zero for most of the run,
// which is why the mark is invisible).
vec2 ignCloudPoint(int index, float g, float time) {
  vec2 slot = LOGO_POINTS[index] * uLogoScale;
  float slotRadius = length(slot);
  float slotAngle = slotRadius > 0.00001 ? atan(slot.y, slot.x) : 0.0;

  float theta = slotAngle - ignWind(index, slotRadius) * (1.0 - ignUnwind(g));
  vec2 frame = vec2(cos(theta), sin(theta))
    * (slotRadius * ignDilate(g) * ignStructure(g));

  float c = ignClumpOf(index);
  return frame
    + ignClumpOffset(c, g)
    + ignKnotOffset(index, c, g)
    + ignTurbulence(index, g, time);
}

// Per-particle progress for radius, trail length and surface gating. Pinned
// near 0.22 through the quiet phase so the cold cloud keeps field-length trails,
// then rises to exactly 1 at g == 1.
float ignitionProgress(float id, float formation) {
  return clamp(
    localFormation(id, formation) * mix(0.22, 1.0, ignEmerge(ignClock(formation))),
    0.0,
    1.0
  );
}

vec2 ignitionHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  // Capture. 'lead' is a saturating ray from the FROZEN departure sample, never
  // the recycling field path, so this can never hit fieldPoint's mod() depth
  // wrap. smoothstep gives w(0) == 0 AND w'(0) == 0, so at local == 0 this
  // returns departHead travelling at departVelocity.
  float w = smoothstep(0.0, IGN_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * IGN_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / IGN_LEAD_CAP));

  float g = clamp(formation, 0.0, 1.0);
  vec2 cloud = ignCloudPoint(index, g, time);

  // Spiral the infall: rotate the remaining chord about the moving knot so
  // matter arrives tangentially instead of dropping straight in. phi has a
  // double root at w == 0, so the handoff above is untouched; at w == 1 the
  // chord is identically zero so the rotation cannot perturb the landing.
  vec2 chord = mix(lead, cloud, w) - cloud;
  float phi = IGN_INFALL_SWIRL * w * w;
  float cs = cos(phi);
  float sn = sin(phi);
  vec2 head = cloud + vec2(chord.x * cs - chord.y * sn, chord.x * sn + chord.y * cs);

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * ignSize(g), w);

  return head + livingLogoOffset(index, id, time) * ignStructure(g) * w;
}

// --- 8 · collapse ----------------------------------------------------------
// Pressure-free gravitational collapse with a core bounce. The infall is
// deliberately SLOT-INDEPENDENT: for g <= COL_BOUNCE - COL_CORE_SPAN every term
// that reads LOGO_POINTS is identically zero and the whole formation reduces to
//     head = core + collapseFall(g) * (departHead - core)
// a single global homothety about the core. That is the unpredictability proof:
// the function has not touched the destination yet.
//
// A bounce is the one case where a VELOCITY discontinuity is physically correct.
// abs(cos) supplies it: max slope exactly at the zero, sign flip on the way
// through. Position stays C0 everywhere, which is all the trail requires.
//
// The bounce sits at 0.35 of the timeline, not the midpoint: the two halves
// rescale independently through COL_OUT_SPAN, so a 0.9s formation spends 315 ms
// falling and 585 ms blasting back out and settling.

const float COL_BOUNCE       = 0.35;
const float COL_OUT_SPAN     = 0.46;
const float COL_CORE_R       = 0.042;
const float COL_CORE_SPAN    = 0.20;
const float COL_HOMOLOGY_T1  = 0.82;
const float COL_R0_MIN       = 0.30;
const float COL_R0_MAX       = 1.35;
const float COL_CAPTURE      = 0.26;
const float COL_LEAD_CAP     = 0.22;
const float COL_WHIP_W       = 0.075;
const float COL_SHOCK        = 0.40;
const float COL_SHOCK_TOF    = 0.65;   // == 1 - COL_BOUNCE, so the shock is EXACTLY 0 at g == 1
const float COL_LOBE         = 0.60;
const float COL_BLAST_SKEW   = 0.72;
const float COL_RECOIL       = 0.13;
const float COL_TURB         = 0.055;
const float COL_TURB_RATE    = 2.35;
const float COL_CORE_PULL    = 0.30;
const float COL_CORE_MAX     = 0.40;
const float COL_PROGRESS_T0  = 0.58;
const float COL_COLD_DIM     = 0.30;
const float COL_COLD_SIZE    = 0.50;
const float COL_FLASH        = 2.80;
const float COL_SWELL        = 1.85;
const float COL_FLASH_RISE   = 0.055;
const float COL_FLASH_FALL   = 0.130;
const float COL_FIELD_PULL   = 0.10;
const float COL_FIELD_SHOCK  = 0.22;
const float COL_RING_WIDTH   = 0.45;
const float COL_RING_REACH   = 2.90;

float collapseBlast() { return clamp(uFormationParamA, 0.0, 2.0); }
float collapseChaos() { return clamp(uFormationParamB, 0.0, 2.0); }

// Quintic smootherstep, clamped. f(0)=0, f(1)=1, f'=f''=0 at both ends.
float collapseSmoother(float t) {
  float x = clamp(t, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// The collapse centre. uFormationOrigin is latched once per formation, so this
// is a constant every trail sample of every particle agrees on. Off-centre is
// what makes the blast lopsided: one wing is thrown far and the other barely
// moves, and it changes with the pointer so a re-hover is not a replay.
vec2 collapseCore() {
  vec2 originWorld = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  vec2 pulled = originWorld * COL_CORE_PULL;
  float reach = length(pulled);
  return reach > COL_CORE_MAX ? pulled * (COL_CORE_MAX / reach) : pulled;
}

float collapseBlastAngle() {
  vec2 c = collapseCore();
  return atan(c.y, c.x + 1.0e-5) + COL_BLAST_SKEW;
}

// Bounce clock. 0 -> PI/2 across the infall, PI/2 -> PI across the rebound, then
// SATURATED so the settle arrives with zero radial velocity.
float collapseTheta(float g) {
  return 1.5707963 * (
    min(g, COL_BOUNCE) / COL_BOUNCE
    + min(max(g - COL_BOUNCE, 0.0) / COL_OUT_SPAN, 1.0)
  );
}

// Exactly 1.0 at g==0 AND at g==1, exactly 0.0 at the bounce, with its steepest
// slope precisely at the zero. cos^2 would be a soft landing; abs(cos) bounces.
float collapseFall(float g) { return abs(cos(collapseTheta(g))); }

// Finite core, compact support: identically 0 outside |g - COL_BOUNCE| >= SPAN.
float collapseCoreBump(float g) {
  return 1.0 - collapseSmoother(abs(g - COL_BOUNCE) / COL_CORE_SPAN);
}

// Homology transfer: the reference radius is the CLOUD's on the way in and the
// SLOT's on the way out. Exactly 0 up to the bounce, exactly 1 from 0.82.
float collapseHomology(float g) {
  return collapseSmoother((g - COL_BOUNCE) / (COL_HOMOLOGY_T1 - COL_BOUNCE));
}

// Angular shear, compact support inside the bounce window: nothing rotates
// before the core forms and nothing is still rotating once it is back out.
// Seeded from float(index) — hash11 degenerates at id-sized inputs.
float collapseShear(int index, float g) {
  float w = COL_WHIP_W * mix(0.90, 1.15, hash11(float(index) * 5.17 + 1.93));
  return collapseSmoother((g - (COL_BOUNCE - w)) / (2.0 * w));
}

// Shock impulse. 16 s^2 (1-s)^2: zero in value AND slope at both ends, peak
// exactly 1.0 at s == 0.5. COL_SHOCK_TOF is pinned to 1 - COL_BOUNCE so s hits
// exactly 1 at g == 1 — at 0.70 it only reached 0.93 and left the settled mark
// inflated by ~7% of the shock amplitude (measured: +21% lit area at rest).
float collapseShock(float g) {
  float s = clamp((g - COL_BOUNCE) / COL_SHOCK_TOF, 0.0, 1.0);
  return 16.0 * s * s * (1.0 - s) * (1.0 - s);
}

// Bulk recoil of the whole nascent mark. 6.75 s (1-s)^2 has a NON-zero slope at
// s == 0 — momentum transfer is impulsive — and a double root at s == 1.
float collapseKick(float g) {
  float s = clamp((g - (COL_BOUNCE - 0.04)) / (1.0 - (COL_BOUNCE - 0.04)), 0.0, 1.0);
  return 6.75 * s * (1.0 - s) * (1.0 - s);
}

// The flash. Fast Gaussian rise, slower Gaussian fall — shock breakout, not a
// symmetric pulse. Both halves have zero slope at s == 0 so the width switch is
// C1. Forced to exactly 0.0 by g == 1.
float collapseFlash(float g) {
  float s = clamp(g, 0.0, 1.0) - COL_BOUNCE;
  float k = s / (s < 0.0 ? COL_FLASH_RISE : COL_FLASH_FALL);
  return exp(-k * k) * (1.0 - smoothstep(0.80, 1.00, g));
}

// Per-particle blast gain from the SLOT angle, so the asymmetry is spatially
// coherent in the settled frame. Constant per particle.
float collapseLobe(int index) {
  vec2 rel = LOGO_POINTS[index] * uLogoScale - collapseCore();
  float phi = atan(rel.y, rel.x + 1.0e-6);
  return 1.0 + COL_LOBE * collapseChaos() * cos(phi - collapseBlastAngle());
}

// Progress stays 0 through the whole violent phase so the trail stays FIELD
// length while the particle is fast, and main()'s radiusEase leaves the bounce
// flash radius untouched.
float collapseProgress(float id, float formation) {
  float local = localFormation(id, formation);
  return clamp((local - COL_PROGRESS_T0) / (1.0 - COL_PROGRESS_T0), 0.0, 1.0);
}

vec2 collapseHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float fi = float(index);
  vec2 core = collapseCore();
  vec2 slotRel = LOGO_POINTS[index] * uLogoScale - core;
  vec2 cloudRel = departHead - core;

  float r1 = max(length(slotRel), 0.02);
  float phi1 = atan(slotRel.y, slotRel.x + 1.0e-6);
  // Clamped against CONSTANTS, never against r1: a slot-proportional floor here
  // would leak the destination into the infall and break the homothety proof.
  float r0 = clamp(length(cloudRel), COL_R0_MIN, COL_R0_MAX);
  float phi0 = atan(cloudRel.y, cloudRel.x + 1.0e-6);

  // SHORTEST signed sweep, wrapped into [-PI, PI]. A pressure-free collapse has
  // no NET angular momentum — that is why it can fall to a point instead of
  // flattening into a disc — and it bounds tangential speed through the core.
  float delta = phi1 - phi0;
  delta -= TAU * floor(delta / TAU + 0.5);

  float g = clamp(formation, 0.0, 1.0);
  float fall = collapseFall(g);
  float bump = collapseCoreBump(g);
  float homology = collapseHomology(g);
  float shear = collapseShear(index, g);

  float coreRadius = COL_CORE_R * mix(0.55, 1.0, hash11(fi * 9.43 + 3.71));
  float radius = mix(r0, r1, homology) * fall
    + coreRadius * bump
    + COL_SHOCK * collapseBlast() * collapseLobe(index)
      * mix(0.80, 1.22, hash11(fi * 15.19 + 6.53))
      * collapseShock(g);

  float phi = phi1 - delta * (1.0 - shear);
  vec2 pose = core + vec2(cos(phi), sin(phi)) * radius;

  // Momentum conservation: a lopsided blast throws the remnant the other way.
  float blast = collapseBlastAngle();
  pose -= vec2(cos(blast), sin(blast))
    * (COL_RECOIL * collapseBlast() * collapseKick(g));

  float churn = COL_TURB * collapseChaos() * (1.0 - homology) * fall;
  pose += vec2(
    sin(time * COL_TURB_RATE + fi * 2.17)
      + 0.55 * sin(time * COL_TURB_RATE * 1.71 + fi * 4.93),
    cos(time * COL_TURB_RATE * 0.83 + fi * 3.41)
      + 0.55 * cos(time * COL_TURB_RATE * 1.37 + fi * 7.11)
  ) * churn;

  // Capture. w(0) == 0 AND w'(0) == 0, so at local == 0 this returns departHead
  // travelling at departVelocity. 'lead' is a saturating ray off the FROZEN
  // sample, never the recycling field path.
  float w = smoothstep(0.0, COL_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * COL_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / COL_LEAD_CAP));

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float sizeMul =
    mix(COL_COLD_SIZE, 1.0, smoothstep(COL_BOUNCE - 0.05, COL_BOUNCE + 0.30, g))
    + COL_SWELL * collapseFlash(g);
  radiusPx = mix(departRadiusPx, logoRadiusPx * sizeMul, w);

  return mix(lead, pose, w)
    + livingLogoOffset(index, id, time) * smoothstep(0.62, 1.0, g);
}

// --- 9 · nova --------------------------------------------------------------
// A thermonuclear runaway at the pointer. One thin shell of light rips outward
// across the whole field; every comet it crosses is flash-heated, entrained into
// the post-shock layer and broken into Rayleigh-Taylor knots. The shell runs on
// and leaves the layer to cool, and cooling gas condenses onto the densest
// filaments. Those filaments ARE the mark. Nothing is ever aimed at a slot.
//
// The whole pose is polar about the detonation point, expressed as a ROTATION of
// (slot - origin). At k == 1 every additive angle term is identically 0.0 and
// every mix weight is identically 1.0, so the settled frame is bit-exact.

const float NOVA_CLEAR       = 0.35;
const float NOVA_SEDOV       = 0.85;
const float NOVA_ARRIVE_MAX  = 0.45;
const float NOVA_LAYER       = 0.20;
const float NOVA_LEAD_CAP    = 0.20;
const float NOVA_CAPTURE     = 0.10;

const float NOVA_KNOTS       = 11.0;
const float NOVA_KNOT_JITTER = 0.30;
const float NOVA_SPRAY       = 0.17;
const float NOVA_TURB        = 0.075;
const float NOVA_TURB_RATE   = 3.10;

const float NOVA_SPALL_SHARE = 0.30;
const float NOVA_SPALL       = 0.85;
const float NOVA_SPALL_SWIRL = 0.40;

const float NOVA_FLASH       = 3.40;
const float NOVA_SWELL       = 1.90;
const float NOVA_COLD        = 0.30;
const float NOVA_COLD_SIZE   = 0.55;
const float NOVA_SWEEP       = 0.20;
const float NOVA_SWEEP_W     = 0.48;

float novaRam()  { return clamp(uFormationParamA, 0.0, 2.0); }
float novaFrag() { return clamp(uFormationParamB, 0.0, 2.0); }

// Same conversion formationOrder already uses, so the detonation lands under the
// cursor in the engine's own convention.
vec2 novaOrigin() {
  return (2.0 * uFormationOrigin - uResolution) / uResolution.y;
}

// How far the front must run to clear the mark FROM THIS FORMATION'S ORIGIN.
// Uniform-derived, so it is identical for every particle and every trail sample,
// and it auto-scales the blast to an off-centre pointer.
float novaSpan() {
  vec2 o = novaOrigin();
  return max(
    length(vec2(abs(o.x) + 1.12 * uLogoScale, abs(o.y) + 0.50 * uLogoScale)),
    0.90
  );
}

float novaShellRadius(float g) {
  return novaSpan() * pow(clamp(g, 0.0, 1.0) / NOVA_CLEAR, NOVA_SEDOV);
}

// Exact inverse of novaShellRadius.
float novaArrivalAt(float d) {
  return clamp(
    NOVA_CLEAR * pow(max(d, 0.0) / novaSpan(), 1.0 / NOVA_SEDOV),
    0.0,
    NOVA_ARRIVE_MAX
  );
}

// Per-particle CONSTANT: departHead is frozen for the whole formation.
float novaArrive(int index, float id) {
  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);
  return novaArrivalAt(distance(departHead, novaOrigin()));
}

// Post-shock clock. Exactly 0 before the front arrives, exactly 1 at g == 1.
float novaShock(float arrive, float formation) {
  return clamp(
    (clamp(formation, 0.0, 1.0) - arrive) / max(1.0 - arrive, 0.30),
    0.0,
    1.0
  );
}

float novaEntrain(float k) {
  float t = clamp(k / 0.30, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Condensation onto the filaments. Identically 0 until k == 0.32 — this single
// number is what makes a comet's destination unknowable. The spec asked for
// 0.44; measured against a 0.9 s run that left a structureless 0.45-0.85 stretch
// where the swept-up gas is spread thin on the layer and the mark has not begun,
// so it is pulled in.
float novaCondense(float k) {
  float t = clamp((k - 0.32) / 0.68, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float novaUnwind(float k) {
  float t = clamp(k, 0.0, 1.0);
  return t * t * t * (4.0 - 3.0 * t);
}

// The light front. 33.97 k (1-k)^12 — peak exactly 1.0 at k = 1/13, exactly 0 at
// both ends, under 0.1 by k = 0.30. Thin on purpose.
float novaFront(float k) {
  float t = clamp(k, 0.0, 1.0);
  float d = 1.0 - t;
  float d2 = d * d;
  float d4 = d2 * d2;
  return 33.97 * t * d4 * d4 * d4;
}

// Rayleigh-Taylor fragmentation envelope, peak exactly 1.0 at k = 1/3.
float novaFragEnv(float k) {
  float t = clamp(k, 0.0, 1.0);
  float d = 1.0 - t;
  float d2 = d * d;
  return 45.563 * t * t * d2 * d2;
}

// High-velocity filaments. 6.75 s(1-s)^2 with a deliberately NON-zero slope at
// s = 0 — a spall is impulsive. That is a velocity kink, never a position jump.
float novaSpall(int index, float k) {
  float fi = float(index);
  float gate = step(hash11(fi * 9.31 + 3.77), NOVA_SPALL_SHARE);
  float launch = mix(0.0, 0.20, hash11(fi * 15.13 + 7.19));
  float tof = mix(0.30, 0.52, hash11(fi * 21.77 + 11.30));
  float s = clamp((k - launch) / tof, 0.0, 1.0);
  return 6.75 * s * (1.0 - s) * (1.0 - s) * gate;
}

// Knot membership is a floor of the comet's own FROZEN bearing, so it is a
// per-particle constant. It is a many-to-one map, which is what destroys the
// mark's angular structure, and it is uncorrelated with the slot.
float novaKnotIndex(float phi) {
  float c = floor(phi / TAU * NOVA_KNOTS + 0.5);
  return c - NOVA_KNOTS * floor(c / NOVA_KNOTS);
}

float novaKnotBearing(float c) {
  return (c + mix(-NOVA_KNOT_JITTER, NOVA_KNOT_JITTER, hash11(c * 5.31 + 2.70)))
    * TAU / NOVA_KNOTS;
}

float novaWrapPi(float a) {
  return a - TAU * floor(a / TAU + 0.5);
}

vec2 novaHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 drift = departVelocity / max(departSpeed, 0.00001)
    * NOVA_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / NOVA_LEAD_CAP));

  vec2 origin = novaOrigin();
  vec2 slotRel = LOGO_POINTS[index] * uLogoScale - origin;
  vec2 departRel = departHead - origin;
  float rho1 = max(length(slotRel), 0.06);
  float rho0 = max(length(departRel), 0.03);
  float phi1 = atan(slotRel.y, slotRel.x + 1.0e-9);
  float phi0 = atan(departRel.y, departRel.x + 1.0e-9);

  float arrive = novaArrivalAt(rho0);
  float k = novaShock(arrive, formation);
  float entrain = novaEntrain(k);
  float condense = novaCondense(k);
  float frag = novaFragEnv(k);
  float spall = novaSpall(index, k);
  float fi = float(index);

  // The layer radius is the shell radius frozen a fixed lag behind THIS comet's
  // own shock, so the comet is thrown onto the layer instead of chasing an
  // accelerating front — that keeps peak speed near the trail cap.
  float layer = novaShellRadius(min(arrive + NOVA_LAYER, 1.0));
  float rho = mix(mix(rho0, layer, entrain), rho1, condense)
    + NOVA_SPALL * novaRam() * mix(0.62, 1.35, hash11(fi * 3.19 + 0.41)) * spall
    + NOVA_SPRAY * novaFrag() * frag * (2.0 * hash11(fi * 6.71 + 3.29) - 1.0);

  float psi = novaKnotBearing(novaKnotIndex(phi0));
  float theta = (phi0 - phi1) * (1.0 - novaUnwind(k))
    + novaWrapPi(psi - phi0) * frag
    + (hash11(fi * 11.17 + 5.83) < 0.5 ? -1.0 : 1.0) * NOVA_SPALL_SWIRL * spall
    + (2.0 * hash11(fi * 4.13 + 0.77) - 1.0) * (NOVA_SPRAY / rho1) * novaFrag() * frag;

  // At k == 1 theta is IDENTICALLY 0.0 and rho is IDENTICALLY rho1, so this
  // returns origin + slotRel — bit-exact. At k == 0 the rotation rebuilds
  // departRel and this returns departHead + drift.
  float cs = cos(theta);
  float sn = sin(theta);
  vec2 posed = origin
    + vec2(slotRel.x * cs - slotRel.y * sn, slotRel.x * sn + slotRel.y * cs)
      * (rho / rho1)
    + drift * (1.0 - entrain);

  float churn = 16.0 * k * k * (1.0 - k) * (1.0 - k) * NOVA_TURB * novaFrag();
  float p1 = time * NOVA_TURB_RATE + hash11(fi * 3.71 + 0.19) * TAU;
  float p2 = time * NOVA_TURB_RATE * 1.63 + hash11(fi * 8.53 + 4.41) * TAU;
  posed += vec2(
    sin(p1) + 0.55 * sin(p2),
    cos(p1 * 1.19) + 0.55 * cos(p2 * 0.83)
  ) * churn;

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float size = mix(NOVA_COLD_SIZE, 1.0, smoothstep(0.0, 0.55, k))
    + NOVA_SWELL * novaFront(k);
  float grip = smoothstep(0.0, 0.10, k) * smoothstep(0.0, NOVA_CAPTURE, local);
  radiusPx = mix(departRadiusPx, logoRadiusPx * size, grip);

  return posed + livingLogoOffset(index, id, time) * condense;
}

float novaProgress(int index, float id, float formation) {
  float k = novaShock(novaArrive(index, id), formation);
  return clamp(
    localFormation(id, formation) * mix(0.22, 1.0, smoothstep(0.0, 0.55, k)),
    0.0,
    1.0
  );
}

// --- 10 · flare ------------------------------------------------------------
// Magnetic reconnection. Captured comets are drawn into a thin current sheet and
// SHEARED along it — anti-parallel, no net progress, dimming as the FIELD stores
// the energy. At g == FLR_SNAP the sheet tears: every comet is handed to a
// freshly-closed field line and slung to a footpoint, a hashed share is ejected
// as a failed plasmoid, and the frame flashes in ONE frame.
//
// The mark is the POST-FLARE ARCADE. Before the tear a comet is on an OPEN field
// line with no footpoint at all — the destination is CREATED by the topology
// change, which is why nothing about the pre-snap motion predicts it.
//
// Continuity: the two branches are separate closed forms that AGREE EXACTLY at
// the tear by construction of ctrl0. Position is C0 there; the discontinuity is
// in velocity only, which is what a reconnection is.

const float FLR_TILT       = 0.13;
const float FLR_SHEET_Y    = 0.60;
const float FLR_NEUTRAL_Y  = -0.04;
const float FLR_CAPTURE    = 0.16;
const float FLR_LEAD_CAP   = 0.20;
const float FLR_SNAP       = 0.35;
const float FLR_TEAR       = 0.045;
const float FLR_PINCH      = 0.62;
const float FLR_FUNNEL     = 0.70;
const float FLR_SHEAR      = 0.62;
const float FLR_ALFVEN     = 4.20;
const float FLR_ARC        = 1.45;
const float FLR_WHIP_MIN   = 0.12;
const float FLR_WHIP_MAX   = 0.88;
const float FLR_CREEP      = 0.16;
const float FLR_FOOT_SHEAR = 0.30;
const float FLR_PLASMOID   = 0.22;
const float FLR_PLASMOID_A = 0.45;
const float FLR_PLASMOID_T = 0.40;
const float FLR_TURB       = 0.075;
const float FLR_TURB_RATE  = 2.30;
const float FLR_DARK       = 0.55;
const float FLR_HARD       = 3.20;
const float FLR_HARD_TAU   = 0.035;
const float FLR_SOFT       = 1.50;
const float FLR_COLD_SIZE  = 0.52;
const float FLR_SWELL      = 1.10;

float flareReach()  { return clamp(uFormationParamA, 0.0, 2.0); }
float flareStress() { return clamp(uFormationParamB, 0.0, 2.0); }

vec2 flareUpAxis()    { return vec2(sin(FLR_TILT), cos(FLR_TILT)); }
vec2 flareAlongAxis() { vec2 a = flareUpAxis(); return vec2(a.y, -a.x); }

// Pointer-derived seed. uFormationOrigin is latched once per formation, so this
// is a uniform constant — but it differs on every hover, which is what stops the
// tear order and the sheet geometry from replaying identically.
float flareOriginSeed() {
  vec2 o = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  return fract(o.x * 0.3719 + o.y * 0.6131 + 0.1913);
}

// The sheet rides the pointer, so the whole pre-snap geometry moves with it.
float flareSheetY() {
  vec2 o = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  return FLR_SHEET_Y + clamp(o.y * 0.30, -0.22, 0.22);
}

// This comet's tear instant. Seeded from float(index) crossed with the pointer
// seed, and a per-particle CONSTANT, so the branch predicate below can never
// straddle differently for two trail samples of the same comet.
float flareSnap(int index) {
  return FLR_SNAP
    + FLR_TEAR * hash11(float(index) * 3.37 + 0.19 + flareOriginSeed() * 7.31);
}

float flareClock(float g, float snap) {
  return clamp((clamp(g, 0.0, 1.0) - snap) / max(1.0 - snap, 0.06), 0.0, 1.0);
}

// f'(1) = 0, so the inflow STALLS just before the tear — the stillness is what
// makes the snap read as an event.
float flareInflow(float g, float snap) {
  float t = clamp(g / max(snap, 0.05), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec2 flareSheetPath(
  int index, float time, float g, float snap,
  vec2 departHead, vec2 departVelocity, float local
) {
  vec2 up = flareUpAxis();
  vec2 along = flareAlongAxis();
  float fi = float(index);
  float sheetY = flareSheetY();

  float u0 = dot(departHead, up);
  float w0 = dot(departHead, along);
  float p = flareInflow(g, snap);

  // Signed, CONTINUOUS in u0: neighbouring comets shear proportionally, so this
  // reads as a velocity shear rather than two rigid slabs.
  float side = clamp((u0 - sheetY) / 0.30, -1.0, 1.0);

  float u = mix(u0, sheetY, FLR_PINCH * p);
  float w = w0 * (1.0 - FLR_FUNNEL * p)
    + side * FLR_SHEAR * flareStress() * p * p * (3.0 - 2.0 * p)
      * mix(0.72, 1.28, hash11(fi * 4.13 + 0.71));

  float damp = 1.0 - p;
  vec2 turb = vec2(
    sin(time * FLR_TURB_RATE + fi * 2.17)
      + 0.55 * sin(time * FLR_TURB_RATE * 1.71 + fi * 5.31),
    cos(time * FLR_TURB_RATE * 0.83 + fi * 3.59)
      + 0.55 * cos(time * FLR_TURB_RATE * 1.29 + fi * 7.13)
  ) * FLR_TURB * flareStress() * damp * damp;

  vec2 sheet = up * u + along * w + turb;

  float b = smoothstep(0.0, FLR_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * FLR_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / FLR_LEAD_CAP));

  return mix(lead, sheet, b);
}

// Conjugate footpoint: this comet's slot mirrored across the neutral line and
// offset along the mark by the shear angle. It is never landed on.
vec2 flareMate(int index, vec2 slot) {
  vec2 up = flareUpAxis();
  vec2 along = flareAlongAxis();
  float d = dot(slot, up) - FLR_NEUTRAL_Y;
  return slot - up * (2.0 * d)
    + along * FLR_FOOT_SHEAR * (2.0 * hash11(float(index) * 6.29 + 1.37) - 1.0);
}

// Quadratic Bezier. B(1) == slot for ANY control point — that is what makes the
// landing bit-exact with no corrective term anywhere in the path.
vec2 flareLoop(vec2 mate, vec2 ctrl, vec2 slot, float s) {
  float m = 1.0 - s;
  return m * m * mate + 2.0 * m * s * ctrl + s * s * slot;
}

// Every comet drains at the same Alfven speed, so a longer field line takes
// longer. This BOUNDS the peak speed against the trail cap.
float flareWhip(vec2 snapPos, vec2 slot, float snap) {
  float seconds = distance(snapPos, slot) * FLR_ARC / FLR_ALFVEN;
  return clamp(
    seconds / max((1.0 - snap) * uFormationDuration, 0.001),
    FLR_WHIP_MIN,
    FLR_WHIP_MAX
  );
}

float flareCreep(float k, float whip) {
  float t = clamp((k - whip) / max(1.0 - whip, 0.05), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// Slide along the loop. 0.5 at k == 0 (the entry point) and exactly 1.0 at k == 1.
float flareSlide(float k, float whip, float creep) {
  float fast = travelEase(clamp(k / max(whip, 0.02), 0.0, 1.0), 1.6, 0.0);
  return 0.5 + 0.5 * ((1.0 - FLR_CREEP) * fast + FLR_CREEP * creep);
}

// Failed eruption. Zero at s == 0 with a NON-zero launch slope, peak exactly 1.0
// at s == 1/3, double root at s == 1 so it cannot perturb the landing.
float flarePlasmoid(int index, float u0, float k) {
  float fi = float(index);
  float sheetY = flareSheetY();
  float gate = step(hash11(fi * 7.19 + 2.27), FLR_PLASMOID)
    * smoothstep(sheetY - 0.42, sheetY + 0.26, u0);
  float s = clamp(k / FLR_PLASMOID_T, 0.0, 1.0);
  return 6.75 * s * (1.0 - s) * (1.0 - s) * gate;
}

float flareSize(float g, float k, float snap) {
  float cold = mix(1.0, FLR_COLD_SIZE, smoothstep(0.06, snap * 0.92, g));
  return mix(cold, 1.0, k * k) + FLR_SWELL * 6.75 * k * (1.0 - k) * (1.0 - k);
}

float flareProgress(int index, float id, float formation) {
  float k = flareClock(clamp(formation, 0.0, 1.0), flareSnap(index));
  return clamp(localFormation(id, formation) * mix(0.20, 1.0, k * k), 0.0, 1.0);
}

vec2 flareHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float g = clamp(formation, 0.0, 1.0);
  float snap = flareSnap(index);
  float k = flareClock(g, snap);

  float b = smoothstep(0.0, FLR_CAPTURE, local);
  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * flareSize(g, k, snap), b);

  if (k <= 0.0) {
    return flareSheetPath(index, time, g, snap, departHead, departVelocity, local);
  }

  vec2 slot = LOGO_POINTS[index] * uLogoScale;
  vec2 mate = flareMate(index, slot);

  // historicalFormation is the linear map g = (time - start) / duration, so
  // snapTime is the exact instant at which k crosses 0 and the branch predicate
  // above flips. Every argument here is a per-particle CONSTANT.
  float snapTime = uFormationStartFieldTime + snap * uFormationDuration;
  vec2 snapPos = flareSheetPath(
    index, snapTime, snap, snap,
    departHead, departVelocity, localFormation(id, snap)
  );

  // THE IDENTITY. B(0.5, ctrl0) == snapPos exactly, for any mate and slot, so
  // the loop passes THROUGH the comet at the instant it is handed over.
  vec2 ctrl0 = 2.0 * snapPos - 0.5 * (mate + slot);
  float whip = flareWhip(snapPos, slot, snap);
  float creep = flareCreep(k, whip);
  vec2 ctrl = mix(ctrl0, 0.5 * (mate + slot), creep);
  vec2 pose = flareLoop(mate, ctrl, slot, flareSlide(k, whip, creep));

  vec2 up = flareUpAxis();
  vec2 along = flareAlongAxis();
  float fi = float(index);
  float ball = flarePlasmoid(index, dot(departHead, up), k);
  pose += up * (ball * FLR_PLASMOID_A * flareReach()
      * mix(0.62, 1.0, hash11(fi * 19.61 + 10.7)))
    + along * (ball * ball * FLR_PLASMOID_A * 0.34 * flareReach()
      * (2.0 * hash11(fi * 23.17 + 12.9) - 1.0));

  // 4k(1-k) is exactly 0 at k == 0, so it cannot disturb the identity above, and
  // exactly 0 at k == 1, so the settled mark is pixel exact.
  pose += vec2(
    sin(time * FLR_TURB_RATE * 1.9 + fi * 2.17),
    cos(time * FLR_TURB_RATE * 1.6 + fi * 3.59)
  ) * FLR_TURB * 0.6 * flareStress() * 4.0 * k * (1.0 - k);

  return pose + livingLogoOffset(index, id, time) * smoothstep(0.55, 1.0, k);
}

// --- 11 · lightning --------------------------------------------------------
// A stepped leader gropes downward from a strike point, then attachment: the
// return stroke rips back UP the same channel as a travelling bead of brightness
// and radius with essentially ZERO displacement. The moment is carried entirely
// in energy, which is why it costs nothing against the trail cap — and why the
// mechanic is only as good as the density of comets on each wire.

const float LTN_ORIGIN_DIST = 1.02;
const float LTN_CHANNELS    = 4.0;
const float LTN_SPREAD      = 0.92;
const float LTN_ARC_SPAN    = 1.85;
const float LTN_KINK        = 0.075;
const float LTN_STEP        = 0.055;
const float LTN_STEP_ANISO  = 2.4;
const float LTN_STEP_RATE   = 9.0;
const float LTN_STEP_END    = 0.30;
const float LTN_STRUCT_LEAK = 0.020;
const float LTN_SLACK       = 1.16;
const float LTN_PINCH_END   = 0.55;
const float LTN_PINCH_KEEP  = 0.55;
const float LTN_PINCH_DEPTH = 0.62;
const float LTN_REEL_START  = 0.22;
const float LTN_WAVE_START  = 0.06;
const float LTN_WAVE_END    = 0.44;
const float LTN_WAVE_WIDTH  = 0.22;
const float LTN_STRIKE      = 6.0;
const float LTN_STROKE_SIZE = 1.6;
const float LTN_LEAD_WIDTH  = 0.30;
const float LTN_LEAD_GLOW   = 0.90;
const float LTN_COLD_DIM    = 0.30;
const float LTN_COLD_SIZE   = 0.42;
const float LTN_CORONA_RATE = 6.5;
const float LTN_RESTRIKE_A  = 0.855;
const float LTN_RESTRIKE_B  = 0.945;
const float LTN_DART_A      = 1.30;
const float LTN_DART_B      = 0.70;
const float LTN_DART_SHOVE  = 0.014;
const float LTN_CAPTURE     = 0.20;
const float LTN_LEAD_CAP    = 0.20;
const float LTN_JOIN_SHEAR  = 0.55;
const float LTN_COMB        = 0.26;
const float LTN_COMB_WIDTH  = 0.95;
const float LTN_BLAST       = 0.34;

// The moment sits at 0.70 * ParamA of the timeline, so the engine's neutral
// ParamA 0.5 puts attachment at 0.35 — 315 ms into the shipped 0.9 s run.
float ltnThreshold() { return clamp(uFormationParamA * 0.70, 0.15, 0.72); }
float ltnChaos()     { return clamp(uFormationParamB, 0.0, 2.0); }

// Pointer-derived, latched once per formation. The bolt leans toward the cursor
// and the whole tree is re-rolled from it, so no two hovers strike the same way.
float ltnStrikeSeed() {
  vec2 o = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  return fract(o.x * 0.4391 + o.y * 0.2711 + 0.4127);
}

float ltnTilt() {
  vec2 o = (2.0 * uFormationOrigin - uResolution) / uResolution.y;
  return clamp(o.x * 0.34, -0.62, 0.62);
}

// Breakdown clock. Exactly 0 for the whole leader phase, 0 -> 1 across the
// threshold. Read from the GLOBAL formation: attachment is ONE event.
float ltnHot(float g) {
  float h = ltnThreshold();
  return clamp((clamp(g, 0.0, 1.0) - h) / max(1.0 - h, 0.06), 0.0, 1.0);
}

float ltnEmerge(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Damped settle with one ~5% overshoot; f(0)=0, f(1)=1, f'(0)=f'(1)=0. Max slope
// 5.76, so it is ONLY ever applied to short displacements.
float ltnSettle(float t) {
  float a = 6.0;
  float w = 9.0;
  float c = (2.0 + a) / w;
  float d = 1.0 - t;
  return 1.0 - d * d * exp(-a * t) * (cos(w * t) + c * sin(w * t));
}

float ltnBump(float x) {
  float u = clamp(x, 0.0, 1.0);
  float v = 1.0 - u;
  return 16.0 * u * u * v * v;
}

// Double-rooted pulse: exactly 0 outside the window, C1 at both edges.
float ltnPulse(float g, float centre, float halfWidth) {
  float x = (g - centre) / halfWidth;
  float e = 1.0 - x * x;
  return e > 0.0 ? e * e : 0.0;
}

vec2 ltnAxis()  { float t = ltnTilt(); return vec2(sin(t), -cos(t)); }
vec2 ltnCross() { vec2 a = ltnAxis(); return vec2(-a.y, a.x); }

// Tree space -> world. y == LTN_ORIGIN_DIST lands on the mark's centre, so the
// whole discharge is centred on the logo.
vec2 ltnToWorld(vec2 tree) {
  return ltnCross() * tree.x + ltnAxis() * (tree.y - LTN_ORIGIN_DIST);
}

// Which channel this particle belongs to. Hashed from float(index) crossed with
// the strike seed, so it is uncorrelated with the logo slot.
float ltnChannelOf(int index) {
  return min(
    floor(hash11(float(index) * 12.79 + 3.41 + ltnStrikeSeed() * 5.17) * LTN_CHANNELS),
    LTN_CHANNELS - 1.0
  );
}

// Fork node and tip. Tips are STRATIFIED across the fan so the channels cannot
// randomly pile onto one side.
void ltnChannelNodes(float c, out vec2 fork, out vec2 tip) {
  float s = ltnStrikeSeed();
  float forkY = mix(0.30, 0.82, hash11(c * 3.17 + 0.91 + s * 3.70));
  float forkX = (hash11(c * 9.43 + 4.07 + s * 6.10) * 2.0 - 1.0) * 0.22;
  float lane  = (c + hash11(c * 7.31 + 1.13 + s * 8.90)) / LTN_CHANNELS;
  float tipX  = (lane * 2.0 - 1.0) * LTN_SPREAD;
  float tipY  = mix(1.05, LTN_ARC_SPAN, hash11(c * 4.87 + 8.90 + s * 2.30));
  fork = vec2(forkX, forkY);
  tip  = vec2(tipX,  tipY);
}

// How far down its own branch this particle sits. Together with ltnChannelOf
// this is the whole unpredictability argument: neither term has met LOGO_POINTS.
float ltnArcOf(int index) {
  return mix(0.10, 1.0, pow(hash11(float(index) * 5.87 + 0.53), 0.72));
}

vec2 ltnBranchTree(float c, float s) {
  vec2 fork;
  vec2 tip;
  ltnChannelNodes(c, fork, tip);
  float u = 1.0 - s;
  vec2 base = 2.0 * u * s * fork + s * s * tip;
  vec2 d = 2.0 * u * fork + 2.0 * s * (tip - fork);
  vec2 n = vec2(-d.y, d.x) / max(length(d), 0.00001);
  float w = sin(s * 9.1 + hash11(c * 2.11 + 0.31) * TAU)
    + 0.55 * sin(s * 21.7 + hash11(c * 6.53 + 3.77) * TAU)
    + 0.28 * sin(s * 47.3 + hash11(c * 8.19 + 5.41) * TAU);
  return base + n * (LTN_KINK * s * w * ltnChaos());
}

vec2 ltnBranchTangent(int index) {
  float c = ltnChannelOf(index);
  vec2 fork;
  vec2 tip;
  ltnChannelNodes(c, fork, tip);
  float s = ltnArcOf(index);
  vec2 d = 2.0 * (1.0 - s) * fork + 2.0 * s * (tip - fork);
  vec2 w = ltnCross() * d.x + ltnAxis() * d.y;
  return w / max(length(w), 0.00001);
}

// Arc coordinate: 0 at the strike point, 1 at the deepest tip. Constant per
// particle, so the return stroke is a property of the CHANNEL.
float ltnArcDepth(int index) {
  float c = ltnChannelOf(index);
  vec2 fork;
  vec2 tip;
  ltnChannelNodes(c, fork, tip);
  float s = ltnArcOf(index);
  float y = 2.0 * (1.0 - s) * s * fork.y + s * s * tip.y;
  return clamp(y / LTN_ARC_SPAN, 0.0, 1.0);
}

// The return stroke. Front sweeps from a = 1.6 to a = -0.6 — UPWARD, the
// direction a real return stroke travels. Starting and ending fully outside
// [0,1] is what stops it popping.
float ltnWaveFront(float k) {
  float t = clamp((k - LTN_WAVE_START) / max(LTN_WAVE_END - LTN_WAVE_START, 0.001), 0.0, 1.0);
  return mix(1.6, -0.6, t);
}

float ltnWave(float k, float a) {
  float q = (a - ltnWaveFront(k)) / LTN_WAVE_WIDTH;
  return exp(-q * q);
}

float ltnStructure(float g) {
  float e = ltnEmerge(ltnHot(g));
  return clamp(LTN_STRUCT_LEAK * g * g * (1.0 - e) + e, 0.0, 1.0);
}

float ltnSnap(float g) { return mix(LTN_SLACK, 1.0, ltnSettle(ltnHot(g))); }

// The z-pinch: the ACROSS-channel component collapses first, so the fuzzy bush
// snaps into taut wires before anything moves toward the mark.
float ltnPinch(float k) {
  return mix(1.0, LTN_PINCH_KEEP, ltnEmerge(clamp(k / LTN_PINCH_END, 0.0, 1.0)));
}

// The channel reeling in. Monotone (never ltnSettle) — this is the long
// displacement and it must not inherit a 5.76 slope.
float ltnReel(float k) {
  return ltnEmerge(clamp((k - LTN_REEL_START) / max(1.0 - LTN_REEL_START, 0.05), 0.0, 1.0));
}

// Stepped leader: a hold/snap/hold cadence, anisotropic so the twitch DRAWS the
// wire instead of fuzzing it.
vec2 ltnStep(int index, float g, float time) {
  float damp = 1.0 - ltnEmerge(clamp(ltnHot(g) / LTN_STEP_END, 0.0, 1.0));
  damp *= damp;
  if (damp <= 0.0) return vec2(0.0);
  float intensify = smoothstep(0.15, ltnThreshold(), g);
  float rate = mix(LTN_STEP_RATE, LTN_STEP_RATE * 1.70, intensify);
  float amp = LTN_STEP * mix(1.0, 0.55, intensify) * ltnChaos() * damp;
  float fi = float(index);
  float along = temporalNoise(fi * 3.71 + 0.19, time * rate) * 2.0 - 1.0;
  float across = temporalNoise(fi * 8.53 + 4.41, time * rate * 0.83) * 2.0 - 1.0;
  vec2 tangent = ltnBranchTangent(index);
  vec2 normal = vec2(-tangent.y, tangent.x);
  return (tangent * (along * LTN_STEP_ANISO) + normal * across) * amp;
}

vec2 ltnTreePoint(int index, float g, float time) {
  vec2 slot = LOGO_POINTS[index] * uLogoScale;
  float k = ltnHot(g);
  vec2 frame = slot * (ltnStructure(g) * ltnSnap(g));

  vec2 pt = ltnBranchTree(ltnChannelOf(index), ltnArcOf(index));
  vec2 channel = ltnToWorld(vec2(pt.x * ltnPinch(k), pt.y)) * (1.0 - ltnReel(k));

  // Dart leaders jolt the settled mark along the strike axis. Double-rooted in
  // g, so neither the arrival nor g == 1 can pop.
  vec2 dart = ltnAxis()
    * (LTN_DART_SHOVE
      * (ltnPulse(g, LTN_RESTRIKE_A, 0.055) - 0.62 * ltnPulse(g, LTN_RESTRIKE_B, 0.042))
      * mix(0.55, 1.45, hash11(float(index) * 21.73 + 1.9)));

  return frame + channel + ltnStep(index, g, time) + dart;
}

float ltnSize(int index, float g, float time) {
  float k = ltnHot(g);
  float twitch = mix(0.82, 1.18, temporalNoise(float(index) * 6.13 + 1.7, time * LTN_STEP_RATE * 0.6));
  float cold = mix(LTN_COLD_SIZE * twitch, 1.0, ltnEmerge(k));
  float pinch = 1.0 - LTN_PINCH_DEPTH * ltnBump(k / LTN_PINCH_END);
  return cold * pinch + LTN_STROKE_SIZE * ltnWave(k, ltnArcDepth(index));
}

float ltnProgress(float id, float formation) {
  return clamp(
    localFormation(id, formation) * mix(0.18, 1.0, ltnEmerge(ltnHot(formation))),
    0.0,
    1.0
  );
}

vec2 lightningHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float w = smoothstep(0.0, LTN_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * LTN_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / LTN_LEAD_CAP));

  float g = clamp(formation, 0.0, 1.0);
  vec2 channel = ltnTreePoint(index, g, time);

  // Skid onto the wire ALONG the wire rather than dropping onto it: w*w has a
  // double root at the handoff and (1 - w) makes it identically zero on arrival.
  float skid = LTN_JOIN_SHEAR * w * w * (1.0 - w)
    * (hash11(float(index) * 15.71 + 0.83) * 2.0 - 1.0);
  vec2 head = mix(lead, channel, w) + ltnBranchTangent(index) * skid;

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * ltnSize(index, g, time), w);

  return head + livingLogoOffset(index, id, time) * ltnStructure(g) * w;
}

// --- 12 · recombination ----------------------------------------------------
// A hot ionised fog fills the frame. What is drawn is not the particle but its
// LAST-SCATTERING point — a boiling offset one mean free path away — so the
// image is the mark convolved with a kernel far wider than the mark's own
// features: opaque, structureless. Cooling collapses the free-electron fraction
// through a Saha threshold, the kernel shrinks to nothing and the fog goes
// transparent. NOTHING IS TRANSPORTED: the mark was the convolution's argument
// the whole time; the medium simply stopped smearing it.

const float REC_SHARP        = 34.0;
const float REC_SMEAR_LEAD   = 0.13;
const float REC_SMEAR        = 1.05;
const float REC_BOIL         = 1.15;
const float REC_CELLS        = 7.0;
const float REC_PATCH_SPREAD = 0.045;
const float REC_FOG_RADIUS   = 5.0;
const float REC_PIN_RADIUS   = 0.30;
const float REC_PIN_SHAPE    = 117.6;
const float REC_FLASH        = 2.35;
const float REC_VEIL         = 0.34;
const float REC_DILATE       = 1.18;
const float REC_JITTER       = 0.085;
const float REC_JITTER_RATE  = 3.10;
const float REC_CAPTURE      = 0.34;
const float REC_LEAD_CAP     = 0.22;
const float REC_SHOCK        = 0.28;
const float REC_SHOCK_WIDTH  = 0.40;
const float REC_SWALLOW      = 0.10;

// Neutral ParamA 0.5 -> decoupling at 0.35 of the timeline.
float recThreshold() { return clamp(uFormationParamA * 0.70, 0.18, 0.85); }
float recChaos() { return clamp(uFormationParamB, 0.0, 2.0); }

// Saha-like ionisation collapse: flat, then a cliff, then flat. Renormalised so
// it is EXACTLY 1.0 at g == 0 and EXACTLY 0.0 at g == 1.
float recSigmoid(float g, float h) {
  float x = clamp(g, 0.0, 1.0);
  float a  = 1.0 / (1.0 + exp(REC_SHARP * (x - h)));
  float a0 = 1.0 / (1.0 + exp(REC_SHARP * (0.0 - h)));
  float a1 = 1.0 / (1.0 + exp(REC_SHARP * (1.0 - h)));
  return clamp((a - a1) / max(a0 - a1, 1.0e-6), 0.0, 1.0);
}

// Convective cooling patches. Membership is a hash of 'index' ALONE, so a patch
// clearing early exposes a random scatter of the mark's points and never a
// legible fragment of it.
float recPatchOffset(int index) {
  float cell = min(
    floor(hash11(float(index) * 21.17 + 6.41) * REC_CELLS),
    REC_CELLS - 1.0
  );
  return (hash11(cell * 13.90 + 3.70) * 2.0 - 1.0) * REC_PATCH_SPREAD;
}

float recIonised(int index, float g) {
  return recSigmoid(g, clamp(recThreshold() + recPatchOffset(index), 0.18, 0.94));
}

// The mean free path outruns the parcel BEFORE the parcel's opacity clears, so
// the image sharpens underneath a still-opaque fog. That is the whole mechanic:
// it is why a viewer never sees gathering.
float recSmearFrac(int index, float g) {
  return recSigmoid(
    g,
    clamp(recThreshold() + recPatchOffset(index) - REC_SMEAR_LEAD, 0.10, 0.90)
  );
}

// The last-scattering offset. Three incommensurate rotations, so a particle's
// offset traces a lissajous whose instantaneous velocity has essentially no
// component toward the slot.
vec2 recScatter(int index, float g, float time) {
  float fi = float(index);
  float p1 = time * REC_BOIL + hash11(fi * 3.17 + 0.41) * TAU;
  float p2 = time * REC_BOIL * 1.63 + hash11(fi * 7.93 + 2.13) * TAU;
  float p3 = time * REC_BOIL * 0.47 + hash11(fi * 11.71 + 5.87) * TAU;
  float lead = mix(0.55, 1.0, hash11(fi * 5.31 + 1.19));
  vec2 walk = vec2(
    lead * cos(p1) + 0.62 * cos(p2) + 0.44 * cos(p3),
    lead * sin(p1) + 0.62 * sin(p2) - 0.44 * sin(p3)
  ) * 0.5;
  return vec2(walk.x * 1.45, walk.y * 0.78)
    * REC_SMEAR * recSmearFrac(index, g) * recChaos();
}

vec2 recJitter(int index, float g, float time) {
  float fi = float(index);
  float p1 = time * REC_JITTER_RATE + hash11(fi * 13.31 + 7.19) * TAU;
  float p2 = time * REC_JITTER_RATE * 1.71 + hash11(fi * 19.77 + 3.53) * TAU;
  return vec2(
    sin(p1) + 0.50 * sin(p2),
    cos(p1 * 1.23) + 0.50 * cos(p2 * 0.79)
  ) * REC_JITTER * pow(1.0 - clamp(g, 0.0, 1.0), 1.5) * recChaos();
}

float recDilate(int index, float g) {
  return mix(1.0, REC_DILATE, recIonised(index, g));
}

vec2 recFogPoint(int index, float g, float time) {
  return LOGO_POINTS[index] * uLogoScale * recDilate(index, g)
    + recScatter(index, g, time)
    + recJitter(index, g, time);
}

// A broad fog cell, then a hard plunge THROUGH the settled size at the crossing,
// then a ring back to exactly 1.0.
float recSize(int index, float g) {
  float x = recIonised(index, g);
  float t = 1.0 - x;
  float pin = REC_PIN_SHAPE * pow(t, 7.0) * (1.0 - t) * (1.0 - t);
  return mix(1.0, REC_FOG_RADIUS, x) * mix(1.0, REC_PIN_RADIUS, pin);
}

float recProgress(int index, float id, float formation) {
  float t = 1.0 - recIonised(index, clamp(formation, 0.0, 1.0));
  return clamp(localFormation(id, formation) * mix(0.18, 1.0, t * t), 0.0, 1.0);
}

vec2 plasmaHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  // The comet's absorption point is a random place in the cloud, statistically
  // independent of its slot, because the smear at that moment exceeds the mark's
  // own radius.
  float w = smoothstep(0.0, REC_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * REC_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / REC_LEAD_CAP));

  float g = clamp(formation, 0.0, 1.0);
  vec2 fog = recFogPoint(index, g, time);

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * recSize(index, g), w);

  return mix(lead, fog, w)
    + livingLogoOffset(index, id, time) * (1.0 - recIonised(index, g)) * w;
}

// --- 13 · phasechange ------------------------------------------------------
// Supercooled melt -> dendritic solidification. The mark's material is present
// from the first frame but has NO long-range order, so nothing about it is
// readable. One seed particle nucleates and a six-armed front rips outward,
// converting melt to lattice as it passes and dumping latent heat at the
// interface — recalescence. Behind the front every disorder amplitude is
// identically zero, so the landing is exact.
//
// The front is a PHASE BOUNDARY, not matter: its speed is unbounded and costs
// nothing in the trail cap. Only each particle's own lock is transport, and that
// is soft-capped below.

const float PHZ_CAPTURE      = 0.24;
const float PHZ_LEAD_CAP     = 0.22;
const float PHZ_FRONT_SPAN   = 0.20;
const float PHZ_LOCK         = 0.28;
const float PHZ_ARMS         = 6.0;
const float PHZ_ARM_GAIN     = 0.85;
const float PHZ_ARM_SHARP    = 3.0;
const float PHZ_GRAIN        = 0.16;
const float PHZ_BRANCH       = 0.05;
const float PHZ_REACH        = 2.40;
const float PHZ_MELT_DILATE  = 1.26;
const float PHZ_MELT_SCATTER = 1.15;
const float PHZ_MELT_FOLD    = 0.50;
const float PHZ_FOLD_RATE    = 0.62;
const float PHZ_JITTER       = 0.075;
const float PHZ_JITTER_RATE  = 3.10;
const float PHZ_VISCOUS      = 0.35;
const float PHZ_MAX_OFFSET   = 0.60;
const float PHZ_OVERSHOOT    = 0.06;
const float PHZ_TWIST        = 0.30;
const float PHZ_INFALL_SWIRL = 1.05;
const float PHZ_SHRINK       = 0.045;
const float PHZ_COLD_DIM     = 0.34;
const float PHZ_COLD_SIZE    = 0.58;
const float PHZ_RECAL        = 2.40;
const float PHZ_SPIKE        = 1.80;
const float PHZ_SHOCK        = 0.30;
const float PHZ_SQUEEZE      = 0.075;
const float PHZ_RING         = 0.34;

// Neutral ParamA 0.5 -> nucleation at 0.35 of the timeline.
float phzNucleation() { return clamp(uFormationParamA * 0.70, 0.12, 0.62); }
float phzChaos() { return clamp(uFormationParamB, 0.0, 2.0); }

// One seed per formation. uFormationStartFieldTime is CONSTANT for a whole run,
// so the nucleus cannot move between two trail samples. fract() first: hash11
// degenerates on large inputs and field time is unbounded.
float phzSeed() { return fract(uFormationStartFieldTime * 0.6180339887) + 0.137; }

// Nucleation happens ON a particle — the seed is a lattice site, and that site
// is the first thing to light.
vec2 phzNucleus() {
  int seedIndex = clamp(
    int(hash11(phzSeed() * 7.31) * float(${Z.length})),
    0,
    ${Z.length - 1}
  );
  return LOGO_POINTS[seedIndex] * uLogoScale;
}

float phzArmPhase() { return hash11(phzSeed() * 3.77 + 1.19) * TAU; }

// Growth-rate anisotropy. cos() of an INTEGER multiple of the angle is
// 2-PI-periodic and C-infinity, so the star has no seam at atan's branch cut.
float phzLobeSpeed(float ang) {
  float lobe = 0.5 + 0.5 * cos(PHZ_ARMS * (ang - phzArmPhase()));
  return 1.0 + PHZ_ARM_GAIN * pow(max(lobe, 0.0), PHZ_ARM_SHARP);
}

// When the front reaches this particle. Every term is a per-particle CONSTANT —
// no 'time', no 'formation' — so two trail samples can never disagree.
float phzArrival(int index) {
  int i = clamp(index, 0, ${Z.length - 1});
  float fi = float(i);
  vec2 d = LOGO_POINTS[i] * uLogoScale - phzNucleus();
  float ang = atan(d.y, d.x + 1.0e-6);
  float grain = 1.0
    + PHZ_GRAIN * (hash11(fi * 12.11 + 3.77) * 2.0 - 1.0)
    - PHZ_BRANCH * sin(9.0 * ang + hash11(fi * 21.31 + 8.17) * TAU);
  float a = phzNucleation()
    + PHZ_FRONT_SPAN * grain
      * length(d) / (PHZ_REACH * max(uLogoScale, 0.35) * phzLobeSpeed(ang));
  // Hard guarantee that every particle is fully locked before g == 1. A min() of
  // two per-particle constants is itself a constant, so it cannot straddle.
  return min(a, 0.94 - PHZ_LOCK);
}

// The order parameter: 0 = melt, 1 = lattice. The ONLY thing in the mechanic
// that carries time.
float phzOrder(int index, float g) {
  float a = phzArrival(index);
  return smoothstep(a, a + PHZ_LOCK, clamp(g, 0.0, 1.0));
}

// Interface band: peak exactly 1.0 at phi = 0.5, DOUBLE roots at both ends.
float phzBand(float phi) {
  float b = phi * (1.0 - phi);
  return 16.0 * b * b;
}

// Position latch: smootherstep plus a 6% overshoot. Peak slope ~2.0 — that
// number IS the trail-cap budget, so do not make it springier.
float phzLatch(float t) {
  float d = 1.0 - t;
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0)
    + PHZ_OVERSHOOT * 28.9 * t * t * t * d * d;
}

float phzSize(float phi) {
  return mix(PHZ_COLD_SIZE, 1.0, smoothstep(0.08, 0.92, phi))
    + PHZ_SPIKE * phzBand(phi);
}

vec2 phzMeltOffset(int index, float g, float time) {
  int i = clamp(index, 0, ${Z.length - 1});
  float fi = float(i);
  vec2 slot = LOGO_POINTS[i] * uLogoScale;
  float r = length(slot);
  float a = r > 0.00001 ? atan(slot.y, slot.x) : 0.0;

  // Orientational disorder — a liquid has none. Scatter goes as 1/(0.34 + r), so
  // the core is stirred through far more than the rim: the melt keeps roughly
  // the mark's footprint and none of its structure. psi is a per-particle
  // CONSTANT, so this is a POSE, not a rotation.
  float psi = PHZ_MELT_SCATTER / (0.34 + r)
    * mix(-1.0, 1.0, hash11(fi * 9.17 + 2.31));
  vec2 scattered = vec2(cos(a + psi), sin(a + psi)) * (r * PHZ_MELT_DILATE);

  float chill = mix(1.0, PHZ_VISCOUS, smoothstep(0.08, phzNucleation(), g))
    * phzChaos();

  // Fold: two low-frequency modes evaluated at the LATTICE position, so the flow
  // is spatially smooth — neighbours stay neighbours. This is a liquid, not a
  // spray.
  float p = time * PHZ_FOLD_RATE + fi * 0.41;
  vec2 fold = vec2(
    sin(2.3 * slot.y + p) + 0.60 * sin(3.7 * slot.x - 0.8 * p),
    cos(2.1 * slot.x - p) + 0.60 * cos(3.1 * slot.y + 0.7 * p)
  ) * PHZ_MELT_FOLD;

  float q1 = time * PHZ_JITTER_RATE + hash11(fi * 3.71 + 0.19) * TAU;
  float q2 = time * PHZ_JITTER_RATE * 1.57 + hash11(fi * 8.53 + 4.41) * TAU;
  vec2 jitter = vec2(
    sin(q1) + 0.50 * sin(q2),
    cos(q1 * 1.21) + 0.50 * cos(q2 * 0.87)
  ) * PHZ_JITTER;

  vec2 off = (scattered - slot) + (fold + jitter) * chill;

  // Soft cap. L/(1 + L/M) is C-infinity, monotone, identity for small L and
  // asymptotic to M. This keeps EVERY particle's lock inside the trail cap
  // without clipping a path or teleporting anything.
  return off / (1.0 + length(off) / PHZ_MAX_OFFSET);
}

vec2 phzPose(int index, float g, float time) {
  int i = clamp(index, 0, ${Z.length - 1});
  vec2 slot = LOGO_POINTS[i] * uLogoScale;
  float phi = phzOrder(i, g);

  // Solidification shrinkage: the fresh crystal is denser than the melt it
  // replaced. Roots at both ends, so it cannot move the landing.
  vec2 lattice = slot * (1.0 - PHZ_SHRINK * 4.0 * phi * (1.0 - phi));

  float lam = phzLatch(phi);
  vec2 chord = (slot + phzMeltOffset(i, g, time) - lattice) * (1.0 - lam);

  // Grain twist: material is dragged ALONG the interface as it is captured,
  // never dropped straight onto the site.
  float turn = PHZ_TWIST * lam * lam;
  float cs = cos(turn);
  float sn = sin(turn);
  return lattice + vec2(chord.x * cs - chord.y * sn, chord.x * sn + chord.y * cs);
}

vec2 phasechangeHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  int i = clamp(index, 0, ${Z.length - 1});
  float g = clamp(formation, 0.0, 1.0);
  vec2 pose = phzPose(i, g, time);

  float w = smoothstep(0.0, PHZ_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * PHZ_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / PHZ_LEAD_CAP));

  // Spiral the entry about the moving melt point so comets stir INTO the droplet
  // instead of dropping onto it.
  vec2 chord = mix(lead, pose, w) - pose;
  float entry = PHZ_INFALL_SWIRL * w * w;
  float cs = cos(entry);
  float sn = sin(entry);
  vec2 head = pose + vec2(chord.x * cs - chord.y * sn, chord.x * sn + chord.y * cs);

  float phi = phzOrder(i, g);
  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * phzSize(phi), w);

  // Only the locked lattice breathes; the melt has its own churn.
  return head + livingLogoOffset(index, id, time) * phi * w;
}

// --- 14 · fusion -----------------------------------------------------------
// A dense, cold, degenerate core. Three points cross the Coulomb barrier and
// fuse; each release heats its neighbours, so the burnt fraction follows a
// LOGISTIC. The mark is the ASH: a particle precipitates onto its slot only once
// its OWN burn has happened, so the mark assembles in a wave whose geometry
// belongs to the detonation front, not to the logo.
//
// Trail-safety invariant: fusIgniteAt(index) reads only 'index' and uniforms
// frozen for the whole formation, so it is a per-particle CONSTANT.

const float FUS_CAPTURE      = 0.24;
const float FUS_LEAD_CAP     = 0.22;
const float FUS_INFALL_SWIRL = 1.05;

const float FUS_CORE         = 0.40;
const float FUS_SCRAMBLE     = 0.56;
const float FUS_WIND         = 0.55;
const float FUS_CLUMPS       = 7.0;
const float FUS_CLUMP_REACH  = 0.30;
const float FUS_KNOT         = 0.15;
const float FUS_TURB         = 0.085;
const float FUS_TURB_RATE    = 3.10;

const float FUS_K            = 18.0;
const float FUS_T_HALF       = 0.35;
const float FUS_T_SPAN       = 0.14;
const float FUS_SEAT_W       = 0.42;
const float FUS_REACH        = 0.95;
const float FUS_DIM          = 1.75;
const float FUS_RAGGED       = 0.14;
const float FUS_OVER         = 0.045;

const float FUS_RECOIL       = 0.055;
const float FUS_COLD_DIM     = 0.22;
const float FUS_COLD_SIZE    = 0.42;
const float FUS_SWELL        = 1.90;
const float FUS_FLASH        = 2.60;
const float FUS_PREHEAT      = 0.045;
const float FUS_SHOCK        = 0.34;
const float FUS_INFALL_PULL  = 0.075;

// Chain gain. Doubled so the engine's neutral ParamA 0.5 is unit gain; the
// criticality instant stays pinned at FUS_T_HALF whatever the gain.
float fusGain()  { return clamp(uFormationParamA * 2.0, 0.30, 2.00); }
float fusChaos() { return clamp(uFormationParamB, 0.00, 2.00); }

float fusEmerge(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Seat curve: smootherstep plus ONE decaying overshoot lobe. f(0)=0, f(1)=1
// EXACTLY with zero slope at both ends. Peak slope ~2.0 — the number the whole
// trail budget is set by.
float fusSeat(float t) {
  float d = 1.0 - t;
  return fusEmerge(t) + FUS_OVER * 28.94 * t * t * t * d * d;
}

float fusFlare(float t) { float d = 1.0 - t; return 6.75 * t * d * d; }

float fusRecoil(float t) { float d = 1.0 - t; return 9.4815 * t * d * d * d; }

float fusClumpOf(int index) {
  return min(floor(hash11(float(index) * 17.31 + 5.13) * FUS_CLUMPS), FUS_CLUMPS - 1.0);
}

// A knot, dissolving as its own members burn out of it. Each particle reads this
// with its OWN clock, so a clump shears apart particle by particle.
vec2 fusClumpOffset(float cs, float c) {
  float reach = mix(0.55, 1.0, hash11(cs * 7.77 + 1.90)) * FUS_CLUMP_REACH * fusChaos();
  float ang = hash11(cs * 3.13 + 11.70) * TAU
    + 1.15 * mix(0.72, 1.28, hash11(cs * 5.51 + 23.30)) * c;
  return vec2(cos(ang), sin(ang)) * reach * (1.0 - c);
}

vec2 fusKnotOffset(int index, float cs, float c) {
  float rr = sqrt(hash11(float(index) * 6.71 + 3.29));
  float ang = hash11(float(index) * 4.13 + 0.77) * TAU
    + hash11(cs * 2.19 + 7.70) * TAU
    + (0.90 + 0.50 * rr) * 1.35 * c;
  return vec2(cos(ang), sin(ang)) * rr * FUS_KNOT * fusChaos() * (1.0 - c);
}

vec2 fusTurbulence(int index, float c, float time) {
  float damp = (1.0 - c) * (1.0 - c);
  float p1 = time * FUS_TURB_RATE + hash11(float(index) * 3.71 + 0.19) * TAU;
  float p2 = time * FUS_TURB_RATE * 1.63 + hash11(float(index) * 8.53 + 4.41) * TAU;
  float p3 = time * FUS_TURB_RATE * 0.71 + hash11(float(index) * 5.29 + 9.13) * TAU;
  return vec2(
    sin(p1) + 0.55 * sin(p2) + 0.30 * sin(p3),
    cos(p1 * 1.19) + 0.55 * cos(p2 * 0.83) + 0.30 * cos(p3 * 1.41)
  ) * FUS_TURB * fusChaos() * damp;
}

// The core frame. c == 0 is a scrambled, differentially wound-up blob at 40% of
// the mark's size; c == 1 is EXACTLY the slot, because fusSeat(1) == 1 exactly.
vec2 fusCorePoint(int index, float c) {
  vec2 slot = LOGO_POINTS[clamp(index, 0, ${Z.length - 1})] * uLogoScale;
  float sr = length(slot);
  float sa = sr > 0.00001 ? atan(slot.y, slot.x) : 0.0;
  float s = fusSeat(c);

  // Radial ORDER is scrambled by a pure index hash, so the core is not a small
  // copy of the mark: the innermost particle in the core is not the one whose
  // slot is innermost.
  float scramble = mix(
    1.0 - 0.5 * FUS_SCRAMBLE,
    1.0 + 0.5 * FUS_SCRAMBLE,
    hash11(float(index) * 21.13 + 0.71)
  );
  float rr = sr * mix(FUS_CORE * scramble, 1.0, s);

  // Differential wind-up, unwound by the same seat curve so it is exactly 0 at
  // c == 1.
  float wind = FUS_WIND / (0.30 + sr)
    * mix(0.82, 1.22, hash11(float(index) * 9.17 + 2.31));
  float th = sa - wind * (1.0 - s);

  return vec2(cos(th), sin(th)) * rr;
}

// The comoving reference configuration the CHAIN propagates through. Reads
// 'index' and formation-constant uniforms only.
vec2 fusRefPoint(int index) {
  return fusCorePoint(index, 0.0) + fusClumpOffset(fusClumpOf(index), 0.0);
}

// Three points that cross the barrier first. Re-rolled per formation from
// uFormationStartFieldTime, which is frozen for the whole run, so the cascade
// takes a different route on every re-hover.
vec2 fusSeedPoint(int k) {
  float s = fract(uFormationStartFieldTime * 0.1731) + float(k) * 0.37;
  float a = hash11(s * 53.71 + 3.17) * TAU;
  float r = mix(0.10, 0.46, hash11(s * 29.13 + 8.90));
  return vec2(cos(a), sin(a)) * r;
}

// This particle's quantile in the burn order. Distance to the nearest seed,
// raised to FUS_DIM because a front sweeping a roughly 2D distribution encloses
// count ~ r^2 — that exponent turns a geometric front into an avalanche.
float fusQuantile(int index) {
  vec2 p = fusRefPoint(index);
  float d = min(
    min(distance(p, fusSeedPoint(0)), distance(p, fusSeedPoint(1))),
    distance(p, fusSeedPoint(2))
  );
  float q = pow(clamp(d / FUS_REACH, 0.0, 1.0), FUS_DIM);
  q += (hash11(float(index) * 13.77 + 2.31) - 0.5) * FUS_RAGGED;
  return clamp(q, 0.004, 0.996);
}

// Formation progress at which THIS particle fuses. The logit is the exact
// inverse of the logistic burnt fraction; tanh bounds the result into
// (T_HALF - T_SPAN, T_HALF + T_SPAN) without bunching the tail on a hard clamp.
float fusIgniteAt(int index) {
  float q = fusQuantile(index);
  float x = log(q / (1.0 - q)) / (FUS_K * fusGain());
  return FUS_T_HALF + FUS_T_SPAN * tanh(x / FUS_T_SPAN);
}

// One shared seat DURATION rather than a shared end time, so every particle
// moves at the same bounded speed.
float fusBurn(int index, float g) {
  return clamp((clamp(g, 0.0, 1.0) - fusIgniteAt(index)) / FUS_SEAT_W, 0.0, 1.0);
}

float fusSize(float c) {
  return mix(FUS_COLD_SIZE, 1.0, fusEmerge(c)) + FUS_SWELL * fusFlare(c);
}

vec2 fusCloudPoint(int index, float c, float time) {
  float cs = fusClumpOf(index);
  vec2 p = fusCorePoint(index, c)
    + fusClumpOffset(cs, c)
    + fusKnotOffset(index, cs, c)
    + fusTurbulence(index, c, time);
  float len = max(length(p), 0.0001);
  return p + p / len * (FUS_RECOIL * fusRecoil(c));
}

vec2 fusionHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float w = smoothstep(0.0, FUS_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * FUS_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / FUS_LEAD_CAP));

  // The chain is driven by the GLOBAL formation: it is ONE event with 128
  // clocks, not 128 events.
  float g = clamp(formation, 0.0, 1.0);
  float c = fusBurn(index, g);
  vec2 cloud = fusCloudPoint(index, c, time);

  vec2 chord = mix(lead, cloud, w) - cloud;
  float phi = FUS_INFALL_SWIRL * w * w;
  float cs = cos(phi);
  float sn = sin(phi);
  vec2 head = cloud + vec2(chord.x * cs - chord.y * sn, chord.x * sn + chord.y * cs);

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  radiusPx = mix(departRadiusPx, logoRadiusPx * fusSize(c), w);

  return head + livingLogoOffset(index, id, time) * fusEmerge(c) * w;
}

float fusionProgress(int index, float id, float formation) {
  float c = fusBurn(index, clamp(formation, 0.0, 1.0));
  return clamp(
    localFormation(id, formation) * mix(0.20, 1.0, fusEmerge(c)),
    0.0,
    1.0
  );
}

// --- 15 · aurora -----------------------------------------------------------
// Magnetospheric excitation. Comets are grabbed by field lines, spiral down them
// with a tightening gyration, and pile into a SINGLE thin auroral ribbon that
// meanders, folds over itself and drifts. The mark is the ribbon's END STATE:
// through the quiet phase the ribbon carries only AUR_RIBBON of the mark's
// vertical structure and its along-arc ordering is scrambled by fold-over. Then
// substorm onset: the curtain stands up and a westward surge tears along the arc.

const float AUR_CAPTURE      = 0.28;
const float AUR_LEAD_CAP     = 0.22;

const float AUR_APEX_R       = 0.85;
const float AUR_APEX_H       = 1.30;
const float AUR_APEX_LEAN    = 0.85;
const float AUR_FALL_T0      = 0.02;
const float AUR_FALL_T1      = 0.34;
const float AUR_BOW          = 0.24;

const float AUR_GYRO_R       = 0.17;
const float AUR_GYRO_TURNS   = 1.75;
const float AUR_GYRO_SQUASH  = 0.34;

const float AUR_RIBBON       = 0.12;
const float AUR_FOLD         = 0.42;
const float AUR_SAG          = 0.34;
const float AUR_BREAKUP      = 0.75;
const float AUR_W1           = 2.40;
const float AUR_W2           = 4.30;
const float AUR_W3           = 7.10;
const float AUR_R1           = 1.60;
const float AUR_R2           = 2.20;
const float AUR_R3           = 2.60;
const float AUR_DRIFT_X      = 0.20;
const float AUR_DRIFT_Y      = 0.085;
const float AUR_DRIFT_RX     = 0.55;
const float AUR_DRIFT_RY     = 0.81;
const float AUR_SHEET        = 0.055;

const float AUR_ONSET_X      = -0.52;
const float AUR_SPEED_W      = 1.70;
const float AUR_SPEED_E      = 0.82;
const float AUR_FRONT_W      = 0.26;
const float AUR_WAKE_W       = 0.72;
const float AUR_EAST_GAIN    = 0.42;

const float AUR_RAY_KICK     = 0.22;
const float AUR_CURL         = 0.085;
const float AUR_CURL_W       = 5.30;

const float AUR_QUIET_DIM    = 0.22;
const float AUR_SURGE_GLOW   = 5.00;
const float AUR_COLD_SIZE    = 0.62;
const float AUR_SURGE_SIZE   = 1.05;

const float AUR_BG_COMB      = 0.30;
const float AUR_BG_BEAM      = 0.62;
const float AUR_BG_KICK      = 0.36;

// Neutral ParamA 0.5 -> substorm onset at 0.35 of the timeline.
float aurThreshold() { return clamp(uFormationParamA * 0.70, 0.15, 0.86); }
float aurChaos()     { return clamp(uFormationParamB, 0.0, 2.0); }
// Shares COLUMN_HALF_WIDTH so there is only ONE measurement of the mark's
// half-width in the file to rot.
float aurHalfSpan()  { return COLUMN_HALF_WIDTH * uLogoScale; }

// Onset clock. Exactly 0 for the whole quiet phase, 0 -> 1 across the threshold.
// Driven by the GLOBAL formation: breakup is ONE event, not 128.
float aurClock(float g) {
  float h = aurThreshold();
  return clamp((clamp(g, 0.0, 1.0) - h) / max(1.0 - h, 0.06), 0.0, 1.0);
}

float aurEmerge(float t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

// Surge envelope: 0 at t == 0 with a steep rise, peak exactly 1.0 at t == 1/3,
// DOUBLE root at t == 1 so nothing it drives can perturb the settled mark.
float aurSurgeEnv(float t) { float d = 1.0 - t; return 6.75 * t * d * d; }

// The two fronts, in world x. Sharp leading edge, long trailing wake — the width
// is blended smoothly ACROSS the front, so the profile is C1 everywhere.
float aurFront(float x, float k) {
  float span = aurHalfSpan();
  float dw = x - (AUR_ONSET_X * span - AUR_SPEED_W * span * k);
  float de = x - (AUR_ONSET_X * span + AUR_SPEED_E * span * k);
  float qw = dw / mix(AUR_FRONT_W, AUR_WAKE_W, smoothstep(-0.06, 0.30, dw));
  float qe = de / mix(AUR_WAKE_W, AUR_FRONT_W, smoothstep(-0.30, 0.06, de));
  return clamp(exp(-qw * qw) + AUR_EAST_GAIN * exp(-qe * qe), 0.0, 1.0);
}

// The curtain map. At g == 1 this is the IDENTITY, so the settled sheet IS the
// mark. Coherent in u — no per-particle hash in here — which is what makes it
// read as fabric rather than as a point cloud.
vec2 aurCurtain(float u, float v, float g, float time) {
  float k = aurClock(g);
  float rise = aurEmerge(k);
  float chaos = aurChaos();
  float amp = AUR_FOLD * chaos * ((1.0 - rise) + AUR_BREAKUP * aurSurgeEnv(k));
  float vGain = mix(AUR_RIBBON, 1.0, rise);

  float q1 = AUR_W1 * u + AUR_R1 * time;
  float q2 = AUR_W2 * u - AUR_R2 * time + 1.93;
  float q3 = AUR_W3 * u + AUR_R3 * time + 4.11;
  float fx = 0.62 * sin(q1) + 0.38 * sin(q2) + 0.22 * sin(q3);
  float fy = 0.30 * cos(q1) + 0.20 * cos(q2 * 1.31) + 0.12 * cos(q3 * 0.77);

  vec2 drift = vec2(
    AUR_DRIFT_X * sin(AUR_DRIFT_RX * time + 0.70),
    AUR_DRIFT_Y * sin(AUR_DRIFT_RY * time + 2.10)
  ) * chaos * (1.0 - rise);

  return vec2(u + amp * fx, v * vGain + amp * AUR_SAG * fy) + drift;
}

// A real curtain is several thin sheets nested a little apart. Per-particle, and
// exactly 0 once ignited.
vec2 aurSheet(int index, float g) {
  float rise = aurEmerge(aurClock(g));
  float d = hash11(float(index) * 15.13 + 4.37) * 2.0 - 1.0;
  return vec2(d * 1.6, d) * AUR_SHEET * aurChaos() * (1.0 - rise);
}

// Helical descent down the field line. The gyration TIGHTENS as it falls and is
// exactly 0 in value AND slope at p == 1, so arriving on the ribbon has no kink.
vec2 aurGyro(int index, float p) {
  float gr = AUR_GYRO_R * aurChaos() * (1.0 - p) * (1.0 - p);
  float spin = p * p * (3.0 - 2.0 * p);
  float ang = hash11(float(index) * 21.7 + 3.1) * TAU
    + AUR_GYRO_TURNS * TAU * spin * mix(0.70, 1.40, hash11(float(index) * 9.31 + 5.7));
  return vec2(cos(ang), sin(ang) * AUR_GYRO_SQUASH) * gr;
}

vec2 auroraHead(int index, float id, float time, float formation, out float radiusPx) {
  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);

  float g = clamp(formation, 0.0, 1.0);
  vec2 slot = LOGO_POINTS[index] * uLogoScale;

  vec2 foot = aurCurtain(slot.x, slot.y, g, time) + aurSheet(index, g);

  // The line's apex, on the side the comet actually came from — a dipole has two
  // feet, so half the cloud rains DOWN and half rises UP into the same oval.
  // departHead is the frozen sample, so hemi and apexDir are per-particle
  // CONSTANTS; the ternary can never flip mid-trail.
  float hemi = departHead.y >= 0.0 ? 1.0 : -1.0;
  vec2 apexDir = normalize(vec2(departHead.x * AUR_APEX_LEAN, hemi * AUR_APEX_H));
  vec2 apex = foot + apexDir * AUR_APEX_R;

  float p = clamp((local - AUR_FALL_T0) / (AUR_FALL_T1 - AUR_FALL_T0), 0.0, 1.0);
  float fall = p * p * (3.0 - 2.0 * p);
  vec2 normalDir = vec2(-apexDir.y, apexDir.x);
  vec2 line = mix(apex, foot, fall)
    + normalDir * (AUR_BOW * aurChaos() * 4.0 * p * (1.0 - p)
        * (hash11(float(index) * 7.93 + 1.29) * 2.0 - 1.0))
    + aurGyro(index, p);

  float w = smoothstep(0.0, AUR_CAPTURE, local);
  float departSpeed = length(departVelocity);
  float elapsed = local * formationTravelTime();
  vec2 lead = departHead
    + departVelocity / max(departSpeed, 0.00001)
      * AUR_LEAD_CAP * (1.0 - exp(-departSpeed * elapsed / AUR_LEAD_CAP));

  vec2 head = mix(lead, line, w);

  // The surge. A pure ENERGY wave: it travels ALONG the arc and displaces
  // TRANSVERSE to its own travel, so it reads as a whip cracking through fabric.
  // Keyed to slot.x, not to the drawn x, so it is a pure function of index.
  float k = aurClock(g);
  float surge = aurSurgeEnv(k) * aurFront(slot.x, k);
  head += vec2(
    AUR_CURL * surge * sin(AUR_CURL_W * slot.x + 4.10),
    AUR_RAY_KICK * surge * mix(0.55, 1.0, hash11(float(index) * 11.9 + 2.3))
  ) * w;

  float logoRadiusPx =
    max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float size = mix(AUR_COLD_SIZE, 1.0, aurEmerge(k)) + AUR_SURGE_SIZE * surge;
  radiusPx = mix(departRadiusPx, logoRadiusPx * size, w);

  return head + livingLogoOffset(index, id, time) * aurEmerge(k) * w;
}

float auroraProgress(float id, float formation) {
  return clamp(
    localFormation(id, formation) * mix(0.30, 1.0, aurEmerge(aurClock(formation))),
    0.0,
    1.0
  );
}

// --- dispatch --------------------------------------------------------------

// Has this particle left the live starfield path yet? This is what arms the
// engine's fieldRecycled trail-collapse guard, so it must be > 0 exactly when
// the position stops reading fieldPoint at the live sample time.
float formationEngaged(int index, float id, float formation) {
  int mode = formationMode();
  int i = clamp(index, 0, ${Z.length - 1});
  if (mode == 1) return scanProgress(i, formation);
  if (mode == 4) return growthFlight(i, growthArm(i), formation);
  return localFormation(id, formation);
}

// Per-particle progress for radius, trail length and surface gating.
float formationProgress(int index, float id, float formation) {
  int mode = formationMode();
  int i = clamp(index, 0, ${Z.length - 1});
  if (mode == 1) return scanProgress(i, formation);
  if (mode == 3) return columnProgress(i, id, formation);
  if (mode == 4) return growthLocal(i, formation);
  if (mode == 7) return ignitionProgress(id, formation);
  if (mode == 8) return collapseProgress(id, formation);
  if (mode == 9) return novaProgress(i, id, formation);
  if (mode == 10) return flareProgress(i, id, formation);
  if (mode == 11) return ltnProgress(id, formation);
  if (mode == 12) return recProgress(i, id, formation);
  if (mode == 13) return phzOrder(i, formation);
  if (mode == 14) return fusionProgress(i, id, formation);
  if (mode == 15) return auroraProgress(id, formation);
  return localFormation(id, formation);
}

// Replaces main()'s global smoothstep(0.0, 0.18, uFormation) role ramp for
// front-based mechanics — otherwise every logo particle brightens to logo
// opacity at 18% formation, far ahead of the front.
float formationRoleBlend(int index, float id) {
  int mode = formationMode();
  int i = clamp(index, 0, ${Z.length - 1});
  if (mode == 1) {
    float p = scanProgress(i, uFormation);
    return p * p * (3.0 - 2.0 * p);
  }
  if (mode == 4) {
    return smoothstep(0.0, 0.35, growthFlight(i, growthArm(i), uFormation));
  }
  if (mode == 9) {
    // Logo-role opacity is granted by the shock, not by a global 18% ramp.
    return smoothstep(0.0, 0.20, novaShock(novaArrive(i, id), uFormation));
  }
  return smoothstep(0.0, 0.18, uFormation);
}

float formationLifeFade(int index, float id, float local) {
  int mode = formationMode();
  int i = clamp(index, 0, ${Z.length - 1});
  if (mode == 1) {
    // While the position still reads the live starfield (w small) the particle
    // keeps the field's own spawn/retire fade, so a depth recycle happens while
    // it is already at zero opacity; by the time the position is line-owned it
    // is at full logo opacity. The second term is a x1.65 flare peaking exactly
    // on the bar, with a double root at both ends so it cannot pop.
    float p = scanProgress(i, uFormation);
    float w = p * p * (3.0 - 2.0 * p);
    float flare = 16.0 * p * p * (1.0 - p) * (1.0 - p);
    return mix(fieldLife(id, uFieldTime), 1.0, w) * (1.0 + 0.65 * flare);
  }
  if (mode == 2) {
    float g = localFormation(id, uFormation);
    float collapse = shatterCollapse(i, uFormation);
    float w = smoothstep(0.0, SHATTER_CAPTURE, g);
    return mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.32, g))
      * (1.0
        + SHATTER_FLASH * 4.0 * collapse * collapse * collapse * (1.0 - collapse) * w);
  }
  if (mode == 3) {
    // The unlocked scaffolding sits at 0.58 and each column lights to full as
    // it drives home. 1.0 at g = 0 and 1.0 at c = 1, so no pop at either end.
    float g = localFormation(id, uFormation);
    float c = columnProgress(i, id, uFormation);
    return mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.32, g))
      * mix(mix(1.0, 0.58, smoothstep(0.0, 0.22, g)), 1.0, smoothstep(0.58, 0.94, c));
  }
  if (mode == 4) {
    GrowthArm arm = growthArm(i);
    float flight = growthFlight(i, arm, uFormation);
    float clingIdx = growthCling() / GROWTH_STEP;
    float behind = max(growthFront(arm, uFormation) - arm.slot, 0.0);
    float departTime = uFormationStartFieldTime
      + growthLaunch(i, arm) * uFormationDuration;
    return mix(fieldLife(id, departTime), 1.0, smoothstep(0.0, 0.5, flight))
      * (1.0
        + GROWTH_TIP_HEAT * flight * (1.0 - smoothstep(0.0, 2.0 * clingIdx, behind)));
  }
  if (mode == 5) {
    // Cold gas DIMS as it organises, then ignites. The dip bottoms at 58% at
    // g = 0.5 with zero slope at both ends; the flare is a tenth root at 0 (under
    // 1% until g = 0.63) with a double root at 1, so the settled mark is left at
    // plain opacity and neither end can pop.
    float g = localFormation(id, uFormation);
    float dip = sin(0.5 * TAU * clamp(g, 0.0, 1.0));
    return mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.32, g))
      * (1.0 - INSPIRAL_COOL * dip * dip)
      * (1.0 + INSPIRAL_FLASH * inspiralIgnition(g));
  }
  if (mode == 6) {
    float g = localFormation(id, uFormation);
    float cE = outflowCollapse(g);
    float ball = outflowBallistic(i, g);
    float base = mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.30, g));
    float cold = mix(0.58, 1.0, smoothstep(0.06, 0.62, cE));
    float jetGlow = 1.0 + OUT_JET_GLOW * ball * (0.30 + 0.70 * ball);
    // Ignition sweeping outward from the core. 4k^3(1-k) has a TRIPLE root at
    // k = 0 and returns to 0 at k = 1, so the settled logo is exactly 'base'.
    float rad01 = smoothstep(0.20, 1.35, length(LOGO_POINTS[i]) * uLogoScale);
    float k = smoothstep(mix(0.58, 0.78, rad01), mix(0.90, 1.00, rad01), g);
    float ignite = 1.0 + OUT_IGNITE * 4.0 * k * k * k * (1.0 - k);
    return base * cold * jetGlow * ignite;
  }
  if (mode == 7) {
    // 'local' here is the raw departure progress, NOT ignitionProgress — the
    // join fade must track the actual handoff.
    float ignLocal = localFormation(id, uFormation);
    float t = ignClock(uFormation);
    float join = mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.32, ignLocal));
    float cold = mix(1.0, IGN_COLD_DIM, smoothstep(0.0, 0.34, ignLocal));
    return join * (mix(cold, 1.0, t * t) + IGN_FLASH * ignFlare(t));
  }
  if (mode == 8) {
    float collapseLocal = localFormation(id, uFormation);
    float g = clamp(uFormation, 0.0, 1.0);
    float join = mix(
      fieldLife(id, formationDepartTime(id)),
      1.0,
      smoothstep(0.0, 0.34, collapseLocal)
    );
    // The infalling cloud COOLS to 30% on the way down. That decay is what buys
    // the flash its contrast: 0.33 -> 3.66 in ~80 ms.
    float cold = mix(1.0, COL_COLD_DIM, smoothstep(0.04, COL_BOUNCE - 0.09, g));
    float relit = mix(cold, 1.0,
      smoothstep(COL_BOUNCE - 0.075, COL_BOUNCE + 0.015, g));
    return join * relit * (1.0 + COL_FLASH * collapseFlash(g));
  }
  if (mode == 9) {
    float novaLocal = localFormation(id, uFormation);
    float k = novaShock(novaArrive(i, id), uFormation);
    float join = mix(
      fieldLife(id, formationDepartTime(id)),
      1.0,
      smoothstep(0.0, 0.30, novaLocal)
    );
    // The medium goes dark AHEAD of the front and is handed its light back once
    // shocked. 'chill' ramps from 1.0 so nothing pops at g == 0, and 'warm'
    // returns cold to exactly 1.0 by k == 0.60.
    float chill = smoothstep(0.0, 0.12, uFormation);
    float warm = smoothstep(0.0, 0.60, k);
    float cold = mix(1.0, NOVA_COLD, chill * (1.0 - warm));
    return join * cold * (1.0 + NOVA_FLASH * novaFront(k));
  }
  if (mode == 10) {
    float flareLocal = localFormation(id, uFormation);
    float g = clamp(uFormation, 0.0, 1.0);
    float snap = flareSnap(i);
    float k = flareClock(g, snap);
    float join = mix(
      fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.30, flareLocal)
    );
    // Stressed field: dims while the energy goes into the field, not the plasma.
    float stress = mix(1.0, FLR_DARK, smoothstep(0.05, snap * 0.86, g));
    // Hard X-ray impulse. step() makes this a genuine ONE-FRAME edge at the
    // tear — legal, and the whole point: lifeFade is a per-frame scalar and is
    // never sampled per trail segment, so it can be discontinuous where the
    // POSITION may not be.
    float hardX = FLR_HARD * exp(-k / FLR_HARD_TAU) * step(0.0000001, k);
    float soft = FLR_SOFT * 6.75 * k * (1.0 - k) * (1.0 - k);
    return join * (mix(stress, 1.0, k * k) + hardX + soft);
  }
  if (mode == 11) {
    float g = clamp(uFormation, 0.0, 1.0);
    float ltnLocal = localFormation(id, uFormation);
    float k = ltnHot(g);
    float a = ltnArcDepth(i);
    float cool = 1.0 - ltnEmerge(k);
    float join = mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.28, ltnLocal));
    // Corona: each particle twinkles on its own clock, so the cold channel reads
    // as ionisation noise rather than 128 uniformly dimmed comets.
    float twinkle = mix(0.45, 1.30, temporalNoise(float(i) * 13.77 + 2.91, uFieldTime * LTN_CORONA_RATE));
    float cold = mix(1.0, LTN_COLD_DIM * twinkle, smoothstep(0.0, 0.28, ltnLocal) * cool);
    // The stepped leader: a FAINT front walking DOWN the tree. Its only job is to
    // establish a direction that the return stroke then violates.
    float lq = (a - mix(-0.45, 1.90, smoothstep(0.02, ltnThreshold(), g))) / LTN_LEAD_WIDTH;
    float leader = 1.0 + LTN_LEAD_GLOW * exp(-lq * lq) * cool;
    // THE MOMENT: the same shape ripping the other way, tips -> strike point.
    float stroke = 1.0 + LTN_STRIKE * ltnWave(k, a);
    float darts = 1.0
      + LTN_DART_A * ltnPulse(g, LTN_RESTRIKE_A, 0.055)
      + LTN_DART_B * ltnPulse(g, LTN_RESTRIKE_B, 0.042);
    return join * cold * leader * stroke * darts;
  }
  if (mode == 12) {
    float g = clamp(uFormation, 0.0, 1.0);
    float x = recIonised(i, g);
    float t = 1.0 - x;
    float join = mix(
      fieldLife(id, formationDepartTime(id)),
      1.0,
      smoothstep(0.0, 0.30, localFormation(id, uFormation))
    );
    // While the parcel is opaque a single site is DIM: the slab's brightness is
    // the sum of overlapping additive halos, not any one particle. Once the fog
    // clears there is nothing left to sum, so the pinpoint must be at full
    // opacity — a jump in per-particle brightness at CONSTANT total flux, which
    // is what going transparent actually looks like.
    float veil = mix(1.0, REC_VEIL, x);
    float burst = REC_PIN_SHAPE * pow(t, 7.0) * (1.0 - t) * (1.0 - t);
    return join * veil * (1.0 + REC_FLASH * burst);
  }
  if (mode == 13) {
    // Supercooled melt is COLD and stays there while the undercooling deepens.
    // The front then dumps latent heat — recalescence — as a spike confined to
    // the interface, and the crystal behind it settles to plain logo opacity.
    float g = localFormation(id, uFormation);
    float phi = phzOrder(i, uFormation);
    float join = mix(fieldLife(id, formationDepartTime(id)), 1.0, smoothstep(0.0, 0.30, g));
    float cold = mix(1.0, PHZ_COLD_DIM, smoothstep(0.04, 0.30, g));
    return join * (mix(cold, 1.0, smoothstep(0.10, 0.80, phi)) + PHZ_RECAL * phzBand(phi));
  }
  if (mode == 14) {
    float fusLocal = localFormation(id, uFormation);
    float g = clamp(uFormation, 0.0, 1.0);
    float c = fusBurn(i, g);
    // Irradiation from the approaching front. THIS is what makes the cascade
    // read as contagion rather than 128 unrelated flashes.
    float preheat = exp(-max(fusIgniteAt(i) - g, 0.0) / FUS_PREHEAT);
    float join = mix(fieldLife(id, formationDepartTime(id)), 1.0,
                     smoothstep(0.0, 0.30, fusLocal));
    float cold = mix(1.0, FUS_COLD_DIM, smoothstep(0.0, 0.34, fusLocal));
    float lum = mix(cold, 1.0, max(preheat, fusEmerge(c)));
    return join * (lum + FUS_FLASH * fusFlare(c));
  }
  if (mode == 15) {
    // A quiet auroral arc sits near-invisible for the whole pre-onset phase. At
    // breakup the curtain comes up to full AND a surge tears along it. 'lit'
    // returns to exactly 1.0 at k == 1 and the surge has a double root there.
    float g = localFormation(id, uFormation);
    float k = aurClock(uFormation);
    float join = mix(fieldLife(id, formationDepartTime(id)), 1.0,
                     smoothstep(0.0, 0.32, g));
    float quiet = mix(1.0, AUR_QUIET_DIM, smoothstep(0.06, 0.30, g));
    float front = aurFront(LOGO_POINTS[i].x * uLogoScale, k);
    return join * mix(quiet, 1.0, k * k)
      * (1.0 + AUR_SURGE_GLOW * front * aurSurgeEnv(k));
  }
  return smoothstep(0.0, 0.32, local)
    * formationCrossFade(index, id, local);
}

// Formation progress at which this slot's fire blob starts its eruption clock.
float formationSolarStart(int index, float id) {
  int mode = formationMode();
  int i = clamp(index, 0, ${Z.length - 1});
  if (mode == 1) return scanEntryFormation(i);
  if (mode == 4) return growthLaunch(i, growthArm(i)) + GROWTH_APPROACH;
  // Every slot's fire blob starts its eruption clock at the ignition instant,
  // so the surface temperature colour erupts globally, once.
  if (mode == 7) return ignThreshold() + 0.015;
  if (mode == 8) return COL_BOUNCE + 0.012;
  if (mode == 9) return min(novaArrive(i, id) + 0.02, 0.95);
  if (mode == 10) return flareSnap(i) + 0.01;
  if (mode == 11) return ltnThreshold() + 0.012;
  if (mode == 12) return recThreshold() + 0.02;
  if (mode == 13) return phzArrival(i) + 0.01;
  if (mode == 14) return FUS_T_HALF - 0.03;
  if (mode == 15) {
    // The surface fire lights in the SAME travelling wave, so the colour
    // erupts with the surge rather than globally.
    float span = aurHalfSpan();
    float du = LOGO_POINTS[i].x * uLogoScale - AUR_ONSET_X * span;
    float kArrive = du < 0.0 ? -du / (AUR_SPEED_W * span)
                             : du / (AUR_SPEED_E * span);
    float h = aurThreshold();
    return h + clamp(kArrive, 0.0, 1.0) * (1.0 - h);
  }
  return formationOrder(id) * uFormationStagger + 0.16 * (1.0 - uFormationStagger);
}

// The 64 background comets never reach steeredHead, and they are the densest
// thing on screen — a front that does not disturb them has stray comets flying
// straight through it. This sweeps them with the same front, as a smooth
// displacement of the field position that is exactly zero before formation
// starts and after it ends.
vec2 formationFieldSweep(vec2 head, float time) {
  int mode = formationMode();
  if (mode == 0 || mode == 2) return vec2(0.0);
  float formation = historicalFormation(time, uFormation);
  float envelope = smoothstep(0.0, 0.06, formation)
    * (1.0 - smoothstep(0.94, 1.0, formation));
  if (uRejoining > 0.5) envelope *= 1.0 - smoothstep(0.0, 0.35, uRejoinProgress);
  if (envelope <= 0.0) return vec2(0.0);
  if (mode == 1) {
    vec2 axis = scanAxis();
    vec2 perp = vec2(-axis.y, axis.x);
    float lineU = scanLine(formation);
    float shockWidth = max(0.5 * scanWidth(), 0.0001);
    float q = (lineU - dot(head, axis)) / shockWidth;
    float amount = -2.33 * q * exp(-q * q) * SCAN_SHOCK * envelope;
    float splay = clamp(dot(head, perp) * 2.5, -1.0, 1.0);
    return axis * amount + perp * (amount * 0.4 * splay);
  }
  if (mode == 3) {
    // A continuous column coordinate, so nothing jumps when a comet drifts
    // across a column boundary: sin(u * TAU) attracts toward cell centres and
    // sin(u * PI) carries the parity alternation smoothly.
    float halfSpan = COLUMN_HALF_WIDTH * uLogoScale;
    float colWidth = 2.0 * halfSpan / COLUMN_COUNT;
    float u = (head.x + halfSpan) / max(colWidth, 0.00001);
    float order = clamp(u / max(COLUMN_COUNT - 1.0, 1.0), 0.0, 1.0);
    float stagger = columnStagger();
    float c = clamp((formation - order * stagger) / max(1.0 - stagger, 0.05), 0.0, 1.0);
    float bump = 16.0 * c * c * (1.0 - c) * (1.0 - c);
    float rule = smoothstep(0.0, COLUMN_RULE_SHARE, formation)
      * (1.0 - smoothstep(0.55, 0.95, formation));
    return vec2(
      sin(u * TAU) * colWidth * 0.16 * rule,
      sin(u * 0.5 * TAU) * columnGap() * 0.30 * bump
    ) * envelope;
  }
  if (mode == 5) {
    // The 64 background comets are dragged by the same differentially-rotating
    // flow, so all 192 particles read as ONE disc. A pure rotation is
    // length-preserving, so nothing is pushed into or out of the core, and the
    // 1/(0.36 + r^2) falloff is the same shear the logo comets obey.
    float swirlRadius = length(head);
    float bump = 16.0 * formation * formation
      * (1.0 - formation) * (1.0 - formation);
    float swirl = INSPIRAL_FIELD_SWIRL / (0.36 + swirlRadius * swirlRadius)
      * bump * envelope;
    return inspiralRotate(head, swirl) - head;
  }
  if (mode == 6) {
    // Blow the background comets along the same beams — this is what makes the
    // jets legible with only 128 logo particles.
    vec2 axis = outflowPolarAxis();
    float lateral = dot(head, outflowPlaneAxis());
    float q = dot(head, axis) / OUT_SWEEP_SCALE;
    // q*exp(-q^2/2)*sqrt(e) is odd and C-infinity, so a comet drifting across
    // the midplane is pushed smoothly through zero — never sign(), which is a
    // discontinuity exactly where the background is densest.
    float odd = q * exp(-0.5 * q * q) * 1.64872;
    float beam = exp(-(lateral * lateral) / (OUT_SWEEP_BEAM * OUT_SWEEP_BEAM));
    float pulse = 16.0 * formation * formation
      * (1.0 - formation) * (1.0 - formation);
    return axis * (odd * OUT_SWEEP * beam * pulse) * envelope;
  }
  if (mode == 7) {
    // The background squeezes gently inward through the quiet phase, then an
    // expanding shock ring shoves it outward at the flash.
    float t = ignClock(formation);
    float radius = length(head);
    vec2 outward = head / max(radius, 0.0001);
    float q = (radius - mix(0.10, 2.40, t)) / 0.42;
    float ring = exp(-q * q);
    float squeeze = IGN_SQUEEZE
      * smoothstep(0.04, ignThreshold(), formation) * (1.0 - t);
    return outward * (IGN_SHOCK * ignFlare(t) * ring - squeeze) * envelope;
  }
  if (mode == 8) {
    vec2 core = collapseCore();
    vec2 rel = head - core;
    float radius = length(rel);
    vec2 outward = rel / max(radius, 0.0001);
    float pull = COL_FIELD_PULL
      * smoothstep(0.02, COL_BOUNCE - 0.04, formation)
      * (1.0 - smoothstep(COL_BOUNCE - 0.04, COL_BOUNCE + 0.08, formation));
    float s = clamp((formation - COL_BOUNCE) / (1.0 - COL_BOUNCE), 0.0, 1.0);
    float ringRadius = COL_RING_REACH * (1.0 - (1.0 - s) * (1.0 - s));
    float q = (radius - ringRadius) / COL_RING_WIDTH;
    float lobe = 1.0 + COL_LOBE * collapseChaos()
      * cos(atan(rel.y, rel.x + 1.0e-6) - collapseBlastAngle());
    float ring = exp(-q * q) * 16.0 * s * s * (1.0 - s) * (1.0 - s);
    return outward
      * (COL_FIELD_SHOCK * collapseBlast() * lobe * ring - pull) * envelope;
  }
  if (mode == 9) {
    vec2 o = novaOrigin();
    vec2 rel = head - o;
    float d = length(rel);
    // A gaussian ram bulge riding the front. exp(-q*q) is C-infinity, so a comet
    // drifting through the band is pushed smoothly in and back out.
    float q = (d - novaShellRadius(formation)) / NOVA_SWEEP_W;
    return rel / max(d, 0.0001) * (NOVA_SWEEP * exp(-q * q) * envelope);
  }
  if (mode == 10) {
    vec2 up = flareUpAxis();
    vec2 along = flareAlongAxis();
    float k = flareClock(formation, FLR_SNAP);
    float u = dot(head, up) - flareSheetY();
    float band = exp(-(u * u) / (0.55 * 0.55));
    float spike = 6.75 * k * (1.0 - k) * (1.0 - k);
    // odd in u, so a comet drifting across the sheet is pushed smoothly through
    // zero — never sign(), which is a discontinuity exactly where the background
    // is densest.
    float pinch = -0.13 * (u / 0.55) * band
      * smoothstep(0.03, FLR_SNAP, formation) * (1.0 - k);
    float outward = 0.16 * dot(head, along) * band * spike;
    float lift = 0.22 * spike * smoothstep(-0.10, 0.60, u);
    return (up * (pinch + lift) + along * outward) * envelope;
  }
  if (mode == 11) {
    vec2 perp = ltnCross();
    float lateral = dot(head, perp);
    float k = ltnHot(formation);
    float comb = -lateral
      * exp(-(lateral * lateral) / (LTN_COMB_WIDTH * LTN_COMB_WIDTH))
      * LTN_COMB * smoothstep(0.02, 0.55, formation) * (1.0 - ltnEmerge(k));
    float radius = length(head);
    vec2 outward = head / max(radius, 0.0001);
    float q = (radius - mix(0.05, 2.60, k)) / 0.38;
    return (perp * comb + outward * (LTN_BLAST * ltnBump(k / 0.60) * exp(-q * q))) * envelope;
  }
  if (mode == 12) {
    // The 64 background comets ARE the medium. They are drawn into the fog while
    // it is opaque, then the trapped radiation escapes and drives them outward on
    // the exact frame the mark appears — the mark condenses inward while the
    // medium blows outward.
    float x = recSigmoid(formation, recThreshold());
    float t = 1.0 - x;
    float impulse = REC_PIN_SHAPE * pow(t, 7.0) * (1.0 - t) * (1.0 - t);
    float radius = length(head);
    vec2 outward = head / max(radius, 0.0001);
    float q = (radius - mix(0.15, 2.60, t)) / REC_SHOCK_WIDTH;
    return outward
      * (REC_SHOCK * impulse * exp(-q * q)
         - REC_SWALLOW * x * (1.0 - exp(-radius)))
      * envelope;
  }
  if (mode == 13) {
    // A thin dendritic shock ring expanding from the nucleus, preceded by a
    // gentle inward squeeze while the melt supercools. This is what makes the
    // front read across the whole canvas with only 128 logo particles.
    vec2 d = head - phzNucleus();
    float dist = length(d);
    vec2 outward = d / max(dist, 0.0001);
    float ang = atan(d.y, d.x + 1.0e-6);
    float t = clamp(
      (formation - phzNucleation()) / max(PHZ_FRONT_SPAN, 0.02),
      0.0,
      3.0
    );
    float radius = t * phzLobeSpeed(ang) * PHZ_REACH * max(uLogoScale, 0.35);
    float q = (dist - radius) / PHZ_RING;
    float ring = exp(-q * q) * (1.0 - smoothstep(1.0, 2.6, t));
    float squeeze = PHZ_SQUEEZE
      * smoothstep(0.04, phzNucleation(), formation)
      * (1.0 - smoothstep(0.0, 0.5, t));
    return outward * (PHZ_SHOCK * ring - squeeze) * envelope;
  }
  if (mode == 14) {
    float g = clamp(formation, 0.0, 1.0);
    float burnt = 1.0 / (1.0 + exp(-FUS_K * fusGain() * (g - FUS_T_HALF)));
    // Front radius inverts the same quantile law the logo particles obey, so the
    // ring ACCELERATES out of the core and then stalls.
    float front = FUS_REACH * pow(burnt, 1.0 / FUS_DIM) * 2.6;
    float radius = length(head);
    vec2 outward = head / max(radius, 0.0001);
    float q = (radius - front) / 0.40;
    float ring = exp(-q * q);
    float pull = FUS_INFALL_PULL * smoothstep(0.02, FUS_T_HALF, g) * (1.0 - burnt);
    return outward * (FUS_SHOCK * ring * 4.0 * burnt * (1.0 - burnt) - pull) * envelope;
  }
  if (mode == 15) {
    // Comb the background comets toward the ribbon through the quiet phase, so
    // all 192 particles read as ONE magnetosphere feeding ONE oval, then blow
    // them off it with the surge.
    float k = aurClock(formation);
    float comb = AUR_BG_COMB
      * smoothstep(0.04, aurThreshold(), formation) * (1.0 - k);
    float q = head.y / AUR_BG_BEAM;
    float odd = q * exp(-0.5 * q * q) * 1.64872;
    float kick = AUR_BG_KICK * odd * aurFront(head.x, k) * aurSurgeEnv(k);
    return vec2(0.0, kick - head.y * comb) * envelope;
  }
  vec2 push = growthTipPush(
      head, growthArmOf(0, GROWTH_SPLIT, GROWTH_SWOOSH_SEED, 1.0), GROWTH_SWOOSH_ARM, formation
    )
    + growthTipPush(
      head, growthArmOf(0, GROWTH_SPLIT, GROWTH_SWOOSH_SEED, -1.0), GROWTH_SWOOSH_ARM, formation
    )
    + growthTipPush(
      head,
      growthArmOf(GROWTH_SPLIT, GROWTH_CLOUD_COUNT, GROWTH_CLOUD_SEED, 1.0),
      GROWTH_CLOUD_ARM,
      formation
    )
    + growthTipPush(
      head,
      growthArmOf(GROWTH_SPLIT, GROWTH_CLOUD_COUNT, GROWTH_CLOUD_SEED, -1.0),
      GROWTH_CLOUD_ARM,
      formation
    );
  return push * envelope;
}

vec2 steeredHead(int index, float id, float time, float formation, out float radiusPx) {
  int mode = formationMode();
  if (mode == 1) return scanlineHead(index, id, time, formation, radiusPx);
  if (mode == 2) return shatterHead(index, id, time, formation, radiusPx);
  if (mode == 3) return columnsHead(index, id, time, formation, radiusPx);
  if (mode == 4) return growthHead(index, id, time, formation, radiusPx);
  if (mode == 5) return inspiralHead(index, id, time, formation, radiusPx);
  if (mode == 6) return outflowHead(index, id, time, formation, radiusPx);
  if (mode == 7) return ignitionHead(index, id, time, formation, radiusPx);
  if (mode == 8) return collapseHead(index, id, time, formation, radiusPx);
  if (mode == 9) return novaHead(index, id, time, formation, radiusPx);
  if (mode == 10) return flareHead(index, id, time, formation, radiusPx);
  if (mode == 11) return lightningHead(index, id, time, formation, radiusPx);
  if (mode == 12) return plasmaHead(index, id, time, formation, radiusPx);
  if (mode == 13) return phasechangeHead(index, id, time, formation, radiusPx);
  if (mode == 14) return fusionHead(index, id, time, formation, radiusPx);
  if (mode == 15) return auroraHead(index, id, time, formation, radiusPx);

  vec2 freeHead;
  vec2 freeVelocity;
  fieldPoint(id, time, freeHead, radiusPx, freeVelocity);
  float local = localFormation(id, formation);
  if (local <= 0.0) return freeHead;

  vec2 departHead;
  vec2 departVelocity;
  float departRadiusPx;
  fieldPoint(id, formationDepartTime(id), departHead, departRadiusPx, departVelocity);
  radiusPx = departRadiusPx;

  vec2 target = logoAnchor(index) * uLogoScale;
  if (uFormationMaxTravel > 0.0
    && uFormationSpawnRadius <= 0.0
    && length(target - departHead) > uFormationMaxTravel) {
    vec2 entryDir = normalize(departHead - target);
    float halfWidth = uResolution.x / max(uResolution.y, 1.0);
    float edge = min(
      halfWidth / max(abs(entryDir.x), 0.0001),
      1.0 / max(abs(entryDir.y), 0.0001)
    );
    departHead = target + entryDir * (uFormationMaxTravel * min(edge, 1.0));
    departVelocity = -entryDir * max(length(departVelocity), 0.25);
  }
  vec2 toTarget = target - departHead;
  float span = max(length(toTarget), 0.00001);
  float travel = formationTravelTime();

  float departSpeed = length(departVelocity);
  vec2 launchDirection = departVelocity / max(departSpeed, 0.00001);
  vec2 startTangent = launchDirection
    * min(departSpeed * travel, span * mix(0.62, 0.03, clamp(uFormationDirectness, 0.0, 1.0)));

  vec2 approach = toTarget / span;
  vec2 approachNormal = vec2(-approach.y, approach.x);
  vec2 endTangent = normalize(
    approach
      + approachNormal * mix(-0.62, 0.62, hash11(id * 27.53))
        * (1.0 - clamp(uFormationDirectness, 0.0, 1.0))
  ) * span * 0.58;

  float livingBlend = smoothstep(0.08, 0.72, local);
  if (uFormationMaxTravel > 0.0 && uFormationSpawnRadius > 0.0
    && span > uFormationMaxTravel) {
    float seed = float(index);
    if (localFormation(id, uFormation) < 0.34) return freeHead;
    vec2 spawnDir = vec2(
      hash11(seed * 3.31) * 2.0 - 1.0,
      hash11(seed * 5.77) * 2.0 - 1.0
    );
    vec2 origin = target
      + spawnDir / max(length(spawnDir), 0.0001)
        * mix(0.55, 1.0, hash11(seed * 7.13))
        * uFormationSpawnRadius;
    float slide = formationTravelEase(clamp((local - 0.34) / 0.66, 0.0, 1.0), id);
    return mix(origin, target, slide)
      + livingLogoOffset(index, id, time) * livingBlend;
  }
  float ease = formationTravelEase(local, id);
  vec2 curved = cubicHermite(departHead, startTangent, target, endTangent, ease)
    + trajectoryBow(id, approach, span, ease)
    + formationSettleWiggle(id, local, approach, span);
  return curved + livingLogoOffset(index, id, time) * livingBlend;
}

// Each comet picks the return trip whose travel speed most closely matches the
// field speed it will have on arrival, so it never has to brake to a halt.
float rejoinDurationFor(float id, vec2 start) {
  float bestDuration = uRejoinDuration;
  float bestCost = 1000000.0;
  for (int candidate = 0; candidate < REJOIN_CANDIDATE_COUNT; candidate++) {
    float duration = max(REJOIN_CANDIDATES[candidate] * uRejoinDuration, 0.05);
    vec2 head;
    float headRadiusPx;
    vec2 velocity;
    fieldPoint(id, uRejoinStartFieldTime + duration, head, headRadiusPx, velocity);
    float travelSpeed = distance(head, start) / duration;
    float arrivalSpeed = length(velocity);
    float cost = abs(log(max(travelSpeed, 0.000001) / max(arrivalSpeed, 0.000001)));
    if (cost < bestCost) {
      bestCost = cost;
      bestDuration = duration;
    }
  }
  return bestDuration;
}

float rejoinTravelSpan(int index, float id) {
  vec2 anchor = logoAnchor(index) * uLogoScale;
  float duration = rejoinDurationFor(id, anchor);
  vec2 target;
  float targetRadiusPx;
  vec2 targetVelocity;
  fieldPoint(id, uRejoinStartFieldTime + duration, target, targetRadiusPx, targetVelocity);
  return length(target - anchor);
}

float rejoinStagger(float id, float progress) {
  float delay = hash11(id * 91.37) * 0.14;
  return clamp((progress - delay) / max(1.0 - delay, 0.001), 0.0, 1.0);
}

float rejoinPopEase(float t, float id) {
  float progress = clamp(t, 0.0, 1.0);
  float decay = mix(3.2, 9.5, hash11(id * 27.91));
  return (1.0 - exp(-decay * progress)) / (1.0 - exp(-decay));
}

float rejoinCrossFade(int index, float id, float progress) {
  if (uFormationSpawnRadius <= 0.0) {
    return 1.0 - smoothstep(0.0, 0.5, rejoinStagger(id, progress));
  }
  if (uFormationMaxTravel <= 0.0) return 1.0;
  if (rejoinTravelSpan(index, id) <= uFormationMaxTravel) return 1.0;
  if (uFormationSpawnRadius > 0.0) return min(
    smoothstep(0.62, 0.42, progress) + smoothstep(0.66, 0.86, progress),
    1.0
  );
  return min(
    smoothstep(0.3, 0.02, progress) + smoothstep(0.6, 0.86, progress),
    1.0
  );
}

vec2 rejoinHead(int index, float id, float elapsed, out float radiusPx, out bool freeField) {
  float startFieldRadiusPx;
  vec2 start = steeredHead(
    index,
    id,
    uRejoinStartFieldTime,
    uRejoinStartFormation,
    startFieldRadiusPx
  );
  float rejoinDuration = rejoinDurationFor(id, start);
  if (elapsed >= rejoinDuration) {
    vec2 head;
    vec2 velocity;
    fieldPoint(id, uRejoinStartFieldTime + elapsed, head, radiusPx, velocity);
    freeField = true;
    return head;
  }
  freeField = false;
  float progress = clamp(elapsed / rejoinDuration, 0.0, 1.0);
  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  float startRadiusPx = mix(
    startFieldRadiusPx,
    logoRadiusPx,
    formationTravelEase(formationProgress(index, id, uRejoinStartFormation), id)
  );

  vec2 target;
  float targetRadiusPx;
  vec2 targetVelocity;
  fieldPoint(id, uRejoinStartFieldTime + rejoinDuration, target, targetRadiusPx, targetVelocity);

  vec2 toTarget = target - start;
  float span = max(length(toTarget), 0.00001);

  vec2 anchor = logoAnchor(index) * uLogoScale;
  vec2 outward = anchor / max(length(anchor), 0.00001);
  vec2 sideways = vec2(-outward.y, outward.x);
  vec2 launchDirection = normalize(
    outward + sideways * mix(-0.92, 0.92, hash11(id * 33.17))
  );
  vec2 startTangent = launchDirection * span * mix(0.48, 0.86, hash11(id * 51.71));

  vec2 endTangent = targetVelocity * rejoinDuration;

  // rejoinTravelEase has e'(1)=1 and e''(1)=-2, so matching the field's
  // acceleration through the chain rule needs a1 = aField*T² + 2*velocity*T.
  vec2 endAcceleration =
    fieldAcceleration(id, uRejoinStartFieldTime + rejoinDuration) * rejoinDuration * rejoinDuration
    + targetVelocity * (2.0 * rejoinDuration);
  // Field acceleration goes as 1/z³, so a comet returning to a near-plane slot
  // would otherwise get an end curvature large enough to whip the path around.
  float endAccelerationLimit = span * 8.0;
  float endAccelerationLength = length(endAcceleration);
  if (endAccelerationLength > endAccelerationLimit) {
    endAcceleration *= endAccelerationLimit / max(endAccelerationLength, 0.00001);
  }

  radiusPx = mix(startRadiusPx, targetRadiusPx, progress);
  if (uFormationSpawnRadius <= 0.0) {
    vec2 outward = start / max(length(start), 0.00001);
    vec2 scatter = vec2(
      hash11(id * 12.91) * 2.0 - 1.0,
      hash11(id * 27.13) * 2.0 - 1.0
    );
    vec2 throwDir = normalize(outward + scatter * 0.9);
    float throwSpan = mix(1.0, 2.4, hash11(id * 41.37));
    return start
      + throwDir
        * (rejoinPopEase(rejoinStagger(id, uRejoinProgress), id) * throwSpan);
  }
  if (uFormationMaxTravel > 0.0
    && rejoinTravelSpan(index, id) > uFormationMaxTravel) {
    if (uRejoinProgress >= 0.72) return target;
    float seed = float(index);
    vec2 awayDir = vec2(
      hash11(seed * 3.31) * 2.0 - 1.0,
      hash11(seed * 5.77) * 2.0 - 1.0
    );
    vec2 away = start
      + awayDir / max(length(awayDir), 0.0001)
        * mix(0.55, 1.0, hash11(seed * 7.13))
        * uFormationSpawnRadius;
    return mix(start, away, clamp(uRejoinProgress / 0.72, 0.0, 1.0));
  }
  float ease = rejoinTravelEase(progress);
  return quinticHermite(start, startTangent, vec2(0.0), target, endTangent, endAcceleration, ease)
    + trajectoryBow(id, toTarget / span, span, ease);
}

vec2 sampleRejoinPath(int index, float id, float age, out float radiusPx, out bool freeField) {
  float sampleElapsed = uRejoinElapsed - age;
  if (sampleElapsed >= 0.0) {
    return rejoinHead(index, id, sampleElapsed, radiusPx, freeField);
  }

  float formation = historicalFormation(
    uRejoinStartFieldTime + sampleElapsed,
    uRejoinStartFormation
  );
  freeField = formationEngaged(index, id, formation) <= 0.0;
  return steeredHead(
    index,
    id,
    uRejoinStartFieldTime + sampleElapsed,
    formation,
    radiusPx
  );
}

// freeField reports whether this sample sits on the live starfield path, so the
// trail-cut guard can tell a real depth recycle from steered or frozen motion.
vec2 sampleParticlePath(
  int index,
  float id,
  float sparkId,
  bool logoParticle,
  bool sparkParticle,
  float age,
  out float radiusPx,
  out bool freeField
) {
  freeField = false;
  if (sparkParticle) return sparkHead(sparkId, uFieldTime - age, radiusPx);
  if (!logoParticle) {
    vec2 head;
    vec2 velocity;
    float sampleTime = uFieldTime - age;
    fieldPoint(id, sampleTime, head, radiusPx, velocity);
    freeField = true;
    return head + formationFieldSweep(head, sampleTime);
  }
  if (uRejoining > 0.5) return sampleRejoinPath(index, id, age, radiusPx, freeField);
  float formation = historicalFormation(uFieldTime - age, uFormation);
  freeField = formationEngaged(index, id, formation) <= 0.0;
  return steeredHead(index, id, uFieldTime - age, formation, radiusPx);
}

void main() {
  int index = gl_InstanceID;
  int extraLogoIndex = index - ${zs};
  bool extraLogo = extraLogoIndex >= 0;
  if (extraLogo) {
    index = extraLogoIndex % ${Z.length};
    gLogoBlend = hash11(float(gl_InstanceID) * 3.71 + 5.3);
  }
  bool logoParticle = extraLogo;
  bool sparkParticle = !extraLogo && index >= ${Rs};
  float id = float(gl_InstanceID) + SEED * 17.173;
  float sourceParticleOpacity = logoParticle || sparkParticle || index < ${Z.length} ? 1.0 : 0.72;
  bool pairedLogoCandidate = false;
  if (pairedLogoCandidate) {
    int pairIndex = logoParticle
      ? index
      : index - ${Z.length};
    float logoSourceId = float(pairIndex) + SEED * 17.173;
    float backgroundSourceId = float(pairIndex + ${Z.length}) + SEED * 17.173;
    vec2 logoSourceHead;
    float logoSourceRadiusPx;
    vec2 logoSourceVelocity;
    fieldPoint(
      logoSourceId,
      uFormationStartFieldTime,
      logoSourceHead,
      logoSourceRadiusPx,
      logoSourceVelocity
    );
    vec2 backgroundSourceHead;
    float backgroundSourceRadiusPx;
    vec2 backgroundSourceVelocity;
    fieldPoint(
      backgroundSourceId,
      uFormationStartFieldTime,
      backgroundSourceHead,
      backgroundSourceRadiusPx,
      backgroundSourceVelocity
    );
    float logoSourceScore = length(logoSourceHead)
      + mix(-0.12, 0.12, hash11(logoSourceId * 13.71));
    float backgroundSourceScore = length(backgroundSourceHead)
      + mix(-0.12, 0.12, hash11(backgroundSourceId * 13.71));
    bool preferBackgroundSource = backgroundSourceScore < logoSourceScore;
    if (logoParticle) {
      id = preferBackgroundSource ? backgroundSourceId : logoSourceId;
      sourceParticleOpacity = preferBackgroundSource ? 0.72 : 1.0;
    } else {
      id = preferBackgroundSource ? logoSourceId : backgroundSourceId;
      sourceParticleOpacity = preferBackgroundSource ? 1.0 : 0.72;
    }
  }
  float sparkId = float(max(index - ${Rs}, 0));
  float currentSparkKind = sparkKind(sparkId, uFieldTime);
  float currentLocalFormation = logoParticle
    ? formationProgress(index, id, uFormation)
    : 0.0;
  float logoTrailBlend = 0.0;
  if (logoParticle) {
    logoTrailBlend = uRejoining > 0.5
      ? 1.0
      : 1.0 - smoothstep(0.92, 1.0, uFormation);
  }
  float trailTime = mix(
    FIELD_TRAIL_SAMPLE_TIME * uFieldTrailLength,
    LOGO_TRAIL_SAMPLE_TIME * uLogoTrailLength,
    logoTrailBlend
  );
  if (logoParticle) {
    trailTime = min(
      trailTime,
      uRejoining > 0.5
        ? max(uRejoinElapsed, 0.0)
        : max(uFieldTime - formationDepartTime(id), 0.0)
    );
  }
  if (sparkParticle) {
    trailTime = (currentSparkKind < 0.5
      ? NEEDLE_TRAIL_SAMPLE_TIME
      : currentSparkKind < 1.5
        ? BURST_TRAIL_SAMPLE_TIME
        : WAVE_TRAIL_SAMPLE_TIME) * uSparkTrailLength;
  } else {
    // Cap the trail by how fast this comet is actually travelling along its own
    // path — the field velocity alone misses steered formation/release motion,
    // which is where the runaway streaks came from.
    float probeRadiusNow;
    float probeRadiusThen;
    bool probeFreeNow;
    bool probeFreeThen;
    vec2 probeNow = sampleParticlePath(
      index, id, sparkId, logoParticle, sparkParticle, 0.0, probeRadiusNow, probeFreeNow
    );
    vec2 probeThen = sampleParticlePath(
      index, id, sparkId, logoParticle, sparkParticle, trailTime, probeRadiusThen, probeFreeThen
    );
    bool probeRecycled = probeFreeNow
      && probeFreeThen
      && fieldCycleIndex(id, uFieldTime) != fieldCycleIndex(id, uFieldTime - trailTime);
    float maxTrailWorld = logoParticle
      ? LOGO_MAX_TRAIL_WORLD
      : MAX_TRAIL_WORLD * uFieldTrailLength;
    if (!probeRecycled) {
      for (int pass = 0; pass < 5; pass++) {
        float drawnTrailWorld = distance(probeNow, probeThen);
        if (drawnTrailWorld <= maxTrailWorld) break;
        trailTime *= 0.85 * maxTrailWorld / drawnTrailWorld;
        probeThen = sampleParticlePath(
          index, id, sparkId, logoParticle, sparkParticle, trailTime, probeRadiusThen, probeFreeThen
        );
      }
    }
  }

  int segmentIndex = gl_VertexID / 6;
  int cornerIndex = gl_VertexID - segmentIndex * 6;
  float segmentStart = float(segmentIndex) / float(TRAIL_SEGMENT_COUNT);
  float segmentEnd = float(segmentIndex + 1) / float(TRAIL_SEGMENT_COUNT);
  float olderAge = trailTime * (1.0 - segmentStart);
  float newerAge = trailTime * (1.0 - segmentEnd);
  float olderRadiusPx;
  float newerRadiusPx;
  bool tailOnFreeField;
  bool headOnFreeField;
  vec2 tail = sampleParticlePath(
    index,
    id,
    sparkId,
    logoParticle,
    sparkParticle,
    olderAge,
    olderRadiusPx,
    tailOnFreeField
  );
  vec2 head = sampleParticlePath(
    index,
    id,
    sparkId,
    logoParticle,
    sparkParticle,
    newerAge,
    newerRadiusPx,
    headOnFreeField
  );
  float tailSampleTime = uFieldTime - olderAge;
  float headSampleTime = uFieldTime - newerAge;
  bool fieldRecycled = tailOnFreeField
    && headOnFreeField
    && fieldCycleIndex(id, tailSampleTime) != fieldCycleIndex(id, headSampleTime);
  if (fieldRecycled) tail = head;
  if (
    sparkParticle
    && sparkCyclePhase(sparkId, uFieldTime - olderAge) > sparkCyclePhase(sparkId, uFieldTime - newerAge)
  ) {
    tail = head;
  }

  float logoRadiusPx = max(LOGO_RADIUS_MIN_PX, uResolution.y * LOGO_RADIUS_SCALE) * uLogoParticleSize;
  // Growth's progress saturates at 0.5 while a particle is riding the front, so
  // it wants a plain smoothstep rather than the direct-flight travel ease.
  // Mode 5 keeps its small field radius through the whole diffuse phase and only
  // swells in the last ~20%. Mode 7 pins its own progress low through the quiet
  // phase, so it wants a plain smoothstep like growth does. Mode 6 keeps the
  // direct-flight ease — note that both 6 and 7 already write a final radius in
  // steeredHead (jet shrink / ignition swell) and this mix pulls part of it back
  // toward logoRadiusPx; their swell constants are tuned against that.
  int radiusEaseMode = formationMode();
  float radiusEase = radiusEaseMode == 12
    ? 0.0
    : (
      radiusEaseMode == 4 || radiusEaseMode == 7 || radiusEaseMode == 9
      || radiusEaseMode == 10 || radiusEaseMode == 11 || radiusEaseMode == 13
      || radiusEaseMode == 14 || radiusEaseMode == 15
    )
    ? smoothstep(0.0, 1.0, currentLocalFormation)
    : radiusEaseMode == 5
      ? currentLocalFormation * currentLocalFormation * currentLocalFormation
      : formationTravelEase(currentLocalFormation, id);
  float radiusPx = !logoParticle || uRejoining > 0.5
    ? newerRadiusPx
    : mix(
      newerRadiusPx,
      logoRadiusPx,
      radiusEase
    );
  float densityOpacity = 1.0;
  float particleOpacity = logoParticle ? 1.0 : sparkParticle ? 1.0 : 0.72;
  if (!sparkParticle) {
    float roleOpacityBlend = logoParticle
      ? formationRoleBlend(index, id)
      : smoothstep(0.0, 0.18, uFormation);
    if (uRejoining > 0.5) {
      roleOpacityBlend *= 1.0 - smoothstep(0.55, 0.95, uRejoinProgress);
    }
    particleOpacity = mix(
      sourceParticleOpacity,
      particleOpacity,
      roleOpacityBlend
    );
  }
  float lifeFade = 1.0;
  if (!sparkParticle) {
    if (logoParticle && uRejoining > 0.5) {
      lifeFade = mix(
        1.0,
        fieldLife(id, uFieldTime),
        smoothstep(0.55, 1.0, uRejoinProgress)
      ) * rejoinCrossFade(index, id, uRejoinProgress);
    } else if (logoParticle && formationEngaged(index, id, uFormation) > 0.0) {
      lifeFade = formationLifeFade(index, id, currentLocalFormation);
    } else if (logoParticle) {
      lifeFade = 0.0;
    } else {
      lifeFade = fieldLife(id, uFieldTime);
    }
  }
  float shimmerId = sparkParticle ? sparkId : id;
  float opacity = (0.88 + 0.12 * sin(uFieldTime * 2.0 + shimmerId))
    * particleOpacity
    * densityOpacity
    * lifeFade;
  if (sparkParticle) opacity *= sparkOpacity(sparkId, uFieldTime - newerAge);
  float flicker = pow(0.5 + 0.5 * sin(uFieldTime * 23.0 + sparkId * 1.73), 4.0);
  float sparkFlicker = sparkParticle ? 0.92 + flicker * 0.24 : 1.0;
  float eventMember = mod(max(sparkId - EVENT_SPARK_START, 0.0), EVENT_GROUP_SIZE);
  bool surfaceEffect = sparkParticle
    && sparkId >= EVENT_SPARK_START
    && currentSparkKind > 0.5
    && eventMember < 0.5;
  bool outerSolarContourPoint = (
    index <= 20
    || (index >= 36 && index <= 46)
    || index >= 79
  )
    && index % 2 == 0;
  bool centerSolarContourPoint = (
    (index >= 21 && index <= 35)
    || (index >= 47 && index <= 78)
  )
    && index % 3 == 0;
  bool solarContourPoint = logoParticle
    && (
      outerSolarContourPoint
      || centerSolarContourPoint
    );
  bool solarSurface = solarContourPoint
    && segmentIndex == 0
    && currentLocalFormation > 0.16
    && (uRejoining < 0.5 || uRejoinProgress < 0.34);

  if (solarSurface) {
    float solarCenterRadiusPx;
    bool solarCenterOnFreeField;
    vec2 solarCenter = sampleParticlePath(
      index,
      id,
      sparkId,
      logoParticle,
      sparkParticle,
      0.0,
      solarCenterRadiusPx,
      solarCenterOnFreeField
    );
    vec2 solarTarget = LOGO_POINTS[index] * uLogoScale;
    vec2 solarOutward = solarTarget / max(length(solarTarget), 0.00001);
    float solarSeed = hash11(id * 11.73 + 4.9);
    float solarStartProgress = formationSolarStart(index, id);
    float solarStartTime = uFormationStartFieldTime
      + solarStartProgress * uFormationDuration;
    float solarAge = max(0.0, uFieldTime - solarStartTime);
    float eruptionDuration = mix(4.8, 8.6, hash11(id * 23.17 + 6.3)) / uEruptionCycleSpeed;
    float eruptionDelay = mix(0.45, 3.6, solarSeed);
    float eruptionCycle = max(0.0, solarAge - eruptionDelay) / eruptionDuration;
    float eruptionIndex = floor(eruptionCycle);
    float eruptionPhase = fract(eruptionCycle);
    float eruptionChance = step(
      1.0 - uEruptionFrequency,
      hash11(id * 31.71 + eruptionIndex * 17.13)
    );
    float eruptionEnvelope = smoothstep(0.0, 0.16, eruptionPhase)
      * (1.0 - smoothstep(0.42, 0.96, eruptionPhase))
      * eruptionChance
      * smoothstep(0.82, 1.0, currentLocalFormation);
    float eruptionVariant = hash11(id * 43.11 + eruptionIndex * 29.7);
    float weatherTime = solarAge
      * uWeatherSpeed
      / mix(3.8, 7.2, hash11(id * 37.13 + 9.7))
      + solarSeed * 3.0;
    float weatherScale = temporalNoise(id * 29.41 + 3.6, weatherTime);
    float solarGrowth = smoothstep(0.16, 0.88, currentLocalFormation);
    float solarGrowthScale = mix(0.08, 1.0, solarGrowth);
    float solarRadiusPx = uResolution.y
      * 0.108
      * uFireScale
      * solarGrowthScale
      * mix(1.0 - 0.26 * uWeatherVariation, 1.0 + 0.26 * uWeatherVariation, weatherScale);
    float solarPaddingPx = solarRadiusPx
      * mix(1.45, 2.75 * uEruptionScale, eruptionEnvelope)
      + 4.0;
    vec2 corner = QUAD[cornerIndex];
    vec2 localPx = vec2(corner.x * 2.0 - 1.0, corner.y) * solarPaddingPx;
    vec2 solarCenterPx = solarCenter * (0.5 * uResolution.y) + 0.5 * uResolution;
    vec2 positionPx = solarCenterPx + localPx;
    vec2 clip = positionPx / uResolution * 2.0 - 1.0;
    float solarVisibility = smoothstep(0.16, 0.78, currentLocalFormation);
    if (uRejoining > 0.5) {
      solarVisibility *= 1.0 - smoothstep(0.0, 0.32, uRejoinProgress);
    }

    gl_Position = vec4(clip, 0.0, 1.0);
    vLocalPx = localPx;
    vLengthPx = 0.0;
    vRadiusPx = 0.0;
    vOpacity = opacity * solarVisibility;
    vTrailProgressStart = eruptionVariant;
    vIsHead = 0.0;
    vIsSpark = 0.0;
    vSparkKind = eruptionPhase;
    vSparkFlicker = eruptionEnvelope;
    vIsSurfaceEffect = 2.0;
    vEffectProgress = solarAge * uFireSpeed * mix(0.38, 0.66, solarSeed)
      + solarSeed;
    vEffectOutward = solarOutward;
    vEffectRadiusPx = solarRadiusPx;
    vEffectSeed = solarSeed;
    return;
  }

  if (surfaceEffect) {
    int effectAnchorIndex = sparkAnchorIndex(sparkId, uFieldTime);
    vec2 effectCenter = SPARK_ANCHOR_POINTS[effectAnchorIndex] * uLogoScale;
    vec2 effectOutward = effectCenter / max(length(effectCenter), 0.00001);
    float effectProgress = clamp(
      sparkCyclePhase(sparkId, uFieldTime) / sparkActiveShare(currentSparkKind),
      0.0,
      1.0
    );
    float effectSize = sparkSizeScale(sparkId, uFieldTime);
    float effectRadiusPx = uResolution.y
      * (currentSparkKind < 1.5 ? 0.055 : 0.11)
      * effectSize;
    float effectPaddingPx = effectRadiusPx + 4.0;
    vec2 corner = QUAD[cornerIndex];
    vec2 localPx = vec2(corner.x * 2.0 - 1.0, corner.y) * effectPaddingPx;
    vec2 effectCenterPx = effectCenter * (0.5 * uResolution.y) + 0.5 * uResolution;
    vec2 positionPx = effectCenterPx + localPx;
    vec2 clip = positionPx / uResolution * 2.0 - 1.0;

    gl_Position = vec4(clip, 0.0, 1.0);
    vLocalPx = localPx;
    vLengthPx = 0.0;
    vRadiusPx = 0.0;
    vOpacity = opacity * (segmentIndex == TRAIL_SEGMENT_COUNT - 1 ? 1.0 : 0.0);
    vTrailProgressStart = 0.0;
    vIsHead = 0.0;
    vIsSpark = 1.0;
    vSparkKind = currentSparkKind;
    vSparkFlicker = sparkFlicker;
    vIsSurfaceEffect = 1.0;
    vEffectProgress = effectProgress;
    vEffectOutward = effectOutward;
    vEffectRadiusPx = effectRadiusPx;
    vEffectSeed = sparkCycleRandom(sparkId, uFieldTime, 59.1);
    return;
  }

  vec2 headPx = head * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 tailPx = tail * (0.5 * uResolution.y) + 0.5 * uResolution;
  vec2 deltaPx = headPx - tailPx;
  float segmentLengthPx = length(deltaPx);
  vec2 along = segmentLengthPx > 0.001 ? deltaPx / segmentLengthPx : vec2(1.0, 0.0);
  vec2 across = vec2(-along.y, along.x);
  float paddingPx = radiusPx * (sparkParticle ? 4.5 : 4.0) + 1.0;
  vec2 corner = QUAD[cornerIndex];
  float localAlongPx = mix(-paddingPx, segmentLengthPx + paddingPx, corner.x);
  float localAcrossPx = corner.y * paddingPx;
  vec2 positionPx = tailPx + along * localAlongPx + across * localAcrossPx;
  vec2 clip = positionPx / uResolution * 2.0 - 1.0;

  gl_Position = vec4(clip, 0.0, 1.0);
  vLocalPx = vec2(localAlongPx, localAcrossPx);
  vLengthPx = segmentLengthPx;
  vRadiusPx = radiusPx;
  float segmentVisible = segmentLengthPx > 0.001 || segmentIndex == TRAIL_SEGMENT_COUNT - 1
    ? 1.0
    : 0.0;
  vOpacity = opacity * segmentVisible;
  vTrailProgressStart = segmentStart;
  vIsHead = segmentIndex == TRAIL_SEGMENT_COUNT - 1 ? 1.0 : 0.0;
  vIsSpark = sparkParticle ? 1.0 : 0.0;
  vSparkKind = currentSparkKind;
  vSparkFlicker = sparkFlicker;
  vIsSurfaceEffect = 0.0;
  vEffectProgress = 0.0;
  vEffectOutward = vec2(0.0, 1.0);
  vEffectRadiusPx = 0.0;
  vEffectSeed = 0.0;
}`, Ks = "#version 300 es\nprecision highp float;\n\nin vec2 vLocalPx;\nflat in float vLengthPx;\nflat in float vRadiusPx;\nflat in float vOpacity;\nflat in float vTrailProgressStart;\nflat in float vIsHead;\nflat in float vIsSpark;\nflat in float vSparkKind;\nflat in float vSparkFlicker;\nflat in float vIsSurfaceEffect;\nflat in float vEffectProgress;\nflat in vec2 vEffectOutward;\nflat in float vEffectRadiusPx;\nflat in float vEffectSeed;\n\nuniform float uSparkBrightness;\nuniform float uSurfaceEffects;\nuniform float uFireIntensity;\nuniform float uFireTurbulence;\nuniform float uFlameHeight;\nuniform float uCoronaMist;\nuniform float uCurlingWisps;\nuniform float uHotRim;\nuniform float uEruptionScale;\nuniform float uEruptionIntensity;\nuniform float uEruptionParticles;\n\nout vec4 outColor;\n\nfloat fragmentHash(float value) {\n  return fract(sin(value * 127.1) * 43758.5453);\n}\n\nfloat fragmentNoise(vec2 point) {\n  vec2 cell = floor(point);\n  vec2 local = fract(point);\n  vec2 blend = local * local * (3.0 - 2.0 * local);\n  float lowerLeft = fragmentHash(dot(cell, vec2(127.1, 311.7)));\n  float lowerRight = fragmentHash(dot(cell + vec2(1.0, 0.0), vec2(127.1, 311.7)));\n  float upperLeft = fragmentHash(dot(cell + vec2(0.0, 1.0), vec2(127.1, 311.7)));\n  float upperRight = fragmentHash(dot(cell + vec2(1.0, 1.0), vec2(127.1, 311.7)));\n  return mix(\n    mix(lowerLeft, lowerRight, blend.x),\n    mix(upperLeft, upperRight, blend.x),\n    blend.y\n  );\n}\n\nvoid main() {\n  if (vIsSurfaceEffect > 0.5) {\n    if (vOpacity <= 0.001) discard;\n    float effectDistance = length(vLocalPx);\n    vec2 effectDirection = vLocalPx / max(effectDistance, 0.001);\n\n    if (vIsSurfaceEffect > 1.5) {\n      vec2 fireTangent = vec2(-vEffectOutward.y, vEffectOutward.x);\n      float fireRadius = max(vEffectRadiusPx, 1.0);\n      float outwardDistance = dot(vLocalPx, vEffectOutward) / fireRadius;\n      float sidewaysDistance = dot(vLocalPx, fireTangent) / fireRadius;\n      float phase = vEffectProgress * 6.2831853 + vEffectSeed * 19.0;\n      float eruption = vSparkFlicker;\n      float flowNoise = fragmentNoise(\n        vec2(\n          sidewaysDistance * 3.4 + vEffectSeed * 11.0,\n          outwardDistance * 2.2 - phase * 0.42\n        )\n      );\n      float detailNoise = fragmentNoise(\n        vec2(\n          sidewaysDistance * 7.7 - phase * 0.31 + vEffectSeed * 23.0,\n          outwardDistance * 5.4 - phase * 0.92\n        )\n      );\n      float turbulence = flowNoise * 0.64 + detailNoise * 0.36;\n      float turbulentSidewaysDistance = sidewaysDistance\n        + (turbulence - 0.5)\n          * 0.22\n          * uFireTurbulence\n          * smoothstep(-0.08, 0.9, outwardDistance);\n      float slowGust = (\n        sin(phase * 0.37 + vEffectSeed * 11.0)\n        + 0.52 * sin(phase * 0.19 - vEffectSeed * 17.0)\n      ) / 1.52;\n      float flameHeight = 0.88\n        + 0.22 * sin(phase)\n        + 0.11 * sin(phase * 1.73 + vEffectSeed * 7.0)\n        + slowGust * 0.09\n        + eruption * mix(0.28, 0.58, vSparkKind);\n      flameHeight *= uFlameHeight;\n      float outwardProgress = clamp(\n        (outwardDistance + 0.08) / max(flameHeight + 0.08, 0.001),\n        0.0,\n        1.0\n      );\n      float sway = (\n        sin(phase * 1.31 + outwardProgress * 5.2) * 0.18\n        + sin(phase * 0.73 - outwardProgress * 8.1 + vEffectSeed * 13.0) * 0.08\n        + slowGust * outwardProgress * 0.11\n      ) * outwardProgress * outwardProgress;\n      float flameWidth = mix(0.48, 0.025, smoothstep(0.0, 1.0, outwardProgress));\n      float mainFlame = 1.0 - smoothstep(\n        flameWidth,\n        flameWidth + 0.14,\n        abs(turbulentSidewaysDistance - sway)\n      );\n      float mainVertical = smoothstep(-0.2, -0.015, outwardDistance)\n        * (1.0 - smoothstep(flameHeight * 0.58, flameHeight, outwardDistance));\n      float mainBreakup = mix(0.22, 1.0, smoothstep(0.16, 0.86, turbulence));\n      mainFlame *= mainVertical * mainBreakup;\n\n      float secondaryOffset = mix(-0.36, 0.36, fract(vEffectSeed * 17.23))\n        + sin(phase * 0.31 + vEffectSeed * 13.0) * 0.14;\n      float secondaryHeight = 0.5\n        + 0.2 * (0.5 + 0.5 * sin(phase * 1.47 + vEffectSeed * 31.0));\n      secondaryHeight *= uFlameHeight;\n      float secondaryProgress = clamp(\n        (outwardDistance + 0.04) / max(secondaryHeight + 0.04, 0.001),\n        0.0,\n        1.0\n      );\n      float secondarySway = secondaryOffset\n        + sin(phase * 1.83 - secondaryProgress * 5.7) * 0.07 * secondaryProgress;\n      float secondaryWidth = mix(0.2, 0.018, secondaryProgress);\n      float secondaryFlame = 1.0 - smoothstep(\n        secondaryWidth,\n        secondaryWidth + 0.1,\n        abs(turbulentSidewaysDistance - secondarySway)\n      );\n      secondaryFlame *= smoothstep(-0.15, 0.0, outwardDistance)\n        * (1.0 - smoothstep(secondaryHeight * 0.54, secondaryHeight, outwardDistance));\n\n      float tertiaryOffset = -secondaryOffset * 0.68\n        + sin(phase * 0.23 - vEffectSeed * 19.0) * 0.09;\n      float tertiaryHeight = 0.28\n        + 0.22 * (0.5 + 0.5 * sin(phase * 2.13 - vEffectSeed * 27.0));\n      tertiaryHeight *= uFlameHeight;\n      float tertiaryProgress = clamp(\n        outwardDistance / max(tertiaryHeight, 0.001),\n        0.0,\n        1.0\n      );\n      float tertiarySway = tertiaryOffset\n        + sin(phase * 2.37 + tertiaryProgress * 4.9) * 0.06 * tertiaryProgress;\n      float tertiaryWidth = mix(0.16, 0.014, tertiaryProgress);\n      float tertiaryFlame = 1.0 - smoothstep(\n        tertiaryWidth,\n        tertiaryWidth + 0.09,\n        abs(turbulentSidewaysDistance - tertiarySway)\n      );\n      tertiaryFlame *= smoothstep(-0.12, 0.02, outwardDistance)\n        * (1.0 - smoothstep(tertiaryHeight * 0.5, tertiaryHeight, outwardDistance));\n\n      float eruptionPhase = vSparkKind;\n      float eruptionVariant = vTrailProgressStart;\n      float plumeHeight = mix(1.45, 2.18, eruptionVariant) * uEruptionScale;\n      float plumeReach = plumeHeight * smoothstep(0.02, 0.34, eruptionPhase);\n      float plumeProgress = clamp(\n        (outwardDistance + 0.02) / max(plumeReach, 0.001),\n        0.0,\n        1.0\n      );\n      float plumeLean = mix(-0.34, 0.34, eruptionVariant);\n      float plumeSway = plumeLean * plumeProgress\n        + (\n          sin(phase * 1.37 + plumeProgress * 7.1 + vEffectSeed * 33.0) * 0.15\n          + sin(phase * 2.11 - plumeProgress * 4.7 + eruptionVariant * 19.0) * 0.07\n        ) * plumeProgress * plumeProgress;\n      float outerPlumeWidth = mix(\n        0.38,\n        0.045,\n        smoothstep(0.0, 1.0, plumeProgress)\n      );\n      float corePlumeWidth = outerPlumeWidth * mix(0.32, 0.2, plumeProgress);\n      float outerPlume = 1.0 - smoothstep(\n        outerPlumeWidth,\n        outerPlumeWidth + 0.15,\n        abs(turbulentSidewaysDistance - plumeSway)\n      );\n      float corePlume = 1.0 - smoothstep(\n        corePlumeWidth,\n        corePlumeWidth + 0.075,\n        abs(turbulentSidewaysDistance - plumeSway)\n      );\n      float plumeBreakup = mix(\n        0.12,\n        1.0,\n        smoothstep(\n          0.14,\n          0.9,\n          0.5\n            + 0.5\n              * sin(\n                sidewaysDistance * 19.0\n                + plumeProgress * 13.0\n                - phase * 4.2\n                + vEffectSeed * 47.0\n              )\n        )\n      );\n      float plumeVertical = smoothstep(-0.12, 0.03, outwardDistance)\n        * (1.0 - smoothstep(plumeReach * 0.68, plumeReach, outwardDistance));\n      outerPlume *= plumeVertical * plumeBreakup * eruption;\n      corePlume *= plumeVertical * mix(0.62, 1.0, plumeBreakup) * eruption;\n\n      float branchStart = mix(0.28, 0.46, eruptionVariant);\n      float branchProgress = clamp(\n        (plumeProgress - branchStart) / max(1.0 - branchStart, 0.001),\n        0.0,\n        1.0\n      );\n      float branchDirection = mix(-1.0, 1.0, step(0.5, eruptionVariant));\n      float branchCenter = plumeSway\n        + branchDirection * branchProgress * mix(0.26, 0.48, eruptionVariant);\n      float branchWidth = mix(0.2, 0.025, branchProgress);\n      float plumeBranch = 1.0 - smoothstep(\n        branchWidth,\n        branchWidth + 0.1,\n        abs(turbulentSidewaysDistance - branchCenter)\n      );\n      plumeBranch *= smoothstep(0.0, 0.18, branchProgress)\n        * (1.0 - smoothstep(0.76, 1.0, branchProgress))\n        * plumeBreakup\n        * eruption;\n\n      float tipProgress = 0.76;\n      float tipCenter = plumeLean * tipProgress\n        + (\n          sin(phase * 1.37 + tipProgress * 7.1 + vEffectSeed * 33.0) * 0.15\n          + sin(phase * 2.11 - tipProgress * 4.7 + eruptionVariant * 19.0) * 0.07\n        ) * tipProgress * tipProgress;\n      vec2 plumeTip = vec2(\n        sidewaysDistance - tipCenter,\n        outwardDistance - plumeReach * tipProgress\n      );\n      float tipAngle = atan(plumeTip.y, plumeTip.x);\n      float crownLobes = 0.82\n        + 0.18 * sin(tipAngle * 5.0 + phase * 2.7 + eruptionVariant * 23.0);\n      float crownRadius = mix(0.12, 0.22, eruptionVariant) * crownLobes;\n      float eruptionCrown = (\n        1.0 - smoothstep(crownRadius * 0.55, crownRadius, length(plumeTip))\n      )\n        * smoothstep(0.16, 0.34, eruptionPhase)\n        * (1.0 - smoothstep(0.68, 0.95, eruptionPhase))\n        * step(0.001, eruption);\n\n      float eruptionParticles = 0.0;\n      float eruptionActive = step(0.001, eruption);\n      vec2 firePoint = vec2(sidewaysDistance, outwardDistance);\n      for (int emberIndex = 0; emberIndex < 7; emberIndex++) {\n        float emberId = float(emberIndex);\n        float emberSeed = fragmentHash(\n          vEffectSeed * 73.1\n          + eruptionVariant * 41.7\n          + emberId * 19.37\n        );\n        float emberStart = mix(\n          0.16,\n          0.42,\n          fragmentHash(emberSeed * 13.9 + emberId)\n        );\n        float emberDuration = mix(\n          0.38,\n          0.62,\n          fragmentHash(emberSeed * 29.1 + 2.7)\n        );\n        float emberAge = (eruptionPhase - emberStart) / emberDuration;\n        float emberLife = smoothstep(0.0, 0.08, emberAge)\n          * (1.0 - smoothstep(0.45, 1.0, emberAge))\n          * step(0.0, emberAge)\n          * eruptionActive;\n        float emberSideVelocity = mix(\n          -0.82,\n          0.82,\n          fragmentHash(emberSeed * 31.7 + 4.1)\n        );\n        float emberUpVelocity = mix(\n          1.0,\n          1.72,\n          fragmentHash(emberSeed * 47.3 + 8.6)\n        );\n        float emberGravity = mix(\n          0.42,\n          0.78,\n          fragmentHash(emberSeed * 61.9 + 3.2)\n        );\n        float safeEmberAge = max(emberAge, 0.0);\n        float dragTravel = (\n          1.0 - exp(-2.2 * safeEmberAge)\n        ) / (1.0 - exp(-2.2));\n        vec2 emberPosition = vec2(\n          plumeLean * 0.18\n            + emberSideVelocity * dragTravel\n            + sin(safeEmberAge * 5.0 + emberSeed * 17.0) * 0.035,\n          0.34\n            + emberUpVelocity * dragTravel\n            - emberGravity * safeEmberAge * safeEmberAge\n        );\n        vec2 emberVelocity = vec2(\n          emberSideVelocity * exp(-1.4 * safeEmberAge),\n          emberUpVelocity * exp(-1.2 * safeEmberAge)\n            - 2.0 * emberGravity * safeEmberAge\n        );\n        vec2 emberDirection = emberVelocity / max(length(emberVelocity), 0.001);\n        float emberTailLength = mix(\n          0.08,\n          0.24,\n          fragmentHash(emberSeed * 79.1 + 6.4)\n        );\n        vec2 emberTail = emberPosition - emberDirection * emberTailLength;\n        vec2 emberSegment = emberPosition - emberTail;\n        vec2 emberOffset = firePoint - emberTail;\n        float emberAlong = clamp(\n          dot(emberOffset, emberSegment) / max(dot(emberSegment, emberSegment), 0.0001),\n          0.0,\n          1.0\n        );\n        float emberDistance = length(\n          emberOffset - emberSegment * emberAlong\n        );\n        float emberRadius = mix(\n          0.022,\n          0.045,\n          fragmentHash(emberSeed * 97.3 + 5.8)\n        );\n        float emberLight = 1.0 - smoothstep(\n          emberRadius,\n          emberRadius + 0.035,\n          emberDistance\n        );\n        eruptionParticles += emberLight\n          * emberLife\n          * mix(0.58, 1.0, emberAlong);\n      }\n\n      float rollingHeat = mix(\n        turbulence,\n        0.5\n          + 0.5\n            * sin(\n              sidewaysDistance * 9.0\n              - outwardDistance * 7.0\n              + phase * 3.4\n              + vEffectSeed * 29.0\n            ),\n        0.34\n      );\n      float baseCorona = (1.0 - smoothstep(0.16, 0.62, abs(sidewaysDistance)))\n        * (1.0 - smoothstep(0.12, 0.4, abs(outwardDistance - 0.02)));\n      float surfaceHeat = (\n        1.0\n          - smoothstep(\n            0.18,\n            0.68,\n            length(vec2(sidewaysDistance, outwardDistance * 1.25))\n          )\n      ) * mix(0.38, 1.0, rollingHeat);\n      float coronaEnvelope = smoothstep(-0.2, 0.02, outwardDistance)\n        * (1.0 - smoothstep(0.42, 1.22, outwardDistance))\n        * (1.0 - smoothstep(0.38, 1.02, abs(sidewaysDistance)));\n      float coronaMist = coronaEnvelope\n        * mix(0.14, 1.0, smoothstep(0.22, 0.82, turbulence));\n      vec2 curlCenter = vec2(\n        sin(phase * 0.29 + vEffectSeed * 31.0) * 0.28,\n        0.48 + sin(phase * 0.17 - vEffectSeed * 13.0) * 0.18\n      );\n      float curlRadius = 0.2\n        + 0.08 * (0.5 + 0.5 * sin(phase * 0.21 + vEffectSeed * 17.0));\n      vec2 curlLocal = vec2(\n        turbulentSidewaysDistance - curlCenter.x,\n        (outwardDistance - curlCenter.y) * 0.82\n      );\n      float curlDistance = abs(length(curlLocal) - curlRadius);\n      float curlActivation = smoothstep(\n        0.42,\n        0.82,\n        0.5 + 0.5 * sin(phase * 0.13 + vEffectSeed * 41.0)\n      );\n      float curlingWisp = (\n        1.0 - smoothstep(0.025, 0.11, curlDistance)\n      )\n        * curlActivation\n        * mix(0.24, 1.0, detailNoise)\n        * smoothstep(-0.08, 0.12, outwardDistance);\n      float hotRim = (\n        1.0 - smoothstep(0.055, 0.24, abs(outwardDistance + 0.01))\n      )\n        * (1.0 - smoothstep(0.42, 0.94, abs(sidewaysDistance)))\n        * mix(0.5, 1.0, turbulence);\n      float fireFlicker = 0.76\n        + 0.24 * (0.5 + 0.5 * sin(phase * 3.67 + vEffectSeed * 37.0));\n      float normalFire = (\n        mainFlame * 0.21\n        + secondaryFlame * 0.13\n        + tertiaryFlame * 0.1\n        + baseCorona * 0.07\n        + surfaceHeat * 0.06\n        + coronaMist * 0.045 * uCoronaMist\n        + curlingWisp * 0.085 * uCurlingWisps\n        + hotRim * 0.055 * uHotRim\n      ) * uFireIntensity;\n      float eruptionFire = (\n        outerPlume * 0.2\n        + corePlume * 0.32\n        + plumeBranch * 0.17\n        + eruptionCrown * 0.18\n      ) * uEruptionIntensity;\n      float fireLight = (\n        normalFire\n        + eruptionFire\n        + eruptionParticles * 0.42 * uEruptionParticles\n      ) * fireFlicker * vOpacity;\n\n      if (fireLight <= 0.001) discard;\n      outColor = vec4(vec3(fireLight), 1.0);\n      return;\n    }\n\n    float effectEase = 1.0 - (1.0 - vEffectProgress) * (1.0 - vEffectProgress);\n    float effectLight;\n\n    if (vSparkKind < 1.5) {\n      float rotation = vEffectSeed * 6.2831853 + vEffectProgress * 0.34;\n      vec2 primaryAxis = vec2(cos(rotation), sin(rotation));\n      vec2 secondaryAxis = vec2(-primaryAxis.y, primaryAxis.x);\n      float primaryAlong = abs(dot(vLocalPx, primaryAxis));\n      float primaryAcross = abs(dot(vLocalPx, secondaryAxis));\n      float secondaryAlong = abs(dot(vLocalPx, secondaryAxis));\n      float secondaryAcross = abs(dot(vLocalPx, primaryAxis));\n      float primarySpike = (1.0 - smoothstep(0.8, vEffectRadiusPx * 0.042 + 1.2, primaryAcross))\n        * (1.0 - smoothstep(vEffectRadiusPx * 0.1, vEffectRadiusPx * 0.68, primaryAlong));\n      float secondarySpike = (1.0 - smoothstep(0.8, vEffectRadiusPx * 0.06 + 1.4, secondaryAcross))\n        * (1.0 - smoothstep(vEffectRadiusPx * 0.08, vEffectRadiusPx * 0.46, secondaryAlong));\n      float core = 1.0 - smoothstep(\n        vEffectRadiusPx * 0.035,\n        vEffectRadiusPx * mix(0.2, 0.1, vEffectProgress) + 1.0,\n        effectDistance\n      );\n      float bloom = 1.0 - smoothstep(\n        vEffectRadiusPx * 0.05,\n        vEffectRadiusPx * mix(0.36, 0.54, effectEase),\n        effectDistance\n      );\n      float angle = atan(vLocalPx.y, vLocalPx.x);\n      float unevenness = mix(\n        0.62,\n        1.0,\n        0.5 + 0.5 * sin(angle * 7.0 + effectDistance * 0.13 + vEffectSeed * 19.0)\n      );\n      float normalizedDistance = effectDistance / max(vEffectRadiusPx, 1.0);\n      float coronaPattern = 0.5\n        + 0.5 * sin(angle * 13.0 + vEffectSeed * 37.0 + vEffectProgress * 4.2);\n      coronaPattern *= 0.68\n        + 0.32 * sin(angle * 21.0 - vEffectSeed * 17.0 - vEffectProgress * 2.8);\n      float coronaRays = pow(max(coronaPattern, 0.0), 7.0)\n        * smoothstep(0.06, 0.14, normalizedDistance)\n        * (1.0 - smoothstep(0.24, 0.58, normalizedDistance));\n      float glintRadius = vEffectRadiusPx\n        * (0.2 + 0.07 * sin(angle * 5.0 + vEffectSeed * 29.0));\n      float glintBand = 1.0 - smoothstep(\n        0.8,\n        3.0,\n        abs(effectDistance - glintRadius)\n      );\n      float glintPattern = pow(\n        max(\n          0.0,\n          0.5 + 0.5 * sin(angle * 17.0 + vEffectSeed * 43.0 + vEffectProgress * 5.4)\n        ),\n        14.0\n      );\n      float hotGlints = glintBand * glintPattern;\n      float haloRadius = vEffectRadiusPx * mix(0.08, 0.52, effectEase);\n      float haloWidth = vEffectRadiusPx * mix(0.08, 0.025, vEffectProgress);\n      float halo = 1.0 - smoothstep(\n        haloWidth,\n        haloWidth * 2.6 + 1.0,\n        abs(effectDistance - haloRadius)\n      );\n      float haloBreakup = mix(\n        0.18,\n        1.0,\n        0.5 + 0.5 * sin(angle * 9.0 - vEffectSeed * 31.0)\n      );\n      float haloOutward = smoothstep(-0.62, 0.18, dot(effectDirection, vEffectOutward));\n      float pulse = sin(clamp(vEffectProgress, 0.0, 1.0) * 3.14159265);\n      effectLight = (\n        core * 0.9\n        + primarySpike * 0.26\n        + secondarySpike * 0.17\n        + bloom * unevenness * 0.12\n        + coronaRays * 0.25\n        + hotGlints * 0.42\n        + halo * haloBreakup * haloOutward * 0.18\n      ) * mix(0.76, 1.0, pulse);\n    } else {\n      float waveRadius = mix(vEffectRadiusPx * 0.08, vEffectRadiusPx * 0.9, effectEase);\n      float bandDistance = abs(effectDistance - waveRadius);\n      float bandWidth = vEffectRadiusPx * mix(0.18, 0.1, vEffectProgress);\n      float haze = 1.0 - smoothstep(\n        bandWidth,\n        bandWidth * 2.8 + 2.0,\n        bandDistance\n      );\n      float angle = atan(vLocalPx.y, vLocalPx.x);\n      float breakup = 0.5\n        + 0.5 * sin(angle * 11.0 + effectDistance * 0.09 + vEffectSeed * 23.0);\n      breakup = mix(0.28, 1.0, smoothstep(0.12, 0.88, breakup));\n      float pinpricks = pow(\n        max(0.0, sin(angle * 17.0 + vEffectSeed * 31.0)),\n        18.0\n      ) * haze;\n      float outwardMask = smoothstep(-0.28, 0.34, dot(effectDirection, vEffectOutward));\n      vec2 effectTangent = vec2(-vEffectOutward.y, vEffectOutward.x);\n      float flareLean = mix(-0.72, 0.72, fract(vEffectSeed * 17.31));\n      vec2 flareAxis = normalize(vEffectOutward + effectTangent * flareLean);\n      vec2 flareTangent = vec2(-flareAxis.y, flareAxis.x);\n      vec2 loopCenter = flareAxis\n        * vEffectRadiusPx\n        * mix(0.16, 0.3, effectEase);\n      vec2 loopLocal = vLocalPx - loopCenter;\n      float loopAlong = dot(loopLocal, flareAxis);\n      float loopAcross = dot(loopLocal, flareTangent);\n      float loopDistance = length(vec2(loopAcross, loopAlong * 0.76));\n      float loopRadius = vEffectRadiusPx * mix(0.1, 0.32, effectEase);\n      float loopWidth = vEffectRadiusPx * mix(0.065, 0.025, vEffectProgress);\n      float prominence = 1.0 - smoothstep(\n        loopWidth,\n        loopWidth * 2.8 + 1.0,\n        abs(loopDistance - loopRadius)\n      );\n      float loopOpening = smoothstep(\n        -0.38,\n        0.18,\n        dot(loopLocal / max(length(loopLocal), 0.001), flareAxis)\n      );\n      float loopBreakup = mix(\n        0.2,\n        1.0,\n        smoothstep(\n          0.12,\n          0.88,\n          0.5 + 0.5 * sin(angle * 7.0 + effectDistance * 0.08 + vEffectSeed * 41.0)\n        )\n      );\n      float outwardDistance = dot(vLocalPx, flareAxis) / max(vEffectRadiusPx, 1.0);\n      float sidewaysDistance = dot(vLocalPx, flareTangent) / max(vEffectRadiusPx, 1.0);\n      float flareCurve = sidewaysDistance\n        - flareLean * 0.22 * outwardDistance * outwardDistance;\n      float flareTongue = (1.0 - smoothstep(0.014, 0.07, abs(flareCurve)))\n        * smoothstep(0.02, 0.12, outwardDistance)\n        * (1.0 - smoothstep(0.42, 0.82, outwardDistance));\n      float flareVariant = fract(vEffectSeed * 53.17);\n      float prominenceWeight = mix(0.22, 0.52, smoothstep(0.18, 0.72, flareVariant));\n      float tongueWeight = mix(0.5, 0.18, smoothstep(0.28, 0.82, flareVariant));\n      effectLight = (\n        haze * breakup * 0.28\n        + pinpricks * 0.24\n        + prominence * loopOpening * loopBreakup * prominenceWeight\n        + flareTongue * tongueWeight\n      ) * outwardMask;\n    }\n\n    float effectStrength = 0.9 * uSurfaceEffects;\n    effectLight *= vOpacity * vSparkFlicker * effectStrength;\n    if (effectLight <= 0.001) discard;\n    outColor = vec4(vec3(effectLight), 1.0);\n    return;\n  }\n\n  float segmentX = clamp(vLocalPx.x, 0.0, vLengthPx);\n  float segmentDistance = length(vec2(vLocalPx.x - segmentX, vLocalPx.y));\n  float segmentProgress = vLengthPx > 0.001 ? clamp(vLocalPx.x / vLengthPx, 0.0, 1.0) : 1.0;\n  float trailProgress = vTrailProgressStart\n    + segmentProgress / float(8);\n  float trailWidth = vRadiusPx * mix(0.22, 0.72, trailProgress);\n  float trailCore = 1.0 - smoothstep(trailWidth, trailWidth + 1.0, segmentDistance);\n  float trailHalo = 1.0 - smoothstep(trailWidth, trailWidth * 2.4 + 1.0, segmentDistance);\n\n  float headDistance = length(vec2(vLocalPx.x - vLengthPx, vLocalPx.y));\n  float headCore = 1.0 - smoothstep(vRadiusPx, vRadiusPx + 1.0, headDistance);\n  float headHalo = 1.0 - smoothstep(vRadiusPx, vRadiusPx * 4.0 + 1.0, headDistance);\n  float cometTaper = trailProgress * trailProgress;\n  float cometLight = (headCore + headHalo * 0.36) * vIsHead\n    + trailCore * 0.68 * cometTaper\n    + trailHalo * 0.12 * cometTaper;\n\n  float needleMask = 1.0 - step(0.5, vSparkKind);\n  float burstMask = step(0.5, vSparkKind) * (1.0 - step(1.5, vSparkKind));\n  float waveMask = step(1.5, vSparkKind);\n  float sparkTaper = mix(0.14, 1.0, smoothstep(0.0, 0.84, trailProgress));\n  float sparkTrailWidth = max(0.65, vRadiusPx * mix(0.14, 0.38, trailProgress));\n  float sparkTrailCore = 1.0 - smoothstep(\n    sparkTrailWidth,\n    sparkTrailWidth + 0.7,\n    segmentDistance\n  );\n  float sparkTrailHalo = 1.0 - smoothstep(\n    sparkTrailWidth,\n    vRadiusPx * 2.7 + 1.0,\n    segmentDistance\n  );\n  float sparkHeadCore = 1.0 - smoothstep(\n    vRadiusPx * 0.92,\n    vRadiusPx * 0.92 + 0.75,\n    headDistance\n  );\n  float sparkHeadHalo = 1.0 - smoothstep(\n    vRadiusPx * 0.8,\n    vRadiusPx * 3.2 + 1.0,\n    headDistance\n  );\n  float needleLight = (sparkHeadCore * 1.38 + sparkHeadHalo * 0.22) * vIsHead\n    + sparkTrailCore * 1.12 * sparkTaper\n    + sparkTrailHalo * 0.13 * sparkTaper;\n  float burstLight = (sparkHeadCore * 1.62 + sparkHeadHalo * 0.22) * vIsHead\n    + sparkTrailCore * 1.08 * sparkTaper\n    + sparkTrailHalo * 0.12 * sparkTaper;\n  float waveLight = (sparkHeadCore * 1.08 + sparkHeadHalo * 0.28) * vIsHead\n    + sparkTrailCore * 0.38\n    + sparkTrailHalo * 0.12;\n  float sparkLight = needleLight * needleMask\n    + burstLight * burstMask\n    + waveLight * waveMask;\n  float light = mix(cometLight, sparkLight, vIsSpark);\n  float sparkStrength = (needleMask * 1.05 + burstMask * 1.25 + waveMask * 0.92)\n    * vSparkFlicker;\n  float outputStrength = mix(0.68, sparkStrength * uSparkBrightness, vIsSpark);\n\n  if (light <= 0.001 || vOpacity <= 0.001) discard;\n  outColor = vec4(vec3(light * vOpacity * outputStrength), 1.0);\n}", qs = .5;
function Js(e, t, n) {
	let r = e.createShader(t);
	if (!r) throw Error("Could not create comet logo shader.");
	if (e.shaderSource(r, n), e.compileShader(r), !e.getShaderParameter(r, e.COMPILE_STATUS)) {
		let t = e.getShaderInfoLog(r) || "Unknown comet logo shader compile error.";
		throw e.deleteShader(r), Error(t);
	}
	return r;
}
function Ys(e) {
	let t = Js(e, e.VERTEX_SHADER, Gs), n = Js(e, e.FRAGMENT_SHADER, Ks), r = e.createProgram();
	if (!r) throw Error("Could not create comet logo shader program.");
	if (e.attachShader(r, t), e.attachShader(r, n), e.linkProgram(r), e.deleteShader(t), e.deleteShader(n), !e.getProgramParameter(r, e.LINK_STATUS)) {
		let t = e.getProgramInfoLog(r) || "Unknown comet logo shader link error.";
		throw e.deleteProgram(r), Error(t);
	}
	return r;
}
function Xs(e, t) {
	let n = document.createElement("canvas"), r = n.getContext("webgl2", {
		alpha: !1,
		antialias: !1,
		depth: !1,
		powerPreference: "low-power",
		premultipliedAlpha: !1,
		preserveDrawingBuffer: !1,
		stencil: !1
	});
	if (!r) throw Error("WebGL2 is required for the comet logo shader.");
	let i = Ys(r), a = r.createVertexArray();
	if (!a) throw r.deleteProgram(i), Error("Could not create comet logo vertex array.");
	let o = r.getUniformLocation(i, "uResolution"), s = r.getUniformLocation(i, "uFieldTime"), c = r.getUniformLocation(i, "uFormation"), l = r.getUniformLocation(i, "uRejoining"), u = r.getUniformLocation(i, "uRejoinProgress"), d = r.getUniformLocation(i, "uRejoinElapsed"), f = r.getUniformLocation(i, "uRejoinStartFieldTime"), p = r.getUniformLocation(i, "uRejoinStartFormation"), m = r.getUniformLocation(i, "uRejoinDuration"), h = r.getUniformLocation(i, "uFormationOrigin"), g = r.getUniformLocation(i, "uFormationStartFieldTime"), _ = Object.fromEntries((/* @__PURE__ */ "FieldSpeed.FieldDepth.FieldSpread.CenterClearRadius.CenterClearAspect.CenterClearSquareness.CenterClearLeak.CenterClearFalloff.FieldAlign.FormationDirectness.FormationMaxTravel.FormationEase.FormationWiggle.FormationSpawnRadius.FormationMode.FormationParamA.FormationParamB.FieldTrailLength.FieldParticleSize.LogoScale.LogoParticleSize.LogoTrailLength.LogoMotion.FormationDuration.FormationStagger.CenterPreference.SparkFrequency.SparkSize.SparkBrightness.SparkTrailLength.BurstProbability.WaveProbability.SurfaceEffects.FireScale.FireIntensity.FireSpeed.FireTurbulence.FlameHeight.WeatherSpeed.WeatherVariation.CoronaMist.CurlingWisps.HotRim.EruptionFrequency.EruptionScale.EruptionIntensity.EruptionParticles.EruptionCycleSpeed".split(".")).map((e) => [e, r.getUniformLocation(i, `u${e}`)])), v = js(), y = .5, b = .5, x = 0, S = !1, C = (e, t) => {
		let r = Math.max(1, Math.round(e * qs)), i = Math.max(1, Math.round(t * qs));
		n.width !== r && (n.width = r), n.height !== i && (n.height = i);
	};
	return C(e, t), {
		canvas: n,
		get width() {
			return n.width;
		},
		get height() {
			return n.height;
		},
		resize: C,
		render(e, t, C) {
			if (S) return;
			let w = Hs(C), T = v.mode;
			v = Ms(v, e, t.hovered, w.formationDuration, w.rejoinDuration, w.formationInterrupt), v.mode === "forming" && T !== "forming" && (w.formationMode > 0.5 || T === "field" || v.formation <= .001) && (y = Math.max(0, Math.min(1, t.x / Math.max(1, n.width))), b = Math.max(0, Math.min(1, t.y / Math.max(1, n.height))), x = v.fieldTimeSec), r.viewport(0, 0, n.width, n.height), r.clearColor(0, 0, 0, 1), r.clear(r.COLOR_BUFFER_BIT), r.useProgram(i), r.bindVertexArray(a), r.uniform2f(o, n.width, n.height), r.uniform1f(s, v.fieldTimeSec), r.uniform1f(c, v.formation), r.uniform1f(l, +(v.mode === "rejoining")), r.uniform1f(u, v.rejoinProgress), r.uniform1f(d, Math.max(0, v.fieldTimeSec - v.rejoinStartFieldTimeSec)), r.uniform1f(f, v.rejoinStartFieldTimeSec), r.uniform1f(p, v.rejoinStartFormation), r.uniform1f(m, w.rejoinDuration), r.uniform2f(h, y * n.width, b * n.height), r.uniform1f(g, x);
			let E = {
				FieldSpeed: w.fieldSpeed,
				FieldDepth: w.fieldDepth,
				FieldSpread: w.fieldSpread,
				CenterClearRadius: w.centerClearRadius * qs,
        CenterClearAspect: w.centerClearAspect,
        CenterClearSquareness: w.centerClearSquareness,
        CenterClearLeak: w.centerClearLeak,
        CenterClearFalloff: w.centerClearFalloff,
        FieldAlign: w.fieldAlign,
        FormationDirectness: w.formationDirectness,
        FormationMaxTravel: w.formationMaxTravel,
        FormationEase: w.formationEase,
        FormationWiggle: w.formationWiggle,
        FormationSpawnRadius: w.formationSpawnRadius,
        FormationMode: w.formationMode,
        FormationParamA: w.formationParamA,
        FormationParamB: w.formationParamB,
				FieldTrailLength: w.fieldTrailLength,
				FieldParticleSize: w.fieldParticleSize,
				LogoScale: w.logoScale,
				LogoParticleSize: w.logoParticleSize,
				LogoTrailLength: w.logoTrailLength,
				LogoMotion: w.logoMotion,
				FormationDuration: w.formationDuration,
				FormationStagger: w.formationStagger,
				CenterPreference: w.centerPreference,
				SparkFrequency: w.sparkFrequency,
				SparkSize: w.sparkSize,
				SparkBrightness: w.sparkBrightness,
				SparkTrailLength: w.sparkTrailLength,
				BurstProbability: w.burstProbability,
				WaveProbability: w.waveProbability,
				SurfaceEffects: w.surfaceEffects,
				FireScale: w.fireScale,
				FireIntensity: w.fireIntensity,
				FireSpeed: w.fireSpeed,
				FireTurbulence: w.fireTurbulence,
				FlameHeight: w.flameHeight,
				WeatherSpeed: w.weatherSpeed,
				WeatherVariation: w.weatherVariation,
				CoronaMist: w.coronaMist,
				CurlingWisps: w.curlingWisps,
				HotRim: w.hotRim,
				EruptionFrequency: w.eruptionFrequency,
				EruptionScale: w.eruptionScale,
				EruptionIntensity: w.eruptionIntensity,
				EruptionParticles: w.eruptionParticles,
				EruptionCycleSpeed: w.eruptionCycleSpeed
			};
			for (let [e, t] of Object.entries(E)) r.uniform1f(_[e] ?? null, t);
			r.enable(r.BLEND), r.blendFunc(r.ONE, r.ONE);
			let D = v.mode === "field" ? Ls : zs + Math.max(1, Math.round(w.logoDensity * Ns));
			r.drawArraysInstanced(r.TRIANGLES, 0, 48, D), r.disable(r.BLEND), r.bindVertexArray(null);
		},
		getAnimationState() {
			return v;
		},
		dispose() {
			S || (S = !0, r.deleteVertexArray(a), r.deleteProgram(i));
		}
	};
}
//#endregion
//#region src/index.ts
var Zs = "@necatikcl/stripes-engine";
//#endregion
export { ds as CLICK_WAVE_TYPES, Is as COMET_LOGO_BACKGROUND_POINT_COUNT, Vs as COMET_LOGO_CONFIG_VERSION, Q as COMET_LOGO_DEFAULTS, Ts as COMET_LOGO_FORMATION_DURATION_SEC, Fs as COMET_LOGO_IDLE_BACKGROUND_POINT_COUNT, Ls as COMET_LOGO_IDLE_RENDER_POINT_COUNT, Z as COMET_LOGO_POINTS, Ns as COMET_LOGO_POINT_COUNT, Es as COMET_LOGO_REJOIN_DURATION_SEC, Rs as COMET_LOGO_RENDER_POINT_COUNT, qs as COMET_LOGO_RENDER_SCALE, Bs as COMET_LOGO_TRAIL_SEGMENT_COUNT, us as CURSOR_TRAIL_TYPES, p as DEFAULT_BACKGROUND_METEORS, o as DEFAULT_CLICK_WAVE, _ as DEFAULT_COMET_TRAIL, c as DEFAULT_DETONATION_CLICK, m as DEFAULT_ENGINE_CONFIG, S as DEFAULT_FRAMES, l as DEFAULT_GRID_LINES, v as DEFAULT_STRIPE_BORDER, h as DEFAULT_STRIPE_DOTS, Zs as ENGINE_PACKAGE, B as FULLSCREEN_VERT, Ms as advanceCometLogoAnimation, Co as applyImageColorDensity, ls as bandIndexForValue, z as bindRenderTarget, Kr as cometCaps, As as cometLogoRejoinWindowSec, P as compileProgram, js as createCometLogoAnimationState, Xs as createCometLogoTextureRenderer, Rt as createDataTexture, ae as createFullscreenQuad, k as createManualClock, la as createPingPong, vs as createProductionConfig, O as createRealClock, R as createRenderTarget, kt as createSeededRng, os as createStripesEngine, ss as createStripesEngineShared, Di as detonationCaps, x as diffEngineConfig, ve as disposeRenderTarget, wo as effectiveStripes, mi as meteorsCaps, ws as migrateLegacyConfig, C as normalizeBackgroundMeteors, Hs as normalizeCometLogoSettings, s as normalizeCometTrail, r as normalizeDetonationClick, e as normalizeEngineConfig, w as normalizeFrames, i as normalizeGridLines, n as normalizeStripeBorder, t as normalizeStripeDots, ps as parseEngineConfig, _e as resizeRenderTarget, g as resolveThemedConfig, y as sanitizeThemedConfig, fs as serializeEngineConfig, ys as serializeProductionConfig, vo as stripeDotBandEligibility, D as subscribeStripesStats, zt as updateDataTexture };
