import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pencil, Square } from "lucide-react";
import {
  appendSurfacePoint,
  findSurfaceAreaAtPoint,
  finishSurfaceFrame,
  finishSurfacePath,
  surfaceFramePoints,
  translateSurfaceAreaPoints,
  type SurfaceArea,
  type SurfaceAreaKind,
  type SurfacePoint,
} from "../surfaceWorkspace";

type SurfaceCanvasOverlayProps = {
  drawingKind: SurfaceAreaKind | null;
  areas: readonly SurfaceArea[];
  selectedArea: SurfaceArea | null;
  onComplete: (kind: SurfaceAreaKind, points: SurfacePoint[]) => void;
  onSelectArea: (id: string) => void;
  onPreviewPoints: (id: string, points: SurfacePoint[]) => void;
  onChangePoints: (id: string, points: SurfacePoint[]) => void;
  onCancel: () => void;
};

type FrameCorner = 0 | 1 | 2 | 3;

type FrameResize = {
  areaId: string;
  corner: FrameCorner;
  opposite: SurfacePoint;
  pointerId: number;
};

type SurfaceMove = {
  areaId: string;
  anchor: SurfacePoint;
  points: SurfacePoint[];
  pointerId: number;
};

const FRAME_CORNERS: {
  index: FrameCorner;
  className: string;
  label: string;
}[] = [
  { index: 0, className: "is-top-left", label: "top left" },
  { index: 1, className: "is-top-right", label: "top right" },
  { index: 2, className: "is-bottom-right", label: "bottom right" },
  { index: 3, className: "is-bottom-left", label: "bottom left" },
];

function pointFromClient(element: HTMLElement, clientX: number, clientY: number): SurfacePoint {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.width > 0 ? (clientX - rect.left) / rect.width : 0,
    y: rect.height > 0 ? (clientY - rect.top) / rect.height : 0,
  };
}

function pointFromEvent(element: HTMLElement, event: ReactPointerEvent<HTMLElement>): SurfacePoint {
  return pointFromClient(element, event.clientX, event.clientY);
}

