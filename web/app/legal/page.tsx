import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal — Meridian Arc',
  description: 'Terms of Service, Privacy Policy, and Acceptable Use Policy for Meridian Arc by Solvega Labs LLC.',
}

const NAV = [
  { href: '#tos',     label: 'Terms of Service' },
  { href: '#tos-1',   label: '1. Acceptance',           sub: true },
  { href: '#tos-2',   label: '2. Service description',  sub: true },
  { href: '#tos-3',   label: '3. AI disclaimer',        sub: true },
  { href: '#tos-4',   label: '4. Not professional advice', sub: true },
  { href: '#tos-5',   label: '5. Subscriptions',        sub: true },
  { href: '#tos-6',   label: '6. Acceptable use',       sub: true },
  { href: '#tos-7',   label: '7. IP & data ownership',  sub: true },
  { href: '#tos-8',   label: '8. Limitation of liability', sub: true },
  { href: '#tos-9',   label: '9. Termination',          sub: true },
  { href: '#tos-10',  label: '10. Governing law',       sub: true },
  { href: '#privacy', label: 'Privacy Policy' },
  { href: '#pp-1',    label: '1. What we collect',      sub: true },
  { href: '#pp-2',    label: '2. How we use it',        sub: true },
  { href: '#pp-3',    label: '3. Third parties',        sub: true },
  { href: '#pp-4',    label: '4. Retention',            sub: true },
  { href: '#pp-5',    label: '5. Your rights',          sub: true },
  { href: '#aup',     label: 'Acceptable Use Policy' },
]

