import { O as e, S as t, d as n, l as r, x as i } from "./twizzlerGradient-8YSpRrAT.js";
//#region src/twizzler.ts
var a = [
	"solid",
	"sharedLinear",
	"sharedGradient",
	"fiberGradient",
	"baked"
];
function o(e) {
	switch (e) {
		case "sharedGradient":
		case "fiberGradient": return !0;
		case "solid":
		case "sharedLinear":
		case "baked": return !1;
		default: return e;
	}
}
function s(e) {
	return e === "sharedLinear";
}
var c = {
	color: "#f46021",
	colorFar: "#fea700",
	colorNear: "#f46021",
	colorEdge: "#e92e28",
	gradientStops: n("#fea700", "#f46021", "#e92e28"),
	opacity: 1,
	scale: 1,
	centerY: .5,
	amplitude: 1,
	lineCount: 56,
	lineWidth: 2.3,
	pointSpacing: 10,
	leftHeight: .58,
	rightHeight: .32,
	edgeFluctuation: 0,
	edgeSpeed: 0,
	edgeTaper: .08,
	wrinkles: 1.8,
	wrinkleStrength: .032,
	bendPosition: .2,
	bendAmount: 0,
	bend2Position: .4,
	bend2Amount: 0,
	bend3Position: .75,
	bend3Amount: 0,
	depthPosition: .86,
	depthAmount: 1.15,
	depthWidth: .36,
	depth2Position: .42,
	depth2Amount: .2,
	depth2Width: .12,
	depthSpread: 1.05,
	depthLift: .85,
	depthTerrain: 0,
	twist: 1.15,
	rotateXDeg: 12,
	rotateYDeg: -18,
	rotateZDeg: 0,
	fov: 1.05,
	camDist: 10.5,
	perspectiveWidth: 1.8,
	minLineWidth: .4,
	maxLineWidth: 3.2,
	gradientsEnabled: !0,
	ribbonColorMode: "sharedGradient",
	gradientXEnabled: !0,
	gradientXMix: 1,
	gradientYEnabled: !0,
	gradientYMix: .85,
	gradientZEnabled: !0,
	gradientZStrength: .75,
	gradientZCenter: 0,
	gradientZWidth: .95,
	backgroundColor: "#ffffff",
	noiseScaleX: 4e-4,
	noiseScaleY: .01,
	speed: 1,
	drift: .02,
	stippleSize: 0,
	stippleGap: .8,
	rotateX: 0,
	rotateY: 0,
	rotateZ: 0,
	panX: 0,
	panY: 0,
	panZ: 0,
	viewDistance: 30
};
function l(e, t, n, r) {
	return typeof e == "number" && Number.isFinite(e) ? Math.max(n, Math.min(r, e)) : t;
}
function u(e) {
	return e * e * (3 - 2 * e);
}
function d(e, t, n) {
	let r = Math.max(0, Math.min(1, (n - e) / Math.max(1e-6, t - e)));
	return r * r * (3 - 2 * r);
}
function f(e, t, n) {
	let r = t - e;
	if (Math.abs(r) < 1e-12) return n < e ? 0 : 1;
	let i = Math.max(0, Math.min(1, (n - e) / r));
	return i * i * (3 - 2 * i);
}
function p(e, t, n) {
	let r = Math.imul(e, 374761393) + Math.imul(t, 668265263) + Math.imul(n, 2147483647);
	return r = Math.imul(r ^ r >>> 13, 1274126177), ((r ^ r >>> 16) >>> 0) / 4294967295;
}
function m(e, t, n) {
	let r = Math.floor(e), i = Math.floor(t), a = Math.floor(n), o = u(e - r), s = u(t - i), c = u(n - a), l = (e, t, n) => e + (t - e) * n;
	return l(l(l(p(r, i, a), p(r + 1, i, a), o), l(p(r, i + 1, a), p(r + 1, i + 1, a), o), s), l(l(p(r, i, a + 1), p(r + 1, i, a + 1), o), l(p(r, i + 1, a + 1), p(r + 1, i + 1, a + 1), o), s), c);
}
function h(e, t = c.color) {
	return typeof e == "string" && /^#[0-9a-f]{6}$/i.test(e) ? e.toLowerCase() : typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t.toLowerCase() : c.color;
}
function g(e) {
	let t = e.replace("#", "");
	return {
		r: Number.parseInt(t.slice(0, 2), 16),
		g: Number.parseInt(t.slice(2, 4), 16),
		b: Number.parseInt(t.slice(4, 6), 16)
	};
}
function _(e, t, n) {
	let r = Math.max(0, Math.min(1, n)), i = g(e), a = g(t), o = (e, t) => Math.round(e + (t - e) * r);
	return `#${o(i.r, a.r).toString(16).padStart(2, "0")}${o(i.g, a.g).toString(16).padStart(2, "0")}${o(i.b, a.b).toString(16).padStart(2, "0")}`;
}
function v(e, t) {
	let n = Math.max(t.depthAmount, 0) + Math.max(t.depth2Amount, 0);
	return n <= 0 ? 0 : Math.max(0, Math.min(1, (e - 1) / n));
}
function y(e) {
	let t = e.ribbonColorMode;
	return typeof t == "string" && a.includes(t) ? t : typeof e.gradientsEnabled == "boolean" ? e.gradientsEnabled ? "baked" : "solid" : c.ribbonColorMode;
}
function b(e) {
	return y(e) === "baked" ? e.gradientXEnabled || e.gradientYEnabled || e.gradientZEnabled && e.gradientZStrength > 0 : !1;
}
function x(e) {
	let t = e && typeof e == "object" ? e : {}, n = h(t.color, c.color), r = y(t), a = h(t.colorFar, c.colorFar), o = h(t.colorNear ?? t.color, c.colorNear), s = i(t.gradientStops, a, o), u = s[0]?.color ?? a, d = s[s.length - 1]?.color ?? o;
	return {
		color: r === "solid" ? o : n,
		colorFar: u,
		colorNear: d,
		colorEdge: h(t.colorEdge, c.colorEdge),
		gradientStops: s,
		opacity: l(t.opacity, c.opacity, 0, 1),
		scale: l(t.scale, c.scale, .01, 50),
		centerY: l(t.centerY, c.centerY, -2, 3),
		amplitude: l(t.amplitude, c.amplitude, 0, 20),
		lineCount: Math.round(l(t.lineCount, c.lineCount, 1, 800)),
		lineWidth: l(t.lineWidth, c.lineWidth, .01, 80),
		pointSpacing: Math.round(l(t.pointSpacing, c.pointSpacing, 1, 400)),
		leftHeight: l(t.leftHeight, c.leftHeight, -10, 10),
		rightHeight: l(t.rightHeight, c.rightHeight, -10, 10),
		edgeFluctuation: l(t.edgeFluctuation, c.edgeFluctuation, 0, 10),
		edgeSpeed: l(t.edgeSpeed, c.edgeSpeed, 0, 40),
		edgeTaper: l(t.edgeTaper, c.edgeTaper, 0, 1),
		wrinkles: l(t.wrinkles, c.wrinkles, 0, 200),
		wrinkleStrength: l(t.wrinkleStrength, c.wrinkleStrength, 0, 10),
		bendPosition: l(t.bendPosition, c.bendPosition, 0, 1),
		bendAmount: l(t.bendAmount, c.bendAmount, -20, 20),
		bend2Position: l(t.bend2Position, c.bend2Position, 0, 1),
		bend2Amount: l(t.bend2Amount, c.bend2Amount, -20, 20),
		bend3Position: l(t.bend3Position, c.bend3Position, 0, 1),
		bend3Amount: l(t.bend3Amount, c.bend3Amount, -20, 20),
		depthPosition: l(t.depthPosition, c.depthPosition, 0, 1),
		depthAmount: l(t.depthAmount, c.depthAmount, 0, 40),
		depthWidth: l(t.depthWidth, c.depthWidth, .01, 10),
		depth2Position: l(t.depth2Position, c.depth2Position, 0, 1),
		depth2Amount: l(t.depth2Amount, c.depth2Amount, 0, 40),
		depth2Width: l(t.depth2Width, c.depth2Width, .01, 10),
		depthSpread: l(t.depthSpread, c.depthSpread, 0, 40),
		depthLift: l(t.depthLift, c.depthLift, 0, 20),
		depthTerrain: Math.round(l(t.depthTerrain, c.depthTerrain, 0, 5)),
		twist: l(t.twist, c.twist, 0, 80),
		rotateXDeg: l(t.rotateXDeg, c.rotateXDeg, -720, 720),
		rotateYDeg: l(t.rotateYDeg, c.rotateYDeg, -720, 720),
		rotateZDeg: l(t.rotateZDeg, c.rotateZDeg, -720, 720),
		fov: l(t.fov, c.fov, .05, 20),
		camDist: l(t.camDist, c.camDist, .25, 200),
		perspectiveWidth: l(t.perspectiveWidth, c.perspectiveWidth, 0, 40),
		minLineWidth: l(t.minLineWidth, c.minLineWidth, .01, 40),
		maxLineWidth: l(t.maxLineWidth, c.maxLineWidth, .01, 120),
		ribbonColorMode: r,
		gradientsEnabled: r !== "solid",
		gradientXEnabled: typeof t.gradientXEnabled == "boolean" ? t.gradientXEnabled : c.gradientXEnabled,
		gradientXMix: l(t.gradientXMix, c.gradientXMix, 0, 1),
		gradientYEnabled: typeof t.gradientYEnabled == "boolean" ? t.gradientYEnabled : c.gradientYEnabled,
		gradientYMix: l(t.gradientYMix, c.gradientYMix, 0, 1),
		gradientZEnabled: typeof t.gradientZEnabled == "boolean" ? t.gradientZEnabled : c.gradientZEnabled,
		gradientZStrength: l(t.gradientZStrength, c.gradientZStrength, 0, 10),
		gradientZCenter: l(t.gradientZCenter, c.gradientZCenter, -10, 10),
		gradientZWidth: l(t.gradientZWidth, c.gradientZWidth, .01, 20),
		backgroundColor: h(t.backgroundColor, c.backgroundColor),
		noiseScaleX: l(t.noiseScaleX, c.noiseScaleX, 1e-5, 1),
		noiseScaleY: l(t.noiseScaleY, c.noiseScaleY, 1e-4, 2),
		speed: l(t.speed, c.speed, 0, 40),
		drift: l(t.drift, c.drift, 0, 20),
		stippleSize: l(t.stippleSize, c.stippleSize, 0, 80),
		stippleGap: l(t.stippleGap, c.stippleGap, 0, 80),
		rotateX: l(t.rotateX, c.rotateX, -89, 89),
		rotateY: l(t.rotateY, c.rotateY, -180, 180),
		rotateZ: l(t.rotateZ, c.rotateZ, -720, 720),
		panX: l(t.panX, c.panX, -400, 400),
		panY: l(t.panY, c.panY, -400, 400),
		panZ: l(t.panZ, c.panZ, -20, 20),
		viewDistance: l(t.viewDistance, c.viewDistance, .1, 1e3)
	};
}
var S = -1.8, C = 2.8, w = 6.8;
function T(e) {
	let t = e.replace("#", "");
	return {
		r: Number.parseInt(t.slice(0, 2), 16),
		g: Number.parseInt(t.slice(2, 4), 16),
		b: Number.parseInt(t.slice(4, 6), 16)
	};
}
function E(e, t, n) {
	return e + (t - e) * n;
}
function D(e, t, n) {
	return {
		r: E(e.r, t.r, n),
		g: E(e.g, t.g, n),
		b: E(e.b, t.b, n)
	};
}
function O(e) {
	let t = (e) => Math.round(Math.max(0, Math.min(255, e))).toString(16).padStart(2, "0");
	return `#${t(e.r)}${t(e.g)}${t(e.b)}`;
}
function k(e, t, n, r = 1, i = w) {
	let a = 0;
	a += .42 * Math.sin(e * .42 + t * .3 + n * .09), a += .28 * Math.sin(e * .95 - t * .48 + n * .06 + 1), a += .16 * Math.sin(e * 1.65 + t * .95 - n * .14 + .5), a += .11 * Math.sin(e * 2.3 - t * 1.35 + n * .11 - .7), a += .07 * Math.sin(e * 3.1 + t * 1.8 - n * .2 + 1.8), a += .045 * Math.sin(e * 4.2 - t * 2.4 + n * .26 + .9), a += .025 * Math.sin(e * 5.6 + t * 3.1 - n * .33), a += .015 * Math.sin(e * 7 - t * 3.8 + n * .41), a += .05 * Math.sin(t * 1.9 + n * .19) * Math.sin(e * .3 + .4), a += .03 * Math.sin(t * 2.9 - n * .27) * Math.cos(e * .45);
	let o = 8.5 / w * i, s = 3.8 / w * i, c = Math.max(0, Math.min(1, (o - Math.abs(e)) / Math.max(1e-6, o - s)));
	return a *= c * c * (3 - 2 * c), a * r;
}
function A(e, t) {
	return w * Math.max(1, Math.max(1, e) / Math.max(1, t));
}
function j(e, t) {
	let n = Math.cos(t), r = Math.sin(t);
	return {
		x: e.x,
		y: e.y * n - e.z * r,
		z: e.y * r + e.z * n
	};
}
function M(e, t) {
	let n = Math.cos(t), r = Math.sin(t);
	return {
		x: e.x * n + e.z * r,
		y: e.y,
		z: -e.x * r + e.z * n
	};
}
function N(e, t) {
	let n = Math.cos(t), r = Math.sin(t);
	return {
		x: e.x * n - e.y * r,
		y: e.x * r + e.y * n,
		z: e.z
	};
}
function P(e, t, n) {
	let r = e * n.edgeSpeed;
	return {
		left: n.leftHeight + Math.sin(r + t) * n.edgeFluctuation,
		right: n.rightHeight + Math.sin(r * .87 + t * 1.13 + 2.1) * n.edgeFluctuation
	};
}
function ee(e, t, n) {
	return t <= 0 ? 0 : e / t * n;
}
function te(e, t) {
	return e * t;
}
function ne(e, t, n) {
	return (Number.isFinite(e) ? e : 0) + (Number.isFinite(t) ? Math.max(0, t) : 0) * (Number.isFinite(n) ? Math.max(0, n) : 0);
}
function F(e, t, n, r = .16) {
	let i = Math.max(.01, r), a = (e - t) / i;
	return n * Math.exp(-.5 * a * a);
}
function I(e, t) {
	return F(e, t.bendPosition, t.bendAmount) + F(e, t.bend2Position, t.bend2Amount) + F(e, t.bend3Position, t.bend3Amount);
}
function L(e, t) {
	let n = 0;
	return t.depthAmount > 0 && (n += t.depthAmount * F(e, t.depthPosition, 1, t.depthWidth)), t.depth2Amount > 0 && (n += t.depth2Amount * F(e, t.depth2Position, 1, t.depth2Width)), 1 + n;
}
function R(e, t) {
	let n = Math.max(0, Math.min(1, e));
	for (let e = 0; e < t.length - 1; e += 1) {
		let [r, i] = t[e], [a, o] = t[e + 1];
		if (n >= r && n <= a) {
			let e = d(r, a, n);
			return i + (o - i) * e;
		}
	}
	return t[t.length - 1][1];
}
function z(e, t, n, r, i, a, o, s = 0) {
	let c = (e - .5 * t) / Math.max(1, n), l = .2 * a + Math.PI * 2 * r / Math.max(1, i), u = Math.max(1, Math.min(10, 1 + o.wrinkles * 1.6)), d = 0;
	switch (s) {
		case 0:
			d = Math.sin(l + 11 * c) - 4 * c * Math.cos(l * .5);
			break;
		case 1:
			d = Math.sin(u * l + 11 * c) - 4 * c * Math.cos(l * .5);
			break;
		case 2:
			d = Math.sin(u * l + 11 * c) - 4 * c * Math.cos(l);
			break;
		default:
			d = 0;
			break;
	}
	let f = .25 * d;
	return n * o.centerY - f * n;
}
function B(e, t, n, r, i = 0, a = 40) {
	let o = 1600, s = t * Math.max(1, a);
	return z(e * o, o, 320, s, a, n, r, i) / 320;
}
function V(e) {
	let t = Math.round(e);
	return t === 3 ? 0 : t === 4 ? 1 : t === 5 ? 2 : null;
}
function H(e, t, n) {
	let r = Math.max(0, Math.min(1, e)), i = Math.round(Math.max(0, Math.min(2, t.depthTerrain))), a = .55, o = .55 + t.amplitude * 1.35, s = 0;
	switch (i) {
		case 0:
			a = R(r, [
				[0, .58],
				[.1, .74],
				[.22, .88],
				[.36, .7],
				[.48, .9],
				[.6, .52],
				[.72, .3],
				[.86, .2],
				[1, .38]
			]), s = o * 1.35 * (-.11 * Math.sin(r * Math.PI * 2.2 + .3) + -.09 * Math.sin(r * Math.PI * 3.8 + 1) + -.07 * Math.sin(r * Math.PI * 5.6 + 2.1) + -.045 * Math.sin(r * Math.PI * 8 + n * .25));
			break;
		case 1:
			a = R(r, [
				[0, .42],
				[.12, .68],
				[.24, .95],
				[.34, .55],
				[.42, .98],
				[.52, .35],
				[.62, .12],
				[.74, .45],
				[.86, .08],
				[1, .4]
			]), s = o * 1.85 * (-.14 * Math.sin(r * Math.PI * 3.6 + .15) + -.12 * Math.sin(r * Math.PI * 6.4 + 1.3) + -.1 * Math.sin(r * Math.PI * 9.8 + 2.4) + -.07 * Math.sin(r * Math.PI * 13.5 + n * .2) + -.05 * Math.sin(r * Math.PI * 17.2 + .8));
			break;
		case 2:
			a = R(r, [
				[0, .5],
				[.15, .62],
				[.35, .92],
				[.55, .78],
				[.72, .22],
				[.88, .35],
				[1, .48]
			]), s = o * 1.2 * (-.16 * Math.sin(r * Math.PI * 1.2 + .2) + -.09 * Math.sin(r * Math.PI * 2 + 1.4) + -.04 * Math.sin(r * Math.PI * 3.1 + .7));
			break;
		default:
			s = 0;
			break;
	}
	let c = P(n, 0, t), l = (c.left - .55) * (1 - r) + (c.right - .4) * r, u = I(r, t) * 1.15, d = a + s + l * .3 + u;
	return t.centerY + (d - .55) * t.scale;
}
function U(e, t) {
	let n = Math.max(0, Math.min(1, e)), r = R(n, [
		[0, .14],
		[.15, .17],
		[.3, .22],
		[.42, .1],
		[.55, .24],
		[.72, .4],
		[.88, .38],
		[1, .36]
	]), i = .85 + t.amplitude * .45, a = 1 + t.depthSpread * .7 * d(.12, 1, n) ** .7, o = 1 + (L(n, t) - 1) * .1, s = 1 - t.edgeTaper * .08 * (1 - Math.sin(Math.PI * n));
	return Math.min(.3, Math.max(.06, r * i * a * o * s));
}
function W(e, t, n) {
	let r = Math.max(0, Math.min(1, e)), i = Math.exp(-(((r - .42) / .09) ** 2)), a = d(.52, .96, r) ** 1.1, o = .3 + t.twist * (.7 * i - .28 * a);
	return Math.max(.2, Math.min(1.25, o)) + n * .02;
}
function G(e) {
	return Math.abs(Math.cos(e));
}
function re(e) {
	return d(.06, .75, Math.max(0, Math.min(1, e))) ** .8;
}
function ie(e, t, n, r) {
	let i = Math.max(0, Math.min(1, t)), a = W(i, n, r), o = (e + 1) * .5, s = o < .5 ? .5 * (o * 2) ** 1.45 : 1 - .5 * ((1 - o) * 2) ** 1.45, c = e * Math.sin(a) * .05, l = .06 * d(.55, 1, i) ** 1.25, u = v(L(i, n), n), f = (s - .5) * u * .22, p = .02 + .9 * s + c + l + f;
	return Math.max(0, Math.min(1, p));
}
function ae(e) {
	return (1 - e) ** .68;
}
function oe(e, t, n = "#ffffff") {
	return _(e, n, Math.max(0, Math.min(1, t)));
}
function se(e) {
	return .1 + 3.8 * e ** 1.4;
}
function ce(e, t) {
	let n = Math.max(0, Math.min(2, t));
	return n <= .001 ? Math.max(-1, Math.min(1, e)) : (e < 0 ? -1 : 1) * Math.abs(e) ** +Math.max(.28, 1 - n * .42);
}
function le(e, t, n, r = .9, i = 3.1) {
	let a = Math.max(0, Math.min(1, t)), o = Math.max(0, Math.min(2.5, r)), s = .62 + (.46 * m(a * 1.65 + i * .2, i * .71, .33) + .34 * m(a * 3.6 + 1.3, i * 1.4, .88) + .2 * m(a * 7.8 + .6, i * .5, 1.6)) * (.55 + o * .45), c = (m(a * 2.7 + n * .67, n * 1.19 + i, 1.35) - .5) * (.2 + o * .22) + (m(a * 6 + n * .31, i + 2.4, .55) - .5) * (.1 + o * .14), l = Math.tanh(e * s + c * o) * 1.12;
	return e * .62 + l * .38;
}
function K(e, t, n = 1, r = 2.4) {
	let i = Math.max(0, Math.min(1, e)), a = Math.max(-1, Math.min(1, t)), o = Math.max(.45, Math.min(3.2, n)), s = 2.6 / o, c = 4.6 / o, l = m(i * s + r, a * c, .2), u = m(s * 1.6 * i + r * 1.3, c * 1.4 * a + .55, .72);
	return d(.26, .7, .55 * l + .45 * u) ** 1.05;
}
function q(e, t, n = 1, r = 3.1) {
	let i = Math.max(0, Math.min(1, e)), a = Math.max(-1, Math.min(1, t)), o = Math.max(.45, Math.min(3.2, n)), s = .2 * o, c = 0, l = 0;
	for (let e = 0; e < 5; e += 1) {
		let t = -.9 + e / 4 * 1.8, n = Math.exp(-(((a - t) / s) ** 2)), u = r * .85 + e * 2.85, d = .55 * Math.sin(i * Math.PI * (2.8 + e * .85) + u) + .3 * Math.sin(i * Math.PI * (4.6 + e * .55) + u * 1.55) + .15 * Math.sin(i * Math.PI * (1.6 + e * .3) + u * .7), f = .45 + .55 * m(1.1 / o * i + r + e * .7, t * 2.4, .4);
		c += n * d * f, l += n;
	}
	let u = l > 1e-6 ? c / l : 0;
	return Math.tanh(u * 1.85);
}
function ue(e, t, n, r, i, a = 1, o = 2.4) {
	let s = K(e, t, a, o), c = q(e, t, a, o + 1.7) * (.4 + .6 * s), l = .22 + r * .2 + i * 2.6;
	return c * n * l;
}
function de(e, t = .55, n = 2.1) {
	let r = Math.max(1, Math.round(e));
	if (r === 1) return [0];
	let i = Math.max(0, Math.min(1.5, t)), a = [];
	for (let e = 0; e < r; e += 1) {
		let t = m(e * .41 + n, n * 1.7, .63), r = m(e * .19, n + 4.2, 1.1);
		a.push(Math.max(.2, .48 + i * (t * 1.15 - .28) + i * .4 * (r > .78 ? r * .85 : 0)));
	}
	let o = a.reduce((e, t) => e + t, 0), s = 0;
	return a.map((e) => {
		let t = s + e * .5;
		return s += e, t / o * 2 - 1;
	});
}
function fe(e, t, n, r = .5, i = 1, a = 0) {
	let o = 1 - e, s = t * (.08 + n * .1) * Math.min(1.4, .7 + i * .15), c = d(.38, 1, r) ** 1.15, l = Math.sin(Math.PI * r), u = o * c * s * 1.05, f = -e * c * s * .55, p = Math.round(Math.max(0, Math.min(2, a))), m = 0;
	switch (p) {
		case 0: {
			let t = -Math.cos((r - .12) * Math.PI * 2.4), n = -Math.cos((r - .4) * Math.PI * 3.6), i = -Math.cos((r - .68) * Math.PI * 2.9), a = .5 * t + .35 * n + .3 * i;
			m = (e * a * .45 + -.55 * a * o * (1 - c * .65)) * s * .32, m += e * l * (1 - c) * s * .1;
			break;
		}
		case 1: {
			let t = Math.sin(r * Math.PI * 5.2 + o * 1.7), n = Math.sin(r * Math.PI * 8.4 + e * 2.4), i = Math.sin(r * Math.PI * 3.1 + .9);
			m = (o * (.55 * t + .4 * n) + e * (-.35 * t + .25 * i)) * s * .42, m += o * d(.2, .85, r) ** 1.1 * s * .18;
			break;
		}
		case 2: {
			let t = d(.15, 1, r) ** 1.6;
			m = o * (-.35 + t * 1.25) * s * .7, m += e * (.22 - t * .55) * s * .45, m += o * Math.sin(r * Math.PI * 1.6) * s * .08;
			break;
		}
		default:
			m = 0;
			break;
	}
	return u + f + m;
}
function pe(e, t = 6) {
	if (e.length < 3 || t <= 0) return;
	let n = e.map((e) => e.y), r = Math.max(.75, t * .45), i = Array(n.length);
	for (let e = 0; e < n.length; e += 1) {
		let a = 0, o = 0;
		for (let i = -t; i <= t; i += 1) {
			let t = Math.min(n.length - 1, Math.max(0, e + i)), s = Math.exp(-i * i / (2 * r * r));
			a += n[t] * s, o += s;
		}
		i[e] = a / Math.max(1e-6, o);
	}
	for (let t = 0; t < e.length; t += 1) e[t].y = i[t];
}
function me(e, t, n, r = c) {
	let i = Math.max(1, Math.round(e)), a = Math.max(1, Math.round(t)), o = x(r), s = te(n, o.speed), l = Math.max(1, o.lineCount), u = Math.max(160, Math.min(720, Math.round(i / Math.max(2, o.pointSpacing)))), d = o.rotateXDeg * Math.PI / 180, p = o.rotateYDeg * Math.PI / 180, m = o.rotateZDeg * Math.PI / 180, h = w, g = o.camDist, _ = o.fov, v = o.scale, y = [];
	for (let e = 0; e < l; e += 1) {
		let t = l <= 1 ? .9999999999999998 * .5 : S + (C - S) * e / (l - 1), n = [];
		for (let e = 0; e < u; e += 1) {
			let r = u <= 1 ? 0 : e / (u - 1) * 2 - 1, i = r * h, a = k(i, t, s, o.amplitude, h), c = {
				x: i,
				y: a,
				z: t
			};
			c = j(c, d), c = M(c, p), c = N(c, m), n.push({
				...c,
				u: r,
				origX: i,
				origY: a,
				origZ: t
			});
		}
		y.push(n);
	}
	let E = Infinity, A = -Infinity;
	for (let e of y) for (let t of e) {
		let e = g + t.z;
		if (e < .4) continue;
		let n = t.x / e * _;
		n < E && (E = n), n > A && (A = n);
	}
	let P = Math.max(.001, A - E), ee = 1.88 * v / Math.max(.001, P), ne = (E + A) * .5, F = T(o.colorFar), I = T(o.colorNear), L = T(o.colorEdge), R = T(o.colorNear), z = T(o.color), B = T(o.backgroundColor), V = [];
	for (let e = 0; e < y.length; e += 1) {
		let t = y[e], n = l <= 1 ? 0 : e / (l - 1) * 2 - 1, r = [], s = 0, c = 0, u = 0, d = 0, p = 0, m = 0;
		for (let e = 0; e < t.length; e += 1) {
			let n = t[e], l = g + n.z;
			if (l < .4) continue;
			let y = f(3.2, .3, Math.abs(n.origZ + .15));
			y *= f(1.12, .58, Math.abs(n.u)), y *= f(.2, 1, l / 14);
			let x = b(o), w = 1;
			if (x && o.gradientZEnabled) {
				let e = (n.origZ - S) / (C - S) * 2 - 1;
				e = (e - o.gradientZCenter) / Math.max(.05, o.gradientZWidth), w = Math.max(0, Math.min(1, f(1.2, -.2, e)));
			}
			let T = { ...z };
			if (x && o.gradientXEnabled) {
				let e = n.origX / h * .5 + .5, t = D(F, I, Math.max(0, Math.min(1, e)));
				T = D(T, t, o.gradientXMix);
			}
			if (x && o.gradientYEnabled && o.gradientYMix > 0) {
				let e = n.origY / (.55 * o.amplitude + .01), t = f(.15, .7, Math.min(1, Math.abs(e))) * o.gradientYMix;
				t > .001 && (T = D(T, e >= 0 ? L : R, t));
			}
			if (x && o.gradientZEnabled && o.gradientZStrength > 0) {
				let e = (1 - w) * Math.min(1, o.gradientZStrength);
				T = D(T, B, e);
			}
			if (y < .008) continue;
			let E = (n.x / l * _ - ne) * ee, k = n.y / l * _ * 1.25 * v, A = (E * .5 + .5) * i, j = (.5 - k * .5) * a, M = Math.max(0, Math.min(1, 1 - (l - 8) / 6)), N = O(T);
			r.push({
				x: A,
				y: j,
				depth: l,
				along: (n.u + 1) * .5,
				nearness: M,
				alpha: y,
				color: N
			}), s += y, c += l, u += T.r, d += T.g, p += T.b, m += 1;
		}
		if (r.length < 2) continue;
		let x = s / Math.max(1, m);
		if (x < .01) continue;
		let w = c / Math.max(1, m), T = g / Math.max(.4, w), E = o.lineWidth * (1 + (T - 1) * o.perspectiveWidth), k = Math.max(o.minLineWidth, Math.min(o.maxLineWidth, E)), A = Math.max(0, Math.min(1, 1 - (w - 8) / 6)), j = O({
			r: u / m,
			g: d / m,
			b: p / m
		});
		V.push({
			across: n,
			opacity: Math.min(1, x * 1.45) * o.opacity,
			color: j,
			nearness: A,
			strokeWidth: k,
			points: r
		});
	}
	let H = a * o.centerY;
	for (let e = 0; e < 4; e += 1) {
		let e = 0, t = 0;
		for (let n of V) for (let r of n.points) r.y >= 0 && r.y <= a && (e += r.y, t += 1);
		if (t <= 0) break;
		let n = H - e / t;
		if (Math.abs(n) < .25) break;
		for (let e of V) for (let t of e.points) t.y += n;
	}
	let U = Math.max(.05, Math.min(20, Math.exp(-o.panZ * .35))), W = i * .5, G = a * o.centerY;
	if (U !== 1 || o.panX !== 0 || o.panY !== 0) for (let e of V) for (let t of e.points) t.x = W + (t.x - W) * U + o.panX, t.y = G + (t.y - G) * U + o.panY;
	return {
		settings: o,
		lines: V
	};
}
function J(e, t) {
	if (e.length < 2 || t <= 0) return null;
	let n = t * .5, r = [], i = [];
	for (let t = 0; t < e.length; t += 1) {
		let a = e[t], o = e[Math.max(0, t - 1)], s = e[Math.min(e.length - 1, t + 1)], c = s.x - o.x, l = s.y - o.y, u = Math.hypot(c, l);
		u < 1e-8 ? (c = 1, l = 0) : (c /= u, l /= u), r.push({
			x: a.x + -l * n,
			y: a.y + c * n
		}), i.push({
			x: a.x - -l * n,
			y: a.y - c * n
		});
	}
	return [...r, ...i.reverse()];
}
function Y(e) {
	return e.getContext("2d");
}
function he(e, t) {
	if (typeof document < "u") {
		let n = document.createElement("canvas");
		return n.width = e, n.height = t, n;
	}
	return new OffscreenCanvas(e, t);
}
function X(e, t, n) {
	let r = J(t, n);
	if (!(!r || r.length < 3)) {
		e.beginPath(), e.moveTo(r[0].x, r[0].y);
		for (let t = 1; t < r.length; t += 1) e.lineTo(r[t].x, r[t].y);
		e.closePath(), e.fill();
	}
}
function ge(e, t) {
	if (e.length === 0) return null;
	let n = Infinity, r = -Infinity;
	for (let t of e) t.x < n && (n = t.x), t.x > r && (r = t.x);
	let i = Math.max(0, t) * .5, a = n - i;
	return {
		x1: a,
		x2: Math.max(r + i, a + .001)
	};
}
function _e(e, t) {
	if (e.length === 0) return null;
	let n = Infinity, r = Infinity, i = -Infinity, a = -Infinity;
	for (let t of e) t.x < n && (n = t.x), t.y < r && (r = t.y), t.x > i && (i = t.x), t.y > a && (a = t.y);
	let o = Math.max(0, t) * .5, s = n - o, c = r - o;
	return {
		x1: s,
		y1: c,
		x2: Math.max(i + o, s + .001),
		y2: Math.max(a + o, c + .001)
	};
}
var Z = null, Q = null;
function ve(n) {
	let r = e(n);
	if (Z && Z.key === r) return Z.canvas;
	let i = Z?.canvas ?? he(160, 100);
	i.width = 160, i.height = 100;
	let a = Y(i);
	if (!a) return null;
	let o = t(n, i.width, i.height), s = a.createImageData(i.width, i.height);
	return s.data.set(o), a.putImageData(s, 0, 0), Z = {
		key: r,
		canvas: i
	}, Q = null, i;
}
function ye(t, n, r) {
	let i = ve(t);
	if (!i) return null;
	let a = e(t);
	if (Q && Q.key === a && Q.width === n && Q.height === r) return Q.canvas;
	let o = Q?.canvas ?? he(n, r);
	o.width !== n && (o.width = n), o.height !== r && (o.height = r);
	let s = Y(o);
	return s ? (s.clearRect(0, 0, n, r), s.drawImage(i, 0, 0, n, r), Q = {
		key: a,
		width: n,
		height: r,
		canvas: o
	}, o) : null;
}
function be(e, t, n) {
	let r = J(t, n);
	if (!r || r.length < 3) return !1;
	e.beginPath(), e.moveTo(r[0].x, r[0].y);
	for (let t = 1; t < r.length; t += 1) e.lineTo(r[t].x, r[t].y);
	return e.closePath(), e.clip(), !0;
}
function xe(e, t, n, i, a = c) {
	let s = Math.max(1, Math.round(t)), l = Math.max(1, Math.round(n));
	e.width !== s && (e.width = s), e.height !== l && (e.height = l);
	let u = Y(e);
	if (!u) return;
	let { settings: d, lines: f } = me(s, l, i, a);
	u.clearRect(0, 0, s, l), u.save(), u.lineJoin = "round", u.lineCap = "butt", u.setLineDash([]);
	let p = [...f].sort((e, t) => e.nearness - t.nearness), m = y(d), h = d.gradientStops, g = o(m) ? ve(h) : null, _ = m === "sharedLinear" ? (() => {
		let e = u.createLinearGradient(0, 0, s, 0);
		return r(e, h), e;
	})() : null;
	if (m === "sharedGradient" && g) {
		let e = ye(h, s, l) ?? g;
		for (let e of p) {
			if (e.points.length < 2) continue;
			let t = Math.max(d.minLineWidth, e.strokeWidth);
			u.globalAlpha = Math.max(.01, Math.min(1, e.opacity)), u.fillStyle = "#ffffff", X(u, e.points, t);
		}
		u.globalAlpha = 1, u.globalCompositeOperation = "source-in", u.drawImage(e, 0, 0, s, l), u.globalCompositeOperation = "source-over", u.restore();
		return;
	}
	for (let e of p) {
		if (e.points.length < 2) continue;
		let t = Math.max(d.minLineWidth, e.strokeWidth);
		switch (u.lineWidth = t, m) {
			case "solid":
				u.strokeStyle = e.color, u.globalAlpha = Math.max(.01, Math.min(1, e.opacity)), u.beginPath(), u.moveTo(e.points[0].x, e.points[0].y);
				for (let t = 1; t < e.points.length; t += 1) u.lineTo(e.points[t].x, e.points[t].y);
				u.stroke();
				break;
			case "sharedLinear":
				u.fillStyle = _ ?? d.colorNear, u.globalAlpha = Math.max(.01, Math.min(1, e.opacity)), X(u, e.points, t);
				break;
			case "sharedGradient":
				u.save(), u.globalAlpha = Math.max(.01, Math.min(1, e.opacity)), g && be(u, e.points, t) ? u.drawImage(g, 0, 0, s, l) : (u.fillStyle = d.colorNear, X(u, e.points, t)), u.restore();
				break;
			case "fiberGradient": {
				let n = _e(e.points, t);
				u.save(), u.globalAlpha = Math.max(.01, Math.min(1, e.opacity)), g && n && be(u, e.points, t) ? u.drawImage(g, n.x1, n.y1, n.x2 - n.x1, n.y2 - n.y1) : (u.fillStyle = d.colorNear, X(u, e.points, t)), u.restore();
				break;
			}
			case "baked":
				for (let t = 1; t < e.points.length; t += 1) {
					let n = e.points[t - 1], r = e.points[t], i = n.alpha ?? e.opacity, a = r.alpha ?? e.opacity;
					if (i < .008 || a < .008) continue;
					let o = Math.min(1, (i + a) * .5 * 1.45 * d.opacity);
					o < .01 || (u.strokeStyle = O(D(T(n.color ?? e.color), T(r.color ?? e.color), .5)), u.globalAlpha = o, u.beginPath(), u.moveTo(n.x, n.y), u.lineTo(r.x, r.y), u.stroke());
				}
				break;
			default: break;
		}
	}
	u.restore();
}
function Se(e) {
	Y(e)?.clearRect(0, 0, e.width, e.height);
}
function $(e, t, n, r) {
	return {
		cp1x: t.x + (n.x - e.x) / 4,
		cp1y: t.y + (n.y - e.y) / 4,
		cp2x: n.x - (r.x - t.x) / 4,
		cp2y: n.y - (r.y - t.y) / 4
	};
}
function Ce(e, t) {
	if (t.length < 2) return;
	let n = t[0];
	if (e.moveTo(n.x, n.y), t.length === 2) {
		let n = t[1];
		e.lineTo(n.x, n.y);
		return;
	}
	for (let n = 0; n < t.length - 1; n += 1) {
		let r = t[Math.max(0, n - 1)], i = t[n], a = t[n + 1], o = t[Math.min(t.length - 1, n + 2)], s = $(r, i, a, o);
		e.bezierCurveTo(s.cp1x, s.cp1y, s.cp2x, s.cp2y, a.x, a.y);
	}
}
function we(e) {
	if (e.length === 0) return "";
	let t = (e) => Number(e.toFixed(2)).toString(), n = e[0];
	if (e.length === 1) return `M${t(n.x)} ${t(n.y)}`;
	if (e.length === 2) {
		let r = e[1];
		return `M${t(n.x)} ${t(n.y)} L${t(r.x)} ${t(r.y)}`;
	}
	let r = `M${t(n.x)} ${t(n.y)}`;
	for (let n = 0; n < e.length - 1; n += 1) {
		let i = e[Math.max(0, n - 1)], a = e[n], o = e[n + 1], s = e[Math.min(e.length - 1, n + 2)], c = $(i, a, o, s);
		r += ` C${t(c.cp1x)} ${t(c.cp1y)} ${t(c.cp2x)} ${t(c.cp2y)} ${t(o.x)} ${t(o.y)}`;
	}
	return r;
}
//#endregion
export { c as TWIZZLER_DEFAULTS, a as TWIZZLER_RIBBON_COLOR_MODES, ne as advanceTwizzlerAnimationTime, me as buildTwizzlerLines, Se as clearTwizzler, h as normalizeTwizzlerColor, x as normalizeTwizzlerSettings, A as orangeWaveXRangeForCanvas, k as orangeWaveY, J as outlinePolylinePolygon, xe as renderTwizzler, y as resolveTwizzlerRibbonColorMode, ge as ribbonGradientXSpan, _e as ribbonGradientXYSpan, K as twizzlerAmpHeat, ue as twizzlerAmpNoiseY, q as twizzlerAmpSwell, te as twizzlerAnimationTime, F as twizzlerBendOffset, re as twizzlerColorT, $ as twizzlerCubicControls, L as twizzlerDepthScale, fe as twizzlerDepthYBias, P as twizzlerEdgeHeights, ce as twizzlerExpandAcross, G as twizzlerFaceAmount, ie as twizzlerFiberNearness, ae as twizzlerFogAmount, oe as twizzlerFogColor, le as twizzlerGapWarpedAcross, _ as twizzlerLerpColor, H as twizzlerMarketingCenterY, W as twizzlerMarketingTwist, U as twizzlerMarketingWidth, v as twizzlerNearness, m as twizzlerNoise, I as twizzlerPathBend, ee as twizzlerPointX, z as twizzlerShaderPackPixelY, V as twizzlerShaderPackRecipe, B as twizzlerShaderPackY, pe as twizzlerSoftenFiberCorners, se as twizzlerStrokeWidthScale, we as twizzlerSvgPathCubic, Ce as twizzlerTraceCubic, de as twizzlerUnevenAcross, o as twizzlerUsesFieldGradient, b as twizzlerUsesLineGradients, s as twizzlerUsesLinearRamp };
