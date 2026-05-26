import React from 'react';
import MapBuilder from './MapBuilder';
import { Atmosphere } from './Atmosphere';
import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../constants/world';

export function World() {
  const debug = useGameStore(state => (state as any).collisionDebug);

  return (
    <>
      <Atmosphere />
      {/* Modular MapBuilder creates primitive colliders that exactly match visible tiles */}
      <MapBuilder tileSize={TILE_SIZE} showGrid={debug} />
    </>
  );
}
