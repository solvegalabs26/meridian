'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

interface TutorialModalProps {
  open: boolean
  onClose: () => void
  startPage?: number
  onOpenKeyTerms?: () => void
}

const PAGES = [
  {
    kicker: 'Getting Started · 1 of 5',
    title: 'Welcome to Meridian Arc',
    subtitle: 'Signals from everywhere. Your heading, straight ahead.',
    body: 'Meridian Arc watches your most important goals and brings the signals that matter to your priority focus. Your dashboard has three things: Your Goals, This Week\'s Brief, and Ask Meridian Arc. This quick tour walks you through each.',
  },
  {
    kicker: 'Your Goals · 2 of 5',
    title: 'Open a goal to see what\'s moving it',
    subtitle: 'Every goal shows a live on-track score and the intelligence behind it.',
    body: 'Click any goal to open it. The ring shows your on-track score and the badge tells you its health at a glance. The "What\'s affecting it" tab lists the signals moving your score up or down — so you always know why the number is what it is.',
  },
  {
    kicker: 'Your Goals · 3 of 5',
    title: 'Do the next thing — then log it',
    subtitle: 'Meridian recommends what to do. You check it off.',
    body: 'Open "What to do" for the actions Meridian recommends. When you finish one, tap the checkbox to log it as complete — your progress feeds back into the score. Forgot what the goal actually was? The "Goal" tab always shows your original objective in your own words.',
  },
  {
    kicker: 'This Week\'s Brief · 4 of 5',
    title: 'See what happened this week',
    subtitle: 'Signals delivered as plain-language story cards.',
    body: 'This Week\'s Brief is where you see what happened. Each week Meridian sweeps the news, data, and industry signals tied to your goals and delivers them as plain-language cards — Risk, Opportunity, Insight, Action. No reports to read. Just what changed and what it means.',
  },
  {
    kicker: 'Ask Meridian Arc · 5 of 5',
    title: 'Ask anytime — and revisit this tour',
    subtitle: 'Help is always one click away.',
    body: null, // rendered with inline KeyTerms link
  },
]

function Page1Illustration() {
  const tiles = [
    { label: 'Your Goals', desc: 'The objectives you\'re tracking, each with a live on-track score.' },
    { label: 'This Week\'s Brief', desc: 'What changed — the signals Meridian found for you this week.' },
    { label: 'Ask Meridian Arc', desc: 'Ask questions or get hints about any goal, anytime.' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {tiles.map(t => (
        <div key={t.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)' }}>
          <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--gold)' }}>{t.label}</p>
          <p className="text-[10px] leading-tight" style={{ color: 'var(--ov-text-mid)' }}>{t.desc}</p>
        </div>
      ))}
    </div>
  )
}

function Page2Illustration() {
  return (
    <div className="w-full rounded-xl p-4" style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)' }}>
      <div className="flex items-start gap-3 mb-3">
        {/* Confidence ring mock */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center relative" style={{ background: 'conic-gradient(#C9A227 256deg, rgba(255,255,255,0.08) 0deg)' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--ov-navy-card)' }}>
            <span className="text-[11px] font-bold" style={{ color: 'var(--gold)' }}>71%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium leading-snug" style={{ color: 'var(--ov-text-hi)' }}>Increase profits by 5% by end of Q3 2026</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(201,162,39,0.18)', color: 'var(--gold)' }}>WATCH</span>
        </div>
      </div>
      <div className="flex gap-1">
        {["What's affecting it", 'What to do', 'Goal'].map((tab, i) => (
          <div
            key={tab}
            className="px-2.5 py-1 rounded-lg text-[10px]"
            style={{
              backgroundColor: i === 0 ? 'rgba(201,162,39,0.12)' : 'transparent',
              color: i === 0 ? 'var(--gold)' : 'var(--ov-text-dim)',
              border: i === 0 ? '1px solid rgba(201,162,39,0.3)' : '1px solid transparent',
            }}
          >
            {tab}
          </div>
        ))}
      </div>
    </div>
  )
}

function Page3Illustration() {
  return (
    <div className="w-full rounded-xl p-4" style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)' }}>
      <div className="flex gap-1 mb-3">
        {["What's affecting it", 'What to do', 'Goal'].map((tab, i) => (
          <div
            key={tab}
            className="px-2.5 py-1 rounded-lg text-[10px]"
            style={{
              backgroundColor: i === 1 ? 'rgba(201,162,39,0.12)' : 'transparent',
              color: i === 1 ? 'var(--gold)' : 'var(--ov-text-dim)',
              border: i === 1 ? '1px solid rgba(201,162,39,0.3)' : '1px solid transparent',
            }}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-start gap-2">
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ov-green)' }} />
          <div>
            <p className="text-[11px] line-through" style={{ color: 'var(--ov-text-dim)' }}>Lock in Q3 supplier pricing before the announced 8% increase</p>
            <span className="text-[9px] font-semibold" style={{ color: 'var(--ov-green)' }}>Done</span>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Circle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ov-text-dim)' }} />
          <p className="text-[11px]" style={{ color: 'var(--ov-text-hi)' }}>Raise service pricing on the top 3 margin lines by Aug 1</p>
        </div>
      </div>
    </div>
  )
}

