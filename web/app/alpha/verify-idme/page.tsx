'use client'

import MeridianBeacon from '@/components/brand/MeridianBeacon'

// Stub for the veteran cohort's ID.me verification step. requires_idme
// codes park account_type at 'veteran_pending' on redemption (see
// redeem_invite_code) rather than granting veteran access outright — the
// actual ID.me callback and the rest of this flow (what happens after
// verification) are not built yet, targeted for a later session.
export default function AlphaVerifyIdmePage() {
  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-8">
        <MeridianBeacon size={64} variant="gold" animate={false} />
      </div>
      <h1 className="text-[24px] font-light text-white mb-3">Veteran status pending verification</h1>
      <p className="text-[15px] text-white/50 max-w-md leading-relaxed">
        ID.me verification isn&apos;t live yet. Your account is created and your invite code has been claimed —
        we&apos;ll follow up directly once verification is ready, and your account will be upgraded automatically.
      </p>
    </div>
  )
}
