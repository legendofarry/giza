import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useAnimations, useFBX } from '@react-three/drei';
import { Vector3, Euler, Group, SpotLight, PointLight, Mesh, MeshStandardMaterial, Object3D } from 'three';
import * as THREE from 'three';
import { inputState, playerState } from '../store';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { SkeletonUtils } from 'three-stdlib';
import rastaGirlUrl from '../assets/models/Barbie.fbx?url';
import rastaPersonUrl from '../assets/models/Qaqk.fbx?url';
import idleAnimationUrl from '../assets/models/Breathing Idle.fbx?url';
import walkAnimationUrl from '../assets/models/Walking.fbx?url';
import runAnimationUrl from '../assets/models/Fast Run.fbx?url';

const CHARACTER_CONFIG = {
  rastaGirl: {
    modelUrl: rastaGirlUrl,
    scale: 0.0101, // ~1.68m tall from the source FBX bounds.
  },
  rastaPerson: {
    modelUrl: rastaPersonUrl,
    scale: 0.00885, // ~1.78m tall from the source FBX bounds.
  },
};

function getCharacterConfig(character: string) {
  return CHARACTER_CONFIG[character as keyof typeof CHARACTER_CONFIG] || CHARACTER_CONFIG.rastaGirl;
}

function configureCharacter(root: Object3D) {
  root.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof MeshStandardMaterial) {
          material.roughness = Math.max(material.roughness, 0.65);
          material.metalness = Math.min(material.metalness, 0.08);
        }
      });
    }
  });
}

function PlayerAvatar({
  isMovingRef,
  isSprintingRef,
}: {
  isMovingRef: React.MutableRefObject<boolean>;
  isSprintingRef: React.MutableRefObject<boolean>;
}) {
  const rootRef = useRef<Group>(null);
  const activeActionRef = useRef('idle');
  const config = getCharacterConfig(playerState.character || playerState.archetype);
  const sourceModel = useFBX(config.modelUrl);
  const idleAnimation = useFBX(idleAnimationUrl);
  const walkAnimation = useFBX(walkAnimationUrl);
  const runAnimation = useFBX(runAnimationUrl);
  const model = useMemo(() => SkeletonUtils.clone(sourceModel) as Group, [sourceModel]);

  const clips = useMemo(() => {
    const [idleClip] = idleAnimation.animations;
    const [walkClip] = walkAnimation.animations;
    const [runClip] = runAnimation.animations;

    return [
      ...(idleClip ? [idleClip.clone()] : []),
      ...(walkClip ? [walkClip.clone()] : []),
      ...(runClip ? [runClip.clone()] : []),
    ].map((clip, index) => {
      clip.name = index === 0 ? 'idle' : index === 1 ? 'walk' : 'run';
      return clip;
    });
  }, [idleAnimation.animations, walkAnimation.animations, runAnimation.animations]);

  const { actions } = useAnimations(clips, rootRef);

  useEffect(() => {
    configureCharacter(model);
  }, [model]);

  useEffect(() => {
    const action = actions.idle;
    if (!action) return;

    activeActionRef.current = 'idle';
    action.reset().fadeIn(0.18).play();
    return () => {
      action.fadeOut(0.18);
    };
  }, [actions]);

  useFrame(() => {
    const nextAction = isMovingRef.current
      ? isSprintingRef.current
        ? 'run'
        : 'walk'
      : 'idle';

    if (nextAction === activeActionRef.current) return;

    const previousAction = actions[activeActionRef.current];
    const action = actions[nextAction] || actions.idle;
    if (!action) return;

    previousAction?.fadeOut(0.16);
    action.reset().fadeIn(0.16).play();
    activeActionRef.current = nextAction;
  });

  return (
    <group ref={rootRef} scale={config.scale} rotation={[0, Math.PI, 0]}>
      <primitive object={model} />
    </group>
  );
}

