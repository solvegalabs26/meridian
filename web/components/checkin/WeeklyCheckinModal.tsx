'use client'

import { useState } from 'react'
import { X, Star } from 'lucide-react'

// Hardcoded palette — same approach as TutorialModal to block dark-mode ancestor cascade.
const P = {
  navy:   '#0D1B3E',
  navy2:  '#12244F',
  gold:   '#C9A227',
  blue:   '#2E7CB8',
  muted:  '#5B6787',
  body:   '#33405F',
  line:   '#E4E8F2',
  bg:     '#F4F6FB',
  white:  '#FFFFFF',
  red:    '#C85A54',
} as const

const SOURCE_OPTIONS = [
  { value: '',                  label: 'Select a source…' },
  { value: 'news_article',      label: 'News article' },
  { value: 'job_posting',       label: 'Job posting' },
  { value: 'conversation',      label: 'Conversation' },
  { value: 'personal_research', label: 'Personal research' },
  { value: 'other',             label: 'Other' },
]

interface Objective {
  id: string
  obj_id: string
  title: string
}

interface WeeklyCheckinModalProps {
  open: boolean
  onClose: () => void
  objectives: Objective[]
  sweepId?: string | null
  preselectedObjectiveId?: string | null
}

const STEPS = [
  'Missed signals',
  'Your own finds',
  'Unlogged actions',
  'Briefing rating',
  'Open feedback',
]

export default function WeeklyCheckinModal({
  open,
  onClose,
  objectives,
  sweepId,
  preselectedObjectiveId,
}: WeeklyCheckinModalProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Field 1
  const [missedSignal, setMissedSignal] = useState('')
  // Field 2
  const [foundSource, setFoundSource] = useState('')
  const [foundContent, setFoundContent] = useState('')
  const [foundObjectiveId, setFoundObjectiveId] = useState(preselectedObjectiveId ?? '')
  // Field 3
  const [unloggedAction, setUnloggedAction] = useState('')
  const [unloggedObjectiveId, setUnloggedObjectiveId] = useState(preselectedObjectiveId ?? '')
  // Field 4
  const [briefingRating, setBriefingRating] = useState<number>(0)
  // Field 5
  const [otherNotes, setOtherNotes] = useState('')

  if (!open) return null

  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  async function handleSubmit() {
    setSaving(true)
    setError(null)

    const foundObjLabel = foundObjectiveId
      ? (objectives.find(o => o.id === foundObjectiveId)?.title ?? null)
      : null

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reflection:       missedSignal.trim() || null,
        signal_content:   foundContent.trim() || null,
        signal_objective: foundObjLabel,
        briefing_rating:  briefingRating > 0 ? briefingRating : null,
        briefing_note:    otherNotes.trim() || null,
      }),
    })

    setSaving(false)

    if (!res.ok) {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Something went wrong — please try again.')
      return
    }

    onClose()
  }

  function handleNext() {
    if (isLast) {
      handleSubmit()
    } else {
      setStep(s => s + 1)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly check-in"
      style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(9,16,38,.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        backgroundColor: P.white,
        color: P.body,
        borderRadius: 16,
        boxShadow: '0 30px 70px rgba(9,16,38,.4)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Navy header */}
        <div style={{ background: `linear-gradient(135deg, ${P.navy}, ${P.navy2})`, padding: '18px 20px 16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: P.gold, letterSpacing: '1.2px', textTransform: 'uppercase' }}>
              Weekly check-in · {step + 1} of {STEPS.length}
            </span>
            <button
              onClick={onClose}
              aria-label="Dismiss"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#AEB9D6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <X size={13} /> Skip for now
            </button>
          </div>

          {/* Step label */}
          <p style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 22, fontWeight: 500, color: P.white, margin: '0 0 4px', lineHeight: 1.25 }}>
            {stepTitle(step)}
          </p>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 999,
                  backgroundColor: i <= step ? P.gold : 'rgba(255,255,255,0.2)',
                  transition: 'background-color .2s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 4px' }}>
          {error && (
            <div style={{ padding: '10px 14px', marginBottom: 16, backgroundColor: '#FEF2F2', border: `1px solid ${P.red}`, borderRadius: 8, fontSize: 13, color: P.red }}>
              {error}
            </div>
          )}
          {renderStep(step, {
            objectives,
            missedSignal, setMissedSignal,
            foundSource, setFoundSource,
            foundContent, setFoundContent,
            foundObjectiveId, setFoundObjectiveId,
            unloggedAction, setUnloggedAction,
            unloggedObjectiveId, setUnloggedObjectiveId,
            briefingRating, setBriefingRating,
            otherNotes, setOtherNotes,
          })}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderTop: `1px solid ${P.line}`, flexShrink: 0 }}>
          {!isFirst ? (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{ fontSize: 13, color: P.muted, background: 'none', border: `1px solid ${P.line}`, borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}
            >
              Back
            </button>
          ) : (
            <span />
          )}

          <button
            onClick={handleNext}
            disabled={saving}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: P.white,
              background: P.navy,
              border: `1.5px solid ${P.gold}`,
              borderRadius: 8,
              padding: '7px 22px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : isLast ? 'Done — see you next week' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function stepTitle(step: number): string {
  switch (step) {
    case 0: return 'Anything the sweep missed this week?'
    case 1: return 'Did you find anything relevant on your own?'
    case 2: return 'Any actions you took that aren\'t logged yet?'
    case 3: return 'How useful was this week\'s briefing?'
    case 4: return 'Anything else we should know?'
    default: return ''
  }
}

