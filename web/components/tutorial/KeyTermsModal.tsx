'use client'

import { X } from 'lucide-react'

// Hardcoded palette — do NOT replace with CSS custom properties.
// Self-contained overlay; must not respond to dark-mode ancestors.
const P = {
  navy:  '#0D1B3E',
  navy2: '#12244F',
  gold:  '#C9A227',
  ink:   '#0D1B3E',
  body:  '#33405F',
  line:  '#E4E8F2',
  white: '#FFFFFF',
} as const

const TERMS = [
  {
    term: 'Meridian Arc',
    definition: 'An AI-powered intelligence platform that monitors your most important goals by automatically scanning news, market data, and industry signals relevant to your specific objectives. Each week it synthesizes what it finds into a confidence score and a list of recommended actions — so you know what changed, what matters, and what to do next.',
  },
  {
    term: 'Objective',
    definition: 'A specific, measurable goal you are actively working toward — with a clear outcome, a success condition, and a target date. Not a vague aspiration; a specific commitment with a date. Example: "Increase profits by 5% by end of Q3 2026." Meridian tracks every signal that affects whether you reach it.',
  },
  {
    term: 'Signal',
    definition: 'A piece of information from the world relevant to one of your objectives that may affect whether you achieve it. Signals can raise your confidence (a positive indicator) or lower it (a risk or blocker). Example: a supplier price increase is a risk signal for a margin objective; a competitor exiting your region is an opportunity signal.',
  },
  {
    term: 'Sweep',
    definition: "Meridian's weekly automated scan. Once a week it searches hundreds of news sources, market data feeds, and industry publications for signals relevant to your objectives and keywords, filters the noise, and synthesizes the results into your weekly brief.",
  },
  {
    term: 'Confidence %',
    definition: "A number from 0 to 100 representing the current estimated probability of achieving your objective by its target date, based on the signals Meridian has found. Not a guarantee — an educated estimate that updates weekly. 85%+ = strong momentum; 60–84% = on track, watch the risks; 40–59% = meaningful uncertainty, take action; below 40% = significant blockers, priority review. You're the expert on your own goals — if a score feels wrong, trust your gut.",
  },
]

interface KeyTermsModalProps {
  open: boolean
  onClose: () => void
}

export default function KeyTermsModal({ open, onClose }: KeyTermsModalProps) {
  if (!open) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} role="dialog" aria-modal="true" aria-label="Key Terms and Definitions">
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,16,38,.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} aria-hidden="true" />

      {/* Modal: explicit #FFFFFF bg + ink text — blocks any dark-mode ancestor cascade */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '85vh', backgroundColor: P.white, color: P.ink, borderRadius: 16, boxShadow: '0 30px 70px rgba(9,16,38,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Navy header band ─────────────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.navy2})`, padding: '18px 22px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: "'EB Garamond', serif", fontSize: 22, fontWeight: 500, color: P.white, margin: 0 }}>Key Terms &amp; Definitions</h3>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,.12)', color: '#AEB9D6' }}
            onMouseEnter={e => { e.currentTarget.style.color = P.white }}
            onMouseLeave={e => { e.currentTarget.style.color = '#AEB9D6' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable terms ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px' }}>
          {TERMS.map(({ term, definition }, i) => (
            <div key={term} style={{ padding: '16px 0', borderBottom: i < TERMS.length - 1 ? `1px solid ${P.line}` : 'none' }}>
              <p style={{ fontFamily: "'EB Garamond', serif", fontSize: 16, fontWeight: 500, color: P.ink, margin: '0 0 6px' }}>{term}</p>
              <p style={{ fontSize: 12.5, lineHeight: 1.65, color: P.body, margin: 0 }}>{definition}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${P.line}`, backgroundColor: P.white, flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', backgroundColor: P.navy, color: P.white, border: 'none' }}
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  )
}