export function Player() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const playerRef = useRef<Group>(null);
  const pitchRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const { camera } = useThree();
  const gameStore = useGameStore();
  
  const flashlightObjRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<PointLight>(null);
  
  // Player state
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const euler = useRef(new Euler(0, 0, 0, 'YXZ'));
  const isMovingRef = useRef(false);
  const isSprintingRef = useRef(false);
  
  const speed = 5.0; // base speed
  const sprintMultiplier = 1.8;
  const rotationSensitivity = 2.0;

  useEffect(() => {
    // Add camera to pitch group to control vertical look
    if (pitchRef.current) {
      pitchRef.current.add(camera);
      camera.position.set(0, 0, 0); // Origin, since pitchRef will be at eye level
    }
    return () => {
      if (pitchRef.current) {
        pitchRef.current.remove(camera);
      }
    };
  }, [camera]);

  useFrame((state, delta) => {
    if (!pitchRef.current || !rigidBodyRef.current || !playerRef.current) return;

    const isThirdPerson = gameStore.cameraMode === 'third-person';

    // 1. Rotation (Look)
    const effectiveRotationSens = rotationSensitivity * gameStore.cameraSensitivity;
    euler.current.y -= inputState.look.x * effectiveRotationSens * delta;
    euler.current.x -= inputState.look.y * effectiveRotationSens * delta;
    // Clamp pitch
    const minPitch = isThirdPerson ? -0.9 : -Math.PI / 2 + 0.1;
    const maxPitch = isThirdPerson ? 0.35 : Math.PI / 2 - 0.1;
    euler.current.x = Math.max(minPitch, Math.min(maxPitch, euler.current.x));

    pitchRef.current.quaternion.setFromEuler(new Euler(euler.current.x, euler.current.y, 0));

    // 2. Movement
    const moveX = inputState.move.x;
    const moveZ = inputState.move.y;

    const currentSpeed = speed * (inputState.sprint ? sprintMultiplier : 1.0);

    direction.current.set(moveX, 0, moveZ).normalize();
    isMovingRef.current = direction.current.length() > 0.1;
    isSprintingRef.current = inputState.sprint && isMovingRef.current;

    if (direction.current.length() > 0) {
      // Apply player rotation to movement direction
      direction.current.applyEuler(new Euler(0, euler.current.y, 0));
      
      velocity.current.x = direction.current.x * currentSpeed;
      velocity.current.z = direction.current.z * currentSpeed;
    } else {
      // Damping
      velocity.current.x *= 0.5;
      velocity.current.z *= 0.5;
    }

    // Apply movement physics
    const currentLinVel = rigidBodyRef.current.linvel();
    rigidBodyRef.current.setLinvel(
      { x: velocity.current.x, y: currentLinVel.y, z: velocity.current.z }, 
      true
    );

    // Sync non-physics playerRef to rigidBody output position so children update
    const translation = rigidBodyRef.current.translation();
    playerRef.current.position.copy(translation as Vector3);
    if (bodyRef.current) {
      bodyRef.current.rotation.y = euler.current.y;
    }

    const targetCameraPosition = isThirdPerson
      ? new Vector3(0, 0.22, 4.1)
      : new Vector3(0, 0, 0);
    camera.position.lerp(targetCameraPosition, 1 - Math.exp(-10 * delta));
    
    // Dynamic FOV for sprinting
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (perspectiveCamera.fov !== undefined && gameStore.sprintShakeEnabled) {
      const baseFov = isThirdPerson ? 66 : 70;
      const sprintFov = isThirdPerson ? 72 : 80;
      const targetFov = inputState.sprint && direction.current.length() > 0 ? sprintFov : baseFov;
      perspectiveCamera.fov += (targetFov - perspectiveCamera.fov) * 5 * delta;
      perspectiveCamera.updateProjectionMatrix();
    } else if (perspectiveCamera.fov !== undefined && !gameStore.sprintShakeEnabled) {
      perspectiveCamera.fov = isThirdPerson ? 66 : 70;
      perspectiveCamera.updateProjectionMatrix();
    }

    // Flashlight logic
    if (flashlightObjRef.current) {
        const targetIntensity = gameStore.flashlightOn && gameStore.flashlightBattery > 0 ? 120 : 0;
        flashlightObjRef.current.intensity += (targetIntensity - flashlightObjRef.current.intensity) * 15 * delta;
        
        // Flicker effect when low battery
        if (gameStore.flashlightOn && gameStore.flashlightBattery < 20 && gameStore.flashlightBattery > 0) {
            flashlightObjRef.current.intensity += (Math.random() - 0.5) * 30;
        }

        // Slight weapon/flashlight sway
        const speedRatio = Math.sqrt(velocity.current.x**2 + velocity.current.z**2) / currentSpeed;
        const time = state.clock.getElapsedTime();
        if (speedRatio > 0.1) {
            const sway = Math.sin(time * 10) * 0.05 * speedRatio;
            flashlightObjRef.current.position.x = 0.2 + sway;
            flashlightObjRef.current.position.y = -0.2 - Math.abs(sway);
        } else {
            flashlightObjRef.current.position.x += (0.2 - flashlightObjRef.current.position.x) * 5 * delta;
            flashlightObjRef.current.position.y += (-0.2 - flashlightObjRef.current.position.y) * 5 * delta;
        }
    }

    if (fillLightRef.current) {
        const targetFill = gameStore.flashlightOn && gameStore.flashlightBattery > 0 ? 2.5 : 0;
        fillLightRef.current.intensity += (targetFill - fillLightRef.current.intensity) * 15 * delta;
    }

    // Animate camera sway and bobbing
    const speedRatio = Math.sqrt(velocity.current.x**2 + velocity.current.z**2) / currentSpeed;
    const time = state.clock.getElapsedTime();
    const restingEyeHeight = isThirdPerson ? 1.48 : 1.6;
    if (speedRatio > 0.1 && gameStore.headBobEnabled) {
       const bobPhase = time * (inputState.sprint ? 15 : 10);
       pitchRef.current.position.y = restingEyeHeight + Math.sin(bobPhase) * (isThirdPerson ? 0.025 : 0.05);
       // Sway
       camera.rotation.z = isThirdPerson ? 0 : Math.sin(time * 5) * 0.02 * speedRatio;
    } else {
       // Idle sway
       pitchRef.current.position.y += (restingEyeHeight - pitchRef.current.position.y) * 5 * delta;
       camera.rotation.z += (0 - camera.rotation.z) * 5 * delta;
       if (gameStore.headBobEnabled && !isThirdPerson) {
           pitchRef.current.position.y += Math.sin(time * 2) * 0.005; // Ambient breathing
       }
    }
  });

  return (
    <>
      <RigidBody 
        ref={rigidBodyRef} 
        colliders={false} 
        mass={1} 
        type="dynamic" 
        position={[0, 10, 0]} 
        enabledRotations={[false, false, false]}
      >
        <CapsuleCollider args={[0.55, 0.35]} position={[0, 0.9, 0]} />
      </RigidBody>

      <group ref={playerRef}>
        <group ref={bodyRef}>
          {gameStore.cameraMode === 'third-person' && (
            <PlayerAvatar isMovingRef={isMovingRef} isSprintingRef={isSprintingRef} />
          )}
        </group>

        {/* Head/Camera node */}
        <group ref={pitchRef} position={[0, 1.6, 0]}>
           {/* Weak fill light */}
           <pointLight ref={fillLightRef} position={[0, 0, 0]} intensity={0} distance={10} decay={2} color="#a0c0df" />
           {/* High-Quality Tactical Flashlight */}
           <spotLight
              ref={flashlightObjRef}
              position={[0.2, -0.2, 0]}
              angle={0.5}
              penumbra={0.4}
              intensity={0}
              distance={60}
              decay={1.5}
              castShadow
              shadow-bias={-0.001}
              shadow-mapSize={[512, 512]}
              color="#fff0e0"
           >
              <object3D position={[0, 0, -1]} attach="target" />
           </spotLight>
        </group>
      </group>
    </>
  );
}
