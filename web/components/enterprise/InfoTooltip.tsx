'use client'
import { useState } from 'react'

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4, overflow: 'visible' }}>
      <span
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        style={{ cursor: 'pointer', fontSize: 11, color: '#9ca3af' }}
      >
        ⓘ
      </span>
      {visible && (
        <div style={{
          position: 'absolute',
          bottom: '130%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#0D1B3E',
          color: '#ffffff',
          border: '1px solid rgba(255,255,255,0.12)',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          width: 220,
          zIndex: 9999,
          lineHeight: 1.5,
          whiteSpace: 'normal',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {text}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid #0D1B3E',
          }} />
        </div>
      )}
    </span>
  )
}
