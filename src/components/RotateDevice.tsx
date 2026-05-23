import React from 'react';
import { RefreshCw } from 'lucide-react';

export function RotateDevice() {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-8 text-center select-none">
      <RefreshCw className="w-16 h-16 mb-6 text-red-500 animate-spin-slow" style={{ animationDuration: '3s' }} />
      <h2 className="text-2xl font-mono font-bold tracking-widest uppercase mb-4 text-red-500">Rotate Device</h2>
      <p className="font-sans text-gray-400 tracking-wide uppercase text-sm max-w-sm">
        GIZA requires landscape orientation for optimal survival experience.
      </p>
      <p className="mt-8 text-xs font-mono text-gray-600 uppercase tracking-widest animate-pulse">
        Waiting for orientation change...
      </p>
    </div>
  );
}
