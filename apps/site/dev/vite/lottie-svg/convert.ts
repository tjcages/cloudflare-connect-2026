import type {
  CubicBezier,
  LottieSvg,
  LottieSvgLayer,
  LottieSvgShape,
  NumberTrack,
  PathTrack,
} from "../../../src/components/_animations/products/lottie-svg/types";
import type { Palette } from "../icons/palette";

type Matrix = [number, number, number, number, number, number];

type Node = Record<string, any>;

const SUPPORTED_ITEMS = new Set(["gr", "sh", "st", "fl", "tr", "mm"]);
const LINE_CAPS = ["butt", "round", "square"] as const;
const LINE_JOINS = ["miter", "round", "bevel"] as const;
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export class LottieSvgError extends Error {}

class Reader {
  private readonly trail: string[] = [];

  constructor(private readonly name: string) {}

  at<T>(step: string, run: () => T): T {
    this.trail.push(step);
    const result = run();
    this.trail.pop();
    return result;
  }

  fail(message: string): never {
    throw new LottieSvgError(
      `${this.name} → ${this.trail.join(" → ")}: ${message}`
    );
  }

  expect(condition: unknown, message: string): void {
    if (!condition) this.fail(message);
  }
}

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function isIdentity(m: Matrix): boolean {
  return IDENTITY.every((value, index) => Math.abs(m[index] - value) < 1e-9);
}

