import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

export function AudioEnvironment() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const dayGainRef = useRef<GainNode | null>(null);
  const nightGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timeRef = useRef(useGameStore.getState().timeOfDay);

  const ambientVolume = useGameStore(state => state.ambientVolume);
  const masterVolume = useGameStore(state => state.masterVolume);

  useEffect(() => {
    // Only initialize after user interaction (handled naturally in game)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    // Very basic generative audio
    const ctx = new AudioContextClass();
    audioCtxRef.current = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume * ambientVolume;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    // Day Ambience (High Pass Noise / Birds proxy)
    const dayGain = ctx.createGain();
    dayGain.gain.value = 0;
    dayGain.connect(masterGain);
    dayGainRef.current = dayGain;

    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; // White noise
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400; // wind like
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(dayGain);
    noiseSource.start();

    // Night Ambience (Low Rumble / Drone proxy)
    const nightGain = ctx.createGain();
    nightGain.gain.value = 0;
    nightGain.connect(masterGain);
    nightGainRef.current = nightGain;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55; // Low bass 
    osc.connect(nightGain);
    osc.start();

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 58; // dissonant slowly beating
    osc2.connect(nightGain);
    osc2.start();

    // Interval to slowly update volumes without React re-renders
    const interval = setInterval(() => {
        const time = useGameStore.getState().timeOfDay;
        let dayTarget = 0;
        let nightTarget = 0;

        if (time >= 6 && time < 18) {
            dayTarget = 0.5;
            nightTarget = 0.0;
            // Sunrise/Sunset fade
            if (time < 8) dayTarget = (time - 6) / 2 * 0.5;
            if (time > 16) dayTarget = (18 - time) / 2 * 0.5;
        } else {
            dayTarget = 0.0;
            nightTarget = 0.5;
            // Dawn/Dusk fade
            if (time >= 4 && time < 6) nightTarget = (6 - time) / 2 * 0.5;
            if (time >= 18 && time < 20) nightTarget = (time - 18) / 2 * 0.5;
        }

        const currVol = useGameStore.getState().masterVolume * useGameStore.getState().ambientVolume;
        
        if (dayGainRef.current) {
           dayGainRef.current.gain.setTargetAtTime(dayTarget, ctx.currentTime, 1.0); // 1.0s time constant
        }
        if (nightGainRef.current) {
           nightGainRef.current.gain.setTargetAtTime(nightTarget, ctx.currentTime, 1.0);
        }
        if (masterGainRef.current) {
           masterGainRef.current.gain.setTargetAtTime(currVol, ctx.currentTime, 0.1);
        }
    }, 1000);

    return () => {
       clearInterval(interval);
       noiseSource.stop();
       osc.stop();
       osc2.stop();
       ctx.close();
    };
  }, []);

  return null;
}
