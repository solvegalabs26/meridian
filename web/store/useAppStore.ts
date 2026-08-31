import { create } from 'zustand'
import { userVoiceTier, type VoiceTier } from '@/lib/voice/voiceTier'

interface AppState {
  voiceMode: boolean
  voiceTier: VoiceTier
  wakeWordActive: boolean
  drivingMode: boolean
  setVoiceMode: (v: boolean) => void
  setWakeWordActive: (v: boolean) => void
  setDrivingMode: (v: boolean) => void
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
  wakeWordActive: false,
  drivingMode: false,
  setVoiceMode: (v) => set({ voiceMode: v }),
  setWakeWordActive: (v) => set({ wakeWordActive: v }),
  setDrivingMode: (v) => set({ drivingMode: v }),
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
