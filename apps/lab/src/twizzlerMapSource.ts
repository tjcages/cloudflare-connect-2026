import { buildTwizzlerLines, type TwizzlerLine, type TwizzlerSettings } from "./twizzler";

export const TWIZZLER_MAP_SHADER_SOURCE = `// Procedural Twizzler Map
// This library shader is rendered from the live Twizzler geometry.`;

export type TwizzlerMapDirection =
  | "topToBottom"
  | "bottomToTop"
  | "leftToRight"
  | "rightToLeft"
  | "topLeftToBottomRight"
  | "topRightToBottomLeft"
  | "bottomLeftToTopRight"
  | "bottomRightToTopLeft";

export type TwizzlerMapSettings = {
  backgroundLevel: number;
  ribbonLevel: number;
  shoulderLevel: number;
  shoulderWidth: number;
  topOffsetPx: number;
  bottomOffsetPx: number;
  topSpread: number;
  bottomSpread: number;
  flowEnabled: boolean;
  flowDirection: TwizzlerMapDirection;
  flowAmplitude: number;
  flowSpeed: number;
  flowSpacing: number;
  flowBandWidth: number;
  flowSoftness: number;
  flowOpacity: number;
  flowPhase: number;
};

export const TWIZZLER_MAP_DEFAULTS: TwizzlerMapSettings = {
  backgroundLevel: 0.08,
  ribbonLevel: 0.52,
  shoulderLevel: 0.02,
  shoulderWidth: 7,
  topOffsetPx: 0,
  bottomOffsetPx: 0,
  topSpread: 1,
  bottomSpread: 1,
  flowEnabled: true,
  flowDirection: "topRightToBottomLeft",
  flowAmplitude: 0.2,
  flowSpeed: 0.8,
  flowSpacing: 0.16,
  flowBandWidth: 0.035,
  flowSoftness: 0.35,
  flowOpacity: 0.45,
  flowPhase: 0,
};

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function normalizeTwizzlerMapSettings(value: unknown): TwizzlerMapSettings {
  const input = value && typeof value === "object" ? (value as Partial<TwizzlerMapSettings>) : {};
  const directions: TwizzlerMapDirection[] = [
    "topToBottom",
    "bottomToTop",
    "leftToRight",
    "rightToLeft",
    "topLeftToBottomRight",
    "topRightToBottomLeft",
    "bottomLeftToTopRight",
    "bottomRightToTopLeft",
  ];
  return {
    backgroundLevel: clamp(input.backgroundLevel, TWIZZLER_MAP_DEFAULTS.backgroundLevel, 0, 1),
    ribbonLevel: clamp(input.ribbonLevel, TWIZZLER_MAP_DEFAULTS.ribbonLevel, 0, 1),
    shoulderLevel: clamp(input.shoulderLevel, TWIZZLER_MAP_DEFAULTS.shoulderLevel, 0, 1),
    shoulderWidth: clamp(input.shoulderWidth, TWIZZLER_MAP_DEFAULTS.shoulderWidth, 0, 20),
    topOffsetPx: clamp(input.topOffsetPx, TWIZZLER_MAP_DEFAULTS.topOffsetPx, 0, 400),
    bottomOffsetPx: clamp(input.bottomOffsetPx, TWIZZLER_MAP_DEFAULTS.bottomOffsetPx, 0, 400),
    topSpread: clamp(input.topSpread, TWIZZLER_MAP_DEFAULTS.topSpread, 0, 4),
    bottomSpread: clamp(input.bottomSpread, TWIZZLER_MAP_DEFAULTS.bottomSpread, 0, 4),
    flowEnabled: typeof input.flowEnabled === "boolean" ? input.flowEnabled : TWIZZLER_MAP_DEFAULTS.flowEnabled,
    flowDirection: directions.includes(input.flowDirection as TwizzlerMapDirection)
      ? (input.flowDirection as TwizzlerMapDirection)
      : TWIZZLER_MAP_DEFAULTS.flowDirection,
    flowAmplitude: clamp(input.flowAmplitude, TWIZZLER_MAP_DEFAULTS.flowAmplitude, -1, 1),
    flowSpeed: clamp(input.flowSpeed, TWIZZLER_MAP_DEFAULTS.flowSpeed, -3, 3),
    flowSpacing: clamp(input.flowSpacing, TWIZZLER_MAP_DEFAULTS.flowSpacing, 0.02, 0.75),
    flowBandWidth: clamp(input.flowBandWidth, TWIZZLER_MAP_DEFAULTS.flowBandWidth, 0.002, 0.3),
    flowSoftness: clamp(input.flowSoftness, TWIZZLER_MAP_DEFAULTS.flowSoftness, 0, 1),
    flowOpacity: clamp(input.flowOpacity, TWIZZLER_MAP_DEFAULTS.flowOpacity, 0, 1),
    flowPhase: clamp(input.flowPhase, TWIZZLER_MAP_DEFAULTS.flowPhase, 0, 1),
  };
}