function num(value: number): string {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function componentOf(value: unknown, index: number): number {
  return Array.isArray(value) ? Number(value[index] ?? 0) : Number(value ?? 0);
}

function noExpression(reader: Reader, value: Node, what: string): void {
  reader.expect(value !== undefined, `${what} is missing`);
  reader.expect(value.x === undefined, `${what} carries an expression`);
}

function keyframesOf(reader: Reader, value: Node): Node[] {
  reader.expect(Array.isArray(value.k), "animated property has no keyframes");
  reader.expect(value.k.length >= 2, "animated property has one keyframe");
  return value.k as Node[];
}

function easeOf(reader: Reader, keyframe: Node, index: number): CubicBezier {
  reader.expect(!keyframe.h, "hold keyframes are unsupported");
  reader.expect(
    keyframe.e === undefined,
    "legacy `e` keyframes are unsupported"
  );
  reader.expect(
    keyframe.i !== undefined && keyframe.o !== undefined,
    "keyframe segment has no easing handles"
  );

  const ease: CubicBezier = [
    componentOf(keyframe.o.x, index),
    componentOf(keyframe.o.y, index),
    componentOf(keyframe.i.x, index),
    componentOf(keyframe.i.y, index),
  ];

  reader.expect(
    ease[0] >= 0 && ease[0] <= 1 && ease[2] >= 0 && ease[2] <= 1,
    `easing control points outside 0–1 (${ease.join(", ")})`
  );

  return ease;
}

function timesOf(reader: Reader, frames: Node[], ip: number, op: number) {
  const last = frames.at(-1)!;
  reader.expect(
    frames[0].t === ip && last.t === op,
    `keyframes span ${frames[0].t}–${last.t}, not the composition's ${ip}–${op}`
  );

  return frames.map((frame, index) => {
    reader.expect(
      index === 0 || frame.t > frames[index - 1].t,
      "keyframe times are not ascending"
    );
    return Number(((frame.t - ip) / (op - ip)).toFixed(6));
  });
}

function numberTrack(
  reader: Reader,
  value: Node,
  index: number,
  ip: number,
  op: number,
  scale = 1
): NumberTrack | number {
  noExpression(reader, value, "property");
  reader.expect(value.s !== true, "split-dimension properties are unsupported");

  if (value.a !== 1) return componentOf(value.k, index) * scale;

  const frames = keyframesOf(reader, value);

  return {
    ease: frames.slice(0, -1).map((frame) => easeOf(reader, frame, index)),
    times: timesOf(reader, frames, ip, op),
    values: frames.map((frame) => componentOf(frame.s, index) * scale),
  };
}

function staticVector(reader: Reader, value: Node, what: string): number[] {
  noExpression(reader, value, what);
  reader.expect(value.a !== 1, `animated ${what} is unsupported`);
  reader.expect(Array.isArray(value.k), `${what} is not a vector`);
  return value.k as number[];
}

function staticNumber(reader: Reader, value: Node, what: string): number {
  noExpression(reader, value, what);
  reader.expect(value.a !== 1, `animated ${what} is unsupported`);
  return componentOf(value.k, 0);
}

function scaleAnchorMatrix(scale: number[], anchor: number[]): Matrix {
  return multiply(
    [(scale[0] ?? 100) / 100, 0, 0, (scale[1] ?? 100) / 100, 0, 0],
    [1, 0, 0, 1, -(anchor[0] ?? 0), -(anchor[1] ?? 0)]
  );
}

function groupMatrix(reader: Reader, tr: Node): Matrix {
  const position = staticVector(reader, tr.p, "group position");
  const rotation = staticNumber(reader, tr.r, "group rotation");
  reader.expect(
    staticNumber(reader, tr.sk, "group skew") === 0 &&
      staticNumber(reader, tr.sa, "group skew axis") === 0,
    "group skew is unsupported"
  );

  const radians = (rotation * Math.PI) / 180;

  return multiply(
    multiply(
      [1, 0, 0, 1, position[0] ?? 0, position[1] ?? 0],
      [
        Math.cos(radians),
        Math.sin(radians),
        -Math.sin(radians),
        Math.cos(radians),
        0,
        0,
      ]
    ),
    scaleAnchorMatrix(
      staticVector(reader, tr.s, "group scale"),
      staticVector(reader, tr.a, "group anchor point")
    )
  );
}

function pathString(reader: Reader, shape: Node): string {
  const { v, i, o } = shape;
  reader.expect(
    Array.isArray(v) && Array.isArray(i) && Array.isArray(o),
    "path has no vertex data"
  );
  reader.expect(
    v.length === i.length && v.length === o.length,
    "path tangent count does not match its vertex count"
  );
  if (v.length === 0) return "";

  const parts = [`M${num(v[0][0])} ${num(v[0][1])}`];
  const segments = shape.c ? v.length : v.length - 1;

  for (let index = 1; index <= segments; index++) {
    const from = v[index - 1];
    const to = v[index % v.length];
    const out = o[index - 1];
    const into = i[index % v.length];
    parts.push(
      `C${num(from[0] + out[0])} ${num(from[1] + out[1])} ${num(to[0] + into[0])} ${num(to[1] + into[1])} ${num(to[0])} ${num(to[1])}`
    );
  }

  if (shape.c) parts.push("Z");
  return parts.join("");
}

interface ShapeSource {
  frames: Node[] | null;
  paths: string[];
}

function readShape(reader: Reader, item: Node): ShapeSource {
  const value = item.ks as Node;
  noExpression(reader, value, "path");

  if (value.a !== 1) {
    return { frames: null, paths: [pathString(reader, value.k as Node)] };
  }

  const frames = keyframesOf(reader, value);
  const shapes = frames.map((frame) => {
    const shape = (Array.isArray(frame.s) ? frame.s[0] : frame.s) as Node;
    reader.expect(shape !== undefined, "path keyframe has no value");
    return shape;
  });

  for (const shape of shapes) {
    reader.expect(
      shape.v.length === shapes[0].v.length,
      `vertex count changes between keyframes (${shapes[0].v.length} → ${shape.v.length})`
    );
    reader.expect(
      Boolean(shape.c) === Boolean(shapes[0].c),
      "closed flag changes between keyframes"
    );
  }

  return { frames, paths: shapes.map((shape) => pathString(reader, shape)) };
}

function paintVar(reader: Reader, palette: Palette, paint: Node): string {
  const color = staticVector(reader, paint.c, "paint colour");
  const token = palette.match(
    `color(display-p3 ${color[0]} ${color[1]} ${color[2]})`
  );
  reader.expect(
    token !== null,
    `paint colour display-p3(${color.slice(0, 3).join(" ")}) matches no --color-* token`
  );

  const role = palette.roleOf(token!);
  reader.expect(
    role !== "other",
    `paint colour resolves to ${token}, which is neither a -900 nor a -800 token`
  );

  return role === "main"
    ? "var(--icon-color-primary)"
    : "var(--icon-color-secondary)";
}

function paintFamily(reader: Reader, palette: Palette, paint: Node): string {
  const color = staticVector(reader, paint.c, "paint colour");
  const token = palette.match(
    `color(display-p3 ${color[0]} ${color[1]} ${color[2]})`
  );
  reader.expect(token !== null, "paint colour matches no --color-* token");
  return token!.split("-")[0];
}

function convertGroup(
  reader: Reader,
  group: Node,
  base: Matrix,
  ip: number,
  op: number,
  palette: Palette,
  families: Set<string>
): LottieSvgShape {
  reader.expect(Array.isArray(group.it), "group has no items");

  const sources: ShapeSource[] = [];
  let stroke: Node | null = null;
  let fill: Node | null = null;
  let transform: Node | null = null;

  for (const item of group.it as Node[]) {
    reader.at(String(item.nm ?? item.ty), () => {
      reader.expect(!item.hd, "hidden items are unsupported");
      reader.expect(
        SUPPORTED_ITEMS.has(String(item.ty)),
        `shape item type "${item.ty}" is unsupported`
      );

      if (item.ty === "gr") reader.fail("nested groups are unsupported");
      if (item.ty === "sh") sources.push(readShape(reader, item));
      if (item.ty === "mm") {
        reader.expect(
          item.mm === 1,
          `merge mode ${item.mm} is unsupported — only Merge (1) is equivalent to one path filled non-zero`
        );
      }
      if (item.ty === "st") {
        reader.expect(stroke === null, "group carries two strokes");
        stroke = item;
      }
      if (item.ty === "fl") {
        reader.expect(fill === null, "group carries two fills");
        fill = item;
      }
      if (item.ty === "tr") transform = item;
    });
  }

  reader.expect(sources.length > 0, "group draws no path");
  reader.expect(transform !== null, "group has no transform");
  reader.expect(stroke !== null || fill !== null, "group has no paint");

  const tr = transform as unknown as Node;
  const strokeItem = stroke as Node | null;
  const fillItem = fill as Node | null;
  const matrix = multiply(base, groupMatrix(reader, tr));
  const animated = sources.filter((source) => source.frames !== null);

  let d: PathTrack | string;

  if (animated.length === 0) {
    d = sources.map((source) => source.paths[0]).join("");
  } else {
    const reference = animated[0].frames!;
    const referenceEase = reference
      .slice(0, -1)
      .map((frame) => easeOf(reader, frame, 0));

    for (const source of animated) {
      const frames = source.frames!;
      reader.expect(
        frames.length === reference.length &&
          frames.every((frame, index) => frame.t === reference[index].t),
        "paths in one group animate on different keyframe times"
      );
      reader.expect(
        frames
          .slice(0, -1)
          .every((frame, index) =>
            easeOf(reader, frame, 0).every(
              (value, part) => value === referenceEase[index][part]
            )
          ),
        "paths in one group animate with different easing"
      );
    }

    d = {
      ease: referenceEase,
      times: timesOf(reader, reference, ip, op),
      values: reference.map((_, index) =>
        sources
          .map((source) => source.paths[source.frames ? index : 0])
          .join("")
      ),
    };
  }

  if (strokeItem) families.add(paintFamily(reader, palette, strokeItem));
  if (fillItem) families.add(paintFamily(reader, palette, fillItem));

  return {
    d,
    fill: fillItem ? paintVar(reader, palette, fillItem) : null,
    fillOpacity: fillItem
      ? staticNumber(reader, fillItem.o, "fill opacity") / 100
      : 1,
    fillRule: fillItem?.r === 2 ? "evenodd" : "nonzero",
    opacity: staticNumber(reader, tr.o, "group opacity") / 100,
    stroke: strokeItem ? paintVar(reader, palette, strokeItem) : null,
    strokeLinecap: LINE_CAPS[Number(strokeItem?.lc ?? 1) - 1] ?? "butt",
    strokeLinejoin: LINE_JOINS[Number(strokeItem?.lj ?? 1) - 1] ?? "miter",
    strokeMiterlimit: Number(strokeItem?.ml ?? 4),
    strokeOpacity: strokeItem
      ? staticNumber(reader, strokeItem.o, "stroke opacity") / 100
      : 1,
    strokeWidth: strokeItem
      ? staticNumber(reader, strokeItem.w, "stroke width")
      : 0,
    transform: isIdentity(matrix)
      ? ""
      : `matrix(${matrix.map((value) => num(value)).join(" ")})`,
  };
}

function convertLayer(
  reader: Reader,
  layer: Node,
  ip: number,
  op: number,
  palette: Palette,
  families: Set<string>
): LottieSvgLayer {
  reader.expect(layer.ty === 4, `layer type ${layer.ty} is unsupported`);
  reader.expect(layer.parent === undefined, "parented layers are unsupported");
  reader.expect(
    !layer.hasMask && !layer.masksProperties,
    "layer masks are unsupported"
  );
  reader.expect(
    layer.tt === undefined && layer.td === undefined,
    "track mattes are unsupported"
  );
  reader.expect(!layer.ef, "layer effects are unsupported");
  reader.expect(layer.ao !== 1, "auto-orient is unsupported");
  reader.expect(!layer.bm, "layer blend modes are unsupported");
  reader.expect((layer.sr ?? 1) === 1, "time stretch is unsupported");
  reader.expect(
    Number(layer.ip ?? ip) <= ip && Number(layer.op ?? op) >= op,
    "layers that appear or disappear mid-composition are unsupported"
  );
  reader.expect(Array.isArray(layer.shapes), "shape layer has no shapes");

  const ks = layer.ks as Node;
  reader.expect(ks !== undefined, "layer has no transform");

  const base = scaleAnchorMatrix(
    staticVector(reader, ks.s, "layer scale"),
    staticVector(reader, ks.a, "layer anchor point")
  );

  return {
    opacity: numberTrack(reader, ks.o, 0, ip, op, 0.01),
    rotate: numberTrack(reader, ks.r, 0, ip, op),
    shapes: (layer.shapes as Node[]).map((group, index) =>
      reader.at(String(group.nm ?? `group ${index}`), () => {
        reader.expect(
          group.ty === "gr",
          `top-level shape "${group.ty}" is unsupported`
        );
        return convertGroup(reader, group, base, ip, op, palette, families);
      })
    ),
    x: numberTrack(reader, ks.p, 0, ip, op),
    y: numberTrack(reader, ks.p, 1, ip, op),
  };
}

export function convertLottie(
  name: string,
  json: Node,
  palette: Palette
): LottieSvg {
  const reader = new Reader(name);

  return reader.at("composition", () => {
    reader.expect(!json.ddd, "3D compositions are unsupported");
    reader.expect(
      !Array.isArray(json.assets) || json.assets.length === 0,
      "compositions with assets (precomps, images) are unsupported"
    );
    reader.expect(!json.chars && !json.fonts, "text layers are unsupported");
    reader.expect(Array.isArray(json.layers), "composition has no layers");

    const fr = Number(json.fr);
    const ip = Number(json.ip);
    const op = Number(json.op);
    reader.expect(fr > 0 && op > ip, "composition has no duration");

    const families = new Set<string>();
    const layers = (json.layers as Node[])
      .map((layer, index) =>
        reader.at(`layer ${String(layer.ind ?? index)}`, () =>
          convertLayer(reader, layer, ip, op, palette, families)
        )
      )
      .reverse();

    reader.expect(
      families.size === 1,
      `paints span several colour families (${[...families].join(", ")})`
    );

    return {
      duration: Number(((op - ip) / fr).toFixed(6)),
      family: [...families][0] as LottieSvg["family"],
      height: Number(json.h),
      layers,
      width: Number(json.w),
    };
  });
}
