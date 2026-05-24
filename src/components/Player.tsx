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
  // Smoothed input + head/body refs for grounded camera
  const smoothedLookRef = React.useRef({ x: 0, y: 0 });
  const headYawRef = React.useRef(euler.current.y);
  const headPitchRef = React.useRef(euler.current.x);
  const bodyYawRef = React.useRef(euler.current.y);
  const raycasterRef = React.useRef(new THREE.Raycaster());
  const lastCollisionCheckRef = React.useRef(0);
  const cachedCollisionRef = React.useRef<Vector3 | null>(null);
  const collidablesRef = React.useRef<Object3D[]>([]);
  const collidableBuildTimeRef = React.useRef<number>(0);

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

    // 1) Smoothed look input to reduce touch jitter
    const lookSmoothing = 12.0;
    smoothedLookRef.current.x += (inputState.look.x - smoothedLookRef.current.x) * Math.min(1, lookSmoothing * delta);
    smoothedLookRef.current.y += (inputState.look.y - smoothedLookRef.current.y) * Math.min(1, lookSmoothing * delta);

    const effectiveRotationSens = rotationSensitivity * gameStore.cameraSensitivity;

    // Integrate to head yaw/pitch
    headYawRef.current -= smoothedLookRef.current.x * effectiveRotationSens * delta;
    headPitchRef.current -= smoothedLookRef.current.y * effectiveRotationSens * delta;

    // Clamp pitch to realistic human limits
    const maxUp = THREE.MathUtils.degToRad(70);
    const maxDown = -THREE.MathUtils.degToRad(55);
    headPitchRef.current = Math.max(maxDown, Math.min(maxUp, headPitchRef.current));

    // Head yaw relative to body with limit
    const maxHeadYaw = THREE.MathUtils.degToRad(60);
    const normalize = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const relativeYaw = normalize(headYawRef.current - bodyYawRef.current);
    const clampedRelative = Math.max(-maxHeadYaw, Math.min(maxHeadYaw, relativeYaw));
    const headYawAbsolute = bodyYawRef.current + clampedRelative;

    // Body follow / alignment
    const bodyFollowSpeed = 3.0; // when exceeding head yaw limit
    const bodyAlignSpeed = 0.6; // passive realignment
    if (Math.abs(relativeYaw) > maxHeadYaw * 0.98) {
      const bodyTarget = headYawRef.current - Math.sign(relativeYaw) * maxHeadYaw;
      const yawDelta = normalize(bodyTarget - bodyYawRef.current);
      bodyYawRef.current += yawDelta * Math.min(1, bodyFollowSpeed * delta);
    } else {
      const yawDelta = normalize(headYawAbsolute - bodyYawRef.current);
      bodyYawRef.current += yawDelta * Math.min(1, bodyAlignSpeed * delta);
    }

    // Apply rotations
    bodyRef.current.rotation.y = bodyYawRef.current;
    pitchRef.current.quaternion.setFromEuler(new Euler(headPitchRef.current, headYawAbsolute, 0));

    // 2) Movement with survival weighting
    const moveX = inputState.move.x;
    const moveZ = inputState.move.y;

    const localMove = new Vector3(moveX, 0, moveZ);
    const localLen = localMove.length();
    direction.current.set(moveX, 0, moveZ);
    if (localLen > 0.001) direction.current.normalize();

    isMovingRef.current = localLen > 0.1;
    isSprintingRef.current = inputState.sprint && isMovingRef.current;

    // Speed modifiers: forward fastest, strafing slower, back slowest
    const forwardDot = -direction.current.z; // joystick forward is negative y
    let moveMultiplier = 1.0;
    if (forwardDot > 0.7) moveMultiplier = 1.0;
    else if (forwardDot < -0.7) moveMultiplier = 0.5;
    else moveMultiplier = 0.72;

    const currentSpeed = speed * moveMultiplier * (inputState.sprint ? sprintMultiplier : 1.0);

    if (direction.current.length() > 0) {
      direction.current.applyEuler(new Euler(0, headYawAbsolute, 0));
      velocity.current.x = direction.current.x * currentSpeed;
      velocity.current.z = direction.current.z * currentSpeed;
    } else {
      velocity.current.x *= 0.5;
      velocity.current.z *= 0.5;
    }

    // Apply movement physics
    const currentLinVel = rigidBodyRef.current.linvel();
    rigidBodyRef.current.setLinvel({ x: velocity.current.x, y: currentLinVel.y, z: velocity.current.z }, true);

    // Sync position
    const translation = rigidBodyRef.current.translation();
    playerRef.current.position.copy(translation as Vector3);

    // 3) Camera positioning + basic collision push-in for third-person
    const desiredLocalCamera = isThirdPerson ? new Vector3(0, 0.22, 4.1) : new Vector3(0, 0, 0);
    let finalLocalCamera = desiredLocalCamera.clone();

    const now = state.clock.getElapsedTime();
    const collisionInterval = 0.12; // throttle raycasts for performance (approx 8Hz)
    if (isThirdPerson && now - lastCollisionCheckRef.current > collisionInterval) {
      lastCollisionCheckRef.current = now;
      // world positions
      const headWorld = new Vector3();
      pitchRef.current.getWorldPosition(headWorld);
      const desiredCameraWorld = desiredLocalCamera.clone();
      pitchRef.current.localToWorld(desiredCameraWorld);

      const dir = desiredCameraWorld.clone().sub(headWorld);
      const dist = dir.length();
      if (dist > 0.001) {
        dir.normalize();
        // Build collidable list periodically to avoid intersecting the entire scene every frame
        if (collidablesRef.current.length === 0 || now - collidableBuildTimeRef.current > 5.0) {
          collidablesRef.current = [];
          state.scene.traverse((obj: Object3D) => {
            // Only consider meshes that are visible and not part of the player hierarchy
            if (!(obj as Mesh).isMesh) return;
            if (!obj.visible) return;
            let p: Object3D | null = obj;
            while (p) {
              if (p === playerRef.current) return;
              p = p.parent as Object3D | null;
            }
            collidablesRef.current.push(obj);
          });
          collidableBuildTimeRef.current = now;
        }

        raycasterRef.current.set(headWorld, dir);
        raycasterRef.current.far = dist;
        const intersects = raycasterRef.current.intersectObjects(collidablesRef.current, true);
        const hit = intersects[0];
        if (hit) {
          // move camera slightly forward from hit point
          const safeWorld = hit.point.clone().add(dir.multiplyScalar(-0.15));
          const safeLocal = safeWorld.clone();
          pitchRef.current.worldToLocal(safeLocal);
          cachedCollisionRef.current = safeLocal;
        } else {
          cachedCollisionRef.current = null;
        }
      } else {
        cachedCollisionRef.current = null;
      }
    }

    // Motion layers: idle breathing, walk bob, lateral sway, and sprint shake
    const time = now;
    const speedRatio = currentSpeed > 0 ? Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2) / currentSpeed : 0;
    const restingEyeHeight = isThirdPerson ? 1.48 : 1.6;

    // Idle breathing (subtle)
    const idleFreq = 1.1; // slow breathing rate
    const idleAmpY = isThirdPerson ? 0.006 : 0.01;
    const idleAmpX = isThirdPerson ? 0.006 : 0.01;
    const idleY = Math.sin(time * idleFreq) * idleAmpY * (1 - speedRatio);
    const idleX = Math.sin(time * idleFreq * 0.6) * idleAmpX * (1 - speedRatio);

    // Walking bob / sway
    const bobPhase = time * (inputState.sprint ? 15 : 10);
    const walkAmpY = isThirdPerson ? 0.02 : 0.04;
    const walkAmpX = isThirdPerson ? 0.02 : 0.03;
    const walkY = Math.sin(bobPhase) * walkAmpY * speedRatio;
    const walkX = Math.cos(bobPhase * 0.5) * walkAmpX * speedRatio;

    const totalYOffset = idleY + walkY;
    const totalXOffset = idleX + walkX;

    if (cachedCollisionRef.current) finalLocalCamera.copy(cachedCollisionRef.current);

    // Apply lateral/vertical offsets to third-person camera, or to head height in first-person
    if (isThirdPerson) {
      finalLocalCamera.x += totalXOffset;
      finalLocalCamera.y += totalYOffset;
      if (inputState.sprint && isSprintingRef.current) {
        finalLocalCamera.z += Math.sin(time * 10) * 0.03; // subtle forward/back push
      }
    }

    camera.position.lerp(finalLocalCamera, 1 - Math.exp(-10 * delta));

    // Smoothly blend head height for first-person and third-person pitch anchor
    const desiredPitchY = restingEyeHeight + totalYOffset;
    pitchRef.current.position.y += (desiredPitchY - pitchRef.current.position.y) * Math.min(1, 8 * delta);

    // Roll / sway
    const targetRoll = isThirdPerson ? 0 : Math.sin(bobPhase * 2) * 0.02 * speedRatio;
    camera.rotation.z += (targetRoll - camera.rotation.z) * Math.min(1, 6 * delta);

    // Sprint shake - subtle, layered frequencies for cinematic effect
    if (inputState.sprint && isSprintingRef.current) {
      const sprintShakeAmp = 0.004;
      camera.rotation.x += Math.sin(time * 18) * sprintShakeAmp * 0.5;
      camera.rotation.y += Math.sin(time * 12) * sprintShakeAmp * 0.25;
    }

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

    // Flashlight + fill light logic (unchanged)
    if (flashlightObjRef.current) {
      const targetIntensity = gameStore.flashlightOn && gameStore.flashlightBattery > 0 ? 120 : 0;
      flashlightObjRef.current.intensity += (targetIntensity - flashlightObjRef.current.intensity) * 15 * delta;
      if (gameStore.flashlightOn && gameStore.flashlightBattery < 20 && gameStore.flashlightBattery > 0) {
        flashlightObjRef.current.intensity += (Math.random() - 0.5) * 30;
      }
      const flashlightSpeedRatio = Math.sqrt(velocity.current.x**2 + velocity.current.z**2) / currentSpeed;
      const flashlightTime = state.clock.getElapsedTime();
      if (flashlightSpeedRatio > 0.1) {
        const sway = Math.sin(flashlightTime * 10) * 0.05 * flashlightSpeedRatio;
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
