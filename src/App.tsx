/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { World } from './components/World';
import { Player } from './components/Player';
import { UI } from './components/UI';
import { Preload, Loader } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { EffectComposer, Vignette, Noise, BrightnessContrast, HueSaturation } from '@react-three/postprocessing';
import { Menu } from './components/Menu';
import { RotateDevice } from './components/RotateDevice';
import { Onboarding } from './components/Onboarding';
import { playerState } from './store';
import { AudioEnvironment } from './components/AudioEnvironment';

import { useGameStore } from './store/gameStore';

function GameWorld({ onMenuReturn }: { onMenuReturn: () => void }) {
  const renderDistance = useGameStore(state => state.renderDistance);
  return (
    <>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: renderDistance }}>
        <Suspense fallback={null}>
          <Physics>
            <World />
            <Player />
          </Physics>
          <EffectComposer multisampling={0}>
             {/* Keep the survival grade, but preserve material color in the city. */}
             <HueSaturation hue={0} saturation={0.04} />
             <BrightnessContrast brightness={0.08} contrast={0.04} />
             
             {/* Gritty film noise */}
             <Noise opacity={0.1} premultiply />
             
             {/* Atmospheric corners */}
             <Vignette eskil={false} offset={0.18} darkness={0.42} />
          </EffectComposer>
          <Preload all />
        </Suspense>
      </Canvas>
      <AudioEnvironment />
      <Loader containerStyles={{ backgroundColor: '#0a0b10' }} />
      <UI onMenuReturn={onMenuReturn} />
    </>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'onboarding' | 'playing'>('menu');
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    
    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Load player config if it exists
    const storedConfig = localStorage.getItem('giza_player_config');
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        playerState.name = config.name;
        playerState.character = config.character || config.archetype || playerState.character;
        playerState.archetype = playerState.character;
      } catch (e) {
        console.error('Failed to parse player config', e);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Reusable helper to request fullscreen and lock orientation.
  const requestFullscreenAndLock = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && (screen.orientation as any).lock) {
        await (screen.orientation as any).lock('landscape');
      }
    } catch (e) {
      console.warn('Fullscreen/Orientation lock not supported or denied', e);
    }
  };

  // Try to enter fullscreen on the first user interaction (browsers require a user gesture).
  useEffect(() => {
    if (gameState === 'playing') return;

    let handled = false;
    const onFirstInteraction = async () => {
      if (handled) return;
      handled = true;
      await requestFullscreenAndLock();
    };

    document.addEventListener('pointerdown', onFirstInteraction, { once: true, passive: true });
    document.addEventListener('touchstart', onFirstInteraction, { once: true, passive: true });
    document.addEventListener('keydown', onFirstInteraction, { once: true });

    return () => {
      document.removeEventListener('pointerdown', onFirstInteraction as EventListener);
      document.removeEventListener('touchstart', onFirstInteraction as EventListener);
      document.removeEventListener('keydown', onFirstInteraction as EventListener);
    };
  }, [gameState]);

  const handleStart = async () => {
    await requestFullscreenAndLock();

    const hasCompletedOnboarding = localStorage.getItem('giza_onboarding_complete') === 'true';
    if (hasCompletedOnboarding) {
      setGameState('playing');
    } else {
      setGameState('onboarding');
    }
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative touch-none">
      {isPortrait && <RotateDevice />}
      
      {gameState === 'playing' && !isPortrait && (
        <GameWorld onMenuReturn={() => setGameState('menu')} />
      )}

      {gameState === 'onboarding' && !isPortrait && (
        <Onboarding onComplete={() => setGameState('playing')} />
      )}

      {gameState === 'menu' && !isPortrait && (
        <Menu onStart={handleStart} />
      )}
    </div>
  );
}
