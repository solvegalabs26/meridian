'use client'

import { useState, useEffect, useRef } from 'react'

const P = {
  navyDeep: '#060F1A',
  navy:     '#0D1B3E',
  navy2:    '#12244F',
  gold:     '#C9A227',
  goldSoft: '#E8C85A',
  blue:     '#2E7CB8',
  text:     '#F2F1EC',
  textDim:  '#8098B4',
  line:     'rgba(128,152,180,.18)',
  error:    '#C85A54',
} as const

interface Props {
  open: boolean
  onClose: () => void
}

type State = 'idle' | 'submitting' | 'success' | 'error'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export default function PrelaunchModal({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [validationErr, setValidationErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const honeypotRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open])

  // Escape key to close
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleClose() {
    if (state === 'submitting') return
    setEmail('')
    setState('idle')
    setErrorMsg('')
    setValidationErr('')
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setValidationErr('')
    if (!isValidEmail(email)) {
      setValidationErr('Please enter a valid email address.')
      return
    }
    setState('submitting')
    setErrorMsg('')
    try {
      // Read honeypot from the DOM ref directly — bots that set .value without
      // firing onChange won't update React state, but the ref always reflects
      // the actual DOM value at submit time.
      const website = honeypotRef.current?.value ?? ''
      const res = await fetch('/api/prelaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), website }),
      })
      if (res.ok || res.status === 409) {
        setState('success')
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string }
        setErrorMsg(d.error ?? 'Something went wrong — please try again.')
        setState('error')
      }
    } catch {
      setErrorMsg('Something went wrong — please try again.')
      setState('error')
    }
  }

  if (!open) return null

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,15,26,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0F1E42',
          border: `1px solid rgba(201,162,39,.35)`,
          borderRadius: '18px',
          padding: '36px 32px 30px',
          maxWidth: '440px',
          width: '100%',
          position: 'relative',
          zIndex: 1001,
          boxShadow: '0 24px 64px -16px rgba(0,0,0,.85)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '14px', right: '14px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: P.textDim, padding: '8px', lineHeight: 1,
            fontSize: '20px', minWidth: '44px', minHeight: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '8px',
          }}
        >
          ×
        </button>

        {/* Beacon mark */}
        <div style={{ marginBottom: '20px' }}>
          <svg width="36" height="36" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="35" r="13" fill="#C9A227" opacity=".07" />
            <circle cx="30" cy="35" r="8.5" fill="#C9A227" opacity=".13" />
            <circle cx="30" cy="35" r="5.3" fill="#C9A227" />
            <line x1="30" y1="35" x2="30" y2="11" stroke="rgba(255,255,255,.45)" strokeWidth="1.5" strokeLinecap="round" />
            <polyline points="26.5,15 30,11 33.5,15" stroke="#C9A227" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {state === 'success' ? (
          <div>
            <h2 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '26px', fontWeight: 400, color: P.text, marginBottom: '12px', lineHeight: 1.15 }}>
              You&apos;re on the list.
            </h2>
            <p style={{ color: P.textDim, fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
              We&apos;ll be in touch with updates and first access to pre-launch opportunities.
            </p>
            <button
              onClick={handleClose}
              style={{
                display: 'block', width: '100%', padding: '13px',
                borderRadius: '8px', fontSize: '14px', fontWeight: 500,
                background: `linear-gradient(180deg, ${P.goldSoft}, ${P.gold})`,
                color: P.navyDeep, border: `1px solid ${P.gold}`,
                cursor: 'pointer', minHeight: '44px',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {/* Honeypot — invisible to real users; bots fill it; server silently drops the submission */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
              <input
                ref={honeypotRef}
                id="pl-website"
                type="text"
                name="website"
                defaultValue=""
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <h2 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '26px', fontWeight: 400, color: P.text, marginBottom: '10px', lineHeight: 1.15 }}>
              Meridian Arc is launching soon.
            </h2>
            <p style={{ color: P.textDim, fontSize: '14.5px', lineHeight: 1.65, marginBottom: '8px' }}>
              We&apos;re thrilled you&apos;re ready to enhance your life with Meridian Arc. We&apos;re finalizing a few details before we open the doors.
            </p>
            <p style={{ color: P.textDim, fontSize: '14.5px', lineHeight: 1.65, marginBottom: '22px' }}>
              Join the pre-launch list for updates — and first access to special pre-launch opportunities and benefits.
            </p>

            <div style={{ marginBottom: '12px' }}>
              <input
                ref={inputRef}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setValidationErr(''); if (state === 'error') { setState('idle'); setErrorMsg('') } }}
                placeholder="your@email.com"
                disabled={state === 'submitting'}
                style={{
                  display: 'block', width: '100%',
                  padding: '12px 14px',
                  fontSize: '16px', // 16px prevents iOS zoom
                  borderRadius: '8px',
                  border: `1px solid ${validationErr ? P.error : P.line}`,
                  background: P.navy2,
                  color: P.text,
                  outline: 'none',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
              {validationErr && (
                <p style={{ color: P.error, fontSize: '12.5px', marginTop: '5px' }}>{validationErr}</p>
              )}
            </div>

            {(state === 'error') && (
              <p style={{ color: P.error, fontSize: '13px', marginBottom: '10px' }}>{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={state === 'submitting'}
              style={{
                display: 'block', width: '100%', padding: '13px',
                borderRadius: '8px', fontSize: '15px', fontWeight: 500,
                background: state === 'submitting'
                  ? P.navy2
                  : `linear-gradient(180deg, ${P.goldSoft}, ${P.gold})`,
                color: state === 'submitting' ? P.textDim : P.navyDeep,
                border: `1px solid ${state === 'submitting' ? P.line : P.gold}`,
                cursor: state === 'submitting' ? 'not-allowed' : 'pointer',
                minHeight: '44px',
                transition: 'all .15s',
              }}
            >
              {state === 'submitting' ? 'Joining...' : 'Join the list'}
            </button>

            <p style={{ color: P.textDim, fontSize: '11.5px', lineHeight: 1.55, marginTop: '16px' }}>
              We&apos;ll only use your email to contact you about Meridian Arc. Solvega Labs LLC does not sell your personal information or account details to third parties.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
