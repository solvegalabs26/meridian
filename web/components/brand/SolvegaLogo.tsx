interface SolvegaLogoProps {
  size?: number
  showWordmark?: boolean
  orientation?: 'horizontal' | 'stacked'
  className?: string
}

export default function SolvegaLogo({
  size = 32,
  showWordmark = true,
  orientation = 'horizontal',
  className,
}: SolvegaLogoProps) {
  const stacked = orientation === 'stacked'

  return (
    <div className={`flex items-center ${stacked ? 'flex-col text-center gap-1.5' : 'flex-row gap-2.5'} ${className ?? ''}`}>
      <svg
        width={size}
        height={size * 1.1}
        viewBox="0 0 32 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Solvega Labs delta mark"
      >
        {/* Upper delta — navigation waypoint */}
        <polygon points="0,22 16,0 32,22 16,13" fill="#2E7CB8" />
        {/* Lower delta — depth shadow */}
        <polygon points="4.5,24 16,35 27.5,24 16,29.5" fill="#5090C0" opacity="0.62" />
        {/* Prime meridian dashed line */}
        <line
          x1="16" y1="0" x2="16" y2="35"
          stroke="rgba(255,255,255,0.16)" strokeWidth="0.8"
          strokeDasharray="2.5,3"
        />
      </svg>

      {showWordmark && (
        <div>
          <div
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontWeight: 400,
              fontSize: size * 0.6,
              lineHeight: 1.1,
              color: '#fff',
            }}
          >
            Solvega
          </div>
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 500,
              fontSize: size * 0.28,
              letterSpacing: '5.5px',
              color: '#5090C0',
              marginTop: 2,
            }}
          >
            LABS
          </div>
        </div>
      )}
    </div>
  )
}
