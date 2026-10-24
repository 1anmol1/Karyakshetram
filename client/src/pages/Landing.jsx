import { Link } from 'react-router-dom';
import { useApp } from '../lib/state.jsx';
import { Icon, ThemeToggle } from '../components/ui.jsx';
import { Footer } from '../components/Layout.jsx';

export default function Landing() {
  const { categories } = useApp();
  return (
    <div className="page">
      <header className="hdr">
        <nav className="hleft"><a href="#product" className="s13 b">Product</a><a href="#how" className="s13 muted hide-sm" style={{ marginLeft: 14 }}>How it works</a><Link to="/trust" className="s13 muted hide-sm" style={{ marginLeft: 14 }}>Trust Center</Link></nav>
        <div className="logo">Karyakshetram<i>.</i></div>
        <div className="hright"><span className="hide-sm"><ThemeToggle /></span><Link className="btn out sm" to="/login">Sign in</Link><Link className="btn ink sm" to="/signup">Get started</Link></div>
      </header>
      <section className="gridbg" style={{ padding: '56px 16px 64px' }} id="product">
        <div className="col ac g20">
          <a href="#categories" className="chip" style={{ height: 30, fontSize: 12 }}><span className="muted">Now scoring 30 business categories.</span><b>Explore</b></a>
          <div style={{ position: 'relative', padding: '36px clamp(16px,6vw,80px)', background: 'var(--bg)', border: '1px solid var(--line)', maxWidth: '100%' }}>
            <span className="corner" style={{ left: -1, top: -1, borderWidth: '3px 0 0 3px' }} /><span className="corner" style={{ right: -1, top: -1, borderWidth: '3px 3px 0 0' }} />
            <span className="corner" style={{ left: -1, bottom: -1, borderWidth: '0 0 3px 3px' }} /><span className="corner" style={{ right: -1, bottom: -1, borderWidth: '0 3px 3px 0' }} />
            <h1 style={{ fontSize: 'clamp(40px,6vw,76px)', fontWeight: 700, letterSpacing: '-3px', lineHeight: 1.02, textAlign: 'center' }}>Know where your next<br />store will <span style={{ color: 'var(--accent2)' }}>earn.</span></h1>
            <div className="row g6 jc s13" style={{ marginTop: 14, color: 'var(--ok)' }}><span className="dot" style={{ background: 'var(--ok)' }} />Live for Pune &amp; Pimpri-Chinchwad</div>
          </div>
          <div className="s20" style={{ marginTop: 8, textAlign: 'center' }}>Retail expansion intelligence for <b style={{ color: 'var(--accent2)' }}>chains and first-time owners</b></div>
          <p className="muted s15" style={{ maxWidth: 640, textAlign: 'center' }}>Ranked sites with P10–P90 revenue, break-even rent, stress tests and own-store cannibalisation. Every number is traceable to its input.</p>
          <div className="row g12 wrap jc"><Link to="/signup" className="btn ink lg glow">Start finding locations <Icon n="arrow-right-line" s={18} /></Link><Link to="/login?next=/check" className="btn out lg"><Icon n="crosshair-2-line" />Check one address</Link></div>
        </div>
      </section>
      <section className="wrapx col g24" style={{ padding: '40px 28px' }} id="categories">
        <div className="row sb wrap g8"><h2 className="h3">One engine, every format</h2><span className="s13 muted">Category profiles change the rules, drivers and catchment</span></div>
        <div className="row g8 wrap">{categories.map((c, i) => <Link to="/signup" key={c.key} className={`chip ${i === 0 ? 'on' : ''}`}><Icon n={c.icon} s={14} c={i === 0 ? 'var(--onInk)' : 'var(--accent)'} />{c.name}</Link>)}</div>
        <div className="grid3" id="how" style={{ marginTop: 8 }}>
          {[['map-2-line', 'Find and rank', 'Five labelled picks at least 1.5 km apart: best overall, lowest risk, lowest investment, growth, under-served.'],
            ['git-merge-line', 'See network effects', 'A Huff model shows how much revenue a new site takes from your own stores before you sign a lease.'],
            ['shield-check-line', 'Defend the decision', 'Calibrated ranges, four stress tests and driver attribution. The AI only explains; it never scores.']].map(([ic, t, d]) => (
            <div key={t} className="panel pad24 col g10"><div className="iconbtn fill" style={{ background: 'var(--accentSoft)', color: 'var(--accent)' }}><Icon n={ic} /></div><div className="h4">{t}</div><p className="s13 muted">{d}</p></div>))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
