"use no memo";

import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { BufferGeometry, Camera, Texture } from "three";
import {
  Bone,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from "three";

const LANYARD_URL = "/connect/badge-lanyard.glb";
const MODEL_SCALE = 14;
const TEXTURE_W = 1024;
const TEXTURE_H = 1536;
const TAG_CUT_Y = 0.105;
const CLIP_CLUSTER_Y0 = 0.118;
const CLIP_CLUSTER_Y1 = 0.135;
const WING_CUT_X = 0.02;
const LEFT_TASSEL_X = -0.02;
const CHAIN_BONES = 8;
const GRAVITY = -1.65;
const DAMPING_TIP = 0.93;
const DAMPING_CORD = 0.975;
const DAMPING_Y = 0.88;
const CONSTRAINT_ITERS = 3;
const CONSTRAINT_STIFFNESS = 0.34;
const DRAG_FOLLOW = 0.13;
const REST_PULL = 0.016;
const SWAY_FOLLOW = 0.15;
const SLEEP_EPS = 0.0009;
const DRAG_LIMIT_X = 0.28;
const DRAG_LIMIT_UP = 0.08;
const DRAG_LIMIT_DOWN = 0.16;
const INWARD_Z = 0.2;
const TWIST_POS = 4.2;
const TWIST_VEL = 10;
const TWIST_MAX = 0.72;
const TWIST_SMOOTH = 0.055;
const ROLL_POS = 0.42;
const ROLL_MAX = 0.2;

const CARD_W = 0.1;
const CARD_H = 0.158;
const CARD_D = 0.003;
const CARD_RADIUS = 0.007;
const SHADER_INSET = 0.003;
const CARD_OVERLAP = 0.006;
const CARD_LOCAL_Y = -(CARD_H / 2) + CARD_OVERLAP;
const HANG_Y = -CARD_LOCAL_Y * MODEL_SCALE;
const WALL_Z = -0.022;
const SHADOW_OPACITY = 0.5;
const SHADOW_PLANE_W = 0.66;
const SHADOW_PLANE_H = 0.54;
const SHADOW_PLANE_Y = 0.02;
const SHADOW_MAP_W = 512;
const SHADOW_MAP_H = 420;

const ACCENT = "#f46021";
const METAL = ACCENT;
const PLASTIC = "#2b2b2b";
const CORD = ACCENT;
const WEBBING = ACCENT;

const Y_UP = new Vector3(0, 1, 0);
const CARD_WORLD = new Vector3();

export type BadgeCardIdentity = {
  name: string;
  company: string;
  role: string;
  serial: string;
  accent: string;
};

type LanyardPart = "metal" | "plastic" | "webbing" | "cord";

function roundedRect(width: number, height: number, radius: number) {
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

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number
) {
  const sourceW = source.width;
  const sourceH = source.height;
  if (sourceW < 2 || sourceH < 2) return;
  const destAspect = destW / destH;
  const sourceAspect = sourceW / sourceH;
  let sx = 0;
  let sy = 0;
  let sw = sourceW;
  let sh = sourceH;
  if (sourceAspect > destAspect) {
    sw = sourceH * destAspect;
    sx = (sourceW - sw) / 2;
  } else {
    sh = sourceW / destAspect;
    sy = (sourceH - sh) / 2;
  }
  ctx.drawImage(source, sx, sy, sw, sh, destX, destY, destW, destH);
}

function drawIdentity(
  ctx: CanvasRenderingContext2D,
  identity: BadgeCardIdentity,
  width: number,
  height: number
) {
  const footer = Math.round(height * 0.2);
  const top = height - footer;
  const fade = ctx.createLinearGradient(0, top, 0, height);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(0.35, "rgba(255,255,255,0.82)");
  fade.addColorStop(1, "rgba(255,255,255,0.96)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, top, width, footer);

  const pad = width * 0.08;
  ctx.fillStyle = "#1a1a1a";
  ctx.textBaseline = "top";
  ctx.font = '400 72px "STK Bureau Sans", sans-serif';
  ctx.fillText(identity.name, pad, top + 28, width - pad * 2);
  ctx.font = '300 40px "STK Bureau Sans", sans-serif';
  ctx.fillStyle = "#5c5c5c";
  ctx.fillText(identity.company, pad, top + 112, width - pad * 2);
  ctx.font = '400 28px "Paper Mono", ui-monospace, monospace';
  ctx.fillStyle = identity.accent;
  ctx.fillText(
    `${identity.role.toUpperCase()}  ·  ${identity.serial}`,
    pad,
    top + 168,
    width - pad * 2
  );
}

function useHeroShaderTexture(
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>,
  rainCanvas: RefObject<HTMLCanvasElement | null>,
  identity: BadgeCardIdentity
) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 16;
    map.needsUpdate = true;
    return map;
  }, []);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(() => {
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const twizzler = twizzlerCanvas.current;
    const rain = rainCanvas.current;
    if (twizzler) drawCover(ctx, twizzler, 0, 0, canvas.width, canvas.height);
    if (rain) drawCover(ctx, rain, 0, 0, canvas.width, canvas.height);
    drawIdentity(ctx, identity, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  return texture;
}

function filterTriangles(
  geometry: BufferGeometry,
  keep: (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => boolean
) {
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!position || !index) return;
  const next: number[] = [];
  const vertex = new Vector3();
  const read = (vertIndex: number) => {
    vertex.fromBufferAttribute(position, vertIndex);
    return vertex;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    const pa = read(a);
    const ax = pa.x;
    const ay = pa.y;
    const pb = read(b);
    const bx = pb.x;
    const by = pb.y;
    const pc = read(c);
    const cx = pc.x;
    const cy = pc.y;
    if (!keep(ax, ay, bx, by, cx, cy)) continue;
    next.push(a, b, c);
  }
  geometry.setIndex(next);
}

function findClipAnchor(geometry: BufferGeometry): { x: number; y: number } {
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!position || !index) return { x: 0, y: 0 };
  const vertex = new Vector3();
  const xs: number[] = [];
  const ys: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < index.count; i += 1) {
    const vertIndex = index.getX(i);
    if (seen.has(vertIndex)) continue;
    seen.add(vertIndex);
    vertex.fromBufferAttribute(position, vertIndex);
    if (vertex.y < CLIP_CLUSTER_Y0 || vertex.y > CLIP_CLUSTER_Y1) continue;
    xs.push(vertex.x);
    ys.push(vertex.y);
  }
  if (xs.length === 0) return { x: 0, y: TAG_CUT_Y };
  let bestN = 0;
  let bestX = 0;
  for (let start = -0.08; start < 0.08; start += 0.002) {
    let n = 0;
    let sum = 0;
    for (const x of xs) {
      if (x < start || x >= start + 0.025) continue;
      n += 1;
      sum += x;
    }
    if (n > bestN) {
      bestN = n;
      bestX = sum / n;
    }
  }
  const y = ys.reduce((total, value) => total + value, 0) / ys.length;
  return { x: bestX, y };
}

