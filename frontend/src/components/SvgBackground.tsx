'use client'

export function SvgBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" className="text-slate-300/40" />
          </pattern>
          <radialGradient id="dot-fade" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="dot-mask">
            <rect width="100%" height="100%" fill="url(#dot-fade)" />
          </mask>
          <radialGradient id="glow-cyan" cx="15%" cy="10%" r="40%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-royal" cx="85%" cy="15%" r="40%">
            <stop offset="0%" stopColor="#3b4ff0" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#3b4ff0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="glow-bottom" cx="55%" cy="100%" r="35%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#dot-grid)" mask="url(#dot-mask)" />
        <rect width="100%" height="100%" fill="url(#glow-cyan)" />
        <rect width="100%" height="100%" fill="url(#glow-royal)" />
        <rect width="100%" height="100%" fill="url(#glow-bottom)" />

        <g stroke="#06b6d4" strokeWidth="0.6" fill="none" opacity="0.18">
          <ellipse cx="-60" cy="-60" rx="260" ry="260" />
          <ellipse cx="-60" cy="-60" rx="340" ry="340" />
          <ellipse cx="-60" cy="-60" rx="420" ry="420" />
        </g>
        <g stroke="#3b4ff0" strokeWidth="0.6" fill="none" opacity="0.12">
          <ellipse cx="110%" cy="110%" rx="280" ry="280" />
          <ellipse cx="110%" cy="110%" rx="380" ry="380" />
        </g>
      </svg>
    </div>
  )
}
