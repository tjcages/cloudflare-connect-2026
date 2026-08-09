//#region src/shared/stats.ts
var e = /* @__PURE__ */ new Set(), t = null, n = 500, r = null;
function i() {
	return e.size > 0;
}
function a() {
	return {
		total: 0,
		rendering: 0,
		paused: 0,
		revealOpen: 0,
		megapixelsPerFrame: 0,
		shadedMegapixelsPerFrame: 0,
		blitsPerSecond: 0,
		sampleMs: n,
		instances: []
	};
}
function o() {
	r || (r = setInterval(() => l(a()), n), l(a()));
}
function s() {
	r && clearInterval(r), r = null;
}
function c(r) {
	t = r, r && e.size > 0 && (s(), r.start(n));
}
function l(t) {
	for (let n of [...e]) n(t);
}
function u(r, i) {
	i?.intervalMs && (n = i.intervalMs);
	let a = e.size === 0;
	return e.add(r), a && (t ? t.start(n) : o()), () => {
		e.delete(r), !(e.size > 0) && (t?.stop(), s());
	};
}
//#endregion
export { l as publishStats, c as setStatsCollector, i as statsEnabled, u as subscribeStripesStats };
