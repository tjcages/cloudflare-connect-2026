"use no memo";

import { PerspectiveCamera, RoundedBox, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type {
  BufferGeometry,
  Camera,
  Group,
  Mesh,
  MeshStandardMaterial,
  Texture,
} from "three";
import {
  Bone,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  MathUtils,
  Shape,
  ShapeGeometry,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { WiggleBone } from "wiggle";

const LANYARD_ORANGE = "#f46021";
const LANYARD_URL = "/connect/badge-lanyard.glb";
const LANYARD_BONES = 8;
const MODEL_SCALE = 20;
const TEXTURE_W = 1024;
const TEXTURE_H = 1536;
/** Clip / buckle stay rigid on the root bone. */
const STRING_START_Y = 0.12;
/** Cut the landscape ID holder off below the clip. */
const TAG_CUT_Y = 0.105;
const DRAG_LIMIT_X = 0.085;
const DRAG_LIMIT_UP = 0.06;
const DRAG_LIMIT_DOWN = 0.05;
const WIGGLE_VELOCITY = 0.11;

const CARD_W = 0.092;
const CARD_H = 0.148;
const CARD_D = 0.01;
const CLIP_Y = 0.11;
const CARD_Y = CLIP_Y - CARD_H / 2 - 0.004;
const SHADER_INSET = 0.0035;
const CARD_RADIUS = 0.007;

export type BadgeCardIdentity = {
  name: string;
  company: string;
  role: string;
  serial: string;
};

function createRoundedPlane(width: number, height: number, radius: number) {
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
  const geometry = new ShapeGeometry(shape);
  geometry.computeBoundingBox();
  return geometry;
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
  const footer = Math.round(height * 0.16);
  const top = height - footer;
  const fade = ctx.createLinearGradient(0, top - footer * 0.35, 0, top);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(1, "rgba(255,255,255,0.94)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, top - footer * 0.35, width, footer * 0.35);
  ctx.fillStyle = "#ffffff";
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
    const artH = Math.round(canvas.height * 0.84);
    if (twizzler) drawCover(ctx, twizzler, 0, 0, canvas.width, artH);
    if (rain) drawCover(ctx, rain, 0, 0, canvas.width, artH);
    drawIdentity(ctx, identity, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  return texture;
}

function stripTagBody(geometry: BufferGeometry) {
  const position = geometry.attributes.position;
  const index = geometry.getIndex();
  if (!position || !index) return;
  const next: number[] = [];
  const vertex = new Vector3();
  const inTag = (vertIndex: number) => {
    vertex.fromBufferAttribute(position, vertIndex);
    return vertex.y < TAG_CUT_Y;
  };
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    if (inTag(a) && inTag(b) && inTag(c)) continue;
    next.push(a, b, c);
  }
  geometry.setIndex(next);
}

type LanyardRig = {
  skinned: SkinnedMesh;
  root: Bone;
  bones: Bone[];
};

/**
 * The uploaded GLB is a paper-thin scan with no skeleton. Stand the strap
 * up along +Y facing the camera, cut off the landscape holder, then skin a
 * bone chain along the remaining clip + cord. WiggleBones wrap every child
 * bone; the badge card is parented to the rigid root so only the string lags
 * when that root is pulled.
 */
function buildLanyardRig(source: Mesh): LanyardRig {
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
  stripTagBody(geometry);

  const segment = length / LANYARD_BONES;
  const bones: Bone[] = [];
  for (let index = 0; index <= LANYARD_BONES; index += 1) {
    const bone = new Bone();
    bone.position.y = index === 0 ? 0 : segment;
    const parent = bones[index - 1];
    if (parent) parent.add(bone);
    bones.push(bone);
  }

  const position = geometry.attributes.position;
  if (!position) throw new Error("Lanyard mesh has no positions.");
  const vertex = new Vector3();
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  const stringLength = Math.max(length - STRING_START_Y, 0.001);
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const along =
      vertex.y < STRING_START_Y
        ? 0
        : MathUtils.clamp(
            ((vertex.y - STRING_START_Y) / stringLength) * LANYARD_BONES,
            0,
            LANYARD_BONES
          );
    const lower = Math.min(Math.floor(along), LANYARD_BONES - 1);
    const blend = along - lower;
    skinIndices.push(lower, lower + 1, 0, 0);
    skinWeights.push(1 - blend, blend, 0, 0);
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute(
    "skinWeight",
    new Float32BufferAttribute(skinWeights, 4)
  );

  const material = (source.material as MeshStandardMaterial).clone();
  material.map = null;
  material.aoMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.normalMap = null;
  material.color = new Color(LANYARD_ORANGE);
  material.roughness = 0.4;
  material.metalness = 0.08;
  material.side = DoubleSide;

  const skinned = new SkinnedMesh(geometry, material);
  const root = bones[0]!;
  skinned.add(root);
  skinned.bind(new Skeleton(bones));

  return { skinned, root, bones };
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
  const { gl, camera } = useThree();
  const { scene } = useGLTF(LANYARD_URL);
  const groupRef = useRef<Group>(null);
  const cardRef = useRef<Group>(null);
  const dragging = useRef(false);
  const dragOffset = useRef(new Vector3());
  const dragTarget = useRef(new Vector3());
  const wiggleBones = useRef<WiggleBone[]>([]);
  const texture = useHeroShaderTexture(twizzlerCanvas, rainCanvas, identity);

  const rig = useMemo(() => {
    let source: Mesh | null = null;
    scene.traverse((child) => {
      if (!source && (child as Mesh).isMesh) source = child as Mesh;
    });
    if (!source) return null;
    return buildLanyardRig(source);
  }, [scene]);

  const stickerGeometry = useMemo(
    () =>
      createRoundedPlane(
        CARD_W - SHADER_INSET * 2,
        CARD_H - SHADER_INSET * 2,
        CARD_RADIUS - 0.001
      ),
    []
  );

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!rig || !card) return;
    rig.root.add(card);
    wiggleBones.current = rig.bones
      .slice(1)
      .map((bone) => new WiggleBone(bone, { velocity: WIGGLE_VELOCITY }));
    return () => {
      rig.root.remove(card);
      for (const wiggleBone of wiggleBones.current) wiggleBone.dispose();
      wiggleBones.current = [];
    };
  }, [rig]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      rig.skinned.geometry.dispose();
      (rig.skinned.material as MeshStandardMaterial).dispose();
      stickerGeometry.dispose();
    };
  }, [rig, stickerGeometry]);

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
      const local = rig.skinned.worldToLocal(world);
      dragTarget.current.set(
        MathUtils.clamp(
          local.x + dragOffset.current.x,
          -DRAG_LIMIT_X,
          DRAG_LIMIT_X
        ),
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

  useFrame(({ clock }, delta) => {
    if (!rig) return;
    const root = rig.root;
    const idleX =
      dragging.current || reducedMotion
        ? 0
        : Math.sin(clock.elapsedTime * 0.85) * 0.012;
    const goalX = dragging.current ? dragTarget.current.x : idleX;
    const goalY = dragging.current ? dragTarget.current.y : 0;
    const ease = 1 - Math.exp(-(dragging.current ? 18 : 4.2) * delta);
    root.position.x += (goalX - root.position.x) * ease;
    root.position.y += (goalY - root.position.y) * ease;
    root.position.z = 0;
    root.rotation.y = 0;
    root.rotation.z = MathUtils.clamp(-root.position.x * 3.2, -0.22, 0.22);
    for (const wiggleBone of wiggleBones.current) wiggleBone.update(delta);
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
        const local = rig.skinned.worldToLocal(world);
        dragOffset.current.set(
          rig.root.position.x - local.x,
          rig.root.position.y - local.y,
          0
        );
        dragTarget.current.copy(rig.root.position);
        gl.domElement.style.cursor = "grabbing";
        gl.domElement.setPointerCapture(event.pointerId);
      }}
      position={[0, -1.15, 0]}
      ref={groupRef}
      scale={MODEL_SCALE}
    >
      <primitive object={rig.skinned} />
      <group position={[0, CARD_Y, 0]} ref={cardRef}>
        <RoundedBox
          args={[CARD_W, CARD_H, CARD_D]}
          castShadow
          radius={CARD_RADIUS}
          smoothness={6}
        >
          <meshStandardMaterial
            color="#f6f3ee"
            metalness={0.04}
            roughness={0.28}
          />
        </RoundedBox>
        <mesh
          geometry={stickerGeometry}
          position={[0, 0, CARD_D / 2 + 0.0006]}
        >
          <meshBasicMaterial map={texture as Texture} toneMapped={false} />
        </mesh>
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
      <PerspectiveCamera makeDefault fov={30} position={[0, 0.15, 6.6]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#fff7ee", "#2a1a10", 0.7]} />
      <directionalLight intensity={1.45} position={[4.5, 6, 8]} />
      <directionalLight intensity={0.45} position={[-5, 2, 4]} />
      <directionalLight
        color={LANYARD_ORANGE}
        intensity={0.28}
        position={[-3, 1, 5]}
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
      camera={{ fov: 30, position: [0, 0.15, 6.6] }}
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
