import React, { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onMove: (x: number, y: number) => void;
  size?: number;
  color?: string;
  className?: string;
}

export function Joystick({ onMove, size = 120, color = 'rgba(255, 255, 255, 0.05)', className = '' }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [identifier, setIdentifier] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (active) return;
    setActive(true);
    setIdentifier(e.pointerId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updatePosition(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!active || e.pointerId !== identifier) return;
    updatePosition(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== identifier) return;
    setActive(false);
    setIdentifier(null);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const updatePosition = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate delta relative to center, clamped to radius
    const maxRadius = size / 2;
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    setPosition({ x: dx, y: dy });
    onMove(dx / maxRadius, dy / maxRadius);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative touch-none rounded-full flex items-center justify-center ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div 
        className="absolute rounded-full shadow-lg pointer-events-none transition-transform duration-75 border-[0.5px] border-white/20 bg-white/10"
        style={{ 
          width: size * 0.35, 
          height: size * 0.35,
          transform: `translate(${position.x}px, ${position.y}px)`,
          backdropFilter: 'blur(2px)'
        }}
      />
    </div>
  );
}
