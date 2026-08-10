'use client'

import { useState } from 'react'
import { Settings, X, Archive, Pencil, ChevronLeft, Check, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import WatchSourcesPanel, { type WatchSource } from '@/components/watchlist/WatchSourcesPanel'

interface ObjProps {
  id: string
  title: string
  status: string
  confidence: number | null
  target_date: string | null
  deadline_type: 'hard' | 'soft'
  reservation_price: number | null
  context: Record<string, unknown>
  objective_type: string | null
  notes: string | null
  category: string
}

interface OpenPrediction {
  id: string
  statement: string
  confidence_pct: number
  horizon_date: string
}

interface Props {
  obj: ObjProps
  tier: string
  accountType: string | null
  initialSources: WatchSource[]
  unseenAlertCount?: number
  smsAlertsEnabled?: boolean
}

type DrawerView = 'menu' | 'edit' | 'watch'
type ScoreLabel = 'HIT' | 'PARTIAL' | 'MISS'

function outcomeColor(type: ScoreLabel): string {
  if (type === 'HIT') return 'var(--ov-green)'
  if (type === 'PARTIAL') return 'var(--ov-amber)'
  return 'var(--ov-red)'
}

const SCORE_VALUE: Record<ScoreLabel, number> = { HIT: 95, PARTIAL: 60, MISS: 10 }

export default function ObjectiveDetailClient({ obj, tier, accountType, initialSources, unseenAlertCount = 0, smsAlertsEnabled = false }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [view, setView] = useState<DrawerView>('menu')
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Edit form state
  const [title, setTitle]                   = useState(obj.title)
  const [targetDate, setTargetDate]         = useState(obj.target_date ?? '')
  const [deadlineType, setDeadlineType]     = useState<'hard' | 'soft'>(obj.deadline_type ?? 'hard')
  const [reservationPrice, setReservation]  = useState(obj.reservation_price?.toString() ?? '')
  const [notes, setNotes]                   = useState(obj.notes ?? '')
  const isResale = (obj.objective_type ?? '').startsWith('asset.resale')
  const ctx = obj.context ?? {}
  const [listingPrice, setListingPrice]     = useState((ctx.listing_price as string | undefined) ?? '')
  const [targetPrice, setTargetPrice]       = useState((ctx.target_price as string | undefined) ?? '')
  const [floorPrice, setFloorPrice]         = useState((ctx.floor_price as string | undefined) ?? '')

  // Outcome capture modal state
  const [outcomeModalOpen, setOutcomeModalOpen]     = useState(false)
  const [outcomeType, setOutcomeType]               = useState<ScoreLabel | null>(null)
  const [outcomeNote, setOutcomeNote]               = useState('')
  const [actualCompletedAt, setActualCompletedAt]   = useState(new Date().toISOString().split('T')[0])
  const [outcomeSaving, setOutcomeSaving]           = useState(false)
  const [outcomeError, setOutcomeError]             = useState<string | null>(null)

  // Prediction surface state (shown after outcome is saved)
  const [outcomeRowId, setOutcomeRowId]   = useState<string | null>(null)
  const [openPreds, setOpenPreds]         = useState<OpenPrediction[]>([])
  const [predSurface, setPredSurface]     = useState(false)
  const [scoredMap, setScoredMap]         = useState<Record<string, ScoreLabel>>({})
  const [predScoringId, setPredScoringId] = useState<string | null>(null)
  const [predError, setPredError]         = useState<string | null>(null)

  function openDrawer() {
    setView('menu')
    setSaveError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  function openOutcomeModal() {
    setOutcomeType(null)
    setOutcomeNote('')
    setActualCompletedAt(new Date().toISOString().split('T')[0])
    setOutcomeError(null)
    setPredSurface(false)
    setScoredMap({})
    setOutcomeRowId(null)
    closeDrawer()
    setOutcomeModalOpen(true)
  }

  async function handleOutcomeSubmit() {
    if (!outcomeType || !actualCompletedAt) return
    setOutcomeSaving(true)
    setOutcomeError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setOutcomeError('Not authenticated — please refresh and try again.')
      setOutcomeSaving(false)
      return
    }

    const [outcomeResult, archiveResult] = await Promise.all([
      supabase
        .from('objective_outcomes')
        .insert([{
          user_id: user.id,
          objective_id: obj.id,
          outcome_type: outcomeType,
          outcome_note: outcomeNote.trim() || null,
          actual_completed_at: actualCompletedAt,
          swept_at_close: obj.confidence ?? null,
          prediction_id: null,
        }])
        .select('id')
        .single(),
      supabase
        .from('objectives')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', obj.id),
    ])

    setOutcomeSaving(false)

    if (outcomeResult.error || archiveResult.error) {
      setOutcomeError(
        outcomeResult.error?.message ?? archiveResult.error?.message ?? 'Save failed — please try again.'
      )
      return
    }

    const rowId = outcomeResult.data?.id ?? null
    setOutcomeRowId(rowId)

    // Query for unscored predictions linked to this objective
    const { data: preds } = await supabase
      .from('predictions')
      .select('id, statement, confidence_pct, horizon_date')
      .eq('objective_id', obj.id)
      .is('accuracy_score', null)
      .order('created_at', { ascending: false })

    const found = (preds ?? []) as OpenPrediction[]
    if (found.length === 0) {
      setOutcomeModalOpen(false)
      router.push('/objectives')
      router.refresh()
      return
    }

    setOpenPreds(found)
    setPredSurface(true)
  }

  async function handleScorePrediction(predId: string, score: ScoreLabel) {
    if (predScoringId) return // debounce
    setPredScoringId(predId)
    setPredError(null)

    const accuracyScore = SCORE_VALUE[score]

    const [predRes, outcomeRes] = await Promise.all([
      fetch('/api/predictions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: predId, outcome: score, accuracy_score: accuracyScore }),
      }),
      outcomeRowId
        ? fetch(`/api/outcomes/${outcomeRowId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prediction_id: predId }),
          })
        : Promise.resolve(new Response('{}', { status: 200 })),
    ])

    setPredScoringId(null)

    if (!predRes.ok) {
      const body = await predRes.json().catch(() => ({})) as { error?: string }
      setPredError(body.error ?? 'Score failed — please try again.')
      return
    }

    if (!outcomeRes.ok) {
      // Non-fatal: prediction is scored, only the backlink failed
      console.warn('[ff025] outcome prediction_id backfill failed')
    }

    setScoredMap(prev => ({ ...prev, [predId]: score }))
  }

  function handleDone() {
    setOutcomeModalOpen(false)
    router.push('/objectives')
    router.refresh()
  }

  async function handleSave() {
    setSaveError(null)

    if (targetDate) {
      const today = new Date().toISOString().split('T')[0]
      if (targetDate < today) {
        setSaveError('Target date cannot be in the past.')
        return
      }
    }

    setLoading(true)
    const context: Record<string, unknown> = { ...ctx }
    if (isResale) {
      if (listingPrice) context.listing_price = Number(listingPrice)
      if (targetPrice)  context.target_price  = Number(targetPrice)
      if (floorPrice)   context.floor_price   = Number(floorPrice)
    }

    const res = await fetch(`/api/objectives/${obj.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        target_date: targetDate || null,
        deadline_type: deadlineType,
        reservation_price: reservationPrice ? Number(reservationPrice) : null,
        notes: notes || null,
        context,
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const d = await res.json() as { error?: string; target_date?: string }
      if (d.error === 'past_target_date') {
        setSaveError(`Date ${d.target_date} is in the past — please choose a future date.`)
      } else {
        setSaveError(d.error ?? 'Save failed — please try again.')
      }
      return
    }

    closeDrawer()
    router.refresh()
  }

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide mb-1'
  const inputCls = 'w-full px-3 py-2 rounded-lg border text-[13px] focus:outline-none transition-colors'

  return (
    <>
      <button
        onClick={openDrawer}
        className="p-2 rounded-lg flex-shrink-0 transition-colors"
        style={{ color: 'var(--ov-text-dim)' }}
        aria-label="Goal settings"
      >
        <Settings size={16} />
      </button>

      {/* Settings drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="relative w-80 h-full shadow-xl flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--ov-navy-card)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ov-border)' }}>
              {view !== 'menu' ? (
                <button
                  onClick={() => setView('menu')}
                  className="flex items-center gap-1 text-[13px]"
                  style={{ color: 'var(--ov-text-mid)' }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
              ) : (
                <h2 className="text-[15px] font-medium" style={{ color: 'var(--ov-text-hi)' }}>Goal settings</h2>
              )}
              <button onClick={closeDrawer} style={{ color: 'var(--ov-text-dim)' }}>
                <X size={18} />
              </button>
            </div>

            {/* Menu view */}
            {view === 'menu' && (
              <div className="p-5 flex flex-col gap-3 overflow-y-auto flex-1">
                <p className="text-[12px] mb-1 leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>{obj.title}</p>
                <button
                  onClick={() => setView('edit')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] text-left transition-colors"
                  style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                >
                  <Pencil size={14} style={{ color: 'var(--ov-blue)' }} />
                  Edit goal
                </button>
                <button
                  onClick={() => setView('watch')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] text-left transition-colors"
                  style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                >
                  <Eye size={14} style={{ color: 'var(--ov-blue)' }} />
                  Watch sources
                  {unseenAlertCount > 0 && (
                    <span
                      className="ml-auto flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: '#C9A227', color: '#0A1628' }}
                    >
                      {unseenAlertCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={openOutcomeModal}
                  disabled={loading || obj.status === 'closed'}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] text-left disabled:opacity-40 transition-colors"
                  style={{ border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-mid)' }}
                >
                  <Archive size={14} style={{ color: 'var(--ov-amber)' }} />
                  {obj.status === 'closed' ? 'Already archived' : 'Archive goal'}
                </button>
              </div>
            )}

            {/* Edit view */}
            {view === 'edit' && (
              <div className="flex flex-col flex-1 min-h-0">
              <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
                {saveError && (
                  <div className="p-3 rounded-lg text-[12px]" style={{ background: 'rgba(200,90,84,.12)', color: '#C85A54' }}>
                    {saveError}
                  </div>
                )}

                <div>
                  <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Title</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className={inputCls}
                    style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Target date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={e => setTargetDate(e.target.value)}
                    className={inputCls}
                    style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: '#1a1a2e', colorScheme: 'light' }}
                  />
                </div>

                <div>
                  <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Deadline type</label>
                  <select
                    value={deadlineType}
                    onChange={e => setDeadlineType(e.target.value as 'hard' | 'soft')}
                    className={inputCls}
                    style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                  >
                    <option value="hard">Hard — must complete by date</option>
                    <option value="soft">Soft — reservation / optional (retained is OK)</option>
                  </select>
                </div>

                {deadlineType === 'soft' && (
                  <div>
                    <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Reservation price (floor)</label>
                    <input
                      type="number"
                      value={reservationPrice}
                      onChange={e => setReservation(e.target.value)}
                      placeholder="e.g. 25000"
                      className={inputCls}
                      style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                    />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--ov-text-dim)' }}>
                      Minimum acceptable value. Confidence = P(terms met by this price or better).
                    </p>
                  </div>
                )}

                {isResale && (
                  <>
                    <div style={{ borderTop: '1px solid var(--ov-border)', paddingTop: '12px' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--ov-text-dim)' }}>Resale pricing</p>
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Listing / asking price</label>
                      <input
                        type="number"
                        value={listingPrice}
                        onChange={e => setListingPrice(e.target.value)}
                        placeholder="e.g. 35000"
                        className={inputCls}
                        style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Target sale price</label>
                      <input
                        type="number"
                        value={targetPrice}
                        onChange={e => setTargetPrice(e.target.value)}
                        placeholder="e.g. 30000"
                        className={inputCls}
                        style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                      />
                    </div>
                    <div>
                      <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Floor price (walk-away)</label>
                      <input
                        type="number"
                        value={floorPrice}
                        onChange={e => setFloorPrice(e.target.value)}
                        placeholder="e.g. 25000"
                        className={inputCls}
                        style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls} style={{ color: 'var(--ov-text-dim)' }}>Notes</label>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                    className={inputCls}
                    style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)', resize: 'none' }}
                  />
                </div>

              </div>
              <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--ov-border)' }}>
                <button
                  onClick={handleSave}
                  disabled={loading || !title.trim()}
                  className="w-full py-2.5 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-40"
                  style={{ background: 'var(--gold)', color: '#0a1628' }}
                >
                  {loading ? 'Saving...' : 'Save changes'}
                </button>
              </div>
              </div>
            )}

            {/* Watch view */}
            {view === 'watch' && (
              <WatchSourcesPanel
                objectiveId={obj.id}
                tier={tier}
                accountType={accountType}
                initialSources={initialSources}
                smsAlertsEnabled={smsAlertsEnabled}
              />
            )}
          </div>
        </div>
      )}

      {/* Outcome capture modal */}
      {outcomeModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={predSurface ? undefined : () => setOutcomeModalOpen(false)} />
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-xl flex flex-col p-6"
            style={{ backgroundColor: 'var(--ov-navy-card)', border: '1px solid var(--ov-border-md)', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {!predSurface ? (
              /* ── Outcome form ── */
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-[16px] font-semibold mb-0.5" style={{ color: 'var(--ov-text-hi)' }}>Record outcome</h2>
                  <p className="text-[12px]" style={{ color: 'var(--ov-text-dim)' }}>{obj.title}</p>
                </div>

                {/* Outcome type */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ov-text-dim)' }}>
                    Outcome <span style={{ color: 'var(--ov-red)' }}>*</span>
                  </label>
                  <div className="flex gap-2">
                    {(['HIT', 'PARTIAL', 'MISS'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => setOutcomeType(type)}
                        className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                        style={{
                          border: `1px solid ${outcomeType === type ? outcomeColor(type) : 'var(--ov-border-md)'}`,
                          backgroundColor: outcomeType === type ? `${outcomeColor(type)}20` : 'transparent',
                          color: outcomeType === type ? outcomeColor(type) : 'var(--ov-text-dim)',
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Outcome note */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ov-text-dim)' }}>
                      What happened <span style={{ color: 'var(--ov-text-dim)', fontWeight: 400 }}>(optional)</span>
                    </label>
                    <span
                      className="text-[10px]"
                      style={{ color: outcomeNote.length > 450 ? 'var(--ov-amber)' : 'var(--ov-text-dim)' }}
                    >
                      {outcomeNote.length}/500
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={outcomeNote}
                    onChange={e => setOutcomeNote(e.target.value.slice(0, 500))}
                    placeholder="Describe what happened and the result..."
                    className="w-full px-3 py-2 rounded-lg text-[12px] resize-none focus:outline-none"
                    style={{ backgroundColor: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                  />
                </div>

                {/* Completion date */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--ov-text-dim)' }}>
                    Completion date <span style={{ color: 'var(--ov-red)' }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={actualCompletedAt}
                    onChange={e => setActualCompletedAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[12px] focus:outline-none"
                    style={{ backgroundColor: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
                  />
                </div>

                {outcomeError && (
                  <div className="px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: 'rgba(200,90,84,.12)', color: '#C85A54' }}>
                    {outcomeError}
                  </div>
                )}

                <button
                  onClick={handleOutcomeSubmit}
                  disabled={outcomeSaving || !outcomeType || !actualCompletedAt}
                  className="w-full py-2.5 rounded-xl text-[14px] font-medium transition-colors disabled:opacity-40"
                  style={{ background: 'var(--gold)', color: '#0a1628' }}
                >
                  {outcomeSaving ? 'Saving...' : 'Record & archive goal'}
                </button>
              </div>
            ) : (
              /* ── Prediction scoring surface ── */
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="text-[16px] font-semibold mb-0.5" style={{ color: 'var(--ov-text-hi)' }}>Score your predictions</h2>
                  <p className="text-[12px]" style={{ color: 'var(--ov-text-dim)' }}>
                    {openPreds.length} open prediction{openPreds.length !== 1 ? 's' : ''} linked to this goal
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {openPreds.map(pred => {
                    const scored = scoredMap[pred.id]
                    const isScoring = predScoringId === pred.id
                    return (
                      <div
                        key={pred.id}
                        className="rounded-xl p-4 flex flex-col gap-3 transition-opacity"
                        style={{
                          border: '1px solid var(--ov-border-md)',
                          backgroundColor: 'var(--ov-navy)',
                          opacity: scored ? 0.55 : 1,
                        }}
                      >
                        <p className="text-[13px] leading-snug" style={{ color: 'var(--ov-text-hi)' }}>
                          {pred.statement}
                        </p>
                        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--ov-text-dim)' }}>
                          <span>{pred.confidence_pct}% confidence</span>
                          <span>·</span>
                          <span>
                            {new Date(pred.horizon_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {scored ? (
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: outcomeColor(scored) }}>
                            <Check size={13} />
                            {scored}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {(['HIT', 'PARTIAL', 'MISS'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => handleScorePrediction(pred.id, s)}
                                disabled={isScoring || !!predScoringId}
                                className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40"
                                style={{
                                  border: `1px solid var(--ov-border-md)`,
                                  backgroundColor: 'transparent',
                                  color: 'var(--ov-text-dim)',
                                }}
                              >
                                {isScoring ? '...' : s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {predError && (
                  <div className="px-3 py-2 rounded-lg text-[11px]" style={{ backgroundColor: 'rgba(200,90,84,.12)', color: '#C85A54' }}>
                    {predError}
                  </div>
                )}

                <button
                  onClick={handleDone}
                  className="w-full py-2.5 rounded-xl text-[14px] font-medium transition-colors"
                  style={{ background: 'var(--gold)', color: '#0a1628' }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
