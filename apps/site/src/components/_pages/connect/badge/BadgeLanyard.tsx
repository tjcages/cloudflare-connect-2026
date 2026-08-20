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
  PerspectiveCamera as ThreePerspectiveCamera,
  Quaternion,
  ShaderMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import {
  BADGE_PRINT_MESH_NAME,
  createPrintFaceGeometry,
  roundedRect,
} from "./badge-card-geometry";
import { badgePrintFieldRect, type BadgePrintFieldRect } from "./badge-print-layout";
import { BADGE_TUNE_DEFAULTS, type BadgeTune } from "./badge-tune";

const LANYARD_URL = "/connect/badge-lanyard.glb";
const TEXTURE_W = 768;
const TEXTURE_H = 1152;
const TEXTURE_W_LOW = 384;
const TEXTURE_H_LOW = 576;
const TAG_CUT_Y = 0.105;
const CLIP_CLUSTER_Y0 = 0.118;
const CLIP_CLUSTER_Y1 = 0.135;
const WING_CUT_X = 0.02;
const LEFT_TASSEL_X = -0.02;
const CHAIN_BONES = 8;
const CONSTRAINT_ITERS = 3;
const SLEEP_EPS = 0.0009;
const DRAG_LIMIT_UP = 0;
const STRETCH_RETURN = 0.1;
const INTRO_X = 0.1;
const INTRO_Z = -0.018;
const INTRO_SPIN = 0.006;

const SHADOW_OPACITY = BADGE_TUNE_DEFAULTS.shadowOpacity;
const SHADOW_SOFT_OPACITY = BADGE_TUNE_DEFAULTS.shadowSoftOpacity;
const SHADOW_INFLATE = BADGE_TUNE_DEFAULTS.inflate;
const SHADOW_LIGHT_DIR = new Vector3(
  BADGE_TUNE_DEFAULTS.lightX,
  BADGE_TUNE_DEFAULTS.lightY,
  BADGE_TUNE_DEFAULTS.lightZ
).normalize();

const ACCENT = "#f46021";
const METAL = ACCENT;
const PLASTIC = "#2b2b2b";
const CORD = ACCENT;
const WEBBING = ACCENT;

const Y_UP = new Vector3(0, 1, 0);
const WALL_WORLD = new Vector3();
const SHADOW_ORIGIN = new Vector3();
const SHADOW_NUDGE = new Vector3();
const BONE_LOOK = new Vector3();
const BONE_PARENT_LOOK = new Vector3();
const BONE_WORLD_Q = new Quaternion();
const BONE_PARENT_Q = new Quaternion();

export type BadgeCardIdentity = {
  name: string;
  company: string;
  role: string;
  serial: string;
  accent: string;
};

type BadgeLanyardProps = {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  logoCanvas: RefObject<HTMLCanvasElement | null>;
  logoMarkSrc: string | null;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
  lowPower: boolean;
  shaderLive: boolean;
  tune: BadgeTune;
};

type LanyardPart = "metal" | "plastic" | "webbing" | "cord";

function cardLocalY(height: number, overlap: number) {
  return -(height / 2) + overlap;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  zoom = 1,
  panX = 0,
  panY = 0
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
  const z = Math.max(zoom, 0.05);
  const cx = sx + sw / 2 + panX * sourceW;
  const cy = sy + sh / 2 + panY * sourceH;
  sw /= z;
  sh /= z;
  sx = cx - sw / 2;
  sy = cy - sh / 2;
  ctx.drawImage(source, sx, sy, sw, sh, destX, destY, destW, destH);
}

function drawIdentity(
  ctx: CanvasRenderingContext2D,
  identity: BadgeCardIdentity,
  width: number,
  height: number,
  footerBand: number
) {
  const footer = Math.round(height * footerBand);
  const top = height - footer;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, top, width, footer);

  const s = width / 1024;
  const pad = width * 0.08;
  ctx.fillStyle = "#1a1a1a";
  ctx.textBaseline = "top";
  ctx.font = `400 ${Math.round(72 * s)}px "STK Bureau Sans", sans-serif`;
  ctx.fillText(identity.name, pad, top + 28 * s, width - pad * 2);
  ctx.font = `300 ${Math.round(40 * s)}px "STK Bureau Sans", sans-serif`;
  ctx.fillStyle = "#5c5c5c";
  ctx.fillText(identity.company, pad, top + 112 * s, width - pad * 2);
  ctx.font = `400 ${Math.round(28 * s)}px "Paper Mono", ui-monospace, monospace`;
  ctx.fillStyle = identity.accent;
  ctx.fillText(
    `${identity.role.toUpperCase()}  ·  ${identity.serial}`,
    pad,
    top + 168 * s,
    width - pad * 2
  );
}

