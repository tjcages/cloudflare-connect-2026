"use no memo";

import { useTexture } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type RefObject } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  SRGBColorSpace,
} from "three";
import type { BadgeCardIdentity } from "./BadgeLanyard";

const BILLBOARD_URL = "/connect/billboard.png";
const IMAGE_W = 1411;
const IMAGE_H = 1115;
const PLANE_H = 5.2;
const PLANE_W = PLANE_H * (IMAGE_W / IMAGE_H);
const FACE_Z = 0.012;

/** Image-space UV, origin at the top-left of the photo. */
const FACE_UV: readonly [number, number][] = [
  [0.225, 0.178],
  [0.79, 0.185],
  [0.792, 0.652],
  [0.188, 0.642],
];

function uvToLocal(u: number, v: number): [number, number, number] {
  return [(u - 0.5) * PLANE_W, (0.5 - v) * PLANE_H, FACE_Z];
}

function BillboardFace() {
  const geometry = useMemo(() => {
    const [tl, tr, br, bl] = FACE_UV.map(([u, v]) => uvToLocal(u, v));
    const positions = new Float32Array([
      ...tl,
      ...tr,
      ...br,
      ...tl,
      ...br,
      ...bl,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={1}>
      <meshBasicMaterial
        color="#ff5a00"
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

function BillboardPlate() {
  const texture = useTexture(BILLBOARD_URL);
  const { invalidate, viewport } = useThree();
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;

  useEffect(() => {
    invalidate();
  }, [invalidate, texture]);

  const scale =
    Math.min(viewport.width / PLANE_W, viewport.height / PLANE_H) * 0.94;

  return (
    <group scale={scale}>
      <mesh>
        <planeGeometry args={[PLANE_W, PLANE_H]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <BillboardFace />
    </group>
  );
}

useTexture.preload(BILLBOARD_URL);

export default function BadgeBillboard(_props: {
  twizzlerCanvas: RefObject<HTMLCanvasElement | null>;
  rainCanvas: RefObject<HTMLCanvasElement | null>;
  reducedMotion: boolean;
  identity: BadgeCardIdentity;
  lowPower: boolean;
  shaderLive: boolean;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], zoom: 90 }}
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{
        alpha: true,
        antialias: true,
        depth: true,
        powerPreference: "high-performance",
        stencil: false,
      }}
      orthographic
      style={{ height: "100%", touchAction: "none", width: "100%" }}
    >
      <BillboardPlate />
    </Canvas>
  );
}
