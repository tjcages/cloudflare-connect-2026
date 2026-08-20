"use no memo";

import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { BufferGeometry, Camera, Texture } from "three";
import {
  AdditiveBlending,
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
  BADGE_COAT_MESH_NAME,
  BADGE_PRINT_MESH_NAME,
  createPrintFaceGeometry,
  roundedRect,
} from "./badge-card-geometry";
import { drawIdentity, type BadgeCardIdentity } from "./badge-identity";
import {
  INTRO_DELAY_MS,
  INTRO_FADE_MS,
  applyIntroPose,
  cardBottomDragOffsetY,
} from "./badge-intro";
import {
  BADGE_ACCENT_LIGHTS,
  BADGE_DPR_MAX,
  BADGE_PRINT_CLEARCOAT,
  BADGE_PRINT_CLEARCOAT_ROUGHNESS,
  BADGE_PRINT_ENV,
  BADGE_PRINT_IOR,
  BADGE_PRINT_ROUGHNESS,
  BADGE_PRINT_SPECULAR,
  applyBadgeLook,
  badgeAnisotropy,
} from "./badge-look";
import { svgRasterSize } from "./badge-logo";
import {
  badgePrintFieldRect,
  fadePrintField,
  type BadgePrintFieldRect,
} from "./badge-print-layout";
import {
  BADGE_CHAIN_BONES,
  DRAG_LIMIT_UP,
  type RopeState,
  ropeIsAsleep,
  stepRope,
} from "./badge-rope";
import { BADGE_SHARE_WIDTH } from "./badge-share";
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
const CHAIN_BONES = BADGE_CHAIN_BONES;
const CARD_FRONT_Z = 0.006;

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

export type { BadgeCardIdentity };

type BadgeLanyardProps = {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  logoCanvas: RefObject<HTMLCanvasElement | null>;
  faceCanvasRef?: RefObject<HTMLCanvasElement | null>;
  logoMarkSrc: string | null;
  printSrc: string;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
  lowPower: boolean;
  shaderLive: boolean;
  tune: BadgeTune;
  onIntroReady?: () => void;
};

type LanyardPart = "metal" | "plastic" | "webbing" | "cord";

function cardLocalY(height: number, overlap: number) {
  return -(height / 2) + overlap;
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  zoom = 1,
  panX = 0,
  panY = 0,
  fit: "cover" | "contain" = "cover"
) {
  const sourceW = source.width;
  const sourceH = source.height;
  if (sourceW < 2 || sourceH < 2) return;
  const z = Math.max(zoom, 0.05);
  const destAspect = destW / destH;
  const sourceAspect = sourceW / sourceH;

  switch (fit) {
    case "contain": {
      let dw = destW;
      let dh = destH;
      if (sourceAspect > destAspect) dh = destW / sourceAspect;
      else dw = destH * sourceAspect;
      dw *= z;
      dh *= z;
      const dx = destX + (destW - dw) / 2 + panX * destW;
      const dy = destY + (destH - dh) / 2 + panY * destH;
      ctx.drawImage(source, 0, 0, sourceW, sourceH, dx, dy, dw, dh);
      return;
    }
    case "cover": {
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
      const cx = sx + sw / 2 + panX * sourceW;
      const cy = sy + sh / 2 + panY * sourceH;
      sw /= z;
      sh /= z;
      ctx.drawImage(
        source,
        cx - sw / 2,
        cy - sh / 2,
        sw,
        sh,
        destX,
        destY,
        destW,
        destH
      );
      return;
    }
    default: {
      const _never: never = fit;
      return _never;
    }
  }
}

function identityKey(
  identity: BadgeCardIdentity,
  logoMarkSrc: string | null,
  printSrc: string,
  printKey: string
) {
  return `${identity.name}|${identity.company}|${identity.role}|${identity.serial}|${identity.accent}|${logoMarkSrc ?? ""}|${printSrc}|${printKey}`;
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
  const raster = svgRasterSize({
    w: Math.max(size.w, 1),
    h: Math.max(size.h, 1),
  });
  const canvas = document.createElement("canvas");
  canvas.width = raster.w;
  canvas.height = raster.h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

function whiteLogoHalo(
  mark: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number
) {
  const blur = Math.max(10, Math.round(Math.min(width, height) * 0.2));
  const pad = blur * 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width) + pad * 2);
  canvas.height = Math.max(1, Math.ceil(height) + pad * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(mark, pad, pad, width, height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, pad, blur };
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
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const halo = whiteLogoHalo(mark, fit.w, fit.h);
  if (halo) {
    ctx.save();
    ctx.filter = `blur(${halo.blur}px)`;
    ctx.globalAlpha = 0.8 * tune.logoMarkOpacity;
    ctx.drawImage(halo.canvas, dx - halo.pad, dy - halo.pad);
    ctx.restore();
  }
  ctx.globalAlpha = tune.logoMarkOpacity;
  ctx.drawImage(mark, dx, dy, fit.w, fit.h);
  ctx.restore();
}

