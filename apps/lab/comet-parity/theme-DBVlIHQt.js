//#region src/config/normalize.ts
function e(e, t, n) {
	return e < t ? t : e > n ? n : e;
}
var t = (e, t) => typeof e == "number" && Number.isFinite(e) ? e : t, n = {
	fit: "width",
	zoom: 1,
	panX: 0,
	panY: 0
};
function r(n = {}) {
	return {
		fit: n.fit === "contain" || n.fit === "cover" || n.fit === "stretch" || n.fit === "width" || n.fit === "height" ? n.fit : "width",
		zoom: e(t(n.zoom, 1), .1, 8),
		panX: e(t(n.panX, 0), -1, 1),
		panY: e(t(n.panY, 0), -1, 1)
	};
}
var i = [
	"topToBottom",
	"leftToRight",
	"rightToLeft",
	"bottomToTop"
];
function a(e) {
	return i.indexOf(e);
}
var o = {
	direction: "topToBottom",
	stopCount: 2,
	stops: [
		16777215,
		0,
		0,
		0
	],
	hueDriftDeg: 0,
	saturationBoost: 0
};
function s(n = {}) {
	let r = Array.isArray(n.stops) ? n.stops : [];
	return {
		direction: i.includes(n.direction) ? n.direction : o.direction,
		stopCount: Math.round(e(t(n.stopCount, o.stopCount), 2, 4)),
		stops: [
			0,
			1,
			2,
			3
		].map((n) => Math.round(e(t(r[n], o.stops[n]), 0, 16777215))),
		hueDriftDeg: e(t(n.hueDriftDeg, o.hueDriftDeg), -180, 180),
		saturationBoost: e(t(n.saturationBoost, o.saturationBoost), 0, 1)
	};
}
var c = {
	enabled: !1,
	ratePerSec: 5,
	maxActive: 36,
	radiantAngleDeg: 35,
	angleJitterDeg: 14,
	speedScale: 1,
	speedVariation: .4,
	tailLengthScale: 1,
	tailLengthVariation: .47,
	thicknessScale: 1,
	thicknessVariation: .39,
	lifetimeMinMs: 1e3,
	lifetimeMaxMs: 2400,
	brightness: 1,
	headGlow: 1,
	pushPx: 6,
	pushFalloffScale: 1,
	fadeInMs: 80,
	fadeOutMs: 580,
	seed: 1
};
function l(n = {}) {
	let r = c, i = e(t(n.lifetimeMinMs, r.lifetimeMinMs), 60, 2e4), a = Math.max(i, e(t(n.lifetimeMaxMs, r.lifetimeMaxMs), 60, 2e4));
	return {
		enabled: n.enabled === void 0 ? r.enabled : !!n.enabled,
		ratePerSec: e(t(n.ratePerSec, r.ratePerSec), .02, 120),
		maxActive: z(t(n.maxActive, r.maxActive), 1, 64),
		radiantAngleDeg: e(t(n.radiantAngleDeg, r.radiantAngleDeg), -180, 180),
		angleJitterDeg: e(t(n.angleJitterDeg, r.angleJitterDeg), 0, 90),
		speedScale: e(t(n.speedScale, r.speedScale), .05, 6),
		speedVariation: e(t(n.speedVariation, r.speedVariation), 0, 1),
		tailLengthScale: e(t(n.tailLengthScale, r.tailLengthScale), .05, 6),
		tailLengthVariation: e(t(n.tailLengthVariation, r.tailLengthVariation), 0, 1),
		thicknessScale: e(t(n.thicknessScale, r.thicknessScale), .05, 6),
		thicknessVariation: e(t(n.thicknessVariation, r.thicknessVariation), 0, 1),
		lifetimeMinMs: i,
		lifetimeMaxMs: a,
		brightness: e(t(n.brightness, r.brightness), 0, 4),
		headGlow: e(t(n.headGlow, r.headGlow), 0, 4),
		pushPx: e(t(n.pushPx, r.pushPx), 0, 80),
		pushFalloffScale: e(t(n.pushFalloffScale, r.pushFalloffScale), .05, 8),
		fadeInMs: e(t(n.fadeInMs, r.fadeInMs), 0, 1e4),
		fadeOutMs: e(t(n.fadeOutMs, r.fadeOutMs), 0, 1e4),
		seed: z(t(n.seed, r.seed), 0, 1e6)
	};
}
var u = {
	color: 16777215,
	transparent: !0,
	gradient: {
		enabled: !1,
		...o,
		stops: [...o.stops]
	},
	grid: {
		enabled: !1,
		cellWidth: 96,
		cellHeight: 96,
		gapX: 8,
		gapY: 8,
		cornerRadius: 0,
		color: 15987699,
		opacity: 1
	},
	stars: {
		enabled: !1,
		density: 50,
		sizePx: 8,
		sizeRandomness: .65,
		tiltAngleDeg: 0,
		twinkleSpeed: 1,
		twinkleAmount: .7,
		opacity: .8,
		color: 16777215
	},
	meteors: { ...c }
};
function d(n = {}) {
	let r = n.grid ?? {}, i = n.stars ?? {}, a = n.gradient ?? {}, o = e(Math.round(t(r.cellWidth, u.grid.cellWidth)), 4, 512), c = e(Math.round(t(r.cellHeight, u.grid.cellHeight)), 4, 512);
	return {
		color: Math.round(e(t(n.color, u.color), 0, 16777215)),
		transparent: n.transparent === void 0 ? u.transparent : !!n.transparent,
		gradient: {
			enabled: a.enabled === void 0 ? u.gradient.enabled : !!a.enabled,
			...s(a)
		},
		grid: {
			enabled: r.enabled === void 0 ? u.grid.enabled : !!r.enabled,
			cellWidth: o,
			cellHeight: c,
			gapX: e(t(r.gapX, u.grid.gapX), 0, o),
			gapY: e(t(r.gapY, u.grid.gapY), 0, c),
			cornerRadius: e(t(r.cornerRadius, u.grid.cornerRadius), 0, Math.max(o, c)),
			color: Math.round(e(t(r.color, u.grid.color), 0, 16777215)),
			opacity: e(t(r.opacity, u.grid.opacity), 0, 1)
		},
		stars: {
			enabled: i.enabled === void 0 ? u.stars.enabled : !!i.enabled,
			density: e(t(i.density, u.stars.density), 0, 100),
			sizePx: e(t(i.sizePx, u.stars.sizePx), .25, 64),
			sizeRandomness: e(t(i.sizeRandomness, u.stars.sizeRandomness), 0, 1),
			tiltAngleDeg: e(t(i.tiltAngleDeg, u.stars.tiltAngleDeg), -89, 89),
			twinkleSpeed: e(t(i.twinkleSpeed, u.stars.twinkleSpeed), 0, 10),
			twinkleAmount: e(t(i.twinkleAmount, u.stars.twinkleAmount), 0, 1),
			opacity: e(t(i.opacity, u.stars.opacity), 0, 1),
			color: Math.round(e(t(i.color, u.stars.color), 0, 16777215))
		},
		meteors: l(n.meteors)
	};
}
var f = {
	cellWidth: 7,
	cellHeight: 7,
	gapX: 0,
	gapY: 0,
	cornerRadius: 0,
	orientation: "vertical",
	angleDeg: 0,
	rotationMode: "cell",
	overlapAmount: 1,
	streamGapWave: {
		enabled: !1,
		squeeze: 0,
		wavelengthCells: 16,
		speed: 0,
		phaseDeg: 0
	}
};
function ee(n = {}) {
	let r = e(Math.round(t(n.cellWidth, 7)), 1, 64), i = e(Math.round(t(n.cellHeight, 7)), 1, 64), a = n.orientation === "horizontal" ? "horizontal" : "vertical";
	return {
		cellWidth: r,
		cellHeight: i,
		gapX: e(t(n.gapX, 0), 0, r),
		gapY: e(t(n.gapY, 0), 0, i),
		cornerRadius: e(t(n.cornerRadius, 0), 0, Math.max(r, i)),
		orientation: a,
		angleDeg: e(t(n.angleDeg, a === "horizontal" ? 90 : 0), -180, 180),
		rotationMode: n.rotationMode === "overlap" ? "overlap" : "cell",
		overlapAmount: e(t(n.overlapAmount, 1), 0, 4),
		streamGapWave: {
			enabled: !!n.streamGapWave?.enabled,
			squeeze: e(t(n.streamGapWave?.squeeze, 0), 0, 1),
			wavelengthCells: e(t(n.streamGapWave?.wavelengthCells, 16), 2, 32),
			speed: e(t(n.streamGapWave?.speed, 0), -10, 10),
			phaseDeg: e(t(n.streamGapWave?.phaseDeg, 0), -180, 180)
		}
	};
}
var te = {
	brightness: 0,
	exposure: 0,
	contrast: 1,
	blackPoint: 0,
	whitePoint: 1,
	gamma: 1,
	invert: !1,
	posterizeLevels: 0,
	thresholdBias: 0,
	noiseAmount: 0,
	blurRadius: 0,
	sharpenAmount: 0
};
function ne(n = {}) {
	let r = e(t(n.blackPoint, 0), 0, 1);
	return {
		brightness: e(t(n.brightness, 0), -1, 1),
		exposure: e(t(n.exposure, 0), -5, 5),
		contrast: e(t(n.contrast, 1), 0, 4),
		blackPoint: r,
		whitePoint: e(t(n.whitePoint, 1), r + .01, 1),
		gamma: Math.max(.05, t(n.gamma, 1)),
		invert: !!n.invert,
		posterizeLevels: e(Math.round(t(n.posterizeLevels, 0)), 0, 16),
		thresholdBias: e(t(n.thresholdBias, 0), -1, 1),
		noiseAmount: e(t(n.noiseAmount, 0), 0, 1),
		blurRadius: e(t(n.blurRadius, 0), 0, 4),
		sharpenAmount: e(t(n.sharpenAmount, 0), 0, 4)
	};
}
var p = [
	{
		color: 15987699,
		startFrom: .12,
		width: 1,
		opacity: 1
	},
	{
		color: 16439960,
		startFrom: .28,
		width: 1,
		opacity: 1
	},
	{
		color: 16301424,
		startFrom: .44,
		width: 2,
		opacity: 1
	},
	{
		color: 16162381,
		startFrom: .6,
		width: 3,
		opacity: 1
	},
	{
		color: 15891507,
		startFrom: .76,
		width: 4,
		opacity: 1
	},
	{
		color: 15423273,
		startFrom: .9,
		width: 5,
		opacity: 1
	}
];
function re(n) {
	return {
		color: Math.round(e(t(n.color, 0), 0, 16777215)),
		startFrom: e(t(n.startFrom, 0), 0, 1),
		width: e(t(n.width, 1), .5, 64),
		opacity: e(t(n.opacity, 1), 0, 1)
	};
}
function m(e, t) {
	return !e || e.length === 0 ? t.map((e) => ({ ...e })) : e.map(re);
}
var ie = [
	"center",
	"left top",
	"center top",
	"right top",
	"left center",
	"right center",
	"left bottom",
	"center bottom",
	"right bottom"
], ae = [
	"wave",
	"assembly",
	"turbulence",
	"glitch",
	"vortex",
	"blackhole",
	"whirlpool",
	"water",
	"custom"
], h = {
	enabled: !1,
	type: "assembly",
	wave: {
		position: "center",
		durationMs: 1200,
		softness: .22,
		waviness: .11
	},
	assembly: {
		sliceSizePx: 29,
		speedMinMs: 300,
		speedMaxMs: 1600,
		staggerMs: 6550,
		scatterPx: 90,
		angleJitterDeg: 35,
		blurPx: 17.5,
		blurStart: .45
	},
	turbulence: {
		speedMinMs: 400,
		speedMaxMs: 2600,
		staggerMs: 1400,
		intensity: 1,
		detail: .5,
		glow: .6
	},
	glitch: {
		speedMinMs: 200,
		speedMaxMs: 1400,
		staggerMs: 1200,
		intensity: 1,
		detail: .5,
		glow: .8
	},
	vortex: {
		speedMinMs: 300,
		speedMaxMs: 1400,
		staggerMs: 2600,
		intensity: 1,
		detail: .5,
		glow: .7,
		swirl: 1
	},
	blackhole: {
		speedMinMs: 260,
		speedMaxMs: 1050,
		staggerMs: 3600,
		intensity: 1,
		detail: .5,
		glow: .7,
		swirl: 1.2,
		formMs: 1150,
		collapseMs: 420,
		arms: 3,
		lensing: 1,
		horizon: .12
	},
	whirlpool: {
		durationMs: 5600,
		turns: 4,
		tightness: .22,
		streak: .6,
		glow: .4
	},
	water: {
		durationMs: 950,
		settleMs: 520,
		rows: 5,
		intensity: 1.7,
		wobble: .7,
		refraction: 1.3,
		softness: .35
	}
};
function g(n) {
	let r = n.scatter ?? {}, i = h.assembly, a = e(Math.round(t(r.speedMinMs ?? n.speedMinMs, i.speedMinMs)), 100, 3e4), o = Math.max(a, e(Math.round(t(r.speedMaxMs ?? n.speedMaxMs, i.speedMaxMs)), 100, 3e4));
	return {
		sliceSizePx: e(Math.round(t(r.sliceSizePx ?? n.sliceSizePx, i.sliceSizePx)), 8, 200),
		speedMinMs: a,
		speedMaxMs: o,
		staggerMs: e(Math.round(t(r.staggerMs ?? n.staggerMs, i.staggerMs)), 0, 3e4),
		scatterPx: e(Math.round(t(r.scatterPx ?? n.scatterPx, i.scatterPx)), 0, 300),
		angleJitterDeg: e(t(r.angleJitterDeg ?? n.angleJitterDeg, i.angleJitterDeg), 0, 90),
		blurPx: e(t(r.blurPx ?? n.blurPx, i.blurPx ?? 17.5), 0, 50),
		blurStart: e(t(r.blurStart ?? n.blurStart, i.blurStart ?? .45), 0, .95)
	};
}
function _(n = {}, r) {
	let i = e(Math.round(t(n.speedMinMs, r.speedMinMs)), 50, 3e4);
	return {
		speedMinMs: i,
		speedMaxMs: Math.max(i, e(Math.round(t(n.speedMaxMs, r.speedMaxMs)), 50, 3e4)),
		staggerMs: e(Math.round(t(n.staggerMs, r.staggerMs)), 0, 3e4),
		intensity: e(t(n.intensity, r.intensity), 0, 2),
		detail: e(t(n.detail, r.detail), 0, 1),
		glow: e(t(n.glow, r.glow), 0, 1)
	};
}
function v(n = {}, r) {
	return {
		..._(n, r),
		swirl: e(t(n.swirl, r.swirl), 0, 3)
	};
}
function oe(n = {}, r) {
	return {
		..._(n, r),
		swirl: e(t(n.swirl, r.swirl), 0, 3),
		formMs: e(Math.round(t(n.formMs, r.formMs)), 0, 1e4),
		collapseMs: e(Math.round(t(n.collapseMs, r.collapseMs)), 0, 1e4),
		arms: e(Math.round(t(n.arms, r.arms)), 1, 8),
		lensing: e(t(n.lensing, r.lensing), 0, 2),
		horizon: e(t(n.horizon, r.horizon), .02, .3)
	};
}
function y(n = {}, r) {
	return {
		durationMs: e(Math.round(t(n.durationMs, r.durationMs)), 100, 3e4),
		turns: e(t(n.turns, r.turns), 0, 6),
		tightness: e(t(n.tightness, r.tightness), .05, .5),
		streak: e(t(n.streak, r.streak), 0, 1),
		glow: e(t(n.glow, r.glow), 0, 1)
	};
}
function b(n = {}, r) {
	return {
		durationMs: e(Math.round(t(n.durationMs, r.durationMs)), 1, 6e4),
		settleMs: e(Math.round(t(n.settleMs, r.settleMs)), 0, 2e4),
		rows: e(Math.round(t(n.rows, r.rows)), 1, 24),
		intensity: e(t(n.intensity, r.intensity), 0, 3),
		wobble: e(t(n.wobble, r.wobble), 0, 1),
		refraction: e(t(n.refraction, r.refraction), 0, 4),
		softness: e(t(n.softness, r.softness), 0, 1)
	};
}
function se(n = {}) {
	let r = n.wave ?? {}, i = n.assembly ?? {}, a = ie.includes(r.position) ? r.position : h.wave.position, o = n.type, s = i.style;
	o === "assembly" && (s === "turbulence" || s === "glitch" || s === "hadouken" || s === "vortex") && (o = s === "hadouken" ? "vortex" : s), o === "hadouken" && (o = "vortex");
	let c = ae.includes(o) ? o : h.type;
	return {
		enabled: n.enabled === void 0 ? h.enabled : !!n.enabled,
		type: c,
		wave: {
			position: a,
			durationMs: e(Math.round(t(r.durationMs, h.wave.durationMs)), 100, 3e4),
			softness: e(t(r.softness, h.wave.softness), 0, 1),
			waviness: e(t(r.waviness, h.wave.waviness), 0, 1)
		},
		assembly: g(i),
		turbulence: _(n.turbulence ?? i.turbulence, h.turbulence),
		glitch: _(n.glitch ?? i.glitch, h.glitch),
		vortex: v(n.vortex ?? n.hadouken ?? i.vortex ?? i.hadouken, h.vortex),
		blackhole: oe(n.blackhole, h.blackhole),
		whirlpool: y(n.whirlpool, h.whirlpool),
		water: b(n.water, h.water)
	};
}
var ce = [
	"leftToRight",
	"rightToLeft",
	"topToBottom",
	"bottomToTop"
], x = {
	gaps: {
		enabled: !1,
		coverage: .22,
		speed: 1
	},
	width: {
		enabled: !1,
		coverage: .3,
		swingPx: 1.25,
		swingPeriodMin: .21,
		swingPeriodMax: .55
	},
	stripe: {
		enabled: !1,
		coverage: .35,
		maxBrightness: .65,
		speed: 1,
		thickestCount: 3,
		hueDriftDeg: 0,
		saturationBoost: 0
	},
	motion: {
		enabled: !1,
		amplitudePx: 4,
		staggerPx: 24,
		maxOffsetPx: 12,
		speed: 1,
		direction: "leftToRight"
	}
};
function le(n = {}) {
	let r = n.gaps ?? {}, i = n.width ?? {}, a = n.stripe ?? {}, o = n.motion ?? {};
	return {
		gaps: {
			enabled: r.enabled === void 0 ? x.gaps.enabled : !!r.enabled,
			coverage: e(t(r.coverage, x.gaps.coverage), 0, 1),
			speed: e(t(r.speed, x.gaps.speed), .05, 100)
		},
		width: {
			enabled: i.enabled === void 0 ? x.width.enabled : !!i.enabled,
			coverage: e(t(i.coverage, x.width.coverage), 0, 1),
			swingPx: e(t(i.swingPx, x.width.swingPx), 0, 40),
			swingPeriodMin: e(t(i.swingPeriodMin, x.width.swingPeriodMin), .02, 5),
			swingPeriodMax: e(t(i.swingPeriodMax, x.width.swingPeriodMax), .02, 5)
		},
		stripe: {
			enabled: a.enabled === void 0 ? x.stripe.enabled : !!a.enabled,
			coverage: e(t(a.coverage, x.stripe.coverage), 0, 1),
			maxBrightness: e(t(a.maxBrightness, x.stripe.maxBrightness), 0, 1),
			speed: e(t(a.speed, x.stripe.speed), .05, 100),
			thickestCount: e(Math.round(t(a.thickestCount, x.stripe.thickestCount)), 1, 64),
			hueDriftDeg: e(t(a.hueDriftDeg, x.stripe.hueDriftDeg), -180, 180),
			saturationBoost: e(t(a.saturationBoost, x.stripe.saturationBoost), 0, 1)
		},
		motion: {
			enabled: o.enabled === void 0 ? x.motion.enabled : !!o.enabled,
			amplitudePx: e(t(o.amplitudePx, x.motion.amplitudePx), 0, 64),
			staggerPx: e(t(o.staggerPx, x.motion.staggerPx), 1, 512),
			maxOffsetPx: e(t(o.maxOffsetPx, x.motion.maxOffsetPx), 0, 128),
			speed: Math.max(.05, t(o.speed, x.motion.speed)),
			direction: ce.includes(o.direction) ? o.direction : x.motion.direction
		}
	};
}
var S = {
	enabled: !1,
	density: .5,
	randomVisibility: 1,
	sizePx: 1.5,
	brightness: .35,
	hueDriftDeg: 0,
	saturationBoost: 0
};
function C(n = {}) {
	return {
		enabled: n.enabled === void 0 ? S.enabled : !!n.enabled,
		density: e(t(n.density, S.density), 0, 1),
		randomVisibility: e(t(n.randomVisibility, S.randomVisibility), 0, 1),
		sizePx: e(t(n.sizePx, S.sizePx), 1, 2),
		brightness: e(t(n.brightness, S.brightness), 0, 1),
		hueDriftDeg: e(t(n.hueDriftDeg, S.hueDriftDeg), -180, 180),
		saturationBoost: e(t(n.saturationBoost, S.saturationBoost), 0, 1)
	};
}
var w = {
	enabled: !1,
	minWidthPx: 2,
	density: 1
};
function T(n = {}) {
	return {
		enabled: n.enabled === void 0 ? w.enabled : !!n.enabled,
		minWidthPx: e(t(n.minWidthPx, w.minWidthPx), 2, 64),
		density: e(t(n.density, w.density), 0, 1)
	};
}
var E = {
	enabled: !1,
	brightness: .35,
	density: 1
};
function D(n = {}) {
	return {
		enabled: n.enabled === void 0 ? E.enabled : !!n.enabled,
		brightness: e(t(n.brightness, E.brightness), 0, 1),
		density: e(t(n.density, E.density), 0, 1)
	};
}
var O = {
	enabled: !1,
	luminanceThreshold: .7,
	highlightedStripeCount: 3,
	groupDistanceCells: 1,
	color: 16777215,
	fontSizePx: 10,
	coordinateColor: 16777215
};
function k(n = {}) {
	return {
		enabled: n.enabled === void 0 ? O.enabled : !!n.enabled,
		luminanceThreshold: e(t(n.luminanceThreshold, O.luminanceThreshold), 0, 1),
		highlightedStripeCount: Math.round(e(t(n.highlightedStripeCount, O.highlightedStripeCount), 1, 16)),
		groupDistanceCells: Math.round(e(t(n.groupDistanceCells, O.groupDistanceCells), 0, 8)),
		color: Math.round(e(t(n.color, O.color), 0, 16777215)),
		fontSizePx: Math.round(e(t(n.fontSizePx, O.fontSizePx), 6, 48)),
		coordinateColor: Math.round(e(t(n.coordinateColor, O.coordinateColor), 0, 16777215))
	};
}
var A = {
	segCount: 22,
	segSpacingPx: 10,
	turnRate: .9,
	turnVariation: .8,
	visibleMinMs: 7e3,
	visibleMaxMs: 13e3,
	hiddenMinMs: 800,
	hiddenMaxMs: 2600,
	lifeMinMs: 12e3,
	lifeMaxMs: 24e3,
	edgeMarginRatio: .12
}, j = {
	enabled: !1,
	direction: "up",
	minWidthRatio: .0223,
	maxWidthRatio: .0453,
	minHeightRatio: .0245,
	maxHeightRatio: .08,
	baseSpeedPxPerSec: 40,
	speedVariation: 1,
	spawnIntervalMs: 50,
	spawnJitterMs: 80,
	maxActive: 48,
	edgeSharpness: 1,
	opacityMin: .3,
	opacityMax: 1,
	vortexSingular: { ...A }
}, ue = [
	"up",
	"down",
	"left",
	"right",
	"upDown",
	"leftRight",
	"vortexSingular"
];
function de(e) {
	return ue.includes(e) ? e : "up";
}
function fe(n = {}) {
	let r = e(Math.round(t(n.lifeMinMs, A.lifeMinMs)), 500, 6e4), i = e(Math.round(t(n.visibleMinMs, A.visibleMinMs)), 500, 6e4), a = e(Math.round(t(n.hiddenMinMs, A.hiddenMinMs)), 0, 3e4);
	return {
		segCount: e(Math.round(t(n.segCount, A.segCount)), 2, 80),
		segSpacingPx: e(t(n.segSpacingPx, A.segSpacingPx), 2, 60),
		turnRate: e(t(n.turnRate, A.turnRate), .05, 6),
		turnVariation: e(t(n.turnVariation, A.turnVariation), 0, 1),
		visibleMinMs: i,
		visibleMaxMs: e(Math.round(t(n.visibleMaxMs, A.visibleMaxMs)), i, 12e4),
		hiddenMinMs: a,
		hiddenMaxMs: e(Math.round(t(n.hiddenMaxMs, A.hiddenMaxMs)), a, 6e4),
		lifeMinMs: r,
		lifeMaxMs: e(Math.round(t(n.lifeMaxMs, A.lifeMaxMs)), r, 12e4),
		edgeMarginRatio: e(t(n.edgeMarginRatio, A.edgeMarginRatio), 0, .4)
	};
}
function pe(n = {}) {
	let r = e(t(n.minWidthRatio, j.minWidthRatio), .001, .5), i = e(t(n.maxWidthRatio, j.maxWidthRatio), r, .5), a = e(t(n.minHeightRatio, j.minHeightRatio), .001, .5), o = e(t(n.maxHeightRatio, j.maxHeightRatio), a, .5), s = e(t(n.opacityMin, j.opacityMin), 0, 1), c = e(t(n.opacityMax, j.opacityMax), s, 1);
	return {
		enabled: n.enabled === void 0 ? j.enabled : !!n.enabled,
		direction: de(n.direction ?? j.direction),
		minWidthRatio: r,
		maxWidthRatio: i,
		minHeightRatio: a,
		maxHeightRatio: o,
		baseSpeedPxPerSec: e(t(n.baseSpeedPxPerSec, j.baseSpeedPxPerSec), 1, 500),
		speedVariation: e(t(n.speedVariation, j.speedVariation), 0, 1),
		spawnIntervalMs: e(Math.round(t(n.spawnIntervalMs, j.spawnIntervalMs)), 20, 5e3),
		spawnJitterMs: e(Math.round(t(n.spawnJitterMs, j.spawnJitterMs)), 0, 2e3),
		maxActive: e(Math.round(t(n.maxActive, j.maxActive)), 1, 200),
		edgeSharpness: e(t(n.edgeSharpness, j.edgeSharpness), 0, 1),
		opacityMin: s,
		opacityMax: c,
		vortexSingular: fe(n.vortexSingular)
	};
}
var M = {
	enabled: !1,
	start: 0,
	end: .1,
	power: 1,
	sides: {
		top: !0,
		right: !0,
		bottom: !0,
		left: !0
	}
};
function me(e = {}) {
	return {
		top: e.top === void 0 ? M.sides.top : !!e.top,
		right: e.right === void 0 ? M.sides.right : !!e.right,
		bottom: e.bottom === void 0 ? M.sides.bottom : !!e.bottom,
		left: e.left === void 0 ? M.sides.left : !!e.left
	};
}
function N(n = {}) {
	let r = e(t(n.start, M.start), 0, .5), i = e(t(n.end, M.end), r + .001, .5);
	return {
		enabled: n.enabled === void 0 ? M.enabled : !!n.enabled,
		start: r,
		end: i,
		power: e(t(n.power, M.power), .1, 4),
		sides: me(n.sides)
	};
}
var P = {
	radiusScale: .31,
	starDensity: 1,
	starSizePx: 2.2,
	starSizeRandomness: .77,
	starGrowScale: 1.35,
	starPushPx: 1.9,
	twinkleAmount: .18,
	twinkleSpeed: 1,
	linkThicknessPx: 2.9,
	linkBrightness: 1,
	linkGrooveDepth: 1,
	linkShearPx: 13.5,
	linkMaxDistScale: .2184,
	linkFormMs: 210,
	linkHoldMs: 0,
	linkDissolveMs: 540,
	maxLinks: 48,
	maxStars: 64,
	pulseEnabled: !0,
	pulseDurationMs: 700,
	pulseCoreLenPx: 3.4,
	pulseTailLenPx: 27,
	pulseBrightness: 1,
	pulseRelayHops: 2,
	pulseCooldownMs: 900,
	flareMs: 460,
	flareScale: .85,
	polygonFlashEnabled: !0,
	polygonFlashStrength: 1
};
function F(n = {}) {
	let r = P;
	return {
		radiusScale: e(t(n.radiusScale, r.radiusScale), .02, 2),
		starDensity: e(t(n.starDensity, r.starDensity), .05, 4),
		starSizePx: e(t(n.starSizePx, r.starSizePx), .2, 20),
		starSizeRandomness: e(t(n.starSizeRandomness, r.starSizeRandomness), 0, 1),
		starGrowScale: e(t(n.starGrowScale, r.starGrowScale), 0, 6),
		starPushPx: e(t(n.starPushPx, r.starPushPx), 0, 40),
		twinkleAmount: e(t(n.twinkleAmount, r.twinkleAmount), 0, 1),
		twinkleSpeed: e(t(n.twinkleSpeed, r.twinkleSpeed), 0, 10),
		linkThicknessPx: e(t(n.linkThicknessPx, r.linkThicknessPx), .2, 20),
		linkBrightness: e(t(n.linkBrightness, r.linkBrightness), 0, 4),
		linkGrooveDepth: e(t(n.linkGrooveDepth, r.linkGrooveDepth), 0, 4),
		linkShearPx: e(t(n.linkShearPx, r.linkShearPx), 0, 80),
		linkMaxDistScale: e(t(n.linkMaxDistScale, r.linkMaxDistScale), .02, 1),
		linkFormMs: e(t(n.linkFormMs, r.linkFormMs), 10, 5e3),
		linkHoldMs: e(t(n.linkHoldMs, r.linkHoldMs), 0, 1e4),
		linkDissolveMs: e(t(n.linkDissolveMs, r.linkDissolveMs), 10, 1e4),
		maxLinks: z(t(n.maxLinks, r.maxLinks), 4, 80),
		maxStars: z(t(n.maxStars, r.maxStars), 4, 160),
		pulseEnabled: n.pulseEnabled === void 0 ? r.pulseEnabled : !!n.pulseEnabled,
		pulseDurationMs: e(t(n.pulseDurationMs, r.pulseDurationMs), 60, 1e4),
		pulseCoreLenPx: e(t(n.pulseCoreLenPx, r.pulseCoreLenPx), .5, 60),
		pulseTailLenPx: e(t(n.pulseTailLenPx, r.pulseTailLenPx), .5, 240),
		pulseBrightness: e(t(n.pulseBrightness, r.pulseBrightness), 0, 4),
		pulseRelayHops: z(t(n.pulseRelayHops, r.pulseRelayHops), 0, 6),
		pulseCooldownMs: e(t(n.pulseCooldownMs, r.pulseCooldownMs), 0, 2e4),
		flareMs: e(t(n.flareMs, r.flareMs), 30, 5e3),
		flareScale: e(t(n.flareScale, r.flareScale), 0, 6),
		polygonFlashEnabled: n.polygonFlashEnabled === void 0 ? r.polygonFlashEnabled : !!n.polygonFlashEnabled,
		polygonFlashStrength: e(t(n.polygonFlashStrength, r.polygonFlashStrength), 0, 4)
	};
}
var I = {
	nodeCount: 13,
	headStiffness: 5200,
	headDamping: 104,
	chainStiffness: 4200,
	chainDamping: 80,
	maxLinkPx: 22,
	headRadiusPx: 10.6,
	tailRadiusPx: 3.2,
	stretchThinning: .62,
	smoothUnionPx: 5.4,
	bodyBrightness: 1,
	auraStrength: 1,
	bodyPushPx: 12,
	presenceRiseRate: 15,
	presenceFallRate: 2.6,
	embersEnabled: !0,
	emberRatePerSec: 92,
	emberMaxCount: 210,
	emberSizePx: 2.9,
	emberSpeedMinPxPerSec: 26,
	emberSpeedMaxPxPerSec: 56,
	emberSpreadRad: .85,
	emberLifetimeMinMs: 560,
	emberLifetimeMaxMs: 1400,
	emberBrightness: 1,
	emberFadeInFraction: .12,
	seed: 10368889
};
function L(n = {}) {
	let r = I, i = e(t(n.emberSpeedMinPxPerSec, r.emberSpeedMinPxPerSec), 0, 2e3), a = Math.max(i, e(t(n.emberSpeedMaxPxPerSec, r.emberSpeedMaxPxPerSec), 0, 2e3)), o = e(t(n.emberLifetimeMinMs, r.emberLifetimeMinMs), 60, 2e4), s = Math.max(o, e(t(n.emberLifetimeMaxMs, r.emberLifetimeMaxMs), 60, 2e4));
	return {
		nodeCount: z(t(n.nodeCount, r.nodeCount), 2, 48),
		headStiffness: e(t(n.headStiffness, r.headStiffness), 100, 4e4),
		headDamping: e(t(n.headDamping, r.headDamping), 1, 600),
		chainStiffness: e(t(n.chainStiffness, r.chainStiffness), 100, 4e4),
		chainDamping: e(t(n.chainDamping, r.chainDamping), 1, 600),
		maxLinkPx: e(t(n.maxLinkPx, r.maxLinkPx), 2, 200),
		headRadiusPx: e(t(n.headRadiusPx, r.headRadiusPx), .5, 60),
		tailRadiusPx: e(t(n.tailRadiusPx, r.tailRadiusPx), 0, 40),
		stretchThinning: e(t(n.stretchThinning, r.stretchThinning), 0, 1),
		smoothUnionPx: e(t(n.smoothUnionPx, r.smoothUnionPx), .1, 40),
		bodyBrightness: e(t(n.bodyBrightness, r.bodyBrightness), 0, 2),
		auraStrength: e(t(n.auraStrength, r.auraStrength), 0, 3),
		bodyPushPx: e(t(n.bodyPushPx, r.bodyPushPx), 0, 60),
		presenceRiseRate: e(t(n.presenceRiseRate, r.presenceRiseRate), .5, 60),
		presenceFallRate: e(t(n.presenceFallRate, r.presenceFallRate), .2, 60),
		embersEnabled: n.embersEnabled === void 0 ? r.embersEnabled : !!n.embersEnabled,
		emberRatePerSec: e(t(n.emberRatePerSec, r.emberRatePerSec), 0, 400),
		emberMaxCount: z(t(n.emberMaxCount, r.emberMaxCount), 1, 512),
		emberSizePx: e(t(n.emberSizePx, r.emberSizePx), .2, 40),
		emberSpeedMinPxPerSec: i,
		emberSpeedMaxPxPerSec: a,
		emberSpreadRad: e(t(n.emberSpreadRad, r.emberSpreadRad), 0, Math.PI),
		emberLifetimeMinMs: o,
		emberLifetimeMaxMs: s,
		emberBrightness: e(t(n.emberBrightness, r.emberBrightness), 0, 4),
		emberFadeInFraction: e(t(n.emberFadeInFraction, r.emberFadeInFraction), 0, .9),
		seed: z(t(n.seed, r.seed), 0, 1e8)
	};
}
var R = {
	enabled: !1,
	type: "default",
	particleRadius: 40,
	particleAlpha: .07,
	particleLifeMs: 960,
	particleLifeJitterMs: 100,
	emitterVelocitySmoothing: .7,
	particleVelocityScale: .01,
	particleTangentVelocity: 1.65,
	particleDamping: .96,
	particleSpacingPx: 3,
	maxEmitPerTick: 10,
	spreadMinPx: 1.5,
	spreadMaxPx: 21,
	spinStrength: .04,
	densityRadiusMinScale: .2,
	densityRadiusLifeScale: 1,
	pushRadiusScale: .9,
	pushStrengthPx: 48,
	pushLagPx: 0,
	pushWobblePx: 8,
	pushLeadBlackAlpha: 0,
	constellation: { ...P },
	comet: { ...I }
};
function z(t, n, r) {
	return Math.round(e(t, n, r));
}
function B(n = {}) {
	let r = e(t(n.spreadMinPx, R.spreadMinPx), 0, 80), i = Math.max(r, e(t(n.spreadMaxPx, R.spreadMaxPx), 0, 120));
	return {
		enabled: n.enabled === void 0 ? R.enabled : !!n.enabled,
		type: n.type === "wave" || n.type === "constellation" || n.type === "comet" ? n.type : "default",
		particleRadius: e(t(n.particleRadius, R.particleRadius), .5, 80),
		particleAlpha: e(t(n.particleAlpha, R.particleAlpha), 0, 1),
		particleLifeMs: e(t(n.particleLifeMs, R.particleLifeMs), 50, 1e4),
		particleLifeJitterMs: e(t(n.particleLifeJitterMs, R.particleLifeJitterMs), 0, 1e4),
		emitterVelocitySmoothing: e(t(n.emitterVelocitySmoothing, R.emitterVelocitySmoothing), 0, .98),
		particleVelocityScale: e(t(n.particleVelocityScale, R.particleVelocityScale), 0, 2),
		particleTangentVelocity: e(t(n.particleTangentVelocity, R.particleTangentVelocity), 0, 20),
		particleDamping: e(t(n.particleDamping, R.particleDamping), 0, 1),
		particleSpacingPx: e(t(n.particleSpacingPx, R.particleSpacingPx), .5, 80),
		maxEmitPerTick: z(t(n.maxEmitPerTick, R.maxEmitPerTick), 1, 200),
		spreadMinPx: r,
		spreadMaxPx: i,
		spinStrength: e(t(n.spinStrength, R.spinStrength), 0, .2),
		densityRadiusMinScale: e(t(n.densityRadiusMinScale, R.densityRadiusMinScale), 0, 3),
		densityRadiusLifeScale: e(t(n.densityRadiusLifeScale, R.densityRadiusLifeScale), 0, 3),
		pushRadiusScale: e(t(n.pushRadiusScale, R.pushRadiusScale), 0, 8),
		pushStrengthPx: e(t(n.pushStrengthPx, R.pushStrengthPx), 0, 120),
		pushLagPx: e(t(n.pushLagPx, R.pushLagPx), 0, 80),
		pushWobblePx: e(t(n.pushWobblePx, R.pushWobblePx), 0, 80),
		pushLeadBlackAlpha: e(t(n.pushLeadBlackAlpha, R.pushLeadBlackAlpha), 0, 1),
		constellation: F(n.constellation),
		comet: L(n.comet)
	};
}
var V = {
	maxConcurrent: 4,
	ringReachPx: 168,
	ringDurationMs: 600,
	ringThicknessPx: 24,
	ringRefractionPx: 20,
	flashRadiusPx: 24,
	flashDurationMs: 80,
	flashBrightness: 1,
	debrisCount: 24,
	debrisSpeedPxPerSec: 315,
	debrisSpeedVariation: .317,
	debrisDrag: 1.55,
	debrisGravityPxPerSec2: 360,
	debrisLifetimeMs: 1060,
	debrisLifetimeVariation: .302,
	debrisSizePx: 2.6,
	debrisBrightness: 1,
	craterRadiusPx: 118,
	craterDepth: 1,
	craterRelaxFastMs: 260,
	craterRelaxSlowMs: 1450,
	craterLifeMs: 3400,
	craterRimStrength: 1,
	seed: 1
};
function H(n = {}) {
	let r = V;
	return {
		maxConcurrent: z(t(n.maxConcurrent, r.maxConcurrent), 1, 16),
		ringReachPx: e(t(n.ringReachPx, r.ringReachPx), 8, 1200),
		ringDurationMs: e(t(n.ringDurationMs, r.ringDurationMs), 40, 8e3),
		ringThicknessPx: e(t(n.ringThicknessPx, r.ringThicknessPx), 1, 200),
		ringRefractionPx: e(t(n.ringRefractionPx, r.ringRefractionPx), 0, 160),
		flashRadiusPx: e(t(n.flashRadiusPx, r.flashRadiusPx), 1, 400),
		flashDurationMs: e(t(n.flashDurationMs, r.flashDurationMs), 8, 2e3),
		flashBrightness: e(t(n.flashBrightness, r.flashBrightness), 0, 4),
		debrisCount: z(t(n.debrisCount, r.debrisCount), 0, 96),
		debrisSpeedPxPerSec: e(t(n.debrisSpeedPxPerSec, r.debrisSpeedPxPerSec), 10, 4e3),
		debrisSpeedVariation: e(t(n.debrisSpeedVariation, r.debrisSpeedVariation), 0, 1),
		debrisDrag: e(t(n.debrisDrag, r.debrisDrag), .05, 12),
		debrisGravityPxPerSec2: e(t(n.debrisGravityPxPerSec2, r.debrisGravityPxPerSec2), 0, 4e3),
		debrisLifetimeMs: e(t(n.debrisLifetimeMs, r.debrisLifetimeMs), 60, 1e4),
		debrisLifetimeVariation: e(t(n.debrisLifetimeVariation, r.debrisLifetimeVariation), 0, 1),
		debrisSizePx: e(t(n.debrisSizePx, r.debrisSizePx), .2, 40),
		debrisBrightness: e(t(n.debrisBrightness, r.debrisBrightness), 0, 4),
		craterRadiusPx: e(t(n.craterRadiusPx, r.craterRadiusPx), 4, 1200),
		craterDepth: e(t(n.craterDepth, r.craterDepth), 0, 4),
		craterRelaxFastMs: e(t(n.craterRelaxFastMs, r.craterRelaxFastMs), 20, 1e4),
		craterRelaxSlowMs: e(t(n.craterRelaxSlowMs, r.craterRelaxSlowMs), 20, 2e4),
		craterLifeMs: e(t(n.craterLifeMs, r.craterLifeMs), 100, 2e4),
		craterRimStrength: e(t(n.craterRimStrength, r.craterRimStrength), 0, 4),
		seed: Math.round(e(t(n.seed, r.seed), 0, 1e6))
	};
}
var U = {
	enabled: !1,
	type: "default",
	lifeMs: 630,
	startRadiusPx: 6,
	maxRadiusPx: 120,
	startStrokeWidthPx: 24,
	endStrokeWidthPx: 12,
	maxWaves: 12,
	pushStrengthPx: 38,
	pushBandScale: 3.2,
	stripeWhiteAlpha: .5,
	detonation: { ...V }
};
function W(n = {}) {
	return {
		enabled: n.enabled === void 0 ? U.enabled : !!n.enabled,
		type: n.type === "detonation" ? n.type : "default",
		lifeMs: e(t(n.lifeMs, U.lifeMs), 80, 1e4),
		startRadiusPx: e(t(n.startRadiusPx, U.startRadiusPx), 1, 120),
		maxRadiusPx: e(t(n.maxRadiusPx, U.maxRadiusPx), 4, 600),
		startStrokeWidthPx: e(t(n.startStrokeWidthPx, U.startStrokeWidthPx), .5, 80),
		endStrokeWidthPx: e(t(n.endStrokeWidthPx, U.endStrokeWidthPx), .25, 40),
		maxWaves: z(t(n.maxWaves, U.maxWaves), 1, 32),
		pushStrengthPx: e(t(n.pushStrengthPx, U.pushStrengthPx), 0, 200),
		pushBandScale: e(t(n.pushBandScale, U.pushBandScale), 1, 8),
		stripeWhiteAlpha: e(t(n.stripeWhiteAlpha, U.stripeWhiteAlpha), 0, 1),
		detonation: H(n.detonation)
	};
}
var G = {
	enabled: !1,
	mode: "random",
	colorMode: "white",
	color: 16777215,
	coverage: .1,
	positionX: .5,
	positionY: .5,
	areaWidth: 1,
	areaHeight: 1,
	text: "CF",
	textCopies: 1,
	fontFamily: "Geist Mono Medium",
	sizeScale: .9,
	shuffleSpeed: 1
}, he = new Set([
	"Geist Mono Medium",
	"monospace",
	"Arial, sans-serif",
	"Georgia, serif",
	"\"Courier New\", monospace",
	"\"Times New Roman\", serif",
	"Impact, fantasy"
]);
function ge(n = {}) {
	return {
		enabled: n.enabled === void 0 ? G.enabled : !!n.enabled,
		mode: n.mode === "text" ? "text" : "random",
		colorMode: n.colorMode === "colorful" ? "colorful" : "white",
		color: Math.round(e(t(n.color, G.color), 0, 16777215)),
		coverage: e(t(n.coverage, G.coverage), 0, 1),
		positionX: e(t(n.positionX, G.positionX), 0, 1),
		positionY: e(t(n.positionY, G.positionY), 0, 1),
		areaWidth: e(t(n.areaWidth, G.areaWidth), .01, 1),
		areaHeight: e(t(n.areaHeight, G.areaHeight), .01, 1),
		text: typeof n.text == "string" ? n.text.slice(0, 512) : G.text,
		textCopies: z(t(n.textCopies, G.textCopies), 1, 100),
		fontFamily: typeof n.fontFamily == "string" && he.has(n.fontFamily) ? n.fontFamily : G.fontFamily,
		sizeScale: e(t(n.sizeScale, G.sizeScale), .1, 1),
		shuffleSpeed: e(t(n.shuffleSpeed, G.shuffleSpeed), .05, 10)
	};
}
var K = [
	"normal",
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"difference",
	"exclusion"
], _e = Object.fromEntries(K.map((e, t) => [e, t])), q = {
	mode: "luminance",
	stripeBlendMode: "normal",
	imageColorLightness: .2,
	imageColorDensity: 1,
	imageColorRemoveThin: 0,
	imageColorBoostThick: 0,
	autoDetectBackground: !0,
	backgroundColor: 0,
	gradient: {
		enabled: !1,
		...o,
		stops: [...o.stops]
	}
};
function ve(n = {}) {
	let r = n.gradient ?? {};
	return {
		mode: n.mode === "colors" ? "colors" : "luminance",
		stripeBlendMode: K.includes(n.stripeBlendMode) ? n.stripeBlendMode : q.stripeBlendMode,
		imageColorLightness: e(t(n.imageColorLightness, q.imageColorLightness), -1, 1),
		imageColorDensity: e(t(n.imageColorDensity, q.imageColorDensity), 0, 1),
		imageColorRemoveThin: e(t(n.imageColorRemoveThin, q.imageColorRemoveThin), 0, .95),
		imageColorBoostThick: e(t(n.imageColorBoostThick, q.imageColorBoostThick), 0, 2),
		autoDetectBackground: n.autoDetectBackground === void 0 ? !0 : !!n.autoDetectBackground,
		backgroundColor: Math.round(e(t(n.backgroundColor, 0), 0, 16777215)),
		gradient: {
			enabled: r.enabled === void 0 ? q.gradient.enabled : !!r.enabled,
			...s(r)
		}
	};
}
var ye = [
	"sharp",
	"abstract",
	"charcoal",
	"pencil",
	"brush",
	"halftone",
	"risograph",
	"stainedGlass",
	"paperCutout",
	"crt",
	"glitch",
	"vhs",
	"amber",
	"gummy"
];
function be(e) {
	return ye.includes(e) ? e : "sharp";
}
function xe(n) {
	let r = Array.isArray(n) ? n : [], i = [];
	for (let n = 0; n < 4; n++) i.push(e(t(r[n], .5), 0, 1));
	return i;
}
var Se = {
	transform: n,
	adjustments: te,
	background: u,
	grid: f,
	stripes: p.map((e) => ({ ...e })),
	stripesEnabled: !0,
	fieldScale: 1,
	maxFps: 0,
	reveal: {
		...h,
		wave: { ...h.wave },
		assembly: { ...h.assembly },
		turbulence: { ...h.turbulence },
		glitch: { ...h.glitch },
		vortex: { ...h.vortex },
		water: { ...h.water }
	},
	sparkle: {
		gaps: { ...x.gaps },
		width: { ...x.width },
		stripe: { ...x.stripe },
		motion: { ...x.motion }
	},
	stripeDots: { ...S },
	stripeBorder: { ...w },
	gridLines: { ...E },
	frames: { ...O },
	flames: { ...j },
	edgeMask: { ...M },
	cursorTrail: { ...R },
	clickWave: { ...U },
	letters: { ...G },
	colors: { ...q },
	renderMode: "sharp",
	renderIntensity: 1,
	renderParams: [
		.5,
		.5,
		.5,
		.5
	],
	renderColorA: 2236962,
	renderColorB: 16777215
};
function J(n = {}) {
	return {
		transform: r(n.transform),
		adjustments: ne(n.adjustments),
		background: d(n.background),
		grid: ee(n.grid),
		stripes: m(n.stripes, p),
		stripesEnabled: n.stripesEnabled === void 0 ? !0 : !!n.stripesEnabled,
		fieldScale: e(t(n.fieldScale, 1), .25, 2),
		maxFps: Math.max(0, t(n.maxFps, 0)),
		reveal: se(n.reveal),
		sparkle: le(n.sparkle),
		stripeDots: C(n.stripeDots),
		stripeBorder: T(n.stripeBorder),
		gridLines: D(n.gridLines),
		frames: k(n.frames),
		flames: pe(n.flames),
		edgeMask: N(n.edgeMask),
		cursorTrail: B(n.cursorTrail),
		clickWave: W(n.clickWave),
		letters: ge(n.letters),
		colors: ve(n.colors),
		renderMode: be(n.renderMode),
		renderIntensity: e(t(n.renderIntensity, 1), 0, 1),
		renderParams: xe(n.renderParams),
		renderColorA: Math.round(e(t(n.renderColorA, 2236962), 0, 16777215)),
		renderColorB: Math.round(e(t(n.renderColorB, 16777215), 0, 16777215))
	};
}
//#endregion
//#region src/config/theme.ts
function Y(e) {
	return typeof e == "object" && !!e && !Array.isArray(e);
}
function X(e, t) {
	let n = { ...e };
	for (let [e, r] of Object.entries(t)) {
		let t = n[e];
		n[e] = Y(t) && Y(r) ? X(t, r) : r;
	}
	return n;
}
function Z(e, t) {
	let n = {};
	for (let [r, i] of Object.entries(t)) {
		let t = e[r];
		if (Y(t) && Y(i)) {
			let e = Z(t, i);
			Object.keys(e).length > 0 && (n[r] = e);
			continue;
		}
		if (Array.isArray(t) && Array.isArray(i)) {
			JSON.stringify(t) !== JSON.stringify(i) && (n[r] = i.map((e) => Y(e) ? { ...e } : e));
			continue;
		}
		Object.is(t, i) || (n[r] = i);
	}
	return n;
}
function Q(e, t = "light") {
	let { dark: n, ...r } = e;
	return t !== "dark" || !n ? r : X(r, n);
}
function $(e, t) {
	return Z(e, t);
}
function Ce(e) {
	let t = J(Q(e, "light"));
	if (!e.dark) return t;
	let n = $(t, J(Q(e, "dark")));
	return Object.keys(n).length > 0 ? {
		...t,
		dark: n
	} : t;
}
//#endregion
export { J as C, C as D, T as E, H as S, D as T, d as _, U as a, L as b, V as c, E as d, h as f, a as g, _e as h, c as i, Se as l, S as m, Q as n, I as o, w as p, Ce as r, R as s, $ as t, O as u, l as v, k as w, B as x, W as y };
