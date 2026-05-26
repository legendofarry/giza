import React, { useState, useEffect } from 'react';
import { Joystick } from './Joystick';
import { inputState } from '../store';
import { Pause, Clock as ClockIcon, Flashlight, Backpack, X, Camera, UserRound } from 'lucide-react';
import { useGameStore, TimeSpeed } from '../store/gameStore';

interface UIProps {
  onMenuReturn: () => void;
}

export function UI({ onMenuReturn }: UIProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [showZone, setShowZone] = useState(true);
  const [showInventory, setShowInventory] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');

  const gameStore = useGameStore();

  // Calculate current weight
  const currentWeight = gameStore.inventory.reduce((acc, item) => acc + item.weight * item.quantity, 0);

  // Temporary zone discovery text effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowZone(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const formatTime = (timeFloat: number) => {
    const hours = Math.floor(timeFloat);
    const minutes = Math.floor((timeFloat - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const getDayState = (time: number) => {
    if (time >= 5 && time < 9) return "MORNING";
    if (time >= 9 && time < 16) return "MIDDAY";
    if (time >= 16 && time < 20) return "SUNSET";
    return "NIGHT";
  };

  return (
    <>
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10 select-none">
        {/* Top HUD */}
        <div className="flex justify-between items-start w-full gap-4 relative">
          {/* Top Left: Minimal Bars */}
          <div className="flex flex-col gap-1.5 mt-2 ml-2">
            {/* Health Bar */}
            <div className="w-24 h-[2px] bg-white/10 rounded-full overflow-hidden shadow-[0_0_5px_rgba(255,0,0,0.3)]">
              <div className="w-[80%] h-full bg-white/70 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
            </div>
            {/* Stamina Bar */}
            <div className="w-20 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div className="w-[100%] h-full bg-white/40 rounded-full" />
            </div>
            {/* Survival Watch */}
            <div className="mt-2 flex items-center gap-2 bg-black/40 px-2 py-1 border border-white/10 backdrop-blur-md rounded-sm w-fit">
              <ClockIcon className="w-3 h-3 text-white/50" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-white/80 leading-none">{formatTime(gameStore.timeOfDay)}</span>
                <span className="text-[8px] font-mono tracking-widest text-[#8a9ba8] leading-none mt-0.5">{getDayState(gameStore.timeOfDay)}</span>
              </div>
            </div>
          </div>

          {/* Top Center: Zone Discovery (Temporary) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 pointer-events-none">
            <span className={`font-mono text-xs tracking-[0.4em] text-white/70 uppercase transition-opacity duration-1000 ${showZone ? 'opacity-100' : 'opacity-0'}`}>
              CBD RUINS
            </span>
          </div>

          {/* Top Right: Current Objective & Pause */}
          <div className="flex flex-col items-end gap-2 mt-2 mr-2 pointer-events-auto">
             <button
              onClick={() => gameStore.toggleCameraMode()}
              className={`w-10 h-10 rounded-sm border flex items-center justify-center backdrop-blur-sm active:bg-white/10 hover:text-white hover:border-white/30 transition-all shadow-lg ${
                gameStore.cameraMode === 'third-person'
                  ? 'bg-white/85 border-white text-black'
                  : 'bg-black/40 border-white/10 text-white/50'
              }`}
              title={gameStore.cameraMode === 'third-person' ? 'Switch to first-person view' : 'Switch to third-person view'}
              aria-label={gameStore.cameraMode === 'third-person' ? 'Switch to first-person view' : 'Switch to third-person view'}
            >
              {gameStore.cameraMode === 'third-person' ? <UserRound className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
            </button>
             <button
              onClick={() => setIsPaused(true)}
              className="w-10 h-10 rounded-sm border border-white/10 bg-black/40 flex items-center justify-center text-white/50 backdrop-blur-sm active:bg-white/10 hover:text-white hover:border-white/30 transition-all shadow-lg"
              title="Pause"
              aria-label="Pause"
            >
              <Pause className="w-4 h-4 fill-current" />
            </button>
            <span className="font-mono text-[10px] tracking-widest text-white/50 uppercase">
              Find Emergency Signal
            </span>
          </div>
        </div>

        {/* Center Crosshair */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-[2px] h-[2px] rounded-full bg-white/30" />
        </div>

        {/* Bottom Controls */}
        <div className="flex justify-between items-end w-full pb-8 px-8 md:px-16 pointer-events-auto opacity-40">
          {/* Left Joystick - Movement */}
          <div className="flex flex-col items-center">
            <Joystick 
              onMove={(x, y) => { inputState.move = { x, y }; }} 
              className="border-[0.5px] border-white/10 backdrop-blur-sm"
            />
          </div>

          {/* Center Actions */}
          <div className="flex gap-4 mb-2 pointer-events-auto">
            <button
              onClick={() => gameStore.toggleFlashlight()}
              className={`w-12 h-12 rounded-full border-[0.5px] items-center justify-center flex transition-colors shadow-lg relative ${
                 gameStore.flashlightOn ? 'bg-white/90 border-white text-black' : 'bg-black/60 border-white/20 text-white/50 backdrop-blur-md'
              }`}
            >
              <Flashlight className="w-5 h-5 fill-current" />
              <div className="absolute -bottom-1 w-8 h-1 bg-black/50 rounded-full overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${gameStore.flashlightBattery}%` }} />
              </div>
            </button>
            <button 
              className="w-12 h-12 rounded-full border-[0.5px] border-white/10 bg-black/60 flex items-center justify-center text-white/50 backdrop-blur-sm active:bg-white/10 transition-colors shadow-lg"
              onPointerDown={() => { inputState.sprint = true; }}
              onPointerUp={() => { inputState.sprint = false; }}
              onPointerCancel={() => { inputState.sprint = false; }}
            >
              <span className="font-sans font-bold text-xs tracking-widest uppercase">Run</span>
            </button>
            <button
              onClick={() => setShowInventory(true)}
              className="w-12 h-12 rounded-full border-[0.5px] border-white/10 bg-black/60 flex items-center justify-center text-white/50 backdrop-blur-sm active:bg-white/10 transition-colors shadow-lg"
            >
              <Backpack className="w-5 h-5" />
            </button>
            <button 
              className="w-12 h-12 rounded-full border-[0.5px] border-white/10 bg-black/60 flex items-center justify-center text-white/50 backdrop-blur-sm active:bg-white/10 transition-colors shadow-lg"
              onPointerDown={() => { inputState.interact = true; }}
              onPointerUp={() => { inputState.interact = false; }}
              onPointerCancel={() => { inputState.interact = false; }}
              onPointerLeave={() => { inputState.interact = false; }}
            >
              <span className="font-mono font-bold text-xs tracking-widest uppercase">Take</span>
            </button>
          </div>

          {/* Right Joystick - Look */}
          <div className="flex flex-col items-center">
            <Joystick 
              onMove={(x, y) => { inputState.look = { x, y }; }} 
              className="border-[0.5px] border-white/10 backdrop-blur-sm"
            />
          </div>
        </div>
      </div>

      {/* Inventory Menu Overlay */}
      {showInventory && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-lg bg-[#0a0c10] border border-white/10 shadow-2xl relative flex flex-col h-[80vh]">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                 <Backpack className="text-white/50 w-5 h-5" />
                 <h2 className="text-lg font-mono font-bold text-white tracking-widest uppercase">Inventory</h2>
              </div>
              <button
                onClick={() => setShowInventory(false)}
                className="p-2 text-white/50 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Capacity Bar */}
            <div className="p-4 border-b border-white/5 flex flex-col gap-2">
               <div className="flex justify-between text-xs font-mono text-white/60 uppercase">
                  <span>Carry Weight</span>
                  <span>{currentWeight.toFixed(1)} / {gameStore.maxWeight.toFixed(1)} kg</span>
               </div>
               <div className="w-full h-1 bg-black rounded-full overflow-hidden">
                  <div 
                     className={`h-full transition-all ${currentWeight > gameStore.maxWeight * 0.8 ? 'bg-red-500' : 'bg-white/80'}`} 
                     style={{ width: `${Math.min(100, (currentWeight / gameStore.maxWeight) * 100)}%` }} 
                  />
               </div>
            </div>

            {/* Item List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
               {gameStore.inventory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-white/30 font-mono text-sm uppercase">
                     Backpack Empty
                  </div>
               ) : (
                  gameStore.inventory.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 hover:border-white/20 transition-colors rounded-sm">
                        <div className="flex flex-col">
                           <span className="text-white font-mono text-sm uppercase">{item.name}</span>
                           <span className="text-white/40 font-mono text-[10px] uppercase">{item.type}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-white/80 font-mono font-bold text-sm">x{item.quantity}</span>
                           <span className="text-white/40 font-mono text-[10px]">{(item.weight * item.quantity).toFixed(1)}kg</span>
                        </div>
                     </div>
                  ))
               )}
            </div>
          </div>
        </div>
      )}

      {/* Pause Menu Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto animate-in fade-in duration-200 p-4">
          <div className="w-full max-w-2xl bg-black/80 border border-white/10 shadow-2xl relative flex flex-col max-h-full">
            {/* Cinematic corners */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-white/20" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-white/20" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-white/20" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-white/20" />

            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/10">
              <h2 className="text-2xl font-sans font-bold text-red-500 tracking-[0.3em] uppercase drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
                {activeTab === 'main' ? 'Paused' : 'Settings'}
              </h2>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsPaused(false)}
                  className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-white/70 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
                >
                  Resume
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {activeTab === 'main' ? (
                <div className="flex flex-col gap-4 max-w-sm mx-auto">
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-mono uppercase tracking-widest transition-all border border-white/20 hover:border-white/40"
                  >
                    Settings
                  </button>
                  <button 
                    onClick={onMenuReturn} 
                    className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 font-mono uppercase tracking-widest transition-all border border-red-500/20 hover:border-red-500/40"
                  >
                    Abort to Menu
                  </button>
                </div>
              ) : (
                <div className="space-y-8 pb-10">
                  {/* Time Speed */}
                  <section>
                    <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Time Progression</h3>
                    <div className="flex flex-wrap gap-2">
                       {['paused', 'slow', 'normal', 'fast', 'hardcore'].map((speed) => (
                         <button
                           key={speed}
                           onClick={() => gameStore.setTimeSpeed(speed as TimeSpeed)}
                           className={`px-4 py-2 font-mono text-xs uppercase border ${gameStore.timeSpeed === speed ? 'bg-white/20 border-white text-white' : 'bg-transparent border-white/20 text-white/50 hover:bg-white/10'}`}
                         >
                           {speed}
                         </button>
                       ))}
                    </div>
                  </section>

                  {/* Gameplay */}
                  <section>
                    <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Gameplay & Camera</h3>
                    
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-mono text-white/80 flex justify-between">
                          <span>Look Sensitivity</span>
                          <span>{gameStore.cameraSensitivity.toFixed(2)}x</span>
                        </label>
                        <input 
                          type="range" min="0.1" max="2.0" step="0.1" 
                          value={gameStore.cameraSensitivity} 
                          onChange={(e) => gameStore.setSetting('cameraSensitivity', parseFloat(e.target.value))}
                          className="w-full accent-white"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/80 uppercase">Head Bobbing</span>
                        <button 
                          onClick={() => gameStore.setSetting('headBobEnabled', !gameStore.headBobEnabled)}
                          className={`w-12 h-6 flex items-center p-1 rounded-full border duration-300 ${gameStore.headBobEnabled ? 'bg-white border-white' : 'bg-[#141518] border-white/20'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-black duration-300 transform ${gameStore.headBobEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/80 uppercase">Sprint FOV / Shake</span>
                        <button 
                          onClick={() => gameStore.setSetting('sprintShakeEnabled', !gameStore.sprintShakeEnabled)}
                          className={`w-12 h-6 flex items-center p-1 rounded-full border duration-300 ${gameStore.sprintShakeEnabled ? 'bg-white border-white' : 'bg-[#141518] border-white/20'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-black duration-300 transform ${gameStore.sprintShakeEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/80 uppercase">Collision Debug</span>
                        <button
                          onClick={() => gameStore.setSetting('collisionDebug', !gameStore.collisionDebug)}
                          className={`w-12 h-6 flex items-center p-1 rounded-full border duration-300 ${gameStore.collisionDebug ? 'bg-white border-white' : 'bg-[#141518] border-white/20'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-black duration-300 transform ${gameStore.collisionDebug ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Graphics */}
                  <section>
                    <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Atmosphere & Graphics</h3>
                    
                    <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-mono text-white/80 flex justify-between">
                            <span>Fog Density</span>
                            <span>{gameStore.fogDensity.toFixed(2)}x</span>
                          </label>
                          <input 
                            type="range" min="0.1" max="2.0" step="0.1" 
                            value={gameStore.fogDensity} 
                            onChange={(e) => gameStore.setSetting('fogDensity', parseFloat(e.target.value))}
                            className="w-full accent-white"
                          />
                      </div>
                      
                      <div className="flex flex-col gap-2">
                          <label className="text-xs font-mono text-white/80 flex justify-between">
                            <span>Render Distance</span>
                            <span>{Math.round(gameStore.renderDistance)}m</span>
                          </label>
                          <input 
                            type="range" min="50" max="500" step="10" 
                            value={gameStore.renderDistance} 
                            onChange={(e) => gameStore.setSetting('renderDistance', parseFloat(e.target.value))}
                            className="w-full accent-white"
                          />
                      </div>
                    </div>
                  </section>

                  {/* Audio */}
                  <section>
                    <h3 className="text-sm font-mono text-white/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-2">Audio</h3>
                    <div className="space-y-4">
                      {['masterVolume', 'ambientVolume', 'uiVolume'].map((key) => (
                        <div key={key} className="flex flex-col gap-2">
                          <label className="text-xs font-mono text-white/80 flex justify-between uppercase">
                            <span>{key.replace('Volume', '')}</span>
                            <span>{Math.round(gameStore[key as keyof typeof gameStore] as number * 100)}%</span>
                          </label>
                          <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={gameStore[key as keyof typeof gameStore] as number} 
                            onChange={(e) => gameStore.setSetting(key as any, parseFloat(e.target.value))}
                            className="w-full accent-white"
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="pt-4 border-t border-white/10">
                     <button onClick={() => setActiveTab('main')} className="w-full py-3 border border-white/20 text-white/50 hover:bg-white/10 hover:text-white uppercase font-mono text-xs tracking-widest">
                       Back to Pause Menu
                     </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
