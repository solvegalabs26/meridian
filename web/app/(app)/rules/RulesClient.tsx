'use client'

import { useState } from 'react'
import { X, Plus, Save } from 'lucide-react'

interface Rule {
  id?: string
  objective_id: string
  keywords_high: string[]
  keywords_med: string[]
  keywords_low: string[]
  keywords_block: string[]
  source_tiers: { tier1: string[]; tier2: string[]; tier3: string[] }
}

interface Props {
  objectives: { id: string; obj_id: string; title: string }[]
  initialRules: Rule[]
}

function KeywordTag({ keyword, onRemove, disabled }: { keyword: string; onRemove: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[var(--gray-lt)] text-[var(--text2)] border border-[var(--border)]">
      {keyword}
      {!disabled && (
        <button onClick={onRemove} className="text-[var(--text3)] hover:text-[var(--red)] transition-colors">
          <X size={10} />
        </button>
      )}
    </span>
  )
}

function KeywordSection({
  label, color, keywords, onAdd, onRemove, placeholder,
}: {
  label: string
  color: string
  keywords: string[]
  onAdd: (kw: string) => void
  onRemove: (i: number) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  function handleAdd() {
    const kw = input.trim()
    if (!kw || keywords.includes(kw)) return
    onAdd(kw)
    setInput('')
  }

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color }}>
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {keywords.map((kw, i) => (
          <KeywordTag key={kw} keyword={kw} onRemove={() => onRemove(i)} />
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder}
          className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12px] focus:outline-none focus:border-[var(--blue)]"
        />
        <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg bg-[var(--gray-lt)] text-[var(--text2)] hover:bg-[var(--border)] transition-colors">
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

export default function RulesClient({ objectives, initialRules }: Props) {
  const [selectedObjId, setSelectedObjId] = useState(objectives[0]?.id ?? '')
  const [rules, setRules] = useState<Record<string, Rule>>(() => {
    const map: Record<string, Rule> = {}
    for (const r of initialRules) {
      map[r.objective_id] = r
    }
    return map
  })
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const selectedObj = objectives.find(o => o.id === selectedObjId)
  const rule = rules[selectedObjId] ?? {
    objective_id: selectedObjId,
    keywords_high: [],
    keywords_med: [],
    keywords_low: [],
    keywords_block: [],
    source_tiers: { tier1: [], tier2: [], tier3: [] },
  }

  function updateRule(updates: Partial<Rule>) {
    setRules(prev => ({ ...prev, [selectedObjId]: { ...rule, ...updates } }))
  }

  function addKeyword(tier: 'keywords_high' | 'keywords_med' | 'keywords_low' | 'keywords_block', kw: string) {
    updateRule({ [tier]: [...rule[tier], kw] })
  }

  function removeKeyword(tier: 'keywords_high' | 'keywords_med' | 'keywords_low' | 'keywords_block', i: number) {
    updateRule({ [tier]: rule[tier].filter((_, idx) => idx !== i) })
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/rules-filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, objective_id: selectedObjId }),
    })
    if (res.ok) {
      const data = await res.json() as { rule: Rule }
      setRules(prev => ({ ...prev, [selectedObjId]: data.rule }))
      setSavedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    }
    setSaving(false)
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-medium text-[var(--text)]">Rules Filter</h1>
          <p className="text-[13px] text-[var(--text3)] mt-0.5">Keyword configuration per objective — controls what signals reach the AI</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Objective selector */}
        <div className="col-span-1">
          <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--gray-lt)]">
              <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-wider">Objectives</p>
            </div>
            {objectives.map(obj => (
              <button
                key={obj.id}
                onClick={() => { setSelectedObjId(obj.id); setSavedAt(null) }}
                className={`w-full text-left px-3 py-2.5 text-[12.5px] border-b border-[var(--border)] last:border-0 transition-colors ${
                  selectedObjId === obj.id
                    ? 'bg-[#E6F1FB] text-[var(--blue)] font-medium'
                    : 'text-[var(--text2)] hover:bg-[var(--gray-lt)]'
                }`}
              >
                <span className="font-mono text-[10px] text-[var(--text3)] block">{obj.obj_id}</span>
                <span className="line-clamp-2">{obj.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Keyword editor */}
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-[var(--border)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[14px] font-medium text-[var(--text)]">{selectedObj?.obj_id} — {selectedObj?.title}</p>
                <p className="text-[11px] text-[var(--text3)] mt-0.5">Enter keyword → press Enter or + to add</p>
              </div>
              <div className="flex items-center gap-3">
                {savedAt && <span className="text-[11px] text-[var(--green)]">Saved {savedAt}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy text-white text-[12px] font-medium hover:bg-[var(--night)] disabled:opacity-50"
                >
                  <Save size={12} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <KeywordSection
              label="High priority — always pass to AI"
              color="var(--green)"
              keywords={rule.keywords_high}
              onAdd={kw => addKeyword('keywords_high', kw)}
              onRemove={i => removeKeyword('keywords_high', i)}
              placeholder="Add a keyword..."
            />
            <KeywordSection
              label="Medium priority — pass if 2+ present"
              color="var(--blue)"
              keywords={rule.keywords_med}
              onAdd={kw => addKeyword('keywords_med', kw)}
              onRemove={i => removeKeyword('keywords_med', i)}
              placeholder="Add a keyword..."
            />
            <KeywordSection
              label="Context only — enrich but don't gate"
              color="var(--text3)"
              keywords={rule.keywords_low}
              onAdd={kw => addKeyword('keywords_low', kw)}
              onRemove={i => removeKeyword('keywords_low', i)}
              placeholder="Add a keyword..."
            />
            <KeywordSection
              label="Block — never pass to AI"
              color="var(--red)"
              keywords={rule.keywords_block}
              onAdd={kw => addKeyword('keywords_block', kw)}
              onRemove={i => removeKeyword('keywords_block', i)}
              placeholder="Add a keyword..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
