"use no memo";

import { PerspectiveCamera, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Group } from "three";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";

const BADGE_W = 2.18;
const BADGE_H = 3.08;
const BADGE_D = 0.1;
const SHADER_INSET = 0.07;
const SHADER_RADIUS = 0.14;
const LANYARD_ORANGE = "#f46021";
const TEXTURE_W = 720;
const TEXTURE_H = 1020;

const LANYARD_POINTS = [
  new Vector3(0, 1.56, 0.06),
  new Vector3(0.2, 1.6, -0.04),
  new Vector3(0.58, 1.12, -0.1),
  new Vector3(0.82, 0.32, -0.06),
  new Vector3(0.95, -0.55, 0.1),
  new Vector3(0.98, -1.52, 0.3),
  new Vector3(0.18, -2.22, 0.82),
  new Vector3(1.1, -2.72, 0.38),
  new Vector3(1.22, -3.72, 0.08),
  new Vector3(0.65, -5.3, 0),
  new Vector3(0.98, -7.6, 0),
  new Vector3(0.45, -10.6, 0),
  new Vector3(0.75, -14.6, 0),
];

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
  rainCanvas: RefObject<HTMLCanvasElement | null>,
  fallback: string
) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_W;
    canvas.height = TEXTURE_H;
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace;
    map.anisotropy = 8;
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
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const twizzler = twizzlerCanvas.current;
    const rain = rainCanvas.current;
    if (twizzler) drawCover(ctx, twizzler, canvas.width, canvas.height);
    if (rain) drawCover(ctx, rain, canvas.width, canvas.height);
    texture.needsUpdate = true;
  });

  return texture;
}

function BadgeScene({
  twizzlerCanvas,
  rainCanvas,
  fallback,
  reducedMotion,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  fallback: string;
  reducedMotion: boolean;
}) {
  const { gl, clock, camera } = useThree();
  const badgeRef = useRef<Group>(null);
  const rotationY = useRef(0.22);
  const velocityY = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const texture = useHeroShaderTexture(twizzlerCanvas, rainCanvas, fallback);
  const faceGeometry = useMemo(
    () =>
      createRoundedPlane(
        BADGE_W - SHADER_INSET * 2,
        BADGE_H - SHADER_INSET * 2,
        SHADER_RADIUS
      ),
    []
  );
  const tubeGeometry = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3(LANYARD_POINTS, false, "catmullrom", 0.42),
        160,
        0.32,
        24,
        false
      ),
    []
  );

  useEffect(() => {
    return () => {
      faceGeometry.dispose();
      tubeGeometry.dispose();
    };
  }, [faceGeometry, tubeGeometry]);

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
    const idle = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.7) * 0.035;
    badge.rotation.x = 0.08 + idle;
    badge.rotation.y = rotationY.current;
  });

  const faceZ = BADGE_D / 2 + 0.002;

  return (
    <>
      <PerspectiveCamera makeDefault fov={28} position={[0, 0, 13.2]} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#fff4ea", "#1c120c", 0.7]} />
      <directionalLight intensity={1.35} position={[5, 7, 8]} />
      <directionalLight
        color={LANYARD_ORANGE}
        intensity={0.4}
        position={[-4, -1, 5]}
      />
      <mesh geometry={tubeGeometry}>
        <meshPhysicalMaterial
          clearcoat={0.55}
          clearcoatRoughness={0.28}
          color={LANYARD_ORANGE}
          metalness={0.08}
          roughness={0.32}
          sheen={0.35}
          sheenColor="#f77720"
        />
      </mesh>
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
        <mesh position={[0, BADGE_H / 2 - 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.16, 20]} />
          <meshStandardMaterial color={LANYARD_ORANGE} roughness={0.3} />
        </mesh>
      </group>
    </>
  );
}

export default function BadgeLanyard({
  twizzlerCanvas,
  rainCanvas,
  fallback,
  reducedMotion,
}: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  fallback: string;
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
        fallback={fallback}
        rainCanvas={rainCanvas}
        reducedMotion={reducedMotion}
        twizzlerCanvas={twizzlerCanvas}
      />
    </Canvas>
  );
}
