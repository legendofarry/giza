import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Animal = {
  id: number;
  type: 'prey' | 'predator';
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  alive: boolean;
};

export default function WildlifeManager({ areaSize = 48, numPrey = 12, numPredators = 3 }:
  { areaSize?: number; numPrey?: number; numPredators?: number }) {
  const animalsRef = useRef<Animal[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const arr: Animal[] = [];
    let id = 1;
    for (let i = 0; i < numPrey; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * areaSize, 0, (Math.random() - 0.5) * areaSize);
      arr.push({ id: id++, type: 'prey', pos: p, vel: new THREE.Vector3(), alive: true });
    }
    for (let i = 0; i < numPredators; i++) {
      const p = new THREE.Vector3((Math.random() - 0.5) * areaSize, 0, (Math.random() - 0.5) * areaSize);
      arr.push({ id: id++, type: 'predator', pos: p, vel: new THREE.Vector3(), alive: true });
    }
    animalsRef.current = arr;

    return () => { mountedRef.current = false; };
  }, [areaSize, numPrey, numPredators]);

  useFrame((state, delta) => {
    const animals = animalsRef.current;
    if (!animals || animals.length === 0) return;

    // Simple behavior parameters
    const preyWanderSpeed = 1.6;
    const preyFleeSpeed = 6.0;
    const predatorWanderSpeed = 1.8;
    const predatorChaseSpeed = 6.5;
    const detectionRadius = 8.0;
    const catchDistance = 0.9;

    // Update predators first: find nearest prey
    const preys = animals.filter(a => a.type === 'prey' && a.alive);
    const predators = animals.filter(a => a.type === 'predator' && a.alive);

    // Predators chase nearest prey
    for (const predator of predators) {
      let nearest: Animal | null = null;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const prey of preys) {
        const d = predator.pos.distanceTo(prey.pos);
        if (d < nearestDist) { nearestDist = d; nearest = prey; }
      }
      if (nearest && nearestDist < detectionRadius) {
        const dir = new THREE.Vector3().subVectors(nearest.pos, predator.pos).setY(0).normalize();
        predator.vel.copy(dir.multiplyScalar(predatorChaseSpeed));
        // catch
        if (nearestDist < catchDistance) {
          nearest.alive = false; // prey is taken
        }
      } else {
        // wander
        if (Math.random() < 0.02) {
          const ang = Math.random() * Math.PI * 2;
          predator.vel.set(Math.cos(ang) * predatorWanderSpeed, 0, Math.sin(ang) * predatorWanderSpeed);
        }
      }
    }

    // Prey behavior: flee if predator close, otherwise wander/graze
    for (const prey of preys) {
      if (!prey.alive) continue;
      // detect nearest predator
      let nearestPred: Animal | null = null;
      let predDist = Number.POSITIVE_INFINITY;
      for (const pred of predators) {
        const d = prey.pos.distanceTo(pred.pos);
        if (d < predDist) { predDist = d; nearestPred = pred; }
      }

      if (nearestPred && predDist < detectionRadius) {
        // flee
        const dir = new THREE.Vector3().subVectors(prey.pos, nearestPred.pos).setY(0).normalize();
        prey.vel.copy(dir.multiplyScalar(preyFleeSpeed));
      } else {
        // slow wander/graze
        if (Math.random() < 0.02) {
          const ang = Math.random() * Math.PI * 2;
          prey.vel.set(Math.cos(ang) * preyWanderSpeed, 0, Math.sin(ang) * preyWanderSpeed);
        }
      }
    }

    // Integrate positions and clamp to area
    const half = areaSize * 0.5;
    for (const a of animals) {
      if (!a.alive) continue;
      const move = a.vel.clone().multiplyScalar(delta);
      a.pos.add(move);
      // keep inside bounds
      a.pos.x = Math.max(-half + 1, Math.min(half - 1, a.pos.x));
      a.pos.z = Math.max(-half + 1, Math.min(half - 1, a.pos.z));
      // slight damping for wander
      a.vel.multiplyScalar(0.92);
    }
  });

  // Render animals (simple low-poly shapes)
  const animals = animalsRef.current;

  return (
    <group>
      {animals.map((a) => (
        a.alive ? (
          <group key={`animal-${a.id}`} position={[a.pos.x, 0.08, a.pos.z]}>
            {a.type === 'prey' ? (
              <mesh castShadow>
                <sphereGeometry args={[0.25, 8, 6]} />
                <meshStandardMaterial color={'#cfa66b'} roughness={1} />
              </mesh>
            ) : (
              <mesh castShadow>
                <capsuleGeometry args={[0.28, 0.3, 4, 8]} />
                <meshStandardMaterial color={'#5a3b2a'} roughness={1} />
              </mesh>
            )}
          </group>
        ) : null
      ))}
    </group>
  );
}
