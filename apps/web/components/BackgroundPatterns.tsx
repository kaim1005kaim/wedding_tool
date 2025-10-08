'use client';

export type PatternType = 'dot' | 'stripe' | 'wave' | 'border' | 'ring-dot' | 'chevron';

interface PatternBackgroundProps {
  pattern: PatternType;
  className?: string;
}

export function PatternBackground({ pattern, className = '' }: PatternBackgroundProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Dot Pattern */}
          <pattern id="dot-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="40" cy="40" r="28" fill="#FF6B35" />
          </pattern>

          {/* Stripe Pattern */}
          <pattern id="stripe-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect x="0" y="0" width="40" height="80" fill="#FFD23F" />
          </pattern>

          {/* Wave Pattern */}
          <pattern id="wave-pattern" x="0" y="0" width="100" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 0 30 Q 12.5 10, 25 30 T 50 30 T 75 30 T 100 30"
              stroke="#E63946"
              strokeWidth="18"
              fill="none"
              strokeLinecap="round"
            />
          </pattern>

          {/* Border/Vertical Stripe Pattern */}
          <pattern id="border-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="40" height="80" fill="#1D9BF0" />
          </pattern>

          {/* Ring Dot Pattern */}
          <pattern id="ring-dot-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="40" cy="40" r="24" stroke="#FF6BA8" strokeWidth="10" fill="none" />
          </pattern>

          {/* Chevron Pattern */}
          <pattern id="chevron-pattern" x="0" y="0" width="100" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 0 30 L 25 10 L 50 30 L 75 10 L 100 30 L 100 50 L 75 30 L 50 50 L 25 30 L 0 50 Z"
              fill="#2A9D8F"
            />
          </pattern>
        </defs>

        {pattern === 'dot' && <rect width="100%" height="100%" fill="url(#dot-pattern)" />}
        {pattern === 'stripe' && <rect width="100%" height="100%" fill="url(#stripe-pattern)" />}
        {pattern === 'wave' && <rect width="100%" height="100%" fill="url(#wave-pattern)" />}
        {pattern === 'border' && <rect width="100%" height="100%" fill="url(#border-pattern)" />}
        {pattern === 'ring-dot' && <rect width="100%" height="100%" fill="url(#ring-dot-pattern)" />}
        {pattern === 'chevron' && <rect width="100%" height="100%" fill="url(#chevron-pattern)" />}
      </svg>
    </div>
  );
}

// Component for random decorative shapes
export function DecorativeShapes({ variant = 'mixed' }: { variant?: 'mixed' | 'circles' | 'squares' }) {
  const shapes = variant === 'circles' ? [
    { type: 'circle', color: '#FF6B35', size: 60, top: '10%', left: '5%' },
    { type: 'circle', color: '#1D9BF0', size: 80, top: '70%', left: '80%' },
    { type: 'circle', color: '#FFD23F', size: 50, top: '40%', left: '90%' },
  ] : variant === 'squares' ? [
    { type: 'square', color: '#E63946', size: 60, top: '15%', left: '85%', rotate: 45 },
    { type: 'square', color: '#2A9D8F', size: 70, top: '75%', left: '10%', rotate: 15 },
  ] : [
    { type: 'circle', color: '#FF6B35', size: 60, top: '10%', left: '5%' },
    { type: 'square', color: '#E63946', size: 60, top: '15%', left: '85%', rotate: 45 },
    { type: 'circle', color: '#1D9BF0', size: 80, top: '70%', left: '80%' },
    { type: 'square', color: '#2A9D8F', size: 70, top: '75%', left: '10%', rotate: 15 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {shapes.map((shape, index) => (
        <div
          key={index}
          className="absolute opacity-20"
          style={{
            top: shape.top,
            left: shape.left,
            width: `${shape.size}px`,
            height: `${shape.size}px`,
            backgroundColor: shape.color,
            borderRadius: shape.type === 'circle' ? '50%' : '0',
            transform: shape.type === 'square' && shape.rotate ? `rotate(${shape.rotate}deg)` : undefined,
          }}
        />
      ))}
    </div>
  );
}
