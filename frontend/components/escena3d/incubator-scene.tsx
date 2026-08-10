"use client";

import { Float, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

function Egg({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} scale={[0.6, 0.8, 0.6]} castShadow>
      <sphereGeometry args={[0.22, 20, 16]} />
      <meshStandardMaterial color="#f3ead7" roughness={0.72} />
    </mesh>
  );
}

function Model({ angle, temperature }: { angle: number; temperature: number }) {
  const tray = useRef<THREE.Group>(null);
  const glow = Math.min(2.1, Math.max(0.7, 0.8 + (temperature - 36) * 0.65));
  useFrame(() => {
    if (tray.current) {
      tray.current.rotation.z = THREE.MathUtils.lerp(tray.current.rotation.z, THREE.MathUtils.degToRad(angle * 0.35), 0.05);
    }
  });

  return (
    <group position={[0, -0.15, 0]} rotation={[0.05, -0.35, 0]}>
      <RoundedBox args={[3.5, 2.7, 2.5]} radius={0.18} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color="#ddd6c8" roughness={0.72} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[3.08, 2.05, 0.06]} radius={0.11} smoothness={4} position={[0, 0.05, 1.27]}>
        <meshPhysicalMaterial color="#fffdf7" transparent opacity={0.26} roughness={0.08} transmission={0.45} />
      </RoundedBox>
      <group ref={tray} position={[0, -0.1, 1.36]}>
        <RoundedBox args={[2.45, 0.1, 1.1]} radius={0.05} smoothness={3}>
          <meshStandardMaterial color="#8f877a" roughness={0.55} />
        </RoundedBox>
        {[-0.75, 0, 0.75].flatMap((x) => [-0.28, 0.28].map((y) => <Egg key={`${x}-${y}`} position={[x, y, 0.19]} />))}
      </group>
      <mesh position={[1.28, -0.72, 1.42]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.31, 0.42, 24]} />
        <meshStandardMaterial color="#4c4943" roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh position={[1.28, -0.42, 1.52]} rotation={[0, 0, THREE.MathUtils.degToRad(angle)]}>
        <boxGeometry args={[0.08, 0.72, 0.08]} />
        <meshStandardMaterial color="#DDA83A" emissive="#DDA83A" emissiveIntensity={0.45} />
      </mesh>
      <pointLight position={[0, 0.8, 1]} color="#e7b851" intensity={glow} distance={5} />
      <mesh position={[0, 0.95, 1.35]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#DDA83A" emissive="#DDA83A" emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

export default function IncubatorScene({ angle, temperature }: { angle: number; temperature: number }) {
  return (
    <Canvas shadows dpr={[1, 1.45]} camera={{ position: [6.8, 4.4, 8.1], fov: 37 }} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} color="#fff8ea" castShadow />
      <Float speed={0.8} rotationIntensity={0.08} floatIntensity={0.12}>
        <Model angle={angle} temperature={temperature} />
      </Float>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
    </Canvas>
  );
}