function identityKey(
  identity: BadgeCardIdentity,
  logoMarkSrc: string | null,
  printKey: string
) {
  return `${identity.name}|${identity.company}|${identity.role}|${identity.serial}|${identity.accent}|${logoMarkSrc ?? ""}|${printKey}`;
}

function containSize(srcW: number, srcH: number, maxW: number, maxH: number) {
  const scale = Math.min(maxW / Math.max(srcW, 1), maxH / Math.max(srcH, 1));
  return { w: srcW * scale, h: srcH * scale };
}

function markSize(mark: HTMLImageElement | HTMLCanvasElement) {
  if (mark instanceof HTMLCanvasElement) {
    return { w: mark.width, h: mark.height };
  }
  const w = mark.naturalWidth || mark.width;
  const h = mark.naturalHeight || mark.height;
  return { w, h };
}

function rasterizeMark(image: HTMLImageElement) {
  const size = markSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.w));
  canvas.height = Math.max(1, Math.round(size.h));
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function drawCenteredLogo(
  ctx: CanvasRenderingContext2D,
  mark: HTMLImageElement | HTMLCanvasElement | null,
  field: BadgePrintFieldRect,
  height: number,
  tune: BadgeTune
) {
  if (!tune.logoEnabled || !mark) return;
  const size = markSize(mark);
  if (size.w < 1 || size.h < 1) return;
  const maxW = (field.w - field.w * tune.logoPadX * 2) * tune.logoScale;
  const maxH = Math.max(field.h * tune.logoBand, 1) * tune.logoScale;
  const fit = containSize(size.w, size.h, maxW, maxH);
  const dx = field.x + (field.w - fit.w) / 2;
  const dy = field.y + field.h / 2 - fit.h / 2 + height * tune.logoPadY;
  ctx.save();
  ctx.globalAlpha = tune.logoMarkOpacity;
  ctx.drawImage(mark, dx, dy, fit.w, fit.h);
  ctx.restore();
}

function fadeFieldToWhite(
  ctx: CanvasRenderingContext2D,
  field: BadgePrintFieldRect,
  feather: number
) {
  const fade = Math.max(
    1,
    Math.round(Math.min(field.w, field.h) * Math.max(feather, 0))
  );
  const left = ctx.createLinearGradient(field.x, 0, field.x + fade, 0);
  left.addColorStop(0, "#ffffff");
  left.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = left;
  ctx.fillRect(field.x, field.y, fade, field.h);

  const right = ctx.createLinearGradient(
    field.x + field.w,
    0,
    field.x + field.w - fade,
    0
  );
  right.addColorStop(0, "#ffffff");
  right.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = right;
  ctx.fillRect(field.x + field.w - fade, field.y, fade, field.h);

  const top = ctx.createLinearGradient(0, field.y, 0, field.y + fade);
  top.addColorStop(0, "#ffffff");
  top.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = top;
  ctx.fillRect(field.x, field.y, field.w, fade);

  const bottom = ctx.createLinearGradient(
    0,
    field.y + field.h - fade,
    0,
    field.y + field.h
  );
  bottom.addColorStop(0, "rgba(255,255,255,0)");
  bottom.addColorStop(1, "#ffffff");
  ctx.fillStyle = bottom;
  ctx.fillRect(field.x, field.y + field.h - fade, field.w, fade);
}

