import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--gray-lt)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-[var(--border)] p-10">
          <p className="text-[11px] font-semibold text-[var(--text3)] uppercase tracking-widest mb-2">Solvega Labs LLC</p>
          <h1 className="text-[28px] font-medium text-[var(--text)] mb-1">Terms of Service</h1>
          <p className="text-[12px] text-[var(--text3)] mb-8">Last updated: July 2, 2026 · Alpha/Beta period version</p>

          <div className="prose-sm text-[14px] text-[var(--text2)] leading-relaxed space-y-6">

            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-[13px] text-amber-800">
                <strong>Note:</strong> These terms are interim and apply during Meridian Arc&apos;s private alpha and beta period.
                Final Terms of Service are being finalized with legal counsel and will be published before any paid subscriptions are processed.
                By using Meridian Arc during this period, you accept these interim terms.
              </p>
            </div>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">1. Who We Are</h2>
              <p>
                Meridian Arc is a product of Solvega Labs LLC, a Florida limited liability company. By accessing or using Meridian Arc,
                you agree to be bound by these Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">2. Nature of the Service</h2>
              <p>
                Meridian Arc provides AI-generated signal analysis, confidence scoring, and goal-tracking tools for informational purposes only.
                The service is not financial, legal, career, investment, or medical advice. Confidence scores are probabilistic estimates,
                not guarantees of outcomes.
              </p>
              <p className="mt-2">
                You are solely responsible for any decisions you make based on information provided by Meridian Arc.
                Always verify signals independently before acting on them.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">3. Alpha and Beta Access</h2>
              <p>
                During the private alpha and beta periods, access is granted by invitation only. Invite codes are non-transferable.
                Solvega Labs reserves the right to revoke access at any time without notice during this period.
              </p>
              <p className="mt-2">
                Features, pricing, and availability may change without advance notice during alpha and beta.
                Your continued use constitutes acceptance of any changes.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">4. Your Account</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs
                under your account. You must be at least 18 years old to use Meridian Arc.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">5. Prohibited Uses</h2>
              <p>You agree not to:</p>
              <ul className="list-disc ml-5 mt-2 space-y-1">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to reverse-engineer, scrape, or circumvent any part of the service</li>
                <li>Share your account credentials or invite codes with others</li>
                <li>Use the service to harm, defraud, or mislead other people</li>
                <li>Upload content that is illegal, defamatory, or infringes third-party rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">6. Intellectual Property</h2>
              <p>
                All content, design, and software comprising Meridian Arc is owned by or licensed to Solvega Labs LLC.
                You retain ownership of any personal data or goals you enter into the platform.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">7. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Solvega Labs LLC shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages, including lost profits or data, arising from your use of or inability to use the service.
                Our total liability to you for any claim arising from these Terms shall not exceed $100.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">8. Disclaimer of Warranties</h2>
              <p>
                The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or implied.
                We do not warrant that the service will be uninterrupted, error-free, or free of harmful components.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">9. Governing Law</h2>
              <p>
                These Terms are governed by the laws of the State of Florida, without regard to its conflict-of-law provisions.
                Any disputes shall be resolved in the courts of Florida.
              </p>
            </section>

            <section>
              <h2 className="text-[16px] font-semibold text-[var(--text)] mb-2">10. Contact</h2>
              <p>
                Questions about these Terms?{' '}
                <a href="mailto:jason@solvega.ai" className="text-[var(--blue)] hover:underline">
                  jason@solvega.ai
                </a>
              </p>
            </section>

          </div>

          <div className="mt-8 pt-6 border-t border-[var(--border)] flex items-center gap-4 text-[12px]">
            <Link href="/legal/privacy" className="text-[var(--blue)] hover:underline">Privacy Policy</Link>
            <span className="text-[var(--text3)]">·</span>
            <Link href="/dashboard" className="text-[var(--text3)] hover:text-[var(--text)]">Back to dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