export function twizzlerMapDirectionVector(direction: TwizzlerMapDirection): { x: number; y: number } {
  const diagonal = Math.SQRT1_2;
  switch (direction) {
    case "bottomToTop":
      return { x: 0, y: -1 };
    case "leftToRight":
      return { x: 1, y: 0 };
    case "rightToLeft":
      return { x: -1, y: 0 };
    case "topLeftToBottomRight":
      return { x: diagonal, y: diagonal };
    case "topRightToBottomLeft":
      return { x: -diagonal, y: diagonal };
    case "bottomLeftToTopRight":
      return { x: diagonal, y: -diagonal };
    case "bottomRightToTopLeft":
      return { x: -diagonal, y: -diagonal };
    default:
      return { x: 0, y: 1 };
  }
}

export type TwizzlerEnvelope = {
  top: Array<{ x: number; y: number }>;
  bottom: Array<{ x: number; y: number }>;
};

export function twizzlerEnvelope(lines: readonly TwizzlerLine[]): TwizzlerEnvelope {
  const pointCount = lines[0]?.points.length ?? 0;
  const top: TwizzlerEnvelope["top"] = [];
  const bottom: TwizzlerEnvelope["bottom"] = [];
  for (let point = 0; point < pointCount; point += 1) {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let x = 0;
    for (const line of lines) {
      const value = line.points[point];
      if (!value) continue;
      x = value.x;
      minY = Math.min(minY, value.y);
      maxY = Math.max(maxY, value.y);
    }
    if (Number.isFinite(minY) && Number.isFinite(maxY)) {
      top.push({ x, y: minY });
      bottom.push({ x, y: maxY });
    }
  }
  return { top, bottom };
}

function trace(context: CanvasRenderingContext2D, points: readonly { x: number; y: number }[]): void {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
}

export type TwizzlerMapRenderer = {
  canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  render(
    twizzlerTimeSec: number,
    flowTimeSec: number,
    settings: Partial<TwizzlerSettings>,
    mapSettings?: Partial<TwizzlerMapSettings>,
  ): void;
};

