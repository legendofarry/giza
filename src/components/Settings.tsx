import React, { useState, useEffect } from 'react';
import { X, Volume2, Monitor, Gamepad2, Save } from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'graphics' | 'controls' | 'audio'>('graphics');
  
  // Simulated settings state
  const [masterVolume, setMasterVolume] = useState(80);
  const [sfxVolume, setSfxVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(60);
  
  const [sensitivity, setSensitivity] = useState(50);
  const [invertY, setInvertY] = useState(false);
  
  const [quality, setQuality] = useState('High');
  const [shadows, setShadows] = useState(true);
  const [fogDensity, setFogDensity] = useState('Thick');

  const tabs = [
    { id: 'graphics', label: 'Graphics', icon: Monitor },
    { id: 'controls', label: 'Controls', icon: Gamepad2 },
    { id: 'audio', label: 'Audio', icon: Volume2 },
  ] as const;

  return (
    <div className="relative z-20 w-full h-full flex flex-col uppercase font-mono tracking-widest text-sm text-gray-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-white font-sans font-bold tracking-[0.2em] drop-shadow-md">System Configuration</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/10 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-40 border-r border-white/10 p-4 space-y-2 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center w-full gap-2 py-4 px-2 transition-colors ${
                  isActive 
                    ? 'text-red-500' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-6 h-6 drop-shadow-md" />
                <span className="text-[10px] drop-shadow-md">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-8">
          {activeTab === 'graphics' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-red-500 font-bold border-b border-white/10 pb-2 drop-shadow-md">Rendering Pipeline</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 border-b border-white/5">
                  <span className="drop-shadow-md text-white">Graphics Quality</span>
                  <select 
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="bg-transparent border-b border-white/20 p-1 outline-none text-white focus:border-red-500 text-right"
                  >
                    <option className="bg-black text-white">Low</option>
                    <option className="bg-black text-white">Medium</option>
                    <option className="bg-black text-white">High</option>
                    <option className="bg-black text-white">Ultra</option>
                  </select>
                </div>

                <div className="flex justify-between items-center p-3 border-b border-white/5">
                  <span className="drop-shadow-md text-white">Dynamic Shadows</span>
                  <button 
                    onClick={() => setShadows(!shadows)}
                    className={`w-12 h-6 border ${shadows ? 'border-red-500 bg-red-500/20' : 'border-white/20 bg-transparent'} relative transition-colors`}
                  >
                    <div className={`absolute top-0.5 bottom-0.5 w-4 bg-white transition-all ${shadows ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex justify-between items-center p-3 border-b border-white/5">
                  <span className="drop-shadow-md text-white">Volumetric Fog</span>
                  <select 
                    value={fogDensity}
                    onChange={(e) => setFogDensity(e.target.value)}
                    className="bg-transparent border-b border-white/20 p-1 outline-none text-white focus:border-red-500 text-right"
                  >
                    <option className="bg-black text-white">Off</option>
                    <option className="bg-black text-white">Light</option>
                    <option className="bg-black text-white">Thick</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-red-500 font-bold border-b border-white/10 pb-2 drop-shadow-md">Mobile Interface</h3>
              
              <div className="space-y-4">
                <div className="space-y-2 p-3 border-b border-white/5">
                  <div className="flex justify-between">
                    <span className="drop-shadow-md text-white">Look Sensitivity</span>
                    <span className="text-white drop-shadow-md">{sensitivity}%</span>
                  </div>
                  <input 
                    type="range" min="10" max="100" 
                    value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                <div className="flex justify-between items-center p-3 border-b border-white/5">
                  <span className="drop-shadow-md text-white">Invert Y-Axis</span>
                  <button 
                    onClick={() => setInvertY(!invertY)}
                    className={`w-12 h-6 border ${invertY ? 'border-red-500 bg-red-500/20' : 'border-white/20 bg-transparent'} relative transition-colors`}
                  >
                    <div className={`absolute top-0.5 bottom-0.5 w-4 bg-white transition-all ${invertY ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-red-500 font-bold border-b border-white/10 pb-2 drop-shadow-md">Acoustic Sensors</h3>
              
              <div className="space-y-4">
                <div className="space-y-2 p-3 border-b border-white/5">
                  <div className="flex justify-between">
                    <span className="drop-shadow-md text-white">Master Output</span>
                    <span className="text-white drop-shadow-md">{masterVolume}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))}
                    className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                <div className="space-y-2 p-3 border-b border-white/5">
                  <div className="flex justify-between">
                    <span className="drop-shadow-md text-white">SFX & Effects</span>
                    <span className="text-white drop-shadow-md">{sfxVolume}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={sfxVolume} onChange={(e) => setSfxVolume(Number(e.target.value))}
                    className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                <div className="space-y-2 p-3 border-b border-white/5">
                  <div className="flex justify-between">
                    <span className="drop-shadow-md text-white">Atmospheric Music</span>
                    <span className="text-white drop-shadow-md">{musicVolume}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" 
                    value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))}
                    className="w-full h-1 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-white/10 flex justify-end">
        <button 
          onClick={onClose}
          className="flex items-center gap-2 px-6 py-2 bg-transparent hover:bg-white/10 text-white transition-colors border-b border-white/20 hover:border-white/40"
        >
          <Save className="w-4 h-4" />
          Apply & Return
        </button>
      </div>
    </div>
  );
}
