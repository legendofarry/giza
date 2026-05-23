import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

export function Atmosphere() {
  const fogRef = useRef<THREE.Fog>(null);
  const directionalLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const hemisphereLightRef = useRef<THREE.HemisphereLight>(null);

  // Use refs to avoid re-renders on every frame.
  const timeRef = useRef(useGameStore.getState().timeOfDay);

  useFrame((state) => {
    const gameStore = useGameStore.getState();
    
    // FORCE ALWAYS DAY (12 PM)
    timeRef.current = 12;
    
    // Throttle UI store updates
    const inGameMinutesDelta = Math.abs(gameStore.timeOfDay - 12);
    if (inGameMinutesDelta > 0) {
      gameStore.setTimeOfDay(12);
    }

    // Fixed sun position
    const sunPitch = Math.PI / 2.85;
    
    // Fixed Day Colors
    const dayColor = new THREE.Color('#fff6e3');
    const skyColor = new THREE.Color('#c7d9e8');
    const groundFillColor = new THREE.Color('#b9b09d');
    const fogTarget = new THREE.Color('#b8c7d1');
    
    // Fixed Day Intensities
    const ambientIntensity = 1.75; 
    const hemisphereIntensity = 1.35;
    const directionalIntensity = 3.4;
    const fogNear = 85 / gameStore.fogDensity;
    const fogFar = 420 / gameStore.fogDensity;

    if (ambientLightRef.current) {
       ambientLightRef.current.intensity = ambientIntensity;
       ambientLightRef.current.color.copy(dayColor);
    }

    if (hemisphereLightRef.current) {
       hemisphereLightRef.current.intensity = hemisphereIntensity;
       hemisphereLightRef.current.color.copy(skyColor);
       hemisphereLightRef.current.groundColor.copy(groundFillColor);
    }

    if (directionalLightRef.current) {
       directionalLightRef.current.intensity = directionalIntensity;
       directionalLightRef.current.color.copy(dayColor);
       
       // Calculate position on an arc
       const radius = 100;
       directionalLightRef.current.position.set(
         Math.cos(sunPitch) * radius,
         Math.sin(sunPitch) * radius,
         -Math.cos(sunPitch) * radius * 0.5
       );
    }

    if (fogRef.current) {
        fogRef.current.color.copy(fogTarget);
        fogRef.current.near = fogNear;
        fogRef.current.far = Math.max(fogFar, fogNear + 10);
        state.scene.background = fogTarget;
    }
  });

  return (
    <>
      <fog ref={fogRef} attach="fog" args={['#b8c7d1', 85, 420]} />

      <ambientLight ref={ambientLightRef} intensity={1.75} color="#fff6e3" />
      <hemisphereLight ref={hemisphereLightRef} intensity={1.35} color="#c7d9e8" groundColor="#b9b09d" />
      <directionalLight 
        ref={directionalLightRef}
        position={[30, 50, -30]} 
        intensity={3.4} 
        color="#fff6e3"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.001}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
    </>
  );
}
