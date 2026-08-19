"use no memo";

import { PerspectiveCamera, RoundedBox, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { BufferGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import {
  Bone,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  MathUtils,
  Shape,
  ShapeGeometry,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
} from "three";
import { WiggleBone } from "wiggle";

const BADGE_W = 2;
const BADGE_H = 3.2;
const BADGE_D = 0.1;
const SHADER_INSET = 0.06;
const SHADER_RADIUS = 0.14;
const LANYARD_ORANGE = "#f46021";
const LANYARD_URL = "/connect/badge-lanyard.glb";
const LANYARD_BONES = 6;
const TEXTURE_W = 880;
const TEXTURE_H = 1240;

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
  return new ShapeGeometry(shape);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
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
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, destW, destH);
}

function useHeroShaderTexture(
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>,
  rainCanvas: RefObject<HTMLCanvasElement | null>
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
    // The hero stack draws on the page's light background; both source
    // canvases keep transparent clears, so composite on white like the hero.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const twizzler = twizzlerCanvas.current;
    const rain = rainCanvas.current;
    if (twizzler) drawCover(ctx, twizzler, canvas.width, canvas.height);
    if (rain) drawCover(ctx, rain, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  return texture;
}

type LanyardRig = {
  skinned: SkinnedMesh;
  wiggleBones: WiggleBone[];
};

/**
 * The uploaded GLB is a single static mesh with no skeleton, so the rig is
 * built at runtime: the geometry's longest axis (the strap) is stood up
 * along +Y, a bone chain is laid along it, and vertices are skinned by their
 * position on the strap. The root bone (the end attached to the badge) stays
 * rigid; every child bone becomes a WiggleBone so only the string wiggles.
 */
function buildLanyardRig(source: Mesh): LanyardRig {
  const geometry = (source.geometry as BufferGeometry).clone();
  source.updateWorldMatrix(true, false);
  geometry.applyMatrix4(source.matrixWorld);
  // Strap runs along X in the source scan and the scan lies flat (+Y is its
  // thin side). Stand it up along +Y, then turn its flat face to the camera.
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateY(Math.PI / 2);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const length = box.max.y - box.min.y;
  // Put the attach end at the origin so the root bone sits on the badge slot.
  geometry.translate(
    -(box.min.x + box.max.x) / 2,
    -box.min.y,
    -(box.min.z + box.max.z) / 2
  );

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
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const along = MathUtils.clamp(position.getY(index) / segment, 0, LANYARD_BONES);
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

  // Keep only the normal map; the scan's base/AO/roughness textures muddy
  // the brand orange into brick red.
  const material = (source.material as MeshStandardMaterial).clone();
  material.map = null;
  material.aoMap = null;
  material.roughnessMap = null;
  material.metalnessMap = null;
  material.color = new Color(LANYARD_ORANGE);
  material.roughness = 0.45;
  material.metalness = 0.05;

  const skinned = new SkinnedMesh(geometry, material);
  const root = bones[0]!;
  skinned.add(root);
  skinned.bind(new Skeleton(bones));

  const wiggleBones = bones
    .slice(1)
    .map((bone) => new WiggleBone(bone, { velocity: 0.45 }));

  return { skinned, wiggleBones };
}

function LanyardModel({ reducedMotion }: { reducedMotion: boolean }) {
  const { scene } = useGLTF(LANYARD_URL);
  const groupRef = useRef<Group>(null);
  const rig = useMemo(() => {
    let source: Mesh | null = null;
    scene.traverse((child) => {
      if (!source && (child as Mesh).isMesh) source = child as Mesh;
    });
    if (!source) return null;
    return buildLanyardRig(source);
  }, [scene]);

  useEffect(() => {
    if (!rig) return;
    return () => {
      for (const wiggleBone of rig.wiggleBones) wiggleBone.dispose();
      rig.skinned.geometry.dispose();
      (rig.skinned.material as MeshStandardMaterial).dispose();
    };
  }, [rig]);

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!rig || !group) return;
    if (!reducedMotion) {
      const t = clock.elapsedTime;
      // Gentle sway of the rigid attach point; the wiggle bones make the
      // string trail behind it.
      group.rotation.z = Math.sin(t * 0.8) * 0.12;
      group.position.x = Math.sin(t * 0.5) * 0.06;
    }
    for (const wiggleBone of rig.wiggleBones) wiggleBone.update();
  });

  if (!rig) return null;

  return (
    <group position={[0, BADGE_H / 2 - 0.14, 0.08]} ref={groupRef} scale={5}>
      <primitive object={rig.skinned} />
    </group>
  );
}

