import React, { useState } from 'react';
// Import the generated background image
import bgImage from '../assets/images/nairobi_ruins_bg_1779518130080.png';
import { Settings as SettingsIcon, Play, RadioReceiver } from 'lucide-react';
import { Settings } from './Settings';

export function Menu({ onStart }: { onStart: () => void }) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black select-none pointer-events-auto">
      {/* Background Image Fill */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-luminosity duration-1000 animate-in fade-in"
        style={{ backgroundImage: `url(${bgImage})`, transform: 'scale(1.02)' }}
      />
      
      {/* Cinematic Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/50 to-black pointer-events-none" />

      {/* Floating Dust Particles Placeholder */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Overlay Content */}
      {!showSettings ? (
        <>
          <div className="absolute top-6 right-6 z-20">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 bg-black/40 border border-white/20 rounded-full text-gray-300 hover:text-white hover:bg-white/10 backdrop-blur-md transition-all shadow-lg group hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]"
              title="System Configuration"
            >
              <SettingsIcon className="w-5 h-5 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-between h-[80%] w-full max-w-4xl px-8 py-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
            
            <div className="text-center space-y-8 mt-12">
            <h1 className="text-6xl md:text-8xl font-sans font-bold tracking-[0.4em] text-white uppercase drop-shadow-[0_0_15px_rgba(255,0,0,0.3)]">
              GIZA
            </h1>
            
            <div className="flex items-center justify-center gap-4 text-gray-400 font-mono tracking-[0.4em] text-xs uppercase">
              <span className="w-12 h-[1px] bg-red-500/50" />
              <span>NAIRO-BERY</span>
              <span className="w-12 h-[1px] bg-red-500/50" />
            </div>
          </div>

          <div className="flex flex-col gap-4 w-full md:w-72 mt-auto">
            <button 
              onClick={onStart}
              className="group flex justify-between items-center bg-red-600/90 hover:bg-red-500 text-white py-4 px-6 border border-red-400 shadow-[0_0_20px_rgba(255,0,0,0.3)] backdrop-blur-md transition-all uppercase tracking-widest font-mono text-sm relative overflow-hidden"
            >
              <div className="absolute inset-0 w-0 bg-white/20 transition-all duration-300 ease-out group-hover:w-full" />
              <span className="relative z-10 font-bold">Initiate Sequence</span>
              <Play className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <div className="mt-4 text-center">
              <p className="text-[#a0a0a0] text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-2">
                <RadioReceiver className="w-3 h-3 text-red-500" />
                Network Connected. Build: v0.1.4
              </p>
            </div>
          </div>
        </div>
        </>
      ) : (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