export default function LegalPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, lineHeight: 1.65, color: '#1A1A18' }}>

      {/* ── Sidenav ─────────────────────────────────────────────────────── */}
      <nav style={{ position: 'fixed', top: 0, left: 0, width: 220, height: '100vh', background: '#0D1B3E', overflowY: 'auto', padding: '1.5rem 0', zIndex: 100, flexShrink: 0 }}>
        <div style={{ padding: '.75rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: '.75rem' }}>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Meridian Arc</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>Legal Documents</div>
          </Link>
        </div>
        <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)', padding: '.6rem 1.25rem .3rem' }}>
          Documents
        </div>
        {NAV.map(({ href, label, sub }) => (
          <a
            key={href}
            href={href}
            style={{
              display: 'block',
              fontSize: sub ? 11 : 12,
              color: 'rgba(255,255,255,.52)',
              padding: sub ? '.32rem 1.75rem' : '.38rem 1.25rem',
              textDecoration: 'none',
              borderLeft: '2px solid transparent',
              transition: 'all .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderLeftColor = '#2E7CB8' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,.52)'; e.currentTarget.style.borderLeftColor = 'transparent' }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main style={{ marginLeft: 220, padding: '3rem 3.5rem 6rem', maxWidth: 1060, width: '100%' }}>
        <div style={{ maxWidth: 780 }}>

          {/* Page header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.02em', marginBottom: '.3rem', color: '#0D1B3E' }}>Solvega Labs · Meridian Arc</h1>
            <p style={{ fontSize: 15, color: '#888780', fontWeight: 400, marginBottom: '.5rem' }}>Legal Documents</p>
            <p style={{ fontSize: 12, color: '#888780' }}>Solvega Labs LLC · Salt Lake City, Utah · connect@solvega.ai</p>
          </div>

          {/* ── TERMS OF SERVICE ──────────────────────────────────────── */}
          <DocSection id="tos" title="Meridian Terms of Service">

            <Clause id="tos-1" num="1" heading="Acceptance of Terms">
              <P>By creating an account, accessing, or using the Meridian platform ("Service"), you agree to be bound by these Terms of Service ("Terms") and our Privacy Policy. If you do not agree to these Terms, do not use the Service.</P>
              <P>These Terms constitute a legally binding agreement between you and Solvega Labs LLC, a Utah limited liability company ("Solvega Labs," "we," "us," or "our"). We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the updated Terms.</P>
            </Clause>

            <Clause id="tos-2" num="2" heading="Description of Service">
              <P>Meridian is an AI-powered intelligence platform that monitors user-defined objectives, gathers and synthesizes signals from publicly available information sources, and generates confidence scores, action recommendations, and analytical reports (collectively, "AI Output"). The Service is intended to help users organize, track, and gain perspective on their personal and professional goals.</P>
              <P>The Service is powered in part by Anthropic's Claude AI models. By using Meridian, you acknowledge that your inputs may be processed by Anthropic's systems in accordance with Anthropic's usage policies.</P>
            </Clause>

            <Clause id="tos-3" num="3" heading="AI Accuracy Disclaimer — Read Carefully">
              <P><strong>Meridian uses artificial intelligence to generate analytical output. AI can make mistakes. The Service may produce output that is inaccurate, incomplete, outdated, or not applicable to your specific situation.</strong></P>
              <P>Confidence scores generated by Meridian are probabilistic estimates based on available signals at the time of the sweep. They are not predictions of future outcomes and should not be relied upon as such. Signals sourced from third-party providers may themselves be inaccurate, incomplete, or delayed, and Solvega Labs does not verify the accuracy of third-party information.</P>
              <P><strong>You are responsible for independently verifying any information provided by the Service before acting on it.</strong> Always apply your own judgment. Solvega Labs is not liable for any action taken or not taken based on AI Output.</P>
              <P>The AI Output generated by Meridian reflects the state of available information at the time of the sweep and may not reflect subsequent developments.</P>
            </Clause>

            <Clause id="tos-4" num="4" heading="Not Professional Advice">
              <P><strong>Meridian is not a professional advisor of any kind.</strong> The Service is designed to supplement your decision-making process, not replace it. Nothing in the Service constitutes:</P>
              <ul style={UL}>
                <li style={LI}>Financial or investment advice — consult a licensed financial advisor</li>
                <li style={LI}>Legal advice — consult a licensed attorney</li>
                <li style={LI}>Medical or health advice — consult a licensed healthcare provider</li>
                <li style={LI}>Career advice — consult a qualified career counselor or recruiter</li>
                <li style={LI}>Tax advice — consult a licensed CPA or tax professional</li>
              </ul>
              <P>The fact that Meridian tracks objectives related to your career, finances, health, or other personal matters does not create a professional relationship between you and Solvega Labs. We are a technology company, not a licensed advisor in any field.</P>
              <P>Meridian is designed to be an outcome-optimized intelligence partner, not a sole decision-maker. Every recommendation the Service generates is one input among many. Your own judgment, and where applicable the judgment of licensed professionals, takes precedence.</P>
            </Clause>

            <Clause id="tos-5" num="5" heading="Subscriptions, Billing, and Refunds">
              <P><strong>Free Trial.</strong> New accounts receive a 7-day free trial with access to trial-tier features. No credit card is required during the trial period. At the end of the trial, continued access requires selecting a paid subscription plan.</P>
              <P><strong>Subscription Plans.</strong> Paid subscriptions are billed monthly or annually depending on the plan selected. Prices are displayed at the time of purchase and are subject to change with 30 days notice to existing subscribers.</P>
              <P><strong>Sweep Credits.</strong> Sweep credits are one-time purchases that allow additional signal sweeps beyond your plan's included cadence. Credits do not expire. Credits are non-refundable once used.</P>
              <P><strong>Cancellation.</strong> You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. No partial refunds are provided for unused time within a billing period.</P>
              <P><strong>Annual Plan Refunds.</strong> Annual subscriptions cancelled within 30 days of purchase are eligible for a pro-rated refund for unused months. After 30 days, no refund is provided.</P>
              <P><strong>Beta User Pricing.</strong> Users designated as beta testers who provide structured feedback as agreed are eligible for grandfathered Explorer-tier pricing at the time of public launch. This commitment is made in good faith and subject to the user maintaining active engagement with the beta program.</P>
              <P>All billing is processed by Stripe, Inc. Solvega Labs does not store payment card information. Stripe's terms and privacy policy apply to payment processing.</P>
            </Clause>

            <Clause id="tos-6" num="6" heading="Acceptable Use">
              <P>You agree not to use the Service to:</P>
              <ul style={UL}>
                <li style={LI}>Violate any applicable law or regulation</li>
                <li style={LI}>Infringe the intellectual property rights of any third party</li>
                <li style={LI}>Upload content that is defamatory, harassing, or abusive</li>
                <li style={LI}>Attempt to access another user's account or data</li>
                <li style={LI}>Use automated means to scrape, extract, or harvest data from the Service</li>
                <li style={LI}>Use the Service to train or fine-tune any AI or machine learning model</li>
                <li style={LI}>Resell, sublicense, or commercially exploit the Service without written authorization from Solvega Labs</li>
                <li style={LI}>Attempt to reverse engineer, decompile, or extract the underlying algorithms or models used by the Service</li>
                <li style={LI}>Introduce malicious code, viruses, or any software that could harm the Service or other users</li>
              </ul>
              <P>Violation of these terms may result in immediate account suspension or termination without refund.</P>
            </Clause>

            <Clause id="tos-7" num="7" heading="Intellectual Property and Data Ownership">
              <P><strong>Your data.</strong> You retain ownership of the objectives, notes, journal entries, and other content you enter into the Service ("User Content"). By using the Service, you grant Solvega Labs a limited license to process your User Content for the purpose of providing the Service to you.</P>
              <P><strong>No training use.</strong> Solvega Labs will not use your User Content to train AI models without your explicit written consent. Your personal objectives, signals, and outcome data are your private information.</P>
              <P><strong>Aggregated, anonymized data.</strong> Solvega Labs may use aggregated, anonymized, non-personally-identifiable data derived from the Service for product improvement, research, and business purposes. This data cannot be used to identify you individually.</P>
              <P><strong>Meridian platform.</strong> The Meridian platform, including its software, algorithms, design, and underlying technology, is the intellectual property of Solvega Labs LLC. You may not copy, reproduce, distribute, or create derivative works from any part of the Service without express written permission.</P>
            </Clause>

            <Clause id="tos-8" num="8" heading="Limitation of Liability">
              <P>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SOLVEGA LABS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST DATA, OR BUSINESS INTERRUPTION, ARISING FROM OR RELATING TO YOUR USE OF THE SERVICE.</P>
              <P>IN NO EVENT SHALL SOLVEGA LABS'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING FROM OR RELATING TO THE SERVICE EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO SOLVEGA LABS IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).</P>
              <P>SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY FOR CONSEQUENTIAL OR INCIDENTAL DAMAGES. IF YOU ARE IN SUCH A JURISDICTION, SOME OF THE ABOVE LIMITATIONS MAY NOT APPLY TO YOU.</P>
              <P>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</P>
            </Clause>

            <Clause id="tos-9" num="9" heading="Termination">
              <P>Solvega Labs reserves the right to suspend or terminate your account at any time for violation of these Terms, for any conduct that Solvega Labs determines in its sole discretion is harmful to the Service or other users, or for any other reason with or without notice.</P>
              <P>You may terminate your account at any time by contacting connect@solvega.ai or using the account deletion feature in your settings. Upon termination, your User Content will be deleted within 30 days, subject to any legal retention obligations.</P>
              <P>Sections 3, 4, 7, 8, and 10 of these Terms survive termination.</P>
            </Clause>

            <Clause id="tos-10" num="10" heading="Governing Law">
              <P>These Terms are governed by the laws of the State of Utah, without regard to conflict of law principles. Any dispute arising from these Terms or the Service shall be resolved in the state or federal courts located in Salt Lake County, Utah, and you consent to the personal jurisdiction of those courts.</P>
              <P>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</P>
              <P>These Terms, together with the Privacy Policy and Acceptable Use Policy, constitute the entire agreement between you and Solvega Labs regarding the Service and supersede all prior agreements.</P>
            </Clause>
          </DocSection>

          {/* ── PRIVACY POLICY ────────────────────────────────────────── */}
          <DocSection id="privacy" title="Meridian Privacy Policy">

            <Clause id="pp-1" num="1" heading="What We Collect">
              <P><strong>Account information.</strong> When you create an account, we collect your name, email address, and authentication credentials. We do not collect payment card information directly — all payment processing is handled by Stripe, Inc.</P>
              <P><strong>Objective and goal data.</strong> We collect the objectives, notes, target dates, and related context you enter into the Service. This is the core data that powers the Service.</P>
              <P><strong>Signal and sweep data.</strong> When you run a sweep, Meridian collects publicly available information from third-party sources relevant to your objectives. This data is processed and stored to generate your intelligence reports.</P>
              <P><strong>Usage data.</strong> We collect information about how you use the Service, including pages visited, features used, sweep frequency, and interaction patterns. This data is used to improve the Service and is not sold to third parties.</P>
              <P><strong>Device and technical data.</strong> We automatically collect IP address, browser type, operating system, and device identifiers for security, fraud prevention, and service delivery purposes.</P>
              <P><strong>Calendar data (if connected).</strong> If you connect a calendar integration, we access calendar event metadata (titles, dates, times) to provide calendar-aware intelligence. We do not access email content. You can revoke calendar access at any time in your account settings.</P>
            </Clause>

            <Clause id="pp-2" num="2" heading="How We Use Your Information">
              <P>We use the information we collect to:</P>
              <ul style={UL}>
                <li style={LI}>Provide, operate, and improve the Meridian Service</li>
                <li style={LI}>Generate AI-powered intelligence reports, confidence scores, and recommendations</li>
                <li style={LI}>Send sweep reports, product updates, and service notifications</li>
                <li style={LI}>Detect and prevent fraud, abuse, and security incidents</li>
                <li style={LI}>Comply with legal obligations</li>
                <li style={LI}>Conduct internal research and product development using aggregated, anonymized data</li>
              </ul>
              <P><strong>We do not sell your personal information to third parties. We do not use your personal objectives or goal data for advertising purposes.</strong></P>
            </Clause>

            <Clause id="pp-3" num="3" heading="Third-Party Services">
              <P><strong>Anthropic.</strong> The Service is powered in part by Anthropic's Claude AI models. When you run a sweep or use Ask Meridian, your objective context and query are sent to Anthropic's API for processing. Anthropic's privacy policy governs their handling of this data. Anthropic does not retain API inputs to train models by default, subject to their current API terms.</P>
              <P><strong>Brave Search / NewsAPI.</strong> Meridian uses third-party search and news APIs to gather signals relevant to your objectives. Query terms derived from your objective keywords are sent to these services. No personally identifiable information is included in these queries.</P>
              <P><strong>Stripe.</strong> Payment processing is handled by Stripe, Inc. We do not store payment card numbers. Stripe's privacy policy governs payment data handling.</P>
              <P><strong>Supabase.</strong> Our database and authentication infrastructure is hosted on Supabase. User data is stored in Supabase's managed PostgreSQL environment with row-level security enforced.</P>
              <P><strong>Resend.</strong> Transactional emails (sweep reports, account notifications) are sent via Resend. Your email address is shared with Resend for this purpose.</P>
              <P><strong>Vercel.</strong> The Service is hosted on Vercel's infrastructure. Vercel may collect standard web server logs including IP addresses.</P>
            </Clause>

            <Clause id="pp-4" num="4" heading="Data Retention">
              <P>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where retention is required by law or for legitimate business purposes (such as fraud prevention records).</P>
              <P>Sweep data and signal history are retained for the duration of your account to power the confidence trajectory and prediction log features. This historical data is what makes Meridian's intelligence compounding over time — it is core to the product value.</P>
              <P>Aggregated, anonymized data derived from your usage may be retained indefinitely for product research purposes, as this data cannot identify you individually.</P>
            </Clause>

            <Clause id="pp-5" num="5" heading="Your Rights">
              <P>Depending on your location, you may have rights regarding your personal data, including:</P>
              <ul style={UL}>
                <li style={LI}><strong>Access</strong> — request a copy of the personal data we hold about you</li>
                <li style={LI}><strong>Correction</strong> — request correction of inaccurate data</li>
                <li style={LI}><strong>Deletion</strong> — request deletion of your account and associated personal data</li>
                <li style={LI}><strong>Portability</strong> — request export of your objective and goal data in a structured format</li>
                <li style={LI}><strong>Objection</strong> — object to certain processing activities</li>
              </ul>
              <P>To exercise any of these rights, contact us at connect@solvega.ai. We will respond within 30 days.</P>
              <P>If you are located in the European Economic Area, you have additional rights under the GDPR. If you are a California resident, you have additional rights under the CCPA.</P>
              <P>Meridian is not directed at children under 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, contact us at connect@solvega.ai and we will delete it promptly.</P>
            </Clause>
          </DocSection>

          {/* ── ACCEPTABLE USE POLICY ─────────────────────────────────── */}
          <DocSection id="aup" title="Meridian Acceptable Use Policy">
            <P>This Acceptable Use Policy ("AUP") governs your use of the Meridian platform operated by Solvega Labs LLC. By using the Service, you agree to this AUP. Violations may result in account suspension or termination.</P>

            <H2>Prohibited Uses</H2>
            <P>You may not use Meridian to:</P>
            <ul style={UL}>
              <li style={LI}>Violate any applicable local, state, national, or international law or regulation</li>
              <li style={LI}>Infringe, misappropriate, or violate any intellectual property, privacy, or other rights of any party</li>
              <li style={LI}>Harass, abuse, threaten, or harm any person</li>
              <li style={LI}>Upload, transmit, or store content that is defamatory, obscene, or unlawful</li>
              <li style={LI}>Attempt to gain unauthorized access to any part of the Service, another user's account, or any connected systems</li>
              <li style={LI}>Use automated scripts, bots, or tools to access, scrape, or extract data from the Service</li>
              <li style={LI}>Use the Service or its AI Output to train, fine-tune, or improve any artificial intelligence or machine learning model</li>
              <li style={LI}>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code or underlying algorithms of the Service</li>
              <li style={LI}>Resell, sublicense, white-label, or otherwise commercially exploit the Service or its outputs without express written authorization from Solvega Labs</li>
              <li style={LI}>Introduce malware, viruses, or any other harmful code into the Service</li>
              <li style={LI}>Use the Service in any way that could damage, disable, overburden, or impair the Service or interfere with any other party's use</li>
              <li style={LI}>Use the Service to generate, distribute, or promote misinformation, disinformation, or coordinated inauthentic behavior</li>
              <li style={LI}>Circumvent or attempt to circumvent any access controls, rate limits, or usage restrictions</li>
            </ul>

            <H2>AI Output — Responsible Use</H2>
            <P>The AI Output generated by Meridian is provided for informational and planning purposes only. You agree to:</P>
            <ul style={UL}>
              <li style={LI}>Apply your own judgment before acting on any AI Output</li>
              <li style={LI}>Not represent AI Output as professional advice (legal, financial, medical, career, or other)</li>
              <li style={LI}>Not share AI Output in ways that could mislead third parties about its nature or reliability</li>
              <li style={LI}>Consult appropriate licensed professionals for decisions with significant financial, legal, health, or other consequences</li>
            </ul>

            <H2>Content Standards</H2>
            <P>Any content you enter into the Service must not:</P>
            <ul style={UL}>
              <li style={LI}>Contain personal information about third parties without their consent</li>
              <li style={LI}>Contain confidential information belonging to another party that you are not authorized to share</li>
              <li style={LI}>Violate any non-disclosure, confidentiality, or non-compete agreement you are bound by</li>
            </ul>

            <H2>Enforcement</H2>
            <P>Solvega Labs reserves the right to investigate any suspected violation of this AUP. We may, without notice or liability, remove content, suspend access, or terminate accounts that we determine in our sole discretion to be in violation of this AUP or otherwise harmful to the Service, our users, or third parties.</P>
            <P>Suspected violations may be reported to connect@solvega.ai.</P>
          </DocSection>

          {/* Page footer */}
          <div style={{ marginTop: '4rem', paddingTop: '1.5rem', borderTop: '.5px solid #DDDDD8', fontSize: 11, color: '#888780', textAlign: 'center' }}>
            Solvega Labs LLC · Meridian Arc Legal Documents · connect@solvega.ai
          </div>

        </div>
      </main>
    </div>
  )
}

/* ── Shared style constants ───────────────────────────────────────────────── */
const UL: React.CSSProperties = { paddingLeft: '1.4rem', margin: '.5rem 0 .85rem' }
const LI: React.CSSProperties = { fontSize: 13, color: '#33405F', lineHeight: 1.8, marginBottom: '.35rem' }

/* ── Sub-components ───────────────────────────────────────────────────────── */
function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div
      id={id}
      style={{ border: '.5px solid #DDDDD8', borderRadius: 10, padding: '2rem 2.25rem', margin: '2rem 0', background: '#fff', scrollMarginTop: '2rem' }}
    >
      <h1 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 24, fontWeight: 400, color: '#0D1B3E', marginBottom: '.25rem', marginTop: 0 }}>
        {title}
      </h1>
      <div style={{ height: '.5px', background: '#DDDDD8', margin: '1rem 0 1.5rem' }} />
      {children}
    </div>
  )
}

function Clause({ id, num, heading, children }: { id: string; num: string; heading: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: '1.5rem 0 .5rem' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E', marginRight: '.4rem' }}>{num}.</span>
        {heading}
      </h2>
      {children}
    </div>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: '1.5rem 0 .5rem' }}>
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: '#33405F', lineHeight: 1.85, marginBottom: '.85rem' }}>
      {children}
    </p>
  )
}
