import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
// Load vehicle model at runtime from public to avoid bundling large binary
const vehicleModelUrl = encodeURI('/assets/models/1999_mercedes_benz_s600.glb');
import * as THREE from 'three';
import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useGameStore } from '../store/gameStore';
import { inputState } from '../store';

export function Vehicle({ id = 'vehicle-1', position = [4, 0, 4] as [number, number, number] }: { id?: string; position?: [number, number, number] }) {
  const gltf = useGLTF(vehicleModelUrl);
  const chassisRef = useRef<THREE.Group>(null);
  const seatRef = useRef<THREE.Group>(null);
  const rigidRef = useRef<RapierRigidBody>(null);
  const speedRef = useRef(0);

  const { camera } = useThree();
  const inVehicle = useGameStore(state => state.inVehicle);
  const currentVehicleId = useGameStore(state => state.currentVehicleId);
  const requestEnterVehicle = useGameStore(state => state.requestEnterVehicle);
  const exitVehicle = useGameStore(state => state.exitVehicle);
  const setSeatPosition = useGameStore(state => state.setSeatPosition);

  // simple tunables
  const maxSpeed = 12; // m/s
  const accel = 8; // m/s^2
  const brake = 10;
  const steerSpeed = 1.6; // rad/s at speed

  useEffect(() => {
    // create a seat anchor if model doesn't provide one
    if (chassisRef.current && !seatRef.current) {
      const seat = new THREE.Group();
      seat.position.set(0, 0.9, 0.4);
      chassisRef.current.add(seat);
      seatRef.current = seat;
    }
  }, []);

  useFrame((state, delta) => {
    if (!chassisRef.current || !rigidRef.current) return;

    // world sync
    const translation = rigidRef.current.translation();
    chassisRef.current.position.set(translation.x, translation.y, translation.z);

    // interaction distance (use camera/player head position)
    const camPos = camera.position;
    const distToVehicle = camPos.distanceTo(chassisRef.current.position);

    // if player requests enter while near, forward to store
    if (distToVehicle < 3.0 && inputState.interact && !inVehicle) {
      requestEnterVehicle(id);
    }

    // if currently driving this vehicle
    const active = inVehicle && currentVehicleId === id;

    // Driving controls only when active
    if (active) {
      // throttle mapped from inputState.move.y (joystick pushes)
      const throttle = inputState.move.y; // -1..1 (forward/back)
      const steer = inputState.move.x; // left/right

      // simple acceleration model
      const targetAccel = throttle * accel;
      speedRef.current += targetAccel * delta;

      // braking when no throttle
      if (Math.abs(throttle) < 0.05) {
        // natural damping
        speedRef.current -= Math.sign(speedRef.current) * Math.min(Math.abs(speedRef.current), brake * delta);
      }

      // clamp speed
      speedRef.current = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, speedRef.current));

      // steer based on speed
      const steerAmt = steer * steerSpeed * (0.2 + (Math.abs(speedRef.current) / maxSpeed));
      chassisRef.current.rotation.y += steerAmt * delta;

      // compute forward vector
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(chassisRef.current.quaternion);
      // apply velocity
      const vel = { x: forward.x * speedRef.current, y: rigidRef.current.linvel().y, z: forward.z * speedRef.current } as any;
      rigidRef.current.setLinvel(vel, true);

      // update seat world anchor for camera / player attachment
      if (seatRef.current) {
        const seatWorld = new THREE.Vector3();
        seatRef.current.getWorldPosition(seatWorld);
        setSeatPosition({ x: seatWorld.x, y: seatWorld.y, z: seatWorld.z });
      }

      // exit vehicle if interact pressed while active
      if (inputState.interact) {
        // compute safe exit position slightly to right of vehicle
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(chassisRef.current.quaternion);
        const exitPos = chassisRef.current.position.clone().add(right.multiplyScalar(1.0));
        exitVehicle({ x: exitPos.x, y: exitPos.y + 0.2, z: exitPos.z });
      }
    } else {
      // not active: damping vehicle speed
      speedRef.current *= Math.max(0.0, 1 - 3 * delta);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(chassisRef.current.quaternion);
      const vel = { x: forward.x * speedRef.current, y: rigidRef.current.linvel().y, z: forward.z * speedRef.current } as any;
      rigidRef.current.setLinvel(vel, true);
    }
  });

  // Attach / detach camera to seat anchor when driving
  useEffect(() => {
    const active = inVehicle && currentVehicleId === id;
    if (active && seatRef.current) {
      try {
        if (camera.parent) camera.parent.remove(camera);
      } catch (e) {
        // ignore
      }
      seatRef.current.add(camera);
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, 0);
    }

    return () => {
      // on deactivation, detach camera from seat so player can reattach
      if (seatRef.current) {
        try {
          seatRef.current.remove(camera);
        } catch (e) {}
      }
    };
  }, [inVehicle, currentVehicleId, camera, id]);

  return (
    <group position={position}>
      <RigidBody ref={rigidRef} type="dynamic" mass={1200} colliders={false} position={position}>
        <group ref={chassisRef} dispose={null} castShadow receiveShadow>
          <primitive object={gltf.scene} />
        </group>
      </RigidBody>
    </group>
  );
}

useGLTF.preload(vehicleModelUrl);
export default Vehicle;