function classifyPart(y: number): LanyardPart {
  if (y < 0.02) return "metal";
  if (y < 0.045) return "plastic";
  if (y < 0.062) return "webbing";
  return "cord";
}

function splitByPart(geometry: BufferGeometry): Record<LanyardPart, BufferGeometry> {
  const groups: Record<LanyardPart, number[]> = {
    metal: [],
    plastic: [],
    webbing: [],
    cord: [],
  };
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!position || !index) {
    return {
      metal: geometry.clone(),
      plastic: geometry.clone(),
      webbing: geometry.clone(),
      cord: geometry.clone(),
    };
  }
  const vertex = new Vector3();
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    vertex.fromBufferAttribute(position, a);
    const y = (vertex.y +
      vertex.fromBufferAttribute(position, b).y +
      vertex.fromBufferAttribute(position, c).y) /
      3;
    groups[classifyPart(y)].push(a, b, c);
  }
  const split = (part: LanyardPart) => {
    const next = geometry.clone();
    next.setIndex(groups[part]);
    return next;
  };
  return {
    metal: split("metal"),
    plastic: split("plastic"),
    webbing: split("webbing"),
    cord: split("cord"),
  };
}

function skinAlongY(geometry: BufferGeometry, length: number) {
  const position = geometry.attributes.position;
  if (!position) throw new Error("Lanyard mesh has no positions.");
  const vertex = new Vector3();
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const usable = Math.max(length, 0.001);
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const along = MathUtils.clamp((vertex.y / usable) * CHAIN_BONES, 0, CHAIN_BONES);
    const lower = Math.min(Math.floor(along), CHAIN_BONES - 1);
    const blend = along - lower;
    skinIndices.push(lower, lower + 1, 0, 0);
    skinWeights.push(1 - blend, blend, 0, 0);
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(skinWeights, 4)
  );
}

