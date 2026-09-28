'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import {
  AdaptiveDpr,
  Environment,
  Float,
  Lightformer,
  MeshTransmissionMaterial,
  PerformanceMonitor,
} from '@react-three/drei';
import { useRef, useState } from 'react';
import type { Group, Mesh } from 'three';

// Brand colours of the platforms Podo AI manages
const PLATFORMS = [
  { name: 'Facebook', color: '#1877f2' },
  { name: 'Instagram', color: '#e1306c' },
  { name: 'WhatsApp', color: '#25d366' },
  { name: 'LinkedIn', color: '#0a66c2' },
  { name: 'YouTube', color: '#ff0000' },
  { name: 'Google', color: '#fbbc04' },
];

function Orb({ quality }: { quality: 'high' | 'low' }) {
  const ref = useRef<Mesh>(null);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.15;
    // Lean gently towards the pointer
    ref.current.rotation.x += (state.pointer.y * 0.3 - ref.current.rotation.x) * 0.05;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.35, 12]} />
        <MeshTransmissionMaterial
          samples={quality === 'high' ? 8 : 3}
          resolution={quality === 'high' ? 512 : 256}
          thickness={1.2}
          roughness={0.08}
          chromaticAberration={0.35}
          anisotropy={0.3}
          distortion={0.35}
          distortionScale={0.4}
          temporalDistortion={0.15}
          color="#b9c8ff"
          backside
        />
      </mesh>
      {/* Glowing core */}
      <mesh scale={0.45}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#7c8dff" toneMapped={false} />
      </mesh>
    </Float>
  );
}

function OrbitingPlatforms() {
  const group = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.35;
    group.current.rotation.z += (state.pointer.x * 0.25 - group.current.rotation.z) * 0.04;
  });

  return (
    <group ref={group} rotation={[0.35, 0, 0]}>
      {PLATFORMS.map((p, i) => {
        const angle = (i / PLATFORMS.length) * Math.PI * 2;
        const radius = 2.4;
        return (
          <Float key={p.name} speed={2} floatIntensity={0.6} rotationIntensity={1}>
            <mesh position={[Math.cos(angle) * radius, Math.sin(angle * 2) * 0.3, Math.sin(angle) * radius]}>
              <boxGeometry args={[0.38, 0.38, 0.38]} />
              <meshStandardMaterial
                color={p.color}
                emissive={p.color}
                emissiveIntensity={0.6}
                roughness={0.25}
                metalness={0.4}
              />
            </mesh>
          </Float>
        );
      })}
      {/* Orbit ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.4, 0.006, 8, 160]} />
        <meshBasicMaterial color="#8eb6ff" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export default function HeroScene() {
  const [quality, setQuality] = useState<'high' | 'low'>('high');

  return (
    <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 7], fov: 45 }} gl={{ antialias: true, alpha: true }}>
      <PerformanceMonitor onDecline={() => setQuality('low')} />
      <AdaptiveDpr pixelated />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 5, 3]} intensity={1.5} />
      <Orb quality={quality} />
      <OrbitingPlatforms />
      {/* Built-in light rig — no external HDR download */}
      <Environment resolution={256}>
        <Lightformer form="ring" intensity={4} color="#3b6bff" position={[0, 3, -4]} scale={4} />
        <Lightformer form="rect" intensity={3} color="#a855f7" position={[-4, -1, 2]} scale={[3, 6, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffffff" position={[4, 2, 2]} scale={[2, 4, 1]} />
      </Environment>
    </Canvas>
  );
}