function useHeroShaderTexture(
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>,
  rainCanvas: RefObject<HTMLCanvasElement | null>,
  identity: BadgeCardIdentity,
  lowPower: boolean,
  shaderLive: boolean,
  logoCanvas: RefObject<HTMLCanvasElement | null>,
  logoMarkSrc: string | null,
  tune: BadgeTune
) {
  const skip = useRef(0);
  const lastKey = useRef("");
  const bakedWhileFrozen = useRef(false);
  const markImage = useRef<HTMLCanvasElement | null>(null);
  const markGeneration = useRef(0);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = lowPower ? TEXTURE_W_LOW : TEXTURE_W;
    canvas.height = lowPower ? TEXTURE_H_LOW : TEXTURE_H;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = lowPower ? 1 : 4;
    map.needsUpdate = true;
    return map;
  }, [lowPower]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    if (shaderLive) bakedWhileFrozen.current = false;
  }, [shaderLive]);

  useEffect(() => {
    markImage.current = null;
    markGeneration.current += 1;
    const generation = markGeneration.current;
    if (!logoMarkSrc) return;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (generation !== markGeneration.current) return;
      markImage.current = rasterizeMark(image);
      markGeneration.current += 1;
    };
    image.onerror = () => {
      if (generation !== markGeneration.current) return;
      markGeneration.current += 1;
    };
    image.src = logoMarkSrc;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [logoMarkSrc]);

  useFrame(() => {
    const printKey = [
      tune.printZoom,
      tune.printPanX,
      tune.printPanY,
      tune.printTwizzler,
      tune.printRain,
      tune.printPadX,
      tune.printPadTop,
      tune.printFeather,
      tune.logoBand,
      tune.logoPadX,
      tune.logoPadY,
      tune.logoScale,
      tune.logoPrintZoom,
      tune.logoMarkOpacity,
      tune.footerBand,
    ].join("|");
    const key = `${identityKey(identity, logoMarkSrc, printKey)}|${markGeneration.current}`;
    const identityChanged = key !== lastKey.current;
    const logoLive = Boolean(logoMarkSrc);
    skip.current += 1;
    if (!shaderLive && !logoLive && !identityChanged && bakedWhileFrozen.current) {
      return;
    }
    if (
      (shaderLive || logoLive) &&
      !identityChanged &&
      skip.current % (lowPower ? 4 : 2) !== 0
    ) {
      return;
    }
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const field = badgePrintFieldRect(
      canvas.width,
      canvas.height,
      tune.printPadX,
      tune.printPadTop,
      tune.footerBand
    );
    const twizzler = twizzlerCanvas.current;
    const rain = rainCanvas.current;
    const logoShader = logoCanvas.current;
    if (tune.printTwizzler && twizzler) {
      drawCover(
        ctx,
        twizzler,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom,
        tune.printPanX,
        tune.printPanY
      );
    }
    if (tune.printRain && rain) {
      drawCover(
        ctx,
        rain,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom,
        tune.printPanX,
        tune.printPanY
      );
    }
    if (logoShader) {
      drawCover(
        ctx,
        logoShader,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom * tune.logoPrintZoom,
        tune.printPanX,
        tune.printPanY
      );
    }
    fadeFieldToWhite(ctx, field, tune.printFeather);
    drawCenteredLogo(ctx, markImage.current, field, canvas.height, tune);
    drawIdentity(ctx, identity, canvas.width, canvas.height, tune.footerBand);
    texture.needsUpdate = true;
    lastKey.current = key;
    if (!shaderLive) bakedWhileFrozen.current = true;
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

function createBadgeCard(
  texture: Texture,
  hookX: number,
  lowPower: boolean,
  tune: BadgeTune
): { card: Group; body: Mesh } {
  const card = new Group();
  card.position.set(hookX, cardLocalY(tune.cardHeight, tune.cardOverlap), 0);

  const bodyGeometry = new ExtrudeGeometry(
    roundedRect(tune.cardWidth, tune.cardHeight, tune.cardRadius),
    {
      depth: tune.cardDepth,
      bevelEnabled: false,
      steps: 1,
    }
  );
  bodyGeometry.translate(0, 0, -tune.cardDepth / 2);
  const body = new Mesh(
    bodyGeometry,
    lowPower
      ? new MeshStandardMaterial({
          color: "#ffffff",
          emissive: "#ffffff",
          emissiveIntensity: Math.min(tune.cardEmissive, 0.35),
          metalness: 0,
          roughness: Math.max(tune.cardRoughness, 0.22),
          toneMapped: false,
        })
      : new MeshPhysicalMaterial({
          color: "#ffffff",
          emissive: "#ffffff",
          emissiveIntensity: tune.cardEmissive,
          metalness: 0,
          roughness: tune.cardRoughness,
          clearcoat: tune.cardClearcoat,
          clearcoatRoughness: 0.28,
          envMapIntensity: 0.15,
          toneMapped: false,
        })
  );
  const faceWidth = tune.cardWidth - tune.shaderInset * 2;
  const faceHeight = tune.cardHeight - tune.shaderInset * 2;
  const faceRadius = Math.max(tune.cardRadius - tune.shaderInset, 0.001);
  const face = new Mesh(
    createPrintFaceGeometry(faceWidth, faceHeight, faceRadius),
    new MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    })
  );
  face.name = BADGE_PRINT_MESH_NAME;
  face.renderOrder = 1;
  face.position.z = tune.cardDepth / 2 + 0.0008;
  card.add(body);
  card.add(face);
  return { card, body };
}

