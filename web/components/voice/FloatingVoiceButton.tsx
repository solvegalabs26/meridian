'use client'

import { useEffect } from 'react'
import { Mic } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import type { VoiceBrief } from '@/lib/voice/voiceBriefTypes'
import { VoiceMeridian } from './VoiceMeridian'

export function FloatingVoiceButton() {
  const {
    voiceMode, voiceMeridianOpen, setVoiceMeridianOpen,
    latestVoiceBrief, setLatestVoiceBrief,
    briefReadyBadge, setBriefReadyBadge,
    lastBriefHeardAt, setLastBriefHeardAt,
  } = useAppStore()

  useEffect(() => {
    if (!voiceMode) return
    async function fetchBriefAndBadge() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('sweeps')
        .select('voice_brief')
        .eq('user_id', user.id)
        .eq('status', 'complete')
        .not('voice_brief', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()
      if (data?.voice_brief) {
        const brief = data.voice_brief as unknown as VoiceBrief
        setLatestVoiceBrief(brief)
        const heard = lastBriefHeardAt
        if (!heard || brief.generated_at > heard) {
          setBriefReadyBadge(true)
        }
      }
    }
    void fetchBriefAndBadge()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode])

  // Sync lastBriefHeardAt into badge whenever it changes from outside
  useEffect(() => {
    if (!latestVoiceBrief) return
    if (!lastBriefHeardAt || latestVoiceBrief.generated_at > lastBriefHeardAt) {
      setBriefReadyBadge(true)
    } else {
      setBriefReadyBadge(false)
    }
  }, [lastBriefHeardAt, latestVoiceBrief, setBriefReadyBadge])

  if (!voiceMode) return null

  return (
    <>
      <button
        onClick={() => setVoiceMeridianOpen(true)}
        aria-label="Open Voice Meridian"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all relative"
        style={{
          width: 56,
          height: 56,
          backgroundColor: voiceMeridianOpen ? 'var(--blue)' : 'var(--navy)',
          color: '#fff',
        }}
      >
        <Mic size={24} />
        {briefReadyBadge && !voiceMeridianOpen && (
          <span
            className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full"
            style={{ backgroundColor: 'var(--gold, #C8A84B)', border: '2px solid var(--navy)' }}
          />
        )}
      </button>

      {voiceMeridianOpen && (
        <VoiceMeridian
          onClose={() => setVoiceMeridianOpen(false)}
          initialBrief={latestVoiceBrief}
          onBriefHeard={() => {
            const now = new Date().toISOString()
            setLastBriefHeardAt(now)
            setBriefReadyBadge(false)
            void fetch('/api/profile', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ last_brief_heard_at: now }),
            })
          }}
        />
      )}
    </>
  )
}
