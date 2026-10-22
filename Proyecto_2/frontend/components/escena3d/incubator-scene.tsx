"use client";

import { RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const DISC_SLOTS: Array<[number, number]> = [
  [0, -0.68],
  [-0.64, 0.42],
  [0.64, 0.42],
];

type AirParticle = {
  position: [number, number, number];
  phase: number;
  speed: number;
  size: number;
};

const AIR_PARTICLES: AirParticle[] = Array.from({ length: 24 }, (_, index) => {
  const angle = (index / 24) * Math.PI * 2;
  const radius = 0.45 + (index % 5) * 0.18;
  return {
    position: [Math.cos(angle) * radius, -1.04 + (index % 6) * 0.38, Math.sin(angle) * radius * 0.72] as [number, number, number],
    phase: index * 1.37,
    speed: 0.7 + (index % 4) * 0.16,
    size: 0.018 + (index % 3) * 0.009,
  };
});

function Egg({ position, animate }: { position: [number, number, number]; animate: boolean }) {
  const egg = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshPhysicalMaterial>(null);
  const age = useRef(0);

  useFrame((_, delta) => {
    if (!egg.current || !material.current) return;
    if (!animate) {
      egg.current.scale.set(0.74, 1.05, 0.74);
      egg.current.position.y = position[1];
      material.current.opacity = 1;
      return;
    }

    age.current += delta;
    const progress = Math.min(1, age.current / 1.15);
    const bounce = 1 - Math.exp(-progress * 6) * Math.cos(progress * 11);
    egg.current.scale.set(0.74 * bounce, 1.05 * bounce, 0.74 * bounce);
    egg.current.position.y = position[1] + (1 - progress) * 0.28;
    material.current.opacity = Math.min(1, progress * 1.9);
  });

  return (
    <mesh ref={egg} position={position} scale={0.02} castShadow renderOrder={2}>
      <sphereGeometry args={[0.38, 32, 24]} />
      <meshPhysicalMaterial ref={material} color="#fff0bf" roughness={0.4} clearcoat={0.38} emissive="#8a5200" emissiveIntensity={0.055} transparent opacity={0} />
    </mesh>
  );
}

function DiscSlot({ position, occupied, animate }: { position: [number, number]; occupied: boolean; animate: boolean }) {
  const [x, z] = position;
  return (
    <group position={[x, 0.17, z]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <torusGeometry args={[0.38, 0.055, 18, 48]} />
        <meshStandardMaterial color="#9aae86" roughness={0.34} metalness={0.04} emissive="#54764a" emissiveIntensity={0.1} />
      </mesh>
      {occupied && <Egg position={[0, 0.31, 0]} animate={animate} />}
    </group>
  );
}

function RotatingDisc({ angle, occupied, animate }: { angle: number; occupied: number; animate: boolean }) {
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
    const difference = THREE.MathUtils.euclideanModulo(target - disc.current.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    const easing = animate ? 1 - Math.exp(-delta * 5.5) : 1;
    disc.current.rotation.y += difference * easing;
  });

  return (
    <group ref={disc} position={[0, -0.42, 0.06]}>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <cylinderGeometry args={[1.43, 1.43, 0.075, 64]} />
        <meshStandardMaterial color="#1b3e34" roughness={0.44} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <extrudeGeometry args={[shape, extrusion]} />
        <meshPhysicalMaterial color="#6cb7d3" roughness={0.38} metalness={0.035} clearcoat={0.5} clearcoatRoughness={0.2} emissive="#286c83" emissiveIntensity={0.055} />
      </mesh>
      {DISC_SLOTS.map((position, index) => <DiscSlot key={`${position[0]}-${position[1]}`} position={position} occupied={index < occupied} animate={animate} />)}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.27, 0.2, 36]} />
        <meshStandardMaterial color="#2f7767" roughness={0.3} metalness={0.35} emissive="#17473f" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0.315, 0.01]}>
        <boxGeometry args={[0.085, 0.035, 0.26]} />
        <meshStandardMaterial color="#34463a" roughness={0.38} metalness={0.4} />
      </mesh>
    </group>
  );
}