export function createTwizzlerMapRenderer(width: number, height: number): TwizzlerMapRenderer {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is required for the Twizzler Map shader.");

  const resize = (nextWidth: number, nextHeight: number) => {
    const w = Math.max(1, Math.round(nextWidth));
    const h = Math.max(1, Math.round(nextHeight));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  };
  resize(width, height);

  return {
    canvas,
    get width() {
      return canvas.width;
    },
    get height() {
      return canvas.height;
    },
    resize,
    render(twizzlerTimeSec, flowTimeSec, settings, mapInput) {
      const map = normalizeTwizzlerMapSettings(mapInput);
      const mapSettings = { ...settings, pointSpacing: Math.max(4, settings.pointSpacing ?? 4) };
      const geometry = buildTwizzlerLines(canvas.width, canvas.height, twizzlerTimeSec, mapSettings);
      const envelope = twizzlerEnvelope(geometry.lines);
      const gray = (level: number) => Math.round(level * 255);
      const background = gray(map.backgroundLevel);
      context.fillStyle = `rgb(${background}, ${background}, ${background})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (envelope.top.length === 0) return;

      context.save();
      context.lineJoin = "round";
      context.lineCap = "round";

      // Dark animated shoulders on both sides of the Twizzler ribbon.
      const shoulder = gray(map.shoulderLevel);
      context.strokeStyle = `rgb(${shoulder}, ${shoulder}, ${shoulder})`;
      context.setLineDash([]);
      const shoulderEdges = [
        { points: envelope.top.map((point) => ({ x: point.x, y: point.y - map.topOffsetPx })), spread: map.topSpread },
        {
          points: envelope.bottom.map((point) => ({ x: point.x, y: point.y + map.bottomOffsetPx })),
          spread: map.bottomSpread,
        },
      ];
      for (const edge of shoulderEdges) {
        if (edge.spread <= 0) continue;
        context.lineWidth = Math.max(1, geometry.settings.lineWidth * map.shoulderWidth * edge.spread);
        context.beginPath();
        trace(context, edge.points);
        context.stroke();
      }

      // Muted-gray field across the complete moving Twizzler envelope.
      context.setLineDash([]);
      context.beginPath();
      trace(context, envelope.top);
      trace(context, [...envelope.bottom].reverse());
      context.closePath();
      const ribbon = gray(map.ribbonLevel);
      context.fillStyle = `rgb(${ribbon}, ${ribbon}, ${ribbon})`;
      context.fill();

      if (map.flowEnabled && map.flowOpacity > 0 && Math.abs(map.flowAmplitude) > 0.001) {
        context.save();
        context.beginPath();
        trace(context, envelope.top);
        trace(context, [...envelope.bottom].reverse());
        context.closePath();
        context.clip();

        const direction = twizzlerMapDirectionVector(map.flowDirection);
        const perpendicular = { x: -direction.y, y: direction.x };
        const span = Math.hypot(canvas.width, canvas.height);
        const spacing = Math.max(2, span * map.flowSpacing);
        const bandWidth = Math.max(1, span * map.flowBandWidth);
        const travel = (flowTimeSec * map.flowSpeed * span * 0.12 + map.flowPhase * spacing) % spacing;
        const flowLevel = gray(Math.max(0, Math.min(1, map.ribbonLevel + map.flowAmplitude)));
        context.strokeStyle = `rgb(${flowLevel}, ${flowLevel}, ${flowLevel})`;
        context.globalAlpha = map.flowOpacity;
        context.lineCap = "round";

        for (let offset = -span * 1.5; offset <= span * 1.5; offset += spacing) {
          const shifted = offset + travel;
          const centerX = canvas.width * 0.5 + direction.x * shifted;
          const centerY = canvas.height * 0.5 + direction.y * shifted;
          context.beginPath();
          context.moveTo(centerX - perpendicular.x * span, centerY - perpendicular.y * span);
          context.lineTo(centerX + perpendicular.x * span, centerY + perpendicular.y * span);
          if (map.flowSoftness > 0) {
            context.lineWidth = bandWidth * (1 + map.flowSoftness * 1.8);
            context.globalAlpha = map.flowOpacity * 0.2;
            context.stroke();
            context.beginPath();
            context.moveTo(centerX - perpendicular.x * span, centerY - perpendicular.y * span);
            context.lineTo(centerX + perpendicular.x * span, centerY + perpendicular.y * span);
          }
          context.lineWidth = bandWidth;
          context.globalAlpha = map.flowOpacity;
          context.stroke();
        }
        context.restore();
      }
      context.restore();
    },
  };
}