function makePartMaterial(
  source: MeshStandardMaterial,
  color: string,
  metalness: number,
  roughness: number,
  keepNormal: boolean,
  emissive = 0
) {
  const material = source.clone();
  material.map = null;
  material.aoMap = null;
  material.metalnessMap = null;
  material.roughnessMap = null;
  if (!keepNormal) material.normalMap = null;
  material.color = new Color(color);
  material.metalness = metalness;
  material.roughness = roughness;
  material.emissive = new Color(emissive > 0 ? color : "#000000");
  material.emissiveIntensity = emissive;
  material.side = DoubleSide;
  material.vertexColors = false;
  return material;
}

function hookXFromMetal(geometry: BufferGeometry): number {
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!position || !index || index.count === 0) return 0;
  const vertex = new Vector3();
  let minY = Number.POSITIVE_INFINITY;
  const seen = new Set<number>();
  for (let i = 0; i < index.count; i += 1) {
    const vertIndex = index.getX(i);
    if (seen.has(vertIndex)) continue;
    seen.add(vertIndex);
    vertex.fromBufferAttribute(position, vertIndex);
    minY = Math.min(minY, vertex.y);
  }
  let sum = 0;
  let count = 0;
  seen.clear();
  for (let i = 0; i < index.count; i += 1) {
    const vertIndex = index.getX(i);
    if (seen.has(vertIndex)) continue;
    seen.add(vertIndex);
    vertex.fromBufferAttribute(position, vertIndex);
    if (vertex.y > minY + 0.008) continue;
    sum += vertex.x;
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

function createBadgeCard(texture: Texture, hookX: number): Group {
  const card = new Group();
  card.position.set(hookX, CARD_LOCAL_Y, 0);

  const bodyGeometry = new ExtrudeGeometry(roundedRect(CARD_W, CARD_H, CARD_RADIUS), {
    depth: CARD_D,
    bevelEnabled: false,
    steps: 1,
  });
  bodyGeometry.translate(0, 0, -CARD_D / 2);
  const body = new Mesh(
    bodyGeometry,
    new MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.04,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
  );
  const face = new Mesh(
    new PlaneGeometry(CARD_W - SHADER_INSET * 2, CARD_H - SHADER_INSET * 2),
    new MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    })
  );
  face.position.z = CARD_D / 2 + 0.0008;
  card.add(body);
  card.add(face);
  return card;
}

function traceRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createWallShadow(): { mesh: Mesh; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = SHADOW_MAP_W;
  canvas.height = SHADOW_MAP_H;
  const map = new CanvasTexture(canvas);
  map.needsUpdate = true;
  const material = new MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    opacity: SHADOW_OPACITY,
    toneMapped: false,
    color: "#000000",
  });
  const mesh = new Mesh(
    new PlaneGeometry(SHADOW_PLANE_W, SHADOW_PLANE_H),
    material
  );
  mesh.position.set(0, SHADOW_PLANE_Y, WALL_Z);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, canvas };
}

