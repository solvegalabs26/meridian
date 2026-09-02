'use client'
import { useState } from 'react'

const BLUE  = '#2D6BE4'
const TEXT  = '#1A1A2E'
const MUTED = '#6B7280'

const CHAR_THRESHOLD = 400

interface ExpandableSectionProps {
  label: string
  content: string
  defaultLines?: number
}

export function ExpandableSection({ label, content, defaultLines = 4 }: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length >= CHAR_THRESHOLD

  return (
    <div>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 0.8, color: BLUE, marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={!expanded && isLong ? {
        display: '-webkit-box',
        WebkitLineClamp: defaultLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        fontSize: 11,
        color: TEXT,
        lineHeight: 1.5,
      } : {
        fontSize: 11,
        color: TEXT,
        lineHeight: 1.5,
      }}>
        {content}
      </div>
      {isLong ? (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            marginTop: 5,
            background: 'none',
            border: 'none',
            padding: 0,
            color: BLUE,
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: 0.2,
          }}
        >
          {expanded ? 'Read less ↑' : 'Read more ↓'}
        </button>
      ) : (
        /* spacer so the grid row height stays stable when siblings have a toggle */
        <div style={{ height: 19 }} aria-hidden />
      )}
      {!isLong && content.length === 0 && (
        <span style={{ fontSize: 10, color: MUTED, fontStyle: 'italic' }}>No data</span>
      )}
    </div>
  )
}
