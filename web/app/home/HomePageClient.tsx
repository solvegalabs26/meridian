'use client'

import { useState } from 'react'
import PrelaunchModal from '@/components/marketing/PrelaunchModal'

const SIGNUP_ENABLED = process.env.NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED === 'true'

export default function HomePageClient() {
  const [modalOpen, setModalOpen] = useState(false)

  function openModal() { setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

  return (
    <>
      <style>{`
html{scroll-behavior:smooth}
.home-page{
  --navy:#0D1B3E;
  --navy-deep:#060F1A;
  --navy-panel:#0F1E42;
  --gold:#C9A227;
  --gold-soft:#E8C85A;
  --blue:#2E7CB8;
  --blue-soft:#5090C0;
  --text:#F2F1EC;
  --text-dim:#8098B4;
  --line:rgba(128,152,180,.16);
  --card:#0E1A38;
  background:var(--navy-deep);
  color:var(--text);
  font-family:'Inter',system-ui,sans-serif;
  font-size:15px;
  line-height:1.65;
  -webkit-font-smoothing:antialiased;
  overflow-x:hidden;
  min-height:100vh;
}
.home-page *{box-sizing:border-box;margin:0;padding:0}
.home-page a{color:inherit;text-decoration:none}
.home-page button{background:none;border:none;color:inherit;padding:0;font-size:inherit;line-height:inherit}

.meridian-line{
  position:fixed;top:0;left:50%;transform:translateX(-50%);
  width:1px;height:100%;pointer-events:none;z-index:0;
  background:linear-gradient(to bottom,
    transparent 0%,
    rgba(46,124,184,.10) 12%,
    rgba(46,124,184,.14) 50%,
    rgba(46,124,184,.10) 88%,
    transparent 100%);
}
.meridian-line::after{
  content:"";position:absolute;top:0;left:-1px;width:3px;height:24%;
  background:linear-gradient(to bottom,transparent,var(--gold),transparent);
  opacity:.5;filter:blur(1px);
  animation:travel 11s cubic-bezier(.4,0,.4,1) infinite;
}
@keyframes travel{
  0%{top:-24%;opacity:0}
  12%{opacity:.55}
  88%{opacity:.55}
  100%{top:100%;opacity:0}
}

.wrap{position:relative;z-index:1;max-width:1080px;margin:0 auto;padding:0 28px}

nav{
  position:sticky;top:0;z-index:20;
  backdrop-filter:blur(14px);
  background:rgba(6,15,26,.72);
  border-bottom:1px solid var(--line);
}
.nav-in{max-width:1080px;margin:0 auto;padding:15px 28px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:11px}
.brand-name{font-family:'EB Garamond',serif;font-size:21px;letter-spacing:.01em}
.brand-name b{font-weight:500}
.nav-links{display:flex;align-items:center;gap:30px;font-size:13.5px;color:var(--text-dim)}
.nav-links a,.nav-links button{transition:color .2s}
.nav-links a:hover,.nav-links button:hover{color:var(--text)}
.nav-cta{
  padding:9px 20px;border:1px solid var(--gold);border-radius:6px;
  color:var(--gold);font-size:13.5px;font-weight:500;transition:all .2s;cursor:pointer;
}
.nav-cta:hover{background:var(--gold);color:var(--navy-deep)}
.nav-signin{font-size:13.5px;color:var(--text-dim);transition:color .2s}
.nav-signin:hover{color:var(--text)}
@media(max-width:720px){.nav-links a:not(.nav-cta):not(.nav-signin),.nav-links button:not(.nav-cta){display:none}}

.hero{position:relative;text-align:center;padding:96px 0 78px}
.eyebrow{
  display:inline-block;font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;
  color:var(--gold);margin-bottom:26px;font-weight:500;
  opacity:0;animation:fadeUp .7s ease .1s both;
}
.hero h1{
  font-family:'EB Garamond',serif;font-weight:400;
  font-size:clamp(40px,6.4vw,74px);line-height:1.06;letter-spacing:-.02em;
  margin-bottom:22px;opacity:0;animation:fadeUp .7s ease .24s both;
}
.hero h1 em{font-style:italic;color:var(--gold-soft)}
.hero .sub{
  max-width:600px;margin:0 auto 40px;font-size:18px;line-height:1.6;
  color:var(--text-dim);font-weight:300;
  opacity:0;animation:fadeUp .7s ease .4s both;
}
.hero .sub strong{color:var(--text);font-weight:400}
.hero-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;opacity:0;animation:fadeUp .7s ease .56s both}
.btn-primary{
  display:inline-flex;align-items:center;gap:9px;
  padding:15px 30px;border-radius:8px;font-size:15px;font-weight:500;
  background:linear-gradient(180deg,var(--gold-soft),var(--gold));
  color:var(--navy-deep);border:1px solid var(--gold);
  transition:transform .18s ease,box-shadow .18s ease;
  box-shadow:0 6px 24px -8px rgba(201,162,39,.5);cursor:pointer;
}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px -8px rgba(201,162,39,.6)}
.btn-primary svg{transition:transform .18s ease}
.btn-primary:hover svg{transform:translateX(3px)}
.btn-ghost{
  display:inline-flex;align-items:center;
  padding:15px 26px;border-radius:8px;font-size:15px;font-weight:400;
  color:var(--text-dim);border:1px solid var(--line);transition:all .2s;cursor:pointer;
}
.btn-ghost:hover{color:var(--text);border-color:var(--text-dim)}
.hero-note{margin-top:20px;font-size:12.5px;color:var(--text-dim);opacity:0;animation:fadeUp .7s ease .68s both}

@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

.section{padding:74px 0}
.sec-head{text-align:center;max-width:640px;margin:0 auto 52px}
.sec-tag{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--blue-soft);margin-bottom:16px;font-weight:500}
.sec-head h2{font-family:'EB Garamond',serif;font-weight:400;font-size:clamp(29px,4vw,42px);line-height:1.14;letter-spacing:-.015em;margin-bottom:16px}
.sec-head p{color:var(--text-dim);font-size:16.5px;font-weight:300}

.compare{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px;margin:0 auto}
@media(max-width:680px){.compare{grid-template-columns:1fr}}
.cmp{border:1px solid var(--line);border-radius:14px;padding:30px 28px;background:var(--card)}
.cmp.them{opacity:.82}
.cmp.us{border-color:rgba(201,162,39,.4);background:linear-gradient(180deg,rgba(201,162,39,.05),var(--card))}
.cmp-label{font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;margin-bottom:20px}
.cmp.them .cmp-label{color:var(--text-dim)}
.cmp.us .cmp-label{color:var(--gold)}
.cmp ul{list-style:none;display:flex;flex-direction:column;gap:14px}
.cmp li{display:flex;gap:12px;font-size:15px;line-height:1.5;align-items:flex-start}
.cmp li .ic{flex-shrink:0;margin-top:3px}
.cmp.them li{color:var(--text-dim)}
.cmp.us li{color:var(--text)}

.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;max-width:960px;margin:0 auto}
@media(max-width:820px){.steps{grid-template-columns:1fr 1fr}}
@media(max-width:460px){.steps{grid-template-columns:1fr}}
.step{position:relative;padding:28px 22px;border:1px solid var(--line);border-radius:14px;background:var(--card);transition:border-color .25s,transform .25s}
.step:hover{border-color:rgba(46,124,184,.42);transform:translateY(-3px)}
.step-n{font-family:'EB Garamond',serif;font-size:15px;color:var(--gold);border:1px solid rgba(201,162,39,.35);width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.step h3{font-size:16px;font-weight:500;margin-bottom:9px}
.step p{font-size:14px;color:var(--text-dim);line-height:1.55;font-weight:300}

.brief{max-width:760px;margin:0 auto;text-align:center;padding:20px 0}
.brief .q{font-family:'EB Garamond',serif;font-style:italic;font-size:clamp(22px,3.2vw,30px);line-height:1.4;color:var(--text)}
.brief .q span{color:var(--gold-soft)}

.tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:920px;margin:0 auto}
@media(max-width:800px){.tiers{grid-template-columns:1fr;max-width:420px}}
.tier{position:relative;border:1px solid var(--line);border-radius:16px;padding:30px 26px 28px;background:var(--card);display:flex;flex-direction:column}
.tier.pop{border-color:var(--gold);background:linear-gradient(180deg,rgba(201,162,39,.06),var(--card));box-shadow:0 14px 44px -22px rgba(201,162,39,.55)}
.pop-badge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--gold);color:var(--navy-deep);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;padding:5px 13px;border-radius:20px}
.tier-name{font-family:'EB Garamond',serif;font-size:22px;margin-bottom:4px}
.tier-price{font-size:34px;font-weight:500;letter-spacing:-.02em;margin:8px 0 2px}
.tier-price span{font-size:15px;color:var(--text-dim);font-weight:300}
.tier-cadence{font-size:13px;color:var(--gold);margin-bottom:20px;font-weight:400}
.tier-feats{list-style:none;display:flex;flex-direction:column;gap:11px;margin-bottom:26px;flex:1}
.tier-feats li{display:flex;gap:10px;font-size:14px;color:var(--text-dim);align-items:flex-start;line-height:1.45}
.tier-feats li b{color:var(--text);font-weight:500}
.tier-feats .ck{color:var(--blue-soft);flex-shrink:0;margin-top:2px}
.tier-btn{display:block;text-align:center;padding:12px;border-radius:8px;font-size:14px;font-weight:500;transition:all .2s;border:1px solid var(--line);color:var(--text);width:100%;cursor:pointer;font-family:inherit}
.tier-btn:hover{border-color:var(--text-dim)}
.tier.pop .tier-btn{background:linear-gradient(180deg,var(--gold-soft),var(--gold));color:var(--navy-deep);border-color:var(--gold)}
.tier.pop .tier-btn:hover{transform:translateY(-2px)}
.tiers-foot{text-align:center;margin-top:32px;font-size:14px;color:var(--text-dim)}
.tiers-foot a,.tiers-foot button{color:var(--gold);border-bottom:1px solid rgba(201,162,39,.4);cursor:pointer}

.teams-band{max-width:900px;margin:0 auto;border:1px solid rgba(46,124,184,.34);border-radius:18px;
  background:linear-gradient(120deg,rgba(46,124,184,.08),var(--card));padding:40px 40px;
  display:flex;align-items:center;justify-content:space-between;gap:32px;flex-wrap:wrap}
.teams-band .tb-copy{flex:1;min-width:260px}
.teams-band .tb-tag{font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--blue-soft);font-weight:500;margin-bottom:12px}
.teams-band h2{font-family:'EB Garamond',serif;font-weight:400;font-size:clamp(24px,3.2vw,32px);line-height:1.15;letter-spacing:-.015em;margin-bottom:10px}
.teams-band p{color:var(--text-dim);font-size:15.5px;font-weight:300;max-width:440px}
.teams-band .btn-ghost{border-color:var(--blue-soft);color:var(--text)}
.teams-band .btn-ghost:hover{background:rgba(46,124,184,.12)}
[hidden]{display:none!important}

.final{text-align:center;padding:88px 0 78px}
.final h2{font-family:'EB Garamond',serif;font-weight:400;font-size:clamp(30px,4.5vw,48px);line-height:1.1;letter-spacing:-.02em;margin-bottom:18px}
.final p{color:var(--text-dim);font-size:17px;max-width:520px;margin:0 auto 34px;font-weight:300}

footer{border-top:1px solid var(--line);padding:34px 0;text-align:center;color:var(--text-dim);font-size:13px}
footer .brand{justify-content:center;margin-bottom:12px}
footer a{color:var(--text-dim);transition:color .2s}
footer a:hover{color:var(--text)}
.foot-links{display:flex;gap:22px;justify-content:center;margin-bottom:16px;flex-wrap:wrap}

@keyframes ringOut1{0%{r:5.3;opacity:.5}70%{r:22;opacity:0}100%{r:22;opacity:0}}
@keyframes ringOut2{0%{r:5.3;opacity:.4}70%{r:26;opacity:0}100%{r:26;opacity:0}}

@media(prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important}
  .meridian-line::after{display:none}
}
      `}</style>

      <PrelaunchModal open={modalOpen} onClose={closeModal} />

      <div className="home-page">
        <div className="meridian-line" aria-hidden="true" />

        <nav>
          <div className="nav-in">
            <a href="/home" className="brand">
              <svg width="34" height="34" viewBox="0 0 60 60" role="img" aria-label="Meridian Arc beacon">
                <circle cx="30" cy="35" r="0" fill="#C9A227" style={{animation:'ringOut1 2.6s ease-out 1.2s infinite'}} />
                <circle cx="30" cy="35" r="13" fill="#C9A227" opacity=".07" />
                <circle cx="30" cy="35" r="8.5" fill="#C9A227" opacity=".13" />
                <circle cx="30" cy="35" r="5.3" fill="#C9A227" />
                <line x1="30" y1="35" x2="30" y2="11" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" />
                <polyline points="26.5,15 30,11 33.5,15" stroke="#C9A227" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="brand-name">Meridian <b>Arc</b></span>
            </a>
            <div className="nav-links">
              <a href="#difference">The difference</a>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="/business" hidden>For teams</a>
              {SIGNUP_ENABLED
                ? <a href="/onboarding/plan" className="nav-cta">Get started</a>
                : <button type="button" onClick={openModal} className="nav-cta">Get started</button>
              }
              <a href="/login" className="nav-signin">Sign in</a>
            </div>
          </div>
        </nav>

        <main id="top">

          {/* HERO */}
          <header className="hero">
            <div className="wrap">
              <span className="eyebrow">Persistent Memory with Accumulated Intelligence</span>
              <h1>Your goals don&apos;t reset<br />every time you <em>look away.</em></h1>
              <p className="sub">Most tools start from zero every session. Meridian Arc <strong>remembers what you&apos;re working toward</strong>, monitors the world for signals that matter, tells you what changed, generates <strong>your personal intelligence</strong> and what to do next.</p>
              <div className="hero-cta">
                {SIGNUP_ENABLED
                  ? <a href="/onboarding/plan" className="btn-primary">
                      Choose your plan
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </a>
                  : <button type="button" onClick={openModal} className="btn-primary" style={{ cursor: 'pointer', fontFamily: 'inherit' }}>
                      Choose your plan
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                }
                <a href="#difference" className="btn-ghost">See how it&apos;s different</a>
              </div>
              <p className="hero-note">7-day trial · no card required to start</p>
            </div>
          </header>

          {/* THE DIFFERENCE */}
          <section className="section" id="difference">
            <div className="wrap">
              <div className="sec-head">
                <div className="sec-tag">The difference</div>
                <h2>A memory tool tells you what happened.<br />Meridian tells you what to do.</h2>
                <p>Search engines and chat assistants answer one question and forget it. Meridian keeps your objectives alive between sessions and builds intelligence on top of them.</p>
              </div>
              <div className="compare">
                <div className="cmp them">
                  <div className="cmp-label">Chat &amp; memory tools</div>
                  <ul>
                    <li><span className="ic">✕</span> Every conversation starts from scratch</li>
                    <li><span className="ic">✕</span> You have to remember to ask</li>
                    <li><span className="ic">✕</span> Answers a question, then forgets it</li>
                    <li><span className="ic">✕</span> No sense of whether you&apos;re on track</li>
                  </ul>
                </div>
                <div className="cmp us">
                  <div className="cmp-label">Meridian Arc</div>
                  <ul>
                    <li><span className="ic" style={{color:'var(--gold)'}}>✓</span> Holds every objective in a living state</li>
                    <li><span className="ic" style={{color:'var(--gold)'}}>✓</span> Watches for signals and reaches out to you</li>
                    <li><span className="ic" style={{color:'var(--gold)'}}>✓</span> Scores confidence and generates intelligence</li>
                    <li><span className="ic" style={{color:'var(--gold)'}}>✓</span> Delivers a weekly briefing: what changed, what&apos;s next</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="section" id="how">
            <div className="wrap">
              <div className="sec-head">
                <div className="sec-tag">How it works</div>
                <h2>Set it once. It works while you don&apos;t.</h2>
                <p>Four steps turn a goal you&apos;d otherwise forget into an outcome the system actively drives.</p>
              </div>
              <div className="steps">
                <div className="step">
                  <div className="step-n">1</div>
                  <h3>Name an objective</h3>
                  <p>A job you want, a deal you&apos;re closing, a health goal, a move. Define what success looks like.</p>
                </div>
                <div className="step">
                  <div className="step-n">2</div>
                  <h3>Meridian sweeps</h3>
                  <p>On a schedule you set, it scans the outside world for anything that shifts your odds.</p>
                </div>
                <div className="step">
                  <div className="step-n">3</div>
                  <h3>Confidence updates</h3>
                  <p>It scores how likely you are to hit the outcome, and logs a prediction it can be held to.</p>
                </div>
                <div className="step">
                  <div className="step-n">4</div>
                  <h3>You get the brief</h3>
                  <p>A short intelligence briefing: what moved, what it means, and the next action to take.</p>
                </div>
              </div>
            </div>
          </section>

          {/* BRIEF LINE */}
          <section className="section">
            <div className="wrap brief">
              <p className="q">The question isn&apos;t <span>&ldquo;what did I ask last week?&rdquo;</span><br />It&apos;s <span>&ldquo;am I still on track — and what should I do today?&rdquo;</span></p>
            </div>
          </section>

          {/* PRICING */}
          <section className="section" id="pricing">
            <div className="wrap">
              <div className="sec-head">
                <div className="sec-tag">Pricing</div>
                <h2>Start free. Scale the cadence as it matters.</h2>
                <p>Every plan tracks real objectives and delivers briefings. Higher tiers sweep more often, have more features, and help manage more of your life at once.</p>
              </div>
              <div className="tiers">
                <div className="tier">
                  <div className="tier-name">Explorer</div>
                  <div className="tier-price">$19<span>/mo</span></div>
                  <div className="tier-cadence">1 weekly sweep</div>
                  <ul className="tier-feats">
                    <li><span className="ck">✓</span> <span><b>5 active objectives</b> — career, finance, health &amp; more</span></li>
                    <li><span className="ck">✓</span> Weekly intelligence briefing</li>
                    <li><span className="ck">✓</span> Confidence scoring &amp; prediction log</li>
                    <li><span className="ck">✓</span> 90-day signal history</li>
                  </ul>
                  {SIGNUP_ENABLED
                    ? <a href="/onboarding/plan?tier=explorer" className="tier-btn">Start Explorer</a>
                    : <button type="button" onClick={openModal} className="tier-btn">Start Explorer</button>
                  }
                </div>
                <div className="tier pop">
                  <div className="pop-badge">Most popular</div>
                  <div className="tier-name">Accelerator</div>
                  <div className="tier-price">$49<span>/mo</span></div>
                  <div className="tier-cadence">4 weekly sweeps</div>
                  <ul className="tier-feats">
                    <li><span className="ck">✓</span> <span><b>15 active objectives</b> — full life-management capacity</span></li>
                    <li><span className="ck">✓</span> Everything in Explorer</li>
                    <li><span className="ck">✓</span> Cross-dependency detection</li>
                    <li><span className="ck">✓</span> Unlimited predictions · 365-day history</li>
                  </ul>
                  {SIGNUP_ENABLED
                    ? <a href="/onboarding/plan?tier=accelerator" className="tier-btn">Start Accelerator</a>
                    : <button type="button" onClick={openModal} className="tier-btn">Start Accelerator</button>
                  }
                </div>
                <div className="tier">
                  <div className="tier-name">Command</div>
                  <div className="tier-price">$99<span>/mo</span></div>
                  <div className="tier-cadence">Daily sweeps</div>
                  <ul className="tier-feats">
                    <li><span className="ck">✓</span> <span><b>Unlimited objectives</b></span></li>
                    <li><span className="ck">✓</span> Everything in Accelerator</li>
                    <li><span className="ck">✓</span> Real-time monitoring &amp; alerts</li>
                    <li><span className="ck">✓</span> Calendar integrations</li>
                  </ul>
                  {SIGNUP_ENABLED
                    ? <a href="/onboarding/plan?tier=command" className="tier-btn">Start Command</a>
                    : <button type="button" onClick={openModal} className="tier-btn">Start Command</button>
                  }
                </div>
              </div>
              <p className="tiers-foot">
                Not ready to commit?{' '}
                {SIGNUP_ENABLED
                  ? <a href="/onboarding/plan">Start a free 7-day trial</a>
                  : <button type="button" onClick={openModal}>Join the pre-launch list</button>
                }
                {' '}— no card required.
              </p>
            </div>
          </section>

          {/* TEAMS BAND — hidden. Remove the `hidden` prop to publish. */}
          <section className="section" id="teams" hidden>
            <div className="wrap">
              <div className="teams-band">
                <div className="tb-copy">
                  <div className="tb-tag">For teams</div>
                  <h2>Tracking objectives across a team?</h2>
                  <p>Shared objectives, one confidence view, and a single weekly briefing for the whole team. Set up hands-on with us.</p>
                </div>
                <a href="/business" className="btn-ghost">Meridian for Teams →</a>
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="final">
            <div className="wrap">
              <svg width="52" height="52" viewBox="0 0 60 60" role="img" aria-label="Meridian beacon" style={{marginBottom:'8px'}}>
                <circle cx="30" cy="35" r="0" fill="#C9A227" style={{animation:'ringOut1 2.6s ease-out 1.2s infinite'}} />
                <circle cx="30" cy="35" r="0" fill="#C9A227" style={{animation:'ringOut2 2.6s ease-out 1.8s infinite'}} />
                <circle cx="30" cy="35" r="13" fill="#C9A227" opacity=".07" />
                <circle cx="30" cy="35" r="8.5" fill="#C9A227" opacity=".13" />
                <circle cx="30" cy="35" r="5.3" fill="#C9A227" />
                <line x1="30" y1="35" x2="30" y2="11" stroke="rgba(255,255,255,.5)" strokeWidth="1.5" strokeLinecap="round" />
                <polyline points="26.5,15 30,11 33.5,15" stroke="#C9A227" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h2>Point it at what matters.</h2>
              <p>Give Meridian one objective and let it work. You&apos;ll see the difference in your first briefing.</p>
              {SIGNUP_ENABLED
                ? <a href="/onboarding/plan" className="btn-primary">
                    Choose your plan
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                : <button type="button" onClick={openModal} className="btn-primary" style={{ cursor: 'pointer', fontFamily: 'inherit' }}>
                    Choose your plan
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
              }
            </div>
          </section>

          <footer>
            <div className="wrap">
              <div className="brand" style={{justifyContent:'center'}}>
                <svg width="26" height="26" viewBox="0 0 60 60" aria-hidden="true">
                  <circle cx="30" cy="35" r="8.5" fill="#C9A227" opacity=".13" />
                  <circle cx="30" cy="35" r="5" fill="#C9A227" />
                  <line x1="30" y1="35" x2="30" y2="12" stroke="rgba(255,255,255,.45)" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                <span className="brand-name" style={{fontSize:'17px'}}>Meridian <b>Arc</b></span>
              </div>
              <div className="foot-links">
                <a href="#difference">The difference</a>
                <a href="#how">How it works</a>
                <a href="#pricing">Pricing</a>
                <a href="/legal/terms">Terms</a>
                <a href="/legal/privacy">Privacy</a>
                <a href="mailto:connect@solvega.ai">connect@solvega.ai</a>
              </div>
              <div>© 2026 Solvega Labs LLC · Meridian Arc · meridianarc.ai</div>
            </div>
          </footer>

        </main>
      </div>
    </>
  )
}
