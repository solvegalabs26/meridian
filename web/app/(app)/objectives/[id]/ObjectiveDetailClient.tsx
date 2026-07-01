'use client'

import { useState } from 'react'
import { Settings, X, Archive } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  obj: { id: string; title: string; status: string }
}

export default function ObjectiveDetailClient({ obj }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleArchive() {
    if (!confirm(`Archive "${obj.title}"? You can reactivate it later.`)) return
    setLoading(true)
    await supabase
      .from('objectives')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', obj.id)
    setLoading(false)
    setDrawerOpen(false)
    router.push('/objectives')
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="p-2 rounded-lg flex-shrink-0 transition-colors"
        style={{ color: 'var(--ov-text-dim)' }}
      >
        <Settings size={16} />
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-80 h-full shadow-xl flex flex-col" style={{ backgroundColor: 'var(--ov-navy-card)' }}>
            <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--ov-border)' }}>
              <h2 className="text-[15px] font-medium" style={{ color: 'var(--ov-text-hi)' }}>Goal settings</h2>
              <button onClick={() => setDrawerOpen(false)} style={{ color: 'var(--ov-text-dim)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-[12px] mb-1 leading-relaxed" style={{ color: 'var(--ov-text-mid)' }}>{obj.title}</p>
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
          </div>
        </div>
      )}
    </>
  )
}
