'use client'

import { useEffect } from 'react'
import { Mic } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { createClient } from '@/lib/supabase/client'
import type { VoiceBrief } from '@/lib/voice/voiceBriefTypes'
import { VoiceMeridian } from './VoiceMeridian'

export function FloatingVoiceButton() {
  const { voiceMode, voiceMeridianOpen, setVoiceMeridianOpen, latestVoiceBrief, setLatestVoiceBrief } = useAppStore()

  // Fetch latest voice brief on mount
  useEffect(() => {
    if (!voiceMode) return
    async function fetchBrief() {
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
        setLatestVoiceBrief(data.voice_brief as unknown as VoiceBrief)
      }
    }
    void fetchBrief()
  }, [voiceMode, setLatestVoiceBrief])

  if (!voiceMode) return null

  return (
    <>
      <button
        onClick={() => setVoiceMeridianOpen(true)}
        aria-label="Open Voice Meridian"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all"
        style={{
          width: 56,
          height: 56,
          backgroundColor: voiceMeridianOpen ? 'var(--blue)' : 'var(--navy)',
          color: '#fff',
        }}
      >
        <Mic size={24} />
      </button>

      {voiceMeridianOpen && (
        <VoiceMeridian
          onClose={() => setVoiceMeridianOpen(false)}
          initialBrief={latestVoiceBrief}
        />
      )}
    </>
  )
}
