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
const MODEL_SCALE = 17;
const TEXTURE_W = 1024;
const TEXTURE_H = 1536;
const TAG_CUT_Y = 0.105;
const CLIP_CLUSTER_Y0 = 0.118;
const CLIP_CLUSTER_Y1 = 0.135;
const WING_CUT_X = 0.02;
const CHAIN_BONES = 8;
const GRAVITY = -6.4;
const DAMPING = 0.978;
const CONSTRAINT_ITERS = 14;
const DRAG_LIMIT_X = 0.11;
const DRAG_LIMIT_UP = 0.05;
const DRAG_LIMIT_DOWN = 0.09;

const CARD_W = 0.1;
const CARD_H = 0.158;
const CARD_D = 0.012;
const CARD_RADIUS = 0.007;
const SHADER_INSET = 0.003;
const CARD_OVERLAP = 0.006;

const METAL = "#c5cad1";
const PLASTIC = "#2b2b2b";
const CORD = "#f46021";
const WEBBING = "#d4521a";

const Y_UP = new Vector3(0, 1, 0);

export type BadgeCardIdentity = {
  name: string;
  company: string;
  role: string;
  serial: string;
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
  ctx.fillStyle = "#f46021";
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
  if (y < 0.028) return "metal";
  if (y < 0.068) return "plastic";
  if (y < 0.09) return "webbing";
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
  roughness: number
) {
  const material = source.clone();
  material.map = null;
  material.aoMap = null;
  material.metalnessMap = null;
  material.roughnessMap = null;
  material.color = new Color(color);
  material.metalness = metalness;
  material.roughness = roughness;
  material.side = DoubleSide;
  material.vertexColors = false;
  return material;
}

function createBadgeCard(texture: Texture): Group {
  const card = new Group();
  card.position.set(0, -(CARD_H / 2) + CARD_OVERLAP, 0);

  const bodyGeometry = new ExtrudeGeometry(roundedRect(CARD_W, CARD_H, CARD_RADIUS), {
    depth: CARD_D,
    bevelEnabled: false,
    steps: 1,
  });
  bodyGeometry.translate(0, 0, -CARD_D / 2);
  const body = new Mesh(
    bodyGeometry,
    new MeshStandardMaterial({
      color: "#f4f1ea",
      metalness: 0.04,
      roughness: 0.32,
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

type RopeState = {
  now: Vector3[];
  prev: Vector3[];
  rest: number;
  pin: Vector3;
};

type LanyardRig = {
  group: Group;
  root: Bone;
  bones: Bone[];
  meshes: SkinnedMesh[];
  card: Group;
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
  const cordLength = Math.max(length - anchor.y, 0.08);

  skinAlongY(geometry, cordLength);
  const parts = splitByPart(geometry);
  const sourceMaterial = source.material as MeshStandardMaterial;
  const materials: Record<LanyardPart, MeshStandardMaterial> = {
    metal: makePartMaterial(sourceMaterial, METAL, 0.82, 0.28),
    plastic: makePartMaterial(sourceMaterial, PLASTIC, 0.08, 0.48),
    webbing: makePartMaterial(sourceMaterial, WEBBING, 0.04, 0.62),
    cord: makePartMaterial(sourceMaterial, CORD, 0.03, 0.72),
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

  const card = createBadgeCard(texture);
  root.add(card);

  const now: Vector3[] = [];
  const prev: Vector3[] = [];
  for (let index = 0; index <= CHAIN_BONES; index += 1) {
    const point = new Vector3(0, index * segment, 0);
    now.push(point);
    prev.push(point.clone());
  }

  return {
    group,
    root,
    bones,
    meshes,
    card,
    rope: {
      now,
      prev,
      rest: segment,
      pin: new Vector3(0, cordLength, 0),
    },
  };
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
  const dist = Math.hypot(dx, dy) || 0.0001;
  const shift = ((dist - rest) / dist) * 0.5;
  const px = dx * shift;
  const py = dy * shift;
  if (!pinA) {
    a.x += pinB ? px * 2 : px;
    a.y += pinB ? py * 2 : py;
  }
  if (!pinB) {
    b.x -= pinA ? px * 2 : px;
    b.y -= pinA ? py * 2 : py;
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
    for (let index = 0; index <= last; index += 1) {
      rope.now[index]!.set(0, index * rope.rest, 0);
      rope.prev[index]!.copy(rope.now[index]!);
    }
    return;
  }

  const gravity = GRAVITY * dt * dt;
  for (let index = 0; index < last; index += 1) {
    const point = rope.now[index]!;
    const previous = rope.prev[index]!;
    const vx = (point.x - previous.x) * DAMPING;
    const vy = (point.y - previous.y) * DAMPING;
    previous.copy(point);
    point.x += vx;
    point.y += vy + gravity;
    point.z = 0;
  }
  rope.now[last]!.copy(rope.pin);
  rope.prev[last]!.copy(rope.pin);
  if (drag) {
    rope.now[0]!.copy(drag);
    rope.prev[0]!.copy(drag);
  }

  for (let iter = 0; iter < CONSTRAINT_ITERS; iter += 1) {
    for (let index = 0; index < last; index += 1) {
      solveDistance(
        rope.now[index]!,
        rope.now[index + 1]!,
        rope.rest,
        Boolean(drag) && index === 0,
        index + 1 === last
      );
      rope.now[index]!.z = 0;
      rope.now[index + 1]!.z = 0;
    }
    rope.now[last]!.copy(rope.pin);
    if (drag) rope.now[0]!.copy(drag);
  }
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
      dragTarget.current.set(
        MathUtils.clamp(local.x + dragOffset.current.x, -DRAG_LIMIT_X, DRAG_LIMIT_X),
        MathUtils.clamp(
          local.y + dragOffset.current.y,
          -DRAG_LIMIT_DOWN,
          DRAG_LIMIT_UP
        ),
        0
      );
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
    const hang = groupRef.current;
    if (hang) {
      hang.position.x = rightColumnWorldX(size.width, viewport.width);
      hang.position.y = 0.45;
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
        dragTarget.current.copy(rig.rope.now[0]!);
        gl.domElement.style.cursor = "grabbing";
        gl.domElement.setPointerCapture(event.pointerId);
      }}
      position={[0, 0.45, 0]}
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
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#fff7ee", "#1a1a1a", 0.55]} />
      <directionalLight intensity={1.55} position={[5, 7, 8]} />
      <directionalLight intensity={0.55} position={[-6, 3, 5]} />
      <directionalLight color="#dfe4ea" intensity={0.4} position={[2, -1, 6]} />
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
