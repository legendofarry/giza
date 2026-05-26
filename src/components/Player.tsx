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
import { PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, PLAYER_CAPSULE_RADIUS, computeCapsuleHeight, VISUAL_FOOT_OFFSET } from '../constants/world';
import rastaGirlUrl from '../assets/models/Barbie.fbx?url';
import rastaPersonUrl from '../assets/models/Qaqk.fbx?url';
import idleAnimationUrl from '../assets/models/Breathing Idle.fbx?url';
import walkAnimationUrl from '../assets/models/Walking.fbx?url';
import runAnimationUrl from '../assets/models/Fast Run.fbx?url';
import enteringCarUrl from '../assets/models/Entering Car.fbx?url';

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
  speedRef,
}: {
  isMovingRef: React.MutableRefObject<boolean>;
  isSprintingRef: React.MutableRefObject<boolean>;
  speedRef: React.MutableRefObject<number>;
}) {
  const rootRef = useRef<Group>(null);
  const activeActionRef = useRef('idle');
  const config = getCharacterConfig(playerState.character || playerState.archetype);
  const sourceModel = useFBX(config.modelUrl);
  const idleAnimation = useFBX(idleAnimationUrl);
  const walkAnimation = useFBX(walkAnimationUrl);
  const runAnimation = useFBX(runAnimationUrl);
  const enterAnimation = useFBX(enteringCarUrl);
  const model = useMemo(() => SkeletonUtils.clone(sourceModel) as Group, [sourceModel]);
  const clips = useMemo(() => {
    const arr: THREE.AnimationClip[] = [];
    const modelAnims: THREE.AnimationClip[] = sourceModel && (sourceModel as any).animations ? (sourceModel as any).animations : [];
    const [idleClip] = idleAnimation.animations;
    const [walkClip] = walkAnimation.animations;
    const [runClip] = runAnimation.animations;
    const [enterClip] = enterAnimation.animations;

    // Helper: sanitize clips by zeroing horizontal components of any position tracks (remove root motion X/Z)
    function sanitizeClip(clip: THREE.AnimationClip) {
      const c = clip.clone();
      const newTracks: THREE.KeyframeTrack[] = [];
      for (const t of c.tracks) {
        try {
          if (t.name.endsWith('.position') && (t as any).getValueSize && (t as any).getValueSize() === 3) {
            const times = (t as any).times as number[];
            const values = Array.from((t as any).values as number[]);
            for (let i = 0; i < values.length; i += 3) {
              // zero X and Z to eliminate forward/back root motion; keep Y (vertical) if present
              values[i] = 0;
              // values[i+1] = values[i+1]; // keep Y
              values[i + 2] = 0;
            }
            newTracks.push(new THREE.VectorKeyframeTrack(t.name, times, values));
            continue;
          }
        } catch (e) {}
        newTracks.push(t);
      }
      c.tracks = newTracks;
      return c;
    }

    // Prefer embedded model animations as a graceful fallback
    if (modelAnims && modelAnims.length > 0) {
      for (const mc of modelAnims) {
        const cloned = mc.clone();
        if (!cloned.name) cloned.name = mc.name || 'model_anim';
        arr.push(cloned);
      }
    }

    if (idleClip) { const c = idleClip.clone(); c.name = 'idle'; arr.push(c); }
    if (walkClip) { const c = sanitizeClip(walkClip); c.name = 'walk'; arr.push(c); }
    if (runClip) { const c = sanitizeClip(runClip); c.name = 'run'; arr.push(c); }
    if (enterClip) { const c = enterClip.clone(); c.name = 'enterVehicle'; arr.push(c); }
    return arr;
  }, [sourceModel, idleAnimation.animations, walkAnimation.animations, runAnimation.animations, enterAnimation.animations]);

  const { actions: avatarActions, mixer } = useAnimations(clips, rootRef);

  const debug = useGameStore(state => (state as any).collisionDebug);

  // locomotion state
  const currentStateRef = React.useRef<'idle' | 'walk' | 'run'>('idle');
  const currentActionNameRef = React.useRef<string | null>(null);

  // nominal speeds (meters/sec) for clip time-scaling — tuned to player global speed
  const NOMINAL_WALK = 1.6;
  const NOMINAL_RUN = 5.0;

  // Simple DOM overlay for locomotion debug when enabled
  const debugElRef = React.useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!debug) {
      if (debugElRef.current) {
        debugElRef.current.remove();
        debugElRef.current = null;
      }
      return;
    }
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.left = '8px';
    el.style.top = '8px';
    el.style.zIndex = '9999';
    el.style.color = 'white';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '12px';
    el.style.background = 'rgba(0,0,0,0.4)';
    el.style.padding = '6px 8px';
    el.style.borderRadius = '4px';
    document.body.appendChild(el);
    debugElRef.current = el;
    return () => { el.remove(); debugElRef.current = null; };
  }, [debug]);

  useEffect(() => {
    configureCharacter(model);
  }, [model]);

  // Align visual model so feet sit at y=0 (match capsule base)
  useEffect(() => {
    if (!model || !rootRef.current) return;
    try {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      if (box && !box.isEmpty()) {
        const minY = box.min.y;
        // Move root so lowest vertex is at y=0 in local space, then apply small visual offset
        rootRef.current.position.y = -minY * config.scale + VISUAL_FOOT_OFFSET;
      }
    } catch (e) {
      // ignore
    }
  }, [model, config.scale]);

  useEffect(() => {
    const keys = Object.keys(avatarActions || {});
    const fallbackKey = keys.length > 0 ? keys[0] : null;
    const action = avatarActions.idle || (fallbackKey ? (avatarActions as any)[fallbackKey] : undefined);
    if (!action) return;

    const name = action.getClip ? action.getClip().name : 'idle';
    activeActionRef.current = name || 'idle';
    action.reset().fadeIn(0.18).play();
    return () => {
      action.fadeOut(0.18);
    };
  }, [avatarActions]);

  useEffect(() => {
    try {
      const names = Object.keys(avatarActions || {});
      if (names.length === 0) {
        console.warn('PlayerAvatar: no animation actions found. Clips provided:', clips.map(c => c.name));
      } else {
        console.log('PlayerAvatar animations:', names);
      }
    } catch (e) {}
  }, [avatarActions]);

  useFrame(() => {
    // Update locomotion state machine based on velocity and sprint flag
    const speed = speedRef.current || 0;
    const isMoving = isMovingRef.current;
    const isSprinting = isSprintingRef.current;

    let desired: 'idle' | 'walk' | 'run' = 'idle';
    if (isMoving) desired = isSprinting ? 'run' : 'walk';

    const current = currentStateRef.current;
    if (desired !== current) {
      // crossfade
      const prevAction = currentActionNameRef.current ? avatarActions[currentActionNameRef.current] : undefined;
      const nextAction = avatarActions[desired] || avatarActions.idle || Object.values(avatarActions)[0];
      if (nextAction) {
        prevAction?.fadeOut(0.18);
        nextAction.reset().fadeIn(0.18).play();
        currentActionNameRef.current = Object.keys(avatarActions).find(k => avatarActions[k] === nextAction) || desired;
        currentStateRef.current = desired;
      }
    }

    // Adjust playback speed to match movement speed to reduce foot sliding
    const currentAction = currentActionNameRef.current ? avatarActions[currentActionNameRef.current] : null;
    if (currentAction) {
      if (currentStateRef.current === 'walk') {
        currentAction.timeScale = THREE.MathUtils.clamp(speed / NOMINAL_WALK, 0.6, 1.6);
      } else if (currentStateRef.current === 'run') {
        currentAction.timeScale = THREE.MathUtils.clamp(speed / NOMINAL_RUN, 0.7, 1.6);
      } else {
        currentAction.timeScale = 1.0;
      }
    }

    // Update debug overlay
    if (debugElRef.current) {
      const lines = [] as string[];
      lines.push(`state: ${currentStateRef.current}`);
      lines.push(`speed: ${speed.toFixed(2)} m/s`);
      lines.push(`action: ${currentActionNameRef.current || 'none'}`);
      if (currentAction) lines.push(`timeScale: ${currentAction.timeScale.toFixed(2)}`);
      debugElRef.current.innerText = lines.join('\n');
    }
  });

  // Play entering animation when requested via game store
  const enteringVehicleId = useGameStore(state => state.enteringVehicle);
  const requestEnter = useGameStore(state => state.requestEnterVehicle);
  const confirmEnter = useGameStore(state => state.enterVehicle);
  const enteringNowRef = React.useRef(false);

  useEffect(() => {
    if (!enteringVehicleId) return;
    const enterAction = avatarActions && (avatarActions.enterVehicle || avatarActions['enterVehicle']);
    if (!enterAction || enteringNowRef.current) return;
    enteringNowRef.current = true;
    // Play enter animation once
    enterAction.reset();
    enterAction.setLoop(THREE.LoopOnce, 1);
    (enterAction as any).clampWhenFinished = true;
    enterAction.fadeIn(0.12).play();

    const duration = enterAction.getClip().duration || 1.0;
    const t = setTimeout(() => {
      // Confirm entering the vehicle in the global store
      confirmEnter(enteringVehicleId);
      enteringNowRef.current = false;
    }, duration * 1000);

    return () => clearTimeout(t);
  }, [enteringVehicleId, avatarActions, confirmEnter]);

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
  const { camera, scene } = useThree();
  const gameStore = useGameStore();
  
  const flashlightObjRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<PointLight>(null);
  
  // Player state
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const movementSpeedRef = useRef(0); // horizontal speed in m/s for animation
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
  const lastGroundCheckRef = React.useRef(0);

  // compute capsule dimensions so player capsule always matches locked world scale
  const CAPSULE_RADIUS = PLAYER_CAPSULE_RADIUS;
  const CAPSULE_HEIGHT = computeCapsuleHeight(PLAYER_HEIGHT, CAPSULE_RADIUS);
  const CAPSULE_CENTER_Y = CAPSULE_RADIUS + CAPSULE_HEIGHT / 2;
  const snappedRef = React.useRef(false);

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

  // One-time snap-to-ground after world loads to avoid spawning above gaps
  useEffect(() => {
    // Repeatedly try to snap to ground for a short period after spawn.
    let mounted = true;
    const startTime = Date.now();
    const attemptInterval = 250; // ms
    const timeoutMs = 3000; // stop trying after this

    const intervalId = setInterval(() => {
      if (!mounted || snappedRef.current) return;
      if (!rigidBodyRef.current) return;
      try {
        const t = rigidBodyRef.current.translation();
        // cast from above the body downward
        const start = new THREE.Vector3(t.x, t.y + Math.max(3, CAPSULE_HEIGHT * 4), t.z);
        const dir = new THREE.Vector3(0, -1, 0);
        raycasterRef.current.set(start, dir);
        raycasterRef.current.far = 50;

        const objs: THREE.Object3D[] = [];
        scene.traverse((obj) => {
          if ((obj as Mesh).isMesh) objs.push(obj);
        });
        const hits = raycasterRef.current.intersectObjects(objs, true);
        if (hits.length > 0) {
          const p = hits[0].point;
          const bottomOffset = CAPSULE_RADIUS + CAPSULE_HEIGHT / 2;
          const targetY = p.y + bottomOffset + 0.02;
          rigidBodyRef.current.setTranslation({ x: t.x, y: targetY, z: t.z }, true);
          const lv = rigidBodyRef.current.linvel();
          rigidBodyRef.current.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
          snappedRef.current = true;
          clearInterval(intervalId);
        } else if (Date.now() - startTime > timeoutMs) {
          // Fallback: place at reasonable ground-relative height below current position
          try {
            const t2 = rigidBodyRef.current.translation();
            rigidBodyRef.current.setTranslation({ x: t2.x, y: CAPSULE_CENTER_Y + 0.1, z: t2.z }, true);
            const lv = rigidBodyRef.current.linvel();
            rigidBodyRef.current.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
            snappedRef.current = true;
          } catch (e) {}
          clearInterval(intervalId);
        }
      } catch (e) {
        // ignore ray errors
      }
    }, attemptInterval);

    return () => { mounted = false; clearInterval(intervalId); };
  }, [scene]);

  // Detach camera when player is inside vehicle, and reattach on exit
  const inVehicle = useGameStore(state => state.inVehicle);
  const seatPosition = useGameStore(state => state.seatPosition);

  useEffect(() => {
    if (!pitchRef.current) return;
    if (inVehicle) {
      try { pitchRef.current.remove(camera); } catch (e) {}
    } else {
      try { pitchRef.current.add(camera); camera.position.set(0, 0, 0); } catch (e) {}
    }
  }, [inVehicle, camera]);

  useFrame((state, delta) => {
    if (!pitchRef.current || !rigidBodyRef.current || !playerRef.current) return;

    // If player is inside a vehicle, keep the player's rigid body at seat and hide visuals
    if (inVehicle) {
      if (seatPosition && rigidBodyRef.current) {
        try {
          rigidBodyRef.current.setTranslation({ x: seatPosition.x, y: seatPosition.y - 1.0, z: seatPosition.z }, true);
        } catch (e) {}
      }
      if (bodyRef.current) bodyRef.current.visible = false;
      return;
    } else {
      if (bodyRef.current) bodyRef.current.visible = true;
    }

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
    // update movement speed ref for animation playback
    movementSpeedRef.current = Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2);

    // Body rotation: prefer movement direction when moving, otherwise follow head yaw smoothly
    const bodyFollowSpeed = 6.0; // how quickly body turns to movement direction when moving
    const bodyAlignSpeed = 0.6; // passive alignment to head when stationary
    if (direction.current.length() > 0.15) {
      const movementYaw = Math.atan2(direction.current.x, -direction.current.z);
      const yawDelta = normalize(movementYaw - bodyYawRef.current);
      bodyYawRef.current += yawDelta * Math.min(1, bodyFollowSpeed * delta);
    } else {
      if (Math.abs(relativeYaw) > maxHeadYaw * 0.98) {
        const bodyTarget = headYawRef.current - Math.sign(relativeYaw) * maxHeadYaw;
        const yawDelta = normalize(bodyTarget - bodyYawRef.current);
        bodyYawRef.current += yawDelta * Math.min(1, bodyFollowSpeed * delta);
      } else {
        const yawDelta = normalize(headYawAbsolute - bodyYawRef.current);
        bodyYawRef.current += yawDelta * Math.min(1, bodyAlignSpeed * delta);
      }
    }

    // Apply rotations
    bodyRef.current.rotation.y = bodyYawRef.current;
    pitchRef.current.quaternion.setFromEuler(new Euler(headPitchRef.current, headYawAbsolute, 0));

    

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

    // Continuous ground stabilization: gently snap player to nearby ground when appropriate
    const groundCheckInterval = 0.08; // ~12.5Hz
    const maxSnapDistance = 0.6; // only snap when close to ground
    const groundSnapSpeed = 12.0; // smoothing factor
    if (!inVehicle && now - lastGroundCheckRef.current > groundCheckInterval) {
      lastGroundCheckRef.current = now;

      // Ensure collidable list exists
      if (collidablesRef.current.length === 0 || now - collidableBuildTimeRef.current > 5.0) {
        collidablesRef.current = [];
        state.scene.traverse((obj: Object3D) => {
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

      try {
        const t = translation as Vector3;
        const start = new THREE.Vector3(t.x, t.y + Math.max(1.0, CAPSULE_HEIGHT * 6), t.z);
        const dir = new THREE.Vector3(0, -1, 0);
        raycasterRef.current.set(start, dir);
        raycasterRef.current.far = Math.max(2.0, start.y + 1.0);
        const intersects = raycasterRef.current.intersectObjects(collidablesRef.current, true);
        const hit = intersects[0];
        if (hit) {
          const bottomOffset = CAPSULE_RADIUS + CAPSULE_HEIGHT / 2;
          const targetY = hit.point.y + bottomOffset + 0.02;
          const currentY = t.y;
          const vy = rigidBodyRef.current.linvel().y;

          // Only stabilize when close and not rapidly falling/jumping
          if (currentY - targetY > 0 && currentY - targetY <= maxSnapDistance && Math.abs(vy) < 1.5) {
            const newY = currentY + (targetY - currentY) * Math.min(1, groundSnapSpeed * delta);
            rigidBodyRef.current.setTranslation({ x: t.x, y: newY, z: t.z }, true);
            const lv = rigidBodyRef.current.linvel();
            rigidBodyRef.current.setLinvel({ x: lv.x, y: 0, z: lv.z }, true);
          }
        }
      } catch (e) {
        // ignore ray errors
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

    const debug = useGameStore(state => (state as any).collisionDebug);

    return (
    <>
      <RigidBody 
        ref={rigidBodyRef} 
        colliders={false} 
        mass={1} 
          type="dynamic" 
          position={[0, 2, 0]} 
        enabledRotations={[false, false, false]}
      >
            <CapsuleCollider args={[CAPSULE_RADIUS, CAPSULE_HEIGHT]} position={[0, CAPSULE_CENTER_Y, 0]} />
      </RigidBody>

      <group ref={playerRef}>
        <group ref={bodyRef}>
          {gameStore.cameraMode === 'third-person' && (
            <PlayerAvatar isMovingRef={isMovingRef} isSprintingRef={isSprintingRef} speedRef={movementSpeedRef} />
          )}
        </group>

            {debug && (
              <group>
                <mesh position={[0, CAPSULE_CENTER_Y, 0]}>
                  <sphereGeometry args={[CAPSULE_RADIUS, 12, 8]} />
                  <meshBasicMaterial color="cyan" wireframe />
                </mesh>
                <mesh position={[0, CAPSULE_CENTER_Y - (CAPSULE_RADIUS + CAPSULE_HEIGHT / 2), 0]}>
                  <sphereGeometry args={[0.08, 8, 6]} />
                  <meshBasicMaterial color="yellow" wireframe />
                </mesh>
                <mesh position={[0, CAPSULE_CENTER_Y - CAPSULE_HEIGHT / 2, 0]}>
                  <cylinderGeometry args={[CAPSULE_RADIUS, CAPSULE_RADIUS, CAPSULE_HEIGHT, 8]} />
                  <meshBasicMaterial color="cyan" wireframe />
                </mesh>
              </group>
            )}

        {/* Head/Camera node */}
        <group ref={pitchRef} position={[0, PLAYER_EYE_HEIGHT, 0]}>
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