function IncubatorLid({ open, animate }: { open: boolean; animate: boolean }) {
  const lid = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!lid.current) return;
    const target = open ? -THREE.MathUtils.degToRad(72) : 0;
    const easing = animate ? 1 - Math.exp(-delta * 5.5) : 1;
    lid.current.rotation.x += (target - lid.current.rotation.x) * easing;
  });

  return (
    <group ref={lid} position={[0, 1.48, -1.72]}>
      <RoundedBox args={[4.18, 0.12, 3.5]} radius={0.12} smoothness={4} position={[0, 0, 1.75]} castShadow>
        <meshPhysicalMaterial color="#d8f0eb" roughness={0.08} metalness={0.08} transmission={0.72} thickness={0.18} transparent opacity={0.34} clearcoat={1} clearcoatRoughness={0.08} />
      </RoundedBox>
      <mesh position={[0, -0.08, 0.09]} castShadow>
        <boxGeometry args={[3.96, 0.08, 0.1]} />
        <meshStandardMaterial color="#b8dcd6" roughness={0.22} metalness={0.42} />
      </mesh>
      <mesh position={[0, -0.08, 3.41]} castShadow>
        <boxGeometry args={[3.96, 0.08, 0.1]} />
        <meshStandardMaterial color="#b8dcd6" roughness={0.22} metalness={0.42} />
      </mesh>
      <mesh position={[-2.02, -0.08, 1.75]} castShadow>
        <boxGeometry args={[0.1, 0.08, 3.3]} />
        <meshStandardMaterial color="#b8dcd6" roughness={0.22} metalness={0.42} />
      </mesh>
      <mesh position={[2.02, -0.08, 1.75]} castShadow>
        <boxGeometry args={[0.1, 0.08, 3.3]} />
        <meshStandardMaterial color="#b8dcd6" roughness={0.22} metalness={0.42} />
      </mesh>
      <mesh position={[0, -0.16, 3.38]} castShadow>
        <boxGeometry args={[0.62, 0.13, 0.12]} />
        <meshStandardMaterial color="#3c5a4c" roughness={0.25} metalness={0.52} emissive={open ? "#008f96" : "#173d35"} emissiveIntensity={open ? 0.18 : 0.03} />
      </mesh>
      <mesh position={[0, -0.25, 3.38]}>
        <boxGeometry args={[0.42, 0.045, 0.08]} />
        <meshStandardMaterial color={open ? "#80b9a1" : "#d2dfc9"} roughness={0.28} metalness={0.18} emissive={open ? "#368b78" : "#6b8e7b"} emissiveIntensity={open ? 0.32 : 0.05} />
      </mesh>
    </group>
  );
}

function HeatingLamp({ enabled, temperature, alarm, animate }: { enabled: boolean; temperature: number; alarm: boolean; animate: boolean }) {
  const bulb = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const isHot = temperature >= 38;
  const lampColor = alarm ? "#ff6b5b" : isHot ? "#ffad32" : "#ffd25a";

  useFrame(({ clock }) => {
    const pulse = enabled && animate ? 1 + Math.sin(clock.elapsedTime * 4.2) * 0.08 : 1;
    if (bulb.current) bulb.current.scale.setScalar(enabled ? 1 + (pulse - 1) * 0.8 : 0.88);
    if (material.current) material.current.emissiveIntensity = enabled ? (alarm ? 2.7 : 2.2) * pulse : 0.06;
    if (light.current) light.current.intensity = enabled ? (alarm ? 2.45 : 1.9) * pulse : 0.05;
  });

  return (
    <group position={[-2.12, 0.82, 0.18]}>
      <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.2, 24]} />
        <meshStandardMaterial color="#30483c" roughness={0.34} metalness={0.58} />
      </mesh>
      <mesh position={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.28, 0.16, 0.2]} />
        <meshStandardMaterial color="#3b5547" roughness={0.3} metalness={0.48} />
      </mesh>
      <mesh ref={bulb} position={[0.34, 0, 0]} castShadow>
        <sphereGeometry args={[0.19, 24, 16]} />
        <meshStandardMaterial ref={material} color={lampColor} emissive={lampColor} emissiveIntensity={enabled ? 2.2 : 0.06} roughness={0.25} toneMapped={false} />
      </mesh>
      <mesh position={[0.34, 0, 0]} scale={enabled ? 1.55 : 1.18}>
        <sphereGeometry args={[0.19, 20, 14]} />
        <meshBasicMaterial color={lampColor} transparent opacity={enabled ? 0.12 : 0.025} depthWrite={false} />
      </mesh>
      <mesh position={[0.29, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.23, 0.2, 24, 1, true]} />
        <meshStandardMaterial color="#f5a62f" roughness={0.28} metalness={0.24} emissive={lampColor} emissiveIntensity={enabled ? 0.32 : 0.03} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={light} position={[0.36, 0, 0.05]} color={lampColor} intensity={enabled ? 1.9 : 0.05} distance={4.8} decay={2} />
    </group>
  );
}

