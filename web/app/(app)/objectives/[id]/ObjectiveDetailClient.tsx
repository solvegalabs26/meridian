'use client'

import { useState } from 'react'
import { Settings, X, Archive, Pencil, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface ObjProps {
  id: string
  title: string
  status: string
  target_date: string | null
  deadline_type: 'hard' | 'soft'
  reservation_price: number | null
  context: Record<string, unknown>
  objective_type: string | null
  notes: string | null
}

interface Props {
  obj: ObjProps
}

type DrawerView = 'menu' | 'edit'

export default function ObjectiveDetailClient({ obj }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [view, setView] = useState<DrawerView>('menu')
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Edit form state — initialised from the current objective values
  const [title, setTitle]                   = useState(obj.title)
  const [targetDate, setTargetDate]         = useState(obj.target_date ?? '')
  const [deadlineType, setDeadlineType]     = useState<'hard' | 'soft'>(obj.deadline_type ?? 'hard')
  const [reservationPrice, setReservation]  = useState(obj.reservation_price?.toString() ?? '')
  const [notes, setNotes]                   = useState(obj.notes ?? '')
  // Resale-specific context fields
  const isResale = (obj.objective_type ?? '').startsWith('asset.resale')
  const ctx = obj.context ?? {}
  const [listingPrice, setListingPrice]     = useState((ctx.listing_price as string | undefined) ?? '')
  const [targetPrice, setTargetPrice]       = useState((ctx.target_price as string | undefined) ?? '')
  const [floorPrice, setFloorPrice]         = useState((ctx.floor_price as string | undefined) ?? '')

  function openDrawer() {
    setView('menu')
    setSaveError(null)
    setDrawerOpen(true)
  }

  function closeDrawer() {
    setDrawerOpen(false)
  }

  async function handleArchive() {
    if (!confirm(`Archive "${obj.title}"? You can reactivate it later.`)) return
    setLoading(true)
    await supabase
      .from('objectives')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', obj.id)
    setLoading(false)
    closeDrawer()
    router.push('/objectives')
    router.refresh()
  }

  async function handleSave() {
    setSaveError(null)

    // Client-side past-date check
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

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer} />
          <div className="relative w-80 h-full shadow-xl flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--ov-navy-card)' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--ov-border)' }}>
              {view === 'edit' ? (
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
                  onClick={handleArchive}
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
                    style={{ background: 'var(--ov-navy)', border: '1px solid var(--ov-border-md)', color: 'var(--ov-text-hi)' }}
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
              {/* Sticky save footer — always visible regardless of form height */}
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
          </div>
        </div>
      )}
    </>
  )
}