function Page4Illustration() {
  return (
    <div className="w-full space-y-2">
      <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(192,64,42,0.12)', border: '1px solid rgba(192,64,42,0.25)' }}>
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ov-red)' }}>Risk</span>
        <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--ov-text-hi)' }}>Key supplier announced an 8% price increase effective Aug 1 — margin pressure on your Q3 profit goal.</p>
      </div>
      <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(58,153,80,0.12)', border: '1px solid rgba(58,153,80,0.25)' }}>
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ov-green)' }}>Opportunity</span>
        <p className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--ov-text-hi)' }}>Competitor exited your region this month — pricing room opened on your top service lines.</p>
      </div>
    </div>
  )
}

function Page5Illustration() {
  return (
    <div className="w-full rounded-xl overflow-hidden" style={{ border: '1px solid var(--ov-border-md)' }}>
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--ov-navy-card)' }}>
        <p className="text-[11px]" style={{ color: 'var(--ov-text-dim)' }}>Ask Meridian Arc anything about your goals…</p>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5" style={{ backgroundColor: 'rgba(13,27,42,0.5)', borderTop: '1px solid var(--ov-border)' }}>
        {['Why did my score drop?', 'What should I focus on?', 'Explain this signal.'].map(chip => (
          <span
            key={chip}
            className="px-2.5 py-1 rounded-full text-[10px] font-medium"
            style={{ backgroundColor: 'rgba(46,124,184,0.18)', color: 'var(--blue-mid)', border: '1px solid rgba(46,124,184,0.3)' }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

const ILLUSTRATIONS = [
  Page1Illustration,
  Page2Illustration,
  Page3Illustration,
  Page4Illustration,
  Page5Illustration,
]

export default function TutorialModal({ open, onClose, startPage = 1, onOpenKeyTerms }: TutorialModalProps) {
  const [page, setPage] = useState(startPage - 1) // 0-indexed

  useEffect(() => {
    if (open) setPage(startPage - 1)
  }, [open, startPage])

  if (!open) return null

  const current = PAGES[page]
  const Illustration = ILLUSTRATIONS[page]
  const isLast = page === PAGES.length - 1
  const isFirst = page === 0

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Welcome tour">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--navy)', border: '1px solid var(--ov-border-md)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <MeridianBeacon size={24} variant="gold" animate={true} arrowTip={true} />
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
              {current.kicker}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-[12px] transition-opacity hover:opacity-70"
            style={{ color: 'var(--ov-text-dim)' }}
            aria-label="Dismiss tour"
          >
            <X size={14} />
            Dismiss
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pb-2">
          {/* Title */}
          <h2
            className="text-[20px] font-medium leading-snug mb-1"
            style={{ fontFamily: "'EB Garamond', serif", color: 'var(--ov-text-hi)' }}
          >
            {current.title}
          </h2>
          <p className="text-[13px] mb-4" style={{ color: 'var(--ov-text-mid)' }}>
            {current.subtitle}
          </p>

          {/* Illustration */}
          <div className="mb-4">
            <Illustration />
          </div>

          {/* Body copy */}
          {page === 4 ? (
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>
              Ask Meridian Arc sits on every screen — ask for a hint, an explanation, or your next best move anytime. And whenever you want this tour again, just click <strong style={{ color: 'var(--ov-text-hi)' }}>Help &amp; Tour</strong> in the top-right corner — where you&apos;ll also find the{' '}
              <button
                onClick={onOpenKeyTerms}
                className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                style={{ color: 'var(--gold)' }}
              >
                Key Terms &amp; Definitions
              </button>. You&apos;re all set. Welcome aboard.
            </p>
          ) : (
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>
              {current.body}
            </p>
          )}
        </div>

        {/* Footer: dots + nav */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ov-border)' }}>
          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className="rounded-full transition-all"
                style={{
                  width: i === page ? 18 : 6,
                  height: 6,
                  backgroundColor: i === page ? 'var(--gold)' : 'var(--ov-border-md)',
                }}
                aria-label={`Page ${i + 1}`}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] transition-colors"
                style={{ color: 'var(--ov-text-mid)', border: '1px solid var(--ov-border-md)' }}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg text-[13px] font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--gold)', color: 'var(--navy)' }}
              >
                Finish
              </button>
            ) : (
              <button
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--gold)', color: 'var(--navy)' }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