function VentilationFan({ enabled, animate }: { enabled: boolean; animate: boolean }) {
  const blades = useRef<THREE.Group>(null);
  const bladeShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0.2, -0.1);
    shape.quadraticCurveTo(0.42, -0.25, 0.76, -0.1);
    shape.quadraticCurveTo(0.66, 0.03, 0.34, 0.13);
    shape.quadraticCurveTo(0.23, 0.13, 0.2, -0.1);
    return shape;
  }, []);
  const bladeExtrusion = useMemo(() => ({ depth: 0.055, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.012, bevelSegments: 2 }), []);

  useFrame((_, delta) => {
    if (blades.current && enabled && animate) blades.current.rotation.z += delta * 10.5;
  });

  const mountPoints: Array<[number, number]> = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  return (
    <group position={[2.12, 0.38, 0.12]} rotation={[0, Math.PI / 2, 0]} scale={0.66}>
      <RoundedBox args={[1.72, 1.72, 0.12]} radius={0.13} smoothness={4} position={[0, 0, -0.06]} castShadow>
        <meshStandardMaterial color="#203a31" roughness={0.36} metalness={0.62} />
      </RoundedBox>
      <RoundedBox args={[1.48, 1.48, 0.045]} radius={0.08} smoothness={3} position={[0, 0, 0.02]}>
        <meshStandardMaterial color="#13271f" roughness={0.68} metalness={0.12} />
      </RoundedBox>
      <mesh position={[0, 0.8, 0.06]} castShadow>
        <boxGeometry args={[1.55, 0.12, 0.11]} />
        <meshStandardMaterial color="#354c40" roughness={0.32} metalness={0.56} />
      </mesh>
      <mesh position={[0, -0.8, 0.06]} castShadow>
        <boxGeometry args={[1.55, 0.12, 0.11]} />
        <meshStandardMaterial color="#354c40" roughness={0.32} metalness={0.56} />
      </mesh>
      <mesh position={[-0.8, 0, 0.06]} castShadow>
        <boxGeometry args={[0.12, 1.55, 0.11]} />
        <meshStandardMaterial color="#354c40" roughness={0.32} metalness={0.56} />
      </mesh>
      <mesh position={[0.8, 0, 0.06]} castShadow>
        <boxGeometry args={[0.12, 1.55, 0.11]} />
        <meshStandardMaterial color="#354c40" roughness={0.32} metalness={0.56} />
      </mesh>
      {mountPoints.map(([x, y]) => {
        return (
          <group key={`${x}-${y}`} position={[x * 0.7, y * 0.7, 0.14]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.018, 12, 24]} />
              <meshStandardMaterial color="#a6b29d" roughness={0.28} metalness={0.55} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.047, 0.047, 0.025, 16]} />
              <meshStandardMaterial color="#1a2d24" roughness={0.45} metalness={0.18} />
            </mesh>
          </group>
        );
      })}
      {[-0.78, 0.78].map((barAngle) => (
        <mesh key={barAngle} position={[0, 0, 0.24]} rotation={[0, 0, barAngle]} castShadow>
          <boxGeometry args={[1.62, 0.075, 0.07]} />
          <meshStandardMaterial color="#31473b" roughness={0.32} metalness={0.5} />
        </mesh>
      ))}
      <group ref={blades}>
        {Array.from({ length: 7 }, (_, index) => (
          <mesh key={index} position={[0, 0, 0.13]} rotation={[0, 0, (index * Math.PI * 2) / 7 + 0.16]} castShadow>
            <extrudeGeometry args={[bladeShape, bladeExtrusion]} />
            <meshStandardMaterial color={enabled ? "#e6eadc" : "#849080"} roughness={0.3} metalness={0.12} emissive={enabled ? "#789461" : "#294337"} emissiveIntensity={enabled ? 0.14 : 0.025} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.035, 16, 32]} />
        <meshStandardMaterial color={enabled ? "#9aae86" : "#718375"} roughness={0.28} metalness={0.5} emissive={enabled ? "#668342" : "#234638"} emissiveIntensity={enabled ? 0.16 : 0.03} />
      </mesh>
      <mesh position={[0, 0, 0.23]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.27, 0.18, 32]} />
        <meshStandardMaterial color="#233b31" roughness={0.3} metalness={0.58} />
      </mesh>
      <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.025, 32]} />
        <meshStandardMaterial color="#eef2ea" roughness={0.52} metalness={0.02} />
      </mesh>
      <mesh position={[0, -0.035, 0.36]}>
        <boxGeometry args={[0.34, 0.06, 0.012]} />
        <meshStandardMaterial color="#efb216" roughness={0.4} metalness={0.12} />
      </mesh>
    </group>
  );
}

