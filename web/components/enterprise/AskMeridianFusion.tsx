'use client'

import { useState } from 'react'

interface Props {
  institutionId: string
}

export function AskMeridianFusion({ institutionId }: Props) {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/enterprise/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, institutionId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setResponse(data.response)
      setQuestion('')
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C9A227] opacity-40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#C9A227]" />
        </span>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">
          Ask Meridian Fusion
        </h2>
        <span className="text-xs text-gray-600 ml-1">— portfolio-aware intelligence</span>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask about your portfolio, objectives, risk trends, or recommended actions..."
          disabled={loading}
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]/60 disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex shrink-0 items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold bg-[#C9A227] text-[#0D1B3E] hover:bg-[#b89220] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0D1B3E]/30 border-t-[#0D1B3E]" />
              Thinking…
            </>
          ) : (
            'Ask'
          )}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/60 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C9A227]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Meridian Fusion
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-200">
            {response}
          </p>
        </div>
      )}
    </div>
  )
}