function BadgeScene({
  twizzlerCanvas,
  rainCanvas,
  reducedMotion,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
}) {
  const { gl, clock, camera } = useThree();
  const badgeRef = useRef<Group>(null);
  const rotationY = useRef(0.22);
  const velocityY = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const texture = useHeroShaderTexture(twizzlerCanvas, rainCanvas);
  const faceGeometry = useMemo(
    () =>
      createRoundedPlane(
        BADGE_W - SHADER_INSET * 2,
        BADGE_H - SHADER_INSET * 2,
        SHADER_RADIUS
      ),
    []
  );

  useEffect(() => {
    return () => {
      faceGeometry.dispose();
    };
  }, [faceGeometry]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      event.preventDefault();
      const delta = event.clientX - lastX.current;
      lastX.current = event.clientX;
      rotationY.current += delta * 0.012;
      velocityY.current = delta * 0.018;
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
  }, [gl]);

  useFrame(() => {
    camera.position.z = gl.domElement.clientWidth < 700 ? 11.4 : 13.2;
    if (!dragging.current) {
      velocityY.current *= 0.94;
      rotationY.current += velocityY.current;
    }
    const badge = badgeRef.current;
    if (!badge) return;
    const t = clock.elapsedTime;
    const idleX = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.03;
    const idleZ = reducedMotion ? 0 : Math.sin(t * 0.45) * 0.018;
    badge.rotation.x = 0.06 + idleX;
    badge.rotation.y = rotationY.current;
    badge.rotation.z = idleZ;
  });

  const faceZ = BADGE_D / 2 + 0.002;

  return (
    <>
      <PerspectiveCamera makeDefault fov={28} position={[0, 0, 13.2]} />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#fff4ea", "#2a1a10", 0.65]} />
      <directionalLight intensity={1.3} position={[5, 7, 8]} />
      <directionalLight intensity={0.5} position={[-6, 3, -6]} />
      <directionalLight
        color={LANYARD_ORANGE}
        intensity={0.35}
        position={[-4, -1, 5]}
      />
      <LanyardModel reducedMotion={reducedMotion} />
      <group
        ref={badgeRef}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragging.current = true;
          lastX.current = event.nativeEvent.clientX;
          gl.domElement.style.cursor = "grabbing";
          gl.domElement.setPointerCapture(event.pointerId);
        }}
      >
        <RoundedBox
          args={[BADGE_W, BADGE_H, BADGE_D]}
          radius={0.16}
          smoothness={6}
        >
          <meshPhysicalMaterial
            clearcoat={0.35}
            color="#141414"
            metalness={0.12}
            roughness={0.38}
          />
        </RoundedBox>
        <mesh geometry={faceGeometry} position={[0, 0, faceZ]}>
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        <mesh
          geometry={faceGeometry}
          position={[0, 0, -faceZ]}
          rotation={[0, Math.PI, 0]}
        >
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

useGLTF.preload(LANYARD_URL);

export default function BadgeLanyard({
  twizzlerCanvas,
  rainCanvas,
  reducedMotion,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={{ fov: 28, position: [0, 0, 13.2] }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ height: "100%", touchAction: "none", width: "100%" }}
    >
      <BadgeScene
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        twizzlerCanvas={twizzlerCanvas}
      />
    </Canvas>
  );
}