function LcdScreen({ angle, temperature, humidity, heaterOn, fanOn, doorOpen, isOnline }: { angle: number; temperature: number; humidity: number; heaterOn: boolean; fanOn: boolean; doorOpen: boolean; isOnline: boolean }) {
  const display = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 288;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return { canvas, texture };
  }, []);

  useEffect(() => {
    const context = display.canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, display.canvas.width, display.canvas.height);
    context.fillStyle = "#071b17";
    context.fillRect(0, 0, display.canvas.width, display.canvas.height);
    context.strokeStyle = "rgba(157, 245, 189, 0.32)";
    context.lineWidth = 4;
    context.strokeRect(3, 3, display.canvas.width - 6, display.canvas.height - 6);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.fillStyle = "#76d9a2";
    context.font = "700 25px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.fillText("SMART EGG", 24, 37);
    context.fillStyle = "#b1f4bf";
    context.font = "700 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.fillText("SE-01", 850, 37);
    context.fillStyle = "#d1ffcb";
    context.font = "700 43px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.fillText(isOnline ? `${temperature.toFixed(1)}°C` : "—", 24, 106);
    context.fillText(isOnline ? `${humidity.toFixed(1)}%` : "—", 665, 106);
    context.fillStyle = "#83dba9";
    context.font = "700 23px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    context.fillText(`F:${heaterOn ? "ON" : "OFF"}`, 24, 161);
    context.fillText(`V:${fanOn ? "ON" : "OFF"}`, 265, 161);
    context.fillText(`P:${doorOpen ? "OPEN" : "CLOSE"}`, 505, 161);
    context.fillText(`R:${Math.round(angle)}°`, 745, 161);
    display.texture.needsUpdate = true;
  }, [display, angle, temperature, humidity, heaterOn, fanOn, doorOpen, isOnline]);

  useEffect(() => () => display.texture.dispose(), [display]);

  return (
    <mesh position={[0, 0, 0.065]} renderOrder={3}>
      <planeGeometry args={[1.14, 0.32]} />
      <meshBasicMaterial map={display.texture} toneMapped={false} />
    </mesh>
  );
}

function SideLcd({ angle, temperature, humidity, heaterOn, fanOn, doorOpen, isOnline }: { angle: number; temperature: number; humidity: number; heaterOn: boolean; fanOn: boolean; doorOpen: boolean; isOnline: boolean }) {
  return (
    <group position={[2.22, -1.08, 0.22]} rotation={[0, Math.PI / 2, 0]} scale={0.9}>
      <RoundedBox args={[1.34, 0.5, 0.12]} radius={0.08} smoothness={4} position={[0, 0, -0.05]} castShadow>
        <meshStandardMaterial color="#243c32" roughness={0.3} metalness={0.58} />
      </RoundedBox>
      <mesh position={[0, 0, 0.035]}>
        <boxGeometry args={[1.14, 0.32, 0.035]} />
        <meshStandardMaterial color="#0b332d" roughness={0.42} metalness={0.12} emissive="#103f35" emissiveIntensity={0.32} />
      </mesh>
      <LcdScreen angle={angle} temperature={temperature} humidity={humidity} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} isOnline={isOnline} />
    </group>
  );
}

