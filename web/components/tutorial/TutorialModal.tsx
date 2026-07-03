'use client'

import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Target, Radio, MessageCircle, Check } from 'lucide-react'
import MeridianBeacon from '@/components/brand/MeridianBeacon'

// Hardcoded palette — do NOT replace with CSS custom properties.
// These modals are self-contained overlays; dark-mode ancestors must not bleed in.
const P = {
  navy:   '#0D1B3E',
  navy2:  '#12244F',
  gold:   '#C9A227',
  blue:   '#2E7CB8',
  ink:    '#0D1B3E',
  muted:  '#5B6787',
  body:   '#33405F',
  line:   '#E4E8F2',
  bg:     '#F4F6FB',
  green:  '#2F9E6B',
  amber:  '#D99A1C',
  red:    '#C85A54',
  white:  '#FFFFFF',
} as const

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
    body: "Meridian Arc watches your most important goals and brings the signals that matter to your priority focus. Your dashboard has three things: Your Goals, This Week's Brief, and Ask Meridian Arc. This quick tour walks you through each.",
  },
  {
    kicker: 'Your Goals · 2 of 5',
    title: "Open a goal to see what's moving it",
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
    kicker: "This Week's Brief · 4 of 5",
    title: 'See what happened this week',
    subtitle: 'Signals delivered as plain-language story cards.',
    body: "This Week's Brief is where you see what happened. Each week Meridian sweeps the news, data, and industry signals tied to your goals and delivers them as plain-language cards — Risk, Opportunity, Insight, Action. No reports to read. Just what changed and what it means.",
  },
  {
    kicker: 'Ask Meridian Arc · 5 of 5',
    title: 'Ask anytime — and revisit this tour',
    subtitle: 'Help is always one click away.',
    body: null,
  },
]

// ── Illustrations (all on white/light — zero dark tokens) ───────────────────

function Page1Illustration() {
  const tiles = [
    { icon: <Target size={16} color={P.blue} />,              chipBg: 'rgba(46,124,184,.14)', label: 'Your Goals',        desc: "The objectives you're tracking, each with a live on-track score." },
    { icon: <Radio size={16} color="#A9861A" />,              chipBg: 'rgba(201,162,39,.18)', label: "This Week's Brief", desc: 'What changed — the signals Meridian found for you this week.' },
    { icon: <MessageCircle size={16} color={P.green} />,      chipBg: 'rgba(47,158,107,.15)', label: 'Ask Meridian Arc',  desc: 'Ask questions or get hints about any goal, anytime.' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
      {tiles.map(t => (
        <div key={t.label} style={{ backgroundColor: P.white, border: `1px solid ${P.line}`, borderRadius: 10, padding: '12px 10px' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: t.chipBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            {t.icon}
          </div>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: P.ink, margin: '0 0 4px' }}>{t.label}</p>
          <p style={{ fontSize: 11, color: P.muted, lineHeight: 1.4, margin: 0 }}>{t.desc}</p>
        </div>
      ))}
    </div>
  )
}

function Page2Illustration() {
  const tabs = ["What's affecting it", 'What to do', 'Goal']
  return (
    <div style={{ backgroundColor: P.white, border: `1px solid ${P.line}`, borderRadius: 10, padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {/* Confidence ring: track #E4E8F2, arc amber #D99A1C, 71% = 255.6deg */}
        <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, background: `conic-gradient(${P.amber} 255.6deg, ${P.line} 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', backgroundColor: P.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: P.ink }}>71%</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: P.ink, lineHeight: 1.4, margin: '0 0 6px' }}>Increase profits by 5% by end of Q3 2026</p>
          {/* WATCH badge */}
          <span style={{ display: 'inline-block', backgroundColor: 'rgba(217,154,28,.16)', color: '#A9740C', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 8px', borderRadius: 999 }}>WATCH</span>
        </div>
      </div>
      {/* Tabs: active = navy bg/white text */}
      <div style={{ display: 'flex', gap: 4 }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap', backgroundColor: i === 0 ? P.navy : P.white, color: i === 0 ? P.white : P.muted, border: `1px solid ${i === 0 ? P.navy : P.line}` }}>
            {tab}
          </div>
        ))}
      </div>
    </div>
  )
}

function Page3Illustration() {
  const tabs = ["What's affecting it", 'What to do', 'Goal']
  return (
    <div style={{ backgroundColor: P.white, border: `1px solid ${P.line}`, borderRadius: 10, padding: '14px' }}>
      {/* Tabs: active = "What to do" = navy */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 10.5, fontWeight: 500, whiteSpace: 'nowrap', backgroundColor: i === 1 ? P.navy : P.white, color: i === 1 ? P.white : P.muted, border: `1px solid ${i === 1 ? P.navy : P.line}` }}>
            {tab}
          </div>
        ))}
      </div>
      {/* Completed action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: P.green, flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={10} color={P.white} strokeWidth={3} />
        </div>
        <div>
          <p style={{ fontSize: 11, color: P.muted, textDecoration: 'line-through', lineHeight: 1.4, margin: '0 0 2px' }}>Lock in Q3 supplier pricing before the announced 8% increase</p>
          <span style={{ fontSize: 10, fontWeight: 600, color: P.green }}>Done</span>
        </div>
      </div>
      {/* Open action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${P.line}`, flexShrink: 0, marginTop: 2, backgroundColor: P.white }} />
        <p style={{ fontSize: 11, color: P.ink, lineHeight: 1.4, margin: 0 }}>Raise service pricing on the top 3 margin lines by Aug 1</p>
      </div>
    </div>
  )
}

function Page4Illustration() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Risk: white bg, 4px left border red */}
      <div style={{ backgroundColor: P.white, border: `1px solid ${P.line}`, borderLeft: `4px solid ${P.red}`, borderRadius: 8, padding: '10px 12px' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: P.red, letterSpacing: '0.10em', margin: '0 0 4px', textTransform: 'uppercase' }}>Risk</p>
        <p style={{ fontSize: 11, color: P.body, lineHeight: 1.4, margin: 0 }}>Key supplier announced an 8% price increase effective Aug 1 — margin pressure on your Q3 profit goal.</p>
      </div>
      {/* Opportunity: white bg, 4px left border green */}
      <div style={{ backgroundColor: P.white, border: `1px solid ${P.line}`, borderLeft: `4px solid ${P.green}`, borderRadius: 8, padding: '10px 12px' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: P.green, letterSpacing: '0.10em', margin: '0 0 4px', textTransform: 'uppercase' }}>Opportunity</p>
        <p style={{ fontSize: 11, color: P.body, lineHeight: 1.4, margin: 0 }}>Competitor exited your region this month — pricing room opened on your top service lines.</p>
      </div>
    </div>
  )
}

