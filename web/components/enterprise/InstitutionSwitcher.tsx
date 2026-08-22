'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface InstitutionOption {
  id: string
  name: string
}

export function InstitutionSwitcher() {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentIid = searchParams.get('iid')

  const [institutions, setInstitutions] = useState<InstitutionOption[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: members, error: membersErr } = await supabase
        .from('enterprise_members')
        .select('institution_id')
        .eq('user_id', user.id)

      if (membersErr) { console.error('[InstitutionSwitcher] members query:', membersErr.message); return }
      if (!members || members.length === 0) { setLoaded(true); return }

      const ids = members.map(m => m.institution_id as string)

      const { data: insts, error: instsErr } = await supabase
        .from('enterprise_institutions')
        .select('id, name')
        .in('id', ids)
        .eq('status', 'active')

      if (instsErr) { console.error('[InstitutionSwitcher] institutions query:', instsErr.message); return }

      setInstitutions((insts ?? []) as InstitutionOption[])
      setLoaded(true)
    }
    load()
  }, [supabase])

  if (!loaded || institutions.length < 2) return null

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('iid', e.target.value)
    router.push(`${pathname}?${params.toString()}`)
  }

  const selectedId = currentIid ?? institutions[0].id

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 whitespace-nowrap">Institution</span>
      <select
        value={selectedId}
        onChange={handleChange}
        className="text-sm bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {institutions.map(inst => (
          <option key={inst.id} value={inst.id}>
            {inst.name}
          </option>
        ))}
      </select>
    </div>
  )
}