interface StepProps {
  objectives: { id: string; obj_id: string; title: string }[]
  missedSignal: string; setMissedSignal: (v: string) => void
  foundSource: string; setFoundSource: (v: string) => void
  foundContent: string; setFoundContent: (v: string) => void
  foundObjectiveId: string; setFoundObjectiveId: (v: string) => void
  unloggedAction: string; setUnloggedAction: (v: string) => void
  unloggedObjectiveId: string; setUnloggedObjectiveId: (v: string) => void
  briefingRating: number; setBriefingRating: (v: number) => void
  otherNotes: string; setOtherNotes: (v: string) => void
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: P.muted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${P.line}`,
  fontSize: 13,
  color: P.body,
  backgroundColor: P.white,
  outline: 'none',
  boxSizing: 'border-box',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 90,
  lineHeight: 1.6,
}

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: P.muted,
  marginTop: 20,
  lineHeight: 1.55,
}

function ObjectiveSelect({ value, onChange, objectives, placeholder }: {
  value: string
  onChange: (v: string) => void
  objectives: { id: string; obj_id: string; title: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, cursor: 'pointer' }}
    >
      <option value="">{placeholder ?? 'Select a goal (optional)…'}</option>
      {objectives.map(obj => (
        <option key={obj.id} value={obj.id}>
          {obj.obj_id} — {obj.title.length > 50 ? obj.title.slice(0, 47) + '…' : obj.title}
        </option>
      ))}
    </select>
  )
}

function renderStep(step: number, props: StepProps): React.ReactNode {
  const { objectives } = props

  switch (step) {
    case 0:
      return (
        <div style={{ paddingBottom: 20 }}>
          <textarea
            value={props.missedSignal}
            onChange={e => props.setMissedSignal(e.target.value)}
            placeholder="Something you saw or heard that Meridian didn't surface..."
            style={textareaStyle}
            rows={5}
            autoFocus
          />
          <p style={hintStyle}>
            Market moves, industry chatter, conversations, anything the weekly scan didn&apos;t pick up.
            Leave blank if nothing comes to mind.
          </p>
        </div>
      )

    case 1:
      return (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>Source</label>
            <select
              value={props.foundSource}
              onChange={e => props.setFoundSource(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              {SOURCE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>What did you find?</label>
            <textarea
              value={props.foundContent}
              onChange={e => props.setFoundContent(e.target.value)}
              placeholder="What did you find — 1-2 sentences..."
              style={textareaStyle}
              rows={4}
            />
          </div>

          <div>
            <label style={fieldLabel}>Related goal</label>
            <ObjectiveSelect
              value={props.foundObjectiveId}
              onChange={props.setFoundObjectiveId}
              objectives={objectives}
            />
          </div>

          {props.foundContent.trim() && (
            <p style={{ ...hintStyle, color: P.blue }}>
              This will be added as a signal in your feed.
            </p>
          )}
        </div>
      )

    case 2:
      return (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={fieldLabel}>What did you do?</label>
            <input
              type="text"
              value={props.unloggedAction}
              onChange={e => props.setUnloggedAction(e.target.value)}
              placeholder="e.g. Called recruiter at Boeing, submitted application to Lockheed..."
              style={inputStyle}
              autoFocus
            />
          </div>

          <div>
            <label style={fieldLabel}>Related goal</label>
            <ObjectiveSelect
              value={props.unloggedObjectiveId}
              onChange={props.setUnloggedObjectiveId}
              objectives={objectives}
            />
          </div>

          <p style={hintStyle}>
            These notes feed back into your next sweep so Meridian knows what momentum you&apos;ve built.
          </p>
        </div>
      )

    case 3:
      return (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '24px 0 20px' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => props.setBriefingRating(props.briefingRating === n ? 0 : n)}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <Star
                  size={36}
                  fill={n <= props.briefingRating ? P.gold : 'none'}
                  color={n <= props.briefingRating ? P.gold : P.line}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>

          {props.briefingRating > 0 && (
            <p style={{ textAlign: 'center', fontSize: 13, color: P.muted, marginTop: 4 }}>
              {ratingLabel(props.briefingRating)}
            </p>
          )}

          <p style={{ ...hintStyle, textAlign: 'center', marginTop: 24 }}>
            Your ratings help us tune the depth and focus of future briefings.
          </p>
        </div>
      )

    case 4:
      return (
        <div style={{ paddingBottom: 20 }}>
          <textarea
            value={props.otherNotes}
            onChange={e => props.setOtherNotes(e.target.value)}
            placeholder="Open feedback, feature ideas, anything..."
            style={textareaStyle}
            rows={5}
            autoFocus
          />
          <p style={hintStyle}>
            This goes directly to the team. Feature requests, rough edges, anything on your mind.
          </p>
        </div>
      )

    default:
      return null
  }
}

function ratingLabel(r: number): string {
  switch (r) {
    case 1: return 'Not useful'
    case 2: return 'Somewhat useful'
    case 3: return 'Useful'
    case 4: return 'Very useful'
    case 5: return 'Exactly what I needed'
    default: return ''
  }
}
