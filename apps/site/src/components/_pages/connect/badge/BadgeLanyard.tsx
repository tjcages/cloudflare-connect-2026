"use no memo";

import { RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Camera, Group, Mesh } from "three";
import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import type { BadgeFace } from "./badge-texture";
import { createBadgeCanvases } from "./badge-texture";

type Particle = {
  x: number;
  y: number;
  z: number;
  px: number;
  py: number;
  pz: number;
  pinned: boolean;
};

const SEGMENT_COUNT = 16;
const REST_LENGTH = 0.38;
const GRAVITY = -26;
const DAMPING = 0.984;
const CONSTRAINT_ITERS = 5;
const BADGE_W = 2.15;
const BADGE_H = 3.32;
const BADGE_D = 0.14;
const FLOOR = -5.6;
const ANCHOR_Y = 7.15;
const CORD_RADIUS = 0.055;

function makeParticles(): Particle[] {
  return Array.from({ length: SEGMENT_COUNT }, (_, index) => {
    const y = ANCHOR_Y - index * REST_LENGTH;
    return {
      x: 0,
      y,
      z: 0,
      px: 0,
      py: y,
      pz: 0,
      pinned: index === 0,
    };
  });
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

function LanyardScene({
  face,
  reducedMotion,
}: {
  face: BadgeFace;
  reducedMotion: boolean;
}) {
  const { gl, camera } = useThree();
  const particles = useRef(makeParticles());
  const badgeRef = useRef<Group>(null);
  const clipRef = useRef<Group>(null);
  const cordRef = useRef<Mesh>(null);
  const curvePts = useMemo(
    () => Array.from({ length: SEGMENT_COUNT }, () => new Vector3()),
    []
  );
  const drag = useRef<{ active: boolean; ox: number; oy: number }>({
    active: false,
    ox: 0,
    oy: 0,
  });
  const spin = useRef(0.35);
  const textures = useMemo(() => {
    const { front, back } = createBadgeCanvases(face);
    const frontMap = new CanvasTexture(front);
    const backMap = new CanvasTexture(back);
    frontMap.colorSpace = SRGBColorSpace;
    backMap.colorSpace = SRGBColorSpace;
    frontMap.anisotropy = 8;
    backMap.anisotropy = 8;
    return { frontMap, backMap };
  }, [face]);

  useEffect(() => {
    return () => {
      textures.frontMap.dispose();
      textures.backMap.dispose();
    };
  }, [textures]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";

    const onMove = (event: PointerEvent) => {
      if (!drag.current.active) return;
      event.preventDefault();
      const world = pointerToWorld(
        event.clientX,
        event.clientY,
        canvas,
        camera
      );
      const last = particles.current[SEGMENT_COUNT - 1];
      if (!last) return;
      const nextX = world.x + drag.current.ox;
      const nextY = world.y + drag.current.oy;
      spin.current += (nextX - last.x) * 1.6;
      last.px = last.x;
      last.py = last.y;
      last.x = nextX;
      last.y = Math.max(FLOOR, nextY);
    };

    const onUp = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
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
  }, [camera, gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.032);
    const pts = particles.current;
    const anchor = pts[0];
    if (anchor) {
      anchor.x = 0;
      anchor.y = ANCHOR_Y;
      anchor.z = 0;
      anchor.px = 0;
      anchor.py = ANCHOR_Y;
      anchor.pz = 0;
    }

    const lastParticle = pts[pts.length - 1];
    if (!reducedMotion) {
      for (const particle of pts) {
        if (
          particle.pinned ||
          (drag.current.active && particle === lastParticle)
        ) {
          continue;
        }
        const vx = (particle.x - particle.px) * DAMPING;
        const vy = (particle.y - particle.py) * DAMPING;
        const vz = (particle.z - particle.pz) * DAMPING;
        particle.px = particle.x;
        particle.py = particle.y;
        particle.pz = particle.z;
        particle.x += vx;
        particle.y += vy + GRAVITY * dt * dt;
        particle.z += vz * 0.92;
        if (particle.y < FLOOR) {
          particle.y = FLOOR;
          particle.py = particle.y + vy * 0.62;
          particle.z *= 0.4;
          particle.pz = particle.z;
        }
      }

      for (let iter = 0; iter < CONSTRAINT_ITERS; iter += 1) {
        for (let index = 1; index < pts.length; index += 1) {
          const a = pts[index - 1];
          const b = pts[index];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.hypot(dx, dy, dz) || 0.0001;
          const diff = (dist - REST_LENGTH) / dist;
          const nx = dx * diff * 0.5;
          const ny = dy * diff * 0.5;
          const nz = dz * diff * 0.5;
          if (!a.pinned) {
            a.x += nx;
            a.y += ny;
            a.z += nz;
          }
          if (!b.pinned && !(drag.current.active && b === lastParticle)) {
            b.x -= nx;
            b.y -= ny;
            b.z -= nz;
          }
        }
      }

      spin.current *= 0.985;
    } else {
      spin.current = 0.15;
    }

    for (let index = 0; index < pts.length; index += 1) {
      const particle = pts[index];
      const point = curvePts[index];
      if (!particle || !point) continue;
      point.set(particle.x, particle.y, particle.z);
    }

    const cord = cordRef.current;
    if (cord) {
      const curve = new CatmullRomCurve3(curvePts);
      const next = new TubeGeometry(curve, 48, CORD_RADIUS, 8, false);
      const prev = cord.geometry;
      cord.geometry = next;
      prev.dispose();
    }

    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    if (last && prev && badgeRef.current && clipRef.current) {
      const angleZ = Math.atan2(last.x - prev.x, prev.y - last.y);
      clipRef.current.position.set(last.x, last.y, last.z);
      clipRef.current.rotation.set(0, 0, angleZ);
      badgeRef.current.position.set(
        last.x,
        last.y - BADGE_H / 2 - 0.12,
        last.z
      );
      badgeRef.current.rotation.set(0.08, spin.current, angleZ * 0.85);
    }
  });

  const strapColor = face.theme.accent;
  const metal = "#c5c5c5";

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight intensity={1.15} position={[6, 10, 8]} />
      <directionalLight
        color={strapColor}
        intensity={0.35}
        position={[-5, 3, 4]}
      />
      <mesh ref={cordRef}>
        <tubeGeometry
          args={[new CatmullRomCurve3(curvePts), 48, CORD_RADIUS, 8, false]}
        />
        <meshStandardMaterial color={strapColor} roughness={0.48} />
      </mesh>
      <group ref={clipRef}>
        <mesh position={[0, 0.02, 0]}>
          <torusGeometry args={[0.11, 0.03, 10, 24]} />
          <meshStandardMaterial
            color={metal}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.38, 0.16, 0.08]} />
          <meshStandardMaterial
            color={metal}
            metalness={0.8}
            roughness={0.28}
          />
        </mesh>
      </group>
      <group
        ref={badgeRef}
        onPointerDown={(event) => {
          event.stopPropagation();
          const last = particles.current[SEGMENT_COUNT - 1];
          if (!last) return;
          const world = pointerToWorld(
            event.nativeEvent.clientX,
            event.nativeEvent.clientY,
            gl.domElement,
            camera
          );
          drag.current = {
            active: true,
            ox: last.x - world.x,
            oy: last.y - world.y,
          };
          gl.domElement.style.cursor = "grabbing";
          gl.domElement.setPointerCapture(event.pointerId);
        }}
      >
        <RoundedBox
          args={[BADGE_W, BADGE_H, BADGE_D]}
          radius={0.12}
          smoothness={6}
        >
          <meshPhysicalMaterial
            clearcoat={0.55}
            clearcoatRoughness={0.3}
            color={new Color("#f4f4f4")}
            metalness={0.04}
            roughness={0.32}
          />
        </RoundedBox>
        <mesh position={[0, 0, BADGE_D / 2 + 0.002]}>
          <planeGeometry args={[BADGE_W - 0.08, BADGE_H - 0.08]} />
          <meshStandardMaterial
            map={textures.frontMap}
            metalness={0.02}
            roughness={0.45}
          />
        </mesh>
        <mesh
          position={[0, 0, -(BADGE_D / 2 + 0.002)]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={[BADGE_W - 0.08, BADGE_H - 0.08]} />
          <meshStandardMaterial
            map={textures.backMap}
            metalness={0.02}
            roughness={0.45}
          />
        </mesh>
      </group>
    </>
  );
}

export default function BadgeLanyard({
  face,
  reducedMotion,
}: {
  face: BadgeFace;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={{ fov: 22, position: [0, 0.4, 26] }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      style={{ height: "100%", touchAction: "none", width: "100%" }}
    >
      <LanyardScene face={face} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
