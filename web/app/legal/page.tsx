import type { Metadata, CSSProperties } from 'next'
import type { Block, LegalClause, LegalSection, Segment } from './legal-content'
import { SECTIONS } from './legal-content'

export const metadata: Metadata = {
  title: 'Legal — Meridian Arc',
  description: 'Terms of Service, Privacy Policy, and Acceptable Use Policy for Meridian Arc by Solvega Labs LLC.',
}

const NAV = [
  { href: '#tos',     label: 'Terms of Service' },
  { href: '#tos-1',   label: '1. Acceptance',              sub: true },
  { href: '#tos-2',   label: '2. Service description',     sub: true },
  { href: '#tos-3',   label: '3. AI disclaimer',           sub: true },
  { href: '#tos-4',   label: '4. Not professional advice', sub: true },
  { href: '#tos-5',   label: '5. Subscriptions',           sub: true },
  { href: '#tos-6',   label: '6. Acceptable use',          sub: true },
  { href: '#tos-7',   label: '7. IP & data ownership',     sub: true },
  { href: '#tos-8',   label: '8. Limitation of liability', sub: true },
  { href: '#tos-9',   label: '9. Termination',             sub: true },
  { href: '#tos-10',  label: '10. Governing law',          sub: true },
  { href: '#privacy', label: 'Privacy Policy' },
  { href: '#pp-1',    label: '1. What we collect',         sub: true },
  { href: '#pp-2',    label: '2. How we use it',           sub: true },
  { href: '#pp-3',    label: '3. Third parties',           sub: true },
  { href: '#pp-4',    label: '4. Retention',               sub: true },
  { href: '#pp-5',    label: '5. Your rights',             sub: true },
  { href: '#aup',     label: 'Acceptable Use Policy' },
]

// ── Style constants ─────────────────────────────────────────────────────────
const UL: CSSProperties = { paddingLeft: '1.4rem', margin: '.5rem 0 .85rem' }
const LI: CSSProperties = { fontSize: 13, color: '#33405F', lineHeight: 1.8, marginBottom: '.35rem' }
const P_STYLE: CSSProperties = { fontSize: 13, color: '#33405F', lineHeight: 1.85, marginBottom: '.85rem' }

// ── Segment renderer ────────────────────────────────────────────────────────
function Segs({ text }: { text: Segment[] }) {
  return (
    <>
      {text.map((seg, i) =>
        typeof seg === 'string'
          ? seg
          : <strong key={i}>{seg.strong}</strong>
      )}
    </>
  )
}

// ── Block renderer ──────────────────────────────────────────────────────────
function RenderBlock({ block, idx }: { block: Block; idx: number }) {
  if (block.type === 'h2') {
    return (
      <h2 key={idx} style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: '1.5rem 0 .5rem' }}>
        {block.text}
      </h2>
    )
  }
  if (block.type === 'p') {
    return (
      <p key={idx} style={P_STYLE}>
        <Segs text={block.text} />
      </p>
    )
  }
  // ul
  return (
    <ul key={idx} style={UL}>
      {block.items.map((item, i) => (
        <li key={i} style={LI}><Segs text={item} /></li>
      ))}
    </ul>
  )
}

// ── Clause renderer ─────────────────────────────────────────────────────────
function RenderClause({ clause }: { clause: LegalClause }) {
  return (
    <div id={clause.id} style={{ marginBottom: '1.5rem', scrollMarginTop: '2rem' }}>
      {clause.heading && (
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18', margin: '1.5rem 0 .5rem' }}>
          {clause.num && (
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E', marginRight: '.4rem' }}>
              {clause.num}.
            </span>
          )}
          {clause.heading}
        </h2>
      )}
      {clause.blocks.map((block, i) => (
        <RenderBlock key={i} block={block} idx={i} />
      ))}
    </div>
  )
}

// ── Section renderer ────────────────────────────────────────────────────────
function RenderSection({ section }: { section: LegalSection }) {
  return (
    <div
      id={section.id}
      style={{
        border: '.5px solid #DDDDD8',
        borderRadius: 10,
        padding: '2rem 2.25rem',
        margin: '2rem 0',
        background: '#fff',
        scrollMarginTop: '2rem',
      }}
    >
      <h1 style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: 24, fontWeight: 400, color: '#0D1B3E', marginBottom: '.25rem', marginTop: 0 }}>
        {section.title}
      </h1>
      <div style={{ height: '.5px', background: '#DDDDD8', margin: '1rem 0 1.5rem' }} />
      {section.clauses.map((clause, i) => (
        <RenderClause key={i} clause={clause} />
      ))}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function LegalPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F7F8FA', fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, lineHeight: 1.65, color: '#1A1A18' }}>

      {/* Sidenav */}
      <style>{`
        .legal-nav-a { display:block; color:rgba(255,255,255,.52); text-decoration:none; border-left:2px solid transparent; transition:color .12s,border-color .12s; }
        .legal-nav-a:hover { color:#fff; border-left-color:#2E7CB8; }
      `}</style>
      <nav style={{ position: 'fixed', top: 0, left: 0, width: 220, height: '100vh', background: '#0D1B3E', overflowY: 'auto', padding: '1.5rem 0', zIndex: 100 }}>
        <div style={{ padding: '.75rem 1.25rem 1rem', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: '.75rem' }}>
          <a href="/dashboard" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Meridian Arc</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,.35)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>Legal Documents</div>
          </a>
        </div>
        <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.28)', padding: '.6rem 1.25rem .3rem' }}>
          Documents
        </div>
        {NAV.map(({ href, label, sub }) => (
          <a
            key={href}
            href={href}
            className="legal-nav-a"
            style={{ fontSize: sub ? 11 : 12, padding: sub ? '.32rem 1.75rem' : '.38rem 1.25rem' }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* Main content */}
      <main style={{ marginLeft: 220, padding: '3rem 3.5rem 6rem', maxWidth: 1060, width: '100%' }}>
        <div style={{ maxWidth: 780 }}>

          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-.02em', marginBottom: '.3rem', color: '#0D1B3E' }}>
              Solvega Labs · Meridian Arc
            </h1>
            <p style={{ fontSize: 15, color: '#888780', fontWeight: 400, marginBottom: '.5rem' }}>Legal Documents</p>
            <p style={{ fontSize: 12, color: '#888780' }}>Solvega Labs LLC · Salt Lake City, Utah · connect@solvega.ai</p>
          </div>

          {SECTIONS.map(section => (
            <RenderSection key={section.id} section={section} />
          ))}

          <div style={{ marginTop: '4rem', paddingTop: '1.5rem', borderTop: '.5px solid #DDDDD8', fontSize: 11, color: '#888780', textAlign: 'center' }}>
            Solvega Labs LLC · Meridian Arc Legal Documents · connect@solvega.ai
          </div>

        </div>
      </main>
    </div>
  )
}
