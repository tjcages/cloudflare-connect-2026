import {
  Float32BufferAttribute,
  Shape,
  ShapeGeometry,
  type BufferGeometry,
} from "three";

export const BADGE_PRINT_MESH_NAME = "badge-print";

export function roundedRect(width: number, height: number, radius: number) {
  const shape = new Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Three.js Shape/Extrude geometries store the shape's x/y (meters) as UVs.
 * A 0.1×0.158 card therefore samples ~0.05 of the canvas — the white fillRect
 * corner — so the printed Twizzler, rain, logo, and identity never appear.
 */
export function assignRectUVs(
  geometry: BufferGeometry,
  width: number,
  height: number
) {
  const position = geometry.attributes.position;
  if (!position) return;
  const w = Math.max(width, 1e-6);
  const h = Math.max(height, 1e-6);
  const uvs = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i += 1) {
    uvs[i * 2] = position.getX(i) / w + 0.5;
    uvs[i * 2 + 1] = position.getY(i) / h + 0.5;
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
}

export function createPrintFaceGeometry(
  width: number,
  height: number,
  radius: number
) {
  const geometry = new ShapeGeometry(roundedRect(width, height, radius), 12);
  assignRectUVs(geometry, width, height);
  geometry.computeVertexNormals();
  return geometry;
}

export function uvRange(geometry: BufferGeometry) {
  const uv = geometry.attributes.uv;
  if (!uv) {
    return { minU: 0, maxU: 0, minV: 0, maxV: 0 };
  }
  let minU = Number.POSITIVE_INFINITY;
  let maxU = Number.NEGATIVE_INFINITY;
  let minV = Number.POSITIVE_INFINITY;
  let maxV = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < uv.count; i += 1) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return { minU, maxU, minV, maxV };
}
