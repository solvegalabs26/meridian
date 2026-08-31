'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { WakeWordListener } from './WakeWordListener'
import { FloatingVoiceButton } from './FloatingVoiceButton'
import type { VoiceTier } from '@/lib/voice/voiceTier'

interface VoiceInitProps {
  voiceTier: VoiceTier
  voiceMode: boolean
  tier?: string | null
  accountType?: string | null
  voiceAddon?: boolean
}

export function VoiceInit({ voiceTier, voiceMode, tier, accountType, voiceAddon }: VoiceInitProps) {
  const initVoiceState = useAppStore(s => s.initVoiceState)

  useEffect(() => {
    initVoiceState({
      voice_mode: voiceMode,
      tier,
      account_type: accountType,
      voice_addon: voiceAddon ?? false,
    })
  }, [voiceMode, tier, accountType, voiceAddon, initVoiceState])

  return (
    <>
      {voiceTier === 'full' && voiceMode && <WakeWordListener />}
      <FloatingVoiceButton />
    </>
  )
}
