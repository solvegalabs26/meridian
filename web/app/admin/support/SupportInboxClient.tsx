'use client'

import { useState } from 'react'

type SupportMessage = {
  id: string
  email: string
  message: string
  source: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

type Filter = 'all' | 'unread' | 'read'

function formatMT(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/Denver',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function SupportInboxClient({ messages: initial }: { messages: SupportMessage[] }) {
  const [messages, setMessages] = useState(initial)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  const unreadCount = messages.filter(m => !m.is_read).length
  const readCount = messages.filter(m => m.is_read).length

  const filtered = messages.filter(m => {
    if (filter === 'unread') return !m.is_read
    if (filter === 'read') return m.is_read
    return true
  })

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  async function markRead(id: string) {
    setMarking(id)
    try {
      const res = await fetch('/api/support/mark-read', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed')
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m)
      )
      showToast('Marked as read')
    } catch {
      showToast('Failed to mark as read')
    } finally {
      setMarking(null)
    }
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email)
      showToast('Email copied')
    } catch {
      showToast('Copy failed')
    }
  }

  return (
    <div className="relative">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--navy)] border border-[var(--border)] text-[var(--text)] text-[13px] px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[20px] font-semibold text-white">Support Inbox</h1>
          <p className="text-[12px] text-[var(--text3)] mt-0.5">
            {messages.length} total · <span className="text-[var(--gold)]">{unreadCount} unread</span> · {readCount} read
          </p>
        </div>
        {/* Filter tabs */}
        <div className="flex gap-1">
          {(['all', 'unread', 'read'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-[var(--navy)] text-white'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              {f}
              {f === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--gold)] text-[var(--navy)] text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text3)] text-[13px]">
          No {filter === 'all' ? '' : filter} messages
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(m => {
            const isExpanded = expanded === m.id
            return (
              <div
                key={m.id}
                className={`rounded-xl border transition-colors ${
                  m.is_read
                    ? 'border-[var(--border-lt)] bg-[var(--surface)]'
                    : 'border-[rgba(201,162,39,.2)] bg-[rgba(201,162,39,.03)]'
                }`}
              >
                {/* Row */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  onClick={() => setExpanded(isExpanded ? null : m.id)}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: m.is_read ? 'transparent' : 'var(--gold)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[13px] font-medium text-white truncate">{m.email}</span>
                      <span className="text-[11px] text-[var(--text3)]">{formatMT(m.created_at)}</span>
                      <span className="text-[10px] font-medium text-[var(--blue-mid)] bg-[rgba(46,124,184,.1)] px-2 py-0.5 rounded">
                        {m.source}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text3)] mt-0.5 truncate">
                      {m.message.slice(0, 80)}{m.message.length > 80 ? '…' : ''}
                    </p>
                  </div>
                  <span className="text-[var(--text3)] text-[11px] flex-shrink-0 mt-0.5">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--border-lt)] pt-3">
                    <p className="text-[13px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap mb-4">
                      {m.message}
                    </p>
                    <div className="flex gap-2">
                      {!m.is_read && (
                        <button
                          onClick={() => markRead(m.id)}
                          disabled={marking === m.id}
                          className="px-3 py-1.5 rounded-lg bg-[var(--navy)] border border-[var(--border)] text-[12px] text-white hover:border-[var(--gold)] transition-colors disabled:opacity-50"
                        >
                          {marking === m.id ? 'Marking…' : 'Mark as read'}
                        </button>
                      )}
                      <button
                        onClick={() => copyEmail(m.email)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--navy)] border border-[var(--border)] text-[12px] text-[var(--text2)] hover:text-white hover:border-[var(--border-lt)] transition-colors"
                      >
                        Copy email
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
