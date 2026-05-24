import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimeSpeed = "paused" | "slow" | "normal" | "fast" | "hardcore";
export type CameraMode = 'first-person' | 'third-person';

export const TIME_MULTIPLIERS: Record<TimeSpeed, number> = {
  paused: 0,
  slow: 1,
  normal: 5,
  fast: 10,
  hardcore: 20
};

export type ItemType = 'battery' | 'food' | 'water' | 'medicine' | 'scrap';

export interface InventoryItem {
  id: string;
  type: ItemType;
  name: string;
  weight: number;
  quantity: number;
}

interface GameState {
  // Time System
  timeOfDay: number; // 0.0 to 24.0
  timeSpeed: TimeSpeed;
  setTimeOfDay: (time: number | ((prev: number) => number)) => void;
  setTimeSpeed: (speed: TimeSpeed) => void;

  // Inventory & Survival
  inventory: InventoryItem[];
  maxWeight: number;
  flashlightOn: boolean;
  flashlightBattery: number; // 0 to 100
  toggleFlashlight: () => void;
  drainBattery: (amount: number) => void;
  addItem: (item: Omit<InventoryItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;

  // Settings
  cameraMode: CameraMode;
  cameraSensitivity: number; // 0.1 to 2.0
  headBobEnabled: boolean;
  sprintShakeEnabled: boolean;
  fogDensity: number; // 0.1 to 2.0
  shadowQuality: string; // 'low', 'medium', 'high'
  renderDistance: number; // 50 to 500
  masterVolume: number;
  ambientVolume: number;
  uiVolume: number;
  hudScale: number;
  // Vehicle state
  inVehicle: boolean;
  currentVehicleId?: string | null;
  enteringVehicle?: string | null; // vehicle id being entered (animation in progress)
  seatPosition?: { x: number; y: number; z: number } | null; // world-space seat anchor updated by active vehicle
  
  // Setters for Settings
  toggleCameraMode: () => void;
  setSetting: <K extends keyof GameState>(key: K, value: GameState[K]) => void;
  // Vehicle actions
  requestEnterVehicle: (vehicleId: string) => void;
  enterVehicle: (vehicleId: string) => void;
  exitVehicle: (spawn?: { x: number; y: number; z: number }) => void;
  setSeatPosition: (pos: { x: number; y: number; z: number } | null) => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      timeOfDay: 8.0, // Start at 8 AM
      timeSpeed: 'normal',
      setTimeOfDay: (time) => set((state) => ({ 
        timeOfDay: typeof time === 'function' ? time(state.timeOfDay) : time 
      })),
      setTimeSpeed: (speed) => set({ timeSpeed: speed }),

      // Inventory
      inventory: [
        { id: 'start-battery-1', type: 'battery', name: 'Alkaline Battery', weight: 0.2, quantity: 2 },
        { id: 'start-water-1', type: 'water', name: 'Bottled Water', weight: 0.5, quantity: 1 }
      ],
      maxWeight: 30.0,
      flashlightOn: false,
      flashlightBattery: 100,
      toggleFlashlight: () => set((state) => {
         if (state.flashlightBattery > 0 || state.flashlightOn) {
            return { flashlightOn: !state.flashlightOn };
         }
         return state;
      }),
      drainBattery: (amount) => set((state) => {
         const newBattery = Math.max(0, state.flashlightBattery - amount);
         if (newBattery <= 0) {
            return { flashlightBattery: 0, flashlightOn: false };
         }
         return { flashlightBattery: newBattery };
      }),
      addItem: (newItem) => set((state) => {
         const currentWeight = state.inventory.reduce((acc, item) => acc + item.weight * item.quantity, 0);
         if (currentWeight + newItem.weight > state.maxWeight) return state; // Cannot carry

         const existing = state.inventory.find(i => i.type === newItem.type && i.name === newItem.name);
         if (existing) {
            return {
               inventory: state.inventory.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i)
            };
         }
         return {
            inventory: [...state.inventory, { ...newItem, id: Math.random().toString(36).substr(2, 9), quantity: 1 }]
         };
      }),
      removeItem: (id) => set((state) => ({
         inventory: state.inventory.filter(i => i.id !== id)
      })),

      // Defaults
      cameraMode: 'first-person',
      cameraSensitivity: 1.0,
      headBobEnabled: true,
      sprintShakeEnabled: true,
      fogDensity: 1.0,
      shadowQuality: 'medium',
      renderDistance: 200,
      masterVolume: 1.0,
      ambientVolume: 1.0,
      uiVolume: 1.0,
      hudScale: 1.0,

      toggleCameraMode: () => set((state) => ({
        cameraMode: state.cameraMode === 'first-person' ? 'third-person' : 'first-person'
      })),
      setSetting: (key, value) => set({ [key]: value }),
      // Vehicle defaults
      inVehicle: false,
      currentVehicleId: null,
      enteringVehicle: null,
      seatPosition: null,
      requestEnterVehicle: (vehicleId: string) => set({ enteringVehicle: vehicleId }),
      enterVehicle: (vehicleId: string) => set({ inVehicle: true, currentVehicleId: vehicleId, enteringVehicle: null }),
      exitVehicle: (spawn) => set((state) => ({ inVehicle: false, currentVehicleId: null, seatPosition: spawn ? { x: spawn.x, y: spawn.y, z: spawn.z } : null })),
      setSeatPosition: (pos) => set({ seatPosition: pos }),
    }),
    {
      name: 'giza-survival-settings',
      partialize: (state) => ({ // Only persist these
        timeSpeed: state.timeSpeed,
        cameraMode: state.cameraMode,
        cameraSensitivity: state.cameraSensitivity,
        headBobEnabled: state.headBobEnabled,
        sprintShakeEnabled: state.sprintShakeEnabled,
        fogDensity: state.fogDensity,
        shadowQuality: state.shadowQuality,
        renderDistance: state.renderDistance,
        masterVolume: state.masterVolume,
        ambientVolume: state.ambientVolume,
        uiVolume: state.uiVolume,
        hudScale: state.hudScale,
        inventory: state.inventory,
        flashlightBattery: state.flashlightBattery
      }),
    }
  )
);
