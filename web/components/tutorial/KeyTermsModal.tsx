'use client'

import { X } from 'lucide-react'

interface KeyTermsModalProps {
  open: boolean
  onClose: () => void
}

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
    definition: 'A number from 0 to 100 representing the current estimated probability of achieving your objective by its target date, based on the signals Meridian has found. Not a guarantee — an educated estimate that updates weekly. 85%+ = strong momentum; 60–84% = on track, watch the risks; 40–59% = meaningful uncertainty, take action; below 40% = significant blockers, priority review. You\'re the expert on your own goals — if a score feels wrong, trust your gut.',
  },
]

export default function KeyTermsModal({ open, onClose }: KeyTermsModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Key Terms and Definitions">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--white)', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold text-[var(--text)]">Key Terms &amp; Definitions</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text3)] hover:bg-[var(--gray-lt)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable terms */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {TERMS.map(({ term, definition }) => (
            <div key={term}>
              <p className="text-[13px] font-semibold text-[var(--text)] mb-1">{term}</p>
              <p className="text-[13px] leading-relaxed text-[var(--text2)]">{definition}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg text-[14px] font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--navy)', color: '#fff' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