function useHeroShaderTexture(
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>,
  rainCanvas: RefObject<HTMLCanvasElement | null>,
  identity: BadgeCardIdentity,
  lowPower: boolean,
  shaderLive: boolean,
  logoCanvas: RefObject<HTMLCanvasElement | null>,
  logoMarkSrc: string | null,
  printSrc: string,
  tune: BadgeTune,
  faceCanvasRef?: RefObject<HTMLCanvasElement | null>,
  onReady?: () => void
) {
  const { invalidate, gl } = useThree();
  const skip = useRef(0);
  const lastKey = useRef("");
  const bakedWhileFrozen = useRef(false);
  const markImage = useRef<HTMLCanvasElement | null>(null);
  const markGeneration = useRef(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const baked = useRef(false);
  const markPending = useRef(logoMarkSrc != null);
  const readyNotified = useRef(false);
  const notifyReady = () => {
    if (readyNotified.current || !baked.current || markPending.current) return;
    readyNotified.current = true;
    onReadyRef.current?.();
  };
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = lowPower ? TEXTURE_W_LOW : TEXTURE_W;
    canvas.height = lowPower ? TEXTURE_H_LOW : TEXTURE_H;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = badgeAnisotropy(gl, lowPower);
    map.needsUpdate = true;
    return map;
  }, [gl, lowPower]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useEffect(() => {
    if (!faceCanvasRef) return;
    faceCanvasRef.current = texture.image as HTMLCanvasElement;
    return () => {
      if (faceCanvasRef.current === texture.image) {
        faceCanvasRef.current = null;
      }
    };
  }, [faceCanvasRef, texture]);

  useEffect(() => {
    if (shaderLive) bakedWhileFrozen.current = false;
  }, [shaderLive]);

  useEffect(() => {
    markImage.current = null;
    markGeneration.current += 1;
    markPending.current = logoMarkSrc != null;
    const generation = markGeneration.current;
    if (!logoMarkSrc) {
      notifyReady();
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (generation !== markGeneration.current) return;
      markImage.current = rasterizeMark(image);
      markGeneration.current += 1;
      bakedWhileFrozen.current = false;
      markPending.current = false;
      notifyReady();
      invalidate();
    };
    image.onerror = () => {
      if (generation !== markGeneration.current) return;
      markGeneration.current += 1;
      bakedWhileFrozen.current = false;
      markPending.current = false;
      notifyReady();
      invalidate();
    };
    image.src = logoMarkSrc;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [invalidate, logoMarkSrc]);

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
      tune.sourceZoom,
      tune.sourcePanX,
      tune.sourcePanY,
      tune.sourceLight,
      tune.twizzlerOpacity,
      tune.twizzlerScale,
      tune.twizzlerCenterY,
      tune.twizzlerPanX,
      tune.twizzlerPanY,
      tune.twizzlerPanZ,
      tune.twizzlerAmplitude,
      tune.twizzlerTwist,
      tune.twizzlerRotateX,
      tune.twizzlerRotateY,
      tune.twizzlerRotateZ,
      tune.twizzlerFov,
      tune.twizzlerCamDist,
      tune.twizzlerLineWidth,
      tune.twizzlerPerspectiveWidth,
      tune.twizzlerMinLineWidth,
      tune.twizzlerMaxLineWidth,
      tune.twizzlerLineCount,
      tune.twizzlerPointSpacing,
      tune.twizzlerSpeed,
      tune.logoBand,
      tune.logoPadX,
      tune.logoPadY,
      tune.logoScale,
      tune.logoPrintZoom,
      tune.logoMarkOpacity,
      tune.footerBand,
    ].join("|");
    const key = `${identityKey(identity, logoMarkSrc, printSrc, printKey)}|${markGeneration.current}`;
    const identityChanged = key !== lastKey.current;
    skip.current += 1;
    if (!shaderLive && !identityChanged && bakedWhileFrozen.current) {
      return;
    }
    if (
      shaderLive &&
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
      drawFitted(
        ctx,
        twizzler,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom,
        tune.printPanX,
        tune.printPanY,
        "cover"
      );
    }
    if (tune.printRain && rain) {
      drawFitted(
        ctx,
        rain,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom,
        tune.printPanX,
        tune.printPanY,
        "cover"
      );
    }
    if (logoShader) {
      drawFitted(
        ctx,
        logoShader,
        field.x,
        field.y,
        field.w,
        field.h,
        tune.printZoom * tune.logoPrintZoom,
        tune.printPanX,
        tune.printPanY,
        "contain"
      );
    }
    fadePrintField(ctx, field, tune.printFeather);
    drawCenteredLogo(ctx, markImage.current, field, canvas.height, tune);
    drawIdentity(ctx, identity, canvas.width, canvas.height, tune.footerBand);
    texture.needsUpdate = true;
    lastKey.current = key;
    baked.current = true;
    notifyReady();
    if (!shaderLive) bakedWhileFrozen.current = true;
  });

  return texture;
}

