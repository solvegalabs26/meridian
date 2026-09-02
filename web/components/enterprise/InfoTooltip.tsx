'use client'
import { useState } from 'react'

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
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
          bottom: '120%',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f2937',
          color: '#f9fafb',
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 12,
          width: 200,
          zIndex: 50,
          lineHeight: 1.4,
          whiteSpace: 'normal',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}
