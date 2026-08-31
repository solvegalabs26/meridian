'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useVoice } from '@/lib/voice/useVoice'

export function FloatingVoiceButton() {
  const { voiceMode, wakeWordActive, setWakeWordActive } = useAppStore()
  const { isSupported, isListening, startListening, stopListening } = useVoice()
  const [activated, setActivated] = useState(false)

  // Auto-activate when wake word fires
  useEffect(() => {
    if (wakeWordActive && isSupported && !isListening) {
      setActivated(true)
      startListening()
    }
  }, [wakeWordActive, isSupported, isListening, startListening])

  // Reset wakeWordActive when listening ends
  useEffect(() => {
    if (!isListening && activated) {
      setActivated(false)
      setWakeWordActive(false)
    }
  }, [isListening, activated, setWakeWordActive])

  if (!voiceMode || !isSupported) return null

  function handleTap() {
    if (isListening) {
      stopListening()
      setActivated(false)
    } else {
      setActivated(true)
      startListening()
    }
  }

  return (
    <button
      onClick={handleTap}
      aria-label={isListening ? 'Stop listening' : 'Start voice input'}
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center rounded-full shadow-lg transition-all"
      style={{
        width: 56,
        height: 56,
        backgroundColor: isListening ? 'var(--blue)' : 'var(--navy)',
        color: '#fff',
      }}
    >
      {isListening
        ? <Mic size={24} className="animate-pulse" />
        : <MicOff size={24} />
      }
    </button>
  )
}