const SILHOUETTE_VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>

uniform float uWallZ;
uniform vec3 uLightDir;
uniform vec2 uNudge;
uniform float uInflate;
uniform float uOpacity;
uniform float uFadeStart;
uniform float uFadeEnd;

varying float vAlpha;

void main() {
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>

  vec4 world = modelMatrix * vec4(transformed, 1.0);
  float denom = uLightDir.z;
  float t = abs(denom) > 1e-4 ? (uWallZ - world.z) / denom : 0.0;
  t = max(t, 0.0);
  world.xyz += uLightDir * t;
  world.xy += uNudge;

  vec3 worldNormal = normalize(mat3(modelMatrix) * objectNormal);
  float nLen = length(worldNormal.xy);
  vec2 nxy = nLen > 1e-4 ? worldNormal.xy / nLen : vec2(0.0);
  world.xy += nxy * uInflate;
  world.z = uWallZ;

  vAlpha = uOpacity * (1.0 - smoothstep(uFadeStart, uFadeEnd, t));
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const SILHOUETTE_FRAG = /* glsl */ `
varying float vAlpha;

void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, vAlpha);
}
`;

type ShadowUniforms = {
  uWallZ: { value: number };
  uLightDir: { value: Vector3 };
  uNudge: { value: Vector2 };
  uFadeStart: { value: number };
  uFadeEnd: { value: number };
};

function createSilhouetteMaterial(
  uniforms: ShadowUniforms,
  inflate: number,
  opacity: number
) {
  const material = new ShaderMaterial({
    uniforms: {
      uWallZ: uniforms.uWallZ,
      uLightDir: uniforms.uLightDir,
      uNudge: uniforms.uNudge,
      uFadeStart: uniforms.uFadeStart,
      uFadeEnd: uniforms.uFadeEnd,
      uInflate: { value: inflate },
      uOpacity: { value: opacity },
    },
    vertexShader: SILHOUETTE_VERT,
    fragmentShader: SILHOUETTE_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
    fog: false,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = inflate > 0 ? 2 : 1;
  material.polygonOffsetUnits = inflate > 0 ? 2 : 1;
  return material;
}

function stampSilhouette(mesh: Mesh, renderOrder: number) {
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  mesh.raycast = () => {};
}

function createWallShadows(options: {
  lanyardGeometry: BufferGeometry;
  skeleton: Skeleton;
  card: Group;
  cardBody: Mesh;
  lowPower: boolean;
}): {
  shadows: Mesh[];
  uniforms: ShadowUniforms;
} {
  const uniforms: ShadowUniforms = {
    uWallZ: { value: 0 },
    uLightDir: { value: SHADOW_LIGHT_DIR.clone() },
    uNudge: { value: new Vector2() },
    uFadeStart: { value: BADGE_TUNE_DEFAULTS.fadeStart },
    uFadeEnd: { value: BADGE_TUNE_DEFAULTS.fadeEnd },
  };
  const layers = options.lowPower
    ? [{ inflate: 0.004, opacity: SHADOW_OPACITY, order: -1 }]
    : [
        { inflate: SHADOW_INFLATE, opacity: SHADOW_SOFT_OPACITY, order: -2 },
        { inflate: 0, opacity: SHADOW_OPACITY, order: -1 },
      ];
  const shadows: Mesh[] = [];
  for (const layer of layers) {
    const lanyardMaterial = createSilhouetteMaterial(
      uniforms,
      layer.inflate,
      layer.opacity
    );
    const cardMaterial = createSilhouetteMaterial(
      uniforms,
      layer.inflate,
      layer.opacity
    );
    const lanyard = new SkinnedMesh(options.lanyardGeometry, lanyardMaterial);
    lanyard.bind(options.skeleton);
    stampSilhouette(lanyard, layer.order);
    const cardShadow = new Mesh(options.cardBody.geometry, cardMaterial);
    stampSilhouette(cardShadow, layer.order);
    options.card.add(cardShadow);
    shadows.push(lanyard, cardShadow);
  }
  return { shadows, uniforms };
}

function applyWallShadow(rig: LanyardRig, tune: BadgeTune) {
  WALL_WORLD.set(0, 0, tune.wallZ);
  rig.group.localToWorld(WALL_WORLD);
  rig.shadowUniforms.uWallZ.value = WALL_WORLD.z;
  rig.shadowUniforms.uLightDir.value
    .set(tune.lightX, tune.lightY, tune.lightZ)
    .normalize();

  SHADOW_NUDGE.set(tune.nudgeX, tune.nudgeY, 0);
  rig.group.localToWorld(SHADOW_NUDGE);
  SHADOW_ORIGIN.set(0, 0, 0);
  rig.group.localToWorld(SHADOW_ORIGIN);
  rig.shadowUniforms.uNudge.value.set(
    SHADOW_NUDGE.x - SHADOW_ORIGIN.x,
    SHADOW_NUDGE.y - SHADOW_ORIGIN.y
  );
  rig.shadowUniforms.uFadeStart.value = tune.fadeStart;
  rig.shadowUniforms.uFadeEnd.value = Math.max(tune.fadeEnd, tune.fadeStart + 0.01);

  for (const mesh of rig.shadows) {
    const material = mesh.material as ShaderMaterial;
    const inflate = material.uniforms.uInflate?.value as number | undefined;
    material.uniforms.uOpacity.value =
      inflate && inflate > 0.01 ? tune.shadowSoftOpacity : tune.shadowOpacity;
    if (typeof inflate === "number" && inflate > 0.01) {
      material.uniforms.uInflate.value = tune.inflate;
    }
  }
}

type RopeState = {
  now: Vector3[];
  prev: Vector3[];
  restPoints: Vector3[];
  rest: number;
  pin: Vector3;
  stretch: number;
};

type LanyardRig = {
  group: Group;
  root: Bone;
  bones: Bone[];
  meshes: SkinnedMesh[];
  materials: Record<LanyardPart, MeshStandardMaterial>;
  card: Group;
  shadows: Mesh[];
  shadowUniforms: ShadowUniforms;
  rope: RopeState;
};

function disposeShadows(rig: LanyardRig) {
  const materials = new Set<ShaderMaterial>();
  let lanyardGeometry: BufferGeometry | null = null;
  for (const mesh of rig.shadows) {
    if (mesh.material instanceof ShaderMaterial) materials.add(mesh.material);
    if (mesh instanceof SkinnedMesh) lanyardGeometry = mesh.geometry;
  }
  lanyardGeometry?.dispose();
  for (const material of materials) material.dispose();
}

function buildLanyardRig(
  source: Mesh,
  texture: Texture,
  lowPower: boolean,
  tune: BadgeTune
): LanyardRig {
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
  geometry.computeVertexNormals();
  const parts = splitByPart(geometry);
  const sourceMaterial = source.material as MeshStandardMaterial;
  const materials: Record<LanyardPart, MeshStandardMaterial> = {
    metal: makePartMaterial(sourceMaterial, METAL, 0.48, 0.28, !lowPower, 0.2),
    plastic: makePartMaterial(sourceMaterial, PLASTIC, 0.08, 0.5, !lowPower),
    webbing: makePartMaterial(sourceMaterial, WEBBING, 0.4, 0.32, !lowPower, 0.14),
    cord: makePartMaterial(sourceMaterial, CORD, 0.36, 0.34, !lowPower, 0.12),
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
  const { card, body } = createBadgeCard(texture, hookX, lowPower, tune);
  root.add(card);
  const { shadows, uniforms } = createWallShadows({
    lanyardGeometry: geometry,
    skeleton,
    card,
    cardBody: body,
    lowPower,
  });
  for (const mesh of shadows) {
    if (mesh.parent === null) group.add(mesh);
  }

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
    shadows,
    shadowUniforms: uniforms,
    rope: {
      now,
      prev,
      restPoints,
      rest: segment,
      pin: restPoints[restPoints.length - 1]!.clone(),
      stretch: 1,
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
  pinB: boolean,
  stiffness: number
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dy, dz) || 0.0001;
  const shift = ((dist - rest) / dist) * stiffness;
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

function projectInextensible(rope: RopeState, rest = rope.rest) {
  const last = rope.now.length - 1;
  rope.now[last]!.copy(rope.pin);
  for (let index = last - 1; index >= 0; index -= 1) {
    const point = rope.now[index]!;
    const parent = rope.now[index + 1]!;
    const dx = point.x - parent.x;
    const dy = point.y - parent.y;
    const dz = point.z - parent.z;
    const dist = Math.hypot(dx, dy, dz) || 0.0001;
    const scale = rest / dist;
    point.x = parent.x + dx * scale;
    point.y = parent.y + dy * scale;
    point.z = parent.z + dz * scale;
  }
}

function kickIntroSwing(rope: RopeState) {
  const last = rope.now.length - 1;
  for (let index = 0; index < last; index += 1) {
    const along = 1 - index / last;
    const lag = along * along;
    const point = rope.now[index]!;
    const previous = rope.prev[index]!;
    point.x = INTRO_X * lag;
    point.z = INTRO_Z * lag;
    previous.copy(point);
    previous.x += INTRO_SPIN * lag;
  }
  projectInextensible(rope);
}

function applySway(rope: RopeState, follow: number) {
  const last = rope.now.length - 1;
  const tip = rope.now[0]!;
  for (let index = 1; index < last; index += 1) {
    const along = 1 - index / last;
    const lag = along * along;
    const point = rope.now[index]!;
    point.x += (tip.x * lag - point.x) * follow;
    point.z += (tip.z * lag - point.z) * follow;
  }
}

function updateStretch(rope: RopeState, drag: Vector3 | null, dragLimitDown: number) {
  const last = rope.now.length - 1;
  const total = rope.rest * last;
  const target =
    drag && drag.y < 0
      ? 1 + Math.min(-drag.y, dragLimitDown) / total
      : 1;
  const mix = drag ? 0.28 : STRETCH_RETURN;
  rope.stretch += (target - rope.stretch) * mix;
}

function constrainRope(rope: RopeState, drag: Vector3 | null, stiffness: number) {
  const last = rope.now.length - 1;
  const rest = rope.rest * rope.stretch;
  for (let iter = 0; iter < CONSTRAINT_ITERS; iter += 1) {
    for (let index = 0; index < last; index += 1) {
      solveDistance(
        rope.now[index]!,
        rope.now[index + 1]!,
        rest,
        false,
        index + 1 === last,
        stiffness
      );
    }
    rope.now[last]!.copy(rope.pin);
    if (drag) {
      const tip = rope.now[0]!;
      tip.x += (drag.x - tip.x) * 0.18;
      tip.y += (drag.y - tip.y) * 0.16;
      tip.z += (drag.z - tip.z) * 0.18;
    }
  }
  projectInextensible(rope, rest);
  if (rope.stretch <= 1.01) {
    for (let index = 0; index < last; index += 1) {
      rope.prev[index]!.y = rope.now[index]!.y;
    }
  }
}

function stepRope(
  rope: RopeState,
  drag: Vector3 | null,
  dt: number,
  reducedMotion: boolean,
  tune: BadgeTune
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

  const gravity = tune.gravity * dt * dt;
  for (let index = 0; index < last; index += 1) {
    const point = rope.now[index]!;
    const previous = rope.prev[index]!;
    const damp = index === 0 ? tune.dampingTip : tune.dampingCord;
    const vx = (point.x - previous.x) * damp;
    const vy = (point.y - previous.y) * tune.dampingY;
    const vz = (point.z - previous.z) * damp;
    previous.copy(point);
    point.x += vx;
    point.y += vy + gravity;
    point.z += vz;
  }

  if (drag) {
    const tip = rope.now[0]!;
    tip.x += (drag.x - tip.x) * tune.dragFollow;
    tip.y += (drag.y - tip.y) * tune.dragFollow * 0.7;
    tip.z += (drag.z - tip.z) * tune.dragFollow;
  }

  updateStretch(rope, drag, tune.dragLimitDown);
  constrainRope(rope, drag, tune.constraintStiffness);

  if (!drag) {
    const tip = rope.now[0]!;
    tip.x += -tip.x * tune.restPull;
    tip.z += -tip.z * tune.restPull;
  }
  applySway(rope, tune.swayFollow);
  projectInextensible(rope, rope.rest * rope.stretch);
  rope.now[last]!.copy(rope.pin);
}

function applyRopeToBones(bones: Bone[], rope: RopeState) {
  const points = rope.now;
  bones[0]!.position.copy(points[0]!);
  BONE_LOOK.copy(points[1]!).sub(points[0]!);
  if (BONE_LOOK.lengthSq() < 1e-10) BONE_LOOK.copy(Y_UP);
  else BONE_LOOK.normalize();
  bones[0]!.quaternion.setFromUnitVectors(Y_UP, BONE_LOOK);

  for (let index = 1; index < bones.length; index += 1) {
    bones[index]!.position.set(0, rope.rest, 0);
    const from = points[index]!;
    const to = points[Math.min(index + 1, points.length - 1)]!;
    BONE_LOOK.copy(to).sub(from);
    if (BONE_LOOK.lengthSq() < 1e-10) BONE_LOOK.copy(Y_UP);
    else BONE_LOOK.normalize();
    BONE_WORLD_Q.setFromUnitVectors(Y_UP, BONE_LOOK);
    BONE_PARENT_LOOK.copy(from).sub(points[index - 1]!);
    if (BONE_PARENT_LOOK.lengthSq() < 1e-10) BONE_PARENT_LOOK.copy(Y_UP);
    else BONE_PARENT_LOOK.normalize();
    BONE_PARENT_Q.setFromUnitVectors(Y_UP, BONE_PARENT_LOOK);
    bones[index]!.quaternion.copy(BONE_PARENT_Q).invert().multiply(BONE_WORLD_Q);
  }
}

function applyCardTwist(card: Group, rope: RopeState, reducedMotion: boolean, tune: BadgeTune) {
  if (reducedMotion) {
    card.rotation.set(0, 0, 0);
    return;
  }
  const tip = rope.now[0]!;
  const previous = rope.prev[0]!;
  const velX = tip.x - previous.x;
  const twist = MathUtils.clamp(
    -tip.x * tune.twistPos - velX * tune.twistVel,
    -tune.twistMax,
    tune.twistMax
  );
  const roll = MathUtils.clamp(tip.x * tune.rollPos, -tune.rollMax, tune.rollMax);
  card.rotation.y = MathUtils.lerp(card.rotation.y, twist, tune.twistSmooth);
  card.rotation.z = MathUtils.lerp(card.rotation.z, roll, tune.twistSmooth);
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
  const columnCenterPx = width - 280;
  return (columnCenterPx / width - 0.5) * viewportWidth;
}

function LanyardBadge({
  twizzlerCanvas,
  rainCanvas,
  logoCanvas,
  logoMarkSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
}: BadgeLanyardProps) {
  const { gl, camera, viewport, size, invalidate } = useThree();
  const { scene } = useGLTF(LANYARD_URL);
  const groupRef = useRef<Group>(null);
  const scaleRef = useRef<Group>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(new Vector3());
  const dragTarget = useRef(new Vector3());
  const texture = useHeroShaderTexture(
    twizzlerCanvas,
    rainCanvas,
    identity,
    lowPower,
    shaderLive,
    logoCanvas,
    logoMarkSrc,
    tune
  );

  const rig = useMemo(() => {
    let source: Mesh | null = null;
    scene.traverse((child) => {
      if (!source && (child as Mesh).isMesh) source = child as Mesh;
    });
    if (!source) return null;
    return buildLanyardRig(source, texture, lowPower, tune);
  }, [
    lowPower,
    scene,
    texture,
    tune.cardRadius,
    tune.cardWidth,
    tune.cardHeight,
    tune.cardDepth,
    tune.shaderInset,
  ]);

  useEffect(() => {
    if (!rig) return;
    tintLanyardMetal(rig.materials, identity.accent);
    invalidate();
  }, [identity.accent, invalidate, rig]);

  useEffect(() => {
    invalidate();
  }, [invalidate, tune]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      for (const mesh of rig.meshes) {
        mesh.geometry.dispose();
        (mesh.material as MeshStandardMaterial).dispose();
      }
      rig.card.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        if (rig.shadows.includes(child)) return;
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else {
          material.dispose();
        }
      });
      disposeShadows(rig);
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
        -tune.dragLimitX,
        tune.dragLimitX
      );
      const y = MathUtils.clamp(
        local.y + dragOffset.current.y,
        -tune.dragLimitDown,
        DRAG_LIMIT_UP
      );
      dragTarget.current.set(x, y, -x * tune.inwardZ);
      invalidate();
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      canvas.style.cursor = "grab";
      invalidate();
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
  }, [camera, gl, invalidate, rig, tune.dragLimitDown, tune.dragLimitX, tune.inwardZ]);

  useFrame((state, delta) => {
    if (!rig) return;
    const dt = Math.min(delta, 1 / 30);
    stepRope(
      rig.rope,
      dragging.current ? dragTarget.current : null,
      dt,
      reducedMotion,
      tune
    );
    applyRopeToBones(rig.bones, rig.rope);
    applyCardTwist(rig.card, rig.rope, reducedMotion, tune);
    applyWallShadow(rig, tune);
    const hang = groupRef.current;
    const localY = cardLocalY(tune.cardHeight, tune.cardOverlap);
    rig.card.position.y = localY;
    if (hang) {
      hang.position.x =
        rightColumnWorldX(size.width, viewport.width) + tune.hangX;
      hang.position.y = -localY * tune.modelScale + tune.hangLift;
      hang.position.z = tune.hangZ;
    }
    const scaled = scaleRef.current;
    if (scaled) scaled.scale.setScalar(tune.modelScale);
    rig.card.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (child.name === BADGE_PRINT_MESH_NAME) return;
      if (rig.shadows.includes(child)) return;
      const material = child.material;
      if (Array.isArray(material) || !material) return;
      if ("emissiveIntensity" in material) {
        (material as MeshStandardMaterial).emissiveIntensity = tune.cardEmissive;
      }
      if ("roughness" in material) {
        (material as MeshStandardMaterial).roughness = tune.cardRoughness;
      }
      if ("clearcoat" in material) {
        (material as MeshPhysicalMaterial).clearcoat = tune.cardClearcoat;
      }
    });
    if (
      dragging.current ||
      shaderLive ||
      Boolean(logoMarkSrc) ||
      !ropeIsAsleep(rig.rope)
    ) {
      state.invalidate();
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
        dragTarget.current.set(tip.x, tip.y, -tip.x * tune.inwardZ);
        gl.domElement.style.cursor = "grabbing";
        gl.domElement.setPointerCapture(event.pointerId);
        invalidate();
      }}
      position={[
        0,
        -cardLocalY(tune.cardHeight, tune.cardOverlap) * tune.modelScale +
          tune.hangLift,
        tune.hangZ,
      ]}
      ref={groupRef}
    >
      <group ref={scaleRef} scale={tune.modelScale}>
        <primitive object={rig.group} />
      </group>
    </group>
  );
}

