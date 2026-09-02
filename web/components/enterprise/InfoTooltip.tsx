'use client'
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

export function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const iconRef = useRef<HTMLSpanElement>(null)

  function handleMouseEnter() {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect()
      setCoords({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX + rect.width / 2,
      })
    }
    setVisible(true)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <span
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        style={{ cursor: 'pointer', fontSize: 11, color: '#5090C0' }}
      >
        ⓘ
      </span>
      {visible && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'absolute',
          top: coords.top,
          left: coords.left,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#0D1B3E',
          color: '#ffffff',
          border: '1px solid rgba(46,124,184,0.4)',
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 12,
          width: 220,
          zIndex: 9999,
          lineHeight: 1.5,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
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
        </div>,
        document.body
      )}
    </span>
  )
}
