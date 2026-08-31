import { create } from 'zustand'
import { userVoiceTier, type VoiceTier } from '@/lib/voice/voiceTier'

interface AppState {
  voiceMode: boolean
  voiceTier: VoiceTier
  setVoiceMode: (v: boolean) => void
  initVoiceState: (profile: {
    voice_mode?: boolean | null
    tier?: string | null
    account_type?: string | null
    voice_addon?: boolean | null
  }) => void
}

export const useAppStore = create<AppState>((set) => ({
  voiceMode: false,
  voiceTier: 'input',
  setVoiceMode: (v) => set({ voiceMode: v }),
  initVoiceState: (profile) => {
    set({
      voiceMode: profile.voice_mode ?? false,
      voiceTier: userVoiceTier({
        pricing_tier: profile.tier,
        account_type: profile.account_type,
        voice_addon: profile.voice_addon ?? false,
      }),
    })
  },
}))
