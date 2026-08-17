//#region src/palette.ts
var e = [
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
function t(t) {
	let n = new Set(t.map((e) => e.toLowerCase()));
	return e.find((e) => !n.has(e)) ?? e[t.length % e.length] ?? "#f46021";
}
//#endregion
//#region src/pngRgba.ts
var n = new Uint8Array([
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10
]), r = new Uint32Array(256);
for (let e = 0; e < 256; e += 1) {
	let t = e;
	for (let e = 0; e < 8; e += 1) t = t & 1 ? 3988292384 ^ t >>> 1 : t >>> 1;
	r[e] = t >>> 0;
}
function i(e) {
	let t = 4294967295;
	for (let n of e) t = r[(t ^ n) & 255] ^ t >>> 8;
	return (t ^ 4294967295) >>> 0;
}
function a(e) {
	let t = 1, n = 0;
	for (let r of e) t = (t + r) % 65521, n = (n + t) % 65521;
	return (n << 16 | t) >>> 0;
}
function o(e) {
	return new Uint8Array([
		e >>> 24 & 255,
		e >>> 16 & 255,
		e >>> 8 & 255,
		e & 255
	]);
}
function s(e) {
	let t = new Uint8Array(e.reduce((e, t) => e + t.length, 0)), n = 0;
	for (let r of e) t.set(r, n), n += r.length;
	return t;
}
function c(e, t) {
	let n = s([new Uint8Array([...e].map((e) => e.charCodeAt(0))), t]);
	return s([
		o(t.length),
		n,
		o(i(n))
	]);
}
function l(e) {
	let t = [new Uint8Array([120, 1])];
	for (let n = 0; n < e.length;) {
		let r = Math.min(65535, e.length - n), i = +(n + r >= e.length), a = 65535 ^ r;
		t.push(new Uint8Array([
			i,
			r & 255,
			r >>> 8 & 255,
			a & 255,
			a >>> 8 & 255
		]), e.subarray(n, n + r)), n += r;
	}
	return t.push(o(a(e))), s(t);
}
function u(e) {
	let t = "";
	for (let n = 0; n < e.length; n += 32768) t += String.fromCharCode(...e.subarray(n, n + 32768));
	return btoa(t);
}
function d(e, t, r) {
	let i = Math.max(1, Math.round(t)), a = Math.max(1, Math.round(r)), d = i * 4, f = new Uint8Array((d + 1) * a);
	for (let t = 0; t < a; t += 1) {
		let n = t * (d + 1);
		f[n] = 0, f.set(e.subarray(t * d, t * d + d), n + 1);
	}
	return `data:image/png;base64,${u(s([
		n,
		c("IHDR", s([
			o(i),
			o(a),
			new Uint8Array([
				8,
				6,
				0,
				0,
				0
			])
		])),
		c("IDAT", l(f)),
		c("IEND", new Uint8Array())
	]))}`;
}
//#endregion
//#region src/twizzlerGradient.ts
var f = 1, p = 16, m = 160, h = 100, g = 48, _ = 32, v = 26, ee = 2, y = 1e-12, b = /^#[0-9a-f]{6}$/i;
function x(e) {
	return Math.min(1, Math.max(0, e));
}
function S(e) {
	return typeof e == "number" && Number.isFinite(e);
}
function C(e, t) {
	return typeof e == "string" && b.test(e) ? e.toLowerCase() : typeof t == "string" && b.test(t) ? t.toLowerCase() : "#f46021";
}
function w(e) {
	let t = C(e, "#f46021").slice(1);
	return {
		r: Number.parseInt(t.slice(0, 2), 16),
		g: Number.parseInt(t.slice(2, 4), 16),
		b: Number.parseInt(t.slice(4, 6), 16)
	};
}
function T(e) {
	let t = (e) => Math.round(Math.min(255, Math.max(0, e))).toString(16).padStart(2, "0");
	return `#${t(e.r)}${t(e.g)}${t(e.b)}`;
}
var E = 0;
function D(e = 0) {
	return E += 1, `g${(e + E).toString(36)}`;
}
function O(e, t) {
	return [{
		id: "far",
		x: 0,
		y: .5,
		offset: 0,
		color: C(e, "#fea700")
	}, {
		id: "near",
		x: 1,
		y: .5,
		offset: 1,
		color: C(t, "#f46021")
	}];
}
function k(e, t, n) {
	return [
		{
			id: "far",
			x: .08,
			y: .78,
			offset: .08,
			color: C(e, "#fea700")
		},
		{
			id: "peak",
			x: .5,
			y: .16,
			offset: .5,
			color: C(n, "#e92e28")
		},
		{
			id: "near",
			x: .92,
			y: .72,
			offset: .92,
			color: C(t, "#f46021")
		}
	];
}
function A(e) {
	return [...e].sort((e, t) => e.x - t.x || e.y - t.y || e.id.localeCompare(t.id));
}
function j(e) {
	return Number(x(e).toFixed(4));
}
function M(e, t, n) {
	if (!e || typeof e != "object") return null;
	let r = e, i = S(r.x) ? r.x : S(r.offset) ? r.offset : null;
	if (i === null) return null;
	let a = j(i), o = S(r.y) ? j(r.y) : .5;
	return {
		id: typeof r.id == "string" && r.id.trim() ? r.id.trim() : `g${t}`,
		x: a,
		y: o,
		offset: a,
		color: C(r.color, n)
	};
}
function N(e, t, n) {
	let r = j(t), i = j(n);
	return {
		...e,
		x: r,
		y: i,
		offset: r
	};
}
function P(e, t, n) {
	let r = C(t, "#fea700"), i = C(n, "#f46021"), a = Array.isArray(e) ? e : [], o = [], s = /* @__PURE__ */ new Set();
	for (let e = 0; e < a.length; e += 1) {
		let t = M(a[e], e, e === 0 ? r : i);
		if (!t) continue;
		let n = t.id;
		if (s.has(n) && (n = `${t.id}-${o.length}`), s.add(n), o.push({
			...t,
			id: n
		}), o.length >= 16) break;
	}
	return o.length < 1 ? O(r, i) : A(o);
}
function F(e, t, n) {
	let r = A(e);
	if (r.length < 1) return O(t, n);
	let i = r.map((e) => ({ ...e }));
	return i[0] = {
		...i[0],
		color: C(t, i[0].color)
	}, i.length === 1 || (i[i.length - 1] = {
		...i[i.length - 1],
		color: C(n, i[i.length - 1].color)
	}), i;
}
function I(e) {
	return JSON.stringify(A(e).map((e) => ({
		id: e.id,
		x: j(e.x),
		y: j(e.y),
		offset: j(e.offset),
		color: e.color
	})));
}
function L(e, t, n) {
	if (Array.isArray(e)) return P(e, t, n);
	if (typeof e != "string" || e.trim() === "") return O(t, n);
	try {
		return P(JSON.parse(e), t, n);
	} catch {
		return O(t, n);
	}
}
function R(e) {
	return e.length > 0 ? [...e] : O("#fea700", "#f46021");
}
function z(e, t, n) {
	let r = R(e), i = x(t), a = x(n);
	if (r.length === 1) return w(r[0].color);
	let o = 0, s = 0, c = 0, l = 0;
	for (let e of r) {
		let t = i - e.x, n = a - e.y, r = t * t + n * n;
		if (r <= y) return w(e.color);
		let u = 1 / r ** (ee / 2), d = w(e.color);
		o += u * d.r, s += u * d.g, c += u * d.b, l += u;
	}
	return l <= 0 ? w(r[0].color) : {
		r: o / l,
		g: s / l,
		b: c / l
	};
}
function B(e, t, n = .5) {
	return T(z(e, t, n));
}
function V(e, t) {
	let n = A(R(e)), r = x(t), i = n[0], a = n[n.length - 1];
	if (r <= i.offset) return i.color;
	if (r >= a.offset) return a.color;
	for (let e = 1; e < n.length; e += 1) {
		let t = n[e - 1], i = n[e];
		if (r <= i.offset) {
			let e = i.offset - t.offset, n = e < 1e-6 ? 1 : (r - t.offset) / e;
			return T(H(w(t.color), w(i.color), n));
		}
	}
	return a.color;
}
function H(e, t, n) {
	return {
		r: e.r + (t.r - e.r) * n,
		g: e.g + (t.g - e.g) * n,
		b: e.b + (t.b - e.b) * n
	};
}
function U(e) {
	return `linear-gradient(90deg, ${A(R(e)).map((e) => `${e.color} ${(e.offset * 100).toFixed(2)}%`).join(", ")})`;
}
function W(e) {
	let t = A(R(e)), n = [], r = -1;
	for (let e of t) {
		let t = x(e.offset);
		t <= r && (t = Math.min(1, r + 1e-4)), n.push({
			...e,
			offset: t,
			x: t
		}), r = t;
	}
	return n;
}
function G(e, t) {
	for (let n of W(t)) e.addColorStop(x(n.offset), n.color);
}
function K(e) {
	return W(e).map((e) => {
		let t = w(e.color);
		return `      <stop offset="${Number(e.offset.toFixed(4)).toString()}" stop-color="rgb(${t.r},${t.g},${t.b})" />`;
	}).join("\n");
}
function q(e, t, n) {
	let r = Math.max(1, Math.round(t)), i = Math.max(1, Math.round(n)), a = new Uint8ClampedArray(r * i * 4);
	for (let t = 0; t < i; t += 1) {
		let n = (t + .5) / i;
		for (let i = 0; i < r; i += 1) {
			let o = z(e, (i + .5) / r, n), s = (t * r + i) * 4;
			a[s] = o.r, a[s + 1] = o.g, a[s + 2] = o.b, a[s + 3] = 255;
		}
	}
	return a;
}
function J(e, t = 3) {
	return Number(e.toFixed(t)).toString();
}
function Y(e, t, n, r, i, a, o = 160, s = 100, c = "") {
	let l = Math.max(r, .001), u = Math.max(i, .001), f = d(q(a, o, s), o, s), p = c.trim() ? ` ${c.trim()}` : "";
	return `    <image id="${e}" href="${f}" xlink:href="${f}" x="${J(t, 1)}" y="${J(n, 1)}" width="${J(l, 1)}" height="${J(u, 1)}" preserveAspectRatio="none"${p} />`;
}
function X(e) {
	for (let [t, n] of [
		[.5, .5],
		[.35, .35],
		[.65, .65],
		[.5, .22],
		[.5, .78],
		[.22, .5],
		[.78, .5],
		[.28, .72],
		[.72, .28]
	]) if (!e.some((e) => Math.hypot(e.x - t, e.y - n) < .08)) return {
		x: t,
		y: n
	};
	let t = e.length;
	return {
		x: x(.12 + t * .17 % .76),
		y: x(.18 + t * .23 % .64)
	};
}
function Z(e, n, r, i) {
	if (e.length >= 16) return [...e];
	let a = S(n) && S(r) ? {
		x: x(n),
		y: x(r)
	} : X(e), o = i ?? t(e.map((e) => e.color)), s = D();
	return [...e, N({
		id: s,
		x: a.x,
		y: a.y,
		offset: a.x,
		color: C(o, "#f46021")
	}, a.x, a.y)];
}
function Q(e, t) {
	if (e.length <= 1) return [...e];
	let n = e.filter((e) => e.id !== t);
	return n.length < 1 ? [...e] : n;
}
function te(e, t, n, r) {
	return e.map((e) => e.id === t ? N(e, n, r) : e);
}
function ne(e, t, n) {
	return e.map((e) => e.id === t ? N(e, n, e.y) : e);
}
function $(e, t, n) {
	return e.map((e) => e.id === t ? {
		...e,
		color: C(n, e.color)
	} : e);
}
function re(e, t, n) {
	return n.width <= 0 || n.height <= 0 ? {
		x: 0,
		y: 0
	} : {
		x: x((e - n.left) / n.width),
		y: x((t - n.top) / n.height)
	};
}
function ie(e, t) {
	return t.width <= 0 ? 0 : x((e - t.left) / t.width);
}
function ae(e, t, n, r = .08) {
	if (e.length === 0) return null;
	let i = null, a = r;
	for (let r of e) {
		let e = Math.hypot(r.x - t, r.y - n);
		e <= a && (a = e, i = r.id);
	}
	return i;
}
function oe(e, t, n, r) {
	return {
		left: e.left + r / t * e.width,
		top: e.top + r / n * e.height,
		width: (t - r * 2) / t * e.width,
		height: (n - r * 2) / n * e.height
	};
}
function se(e, t, n, r, i = 26) {
	if (e.length === 0 || r.width <= 0 || r.height <= 0) return null;
	let a = null, o = i;
	for (let i of e) {
		let e = r.left + i.x * r.width, s = r.top + i.y * r.height, c = Math.hypot(t - e, n - s);
		c <= o && (o = c, a = i.id);
	}
	return a;
}
//#endregion
export { U as A, $ as C, z as D, V as E, K as M, re as N, I as O, F as P, q as S, B as T, se as _, v as a, w as b, Z as c, k as d, O as f, ae as g, ne as h, _ as i, Y as j, A as k, G as l, te as m, m as n, p as o, oe as p, g as r, f as s, h as t, D as u, P as v, Q as w, L as x, ie as y };
