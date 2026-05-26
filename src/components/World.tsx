import React from 'react';
import SavannaMapBuilder from './SavannaMapBuilder';
import { Atmosphere } from './Atmosphere';
import { useGameStore } from '../store/gameStore';
import { TILE_SIZE } from '../constants/world';

export function World() {
  const debug = useGameStore(state => (state as any).collisionDebug);

  return (
    <>
      <Atmosphere />
      {/* SavannaMapBuilder: procedural Masai Mara savanna with trees, rocks, wildlife and vehicle spawn */}
      <SavannaMapBuilder gridSize={8} tileSize={TILE_SIZE} showGrid={debug} />
    </>
  );
}
