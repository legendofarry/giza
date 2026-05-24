import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center, ContactShadows, Environment, useAnimations, useFBX } from '@react-three/drei';
import { Group, MathUtils, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { SkeletonUtils } from 'three-stdlib';
// Load FBX assets at runtime from public to avoid bundling them
const rastaGirlUrl = encodeURI('/assets/models/Barbie.fbx');
const rastaPersonUrl = encodeURI('/assets/models/Qaqk.fbx');
const idleAnimationUrl = encodeURI('/assets/models/Breathing Idle.fbx');

interface ArchetypeModelProps {
  archetype: string;
}

const CHARACTER_CONFIG = {
  rastaGirl: {
    modelUrl: rastaGirlUrl,
    scale: 0.013,
  },
  rastaPerson: {
    modelUrl: rastaPersonUrl,
    scale: 0.0105,
  },
};

function getCharacterConfig(character: string) {
  return CHARACTER_CONFIG[character as keyof typeof CHARACTER_CONFIG] || CHARACTER_CONFIG.rastaGirl;
}

function configureModel(root: Object3D) {
  root.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.roughness = Math.max(material.roughness, 0.65);
          material.metalness = Math.min(material.metalness, 0.1);
        }
      });
    }
  });
}

function CharacterModel({ archetype }: ArchetypeModelProps) {
  const rootRef = useRef<Group>(null);
  const config = getCharacterConfig(archetype);
  const sourceModel = useFBX(config.modelUrl);
  const idleAnimation = useFBX(idleAnimationUrl);
  const model = useMemo(() => SkeletonUtils.clone(sourceModel) as Group, [sourceModel]);

  const clips = useMemo(() => {
    return idleAnimation.animations.map((clip) => {
      const clonedClip = clip.clone();
      clonedClip.name = 'preview';
      return clonedClip;
    });
  }, [idleAnimation.animations]);

  const { actions } = useAnimations(clips, rootRef);

  useEffect(() => {
    configureModel(model);
  }, [model]);

  useEffect(() => {
    const action = actions.preview;
    if (!action) return;

    action.reset().fadeIn(0.25).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions]);

  return (
    <group ref={rootRef} scale={config.scale} rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
    </group>
  );
}

export function ArchetypeModel({ archetype }: ArchetypeModelProps) {
  const groupRef = useRef<Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = MathUtils.lerp(
        groupRef.current.position.y,
        Math.sin(state.clock.elapsedTime) * 0.04,
        0.1,
      );
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.18;
    }
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} castShadow />
      <Environment preset="city" />

      <group ref={groupRef}>
        <Center position={[0, 0, 0]}>
          <CharacterModel archetype={archetype} />
        </Center>
      </group>

      <ContactShadows position={[0, -1.15, 0]} opacity={0.6} scale={10} blur={2.5} far={4} color="#000000" />
    </>
  );
}

useFBX.preload(rastaGirlUrl);
useFBX.preload(rastaPersonUrl);
useFBX.preload(idleAnimationUrl);
