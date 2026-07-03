import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--gray-lt)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-[var(--border)] p-10">
          <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Solvega Labs LLC</p>
          <h1 className="text-[28px] font-medium text-[var(--text)] mb-1">Privacy Policy</h1>
          <p className="text-[12px] text-[var(--text3)] mb-8">Last updated: July 2, 2026 · Alpha/Beta period version</p>

          <div className="prose-sm text-[14px] text-[var(--text2)] leading-relaxed space-y-6">

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[13px] text-amber-800">
                <strong>Note:</strong> This Privacy Policy is interim and applies during Meridian Arc&apos;s private alpha and beta period.
                A full Privacy Policy compliant with GDPR, CCPA, and applicable U.S. state laws is being finalized with legal counsel
                and will be published before any paid subscriptions are processed.
              </p>
            </div>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">1. What We Collect</h2>
              <p>We collect the following categories of information when you use Meridian Arc:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li><strong>Account data:</strong> email address, name, and account preferences you provide during onboarding</li>
                <li><strong>Goal and journal data:</strong> objectives, outcomes, journal entries, and confidence scores you enter</li>
                <li><strong>Usage data:</strong> sweep history, signal reads, and feature interactions</li>
                <li><strong>Device data:</strong> IP address, browser type, and session metadata (via Supabase Auth)</li>
              </ul>
              <p className="mt-2">We do not collect payment card data directly — this will be handled by Stripe when billing is enabled.</p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">2. How We Use Your Data</h2>
              <p>We use your data to:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Provide, personalize, and improve the Meridian Arc service</li>
                <li>Run AI sweeps and generate confidence scores for your goals</li>
                <li>Send transactional emails (sweep reports, confidence alerts)</li>
                <li>Detect and prevent fraud or abuse</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">3. How We Share Your Data</h2>
              <p>
                We do not sell your personal data. We share data only with:
              </p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li><strong>Supabase:</strong> database and authentication (data stored in US-East region)</li>
                <li><strong>OpenAI / Anthropic:</strong> AI models used to analyze sweep signals (your goal context may be included in prompts)</li>
                <li><strong>Resend:</strong> transactional email delivery</li>
                <li><strong>Vercel:</strong> hosting and edge infrastructure</li>
              </ul>
              <p className="mt-2">
                Each third party is bound by their own privacy policies and data processing agreements.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">4. Data Retention</h2>
              <p>
                We retain your data for as long as your account is active. If you request account deletion,
                we will delete your personal data within 30 days, except where we are required to retain it by law.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">5. Security</h2>
              <p>
                Your data is stored securely in Supabase with row-level security policies. All data in transit is encrypted via TLS.
                We do not store passwords — authentication is managed by Supabase Auth.
              </p>
              <p className="mt-2">
                No system is perfectly secure. If you discover a security issue, please report it to{' '}
                <a href="mailto:jason@solvega.ai" className="text-[var(--blue)] hover:underline">jason@solvega.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">6. Your Rights</h2>
              <p>
                Depending on your jurisdiction, you may have the right to access, correct, or delete your personal data,
                or to restrict or object to its processing. To exercise any of these rights, contact us at{' '}
                <a href="mailto:jason@solvega.ai" className="text-[var(--blue)] hover:underline">jason@solvega.ai</a>.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">7. Cookies</h2>
              <p>
                Meridian Arc uses cookies and local storage solely for session management (Supabase Auth tokens).
                We do not use third-party advertising or tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">8. Children</h2>
              <p>
                Meridian Arc is not directed at children under 18. We do not knowingly collect data from minors.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy at any time. The updated version will be posted at this URL with a revised
                &ldquo;Last updated&rdquo; date. Your continued use after a change constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">10. Contact</h2>
              <p>
                Questions about this Privacy Policy?{' '}
                <a href="mailto:jason@solvega.ai" className="text-[var(--blue)] hover:underline">
                  jason@solvega.ai
                </a>
              </p>
            </section>

          </div>

          <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center gap-4 text-[12px]">
            <Link href="/legal/terms" className="text-[var(--blue)] hover:underline">Terms of Service</Link>
            <span className="text-[var(--text3)]">·</span>
            <Link href="/dashboard" className="text-[var(--text3)] hover:text-[var(--text)]">Back to dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