function Page5Illustration() {
  return (
    <div style={{ backgroundColor: P.white, border: `1.5px solid ${P.gold}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Input strip */}
      <div style={{ padding: '10px 14px', backgroundColor: P.bg }}>
        <p style={{ fontSize: 12, color: P.muted, margin: 0 }}>Ask Meridian Arc anything about your goals…</p>
      </div>
      {/* Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', borderTop: `1px solid ${P.line}`, backgroundColor: P.white }}>
        {['Why did my score drop?', 'What should I focus on?', 'Explain this signal.'].map(chip => (
          <span key={chip} style={{ backgroundColor: 'rgba(46,124,184,.10)', color: P.blue, fontSize: 11, fontWeight: 500, padding: '4px 12px', borderRadius: 999 }}>{chip}</span>
        ))}
      </div>
    </div>
  )
}

const ILLUSTRATIONS = [Page1Illustration, Page2Illustration, Page3Illustration, Page4Illustration, Page5Illustration]

export default function TutorialModal({ open, onClose, startPage = 1, onOpenKeyTerms }: TutorialModalProps) {
  const [page, setPage] = useState(startPage - 1)

  useEffect(() => {
    if (open) setPage(startPage - 1)
  }, [open, startPage])

  if (!open) return null

  const current = PAGES[page]
  const Illustration = ILLUSTRATIONS[page]
  const isLast = page === PAGES.length - 1
  const isFirst = page === 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} role="dialog" aria-modal="true" aria-label="Welcome tour">
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,16,38,.55)', backdropFilter: 'blur(4px)' }} onClick={onClose} aria-hidden="true" />

      {/* Modal: explicit #FFFFFF bg + ink text — blocks any dark-mode ancestor cascade */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '90vh', backgroundColor: P.white, color: P.ink, borderRadius: 16, boxShadow: '0 30px 70px rgba(9,16,38,.4)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Navy header band (ONLY dark region) ────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.navy2})`, padding: '20px 22px 18px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MeridianBeacon size={22} variant="gold" animate={true} arrowTip={true} />
              <span style={{ fontSize: 10, fontWeight: 700, color: P.gold, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{current.kicker}</span>
            </div>
            <button
              onClick={onClose}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#AEB9D6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => { e.currentTarget.style.color = P.white }}
              onMouseLeave={e => { e.currentTarget.style.color = '#AEB9D6' }}
              aria-label="Dismiss tour"
            >
              <X size={13} />
              Dismiss
            </button>
          </div>
          <h3 style={{ fontFamily: "'EB Garamond', serif", fontSize: 24, fontWeight: 500, color: P.white, margin: '0 0 6px', lineHeight: 1.25 }}>{current.title}</h3>
          <p style={{ fontSize: 13, color: '#CFD8EE', margin: 0 }}>{current.subtitle}</p>
        </div>

        {/* ── White body ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Illustration panel */}
          <div style={{ backgroundColor: P.bg, border: `1px solid ${P.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Illustration />
          </div>
          {/* Body copy */}
          {page === 4 ? (
            <p style={{ fontSize: 13, lineHeight: 1.65, color: P.body, margin: 0 }}>
              Ask Meridian Arc sits on every screen — ask for a hint, an explanation, or your next best move anytime. And whenever you want this tour again, just click{' '}
              <strong style={{ color: P.ink }}>Help &amp; Tour</strong>{' '}
              in the top-right corner — where you&apos;ll also find the{' '}
              <button
                onClick={onOpenKeyTerms}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: P.gold, textDecoration: 'underline', fontSize: 13, fontWeight: 500 }}
              >
                Key Terms &amp; Definitions
              </button>. You&apos;re all set. Welcome aboard.
            </p>
          ) : (
            <p style={{ fontSize: 13, lineHeight: 1.65, color: P.body, margin: 0 }}>{current.body}</p>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderTop: `1px solid ${P.line}`, backgroundColor: P.white, flexShrink: 0 }}>
          {/* Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {PAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Page ${i + 1}`}
                style={{ height: 6, width: i === page ? 18 : 6, borderRadius: 999, backgroundColor: i === page ? P.gold : P.line, border: 'none', cursor: 'pointer', padding: 0, transition: 'all .2s' }}
              />
            ))}
          </div>
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={() => setPage(p => p - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', backgroundColor: P.white, color: P.ink, border: `1px solid ${P.line}` }}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={onClose}
                style={{ padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: P.navy, color: P.white, border: 'none' }}
              >
                Finish
              </button>
            ) : (
              <button
                onClick={() => setPage(p => p + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: P.navy, color: P.white, border: 'none' }}
              >
                Next <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
