import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../constants/world';
import WildlifeManager from './WildlifeManager';
import Vehicle from './Vehicle';

interface SavannaMapBuilderProps {
  gridSize?: number; // tiles per axis
  tileSize?: number; // meters per tile
  showGrid?: boolean;
}

export default function SavannaMapBuilder({ gridSize = 6, tileSize = TILE_SIZE, showGrid = false }: SavannaMapBuilderProps) {
  const debug = useGameStore(state => (state as any).collisionDebug) || showGrid;
  const { scene } = useThree();
  const groundSize = gridSize * tileSize;

  // Ground material with optional high-res texture from public/textures/grass_4k.jpg
  const [groundMat, setGroundMat] = useState<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const url = '/textures/grass_4k.jpg';
    loader.load(
      url,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        const repeat = Math.max(1, Math.floor(groundSize / 4));
        tex.repeat.set(repeat, repeat);
        const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
        setGroundMat(m);
      },
      undefined,
      () => {
        // fallback solid material
        setGroundMat(new THREE.MeshStandardMaterial({ color: '#9db86a', roughness: 1 }));
      }
    );
  }, [groundSize]);

  // Scatter trees and rocks procedurally
  const trees = useMemo(() => {
    const count = Math.max(8, Math.floor(gridSize * gridSize * 0.12));
    const out: Array<any> = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * groundSize * 0.9;
      const z = (Math.random() - 0.5) * groundSize * 0.9;
      const trunkH = 1.8 + Math.random() * 2.4;
      const trunkR = 0.12 + Math.random() * 0.18;
      const leavesR = 0.8 + Math.random() * 1.6;
      out.push({ x, z, trunkH, trunkR, leavesR });
    }
    return out;
  }, [gridSize, groundSize]);

  const rocks = useMemo(() => {
    const count = Math.max(6, Math.floor(gridSize * gridSize * 0.06));
    const out: Array<any> = [];
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * groundSize * 0.92;
      const z = (Math.random() - 0.5) * groundSize * 0.92;
      const scale = 0.4 + Math.random() * 1.2;
      out.push({ x, z, scale });
    }
    return out;
  }, [gridSize, groundSize]);

  // vehicle spawn near one edge
  const vehicleSpawn = useMemo(() => {
    return { x: 0, y: 0.5, z: 0 };
  }, []);

  return (
    <group>
      {/* Ground collider */}
      <RigidBody type="fixed" colliders={false} position={[0, -0.02, 0]}>
        <CuboidCollider args={[groundSize * 0.5, 0.05, groundSize * 0.5]} restitution={0} friction={1} />
      </RigidBody>

      {/* Ground visual */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[groundSize, groundSize, 128, 128]} />
        {groundMat ? (
          <primitive object={groundMat} attach="material" />
        ) : (
          <meshStandardMaterial color={'#9db86a'} roughness={1} />
        )}
      </mesh>

      {/* Trees */}
      {trees.map((t, i) => (
        <group key={`tree-${i}`} position={[t.x, 0, t.z]}>
          <RigidBody type="fixed" colliders={false} position={[0, t.trunkH / 2, 0]}>
            <CuboidCollider args={[t.trunkR, t.trunkH / 2, t.trunkR]} restitution={0} friction={0.9} />
          </RigidBody>

          <mesh position={[0, t.trunkH / 2, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[t.trunkR, t.trunkR, t.trunkH, 8]} />
            <meshStandardMaterial color={'#7b5836'} roughness={1} />
          </mesh>

          <mesh position={[0, t.trunkH + t.leavesR * 0.35, 0]} castShadow receiveShadow>
            <coneGeometry args={[t.leavesR, t.leavesR * 1.2, 10]} />
            <meshStandardMaterial color={'#2f7d2a'} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Rocks */}
      {rocks.map((r, i) => (
        <group key={`rock-${i}`} position={[r.x, 0, r.z]}>
          <RigidBody type="fixed" colliders={false} position={[0, r.scale * 0.25, 0]}>
            <CuboidCollider args={[r.scale * 0.6, r.scale * 0.25, r.scale * 0.6]} restitution={0} friction={0.9} />
          </RigidBody>
          <mesh position={[0, r.scale * 0.25, 0]} castShadow receiveShadow>
            <icosahedronGeometry args={[r.scale, 0]} />
            <meshStandardMaterial color={'#8b8b83'} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Wildlife manager: simple prey/predator simulation */}
      <WildlifeManager areaSize={groundSize} numPrey={18} numPredators={3} />

      {/* Vehicle spawn */}
      <group position={[vehicleSpawn.x, vehicleSpawn.y, vehicleSpawn.z]}>
        <Vehicle position={[vehicleSpawn.x, vehicleSpawn.y, vehicleSpawn.z]} />
      </group>
    </group>
  );
}
