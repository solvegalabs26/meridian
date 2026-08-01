import React from 'react'
import type { MacroEventLink } from './objectives-queries'

const REF_PATTERN = /\b(TC-[A-Z]\d+|LN-\d+)\b/g

function highlightRefs(text: string): React.ReactNode[] {
  const parts = text.split(REF_PATTERN)
  return parts.map((part, i) =>
    REF_PATTERN.test(part)
      ? React.createElement(
          'span',
          { key: i, className: 'font-mono text-yellow-400 text-[11px] bg-yellow-400/10 px-1 py-0.5 rounded' },
          part
        )
      : part
  )
}

function applyLinkMap(
  text: string,
  linkMap: Map<string, MacroEventLink>
): React.ReactNode {
  if (!linkMap || linkMap.size === 0) return highlightRefs(text)

  // Sort keys longest-first so "Great Resignation Wave" matches before "Great Resignation"
  const keys = Array.from(linkMap.keys()).sort((a, b) => b.length - a.length)

  // Build regex that matches any event name
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (escaped.length === 0) return highlightRefs(text)

  const eventPattern = new RegExp(`(${escaped.join('|')})`, 'g')
  const segments = text.split(eventPattern)

  return React.createElement(
    React.Fragment,
    null,
    ...segments.map((seg, i) => {
      const link = linkMap.get(seg)
      if (!link) return highlightRefs(seg)

      const tooltip = [link.source, link.date, link.metric].filter(Boolean).join(' · ')
      if (link.url) {
        return React.createElement(
          'a',
          {
            key: i,
            href: link.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            className: 'text-yellow-400 underline decoration-dotted hover:decoration-solid',
            title: tooltip || undefined,
          },
          seg
        )
      }
      return React.createElement(
        'span',
        {
          key: i,
          className: 'border-b border-dotted border-yellow-600 cursor-help',
          title: tooltip || undefined,
        },
        seg
      )
    })
  )
}

function renderSegment(text: string, linkMap: Map<string, MacroEventLink>): React.ReactNode {
  return applyLinkMap(text, linkMap)
}

export function formatPosText(
  text: string | null | undefined,
  linkMap: Map<string, MacroEventLink> = new Map()
): React.ReactNode {
  if (!text) return null

  const lines = text.split('\n').map(l => l.trim())

  // Detect numbered list: if majority of non-empty lines start with "N." or "N)"
  const nonEmpty = lines.filter(Boolean)
  const numberedLines = nonEmpty.filter(l => /^\d+[.)]\s/.test(l))
  if (numberedLines.length >= 2 && numberedLines.length >= nonEmpty.length * 0.6) {
    const items = nonEmpty.map(line => line.replace(/^\d+[.)]\s*/, ''))
    return React.createElement(
      'ol',
      { className: 'space-y-2.5' },
      ...items.map((item, i) =>
        React.createElement(
          'li',
          { key: i, className: 'flex gap-3 text-sm text-gray-300 leading-relaxed' },
          React.createElement(
            'span',
            { className: 'font-bold text-yellow-400 flex-shrink-0 tabular-nums' },
            `${i + 1}.`
          ),
          React.createElement('span', null, renderSegment(item, linkMap))
        )
      )
    )
  }

  // Detect bullet list
  const bulletLines = nonEmpty.filter(l => /^[•\-–]\s/.test(l))
  if (bulletLines.length >= 2 && bulletLines.length >= nonEmpty.length * 0.6) {
    const items = nonEmpty.map(line => line.replace(/^[•\-–]\s*/, ''))
    return React.createElement(
      'ul',
      { className: 'space-y-2' },
      ...items.map((item, i) =>
        React.createElement(
          'li',
          { key: i, className: 'flex gap-2 text-sm text-gray-300 leading-relaxed' },
          React.createElement('span', { className: 'text-yellow-600 flex-shrink-0 mt-0.5' }, '•'),
          React.createElement('span', null, renderSegment(item, linkMap))
        )
      )
    )
  }

  // Plain text: group into paragraphs (split on double newlines, or every ~3 sentences)
  const rawParagraphs = text.split(/\n{2,}/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)

  if (rawParagraphs.length > 1) {
    return React.createElement(
      React.Fragment,
      null,
      ...rawParagraphs.map((para, i) =>
        React.createElement(
          'p',
          { key: i, className: 'text-sm text-gray-300 leading-relaxed mb-2 last:mb-0' },
          renderSegment(para, linkMap)
        )
      )
    )
  }

  // Single block — split by sentence for readability (every 2-3 sentences)
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text]
  const chunks: string[] = []
  for (let i = 0; i < sentences.length; i += 3) {
    chunks.push(sentences.slice(i, i + 3).join('').trim())
  }

  return React.createElement(
    React.Fragment,
    null,
    ...chunks.map((chunk, i) =>
      React.createElement(
        'p',
        { key: i, className: 'text-sm text-gray-300 leading-relaxed mb-2 last:mb-0' },
        renderSegment(chunk, linkMap)
      )
    )
  )
}