function pointsAttribute(points: readonly SurfacePoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function constrainFrameCorner(point: SurfacePoint, resize: FrameResize): SurfacePoint {
  const leftCorner = resize.corner === 0 || resize.corner === 3;
  const topCorner = resize.corner === 0 || resize.corner === 1;
  return {
    x: leftCorner ? Math.min(point.x, resize.opposite.x) : Math.max(point.x, resize.opposite.x),
    y: topCorner ? Math.min(point.y, resize.opposite.y) : Math.max(point.y, resize.opposite.y),
  };
}

export function SurfaceCanvasOverlay({
  drawingKind,
  areas,
  selectedArea,
  onComplete,
  onSelectArea,
  onPreviewPoints,
  onChangePoints,
  onCancel,
}: SurfaceCanvasOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<SurfacePoint[]>([]);
  const pointsRef = useRef<SurfacePoint[]>([]);
  const anchorRef = useRef<SurfacePoint | null>(null);
  const drawingRef = useRef(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resizeRef = useRef<FrameResize | null>(null);
  const resizePointsRef = useRef<SurfacePoint[] | null>(null);
  const [resizePoints, setResizePoints] = useState<SurfacePoint[] | null>(null);
  const moveRef = useRef<SurfaceMove | null>(null);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    pointsRef.current = [];
    anchorRef.current = null;
    drawingRef.current = false;
    setPoints([]);
    setDrawing(false);
    setError(null);
  }, [drawingKind]);

  useEffect(() => {
    resizeRef.current = null;
    resizePointsRef.current = null;
    moveRef.current = null;
    setResizePoints(null);
    setMoving(false);
  }, [selectedArea?.id]);

  useEffect(() => {
    if (!drawingKind) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingKind, onCancel]);

  function setResizePreview(next: SurfacePoint[] | null) {
    resizePointsRef.current = next;
    setResizePoints(next);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawingKind || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setError(null);
    drawingRef.current = true;
    setDrawing(true);
    const anchor = pointFromEvent(event.currentTarget, event);
    anchorRef.current = anchor;
    const next = drawingKind === "frame" ? surfaceFramePoints(anchor, anchor) : [anchor];
    pointsRef.current = next;
    setPoints(next);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawingKind || !drawingRef.current) return;
    event.preventDefault();
    const point = pointFromEvent(event.currentTarget, event);
    const next =
      drawingKind === "frame" && anchorRef.current
        ? surfaceFramePoints(anchorRef.current, point)
        : appendSurfacePoint(pointsRef.current, point);
    pointsRef.current = next;
    setPoints(next);
  }

  function finishDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drawingKind || !drawingRef.current) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    drawingRef.current = false;
    setDrawing(false);
    const point = pointFromEvent(event.currentTarget, event);
    const finished =
      drawingKind === "frame" && anchorRef.current
        ? finishSurfaceFrame(anchorRef.current, point)
        : finishSurfacePath(appendSurfacePoint(pointsRef.current, point));
    if (!finished) {
      pointsRef.current = [];
      anchorRef.current = null;
      setPoints([]);
      setError(drawingKind === "frame" ? "Drag a larger frame." : "Draw a larger closed area.");
      return;
    }
    onComplete(drawingKind, finished);
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLButtonElement>, corner: FrameCorner) {
    if (!selectedArea || selectedArea.kind !== "frame" || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const canonical = surfaceFramePoints(selectedArea.points[0]!, selectedArea.points[2]!);
    const nextResize: FrameResize = {
      areaId: selectedArea.id,
      corner,
      opposite: canonical[((corner + 2) % 4) as FrameCorner]!,
      pointerId: event.pointerId,
    };
    resizeRef.current = nextResize;
    setResizePreview(canonical);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateResizePreview(event: ReactPointerEvent<HTMLButtonElement>): SurfacePoint[] | null {
    const resize = resizeRef.current;
    const overlay = overlayRef.current;
    if (!resize || !overlay || resize.pointerId !== event.pointerId) return null;
    const point = constrainFrameCorner(pointFromClient(overlay, event.clientX, event.clientY), resize);
    const next = finishSurfaceFrame(resize.opposite, point);
    if (next) setResizePreview(next);
    return next;
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!resizeRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    updateResizePreview(event);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    updateResizePreview(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    const finished = resizePointsRef.current;
    resizeRef.current = null;
    setResizePreview(null);
    if (finished) onChangePoints(resize.areaId, finished);
  }

  function handleResizePointerCancel(event: ReactPointerEvent<HTMLButtonElement>) {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = null;
    setResizePreview(null);
  }

  function handleMovePointerDown(event: ReactPointerEvent<SVGPolygonElement>) {
    if (!selectedArea || !selectedArea.visible || event.button !== 0) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    event.preventDefault();
    event.stopPropagation();
    const anchor = pointFromClient(overlay, event.clientX, event.clientY);
    const topArea = findSurfaceAreaAtPoint(areas, anchor);
    if (topArea && topArea.id !== selectedArea.id) {
      onSelectArea(topArea.id);
      return;
    }
    moveRef.current = {
      areaId: selectedArea.id,
      anchor,
      points: selectedArea.points,
      pointerId: event.pointerId,
    };
    setMoving(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateMove(event: ReactPointerEvent<SVGPolygonElement>): SurfacePoint[] | null {
    const move = moveRef.current;
    const overlay = overlayRef.current;
    if (!move || !overlay || move.pointerId !== event.pointerId) return null;
    const point = pointFromClient(overlay, event.clientX, event.clientY);
    const next = translateSurfaceAreaPoints(move.points, {
      x: point.x - move.anchor.x,
      y: point.y - move.anchor.y,
    });
    onPreviewPoints(move.areaId, next);
    return next;
  }

  function handleMovePointerMove(event: ReactPointerEvent<SVGPolygonElement>) {
    if (!moveRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    updateMove(event);
  }

  function handleMovePointerUp(event: ReactPointerEvent<SVGPolygonElement>) {
    const move = moveRef.current;
    if (!move || move.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const next = updateMove(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    moveRef.current = null;
    setMoving(false);
    if (next) onChangePoints(move.areaId, next);
  }

  function handleMovePointerCancel(event: ReactPointerEvent<SVGPolygonElement>) {
    const move = moveRef.current;
    if (!move || move.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    onPreviewPoints(move.areaId, move.points);
    moveRef.current = null;
    setMoving(false);
  }

  const selectedSurface = drawingKind === null && selectedArea?.visible ? selectedArea : null;
  const selectedFrame = selectedSurface?.kind === "frame" ? selectedSurface : null;
  const displayedSelectionPoints =
    selectedFrame && resizePoints ? resizePoints : selectedSurface ? selectedSurface.points : null;
  const displayedFramePoints =
    selectedFrame && resizePoints ? resizePoints : selectedFrame ? selectedFrame.points : null;
  const frameBounds = displayedFramePoints
    ? surfaceFramePoints(displayedFramePoints[0]!, displayedFramePoints[2]!)
    : null;
  const frameName = selectedFrame?.name ?? "frame";
  const prompt =
    error ??
    (drawingKind === "frame"
      ? drawing
        ? "Release to create frame"
        : "Drag to draw a frame"
      : drawing
        ? "Keep drawing · release to finish"
        : "Draw a freeform area on the canvas");

  return (
    <div
      ref={overlayRef}
      className={`surface-canvas-overlay${drawingKind ? " is-drawing" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrawing}
      onPointerCancel={finishDrawing}
    >
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
        {points.length > 1 ? (
          <polyline
            points={pointsAttribute(points)}
            className="surface-drawing-path"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {selectedSurface && displayedSelectionPoints ? (
          <polygon
            points={pointsAttribute(displayedSelectionPoints)}
            className={`surface-area-selection${moving ? " is-moving" : ""}`}
            vectorEffect="non-scaling-stroke"
            onPointerDown={handleMovePointerDown}
            onPointerMove={handleMovePointerMove}
            onPointerUp={handleMovePointerUp}
            onPointerCancel={handleMovePointerCancel}
          />
        ) : null}
      </svg>
      {selectedFrame && frameBounds ? (
        <div
          className="surface-frame-selection"
          style={{
            left: `${frameBounds[0]!.x * 100}%`,
            top: `${frameBounds[0]!.y * 100}%`,
            width: `${(frameBounds[2]!.x - frameBounds[0]!.x) * 100}%`,
            height: `${(frameBounds[2]!.y - frameBounds[0]!.y) * 100}%`,
          }}
        >
          {FRAME_CORNERS.map((corner) => (
            <button
              key={corner.index}
              type="button"
              className={`surface-frame-handle ${corner.className}`}
              aria-label={`Resize ${frameName} from ${corner.label}`}
              onPointerDown={(event) => handleResizePointerDown(event, corner.index)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={handleResizePointerCancel}
            />
          ))}
        </div>
      ) : null}
      {drawingKind ? (
        <output
          className="surface-drawing-prompt"
          aria-live="polite"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {drawingKind === "frame" ? (
            <Square size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Pencil size={14} strokeWidth={1.75} aria-hidden />
          )}
          <span>{prompt}</span>
          <button type="button" onClick={onCancel}>
            Cancel <kbd>Esc</kbd>
          </button>
        </output>
      ) : null}
    </div>
  );
}
