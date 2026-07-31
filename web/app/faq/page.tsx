'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type CalloutType = 'info' | 'gold' | 'caution'

type Step = { text: string }

type FAQItem = {
  q: string
  steps?: Step[]
  body?: string[]
  callout?: { type: CalloutType; text: string }
  list?: string[]
  secondCallout?: { type: CalloutType; text: string }
}

type Section = {
  id: string
  label: string
  items: FAQItem[]
}

// ── Content ──────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: 'objectives',
    label: 'Objectives',
    items: [
      {
        q: 'How do I see and review my original goal description?',
        steps: [
          { text: 'From the dashboard, tap the objective you want to review.' },
          { text: 'Select the Goal tab. Your original outcome statement, target date, and category are displayed here exactly as you entered them.' },
          { text: 'To edit the title, target date, or deadline type, tap the ⚙ gear icon in the top-right corner of any objective. Changes save immediately.' },
        ],
        callout: { type: 'info', text: 'Your original description drives every signal sweep and confidence assessment. If your goal has shifted significantly, update it so the engine stays calibrated to what you\'re actually working toward.' },
      },
      {
        q: 'How do I edit an objective\'s title, date, or other details?',
        steps: [
          { text: 'Open any objective and tap the ⚙ gear icon.' },
          { text: 'An edit drawer opens. Update the title, target date, deadline type, or any price/value fields relevant to your goal.' },
          { text: 'Changes persist immediately and are reflected in your next signal sweep.' },
        ],
        callout: { type: 'caution', text: 'Your confidence score, prediction history, and signal analysis are all tied to your original objective description and target date. Editing either one may shift how the engine interprets past and future sweeps. Your history is preserved — but the context the engine uses going forward will reflect your updated details.' },
      },
      {
        q: 'How do I archive an objective without deleting it?',
        body: ['Open the objective, tap the ⚙ gear icon, and select Archive objective. Archived objectives stop receiving scheduled sweeps but retain all history, predictions, and confidence data. You can unarchive any time from the same menu.'],
        callout: { type: 'info', text: 'Use archive when a goal is on hold due to timing or external blockers — not when the goal itself has changed. If the outcome has shifted, update the description instead.' },
      },
    ],
  },
  {
    id: 'actions',
    label: 'Actions & Logging',
    items: [
      {
        q: 'How do I log an action I completed toward an objective?',
        steps: [
          { text: 'Open the objective and tap the What to do tab.' },
          { text: 'Scroll to the bottom and tap + I did something.' },
          { text: 'Describe what you did, select a date, and optionally choose an action type. Tap Save.' },
        ],
        callout: { type: 'gold', text: 'Your confidence score updates immediately after logging. Each action you record is factored into the next sweep analysis — it\'s the fastest way to keep your score grounded between sweeps.' },
      },
      {
        q: 'How do I create a task from my actions list?',
        steps: [
          { text: 'Open an objective and go to the What to do tab. Meridian displays recommended next actions based on current signals.' },
          { text: 'Tap Add to calendar or Create task on any action chip to push it to your connected calendar as a scheduled event.' },
          { text: 'Once completed, return to the objective and log it using + I did something to close the loop and update your confidence score.' },
        ],
        callout: { type: 'info', text: 'Calendar must be connected for the task-to-event feature. See How do I connect my calendar? below.' },
      },
    ],
  },
  {
    id: 'sweeps',
    label: 'Signal Sweeps',
    items: [
      {
        q: 'How do I get more detailed signals and output insight?',
        body: ['Signal detail scales with two things: the quality of your objective description and your subscription tier.'],
        steps: [
          { text: 'Improve your description. Open the ⚙ gear icon and add specific context — company names, timelines, locations, dollar amounts. Vague descriptions produce vague signals.' },
          { text: 'Log your actions consistently. Every action you record is factored into the next sweep. The engine uses your real-world progress alongside external signals — the more you log, the more grounded the output becomes.' },
          { text: 'Upgrade your sweep frequency. Explorer receives one weekly sweep. Accelerator receives five weekly sweeps. Command receives one daily sweep — the most current signal picture available.' },
        ],
      },
      {
        q: 'Can I get extra signal sweeps for important objectives?',
        body: [
          'Yes. Signal sweep credits let you run additional sweeps on any plan at any time — useful when external conditions are changing fast and you need a fresh intelligence picture before your next scheduled sweep.',
          'Purchase signal sweep credits from Settings → Billing → Add sweep credits. Available in three bundles: 5 sweeps · $4 | 15 sweeps · $10 | 50 sweeps · $25. Credits don\'t expire and apply to any objective on your account.',
          'To use a credit, open an objective and tap Run Sweep. If your scheduled sweep isn\'t available yet, a credit will be consumed automatically.',
        ],
      },
      {
        q: 'How do I connect my calendar?',
        steps: [
          { text: 'Go to Settings and look for the Calendar section.' },
          { text: 'Tap Connect calendar and authorize access. Google Calendar and iCal feeds are supported.' },
          { text: 'Once connected, Meridian reads upcoming events and detects deadline collisions, prep windows, and scheduling conflicts across your active objectives — automatically surfaced in each sweep report.' },
        ],
        callout: { type: 'info', text: 'Calendar data is read-only. Meridian uses it for context only and does not modify, delete, or share your calendar events.' },
      },
    ],
  },
  {
    id: 'predictions',
    label: 'Predictions & Confidence',
    items: [
      {
        q: 'How do I update my prediction score?',
        body: ['Confidence scores update automatically on two triggers: a completed signal sweep (scheduled or on-demand) and a logged action. You can also adjust them manually.'],
        steps: [
          { text: 'Open an objective and tap the Predictions tab.' },
          { text: 'Find the prediction you want to update and tap Edit. Adjust the confidence percentage and add a note explaining what changed.' },
          { text: 'The confidence history graph updates to reflect the change, with your note preserved as a causal annotation.' },
        ],
        callout: { type: 'info', text: 'Every prediction has a horizon date. When that date arrives, Meridian will prompt you to score the outcome — hit, miss, or partial. Scored outcomes are the calibration data that makes the engine more accurate over time.' },
      },
      {
        q: 'What does a confidence score actually mean?',
        body: [
          'A confidence score is an estimated percentage from 0–100 reflecting how likely you are to reach your stated goal given current signals, logged actions, and market conditions. A score of 78% means the evidence available right now supports a strong-but-not-certain path to your goal.',
          'Scores move up when new positive signals emerge or when you take meaningful action. They move down when conditions shift against your goal or when no progress is logged over time. The confidence history graph shows the full trajectory and the reason for each change.',
        ],
        callout: { type: 'info', text: 'Confidence scores are analytical outputs only. They are not financial, legal, career, or medical advice. Always verify recommendations independently before acting.' },
      },
    ],
  },
  {
    id: 'ask',
    label: 'Ask Meridian Arc',
    items: [
      {
        q: 'What does Ask Meridian Arc do?',
        body: [
          'Ask Meridian Arc is an on-demand intelligence query — it answers specific, time-sensitive questions about your objectives using real-time web data and your objective context together.',
          'Where a scheduled sweep monitors your goals broadly, Ask answers a specific question right now. Examples:',
        ],
        list: [
          '"Is this a good time to make an offer on the property given current rate trends?"',
          '"What is the best time of year to plan a trip to Florida?"',
          '"Should I wait on equipment purchases given current supply chain news?"',
        ],
        callout: { type: 'gold', text: 'Ask queries are included by tier: Explorer 5/month · Accelerator 10/month · Command 20/month. Additional queries are available via Ask Arc credits.' },
      },
      {
        q: 'How do I use Ask Meridian Arc?',
        steps: [
          { text: 'Open any objective and tap the Ask tab, or tap the Ask button from the main dashboard.' },
          { text: 'Type your question in plain language. Be as specific as possible — include names, timeframes, and the decision you\'re trying to make.' },
          { text: 'Meridian searches the web, combines the results with your objective context, and returns a grounded answer with source citations and recommended next actions.' },
        ],
      },
    ],
  },
  {
    id: 'account',
    label: 'Account & Settings',
    items: [
      {
        q: 'How do I restart the onboarding tour?',
        steps: [
          { text: 'Tap Help & Tour in the top navigation bar.' },
          { text: 'Select Restart the tour. The full onboarding walkthrough will begin from step one.' },
        ],
      },
      {
        q: 'How many objectives can I track at once?',
        list: [
          'Trial — 3 objectives',
          'Explorer — 5 objectives',
          'Accelerator — 15 objectives',
          'Command — Unlimited objectives',
        ],
        callout: { type: 'info', text: 'If you\'ve reached your limit, you can archive an existing objective to free a slot without losing any of its data, signals, or history.' },
      },
      {
        q: 'How do I change my sweep frequency or upgrade my plan?',
        steps: [
          { text: 'Go to Settings → Billing.' },
          { text: 'Tap Change plan to see available tiers. Upgrades take effect immediately. Downgrades apply at the next billing cycle.' },
        ],
        callout: { type: 'gold', text: 'Sweep frequency by tier: Explorer · 1 weekly | Accelerator · 5 weekly | Command · 1 daily. Run extra sweeps any time with signal sweep credits.' },
      },
      {
        q: 'Is my objective data private?',
        body: [
          'Yes. Your objectives, confidence history, predictions, and action logs are private to your account by default. Meridian does not share individual user data with other users.',
          'Signal sweeps use external public data sources only — Meridian does not monitor your private accounts, messages, or files. Calendar data (if connected) is read-only and used solely to detect deadline and scheduling context for your objectives.',
          'For full details, review the Meridian Privacy Policy at /legal.',
        ],
      },
      {
        q: 'What does the confidence history graph show?',
        body: [
          'The confidence history graph traces how your objective\'s confidence score has moved over time, sweep by sweep. Each data point is annotated with the primary cause of the change — a new signal, a logged action, a market event, or a dependency update.',
          'This is your objective\'s intelligence record. A flat line means nothing has been logged or swept. A moving line means the engine is working and conditions are being tracked.',
        ],
      },
    ],
  },
]

