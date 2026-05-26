// src\constants\world.ts
// World-wide scale constants (1 unit = 1 meter)
export const UNIT = 1;

// Player dimensions
export const PLAYER_HEIGHT = 1.75; // meters
export const PLAYER_EYE_HEIGHT = 1.62; // meters (camera anchor)
export const PLAYER_CAPSULE_RADIUS = 0.35; // meters

// Tile/grid sizing
export const TILE_SIZE = 8; // meters per tile (good for roads + sidewalk)

// Road system
export const ROAD_LANE_WIDTH = 3; // meters per lane
export const ROAD_WIDTH = ROAD_LANE_WIDTH * 2; // default two-lane road (6m)
export const SIDEWALK_WIDTH = 2; // meters
export const CURB_HEIGHT = 0.12; // meters

// Building footprint guidance
export const BUILDING_FOOTPRINT = TILE_SIZE; // default building footprint equals tile

// Small helper: compute recommended capsule height from player height and radius
export function computeCapsuleHeight(playerHeight = PLAYER_HEIGHT, radius = PLAYER_CAPSULE_RADIUS) {
  const cylinder = Math.max(0.05, playerHeight - 2 * radius);
  return cylinder;
}

// Small visual tweak to sink or raise the visual model relative to collider (meters)
export const VISUAL_FOOT_OFFSET = -0.02; // negative lowers the model by 2cm to ensure feet contact ground
