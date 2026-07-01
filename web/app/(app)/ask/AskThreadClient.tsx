'use client'

import { useEffect, useRef, useState } from 'react'
import AskMeridianBar from '@/components/ask/AskMeridianBar'
import { timeAgo } from '@/lib/utils/timeAgo'

interface Message {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

interface AskThreadClientProps {
  openingMessage: string
  objectives: unknown[]
  latestSweep: unknown
  initialQuestion?: string
}

export default function AskThreadClient({ openingMessage, objectives, latestSweep, initialQuestion }: AskThreadClientProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: openingMessage, timestamp: new Date().toISOString() },
  ])
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sentInitialRef = useRef(false)

  async function send(text: string) {
    const userMsg: Message = { role: 'user', text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setSending(true)

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, context: { objectives, latestSweep } }),
      })
      const data = await res.json() as { response?: string; error?: string }
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response ?? data.error ?? 'Something went wrong — please try again.',
        timestamp: new Date().toISOString(),
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong — please try again.', timestamp: new Date().toISOString() }])
    }
    setSending(false)
  }

  useEffect(() => {
    if (initialQuestion && !sentInitialRef.current) {
      sentInitialRef.current = true
      void send(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem-2rem)]">
      <div className="flex-1 flex flex-col gap-4 max-w-2xl mx-auto w-full pt-2">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            {m.role === 'assistant' && (
              <p className="text-[10px] font-medium mb-1 flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--gold)' }} />
                Meridian · {timeAgo(m.timestamp)}
              </p>
            )}
            <div
              className="max-w-[85%] px-4 py-2.5 text-[13px] leading-relaxed"
              style={
                m.role === 'user'
                  ? { backgroundColor: 'var(--blue)', color: '#fff', borderRadius: '14px 14px 4px 14px' }
                  : { backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)', borderRadius: '14px 14px 14px 4px' }
              }
            >
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex flex-col items-start">
            <p className="text-[10px] font-medium mb-1 flex items-center gap-1.5" style={{ color: 'var(--gold)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--gold)' }} />
              Meridian
            </p>
            <div
              className="px-4 py-2.5 text-[13px]"
              style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-dim)', borderRadius: '14px 14px 14px 4px' }}
            >
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <AskMeridianBar onSend={send} placeholder="Ask Meridian Arc about any of your goals…" />
    </div>
  )
}