function LowerWallPanels() {
  const panel = { color: "#b7b9b1", roughness: 0.76, metalness: 0.03, transparent: true, opacity: 0.92 };

  return (
    <group>
      <RoundedBox args={[4.2, 1.18, 0.08]} radius={0.04} smoothness={2} position={[0, -1.24, 1.79]} receiveShadow>
        <meshStandardMaterial {...panel} />
      </RoundedBox>
      <RoundedBox args={[4.2, 1.18, 0.08]} radius={0.04} smoothness={2} position={[0, -1.24, -1.79]} receiveShadow>
        <meshStandardMaterial {...panel} />
      </RoundedBox>
      <RoundedBox args={[0.08, 1.18, 3.5]} radius={0.04} smoothness={2} position={[2.14, -1.24, 0]} receiveShadow>
        <meshStandardMaterial {...panel} />
      </RoundedBox>
      <RoundedBox args={[0.08, 1.18, 3.5]} radius={0.04} smoothness={2} position={[-2.14, -1.24, 0]} receiveShadow>
        <meshStandardMaterial {...panel} />
      </RoundedBox>
      <mesh position={[0, -0.64, 0]}>
        <boxGeometry args={[4.14, 0.035, 3.46]} />
        <meshStandardMaterial color="#839b83" roughness={0.38} metalness={0.3} emissive="#2c645a" emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

function IncubatorBases() {
  return (
    <group>
      <RoundedBox args={[4.08, 0.24, 3.34]} radius={0.1} smoothness={3} position={[0, -1.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#293b32" roughness={0.4} metalness={0.42} />
      </RoundedBox>
      <RoundedBox args={[3.82, 0.065, 3.08]} radius={0.05} smoothness={2} position={[0, -1.345, 0.01]}>
        <meshStandardMaterial color="#22372f" roughness={0.52} metalness={0.28} />
      </RoundedBox>
      <RoundedBox args={[3.56, 0.18, 3.3]} radius={0.08} smoothness={3} position={[0, -0.72, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#39484a" roughness={0.35} metalness={0.48} />
      </RoundedBox>
      <RoundedBox args={[3.3, 0.075, 3.02]} radius={0.05} smoothness={2} position={[0, -0.61, 0.01]}>
      <meshStandardMaterial color="#1c3a32" roughness={0.4} metalness={0.34} emissive="#17473f" emissiveIntensity={0.12} />
      </RoundedBox>
      <mesh position={[0, -1.03, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.36, 0.55, 36]} />
      <meshStandardMaterial color="#313b33" roughness={0.34} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.72, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.16, 24]} />
        <meshStandardMaterial color="#9aa6a7" roughness={0.25} metalness={0.62} />
      </mesh>
    </group>
  );
}

function AirflowParticles({ fanOn, humidity, animate }: { fanOn: boolean; humidity: number; animate: boolean }) {
  const particles = useRef<THREE.Group>(null);
  const humidityRatio = THREE.MathUtils.clamp((humidity - 35) / 45, 0, 1);
  const particleColor = humidityRatio > 0.68 ? "#c3cf9d" : "#a9c5a3";

  useFrame(({ clock }) => {
    if (!particles.current) return;
    const time = clock.elapsedTime;
    particles.current.children.forEach((particle, index) => {
      const seed = AIR_PARTICLES[index];
      if (!seed) return;
      const phase = time * (fanOn ? seed.speed * 1.8 : seed.speed * 0.34) + seed.phase;
      const pulse = 0.78 + Math.sin(phase * 1.35) * 0.22;

      if (fanOn) {
        // The fan is mounted on the +X wall: particles travel from the
        // warm lower chamber, through the fan and out of the enclosure.
        const progress = animate ? (time * seed.speed * 0.27 + seed.phase * 0.13) % 1 : 0.58;
        const sourceX = -1.28 + (index % 4) * 0.12;
        const exhaustX = 2.82 + (index % 3) * 0.12;
        const sourceY = -0.52 + (index % 6) * 0.15;
        const fanY = 0.38 + ((index % 5) - 2) * 0.12;
        const sourceZ = -0.62 + (index % 7) * 0.2;
        const fanZ = 0.12 + Math.sin(seed.phase) * 0.28;
        const easedProgress = THREE.MathUtils.smoothstep(progress, 0, 1);
        particle.position.set(
          THREE.MathUtils.lerp(sourceX, exhaustX, easedProgress) + Math.sin(phase) * 0.06,
          THREE.MathUtils.lerp(sourceY, fanY, Math.min(1, progress * 1.45)) + Math.sin(phase * 0.7) * 0.08,
          THREE.MathUtils.lerp(sourceZ, fanZ, Math.min(1, progress * 1.2)) + Math.cos(phase * 0.6) * 0.07,
        );
        particle.scale.setScalar(seed.size * (0.9 + humidityRatio * 0.8) * pulse * 1.35);
      } else {
        particle.position.set(
          seed.position[0] + Math.sin(phase) * 0.08,
          seed.position[1] + Math.cos(phase * 0.82) * 0.06,
          seed.position[2] + Math.sin(phase * 0.64) * 0.05,
        );
        particle.scale.setScalar(seed.size * (0.75 + humidityRatio * 0.7) * pulse * 0.9);
      }
    });
  });

  return (
    <group ref={particles}>
      {AIR_PARTICLES.map((particle, index) => (
        <mesh key={index} position={particle.position} scale={particle.size}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={particleColor} transparent opacity={0.28 + humidityRatio * 0.2} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Model({ angle, temperature, humidity, occupied, heaterOn, fanOn, doorOpen, yaw, alarm, animate, isOnline }: { angle: number; temperature: number; humidity: number; occupied: number; heaterOn: boolean; fanOn: boolean; doorOpen: boolean; yaw: number; alarm: boolean; animate: boolean; isOnline: boolean }) {
  const glow = Math.min(2.1, Math.max(0.7, 0.8 + (temperature - 36) * 0.65));

  return (
    <group position={[0, -0.18, 0]} rotation={[0.04, -0.32 + THREE.MathUtils.degToRad(yaw), 0]}>
      <RoundedBox args={[4.35, 3.35, 3.65]} radius={0.22} smoothness={5} castShadow receiveShadow>
        <meshPhysicalMaterial color="#e9f8f5" roughness={0.045} metalness={0.01} transmission={0.94} thickness={0.34} ior={1.46} transparent opacity={0.25} depthWrite={false} clearcoat={1} clearcoatRoughness={0.06} />
      </RoundedBox>
      <RoundedBox args={[3.98, 2.86, 0.06]} radius={0.15} smoothness={4} position={[0, -0.02, -1.77]}>
        <meshStandardMaterial color="#f7f0df" roughness={0.7} transparent opacity={0.62} />
      </RoundedBox>
      <LowerWallPanels />
      <IncubatorLid open={doorOpen} animate={animate} />
      <HeatingLamp enabled={heaterOn} temperature={temperature} alarm={alarm} animate={animate} />
      <VentilationFan enabled={fanOn} animate={animate} />
      <SideLcd angle={angle} temperature={temperature} humidity={humidity} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} isOnline={isOnline} />
      <AirflowParticles fanOn={fanOn} humidity={humidity} animate={animate} />
      <RotatingDisc angle={angle} occupied={occupied} animate={animate} />
      <IncubatorBases />
      <pointLight position={[0, 0.88, 0.9]} color="#ffd86a" intensity={glow} distance={5} />
      <mesh position={[1.35, 0.98, 1.08]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#ffd24a" emissive="#dda83a" emissiveIntensity={glow} />
      </mesh>
    </group>
  );
}

export interface IncubatorSceneProps {
  angle: number;
  temperature: number;
  humidity: number;
  occupied: number;
  heaterOn: boolean;
  fanOn: boolean;
  doorOpen: boolean;
  yaw: number;
  zoom: number;
  alarm: boolean;
  animate: boolean;
  isOnline: boolean;
  compact: boolean;
}

function SceneCamera({ zoom }: { zoom: number }) {
  const { camera } = useThree();

  useEffect(() => {
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    perspectiveCamera.zoom = zoom;
    perspectiveCamera.updateProjectionMatrix();
  }, [camera, zoom]);

  return null;
}

export default function IncubatorScene({ angle, temperature, humidity, occupied, heaterOn, fanOn, doorOpen, yaw, zoom, alarm, animate, isOnline, compact }: IncubatorSceneProps) {
  return (
    <Canvas shadows={compact ? false : "basic"} dpr={compact ? [1, 1.25] : [1, 1.35]} camera={{ position: [7.2, 4.6, 8.9], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: compact ? "low-power" : "high-performance" }}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 6, 4]} intensity={2.1} color="#fff8ea" castShadow />
      <SceneCamera zoom={zoom} />
      <Model angle={angle} temperature={temperature} humidity={humidity} occupied={occupied} heaterOn={heaterOn} fanOn={fanOn} doorOpen={doorOpen} yaw={yaw} alarm={alarm} animate={animate} isOnline={isOnline} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.62, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.1} />
      </mesh>
    </Canvas>
  );
}
