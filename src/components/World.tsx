import React, { useMemo, useEffect, useState } from 'react';
import { Stars, Sparkles, useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Atmosphere } from './Atmosphere';
import Vehicle from './Vehicle';
import { useGameStore, ItemType } from '../store/gameStore';
// External model hosted by user on GitHub raw
const newCityUrl = 'https://raw.githubusercontent.com/legendofarry/models/main/newCity.glb';
import { inputState } from '../store';

function createGrungeTexture(size = 512, pattern = 'noise') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  if (pattern === 'asphalt') {
     ctx.fillStyle = '#111';
     ctx.fillRect(0, 0, size, size);
     for (let i = 0; i < 20000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const v = Math.random();
        ctx.fillStyle = `rgba(255,255,255,${v * 0.15})`;
        ctx.fillRect(x, y, 2, 2);
     }
  } else {
     ctx.fillStyle = '#fff';
     ctx.fillRect(0, 0, size, size);
     for (let i = 0; i < 15000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
     }
     // streaks (leakage/grime)
     for (let i = 0; i < 50; i++) {
       const x = Math.random() * size;
       ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`;
       ctx.fillRect(x, 0, Math.random() * 10, size);
     }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.anisotropy = 4;
  if (pattern === 'asphalt') {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

function createFacadeTexture(baseColor: string, trimColor: string, windowColor: string, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 32000; i++) {
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade}, ${Math.random() * 0.035})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  ctx.strokeStyle = trimColor;
  ctx.lineWidth = 2;
  for (let x = 32; x < size; x += 96) {
    ctx.globalAlpha = 0.28 + Math.random() * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.random() * 18 - 9, size);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (let y = 48; y < size; y += 78) {
    for (let x = 40; x < size; x += 96) {
      const lit = Math.random() > 0.82;
      ctx.fillStyle = lit ? 'rgba(214, 154, 83, 0.38)' : windowColor;
      ctx.fillRect(x, y, 34 + Math.random() * 18, 18 + Math.random() * 8);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(x, y + 20, 44, 3);
    }
  }

  for (let i = 0; i < 46; i++) {
    const x = Math.random() * size;
    ctx.fillStyle = `rgba(24, 20, 17, ${0.08 + Math.random() * 0.16})`;
    ctx.fillRect(x, 0, 6 + Math.random() * 20, size);
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, size, size);
  
  // draw 50 intersecting grass blades
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    const h = 50 + Math.random() * 200;
    const w = 4 + Math.random() * 8;
    
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 50, size - h / 2, x + (Math.random() - 0.5) * 100, size - h);
    ctx.lineWidth = w;
    const colorVal = 30 + Math.random() * 30; // dead/dry
    ctx.strokeStyle = `rgba(${colorVal + 20}, ${colorVal + 10}, ${colorVal}, 0.9)`; // brownish greyish
    ctx.stroke();
  }
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  return tex;
}

const INTERACT_DISTANCE = 3.0;

const FACADE_STYLES = [
  { base: '#5f5b52', trim: '#827769', window: 'rgba(17, 23, 25, 0.58)' },
  { base: '#4e5958', trim: '#738080', window: 'rgba(15, 24, 28, 0.62)' },
  { base: '#6b5d4d', trim: '#8a7962', window: 'rgba(24, 23, 21, 0.58)' },
  { base: '#565b4f', trim: '#77806b', window: 'rgba(18, 25, 23, 0.6)' },
];

function isGroundLikeMesh(mesh: THREE.Mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);
  const widestSide = Math.max(size.x, size.z);
  return widestSide > 10 && size.y < widestSide * 0.16;
}

function getFacadeIndex(mesh: THREE.Mesh, count: number) {
  const box = new THREE.Box3().setFromObject(mesh);
  const seed = Math.abs(Math.floor(box.min.x * 11 + box.min.z * 17 + box.max.y * 5));
  return seed % count;
}

function buildWorldMaterial(
  source: THREE.Material,
  colorMap: THREE.Texture,
  roughnessMap: THREE.Texture,
  tint: string,
  groundLike: boolean,
) {
  const material = source instanceof THREE.MeshStandardMaterial
    ? source.clone()
    : new THREE.MeshStandardMaterial({
        side: source.side,
        transparent: source.transparent,
        opacity: source.opacity,
      });

  const originalMap = material.map;

  if (originalMap) {
    originalMap.colorSpace = THREE.SRGBColorSpace;
    material.color.lerp(new THREE.Color(tint), groundLike ? 0.35 : 0.5);
  } else {
    material.map = colorMap;
    material.color.set('#ffffff');
  }

  material.roughness = groundLike ? 0.92 : 0.78;
  material.roughnessMap = roughnessMap;
  material.metalness = groundLike ? 0.02 : 0.04;
  material.envMapIntensity = 0.25;
  material.needsUpdate = true;

  return material;
}

function LootItem({ id, type, name, position, weight, onPickup }: { id: string, type: ItemType, name: string, position: [number, number, number], weight: number, onPickup: (id: string, item: any) => void }) {
  const ref = React.useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  
  // Animation for floating
  useFrame((state) => {
    if (ref.current) {
       ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;
       ref.current.rotation.y += 0.01;

       // Simple interaction distance check based on camera
       const camPos = state.camera.position;
       const dist = camPos.distanceTo(new THREE.Vector3().copy(ref.current.position));
       
       if (dist < INTERACT_DISTANCE) {
         if (!hovered) setHovered(true);
         // Simulate interaction key parsing via input state (not directly accessible here easily unless we poll)
         if (inputState.interact) {
            onPickup(id, { type, name, weight });
         }
       } else {
         if (hovered) setHovered(false);
       }
    }
  });

  return (
    <group ref={ref} position={position}>
       {/* Visual Representation */}
       <mesh castShadow receiveShadow>
         <boxGeometry args={[0.3, 0.3, 0.3]} />
         <meshStandardMaterial color={type === 'battery' ? '#44aa44' : type === 'medicine' ? '#aa4444' : type === 'water' ? '#4444aa' : '#aaaaaa'} roughness={0.5} />
       </mesh>
       
       {/* Interaction UI Hint */}
       {hovered && (
          <mesh position={[0, 0.5, 0]}>
             <planeGeometry args={[0.8, 0.3]} />
             <meshBasicMaterial color="#ffffff" transparent opacity={0.2} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
       )}
    </group>
  );
}

export function World() {
  const { scene } = useGLTF(newCityUrl);
  const addItem = useGameStore(state => state.addItem);

  const [worldLoot, setWorldLoot] = useState([
     { id: 'world-batt-1', type: 'battery' as ItemType, name: 'Flashlight Battery', weight: 0.2, position: [2, 0.5, -3] as [number, number, number] },
     { id: 'world-batt-2', type: 'battery' as ItemType, name: 'Flashlight Battery', weight: 0.2, position: [-5, 0.5, 5] as [number, number, number] },
     { id: 'world-water-1', type: 'water' as ItemType, name: 'Bottled Water', weight: 0.5, position: [8, 0.5, 2] as [number, number, number] },
     { id: 'world-med-1', type: 'medicine' as ItemType, name: 'First Aid Kit', weight: 1.0, position: [-2, 0.5, -8] as [number, number, number] },
     { id: 'world-scrap-1', type: 'scrap' as ItemType, name: 'Electronics Scrap', weight: 2.0, position: [4, 0.5, 8] as [number, number, number] }
  ]);

  const handlePickup = (id: string, itemInfo: any) => {
     addItem(itemInfo);
     setWorldLoot(prev => prev.filter(i => i.id !== id));
  };

  const { grungeMap, asphaltMap, grassMap, facadeMaps } = useMemo(() => {
    return {
       grungeMap: createGrungeTexture(1024, 'noise'),
       asphaltMap: createGrungeTexture(1024, 'asphalt'),
       grassMap: createGrassTexture(),
       facadeMaps: FACADE_STYLES.map(style => createFacadeTexture(style.base, style.trim, style.window)),
    };
  }, []);

  // Atmosphere & Debris Pass
  useEffect(() => {
    scene.updateMatrixWorld(true);

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (!child.material) return;

        const groundLike = isGroundLikeMesh(child);
        const facadeIndex = getFacadeIndex(child, facadeMaps.length);
        const style = FACADE_STYLES[facadeIndex];
        const colorMap = groundLike ? asphaltMap : facadeMaps[facadeIndex];
        const tint = groundLike ? '#2a2521' : style.base;

        if (Array.isArray(child.material)) {
          child.material = child.material.map(material =>
            buildWorldMaterial(material, colorMap, grungeMap, tint, groundLike)
          );
        } else {
          child.material = buildWorldMaterial(child.material, colorMap, grungeMap, tint, groundLike);
        }
      }
    });

  }, [scene, grungeMap, asphaltMap, facadeMaps]);

  // Procedural debris clusters
  const debrisPositions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 150; i++) {
       arr.push({
         x: (Math.random() - 0.5) * 150,
         y: Math.random() * 0.5,
         z: (Math.random() - 0.5) * 150,
         scale: 0.2 + Math.random() * 1.5,
         rotX: Math.random() * Math.PI,
         rotY: Math.random() * Math.PI,
         rotZ: Math.random() * Math.PI
       });
    }
    return arr;
  }, []);

  const grassPositions = useMemo(() => {
    const arr = [];
    // Increase count now that it is instanced!
    for (let i = 0; i < 2000; i++) {
       arr.push({
         x: (Math.random() - 0.5) * 200,
         y: 0.5,
         z: (Math.random() - 0.5) * 200,
         rotY: Math.random() * Math.PI,
         scale: 1 + Math.random() * 2
       });
    }
    return arr;
  }, []);

  const grassMeshRef = React.useRef<THREE.InstancedMesh>(null);
  
  useEffect(() => {
    if (grassMeshRef.current) {
        const tempObj = new THREE.Object3D();
        grassPositions.forEach((pos, i) => {
            tempObj.position.set(pos.x, pos.y, pos.z);
            tempObj.rotation.set(0, pos.rotY, 0);
            tempObj.scale.set(pos.scale, pos.scale, pos.scale);
            tempObj.updateMatrix();
            grassMeshRef.current!.setMatrixAt(i, tempObj.matrix);
        });
        grassMeshRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [grassPositions]);

  return (
    <>
      <Atmosphere />

      <Sparkles count={500} scale={100} size={2} speed={0.4} opacity={0.1} color="#6a7b8c" position={[0,5,0]} />
      <Sparkles count={200} scale={50} size={4} speed={0.8} opacity={0.2} color="#ffffff" position={[0,5,0]} />

      {/* Load the Custom Map Model */}
      <RigidBody type="fixed" colliders="trimesh">
        <primitive object={scene} position={[0, 0, 0]} scale={[1, 1, 1]} castShadow receiveShadow />
      </RigidBody>

      {/* Example vehicle instance (placed in the city) */}
      <Vehicle id="car-1" position={[6, 0, 6]} />
      
      {/* Ground plane for physics stability and visual base */}
      <RigidBody type="fixed" name="floor" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[400, 1, 400]} />
          <meshStandardMaterial color="#1a1c21" roughness={0.9} map={asphaltMap} roughnessMap={asphaltMap} />
        </mesh>
      </RigidBody>
      
      {/* Clutter/Debris */}
      <group>
        {debrisPositions.map((d, i) => (
          <mesh 
            key={i} 
            position={[d.x, d.y, d.z]} 
            rotation={[d.rotX, d.rotY, d.rotZ]}
            scale={d.scale}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#2d3034" roughness={0.9} map={grungeMap} />
          </mesh>
        ))}
      </group>

      {/* Physics Interactive Loot */}
      <group>
         {worldLoot.map(item => (
            <LootItem
               key={item.id}
               id={item.id}
               type={item.type}
               name={item.name}
               position={item.position}
               weight={item.weight}
               onPickup={handlePickup}
            />
         ))}
      </group>

      {/* Overgrowth / Vegetation (Instanced for Performance) */}
      <instancedMesh ref={grassMeshRef} args={[undefined, undefined, grassPositions.length]} receiveShadow>
         <planeGeometry args={[1.5, 1.5]} />
         <meshStandardMaterial 
            map={grassMap} 
            transparent={true} 
            alphaTest={0.5} 
            side={THREE.DoubleSide} 
            roughness={0.9}
            color="#999999"
         />
      </instancedMesh>
    </>
  );
}

// Preload the map
useGLTF.preload(newCityUrl);