function applyWallShadow(rig: LanyardRig) {
  const canvas = rig.shadowCanvas;
  const ctx = canvas.getContext("2d");
  const map = (rig.shadow.material as MeshBasicMaterial).map;
  if (!ctx || !map) return;

  rig.card.getWorldPosition(CARD_WORLD);
  rig.group.worldToLocal(CARD_WORLD);
  const lift = MathUtils.clamp((CARD_WORLD.z - WALL_Z) / 0.09, 0, 1);
  const shiftX = -0.007 - lift * 0.014;
  const shiftY = -0.01 - lift * 0.012;
  const toX = (x: number) =>
    ((x + shiftX) / SHADOW_PLANE_W + 0.5) * canvas.width;
  const toY = (y: number) =>
    (0.5 - (y + shiftY - SHADOW_PLANE_Y) / SHADOW_PLANE_H) * canvas.height;
  const px = canvas.width / SHADOW_PLANE_W;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = `blur(${11 + lift * 16}px)`;
  ctx.globalAlpha = 0.72 * (1 - lift * 0.42);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const points = rig.rope.now;
  ctx.lineWidth = 0.015 * px;
  ctx.beginPath();
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index]!;
    const x = toX(point.x);
    const y = toY(point.y);
    if (index === points.length - 1) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.lineWidth = 0.028 * px;
  const clip = points[0]!;
  const clipX = toX(clip.x);
  const clipY = toY(clip.y);
  ctx.beginPath();
  ctx.moveTo(clipX, clipY);
  const next = points[1] ?? clip;
  ctx.lineTo(toX(next.x * 0.35 + clip.x * 0.65), toY(next.y * 0.35 + clip.y * 0.65));
  ctx.stroke();

  const cardW = CARD_W * px;
  const cardH = CARD_H * (canvas.height / SHADOW_PLANE_H);
  ctx.save();
  ctx.translate(toX(CARD_WORLD.x), toY(CARD_WORLD.y));
  ctx.rotate(-rig.card.rotation.z);
  ctx.scale(Math.max(0.32, Math.abs(Math.cos(rig.card.rotation.y))), 1);
  traceRoundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, CARD_RADIUS * px);
  ctx.fill();
  ctx.restore();

  ctx.filter = "none";
  ctx.globalAlpha = 1;
  map.needsUpdate = true;
  (rig.shadow.material as MeshBasicMaterial).opacity =
    SHADOW_OPACITY * (1 - lift * 0.4);
}

type RopeState = {
  now: Vector3[];
  prev: Vector3[];
  restPoints: Vector3[];
  rest: number;
  pin: Vector3;
};

type LanyardRig = {
  group: Group;
  root: Bone;
  bones: Bone[];
  meshes: SkinnedMesh[];
  materials: Record<LanyardPart, MeshStandardMaterial>;
  card: Group;
  shadow: Mesh;
  shadowCanvas: HTMLCanvasElement;
  rope: RopeState;
};

function buildLanyardRig(source: Mesh, texture: Texture): LanyardRig {
  const geometry = (source.geometry as BufferGeometry).clone();
  source.updateWorldMatrix(true, false);
  geometry.applyMatrix4(source.matrixWorld);
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const length = box.max.y - box.min.y;
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2
  );
  filterTriangles(geometry, (ax, ay, bx, by, cx, cy) => {
    const y = (ay + by + cy) / 3;
    const x = (ax + bx + cx) / 3;
    if (y < TAG_CUT_Y) return false;
    if (y < 0.15 && x < WING_CUT_X) return false;
    return true;
  });
  const anchor = findClipAnchor(geometry);
  geometry.translate(-anchor.x, -anchor.y, 0);
  filterTriangles(geometry, (ax, ay, bx, by, cx, cy) => {
    const x = (ax + bx + cx) / 3;
    return x >= LEFT_TASSEL_X;
  });
  const cordLength = Math.max(length - anchor.y, 0.08);

  skinAlongY(geometry, cordLength);
  const parts = splitByPart(geometry);
  const sourceMaterial = source.material as MeshStandardMaterial;
  const materials: Record<LanyardPart, MeshStandardMaterial> = {
    metal: makePartMaterial(sourceMaterial, METAL, 0.48, 0.28, true, 0.2),
    plastic: makePartMaterial(sourceMaterial, PLASTIC, 0.08, 0.5, true),
    webbing: makePartMaterial(sourceMaterial, WEBBING, 0.4, 0.32, true, 0.14),
    cord: makePartMaterial(sourceMaterial, CORD, 0.36, 0.34, true, 0.12),
  };

  const segment = cordLength / CHAIN_BONES;
  const bones: Bone[] = [];
  for (let index = 0; index <= CHAIN_BONES; index += 1) {
    const bone = new Bone();
    bone.position.y = index === 0 ? 0 : segment;
    const parent = bones[index - 1];
    if (parent) parent.add(bone);
    bones.push(bone);
  }
  const root = bones[0]!;
  const skeleton = new Skeleton(bones);

  const group = new Group();
  group.add(root);
  const meshes: SkinnedMesh[] = [];
  const partNames: LanyardPart[] = ["metal", "plastic", "webbing", "cord"];
  for (const part of partNames) {
    const mesh = new SkinnedMesh(parts[part], materials[part]);
    mesh.bind(skeleton);
    group.add(mesh);
    meshes.push(mesh);
  }

  const hookX = hookXFromMetal(parts.metal);
  const card = createBadgeCard(texture, hookX);
  root.add(card);
  const wallShadow = createWallShadow();
  group.add(wallShadow.mesh);

  const now: Vector3[] = [];
  const prev: Vector3[] = [];
  const restPoints: Vector3[] = [];
  for (let index = 0; index <= CHAIN_BONES; index += 1) {
    const point = new Vector3(0, index * segment, 0);
    restPoints.push(point.clone());
    now.push(point.clone());
    prev.push(point.clone());
  }

  return {
    group,
    root,
    bones,
    meshes,
    materials,
    card,
    shadow: wallShadow.mesh,
    shadowCanvas: wallShadow.canvas,
    rope: {
      now,
      prev,
      restPoints,
      rest: segment,
      pin: restPoints[restPoints.length - 1]!.clone(),
    },
  };
}

