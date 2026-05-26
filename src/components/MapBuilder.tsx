import React, { useMemo } from 'react';
import * as THREE from 'three';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useThree } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import { TILE_SIZE, SIDEWALK_WIDTH, CURB_HEIGHT } from '../constants/world';

type TileType = 'road' | 'intersection' | 'turn' | 'tjunction' | 'building' | 'empty' | 'sidewalk' | 'park';

export interface TileDef {
  x: number;
  z: number;
  type: TileType;
  rotation?: 0 | 90 | 180 | 270;
  props?: Record<string, any>;
}

interface MapBuilderProps {
  tiles?: TileDef[];
  tileSize?: number; // meters (1 unit = 1 meter)
  origin?: [number, number, number];
  showGrid?: boolean;
}

// Default tile size is driven by global world constants
const DEFAULT_TILE = TILE_SIZE;

function RoadTile({ tileSize, debug = false }: { tileSize: number; debug?: boolean }) {
  const thickness = 0.18;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, -thickness / 2, 0]}>
        <CuboidCollider args={[tileSize * 0.5, thickness * 0.5, tileSize * 0.5]} restitution={0} friction={0.06} />
      </RigidBody>

      <mesh position={[0, -thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[tileSize, thickness, tileSize]} />
        <meshStandardMaterial color={'#2b2b2b'} roughness={1} metalness={0} />
      </mesh>

      {debug && (
        <mesh position={[0, -thickness / 2, 0]}>
          <boxGeometry args={[tileSize, thickness, tileSize]} />
          <meshBasicMaterial color={'lime'} wireframe opacity={0.25} transparent />
        </mesh>
      )}
    </group>
  );
}

function SidewalkTile({ tileSize, debug = false }: { tileSize: number; debug?: boolean }) {
  const thickness = 0.12;
  const curbH = 0.08;
  const curbW = tileSize * 0.12;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, -thickness / 2, 0]}>
        <CuboidCollider args={[tileSize * 0.5, thickness * 0.5, tileSize * 0.5]} restitution={0} friction={0.8} />
      </RigidBody>

      <mesh position={[0, -thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[tileSize, thickness, tileSize]} />
        <meshStandardMaterial color={'#a8a8a8'} roughness={1} />
      </mesh>

      {/* optional curb visual */}
      <mesh position={[tileSize / 2 - curbW / 2, -thickness / 2 + curbH / 2, 0]}>
        <boxGeometry args={[curbW, curbH, tileSize]} />
        <meshStandardMaterial color={'#888'} roughness={1} />
      </mesh>

      {debug && (
        <mesh position={[0, -thickness / 2, 0]}>
          <boxGeometry args={[tileSize, thickness, tileSize]} />
          <meshBasicMaterial color={'orangered'} wireframe opacity={0.2} transparent />
        </mesh>
      )}
    </group>
  );
}

function BuildingTile({ tileSize, debug = false }: { tileSize: number; debug?: boolean }) {
  const groundThickness = 0.18;
  const height = 6.0;

  return (
    <group>
      {/* ground base */}
      <RigidBody type="fixed" colliders={false} position={[0, -groundThickness / 2, 0]}>
        <CuboidCollider args={[tileSize * 0.5, groundThickness * 0.5, tileSize * 0.5]} restitution={0} friction={0.9} />
      </RigidBody>

      <mesh position={[0, -groundThickness / 2, 0]} receiveShadow>
        <boxGeometry args={[tileSize, groundThickness, tileSize]} />
        <meshStandardMaterial color={'#d9c7b7'} roughness={1} />
      </mesh>

      {/* building block (visual + blocking collider) */}
      <RigidBody type="fixed" colliders={false} position={[0, height / 2, 0]}>
        <CuboidCollider args={[tileSize * 0.5, height / 2, tileSize * 0.5]} restitution={0} friction={0.9} />
      </RigidBody>

      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[tileSize * 0.92, height, tileSize * 0.92]} />
        <meshStandardMaterial color={'#b07b6a'} roughness={1} />
      </mesh>

      {debug && (
        <group>
          <mesh position={[0, -groundThickness / 2, 0]}>
            <boxGeometry args={[tileSize, groundThickness, tileSize]} />
            <meshBasicMaterial color={'yellow'} wireframe opacity={0.2} transparent />
          </mesh>
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[tileSize * 0.92, height, tileSize * 0.92]} />
            <meshBasicMaterial color={'red'} wireframe opacity={0.18} transparent />
          </mesh>
        </group>
      )}
    </group>
  );
}

function ParkTile({ tileSize, debug = false }: { tileSize: number; debug?: boolean }) {
  const thickness = 0.08;
  return (
    <group>
      <RigidBody type="fixed" colliders={false} position={[0, -thickness / 2, 0]}>
        <CuboidCollider args={[tileSize * 0.5, thickness * 0.5, tileSize * 0.5]} restitution={0} friction={0.9} />
      </RigidBody>

      <mesh position={[0, -thickness / 2, 0]} receiveShadow>
        <boxGeometry args={[tileSize, thickness, tileSize]} />
        <meshStandardMaterial color={'#3f7a3f'} roughness={1} />
      </mesh>

      {debug && (
        <mesh position={[0, -thickness / 2, 0]}>
          <boxGeometry args={[tileSize, thickness, tileSize]} />
          <meshBasicMaterial color={'green'} wireframe opacity={0.25} transparent />
        </mesh>
      )}
    </group>
  );
}

export default function MapBuilder({ tiles, tileSize = DEFAULT_TILE, origin = [0, 0, 0], showGrid = false }: MapBuilderProps) {
  const debug = useGameStore(state => (state as any).collisionDebug);
  const { scene } = useThree();

  const finalTiles = useMemo(() => {
    if (tiles && tiles.length > 0) return tiles;

    // default small cross layout (5x5) with center roads
    const out: TileDef[] = [];
    const range = [-2, -1, 0, 1, 2];
    for (const z of range) {
      for (const x of range) {
        const isCenterRow = z === 0;
        const isCenterCol = x === 0;
        let type: TileType = 'empty';
        if (isCenterRow && isCenterCol) type = 'intersection';
        else if (isCenterRow) type = 'road';
        else if (isCenterCol) type = 'road';
        else if (Math.abs(x) === 2 || Math.abs(z) === 2) type = 'building';
        else type = 'park';

        out.push({ x, z, type, rotation: 0 });
      }
    }
    return out;
  }, [tiles]);

  return (
    <group>
      {finalTiles.map((t, i) => {
        const posX = origin[0] + t.x * tileSize;
        const posZ = origin[2] + t.z * tileSize;
        const rot = ((t.rotation ?? 0) * Math.PI) / 180;

        let content: React.ReactNode = null;
        switch (t.type) {
          case 'road':
          case 'intersection':
            content = <RoadTile tileSize={tileSize} debug={debug} />;
            break;
          case 'sidewalk':
            content = <SidewalkTile tileSize={tileSize} debug={debug} />;
            break;
          case 'building':
            content = <BuildingTile tileSize={tileSize} debug={debug} />;
            break;
          case 'park':
            content = <ParkTile tileSize={tileSize} debug={debug} />;
            break;
          default:
            content = <ParkTile tileSize={tileSize} debug={debug} />;
        }

        return (
          <group key={`tile-${i}`} position={[posX, 0, posZ]} rotation={[0, rot, 0]}>
            {content}
            {showGrid && (
              <mesh position={[0, 0.01, 0]}>
                <boxGeometry args={[tileSize, 0.02, tileSize]} />
                <meshBasicMaterial color="#000000" wireframe opacity={0.06} transparent />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