function filterTriangles(
  geometry: BufferGeometry,
  keep: (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number
  ) => boolean
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

function splitByPart(
  geometry: BufferGeometry
): Record<LanyardPart, BufferGeometry> {
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
    const y =
      (vertex.y +
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
    const along = MathUtils.clamp(
      (vertex.y / usable) * CHAIN_BONES,
      0,
      CHAIN_BONES
    );
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
  material.envMapIntensity = 0.85;
  material.toneMapped = true;
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
          clearcoatRoughness: 0.08,
          envMapIntensity: 0.85,
          ior: 1.4,
          toneMapped: true,
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
  if (!lowPower) {
    const coat = new Mesh(
      createPrintFaceGeometry(faceWidth, faceHeight, faceRadius),
      new MeshPhysicalMaterial({
        color: "#000000",
        roughness: BADGE_PRINT_ROUGHNESS,
        metalness: 0,
        clearcoat: BADGE_PRINT_CLEARCOAT,
        clearcoatRoughness: BADGE_PRINT_CLEARCOAT_ROUGHNESS,
        envMapIntensity: BADGE_PRINT_ENV,
        ior: BADGE_PRINT_IOR,
        specularIntensity: BADGE_PRINT_SPECULAR,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: true,
      })
    );
    coat.name = BADGE_COAT_MESH_NAME;
    coat.renderOrder = 2;
    coat.position.z = tune.cardDepth / 2 + 0.0012;
    card.add(coat);
  }
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
  rig.shadowUniforms.uFadeEnd.value = Math.max(
    tune.fadeEnd,
    tune.fadeStart + 0.01
  );

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
    metal: makePartMaterial(sourceMaterial, METAL, 0.72, 0.22, !lowPower, 0.12),
    plastic: makePartMaterial(sourceMaterial, PLASTIC, 0.08, 0.5, !lowPower),
    webbing: makePartMaterial(
      sourceMaterial,
      WEBBING,
      0.4,
      0.32,
      !lowPower,
      0.14
    ),
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
    bones[index]!.quaternion.copy(BONE_PARENT_Q)
      .invert()
      .multiply(BONE_WORLD_Q);
  }
}

function applyCardTwist(
  card: Group,
  rope: RopeState,
  reducedMotion: boolean,
  tune: BadgeTune
) {
  if (reducedMotion) {
    card.rotation.set(tune.cardPitch, 0, 0);
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
  const roll = MathUtils.clamp(
    tip.x * tune.rollPos,
    -tune.rollMax,
    tune.rollMax
  );
  card.rotation.x = tune.cardPitch;
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

function hangWorldX(
  width: number,
  viewportWidth: number,
  hangX: number,
  capturing: boolean
) {
  if (!capturing && width < 992) return 0;
  const layoutWidth = capturing ? Math.max(width, BADGE_SHARE_WIDTH) : width;
  return rightColumnWorldX(layoutWidth, viewportWidth) + hangX;
}

function LanyardBadge({
  twizzlerCanvas,
  rainCanvas,
  logoCanvas,
  faceCanvasRef,
  logoMarkSrc,
  printSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
  onIntroReady,
}: BadgeLanyardProps) {
  const { gl, camera, viewport, size, invalidate } = useThree();
  const { scene } = useGLTF(LANYARD_URL);
  const groupRef = useRef<Group>(null);
  const scaleRef = useRef<Group>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(new Vector3());
  const dragTarget = useRef(new Vector3());
  const introKicked = useRef(false);
  const introReleased = useRef(reducedMotion);
  const [printReady, setPrintReady] = useState(false);
  const [introVisible, setIntroVisible] = useState(reducedMotion);
  const texture = useHeroShaderTexture(
    twizzlerCanvas,
    rainCanvas,
    identity,
    lowPower,
    shaderLive,
    logoCanvas,
    logoMarkSrc,
    printSrc,
    tune,
    faceCanvasRef,
    () => setPrintReady(true)
  );

  useEffect(() => {
    const id = window.setTimeout(() => setPrintReady(true), 4000);
    return () => window.clearTimeout(id);
  }, []);

  const applyHang = useCallback(() => {
    const hang = groupRef.current;
    if (!hang) return;
    const capturing = Boolean(gl.domElement.closest("[data-share-capturing]"));
    const localY = cardLocalY(tune.cardHeight, tune.cardOverlap);
    hang.position.x = hangWorldX(
      size.width,
      viewport.width,
      tune.hangX,
      capturing
    );
    hang.position.y = -localY * tune.modelScale + tune.hangLift;
    hang.position.z = tune.hangZ;
  }, [
    gl.domElement,
    size.width,
    tune.cardHeight,
    tune.cardOverlap,
    tune.hangLift,
    tune.hangX,
    tune.hangZ,
    tune.modelScale,
    viewport.width,
  ]);

  useLayoutEffect(() => {
    applyHang();
    invalidate();
    const sceneEl = gl.domElement.closest("[data-share-scene]");
    if (!sceneEl) return;
    const observer = new MutationObserver(() => {
      applyHang();
      invalidate();
    });
    observer.observe(sceneEl, {
      attributes: true,
      attributeFilter: ["data-share-capturing"],
    });
    return () => observer.disconnect();
  }, [applyHang, gl.domElement, invalidate]);

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
    if (reducedMotion) {
      setIntroVisible(true);
      introReleased.current = true;
      onIntroReady?.();
      invalidate();
      return;
    }
    if (!rig || !printReady || introKicked.current) return;
    let cancelled = false;
    const startIntro = async () => {
      try {
        if (document.fonts?.status !== "loaded") await document.fonts.ready;
      } catch {
        // Fallback fonts still let the print bake.
      }
      try {
        gl.compile(rig.group, camera);
      } catch {
        // First visible frame still uploads programs.
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
      await new Promise((resolve) => {
        window.setTimeout(resolve, INTRO_DELAY_MS);
      });
      if (cancelled || introKicked.current) return;
      applyIntroPose(rig.rope, rig.card);
      introKicked.current = true;
      setIntroVisible(true);
      invalidate();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          introReleased.current = true;
          onIntroReady?.();
          invalidate();
        });
      });
    };
    void startIntro();
    return () => {
      cancelled = true;
    };
  }, [camera, gl, invalidate, onIntroReady, printReady, reducedMotion, rig]);

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
  }, [
    camera,
    gl,
    invalidate,
    rig,
    tune.dragLimitDown,
    tune.dragLimitX,
    tune.inwardZ,
  ]);

  useFrame((state, delta) => {
    if (!rig) return;
    const dt = Math.min(delta, 1 / 30);
    const swinging = dragging.current || introReleased.current;
    if (swinging) {
      stepRope(
        rig.rope,
        dragging.current ? dragTarget.current : null,
        dt,
        reducedMotion,
        tune
      );
      applyCardTwist(rig.card, rig.rope, reducedMotion, tune);
    } else {
      rig.card.rotation.x = tune.cardPitch;
    }
    applyRopeToBones(rig.bones, rig.rope);
    applyWallShadow(rig, tune);
    const hang = groupRef.current;
    const localY = cardLocalY(tune.cardHeight, tune.cardOverlap);
    rig.card.position.y = localY;
    rig.card.position.z = CARD_FRONT_Z;
    if (hang) {
      hang.position.x = hangWorldX(
        size.width,
        viewport.width,
        tune.hangX,
        Boolean(gl.domElement.closest("[data-share-capturing]"))
      );
      hang.position.y = -localY * tune.modelScale + tune.hangLift;
      hang.position.z = tune.hangZ;
    }
    const scaled = scaleRef.current;
    if (scaled) scaled.scale.setScalar(tune.modelScale);
    rig.card.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      if (child.name === BADGE_PRINT_MESH_NAME) return;
      if (child.name === BADGE_COAT_MESH_NAME) return;
      if (rig.shadows.includes(child)) return;
      const material = child.material;
      if (Array.isArray(material) || !material) return;
      if ("emissiveIntensity" in material) {
        (material as MeshStandardMaterial).emissiveIntensity =
          tune.cardEmissive;
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
      (introReleased.current &&
        ((shaderLive && !reducedMotion) || !ropeIsAsleep(rig.rope)))
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
        const tip = rig.rope.now[0]!;
        dragOffset.current.set(
          tip.x - local.x,
          cardBottomDragOffsetY(tip.y, tune.cardHeight, tune.cardOverlap),
          0
        );
        dragTarget.current.set(tip.x, Math.min(tip.y, 0), -tip.x * tune.inwardZ);
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
      visible={introVisible}
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
  faceCanvasRef,
  logoMarkSrc,
  printSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
  onIntroReady,
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
      <ambientLight
        intensity={lowPower ? Math.min(tune.ambient + 0.2, 1.2) : tune.ambient}
      />
      {lowPower ? (
        <>
          <directionalLight
            intensity={tune.keyLight * 0.85}
            position={[5, 7, 8]}
          />
          <directionalLight
            color={identity.accent}
            intensity={tune.rimLight * 0.7}
            position={[4, 4, 6]}
          />
        </>
      ) : (
        <>
          <hemisphereLight args={["#fff4e8", "#d4cbc2", tune.hemi]} />
          <directionalLight
            color="#fff7ee"
            intensity={tune.keyLight}
            position={[5, 7, 8]}
          />
          <directionalLight
            color="#e8eef6"
            intensity={tune.fillLight}
            position={[-6, 3, 5]}
          />
          {BADGE_ACCENT_LIGHTS.map((light) => (
            <directionalLight
              color={identity.accent}
              intensity={tune.rimLight * light.scale}
              key={light.position.join(":")}
              position={[...light.position]}
            />
          ))}
        </>
      )}
      <LanyardBadge
        faceCanvasRef={faceCanvasRef}
        identity={identity}
        logoCanvas={logoCanvas}
        logoMarkSrc={logoMarkSrc}
        printSrc={printSrc}
        lowPower={lowPower}
        onIntroReady={onIntroReady}
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
  faceCanvasRef,
  logoMarkSrc,
  printSrc,
  reducedMotion,
  identity,
  lowPower,
  shaderLive,
  tune,
}: BadgeLanyardProps) {
  const [introReady, setIntroReady] = useState(reducedMotion);
  const onIntroReady = useCallback(() => setIntroReady(true), []);
  return (
    <div
      className="h-full w-full"
      style={{
        opacity: introReady ? 1 : 0,
        transition: reducedMotion ? "none" : `opacity ${INTRO_FADE_MS}ms ease`,
      }}
    >
      <Canvas
        camera={{
          fov: tune.cameraFov,
          position: [tune.cameraX, tune.cameraY, tune.cameraZ],
        }}
        dpr={lowPower ? 1 : [1, BADGE_DPR_MAX]}
        frameloop="demand"
        gl={{
          alpha: true,
          antialias: !lowPower,
          depth: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true,
          powerPreference: lowPower ? "low-power" : "high-performance",
          stencil: false,
        }}
        onCreated={({ gl, scene }) => {
          gl.setClearColor(0x000000, 0);
          gl.domElement.dataset.shareStamp = "";
          applyBadgeLook(gl, scene, lowPower);
        }}
        performance={
          lowPower
            ? { min: 0.4, max: 0.7, debounce: 200 }
            : { min: 0.75, max: 1, debounce: 200 }
        }
        style={{ height: "100%", touchAction: "none", width: "100%" }}
      >
        <BadgeScene
          faceCanvasRef={faceCanvasRef}
          identity={identity}
          logoCanvas={logoCanvas}
          logoMarkSrc={logoMarkSrc}
          printSrc={printSrc}
          lowPower={lowPower}
          onIntroReady={onIntroReady}
          rainCanvas={rainCanvas}
          reducedMotion={reducedMotion}
          shaderLive={shaderLive}
          tune={tune}
          twizzlerCanvas={twizzlerCanvas}
        />
      </Canvas>
    </div>
  );
}