function snapRopeToRest(rope: RopeState) {
  for (let index = 0; index < rope.now.length; index += 1) {
    rope.now[index]!.copy(rope.restPoints[index]!);
    rope.prev[index]!.copy(rope.restPoints[index]!);
  }
}

function ropeIsAsleep(rope: RopeState) {
  let maxOff = 0;
  for (let index = 0; index < rope.now.length; index += 1) {
    const now = rope.now[index]!;
    const rest = rope.restPoints[index]!;
    const prev = rope.prev[index]!;
    maxOff = Math.max(
      maxOff,
      Math.hypot(now.x - rest.x, now.z - rest.z),
      Math.hypot(now.x - prev.x, now.z - prev.z)
    );
  }
  return maxOff < SLEEP_EPS;
}

function solveDistance(
  a: Vector3,
  b: Vector3,
  rest: number,
  pinA: boolean,
  pinB: boolean
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  const shift = ((dist - rest) / dist) * CONSTRAINT_STIFFNESS;
  const px = dx * shift;
  const py = dy * shift;
  const pz = dz * shift;
  if (!pinA) {
    const scale = pinB ? 2 : 1;
    a.x += px * scale;
    a.y += py * scale;
    a.z += pz * scale;
  }
  if (!pinB) {
    const scale = pinA ? 2 : 1;
    b.x -= px * scale;
    b.y -= py * scale;
    b.z -= pz * scale;
  }
}

function projectInextensible(rope: RopeState) {
  const last = rope.now.length - 1;
  rope.now[last]!.copy(rope.pin);
  for (let index = last - 1; index >= 0; index -= 1) {
    const point = rope.now[index]!;
    const parent = rope.now[index + 1]!;
    const dx = point.x - parent.x;
    const dy = point.y - parent.y;
    const dz = point.z - parent.z;
    const dist = Math.hypot(dx, dy, dz) || 0.0001;
    const scale = rope.rest / dist;
    point.x = parent.x + dx * scale;
    point.y = parent.y + dy * scale;
    point.z = parent.z + dz * scale;
  }
}

function applySway(rope: RopeState) {
  const last = rope.now.length - 1;
  const tip = rope.now[0]!;
  for (let index = 1; index < last; index += 1) {
    const along = 1 - index / last;
    const lag = along * along;
    const point = rope.now[index]!;
    point.x += (tip.x * lag - point.x) * SWAY_FOLLOW;
    point.z += (tip.z * lag - point.z) * SWAY_FOLLOW;
  }
}

function constrainRope(rope: RopeState, drag: Vector3 | null) {
  const last = rope.now.length - 1;
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter += 1) {
    for (let index = 0; index < last; index += 1) {
      solveDistance(
        rope.now[index]!,
        rope.now[index + 1]!,
        rope.rest,
        false,
        index + 1 === last
      );
    }
    rope.now[last]!.copy(rope.pin);
    if (drag) {
      const tip = rope.now[0]!;
      tip.x += (drag.x - tip.x) * 0.18;
      tip.y += (drag.y - tip.y) * 0.12;
      tip.z += (drag.z - tip.z) * 0.18;
    }
  }
  projectInextensible(rope);
  for (let index = 0; index < last; index += 1) {
    rope.prev[index]!.y = rope.now[index]!.y;
  }
}

