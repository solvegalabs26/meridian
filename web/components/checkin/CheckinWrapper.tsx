'use client'

import { useEffect, useState } from 'react'
import WeeklyCheckinModal from './WeeklyCheckinModal'

interface EligibilityResponse {
  eligible: boolean
  objectives?: { id: string; obj_id: string; title: string }[]
  sweepId?: string | null
}

export default function CheckinWrapper() {
  const [show, setShow] = useState(false)
  const [objectives, setObjectives] = useState<{ id: string; obj_id: string; title: string }[]>([])
  const [sweepId, setSweepId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/checkin')
      .then(r => r.json())
      .then((data: EligibilityResponse) => {
        if (data.eligible) {
          setObjectives(data.objectives ?? [])
          setSweepId(data.sweepId ?? null)
          setShow(true)
        }
      })
      .catch(() => {
        // Non-fatal — silently skip if eligibility check fails
      })
  }, [])

  if (!show) return null

  return (
    <WeeklyCheckinModal
      open={show}
      onClose={() => setShow(false)}
      objectives={objectives}
      sweepId={sweepId}
    />
  )
}