// ── Callout component ─────────────────────────────────────────────────────────

function Callout({ type, text }: { type: CalloutType; text: string }) {
  const styles: Record<CalloutType, { bg: string; border: string; color: string; label: string }> = {
    info:    { bg: 'rgba(46,124,184,.08)',   border: 'rgba(46,124,184,.35)',  color: '#8AB4D4', label: 'Note' },
    gold:    { bg: 'rgba(201,162,39,.08)',   border: 'rgba(201,162,39,.4)',   color: '#E8C85A', label: 'Note' },
    caution: { bg: 'rgba(201,162,39,.08)',   border: 'rgba(201,162,39,.5)',   color: '#E8C85A', label: 'Caution' },
  }
  const s = styles[type]
  return (
    <div
      className="rounded-lg px-3.5 py-2.5 mt-3 text-[12.5px] leading-relaxed"
      style={{ background: s.bg, borderLeft: `2px solid ${s.border}`, color: s.color }}
    >
      <span className="font-semibold mr-1">{s.label}:</span>
      {text}
    </div>
  )
}

// ── Contact Modal ─────────────────────────────────────────────────────────────

function ContactModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  function validateEmail() {
    if (!email.trim()) { setEmailError('Email is required'); return false }
    if (!emailRegex.test(email.trim())) { setEmailError('Enter a valid email address'); return false }
    setEmailError('')
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateEmail()) return
    setStatus('submitting')
    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), message: message.trim(), source: 'faq_page' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Server error')
      }
      setStatus('success')
      setTimeout(onClose, 2800)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(6,15,26,.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{ background: '#0D1B3E', border: '1px solid rgba(255,255,255,.1)' }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[17px] font-semibold text-white">Send us a message</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,.45)' }}>We&apos;ll follow up within one business day.</p>
          </div>
          <button onClick={onClose} className="text-[var(--text3)] hover:text-white transition-colors text-lg leading-none mt-0.5">✕</button>
        </div>

        {status === 'success' ? (
          <div className="py-6 text-center">
            <div className="text-[32px] mb-3">✓</div>
            <p className="text-[14px] font-medium text-white">Message received</p>
            <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,.5)' }}>We&apos;ll follow up within one business day.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                Email address <span style={{ color: '#E8C85A' }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={validateEmail}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: `1px solid ${emailError ? 'rgba(220,80,80,.6)' : 'rgba(255,255,255,.12)'}`,
                  color: '#F7F6F3',
                }}
                disabled={status === 'submitting'}
              />
              {emailError && <p className="text-[11px] mt-1" style={{ color: '#e07070' }}>{emailError}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,.7)' }}>
                Message <span style={{ color: '#E8C85A' }}>*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="What's on your mind?"
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(255,255,255,.12)',
                  color: '#F7F6F3',
                }}
                disabled={status === 'submitting'}
              />
            </div>

            {status === 'error' && (
              <p className="text-[12px]" style={{ color: '#e07070' }}>
                Something went wrong. Please try again or email{' '}
                <a href="mailto:connect@solvega.ai" style={{ color: '#8AB4D4' }}>connect@solvega.ai</a>.
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold transition-opacity disabled:opacity-60"
              style={{ background: '#C9A227', color: '#0B1829' }}
            >
              {status === 'submitting' ? 'Sending…' : 'Send message'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ── FAQ Item (accordion row) ──────────────────────────────────────────────────

function FAQRow({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden transition-colors"
      style={{ border: `1px solid ${isOpen ? 'rgba(201,162,39,.25)' : 'rgba(255,255,255,.07)'}` }}
    >
      <button
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
        style={{ background: isOpen ? 'rgba(201,162,39,.04)' : 'rgba(255,255,255,.02)' }}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-[14px] font-medium leading-snug" style={{ color: isOpen ? '#fff' : 'rgba(255,255,255,.85)' }}>
          {item.q}
        </span>
        <span
          className="flex-shrink-0 mt-0.5 text-[11px] font-bold transition-transform"
          style={{ color: '#C9A227', transform: isOpen ? 'rotate(45deg)' : 'none' }}
        >
          ＋
        </span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
          {item.body?.map((p, i) => (
            <p key={i} className="text-[13px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,.72)' }}>{p}</p>
          ))}

          {item.steps && (
            <ol className="flex flex-col gap-2 my-3">
              {item.steps.map((s, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                    style={{ background: 'rgba(46,124,184,.18)', border: '1px solid rgba(46,124,184,.3)', color: '#8AB4D4' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,.72)' }}>{s.text}</span>
                </li>
              ))}
            </ol>
          )}

          {item.list && (
            <ul className="my-3 flex flex-col gap-1.5 pl-1">
              {item.list.map((l, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,.72)' }}>
                  <span style={{ color: '#C9A227' }}>·</span> {l}
                </li>
              ))}
            </ul>
          )}

          {item.callout && <Callout type={item.callout.type} text={item.callout.text} />}
          {item.secondCallout && <Callout type={item.secondCallout.type} text={item.secondCallout.text} />}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const visibleSections = activeSection
    ? SECTIONS.filter(s => s.id === activeSection)
    : SECTIONS

  function toggleItem(key: string) {
    setOpenItem(prev => prev === key ? null : key)
  }

  return (
    <div className="min-h-screen" style={{ background: '#060F1A', color: '#F7F6F3', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <header
        className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
        style={{ background: 'rgba(6,15,26,.92)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,.07)' }}
      >
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="text-[13px] font-semibold" style={{ color: '#fff' }}>Meridian Arc</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-[12px] px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.1)' }}
        >
          Back to app →
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-12">

        {/* Page header */}
        <div className="mb-10">
          <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: '#5090C0' }}>
            Meridian Arc · Help Center
          </p>
          <h1 className="text-[32px] font-semibold mb-2" style={{ color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 400 }}>
            Frequently Asked Questions
          </h1>
          <p className="text-[14px]" style={{ color: 'rgba(255,255,255,.5)' }}>
            17 answers across 6 categories. Click any question to expand.
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => { setActiveSection(null); setOpenItem(null) }}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
            style={{
              background: activeSection === null ? '#C9A227' : 'rgba(255,255,255,.06)',
              color: activeSection === null ? '#0B1829' : 'rgba(255,255,255,.65)',
              border: '1px solid transparent',
            }}
          >
            All
          </button>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSection(activeSection === s.id ? null : s.id); setOpenItem(null) }}
              className="px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors"
              style={{
                background: activeSection === s.id ? '#C9A227' : 'rgba(255,255,255,.06)',
                color: activeSection === s.id ? '#0B1829' : 'rgba(255,255,255,.65)',
                border: '1px solid transparent',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* FAQ sections */}
        <div className="flex flex-col gap-10">
          {visibleSections.map(section => (
            <div key={section.id}>
              <h2
                className="text-[11px] font-semibold uppercase tracking-widest mb-4"
                style={{ color: '#5090C0' }}
              >
                {section.label}
              </h2>
              <div className="flex flex-col gap-2">
                {section.items.map((item, i) => {
                  const key = `${section.id}-${i}`
                  return (
                    <FAQRow
                      key={key}
                      item={item}
                      isOpen={openItem === key}
                      onToggle={() => toggleItem(key)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="mt-16 pt-8 flex flex-col gap-4"
          style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}
        >
          <p className="text-[13px]" style={{ color: 'rgba(255,255,255,.5)' }}>
            Still have a question? Use Ask Meridian Arc from any objective, or{' '}
            <button
              onClick={() => setShowModal(true)}
              className="underline transition-colors"
              style={{ color: '#8AB4D4', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}
            >
              send us a message
            </button>.
          </p>
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,.3)' }}>
            Meridian Arc is an AI-powered intelligence tool. Confidence scores are analytical outputs — not professional advice. Always verify recommendations independently before acting.{' '}
            <Link href="/legal" className="underline" style={{ color: 'rgba(255,255,255,.4)' }}>
              Privacy Policy →
            </Link>
          </p>
        </div>
      </main>

      {showModal && <ContactModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
