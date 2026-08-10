"use client";

import { RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const DISC_SLOTS: Array<[number, number]> = [
  [0, -0.68],
  [-0.64, 0.42],
  [0.64, 0.42],
];

function Egg({ position }: { position: [number, number, number] }) {
  const egg = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const age = useRef(0);
  useFrame((_, delta) => {
    age.current += delta;
    const progress = Math.min(1, age.current / 1.15);
    const bounce = 1 - Math.exp(-progress * 6) * Math.cos(progress * 11);
    if (egg.current) {
      egg.current.scale.set(0.74 * bounce, 1.05 * bounce, 0.74 * bounce);
      egg.current.position.y = position[1] + (1 - progress) * 0.28;
    }
    if (material.current) material.current.opacity = Math.min(1, progress * 1.9);
  });
  return (
    <mesh ref={egg} position={position} scale={0.02} castShadow renderOrder={2}>
      <sphereGeometry args={[0.38, 32, 24]} />
      <meshPhysicalMaterial ref={material} color="#fff0bf" roughness={0.4} clearcoat={0.38} emissive="#8a5200" emissiveIntensity={0.055} transparent opacity={0} />
    </mesh>
  );
}

function DiscSlot({ position, occupied }: { position: [number, number]; occupied: boolean }) {
  const [x, z] = position;
  return (
    <group position={[x, 0.17, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[0.38, 0.055, 18, 48]} />
        <meshStandardMaterial color="#ffe36a" roughness={0.34} metalness={0.04} emissive="#ef9f00" emissiveIntensity={0.08} />
      </mesh>
      {occupied && <Egg position={[0, 0.31, 0]} />}
    </group>
  );
}

function RotatingDisc({ angle, occupied }: { angle: number; occupied: number }) {
  const disc = useRef<THREE.Group>(null);
  const shape = useMemo(() => {
    const next = new THREE.Shape();
    next.absarc(0, 0, 1.52, 0, Math.PI * 2, false);
    DISC_SLOTS.forEach(([x, z]) => {
      const hole = new THREE.Path();
      hole.absarc(x, -z, 0.35, 0, Math.PI * 2, true);
      next.holes.push(hole);
    });
    return next;
  }, []);
  const extrusion = useMemo(() => ({ depth: 0.14, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.035, bevelSegments: 3, curveSegments: 56 }), []);

  useFrame((_, delta) => {
    if (!disc.current) return;
    const target = THREE.MathUtils.degToRad(angle);
    const easing = 1 - Math.exp(-delta * 5.5);
    disc.current.rotation.y = THREE.MathUtils.lerp(disc.current.rotation.y, target, easing);
  });

  return (
    <group ref={disc} position={[0, -0.42, 0.06]}>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1.43, 1.43, 0.075, 64]} />
        <meshStandardMaterial color="#2b2926" roughness={0.44} metalness={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, extrusion]} />
        <meshPhysicalMaterial color="#ffc20f" roughness={0.31} metalness={0.05} clearcoat={0.72} clearcoatRoughness={0.18} emissive="#d97800" emissiveIntensity={0.07} />
      </mesh>
      {DISC_SLOTS.map((position, index) => <DiscSlot key={`${position[0]}-${position[1]}`} position={position} occupied={index < occupied} />)}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.27, 0.2, 36]} />
        <meshStandardMaterial color="#2f7767" roughness={0.3} metalness={0.35} emissive="#17473f" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0.315, 0.01]}>
        <boxGeometry args={[0.085, 0.035, 0.26]} />
        <meshStandardMaterial color="#25222e" roughness={0.38} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Model({ angle, temperature, occupied }: { angle: number; temperature: number; occupied: number }) {
  const glow = Math.min(2.1, Math.max(0.7, 0.8 + (temperature - 36) * 0.65));

  return (
    <group position={[0, -0.18, 0]} rotation={[0.04, -0.32, 0]}>
      <RoundedBox args={[3.65, 2.85, 2.55]} radius={0.22} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial color="#e9f8f5" roughness={0.045} metalness={0.01} transmission={0.94} thickness={0.34} ior={1.46} transparent opacity={0.25} depthWrite={false} clearcoat={1} clearcoatRoughness={0.06} />
      </RoundedBox>
      <RoundedBox args={[3.25, 2.38, 0.06]} radius={0.15} smoothness={4} position={[0, 0.02, -1.23]}>
        <meshStandardMaterial color="#f7f0df" roughness={0.7} transparent opacity={0.62} />
      </RoundedBox>
      <RotatingDisc angle={angle} occupied={occupied} />
      <RoundedBox args={[3.35, 0.22, 2.28]} radius={0.08} smoothness={3} position={[0, -1.26, 0]}>
        <meshStandardMaterial color="#32302d" roughness={0.42} metalness={0.38} />
      </RoundedBox>
      <mesh position={[0, -0.91, 0.06]} castShadow>
        <cylinderGeometry args={[0.24, 0.3, 0.7, 36]} />
        <meshStandardMaterial color="#26242b" roughness={0.34} metalness={0.5} />
      </mesh>
      <pointLight position={[0, 0.88, 0.9]} color="#ffd86a" intensity={glow} distance={5} />
      <mesh position={[1.35, 0.98, 1.08]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#ffd24a" emissive="#dda83a" emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

export default function IncubatorScene({ angle, temperature, occupied }: { angle: number; temperature: number; occupied: number }) {
  return (
    <Canvas shadows="basic" dpr={[1, 1.45]} camera={{ position: [7.2, 4.6, 8.9], fov: 36 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} color="#fff8ea" castShadow />
      <Model angle={angle} temperature={temperature} occupied={occupied} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
    </Canvas>
  );
}
