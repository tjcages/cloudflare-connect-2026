import { useEffect as e, useRef as t, useState as n } from "react";
import { jsx as r, jsxs as i } from "react/jsx-runtime";
//#region src/react/ConnectTwizzler.tsx
function a({ settings: a, posterSrc: o, className: s, canvasClassName: c, style: l, rootMargin: u, maxFps: d, maxDpr: f, paused: p = !1, onReady: m, ref: h }) {
	let g = t(null), _ = t(null), v = t(a), y = t(m), [b, x] = n(!1);
	return v.current = a, y.current = m, e(() => {
		let e = !1, t = null;
		return import("../coordinator-DkKvTZsH.js").then(({ registerSharedTwizzler: n }) => {
			e || !g.current || (t = n({
				canvas: g.current,
				settings: v.current,
				rootMargin: u,
				maxFps: d,
				maxDpr: f,
				paused: p,
				onReady: () => {
					x(!0), y.current?.();
				}
			}), _.current = t);
		}), () => {
			e = !0, t?.unregister(), _.current = null;
		};
	}, [
		u,
		d,
		f
	]), e(() => {
		a && _.current?.setSettings(a);
	}, [a]), e(() => {
		_.current?.setPaused(p);
	}, [p]), /* @__PURE__ */ i("span", {
		"aria-hidden": !0,
		className: s,
		"data-connect-twizzler-ready": b ? "true" : "false",
		style: {
			display: "block",
			position: "relative",
			overflow: "hidden",
			...l
		},
		children: [o ? /* @__PURE__ */ r("img", {
			alt: "",
			decoding: "async",
			src: o,
			style: {
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				objectFit: "fill",
				opacity: +!b,
				transition: "opacity 240ms ease-out"
			}
		}) : null, /* @__PURE__ */ r("canvas", {
			ref: (e) => {
				g.current = e, typeof h == "function" ? h(e) : h && (h.current = e);
			},
			className: c,
			style: {
				display: "block",
				width: "100%",
				height: "100%",
				opacity: +!!b
			}
		})]
	});
}
//#endregion
export { a as ConnectTwizzler };
