export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--gray-lt)] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-[var(--border)] p-10 max-w-lg w-full text-center">
        <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-widest mb-3">Solvega Labs LLC</p>
        <h1 className="text-[24px] font-medium text-[var(--text)] mb-2">Terms of Service</h1>
        <p className="text-[15px] text-[var(--text3)] mb-6">Coming soon — Meridian Arc is currently in private beta.</p>
        <p className="text-[13px] text-[var(--text2)]">
          Questions?{' '}
          <a href="mailto:jason@solvega.ai" className="text-[var(--blue)] hover:underline">
            jason@solvega.ai
          </a>
        </p>
      </div>
    </div>
  )
}