function stepRope(
  rope: RopeState,
  drag: Vector3 | null,
  dt: number,
  reducedMotion: boolean
) {
  const last = rope.now.length - 1;
  if (reducedMotion) {
    snapRopeToRest(rope);
    return;
  }

  if (!drag && ropeIsAsleep(rope)) {
    snapRopeToRest(rope);
    return;
  }

  const gravity = GRAVITY * dt * dt;
  for (let index = 0; index < last; index += 1) {
    const point = rope.now[index]!;
    const previous = rope.prev[index]!;
    const damp = index === 0 ? DAMPING_TIP : DAMPING_CORD;
    const vx = (point.x - previous.x) * damp;
    const vy = (point.y - previous.y) * DAMPING_Y;
    const vz = (point.z - previous.z) * damp;
    previous.copy(point);
    point.x += vx;
    point.y += vy + gravity;
    point.z += vz;
  }

  if (drag) {
    const tip = rope.now[0]!;
    tip.x += (drag.x - tip.x) * DRAG_FOLLOW;
    tip.y += (drag.y - tip.y) * DRAG_FOLLOW * 0.55;
    tip.z += (drag.z - tip.z) * DRAG_FOLLOW;
  }

  constrainRope(rope, drag);

  if (!drag) {
    const tip = rope.now[0]!;
    tip.x += -tip.x * REST_PULL;
    tip.z += -tip.z * REST_PULL;
  }
  applySway(rope);
  projectInextensible(rope);
  rope.now[last]!.copy(rope.pin);
}

function applyRopeToBones(bones: Bone[], rope: RopeState) {
  const look = new Vector3();
  const world = new Quaternion();
  const parent = new Quaternion();
  const points = rope.now;
  bones[0]!.position.copy(points[0]!);
  look.copy(points[1]!).sub(points[0]!);
  if (look.lengthSq() < 1e-10) look.copy(Y_UP);
  else look.normalize();
  bones[0]!.quaternion.setFromUnitVectors(Y_UP, look);

  for (let index = 1; index < bones.length; index += 1) {
    bones[index]!.position.set(0, rope.rest, 0);
    const from = points[index]!;
    const to = points[Math.min(index + 1, points.length - 1)]!;
    look.copy(to).sub(from);
    if (look.lengthSq() < 1e-10) look.copy(Y_UP);
    else look.normalize();
    world.setFromUnitVectors(Y_UP, look);
    const parentLook = from.clone().sub(points[index - 1]!);
    if (parentLook.lengthSq() < 1e-10) parentLook.copy(Y_UP);
    else parentLook.normalize();
    parent.setFromUnitVectors(Y_UP, parentLook);
    bones[index]!.quaternion.copy(parent.invert()).multiply(world);
  }
}

function applyCardTwist(card: Group, rope: RopeState, reducedMotion: boolean) {
  if (reducedMotion) {
    card.rotation.set(0, 0, 0);
    return;
  }
  const tip = rope.now[0]!;
  const previous = rope.prev[0]!;
  const velX = tip.x - previous.x;
  const twist = MathUtils.clamp(
    -tip.x * TWIST_POS - velX * TWIST_VEL,
    -TWIST_MAX,
    TWIST_MAX
  );
  const roll = MathUtils.clamp(tip.x * ROLL_POS, -ROLL_MAX, ROLL_MAX);
  card.rotation.y = MathUtils.lerp(card.rotation.y, twist, TWIST_SMOOTH);
  card.rotation.z = MathUtils.lerp(card.rotation.z, roll, TWIST_SMOOTH);
}

function tintLanyardMetal(
  materials: Record<LanyardPart, MeshStandardMaterial>,
  hex: string
) {
  const color = new Color(hex);
  const parts: LanyardPart[] = ["metal", "webbing", "cord"];
  for (const part of parts) {
    const material = materials[part];
    material.color.copy(color);
    material.emissive.copy(color);
  }
}

function pointerToWorld(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
  camera: Camera
): Vector3 {
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  const vec = new Vector3(ndcX, ndcY, 0.5);
  vec.unproject(camera);
  const dir = vec.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(distance));
}

function rightColumnWorldX(width: number, viewportWidth: number) {
  if (width < 992) return 0;
  const centerPx = width - 80 - 240;
  return (centerPx / width - 0.5) * viewportWidth;
}

