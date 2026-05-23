import React, { useState, Suspense } from 'react';
import { ChevronRight, User, UserRound } from 'lucide-react';
import { playerState } from '../store';
import { Canvas } from '@react-three/fiber';
import { ArchetypeModel } from './ArchetypeModel';
import bgImage from '../assets/images/nairobi_ruins_bg_1779518130080.png';

const CHARACTERS = [
  { id: 'rastaGirl', name: 'Rasta Girl', icon: UserRound, description: 'Agile survivor profile. Quick movement and sharp environmental awareness.' },
  { id: 'rastaPerson', name: 'Rasta Person', icon: User, description: 'Steady survivor profile. Durable presence and reliable field control.' },
] as const;

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<string>('rastaGirl');

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) return;
      setStep(2);
    } else {
      playerState.name = name.trim();
      playerState.archetype = selectedCharacter;
      playerState.character = selectedCharacter;
      localStorage.setItem('giza_onboarding_complete', 'true');
      localStorage.setItem('giza_player_config', JSON.stringify({ name: name.trim(), character: selectedCharacter }));
      onComplete();
    }
  };

  const selectedCharacterInfo = CHARACTERS.find(character => character.id === selectedCharacter);

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-luminosity duration-1000 animate-in fade-in"
        style={{ backgroundImage: `url(${bgImage})`, transform: 'scale(1.02)' }}
      />
      
      {/* Cinematic Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/50 to-black pointer-events-none" />

      {/* 3D Canvas Base */}
      {step === 2 && (
        <div className="absolute inset-0 z-0 animate-in fade-in duration-1000">
          <Canvas shadows camera={{ position: [0, 0.1, 5.1], fov: 34 }}>
            <Suspense fallback={null}>
              <ArchetypeModel archetype={selectedCharacter} />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Header */}
        <div className="absolute top-6 left-6 md:top-12 md:left-12 pointer-events-auto">
          <h2 className="text-2xl md:text-3xl font-sans font-bold tracking-[0.2em] text-red-500 uppercase drop-shadow-lg">
            {step === 1 ? 'Subject Identification' : 'Select Character'}
          </h2>
        </div>

        {/* Content */}
        {step === 1 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto animate-in zoom-in-95 duration-300">
            <div className="w-full max-w-md space-y-6 p-8">
              <div className="flex items-center gap-4 bg-white/5 p-4 transition-colors border-b border-white/20 focus-within:border-red-500">
                <User className="text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  placeholder="ENTER CALLSIGN"
                  maxLength={12}
                  className="w-full bg-transparent border-none outline-none text-white font-mono text-xl tracking-widest placeholder:text-white/20"
                  autoFocus
                />
              </div>
              <p className="text-center font-mono text-[10px] text-gray-500 uppercase tracking-widest">
                Maximum 12 characters. Alphanumeric only.
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 pointer-events-none animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Left Info Overlay */}
            <div className="absolute bottom-12 left-12 w-72 md:w-80 lg:w-96 pointer-events-auto p-0">
              <h3 className="font-sans font-bold text-white tracking-[0.2em] text-lg lg:text-xl uppercase mb-4 flex items-center gap-3 drop-shadow-md">
                {selectedCharacterInfo?.icon && React.createElement(selectedCharacterInfo.icon, { className: "w-5 h-5 lg:w-6 lg:h-6 text-red-500" })}
                {selectedCharacterInfo?.name}
              </h3>
              <p className="font-mono text-xs lg:text-sm text-gray-300 uppercase tracking-wider leading-relaxed drop-shadow-md">
                {selectedCharacterInfo?.description}
              </p>
            </div>

            {/* Right Selection Icons */}
            <div className="absolute top-1/2 right-4 md:right-8 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto text-white">
              {CHARACTERS.map((character) => {
                const Icon = character.icon;
                const isSelected = selectedCharacter === character.id;
                return (
                  <button
                    key={character.id}
                    onClick={() => setSelectedCharacter(character.id)}
                    className={`relative flex items-center justify-center p-3 md:p-4 rounded-full transition-all duration-300 group ${
                      isSelected 
                        ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(255,0,0,0.5)]' 
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    title={character.id}
                    aria-label={character.name}
                  >
                    <Icon className={`w-5 h-5 md:w-6 md:h-6 transition-colors`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Floating Action Next Button */}
        <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 pointer-events-auto">
          <button
            onClick={handleNext}
            disabled={step === 1 && !name.trim()}
            className="group flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-full bg-red-600/90 hover:bg-red-500 disabled:bg-black/80 disabled:border-2 disabled:border-white/10 disabled:text-gray-600 text-white transition-all shadow-[0_0_20px_rgba(255,0,0,0.4)] disabled:shadow-none hover:shadow-[0_0_30px_rgba(255,0,0,0.6)]"
            title={step === 1 ? 'Continue' : 'Confirm & Deploy'}
          >
            <ChevronRight className={`w-8 h-8 ${step === 1 && name.trim() ? 'group-hover:translate-x-1 transition-transform' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
