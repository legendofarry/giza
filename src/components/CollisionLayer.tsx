import React, { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

function mergeBoxes(boxes: THREE.Box3[], maxGap = 1.0) {
  const remaining = boxes.map(b => b.clone());
  const result: THREE.Box3[] = [];

  while (remaining.length > 0) {
    const box = remaining.pop()!;
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = remaining.length - 1; i >= 0; --i) {
        const other = remaining[i];
        const expanded = box.clone().expandByScalar(maxGap);
        if (expanded.intersectsBox(other)) {
          box.min.min(other.min);
          box.max.max(other.max);
          remaining.splice(i, 1);
          merged = true;
        }
      }
    }
    result.push(box);
  }

  return result;
}

export default function CollisionLayer({ scene }: { scene?: THREE.Object3D | null }) {
  const debug = useGameStore(state => (state as any).collisionDebug);

  const colliders = useMemo(() => {
    if (!scene) return [] as { center: THREE.Vector3; size: THREE.Vector3; type: 'generic' | 'road' }[];
    scene.updateMatrixWorld(true);

    // Compute scene bounds to adapt heuristics to model units/scale
    const sceneBox = new THREE.Box3().setFromObject(scene);
    if (!sceneBox || sceneBox.isEmpty()) return [] as { center: THREE.Vector3; size: THREE.Vector3; type: 'generic' | 'road' }[];
    const sceneSize = new THREE.Vector3();
    sceneBox.getSize(sceneSize);
    const sceneMax = Math.max(sceneSize.x, sceneSize.y, sceneSize.z);

    // Adapt thresholds based on scene size so small/large models still get colliders
    const minGeomSize = Math.max(0.01, Math.min(0.5, sceneMax * 0.002));
    const mergeGap = Math.max(0.1, sceneMax * 0.005);
    const roadHeightThreshold = Math.max(0.08, sceneMax * 0.005);

    const boxes: THREE.Box3[] = [];

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh || !mesh.isMesh) return;
      if (!mesh.visible) return;

      const name = (mesh.name || '').toLowerCase();
      // ignore helpers, decoration, or explicit no-collision markers
      if (/(helper|guide|no[-_ ]?collision|nocollide|decor|decoration|interior|proxy|collision_ignore)/i.test(name)) return;

      // compute world bounding box
      const box = new THREE.Box3().setFromObject(mesh);
      if (!box || box.isEmpty()) return;

      const size = new THREE.Vector3();
      box.getSize(size);

      // skip tiny decorative geometry based on scene scale
      if (size.x < minGeomSize && size.y < minGeomSize && size.z < minGeomSize) return;

      boxes.push(box);
    });

    // Merge nearby/overlapping boxes to reduce collider count
    const merged = mergeBoxes(boxes, mergeGap);

    // Map to center+size with road detection scaled to scene extents
    return merged.map((b) => {
      const center = new THREE.Vector3();
      b.getCenter(center);
      const size = new THREE.Vector3();
      b.getSize(size);
      // classify road-like flat colliders
      const type = size.y < roadHeightThreshold && (size.x > sceneMax * 0.03 || size.z > sceneMax * 0.03) ? 'road' : 'generic';
      return { center, size, type };
    });
  }, [scene]);

  if (!scene) return null;

  return (
    <group>
      {colliders.map((c, i) => (
        <group key={`collider-${i}`} position={[c.center.x, c.center.y, c.center.z]}>
          <RigidBody type="fixed" colliders={false}>
            <CuboidCollider
              args={[Math.max(0.1, c.size.x * 0.5), Math.max(0.1, c.size.y * 0.5), Math.max(0.1, c.size.z * 0.5)]}
              restitution={0}
              friction={c.type === 'road' ? 0.0 : 0.2}
            />
          </RigidBody>

          {debug && (
            <mesh>
              <boxGeometry args={[Math.max(0.1, c.size.x), Math.max(0.1, c.size.y), Math.max(0.1, c.size.z)]} />
              <meshBasicMaterial color={c.type === 'road' ? 'lime' : 'orangered'} wireframe opacity={0.45} transparent />
            </mesh>
          )}
        </group>
      ))}

      {/* World boundary guard (soft) - uses scene bounds */}
      {!debug ? null : (
        <group>
          {/* optional extra debug can go here */}
        </group>
      )}
    </group>
  );
}