function LanyardBadge({
  twizzlerCanvas,
  rainCanvas,
  reducedMotion,
  identity,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
}) {
  const { gl, camera, viewport, size } = useThree();
  const { scene } = useGLTF(LANYARD_URL);
  const groupRef = useRef<Group>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(new Vector3());
  const dragTarget = useRef(new Vector3());
  const texture = useHeroShaderTexture(twizzlerCanvas, rainCanvas, identity);

  const rig = useMemo(() => {
    let source: Mesh | null = null;
    scene.traverse((child) => {
      if (!source && (child as Mesh).isMesh) source = child as Mesh;
    });
    if (!source) return null;
    return buildLanyardRig(source, texture);
  }, [scene, texture]);

  useEffect(() => {
    if (!rig) return;
    tintLanyardMetal(rig.materials, identity.accent);
  }, [identity.accent, rig]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      for (const mesh of rig.meshes) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
      rig.card.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else {
          material.dispose();
        }
      });
      rig.shadow.geometry.dispose();
      const shadowMaterial = rig.shadow.material as MeshBasicMaterial;
      shadowMaterial.map?.dispose();
      shadowMaterial.dispose();
    };
  }, [rig]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    const onMove = (event: PointerEvent) => {
      if (!dragging.current || !rig) return;
      event.preventDefault();
      const world = pointerToWorld(
        event.clientX,
        event.clientY,
        canvas,
        camera
      );
      const local = world.clone();
      rig.group.worldToLocal(local);
      const x = MathUtils.clamp(
        local.x + dragOffset.current.x,
        -DRAG_LIMIT_X,
        DRAG_LIMIT_X
      );
      const y = MathUtils.clamp(
        local.y + dragOffset.current.y,
        -DRAG_LIMIT_DOWN,
        DRAG_LIMIT_UP
      );
      dragTarget.current.set(x, y, -x * INWARD_Z);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      canvas.style.cursor = "grab";
    };

    canvas.addEventListener("pointermove", onMove, { passive: false });
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);
    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [camera, gl, rig]);

  useFrame((_, delta) => {
    if (!rig) return;
    const dt = Math.min(delta, 1 / 30);
    stepRope(
      rig.rope,
      dragging.current ? dragTarget.current : null,
      dt,
      reducedMotion
    );
    applyRopeToBones(rig.bones, rig.rope);
    applyCardTwist(rig.card, rig.rope, reducedMotion);
    applyWallShadow(rig);
    const hang = groupRef.current;
    if (hang) {
      hang.position.x = rightColumnWorldX(size.width, viewport.width);
      hang.position.y = HANG_Y;
    }
  });

  if (!rig) return null;

  return (
    <group
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!rig) return;
        dragging.current = true;
        const world = pointerToWorld(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
          gl.domElement,
          camera
        );
        const local = world.clone();
        rig.group.worldToLocal(local);
        dragOffset.current.set(
          rig.rope.now[0]!.x - local.x,
          rig.rope.now[0]!.y - local.y,
          0
        );
        const tip = rig.rope.now[0]!;
        dragTarget.current.set(tip.x, tip.y, -tip.x * INWARD_Z);
        gl.domElement.style.cursor = "grabbing";
        gl.domElement.setPointerCapture(event.pointerId);
      }}
      position={[0, HANG_Y, 0]}
      ref={groupRef}
    >
      <group scale={MODEL_SCALE}>
        <primitive object={rig.group} />
      </group>
    </group>
  );
}

function BadgeScene({
  twizzlerCanvas,
  rainCanvas,
  reducedMotion,
  identity,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault fov={30} position={[0, 0.15, 8]} />
      <ambientLight intensity={0.58} />
      <hemisphereLight args={["#fff1e4", "#1a1a1a", 0.5]} />
      <directionalLight intensity={1.45} position={[5, 7, 8]} />
      <directionalLight intensity={0.7} position={[-6, 3, 5]} />
      <directionalLight
        color={identity.accent}
        intensity={0.7}
        position={[2, -1, 6]}
      />
      <LanyardBadge
        identity={identity}
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        twizzlerCanvas={twizzlerCanvas}
      />
    </>
  );
}

useGLTF.preload(LANYARD_URL);

export default function BadgeLanyard({
  twizzlerCanvas,
  rainCanvas,
  reducedMotion,
  identity,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
}) {
  return (
    <Canvas
      camera={{ fov: 30, position: [0, 0.15, 8] }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ height: "100%", touchAction: "none", width: "100%" }}
    >
      <BadgeScene
        identity={identity}
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        twizzlerCanvas={twizzlerCanvas}
      />
    </Canvas>
  );
}