function BadgeScene({
  twizzlerCanvas,
  rainCanvas,
  logoCanvas,
  logoMarkSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
}: BadgeLanyardProps) {
  const { camera } = useThree();
  useFrame(() => {
    if (!(camera instanceof ThreePerspectiveCamera)) return;
    camera.fov = tune.cameraFov;
    camera.position.set(tune.cameraX, tune.cameraY, tune.cameraZ);
    camera.updateProjectionMatrix();
  });
  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={tune.cameraFov}
        position={[tune.cameraX, tune.cameraY, tune.cameraZ]}
      />
      <ambientLight intensity={lowPower ? Math.min(tune.ambient + 0.2, 1.2) : tune.ambient} />
      {lowPower ? (
        <directionalLight intensity={tune.keyLight * 0.85} position={[5, 7, 8]} />
      ) : (
        <>
          <hemisphereLight args={["#fff1e4", "#1a1a1a", tune.hemi]} />
          <directionalLight intensity={tune.keyLight} position={[5, 7, 8]} />
          <directionalLight intensity={tune.fillLight} position={[-6, 3, 5]} />
          <directionalLight
            color={identity.accent}
            intensity={tune.rimLight}
            position={[2, -1, 6]}
          />
        </>
      )}
      <LanyardBadge
        identity={identity}
        logoCanvas={logoCanvas}
        logoMarkSrc={logoMarkSrc}
        lowPower={lowPower}
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        shaderLive={shaderLive}
        tune={tune}
        twizzlerCanvas={twizzlerCanvas}
      />
    </>
  );
}

useGLTF.preload(LANYARD_URL);

export default function BadgeLanyard({
  twizzlerCanvas,
  rainCanvas,
  logoCanvas,
  logoMarkSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
}: BadgeLanyardProps) {
  return (
    <Canvas
      camera={{
        fov: tune.cameraFov,
        position: [tune.cameraX, tune.cameraY, tune.cameraZ],
      }}
      dpr={lowPower ? 1 : [1, 1.5]}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: !lowPower,
        depth: true,
        powerPreference: lowPower ? "low-power" : "high-performance",
        stencil: false,
      }}
      performance={
        lowPower
          ? { min: 0.4, max: 0.7, debounce: 200 }
          : { min: 0.5, max: 1, debounce: 200 }
      }
      style={{ height: "100%", touchAction: "none", width: "100%" }}
    >
      <BadgeScene
        identity={identity}
        logoCanvas={logoCanvas}
        logoMarkSrc={logoMarkSrc}
        lowPower={lowPower}
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        shaderLive={shaderLive}
        tune={tune}
        twizzlerCanvas={twizzlerCanvas}
      />
    </Canvas>
  );
}
